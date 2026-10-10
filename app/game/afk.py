"""Farm AFK: a produção é calculada pelo tempo desde a última coleta — nada roda em loop.

pendente = taxa_por_hora × min(horas desde a coleta, capacidade do armazém) + frações guardadas

Visitante rara: cada hora inteira de produção é um sorteio independente da Mejiro Ramonu (6★):
0,5% por hora, ou 1% nas horas de sábado e domingo (fuso do jogo; vale o meio da hora, então
23h–00h de sexta ainda é sexta). A fração de hora que sobra fica guardada, como as frações dos
recursos, e vira chance na próxima coleta.
"""
import random
from datetime import datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, lazyload

from .. import models as m
from ..database import forget, session_cache
from . import feed
from .clock import is_weekend, iso, utcnow
from .registry import CHAR_INFO, ITEM_INFO, char_public
from .rewards import GameError, describe, grant, obtain_character, owned_characters, pay
from .tracking import track

MIN_COLLECT_MINUTES = 10
FARM_MAX_LEVEL = 10
STORAGE_MAX_LEVEL = 5
HELPER_SLOTS = 3
HELPER_RARITY_BONUS = {3: 0.05, 4: 0.10, 5: 0.15, 6: 0.20}

RARE_VISITOR = "mejiro_ramonu"
RARE_CHANCE = 0.005
RARE_CHANCE_WEEKEND = 0.01
RARE_CARRY = "rare_hours"  # fração de hora que ainda não virou chance (guardada em farm.carry)

rng = random.SystemRandom()  # os testes trocam por um sorteio fixo

FARM_UPGRADE_COST = {lvl: round(8_000 * lvl ** 1.6 / 500) * 500 for lvl in range(1, FARM_MAX_LEVEL)}
STORAGE_UPGRADE_COST = {1: 15_000, 2: 40_000, 3: 90_000, 4: 180_000}

CURRENCY_KEYS = ("coins", "carats", "account_xp")


def base_rates(level: int) -> dict[str, float]:
    """Produção por hora em cada nível da fazenda."""
    n = level - 1
    return {
        "coins": 1_200 + 500 * n,
        "carats": 4 * level,
        "account_xp": 40 + 10 * n,
        "manual_basico": 1.0 + 0.4 * n,
        "manual_avancado": 0.15 + 0.1 * n,
        "cenoura": 0.4 + 0.12 * n,
        "cristal_habilidade": 0.12 + 0.06 * n,
        "ferradura_bronze": 0.25 + 0.08 * n,
        "ferradura_prata": 0.04 * n,
    }


def storage_hours(storage_level: int) -> int:
    return 8 + 4 * (storage_level - 1)


def get_farm(db: Session, user: m.User) -> m.Farm:
    """A fazenda do jogador, lida uma vez por requisição (a tela que volta na resposta reaproveita)."""
    def load():
        farm = db.get(m.Farm, user.id)
        if farm is None:
            farm = m.Farm(user_id=user.id, level=1, storage_level=1, last_collected_at=utcnow(), carry={})
            db.add(farm)
            db.flush()
        return farm
    return session_cache(db, ("farm", user.id), load)


def _team(db: Session, user: m.User) -> dict:
    """As ajudantes escaladas e a visitante rara (se o jogador já a tem), numa consulta só por
    requisição. As habilidades delas não são lidas: a fazenda só usa raridade e nível."""
    def load():
        rows = db.scalars(
            select(m.UserCharacter)
            .where(m.UserCharacter.user_id == user.id,
                   or_(m.UserCharacter.afk_slot.is_not(None), m.UserCharacter.character_id == RARE_VISITOR))
            .order_by(m.UserCharacter.afk_slot)
            .options(lazyload(m.UserCharacter.skills))
        ).all()
        return {"helpers": [uc for uc in rows if uc.afk_slot is not None],
                "rare": next((uc for uc in rows if uc.character_id == RARE_VISITOR), None)}
    return session_cache(db, ("farm_team", user.id), load)


def farm_team(db: Session, user: m.User) -> tuple[list[m.UserCharacter], m.UserCharacter | None]:
    team = _team(db, user)
    return team["helpers"], team["rare"]


def get_helpers(db: Session, user: m.User) -> list[m.UserCharacter]:
    return farm_team(db, user)[0]


def helper_bonus(uc: m.UserCharacter) -> float:
    return HELPER_RARITY_BONUS[uc.character.rarity] + uc.level / 1000


def efficiency(helpers: list[m.UserCharacter]) -> float:
    return 1 + sum(helper_bonus(h) for h in helpers)


def rates(farm: m.Farm, helpers: list[m.UserCharacter]) -> dict[str, float]:
    eff = efficiency(helpers)
    return {k: v * eff for k, v in base_rates(farm.level).items()}


