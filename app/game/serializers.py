"""Conversão dos modelos em JSON para a API."""
from sqlalchemy import select
from sqlalchemy.orm import Session, lazyload

from .. import models as m
from ..database import cached
from .catalog import STAT_LABELS, STATS
from .clock import iso
from .progression import (
    ASCENSION_COSTS,
    MAX_ACCOUNT_LEVEL,
    MAX_ASCENSION,
    MAX_AWAKENING,
    MAX_SKILL_LEVEL,
    account_xp_to_next,
    attr_cap,
    compute_stats,
    level_cap,
    rank_for,
    skill_upgrade_cost,
    xp_to_next,
)
from .registry import char_public, item_public
from .rewards import describe, get_qty


def resolve_avatar(db: Session, user: m.User) -> m.UserCharacter | None:
    """A corredora escolhida para o mundo; se não houver (ou não for mais dela), a mais forte."""
    owned = cached(db, ("owned", user.id))
    if owned is not None:  # a ação já leu a coleção (um pull, por exemplo): nada de consultar de novo
        uc = owned.get(user.avatar_character_id) if user.avatar_character_id else None
        return uc or max(owned.values(), key=lambda x: (x.power, -(x.id or 0)), default=None)
    query = select(m.UserCharacter).where(m.UserCharacter.user_id == user.id).options(lazyload(m.UserCharacter.skills))
    uc = None
    if user.avatar_character_id:
        uc = db.scalar(query.where(m.UserCharacter.character_id == user.avatar_character_id))
    if uc is None:
        uc = db.scalar(query.order_by(m.UserCharacter.power.desc(), m.UserCharacter.id).limit(1))
    return uc


def avatar_view(db: Session, user: m.User) -> dict | None:
    uc = resolve_avatar(db, user)
    if uc is None:
        return None
    return {
        "user_character_id": uc.id,
        "character": char_public(uc.character_id),
        "level": uc.level,
        "speed": compute_stats(uc)["speed"]["total"],
    }


def user_summary(db: Session, user: m.User) -> dict:
    return {
        "id": user.id,
        "nickname": user.nickname,
        "level": user.level,
        "xp": user.xp,
        "xp_to_next": account_xp_to_next(user.level),
        "max_level": user.level >= MAX_ACCOUNT_LEVEL,
        "rank": rank_for(user.level),
        "coins": user.coins,
        "carats": user.carats,
        "fragments": user.fragments,
        "tickets": get_qty(db, user.id, "ticket"),
        "title": item_public(user.title_item_id) if user.title_item_id else None,
        "frame": item_public(user.frame_item_id) if user.frame_item_id else None,
        "total_pulls": user.total_pulls,
        "five_star_count": user.five_star_count,
        "avatar": avatar_view(db, user),
        "created_at": iso(user.created_at),
    }


def public_user(user: m.User) -> dict:
    """O que outros jogadores podem ver."""
    return {
        "nickname": user.nickname,
        "level": user.level,
        "rank": rank_for(user.level),
        "title": item_public(user.title_item_id) if user.title_item_id else None,
        "frame": item_public(user.frame_item_id) if user.frame_item_id else None,
        "avatar_id": user.avatar_character_id,
    }


def uc_view(uc: m.UserCharacter, full: bool = False) -> dict:
    stats = compute_stats(uc)
    data = {
        "id": uc.id,
        "character": char_public(uc.character_id),
        "level": uc.level,
        "level_cap": level_cap(uc.ascension),
        "ascension": uc.ascension,
        "max_ascension": MAX_ASCENSION,
        "awakening": uc.awakening,
        "max_awakening": MAX_AWAKENING,
        "power": uc.power,
        "stats": {s: {**stats[s], "label": STAT_LABELS[s]} for s in STATS},
        "equipment": item_public(uc.equipment_item_id) if uc.equipment_item_id else None,
        "afk_slot": uc.afk_slot,
        "favorite_slot": uc.favorite_slot,
        "obtained_at": iso(uc.obtained_at),
    }
    if not full:
        return data

    at_cap = uc.level >= level_cap(uc.ascension)
    next_asc = uc.ascension + 1 if uc.ascension < MAX_ASCENSION else None
    data.update({
        "xp": uc.xp,
        "xp_to_next": xp_to_next(uc.level),
        "at_cap": at_cap,
        "attr_cap": attr_cap(uc.level),
        "skills": [
            {
                "id": s.skill_id,
                "slot": s.slot,
                "name": s.skill.name,
                "description": s.skill.description,
                "kind": s.skill.kind,
                "level": s.level,
                "max_level": MAX_SKILL_LEVEL,
                "power_bonus": s.skill.power_bonus,
                "upgrade_cost": describe(skill_upgrade_cost(s.level)) if s.level < MAX_SKILL_LEVEL else None,
            }
            for s in sorted(uc.skills, key=lambda s: s.slot)
        ],
        "next_ascension": {
            "stage": next_asc,
            "new_cap": level_cap(next_asc),
            "cost": describe(ASCENSION_COSTS[next_asc]),
            "ready": at_cap,
        } if next_asc else None,
    })
    return data
