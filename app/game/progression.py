"""Fórmulas de progressão: XP, limites de nível, atributos, poder e rank de conta."""
from .catalog import STATS

# ------------------------------------------------------------ personagens

LEVEL_CAPS = [20, 40, 60, 80, 100]  # nível máximo em cada estágio de ascensão
MAX_ASCENSION = len(LEVEL_CAPS) - 1
MAX_AWAKENING = 5
MAX_SKILL_LEVEL = 5

ASCENSION_COSTS = {
    1: {"coins": 20_000, "items": {"ferradura_bronze": 5}},
    2: {"coins": 40_000, "items": {"ferradura_bronze": 8, "ferradura_prata": 3}},
    3: {"coins": 80_000, "items": {"ferradura_prata": 8, "ferradura_ouro": 2}},
    4: {"coins": 150_000, "items": {"ferradura_ouro": 6}},
}

ATTR_TRAIN_COST = {"coins": 1_500, "items": {"cenoura": 1}}
ATTR_GAIN_RANGE = (3, 7)
ATTR_GREAT_CHANCE = 0.10  # treino excelente: ganho em dobro

DUPE_FRAGMENTS = {3: 1, 4: 5, 5: 25, 6: 60}  # cópias além do despertar 5 viram fragmentos estelares


def xp_to_next(level: int) -> int:
    return int(200 + 60 * level ** 1.5)


def level_cap(ascension: int) -> int:
    return LEVEL_CAPS[ascension]


def attr_cap(level: int) -> int:
    """Bônus máximo de treino focado por atributo."""
    return 20 + 4 * level


def skill_upgrade_cost(level: int) -> dict:
    return {"coins": 3_000 * level, "items": {"cristal_habilidade": level}}


def stat_multiplier(level: int, ascension: int, awakening: int) -> float:
    growth = 1 + 0.045 * (level - 1)
    return growth * (1 + 0.08 * ascension) * (1 + 0.05 * awakening)


def compute_stats(uc) -> dict[str, dict]:
    mult = stat_multiplier(uc.level, uc.ascension, uc.awakening)
    equip = uc.equipment.data if uc.equipment else {}
    out = {}
    for stat in STATS:
        base = int(getattr(uc.character, f"base_{stat}") * mult)
        bonus = getattr(uc, f"bonus_{stat}")
        eq = equip.get("value", 0) if equip.get("stat") in (stat, "all") else 0
        out[stat] = {"base": base, "bonus": bonus, "equip": eq, "total": base + bonus + eq}
    return out


def skill_multiplier(uc) -> float:
    return 1 + sum(s.level * s.skill.power_bonus for s in uc.skills)


def compute_power(uc) -> int:
    stats = compute_stats(uc)
    return int(sum(s["total"] for s in stats.values()) * skill_multiplier(uc))


def refresh_power(uc) -> None:
    uc.power = compute_power(uc)


# ------------------------------------------------------------ conta

MAX_ACCOUNT_LEVEL = 60
LEVEL_UP_CARATS = 100

RANKS = [
    (1, "Bronze", "rank-bronze"),
    (10, "Prata", "rank-silver"),
    (20, "Ouro", "rank-gold"),
    (30, "Platina", "rank-platinum"),
    (40, "Diamante", "rank-diamond"),
    (50, "Lendário", "rank-legend"),
]


def account_xp_to_next(level: int) -> int:
    return 200 + 80 * level


def rank_for(level: int) -> dict:
    tier = 0
    for i, (min_level, _, _) in enumerate(RANKS):
        if level >= min_level:
            tier = i
    _, name, icon = RANKS[tier]
    return {"tier": tier, "name": name, "icon": icon}
