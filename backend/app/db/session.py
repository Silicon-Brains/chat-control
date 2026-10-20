from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import Settings, build_async_database_url


def create_engine(settings: Settings) -> AsyncEngine:
    url, connect_args = build_async_database_url(settings.database_url, force_ssl=settings.db_ssl)
    # PgBouncer (transaction mode) safe: unique prepared-statement names + no caches.
    connect_args["prepared_statement_name_func"] = lambda: f"__asyncpg_{uuid.uuid4().hex}__"
    return create_async_engine(
        url,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_timeout=settings.db_pool_timeout,
        pool_recycle=settings.db_pool_recycle,
        pool_pre_ping=True,  # survives Neon scale-to-zero / idle disconnects
        connect_args=connect_args,
    )


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
