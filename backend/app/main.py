"""Application factory + lifespan."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app import __version__
from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.container import Container
from app.core.errors import install_exception_handlers
from app.core.logging import configure_logging
from app.core.middleware import BodySizeLimitMiddleware, RequestContextMiddleware, SecurityHeadersMiddleware
from app.core.rate_limit import build_rate_limiter
from app.db.session import create_engine, create_session_factory
from app.integrations.clerk import ClerkApi, ClerkClient, ClerkTokenVerifier
from app.services.purge_service import PurgeService

log = logging.getLogger("app")


def _init_sentry(settings: Settings) -> None:
    if not settings.sentry_dsn:
        return
    try:
        import sentry_sdk
    except ImportError:  # optional dependency
        log.warning("SENTRY_DSN set but sentry-sdk is not installed")
        return

    def scrub(event, _hint):  # type: ignore[no-untyped-def]
        event.pop("request", None)  # never ship bodies, headers, cookies or query strings
        event.pop("user", None)
        return event

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.env,
        send_default_pii=False,
        max_request_body_size="never",
        before_send=scrub,
        traces_sample_rate=0.0,
    )


def create_app(
    settings: Settings | None = None, *, clerk: ClerkApi | None = None, verifier: ClerkTokenVerifier | None = None
) -> FastAPI:
    """``clerk`` / ``verifier`` can be injected (tests); production builds them from settings."""
    settings = settings or get_settings()
    configure_logging(settings.log_level, json_logs=settings.log_json)
    _init_sentry(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = create_engine(settings)
        container = Container(
            settings=settings,
            engine=engine,
            session_factory=create_session_factory(engine),
            clerk=clerk or ClerkClient(settings.clerk_secret_key.get_secret_value(), settings.clerk_api_url),
            verifier=verifier
            or ClerkTokenVerifier(
                settings.clerk_issuer, jwks_url=settings.clerk_jwks_url, authorized_parties=settings.authorized_parties
            ),
            limiter=build_rate_limiter(settings.redis_url),
        )
        app.state.container = container

        purge = PurgeService(container)
        stop = asyncio.Event()
        with contextlib.suppress(Exception):  # startup catch-up; reads filter expires_at anyway
            await purge.run_once()
        task = asyncio.create_task(purge.run_forever(stop), name="purge-scheduler")
        log.info("startup complete", extra={"ctx": {"env": settings.env, "version": __version__}})
        try:
            yield
        finally:
            stop.set()
            await asyncio.wait_for(task, timeout=10)
            await container.limiter.close()
            await container.clerk.aclose()
            await engine.dispose()

    docs = settings.enable_docs
    app = FastAPI(
        title="VaultChat API",
        version=__version__,
        lifespan=lifespan,
        docs_url="/docs" if docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if docs else None,
    )
    install_exception_handlers(app)

    # Last added = outermost.
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.max_request_body_bytes)
    app.add_middleware(
        SecurityHeadersMiddleware, hsts=settings.is_production, doc_paths=("/docs", "/openapi.json") if docs else ()
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,   # list of origins, never "*"
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.add_middleware(RequestContextMiddleware)

    app.include_router(api_router, prefix="/api/v1")

    @app.get("/livez", include_in_schema=False)
    async def livez() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/healthz", include_in_schema=False)
    async def healthz() -> JSONResponse:
        container: Container = app.state.container
        try:
            async with container.session_factory() as session:
                await asyncio.wait_for(session.execute(text("SELECT 1")), timeout=3)
        except Exception:
            log.exception("health check failed")
            return JSONResponse({"status": "degraded", "db": "down"}, status_code=503)
        return JSONResponse({"status": "ok", "db": "ok"})

    return app
