"""WebSocket connection hub with optional Redis pub/sub for multi-instance fan-out."""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import time
import uuid
from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any, Protocol

from starlette.websockets import WebSocket, WebSocketState

from app.core.config import Settings

log = logging.getLogger(__name__)

CLOSE_UNAUTHORIZED = 4401
CLOSE_FORBIDDEN = 4403
CLOSE_TOO_MANY = 4429
CLOSE_RECONNECT = 4000


class TooManyConnections(Exception):
    pass


class EventBus(Protocol):
    async def start(self) -> None: ...
    async def stop(self) -> None: ...
    async def publish(self, envelope: dict[str, Any]) -> None: ...


@dataclass(eq=False)
class Connection:
    user_id: uuid.UUID
    websocket: WebSocket
    queue: asyncio.Queue[str | None]
    id: str = field(default_factory=lambda: uuid.uuid4().hex)
    connected_at: float = field(default_factory=time.monotonic)
    writer: asyncio.Task[None] | None = None
    closing: bool = False


class Hub:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._by_user: dict[uuid.UUID, set[Connection]] = {}
        self._total = 0
        self._bus: EventBus | None = None
        self._bg: set[asyncio.Task[None]] = set()  # strong refs so fire-and-forget closes aren't GC'd

    def attach_bus(self, bus: EventBus) -> None:
        self._bus = bus

    @property
    def connection_count(self) -> int:
        return self._total

    # --- lifecycle -----------------------------------------------------------
    async def register(self, user_id: uuid.UUID, websocket: WebSocket) -> Connection:
        existing = self._by_user.get(user_id, set())
        if self._total >= self._settings.ws_max_connections_total:
            raise TooManyConnections("server at capacity")
        if len(existing) >= self._settings.ws_max_connections_per_user:
            raise TooManyConnections("too many connections for user")
        await websocket.accept()
        conn = Connection(user_id, websocket, asyncio.Queue(maxsize=self._settings.ws_send_queue_size))
        self._by_user.setdefault(user_id, set()).add(conn)
        self._total += 1
        conn.writer = asyncio.create_task(self._writer(conn), name=f"ws-writer-{conn.id}")
        return conn

    async def unregister(self, conn: Connection) -> None:
        conns = self._by_user.get(conn.user_id)
        if conns and conn in conns:
            conns.discard(conn)
            self._total -= 1
            if not conns:
                self._by_user.pop(conn.user_id, None)
        conn.closing = True
        if conn.writer:
            conn.writer.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await conn.writer
        await self._safe_close(conn.websocket, 1000)

    async def shutdown(self) -> None:
        for conns in list(self._by_user.values()):
            for conn in list(conns):
                await self.unregister(conn)

    # --- sending ---------------------------------------------------------------
    async def _writer(self, conn: Connection) -> None:
        try:
            while True:
                item = await conn.queue.get()
                if item is None:
                    return
                await asyncio.wait_for(conn.websocket.send_text(item), timeout=10)
        except asyncio.CancelledError:
            raise
        except Exception:  # broken socket / slow consumer
            log.debug("ws writer stopped", extra={"conn": conn.id})
            self._spawn_close(conn, 1011)

    def _spawn_close(self, conn: Connection, code: int) -> None:
        task = asyncio.create_task(self._close_later(conn, code))
        self._bg.add(task)
        task.add_done_callback(self._bg.discard)

    async def _close_later(self, conn: Connection, code: int) -> None:
        await self._safe_close(conn.websocket, code)

    @staticmethod
    async def _safe_close(ws: WebSocket, code: int) -> None:
        with contextlib.suppress(Exception):
            if ws.application_state != WebSocketState.DISCONNECTED:
                await ws.close(code=code)

    def send(self, conn: Connection, payload: dict[str, Any] | str) -> None:
        """Non-blocking enqueue; a consumer that can't keep up is disconnected (1013)."""
        text = payload if isinstance(payload, str) else json.dumps(payload, separators=(",", ":"))
        try:
            conn.queue.put_nowait(text)
        except asyncio.QueueFull:
            log.warning("ws slow consumer dropped", extra={"conn": conn.id})
            self._spawn_close(conn, 1013)

    def deliver_local(self, user_ids: Iterable[uuid.UUID], text: str) -> None:
        for uid in user_ids:
            for conn in list(self._by_user.get(uid, ())):
                self.send(conn, text)

    async def close_user_local(self, user_id: uuid.UUID, code: int = CLOSE_FORBIDDEN) -> None:
        for conn in list(self._by_user.get(user_id, ())):
            await self._safe_close(conn.websocket, code)

    # --- cross-instance publish API ----------------------------------------------
    async def publish(self, user_ids: Iterable[uuid.UUID], payload: dict[str, Any]) -> None:
        ids = list(dict.fromkeys(user_ids))
        if not ids:
            return
        text = json.dumps(payload, separators=(",", ":"))
        if self._bus is None:
            self.deliver_local(ids, text)
            return
        try:
            await self._bus.publish({"k": "deliver", "u": [str(i) for i in ids], "d": text})
        except Exception:
            log.exception("event bus publish failed; delivering locally")
            self.deliver_local(ids, text)

    async def disconnect_user(self, user_id: uuid.UUID, code: int = CLOSE_FORBIDDEN) -> None:
        if self._bus is None:
            await self.close_user_local(user_id, code)
            return
        try:
            await self._bus.publish({"k": "disconnect", "u": str(user_id), "c": code})
        except Exception:
            log.exception("event bus publish failed; disconnecting locally")
            await self.close_user_local(user_id, code)

    async def handle_envelope(self, env: dict[str, Any]) -> None:
        kind = env.get("k")
        if kind == "deliver":
            self.deliver_local((uuid.UUID(u) for u in env["u"]), env["d"])
        elif kind == "disconnect":
            await self.close_user_local(uuid.UUID(env["u"]), int(env.get("c", CLOSE_FORBIDDEN)))


class RedisEventBus:
    """Pub/sub fan-out so any instance can deliver to sockets held by another."""

    CHANNEL = "vaultchat:events"

    def __init__(self, url: str, hub: Hub) -> None:
        import redis.asyncio as aioredis

        self._redis = aioredis.from_url(url, decode_responses=True, health_check_interval=30)
        self._hub = hub
        self._task: asyncio.Task[None] | None = None
        self._stopping = False

    async def start(self) -> None:
        self._task = asyncio.create_task(self._listen(), name="redis-bus")

    async def stop(self) -> None:
        self._stopping = True
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await self._task
        await self._redis.aclose()

    async def publish(self, envelope: dict[str, Any]) -> None:
        await self._redis.publish(self.CHANNEL, json.dumps(envelope, separators=(",", ":")))

    async def _listen(self) -> None:
        backoff = 1.0
        while not self._stopping:
            try:
                pubsub = self._redis.pubsub()
                await pubsub.subscribe(self.CHANNEL)
                backoff = 1.0
                async for message in pubsub.listen():
                    if message.get("type") != "message":
                        continue
                    try:
                        await self._hub.handle_envelope(json.loads(message["data"]))
                    except Exception:
                        log.exception("bad bus envelope")
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("redis bus disconnected; retrying", extra={"backoff": backoff})
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30.0)
