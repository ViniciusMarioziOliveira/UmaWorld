"""WebSocket do Chat Global.

Protocolo (servidor -> cliente):
    {"type": "hello", "feed": [...], "online": [...], "viewers": n}
    {"type": "feed", "event": {...}}
    {"type": "presence", "online": [...], "viewers": n}
Cliente -> servidor: só "ping" (mantém a conexão viva). Ainda não há mensagens de jogadores.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool

from .. import models as m
from ..database import SessionLocal
from ..game import feed
from ..game.serializers import resolve_avatar
from ..realtime import Viewer, hub
from ..security import decode_token

router = APIRouter()


def _load(token: str | None) -> tuple[Viewer, list[dict]]:
    with SessionLocal() as db:
        viewer = Viewer(user_id=None, nickname=None)
        uid = decode_token(token) if token else None
        user = db.get(m.User, uid) if uid else None
        if user:
            avatar = resolve_avatar(db, user)
            viewer = Viewer(user_id=user.id, nickname=user.nickname, level=user.level,
                            avatar=avatar.character_id if avatar else None)
        return viewer, feed.recent(db, 50)


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str | None = None):
    await ws.accept()
    viewer, events = await run_in_threadpool(_load, token)
    hub.register(ws, viewer)
    try:
        presence = hub.presence_message()
        await ws.send_json({"type": "hello", "feed": events, "online": presence["online"],
                            "viewers": presence["viewers"], "you": viewer.nickname})
        while True:
            message = await ws.receive_text()
            if message == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        hub.unregister(ws)
