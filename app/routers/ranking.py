"""Ranking: leaderboards por categoria + a posição do próprio jogador."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..game.progression import rank_for
from ..game.registry import char_public
from ..security import current_user

router = APIRouter(prefix="/api/ranking", tags=["ranking"])

LIMIT = 50

CATEGORIES = {
    "level": {"label": "Nível de conta", "icon": "level", "unit": "Nv."},
    "power": {"label": "Personagens mais fortes", "icon": "bolt", "unit": "Poder"},
    "pulls": {"label": "Mais pulls", "icon": "dice", "unit": "pulls"},
    "collection": {"label": "Coleção", "icon": "collection", "unit": "personagens"},
    "five_stars": {"label": "Mais 5★", "icon": "star-burst", "unit": "5★"},
}


def _user_row(user: m.User, value: int) -> dict:
    return {"nickname": user.nickname, "level": user.level, "rank": rank_for(user.level), "value": value,
            "avatar_id": user.avatar_character_id}


def _simple(db: Session, me: m.User, column) -> tuple[list[dict], dict]:
    users = db.scalars(select(m.User).where(column > 0).order_by(column.desc(), m.User.id).limit(LIMIT)).all()
    rows = [_user_row(u, getattr(u, column.key)) for u in users]
    mine = getattr(me, column.key)
    position = db.scalar(select(func.count()).select_from(m.User).where(column > mine)) + 1
    return rows, {"position": position if mine > 0 else None, "value": mine}


@router.get("/{category}")
def ranking(category: str, me: m.User = Depends(current_user), db: Session = Depends(get_db)):
    if category not in CATEGORIES:
        raise HTTPException(404, "Categoria de ranking inválida.")

    if category == "level":
        users = db.scalars(select(m.User).order_by(m.User.level.desc(), m.User.xp.desc(), m.User.id)
                           .limit(LIMIT)).all()
        rows = [_user_row(u, u.level) for u in users]
        ahead = db.scalar(select(func.count()).select_from(m.User).where(or_(
            m.User.level > me.level,
            and_(m.User.level == me.level, m.User.xp > me.xp),
            and_(m.User.level == me.level, m.User.xp == me.xp, m.User.id < me.id),
        )))
        my = {"position": ahead + 1, "value": me.level}

    elif category == "power":
        result = db.execute(
            select(m.UserCharacter, m.User)
            .join(m.User, m.User.id == m.UserCharacter.user_id)
            .order_by(m.UserCharacter.power.desc(), m.UserCharacter.id)
            .limit(LIMIT)
        ).all()
        rows = [{**_user_row(u, uc.power), "character": char_public(uc.character_id),
                 "character_level": uc.level, "ascension": uc.ascension} for uc, u in result]
        best = db.scalar(select(func.max(m.UserCharacter.power)).where(m.UserCharacter.user_id == me.id)) or 0
        ahead = db.scalar(select(func.count()).select_from(m.UserCharacter).where(m.UserCharacter.power > best))
        my = {"position": ahead + 1 if best else None, "value": best}

    elif category == "collection":
        counts = (select(m.UserCharacter.user_id, func.count().label("n"))
                  .group_by(m.UserCharacter.user_id).subquery())
        result = db.execute(
            select(m.User, counts.c.n).join(counts, counts.c.user_id == m.User.id)
            .order_by(counts.c.n.desc(), m.User.id).limit(LIMIT)
        ).all()
        rows = [_user_row(u, n) for u, n in result]
        mine = db.scalar(select(counts.c.n).where(counts.c.user_id == me.id)) or 0
        ahead = db.scalar(select(func.count()).select_from(counts).where(counts.c.n > mine))
        my = {"position": ahead + 1 if mine else None, "value": mine}

    elif category == "pulls":
        rows, my = _simple(db, me, m.User.total_pulls)
    else:
        rows, my = _simple(db, me, m.User.five_star_count)

    for i, row in enumerate(rows, start=1):
        row["position"] = i
        row["is_me"] = row["nickname"] == me.nickname
    return {"category": category, "categories": CATEGORIES, "rows": rows, "mine": my}
