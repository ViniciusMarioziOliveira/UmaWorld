"""Hub de WebSocket: conexões abertas, presença (jogadores online) e broadcast.

Os endpoints HTTP são síncronos e rodam em threads. Tudo que mexe no estado do hub
a partir delas passa por `_in_loop()`, que agenda a função dentro do event loop:
assim a lista de conexões só é lida/alterada por uma thread, e uma única tarefa
(`_pump`) envia as mensagens na ordem em que foram publicadas.
"""
import asyncio
import logging
from dataclasses import dataclass

from fastapi import WebSocket

log = logging.getLogger("umaworld.realtime")

SEND_TIMEOUT = 5


@dataclass
class Viewer:
    user_id: int | None
    nickname: str | None
    level: int = 0
    avatar: str | None = None  # id da personagem que anda pelo mundo


class Hub:
    def __init__(self) -> None:
        self.loop: asyncio.AbstractEventLoop | None = None
        self.queue: asyncio.Queue | None = None
        self.clients: dict[WebSocket, Viewer] = {}
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        self.loop = asyncio.get_running_loop()
        self.queue = asyncio.Queue()
        self._task = asyncio.create_task(self._pump())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
        self.loop = None

    def _in_loop(self, fn, *args) -> None:
        """Executa `fn` no event loop, seja qual for a thread que chamou."""
        loop = self.loop
        if loop is None or loop.is_closed():
            return
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is loop:
            fn(*args)
        else:
            loop.call_soon_threadsafe(fn, *args)

    # ------------------------------------------------------------ publicação

    def publish(self, message: dict) -> None:
        """Agenda um broadcast. Pode ser chamado de qualquer thread."""
        self._in_loop(lambda: self.queue.put_nowait(message))

    def _queue_presence(self) -> None:
        self.queue.put_nowait(self.presence_message())

    async def _pump(self) -> None:
        while True:
            message = await self.queue.get()
            try:
                await self._broadcast(message)
            except Exception:  # um cliente com problema não pode derrubar o hub
                log.exception("Falha no broadcast")

    async def _send(self, ws: WebSocket, message: dict) -> bool:
        try:
            await asyncio.wait_for(ws.send_json(message), timeout=SEND_TIMEOUT)
            return True
        except Exception:
            return False

    async def _broadcast(self, message: dict) -> None:
        targets = list(self.clients)
        results = await asyncio.gather(*(self._send(ws, message) for ws in targets))
        dead = [ws for ws, ok in zip(targets, results) if not ok]
        if dead:
            for ws in dead:
                self.clients.pop(ws, None)
            self._queue_presence()

    # ------------------------------------------------------------ presença

    def online_players(self) -> list[dict]:
        seen: dict[int, dict] = {}
        for viewer in list(self.clients.values()):
            if viewer.user_id is not None:
                seen[viewer.user_id] = {"nickname": viewer.nickname, "level": viewer.level,
                                        "avatar": viewer.avatar}
        return sorted(seen.values(), key=lambda p: p["nickname"].lower())

    def presence_message(self) -> dict:
        return {"type": "presence", "online": self.online_players(), "viewers": len(self.clients)}

    def register(self, ws: WebSocket, viewer: Viewer) -> None:
        self.clients[ws] = viewer
        self._queue_presence()

    def unregister(self, ws: WebSocket) -> None:
        if self.clients.pop(ws, None) is not None:
            self._queue_presence()

    def update_viewer(self, user_id: int, **fields) -> None:
        """Atualiza nível/avatar de um jogador conectado e avisa todo mundo."""
        def apply() -> None:
            changed = False
            for viewer in self.clients.values():
                if viewer.user_id == user_id:
                    for key, value in fields.items():
                        setattr(viewer, key, value)
                    changed = True
            if changed:
                self._queue_presence()
        self._in_loop(apply)


hub = Hub()
