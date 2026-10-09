"""Economia: inventário, custos, recompensas, XP de conta e obtenção de personagens."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..database import session_cache
from ..realtime import hub
from . import feed
from .catalog import COSMETIC_CATEGORIES, STATS
from .progression import (
    DUPE_FRAGMENTS,
    LEVEL_UP_CARATS,
    MAX_ACCOUNT_LEVEL,
    MAX_AWAKENING,
    account_xp_to_next,
    rank_for,
    refresh_power,
)
from .registry import CHAR_INFO, ITEM_INFO, char_public
from .tracking import track


class GameError(Exception):
    """Erro de regra do jogo — vira HTTP 400 com a mensagem para o jogador."""


CURRENCIES = {
    "coins": ("moedas", "coin"),
    "carats": ("carats", "carat"),
    "fragments": ("fragmentos estelares", "fragment"),
}

# ------------------------------------------------------------ inventário


def _inventory(db: Session, user_id: int) -> dict[str, m.InventoryItem]:
    """O inventário inteiro do jogador, numa consulta só por requisição."""
    return session_cache(db, ("inventory", user_id), lambda: {
        row.item_id: row
        for row in db.scalars(select(m.InventoryItem).where(m.InventoryItem.user_id == user_id))
    })


def get_qty(db: Session, user_id: int, item_id: str) -> int:
    row = _inventory(db, user_id).get(item_id)
    return row.qty if row else 0


def add_item(db: Session, user_id: int, item_id: str, qty: int) -> None:
    inventory = _inventory(db, user_id)
    row = inventory.get(item_id)
    if row is None:
        row = inventory[item_id] = m.InventoryItem(user_id=user_id, item_id=item_id, qty=0)
        db.add(row)
    if ITEM_INFO[item_id]["category"] in COSMETIC_CATEGORIES:
        row.qty = 1  # cosméticos não acumulam
    else:
        row.qty += qty


def remove_item(db: Session, user_id: int, item_id: str, qty: int) -> None:
    row = _inventory(db, user_id).get(item_id)
    have = row.qty if row else 0
    if have < qty:
        raise GameError(f"Você precisa de {qty}x {ITEM_INFO[item_id]['name']} (tem {have}).")
    row.qty -= qty


# ------------------------------------------------------------ custos


def can_pay(db: Session, user: m.User, cost: dict, times: int = 1) -> bool:
    if any(getattr(user, cur) < cost.get(cur, 0) * times for cur in CURRENCIES):
        return False
    return all(get_qty(db, user.id, i) >= q * times for i, q in cost.get("items", {}).items())


def pay(db: Session, user: m.User, cost: dict, times: int = 1) -> None:
    """Valida tudo antes de descontar qualquer coisa."""
    for cur, (label, _) in CURRENCIES.items():
        need = cost.get(cur, 0) * times
        if getattr(user, cur) < need:
            raise GameError(f"{label.capitalize()} insuficientes: precisa de {feed.fmt(need)}.")
    for item_id, qty in cost.get("items", {}).items():
        have = get_qty(db, user.id, item_id)
        if have < qty * times:
            raise GameError(f"Você precisa de {qty * times}x {ITEM_INFO[item_id]['name']} (tem {have}).")
    for cur in CURRENCIES:
        setattr(user, cur, getattr(user, cur) - cost.get(cur, 0) * times)
    for item_id, qty in cost.get("items", {}).items():
        remove_item(db, user.id, item_id, qty * times)


# ------------------------------------------------------------ conta


def add_account_xp(db: Session, user: m.User, amount: int) -> None:
    if amount <= 0 or user.level >= MAX_ACCOUNT_LEVEL:
        return
    old_rank = rank_for(user.level)
    user.xp += amount
    leveled = False
    while user.level < MAX_ACCOUNT_LEVEL and user.xp >= account_xp_to_next(user.level):
        user.xp -= account_xp_to_next(user.level)
        user.level += 1
        user.carats += LEVEL_UP_CARATS
        leveled = True
    if user.level >= MAX_ACCOUNT_LEVEL:
        user.xp = 0
    if not leveled:
        return
    track(db, user, "account_level", user.level)
    hub.update_viewer(user.id, level=user.level)
    new_rank = rank_for(user.level)
    if new_rank["tier"] > old_rank["tier"]:
        feed.emit(db, "rank_up", "rank-up", f"alcançou Rank {new_rank['name']}.", user,
                  {"rank": new_rank["name"], "level": user.level})


# ------------------------------------------------------------ personagens


def owned_characters(db: Session, user_id: int) -> dict[str, m.UserCharacter]:
    """A coleção inteira do jogador (com as habilidades), numa consulta só por requisição.
    Um 10x consulta aqui, em vez de perguntar ao banco por cada personagem sorteada."""
    return session_cache(db, ("owned", user_id), lambda: {
        uc.character_id: uc
        for uc in db.scalars(select(m.UserCharacter).where(m.UserCharacter.user_id == user_id))
    })


def _catalog(db: Session) -> tuple[dict[str, m.Character], dict[str, m.Skill]]:
    """Personagens e habilidades do catálogo, para montar uma personagem nova sem reler do banco."""
    return session_cache(db, "catalog", lambda: (
        {c.id: c for c in db.scalars(select(m.Character))},
        {s.id: s for s in db.scalars(select(m.Skill))},
    ))


def _new_character(db: Session, user: m.User, character_id: str) -> m.UserCharacter:
    info = CHAR_INFO[character_id]
    characters, skills = _catalog(db)
    # Os valores iniciais vão explícitos: o padrão das colunas só vale ao gravar no banco,
    # e o poder é calculado antes disso.
    uc = m.UserCharacter(
        user_id=user.id, character_id=character_id, character=characters[character_id],
        level=1, xp=0, ascension=0, awakening=0, **{f"bonus_{stat}": 0 for stat in STATS},
        skills=[
            m.UserCharacterSkill(skill_id=skill_id, slot=slot, level=1, skill=skills[skill_id])
            for slot, skill_id in ((1, info["unique_skill"]), (2, info["generic_skill"]))
        ],
    )
    refresh_power(uc)
    db.add(uc)
    return uc


def obtain_character(db: Session, user: m.User, character_id: str) -> dict:
    """Personagem nova entra no estábulo; cópia vira despertar; além do despertar 5, fragmentos.
    O "user_character_id" de uma personagem nova fica None até o próximo flush."""
    info = CHAR_INFO[character_id]
    owned = owned_characters(db, user.id)
    uc = owned.get(character_id)

    if uc is None:
        uc = owned[character_id] = _new_character(db, user, character_id)
        track(db, user, "collection", len(owned))
        return {"status": "new", "awakening": 0, "fragments": 0, "user_character_id": uc.id}

    if uc.awakening < MAX_AWAKENING:
        uc.awakening += 1
        refresh_power(uc)
        if uc.awakening == MAX_AWAKENING:
            track(db, user, "max_awakening", 1)
            if info["rarity"] == 5:
                feed.emit(db, "awakening", "awakening",
                          f"despertou totalmente {feed.char_tag(info['name'], 5)}!", user,
                          {"character": character_id})
        return {"status": "awakening", "awakening": uc.awakening, "fragments": 0, "user_character_id": uc.id}

    frags = DUPE_FRAGMENTS[info["rarity"]]
    user.fragments += frags
    return {"status": "fragments", "awakening": uc.awakening, "fragments": frags, "user_character_id": uc.id}


# ------------------------------------------------------------ recompensas


def describe(rewards: dict, times: int = 1) -> list[dict]:
    """Lista legível de recompensas (para mostrar em missões, loja, coleta...)."""
    out = []
    for cur, (label, icon) in CURRENCIES.items():
        if rewards.get(cur):
            out.append({"kind": cur, "icon": icon, "name": label, "qty": rewards[cur] * times, "rarity": 3})
    if rewards.get("account_xp"):
        out.append({"kind": "account_xp", "icon": "xp", "name": "XP de conta",
                    "qty": rewards["account_xp"] * times, "rarity": 2})
    for item_id, qty in rewards.get("items", {}).items():
        info = ITEM_INFO[item_id]
        out.append({"kind": "item", "id": item_id, "icon": info["icon"], "name": info["name"],
                    "qty": qty * times, "rarity": info["rarity"], "category": info["category"]})
    if rewards.get("character"):
        c = char_public(rewards["character"])
        out.append({"kind": "character", "id": c["id"], "icon": "horse", "name": c["name"],
                    "qty": times, "rarity": c["rarity"], "color": c["color"], "img": c["img"]})
    return out


def grant(db: Session, user: m.User, rewards: dict, times: int = 1) -> dict:
    """Aplica recompensas. Retorna a descrição e, se houver, o resultado das personagens."""
    for cur in CURRENCIES:
        if rewards.get(cur):
            setattr(user, cur, getattr(user, cur) + rewards[cur] * times)
    for item_id, qty in rewards.get("items", {}).items():
        add_item(db, user.id, item_id, qty * times)
    characters = []
    if rewards.get("character"):
        for _ in range(times):
            characters.append(obtain_character(db, user, rewards["character"]))
        if characters[0]["user_character_id"] is None:
            db.flush()  # a personagem era nova: gera o id dela
            uc_id = owned_characters(db, user.id)[rewards["character"]].id
            for c in characters:
                c["user_character_id"] = uc_id
    if rewards.get("account_xp"):
        add_account_xp(db, user, rewards["account_xp"] * times)
    return {"rewards": describe(rewards, times), "characters": characters}
