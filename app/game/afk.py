"""Farm AFK: a produção é calculada pelo tempo desde a última coleta — nada roda em loop.

pendente = taxa_por_hora × min(horas desde a coleta, capacidade do armazém) + frações guardadas
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from . import feed
from .clock import iso, utcnow
from .registry import ITEM_INFO, char_public
from .rewards import GameError, describe, grant, pay
from .tracking import track

MIN_COLLECT_MINUTES = 10
FARM_MAX_LEVEL = 10
STORAGE_MAX_LEVEL = 5
HELPER_SLOTS = 3
HELPER_RARITY_BONUS = {3: 0.05, 4: 0.10, 5: 0.15}

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
    farm = db.get(m.Farm, user.id)
    if farm is None:
        farm = m.Farm(user_id=user.id, level=1, storage_level=1, last_collected_at=utcnow(), carry={})
        db.add(farm)
        db.flush()
    return farm


def get_helpers(db: Session, user: m.User) -> list[m.UserCharacter]:
    return db.scalars(
        select(m.UserCharacter)
        .where(m.UserCharacter.user_id == user.id, m.UserCharacter.afk_slot.is_not(None))
        .order_by(m.UserCharacter.afk_slot)
    ).all()


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


def _as_rewards(amounts: dict[str, int]) -> dict:
    rewards: dict = {k: amounts[k] for k in CURRENCY_KEYS if amounts.get(k)}
    items = {k: v for k, v in amounts.items() if k not in CURRENCY_KEYS and v > 0}
    if items:
        rewards["items"] = items
    return rewards


def _settle(db: Session, user: m.User, farm: m.Farm, helpers: list[m.UserCharacter]) -> list[dict]:
    """Entrega o que foi produzido (partes inteiras) e guarda as frações para depois."""
    now = utcnow()
    produced = pending(farm, helpers, now)
    whole = {k: int(v) for k, v in produced.items()}
    farm.carry = {k: round(v - whole[k], 6) for k, v in produced.items()}
    farm.last_collected_at = now
    rewards = _as_rewards(whole)
    if not rewards:
        return []
    return grant(db, user, rewards)["rewards"]


def collect(db: Session, user: m.User) -> dict:
    farm = get_farm(db, user)
    elapsed, _ = accrued_hours(farm, utcnow())
    if elapsed * 60 < MIN_COLLECT_MINUTES:
        left = MIN_COLLECT_MINUTES - int(elapsed * 60)
        raise GameError(f"A fazenda ainda está produzindo. Volte em {left} min.")
    collected = _settle(db, user, farm, get_helpers(db, user))
    user.afk_collections += 1
    track(db, user, "afk_collect", 1)
    return {"collected": collected, "hours": round(elapsed, 2)}


def upgrade(db: Session, user: m.User, kind: str) -> dict:
    farm = get_farm(db, user)
    helpers = get_helpers(db, user)
    if kind == "farm":
        if farm.level >= FARM_MAX_LEVEL:
            raise GameError("A fazenda já está no nível máximo.")
        pay(db, user, {"coins": FARM_UPGRADE_COST[farm.level]})
        collected = _settle(db, user, farm, helpers)  # produção antiga fecha com a taxa antiga
        farm.level += 1
        track(db, user, "farm_level", farm.level)
        if farm.level == FARM_MAX_LEVEL:
            feed.emit(db, "farm", "farmer", "levou a Farm AFK ao nível máximo!", user)
    elif kind == "storage":
        if farm.storage_level >= STORAGE_MAX_LEVEL:
            raise GameError("O armazém já está no nível máximo.")
        pay(db, user, {"coins": STORAGE_UPGRADE_COST[farm.storage_level]})
        collected = _settle(db, user, farm, helpers)
        farm.storage_level += 1
    else:
        raise GameError("Melhoria inválida.")
    return {"collected": collected}


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
    collected = _settle(db, user, farm, get_helpers(db, user))  # fecha a produção com a equipe antiga
    for uc in owned.values():
        uc.afk_slot = None
    for slot, uc_id in enumerate(slots, start=1):
        if uc_id is not None:
            owned[uc_id].afk_slot = slot
    return {"collected": collected}


def _resource_info(key: str) -> dict:
    if key in ITEM_INFO:
        i = ITEM_INFO[key]
        return {"icon": i["icon"], "name": i["name"], "rarity": i["rarity"]}
    return {k: describe({key: 1})[0][k] for k in ("icon", "name", "rarity")}


def view(db: Session, user: m.User) -> dict:
    farm = get_farm(db, user)
    helpers = get_helpers(db, user)
    now = utcnow()
    elapsed, hours = accrued_hours(farm, now)
    current_rates = rates(farm, helpers)
    pend = pending(farm, helpers, now)
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
        "upgrades": {
            "farm": {"cost": FARM_UPGRADE_COST.get(farm.level),
                     "next_rates": base_rates(farm.level + 1) if farm.level < FARM_MAX_LEVEL else None},
            "storage": {"cost": STORAGE_UPGRADE_COST.get(farm.storage_level),
                        "next_hours": storage_hours(farm.storage_level + 1)
                        if farm.storage_level < STORAGE_MAX_LEVEL else None},
        },
    }
