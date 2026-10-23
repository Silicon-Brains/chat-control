"""Pure-ASGI middleware: request id + access log, security headers, body-size cap."""

from __future__ import annotations

import logging
import re
import time
import uuid

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import PayloadTooLarge, error_body
from app.core.logging import request_id_ctx

access_log = logging.getLogger("app.access")
_RID_RE = re.compile(r"^[A-Za-z0-9\-_.]{8,64}$")


class RequestContextMiddleware:
    """Assigns a request id and writes ONE access-log line (path only: never the query string,
    which can carry credentials)."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = dict(scope.get("headers") or [])
        incoming = headers.get(b"x-request-id", b"").decode("latin-1")
        rid = incoming if _RID_RE.match(incoming) else uuid.uuid4().hex
        token = request_id_ctx.set(rid)
        started = time.perf_counter()
        status = 500

        async def send_wrapper(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                message.setdefault("headers", []).append((b"x-request-id", rid.encode()))
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            access_log.info(
                "request",
                extra={
                    "ctx": {
                        "method": scope.get("method", "HTTP"),
                        "path": scope.get("path"),
                        "status": status,
                        "ms": round((time.perf_counter() - started) * 1000, 1),
                    }
                },
            )
            request_id_ctx.reset(token)


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp, *, hsts: bool, doc_paths: tuple[str, ...] = ()) -> None:
        self.app = app
        self.doc_paths = doc_paths
        base: list[tuple[bytes, bytes]] = [
            (b"x-content-type-options", b"nosniff"),
            (b"referrer-policy", b"no-referrer"),
            (b"cache-control", b"no-store"),
            (b"cross-origin-resource-policy", b"same-site"),
            (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
        ]
        if hsts:
            base.append((b"strict-transport-security", b"max-age=63072000; includeSubDomains"))
        self.base = base
        self.csp = (b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        skip_csp = scope.get("path", "") in self.doc_paths

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                present = {k.lower() for k, _ in message.get("headers", [])}
                extra = [h for h in self.base if h[0] not in present]
                if not skip_csp and self.csp[0] not in present:
                    extra.append(self.csp)
                message.setdefault("headers", []).extend(extra)
            await send(message)

        await self.app(scope, receive, send_wrapper)


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp, *, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        declared = dict(scope.get("headers") or []).get(b"content-length")
        if declared and declared.isdigit() and int(declared) > self.max_bytes:
            await _reject(send)
            return
        seen = 0

        async def limited_receive() -> Message:
            nonlocal seen
            message = await receive()
            if message["type"] == "http.request":
                seen += len(message.get("body", b""))
                if seen > self.max_bytes:
                    raise PayloadTooLarge()
            return message

        await self.app(scope, limited_receive, send)


async def _reject(send: Send) -> None:
    import json

    body = json.dumps(error_body("PAYLOAD_TOO_LARGE", "Payload too large")).encode()
    await send(
        {
            "type": "http.response.start",
            "status": 413,
            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())],
        }
    )
    await send({"type": "http.response.body", "body": body})
