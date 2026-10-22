"""WebSocket endpoint: one-time-ticket auth, per-event authorization, rate limiting."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, WebSocket
from pydantic import ValidationError

from app.core.container import Container
from app.core.errors import AppError, RateLimited
from app.core.rate_limit import enforce
from app.core.security import hash_token
from app.repositories.tokens import TokenRepository
from app.schemas.message import (
    WsConversationRead,
    WsMessageSend,
    WsPing,
    message_new_event,
    ws_inbound_adapter,
)
from app.services.chat_service import ChatService
from app.ws.hub import CLOSE_TOO_MANY, CLOSE_UNAUTHORIZED, Connection, TooManyConnections

log = logging.getLogger("app.ws")
router = APIRouter()
MAX_BAD_FRAMES = 5


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    container: Container = ws.app.state.container
    origin = ws.headers.get("origin")
    if origin is not None and origin.rstrip("/") not in container.settings.origins:
        await ws.close(code=1008)  # CSWSH defence: handshake refused (HTTP 403)
        return

    user_id = None
    ticket = ws.query_params.get("ticket")
    if ticket and len(ticket) < 128:
        async with container.session_factory() as session:
            user_id = await TokenRepository(session).consume_ticket(hash_token(ticket))
            await session.commit()
    if user_id is None:
        await ws.accept()
        await ws.close(code=CLOSE_UNAUTHORIZED)
        return

    try:
        conn = await container.hub.register(user_id, ws)
    except TooManyConnections:
        await ws.accept()
        await ws.close(code=CLOSE_TOO_MANY)
        return

    container.hub.send(conn, {"t": "ready", "userId": str(user_id)})
    try:
        await _serve(container, conn)
    finally:
        await container.hub.unregister(conn)


def _error(code: str, message: str, ref: str | None = None, details: Any = None) -> dict[str, Any]:
    err: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        err["details"] = details
    return {"t": "error", "ref": ref, "error": err}


async def _serve(container: Container, conn: Connection) -> None:
    s = container.settings
    ws, hub = conn.websocket, container.hub
    bad_frames = 0
    while True:
        try:
            frame = await asyncio.wait_for(ws.receive(), timeout=s.ws_idle_timeout_seconds)
        except TimeoutError:
            await ws.close(code=4408)
            return
        if frame["type"] == "websocket.disconnect":
            return
        raw = frame.get("text")
        if raw is None or len(raw.encode()) > s.ws_max_frame_bytes:
            await ws.close(code=1009)
            return
        try:
            event = ws_inbound_adapter.validate_json(raw)
        except ValidationError:
            bad_frames += 1
            hub.send(conn, _error("BAD_FRAME", "Malformed or unknown event"))
            if bad_frames >= MAX_BAD_FRAMES:
                await ws.close(code=1008)
                return
            continue

        ref = str(event.id) if isinstance(event, WsMessageSend) and event.id else None
        try:
            if isinstance(event, WsPing):
                hub.send(conn, {"t": "pong"})
            elif isinstance(event, WsConversationRead):
                async with container.session_factory() as session:
                    await ChatService(session, container).mark_read_for_user(conn.user_id, event.conversation_id)
            elif isinstance(event, WsMessageSend):
                await _handle_send(container, conn, event)
        except RateLimited as exc:
            hub.send(conn, _error(exc.code, exc.message, ref, {"retryAfter": exc.retry_after}))
        except AppError as exc:
            hub.send(conn, _error(exc.code, exc.message, ref, exc.details))
        except Exception:
            log.exception("ws handler failed")
            hub.send(conn, _error("INTERNAL_ERROR", "An unexpected error occurred", ref))


async def _handle_send(container: Container, conn: Connection, event: WsMessageSend) -> None:
    s = container.settings
    await enforce(container.limiter, f"ws:msg:{conn.user_id}", s.ws_rate_limit_messages, s.ws_rate_limit_window_seconds)
    async with container.session_factory() as session:
        chat = ChatService(session, container)
        result = await chat.send_message(
            conn.user_id,
            conversation_id=event.conversation_id,
            ciphertext=event.ciphertext,
            nonce=event.nonce,
            key_version=event.key_version,
            client_id=event.id,
        )
    msg = result.message
    container.hub.send(
        conn,
        {
            "t": "message.ack",
            "id": str(msg.id),
            "conversationId": str(msg.conversation_id),
            "createdAt": msg.created_at.isoformat(),
            "expiresAt": msg.expires_at.isoformat(),
            "duplicate": result.duplicate,
        },
    )
    if result.member_ids:
        await container.hub.publish(result.member_ids, message_new_event(msg))
