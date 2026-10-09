"""Progresso das missões. As ações do jogo chamam `track(evento, valor)`.

Modo "count": soma o valor ao progresso (ex.: fazer 10 pulls).
Modo "max": guarda o maior valor visto (ex.: possuir 25 personagens, nível de conta 20).
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m
from ..database import session_cache
from .clock import period_key
from .registry import MISSIONS, MissionInfo

PERIOD_OF_CATEGORY = {"daily": "daily", "weekly": "weekly", "achievement": None}


def mission_period_key(mission: MissionInfo) -> str:
    return period_key(PERIOD_OF_CATEGORY[mission.category])


def _progress(db: Session, user_id: int) -> dict[tuple[str, str], m.UserMission]:
    """Todo o progresso do jogador nos períodos atuais (hoje, esta semana e conquistas),
    numa consulta só por requisição."""
    def load():
        periods = {period_key(p) for p in PERIOD_OF_CATEGORY.values()}
        rows = db.scalars(select(m.UserMission).where(
            m.UserMission.user_id == user_id, m.UserMission.period_key.in_(periods)))
        return {(r.mission_id, r.period_key): r for r in rows}
    return session_cache(db, ("missions", user_id), load)


def progress_row(db: Session, user_id: int, mission: MissionInfo, create: bool = True) -> m.UserMission | None:
    rows = _progress(db, user_id)
    key = (mission.id, mission_period_key(mission))
    row = rows.get(key)
    if row is None and create:
        row = m.UserMission(user_id=user_id, mission_id=key[0], period_key=key[1], progress=0)
        db.add(row)
        rows[key] = row  # um 2º track na mesma requisição acha a linha
    return row


def track(db: Session, user: m.User, event: str, value: int = 1) -> None:
    if value <= 0:
        return
    for mission in MISSIONS:
        if mission.event != event:
            continue
        row = progress_row(db, user.id, mission)
        if row.claimed_at is not None:
            continue
        if mission.mode == "count":
            row.progress = min(mission.target, row.progress + value)
        else:
            row.progress = min(mission.target, max(row.progress, value))