def accrued_hours(farm: m.Farm, now) -> tuple[float, float]:
    elapsed = max(0.0, (now - farm.last_collected_at).total_seconds() / 3600)
    return elapsed, min(elapsed, storage_hours(farm.storage_level))


def pending(farm: m.Farm, helpers: list[m.UserCharacter], now) -> dict[str, float]:
    _, hours = accrued_hours(farm, now)
    carry = farm.carry or {}
    return {k: rate * hours + carry.get(k, 0.0) for k, rate in rates(farm, helpers).items()}


def rare_rolls(farm: m.Farm, now: datetime) -> tuple[list[datetime], float]:
    """O meio de cada hora inteira de produção ainda não sorteada, e a fração de hora que sobra.
    A primeira hora começou antes da última coleta quando havia uma fração guardada."""
    _, hours = accrued_hours(farm, now)
    carried = (farm.carry or {}).get(RARE_CARRY, 0.0)
    total = carried + hours
    whole = int(total + 1e-9)  # 7,9999999 de horas por arredondamento ainda são 8 chances
    middles = [farm.last_collected_at + timedelta(hours=k + 0.5 - carried) for k in range(whole)]
    return middles, max(0.0, total - whole)


def rare_chance(at: datetime) -> float:
    """Chance da hora de produção cujo meio caiu em `at`."""
    return RARE_CHANCE_WEEKEND if is_weekend(at) else RARE_CHANCE


def _rare_visit(db: Session, user: m.User) -> dict:
    """A visitante rara apareceu: entra no estábulo (ou vira despertar) e o Chat Global fica sabendo."""
    info = CHAR_INFO[RARE_VISITOR]
    outcome = obtain_character(db, user, RARE_VISITOR)
    if outcome["user_character_id"] is None:
        db.flush()  # personagem nova: gera o id, para a tela levar até ela
        uc = owned_characters(db, user.id)[RARE_VISITOR]
        outcome["user_character_id"] = uc.id
        _team(db, user)["rare"] = uc  # a tela da fazenda passa a mostrar que ela é sua, sem reler
    feed.emit(db, "six_star", "flower", f"encontrou {feed.char_tag(info['name'], info['rarity'])} na Fazenda!",
              user, {"character": RARE_VISITOR})
    return {"character": char_public(RARE_VISITOR), "rarity": info["rarity"], "outcome": outcome["status"],
            "awakening": outcome["awakening"], "fragments": outcome["fragments"],
            "user_character_id": outcome["user_character_id"]}


def _as_rewards(amounts: dict[str, int]) -> dict:
    rewards: dict = {k: amounts[k] for k in CURRENCY_KEYS if amounts.get(k)}
    items = {k: v for k, v in amounts.items() if k not in CURRENCY_KEYS and v > 0}
    if items:
        rewards["items"] = items
    return rewards


def _settle(db: Session, user: m.User, farm: m.Farm,
            helpers: list[m.UserCharacter]) -> tuple[list[dict], list[dict]]:
    """Entrega o que foi produzido (partes inteiras), sorteia a visitante rara a cada hora
    inteira e guarda as frações para depois. Retorna (recursos, visitas)."""
    now = utcnow()
    produced = pending(farm, helpers, now)
    rolls, rest = rare_rolls(farm, now)
    whole = {k: int(v) for k, v in produced.items()}
    farm.carry = {**{k: round(v - whole[k], 6) for k, v in produced.items()}, RARE_CARRY: round(rest, 6)}
    farm.last_collected_at = now
    rewards = _as_rewards(whole)
    collected = grant(db, user, rewards)["rewards"] if rewards else []
    visits = [_rare_visit(db, user) for at in rolls if rng.random() < rare_chance(at)]
    return collected, visits


def collect(db: Session, user: m.User) -> dict:
    farm = get_farm(db, user)
    elapsed, _ = accrued_hours(farm, utcnow())
    if elapsed * 60 < MIN_COLLECT_MINUTES:
        left = MIN_COLLECT_MINUTES - int(elapsed * 60)
        raise GameError(f"A fazenda ainda está produzindo. Volte em {left} min.")
    collected, rare = _settle(db, user, farm, get_helpers(db, user))
    user.afk_collections += 1
    track(db, user, "afk_collect", 1)
    return {"collected": collected, "rare": rare, "hours": round(elapsed, 2)}


