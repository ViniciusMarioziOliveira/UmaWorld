"""Centro de Treinamento: nível, atributos, habilidades, ascensão e equipamento."""
import random

from sqlalchemy.orm import Session

from .. import models as m
from . import feed
from .catalog import STAT_LABELS, STATS
from .progression import (
    ASCENSION_COSTS,
    ATTR_GAIN_RANGE,
    ATTR_GREAT_CHANCE,
    ATTR_TRAIN_COST,
    MAX_ASCENSION,
    MAX_SKILL_LEVEL,
    attr_cap,
    level_cap,
    refresh_power,
    skill_upgrade_cost,
    xp_to_next,
)
from .registry import CHAR_INFO, ITEM_INFO
from .rewards import GameError, add_item, can_pay, get_qty, owned_characters, pay, remove_item
from .tracking import track

rng = random.SystemRandom()

MANUAL_ORDER = ("manual_elite", "manual_avancado", "manual_basico")


def get_owned(db: Session, user: m.User, uc_id: int) -> m.UserCharacter:
    uc = db.get(m.UserCharacter, uc_id)
    if uc is None or uc.user_id != user.id:
        raise GameError("Personagem não encontrada no seu estábulo.")
    return uc


def level_up(db: Session, user: m.User, uc: m.UserCharacter, manuals: dict[str, int]) -> dict:
    """Usa manuais do maior para o menor e para assim que bater o limite de nível —
    o que sobrar continua no inventário."""
    unknown = [k for k in manuals if k not in MANUAL_ORDER]
    if unknown:
        raise GameError("Item inválido para treino de nível.")
    cap = level_cap(uc.ascension)
    if uc.level >= cap:
        raise GameError("Nível máximo deste estágio. Faça a ascensão para continuar.")
    for item_id, qty in manuals.items():
        if qty and get_qty(db, user.id, item_id) < qty:
            raise GameError(f"Você não tem {qty}x {ITEM_INFO[item_id]['name']}.")

    start_level = uc.level
    used: dict[str, int] = {}
    coins_spent = 0
    out_of_coins = False
    for item_id in MANUAL_ORDER:
        data = ITEM_INFO[item_id]["data"]
        for _ in range(manuals.get(item_id, 0)):
            if uc.level >= cap:
                break
            if user.coins < data["coins"]:
                out_of_coins = True
                break
            user.coins -= data["coins"]
            coins_spent += data["coins"]
            used[item_id] = used.get(item_id, 0) + 1
            uc.xp += data["xp"]
            while uc.level < cap and uc.xp >= xp_to_next(uc.level):
                uc.xp -= xp_to_next(uc.level)
                uc.level += 1
            if uc.level >= cap:
                uc.xp = 0

    if not used:
        raise GameError("Moedas insuficientes para o treino." if out_of_coins else "Selecione ao menos um manual.")
    for item_id, qty in used.items():
        remove_item(db, user.id, item_id, qty)
    gained = uc.level - start_level
    track(db, user, "level_up", gained)
    refresh_power(uc)
    return {"levels_gained": gained, "used": used, "coins_spent": coins_spent}


def train_attribute(db: Session, user: m.User, uc: m.UserCharacter, stat: str, times: int) -> dict:
    if stat not in STATS:
        raise GameError("Atributo inválido.")
    cap = attr_cap(uc.level)
    field = f"bonus_{stat}"
    if getattr(uc, field) >= cap:
        raise GameError(f"{STAT_LABELS[stat]} já está no limite de treino para o nível {uc.level}. Suba de nível!")

    total_gain, greats, done = 0, 0, 0
    for _ in range(times):
        current = getattr(uc, field)
        if current >= cap:
            break
        if done and not can_pay(db, user, ATTR_TRAIN_COST):
            break  # faz quantas sessões der; só falha se não der nenhuma
        pay(db, user, ATTR_TRAIN_COST)
        gain = rng.randint(*ATTR_GAIN_RANGE)
        if rng.random() < ATTR_GREAT_CHANCE:
            gain *= 2
            greats += 1
        gain = min(gain, cap - current)
        setattr(uc, field, current + gain)
        total_gain += gain
        done += 1

    track(db, user, "attr_train", done)
    refresh_power(uc)
    return {"stat": stat, "label": STAT_LABELS[stat], "gain": total_gain, "sessions": done, "great": greats}


def upgrade_skill(db: Session, user: m.User, uc: m.UserCharacter, skill_id: str) -> dict:
    skill = next((s for s in uc.skills if s.skill_id == skill_id), None)
    if skill is None:
        raise GameError("Esta personagem não tem essa habilidade.")
    if skill.level >= MAX_SKILL_LEVEL:
        raise GameError("Habilidade já está no nível máximo.")
    pay(db, user, skill_upgrade_cost(skill.level))
    skill.level += 1
    track(db, user, "skill_up", 1)
    refresh_power(uc)
    return {"skill": skill.skill.name, "level": skill.level}


def ascend(db: Session, user: m.User, uc: m.UserCharacter) -> dict:
    if uc.ascension >= MAX_ASCENSION:
        raise GameError("Esta personagem já está na ascensão máxima.")
    if uc.level < level_cap(uc.ascension):
        raise GameError(f"Chegue ao nível {level_cap(uc.ascension)} antes de ascender.")
    stage = uc.ascension + 1
    pay(db, user, ASCENSION_COSTS[stage])
    uc.ascension = stage
    track(db, user, "ascend", 1)
    if stage == MAX_ASCENSION:
        track(db, user, "max_ascension", 1)
        info = CHAR_INFO[uc.character_id]
        feed.emit(db, "ascension", "ascension",
                  f"levou {feed.char_tag(info['name'], info['rarity'])} à ascensão máxima!", user,
                  {"character": uc.character_id})
    refresh_power(uc)
    return {"ascension": stage, "level_cap": level_cap(stage)}


def equip(db: Session, user: m.User, uc: m.UserCharacter, item_id: str | None) -> dict:
    if item_id is not None:
        info = ITEM_INFO.get(item_id)
        if info is None or info["category"] != "equipment":
            raise GameError("Este item não é um equipamento.")
        remove_item(db, user.id, item_id, 1)
    if uc.equipment_item_id:
        add_item(db, user.id, uc.equipment_item_id, 1)
    uc.equipment_item_id = item_id
    db.flush()
    db.refresh(uc, ["equipment"])
    refresh_power(uc)
    return {"equipment": item_id}


def roster(db: Session, user: m.User) -> list[m.UserCharacter]:
    """A coleção, da mais forte para a mais fraca."""
    return sorted(owned_characters(db, user.id).values(), key=lambda uc: (-uc.power, uc.id or 0))
