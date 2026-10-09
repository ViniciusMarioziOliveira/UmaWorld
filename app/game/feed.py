"""Eventos do Chat Global.

`emit()` grava o evento na mesma transação da ação que o gerou. O broadcast via
WebSocket só acontece depois do COMMIT (hook `after_commit`): se a ação falhar e
sofrer rollback, ninguém vê um anúncio de algo que não aconteceu.
"""
from sqlalchemy import event, select
from sqlalchemy.orm import Session

from .. import models as m
from ..realtime import hub
from .clock import iso, utcnow

_PENDING = "feed_pending"


def fmt(n: int) -> str:
    """10000 -> '10.000'"""
    return f"{n:,}".replace(",", ".")


def char_tag(name: str, rarity: int) -> str:
    """Marcação que o frontend destaca com a cor da raridade: [5★ Nome]"""
    return f"[{rarity}★ {name}]"


def serialize(ev: m.FeedEvent) -> dict:
    return {
        "id": ev.id,
        "kind": ev.kind,
        "icon": ev.icon,
        "nickname": ev.nickname,
        "message": ev.message,
        "data": ev.data or {},
        "created_at": iso(ev.created_at),
    }


def emit(db: Session, kind: str, icon: str, message: str,
         user: m.User | None = None, data: dict | None = None) -> None:
    ev = m.FeedEvent(
        kind=kind,
        icon=icon,
        user_id=user.id if user else None,
        nickname=user.nickname if user else None,
        message=message,
        data=data or {},
        created_at=utcnow(),
    )
    db.add(ev)
    # O id só existe depois de gravar: a mensagem é montada no after_commit.
    db.info.setdefault(_PENDING, []).append(ev)


def recent(db: Session, limit: int = 50) -> list[dict]:
    rows = db.scalars(select(m.FeedEvent).order_by(m.FeedEvent.id.desc()).limit(limit)).all()
    return [serialize(ev) for ev in reversed(rows)]


@event.listens_for(Session, "after_commit")
def _publish_after_commit(session: Session) -> None:
    for ev in session.info.pop(_PENDING, None) or ():
        hub.publish({"type": "feed", "event": serialize(ev)})


@event.listens_for(Session, "after_rollback")
def _discard_after_rollback(session: Session) -> None:
    session.info.pop(_PENDING, None)