def upgrade(db: Session, user: m.User, kind: str) -> dict:
    farm = get_farm(db, user)
    helpers = get_helpers(db, user)
    if kind == "farm":
        if farm.level >= FARM_MAX_LEVEL:
            raise GameError("A fazenda já está no nível máximo.")
        pay(db, user, {"coins": FARM_UPGRADE_COST[farm.level]})
        collected, rare = _settle(db, user, farm, helpers)  # produção antiga fecha com a taxa antiga
        farm.level += 1
        track(db, user, "farm_level", farm.level)
        if farm.level == FARM_MAX_LEVEL:
            feed.emit(db, "farm", "farmer", "levou a Farm AFK ao nível máximo!", user)
    elif kind == "storage":
        if farm.storage_level >= STORAGE_MAX_LEVEL:
            raise GameError("O armazém já está no nível máximo.")
        pay(db, user, {"coins": STORAGE_UPGRADE_COST[farm.storage_level]})
        collected, rare = _settle(db, user, farm, helpers)
        farm.storage_level += 1
    else:
        raise GameError("Melhoria inválida.")
    return {"collected": collected, "rare": rare}


def set_helpers(db: Session, user: m.User, slots: list[int | None]) -> dict:
    if len(slots) != HELPER_SLOTS:
        raise GameError("Envie exatamente 3 vagas.")
    chosen = [s for s in slots if s is not None]
    if len(chosen) != len(set(chosen)):
        raise GameError("A mesma personagem não pode ocupar duas vagas.")
    owned = {uc.id: uc for uc in db.scalars(
        select(m.UserCharacter).where(m.UserCharacter.user_id == user.id)).all()}
    if any(s not in owned for s in chosen):
        raise GameError("Personagem não encontrada no seu estábulo.")

    farm = get_farm(db, user)
    collected, rare = _settle(db, user, farm, get_helpers(db, user))  # fecha a produção com a equipe antiga
    for uc in owned.values():
        uc.afk_slot = None
    for slot, uc_id in enumerate(slots, start=1):
        if uc_id is not None:
            owned[uc_id].afk_slot = slot
    forget(db, ("farm_team", user.id))  # a equipe mudou: a tela consulta de novo
    return {"collected": collected, "rare": rare}


def _resource_info(key: str) -> dict:
    if key in ITEM_INFO:
        i = ITEM_INFO[key]
        return {"icon": i["icon"], "name": i["name"], "rarity": i["rarity"]}
    return {k: describe({key: 1})[0][k] for k in ("icon", "name", "rarity")}


def view(db: Session, user: m.User) -> dict:
    farm = get_farm(db, user)
    helpers, rare_uc = farm_team(db, user)
    now = utcnow()
    elapsed, hours = accrued_hours(farm, now)
    current_rates = rates(farm, helpers)
    pend = pending(farm, helpers, now)
    rolls, _ = rare_rolls(farm, now)
    return {
        "level": farm.level,
        "max_level": FARM_MAX_LEVEL,
        "storage_level": farm.storage_level,
        "storage_max_level": STORAGE_MAX_LEVEL,
        "storage_hours": storage_hours(farm.storage_level),
        "last_collected_at": iso(farm.last_collected_at),
        "server_time": iso(now),
        "elapsed_hours": round(elapsed, 4),
        "effective_hours": round(hours, 4),
        "full": elapsed >= storage_hours(farm.storage_level),
        "min_collect_minutes": MIN_COLLECT_MINUTES,
        "efficiency": round(efficiency(helpers), 4),
        "resources": [
            {"key": k, **_resource_info(k), "rate": round(r, 4), "pending": round(pend[k], 4),
             "carry": round((farm.carry or {}).get(k, 0.0), 6)}
            for k, r in current_rates.items() if r > 0 or pend[k] >= 1
        ],
        "helpers": [
            {"slot": h.afk_slot, "user_character_id": h.id, "character": char_public(h.character_id),
             "level": h.level, "bonus": round(helper_bonus(h), 4)}
            for h in helpers
        ],
        "helper_slots": HELPER_SLOTS,
        "rare": {
            "character": char_public(RARE_VISITOR),
            "chance": RARE_CHANCE,
            "chance_weekend": RARE_CHANCE_WEEKEND,
            "weekend_now": is_weekend(now),
            "chances": len(rolls),  # horas inteiras de produção ainda não sorteadas
            "carry": round((farm.carry or {}).get(RARE_CARRY, 0.0), 6),
            "owned": rare_uc is not None,
            "awakening": rare_uc.awakening if rare_uc else 0,
            "user_character_id": rare_uc.id if rare_uc else None,
        },
        "upgrades": {
            "farm": {"cost": FARM_UPGRADE_COST.get(farm.level),
                     "next_rates": base_rates(farm.level + 1) if farm.level < FARM_MAX_LEVEL else None},
            "storage": {"cost": STORAGE_UPGRADE_COST.get(farm.storage_level),
                        "next_hours": storage_hours(farm.storage_level + 1)
                        if farm.storage_level < STORAGE_MAX_LEVEL else None},
        },
    }
