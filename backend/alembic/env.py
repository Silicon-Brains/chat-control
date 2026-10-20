"""Alembic environment (async). Uses the DIRECT (non-pooled) Neon endpoint."""

from __future__ import annotations

import asyncio
import os

from sqlalchemy.ext.asyncio import create_async_engine

import app.models  # noqa: F401  (register tables on metadata)
from alembic import context
from app.core.config import build_async_database_url
from app.db.base import Base

config = context.config
target_metadata = Base.metadata


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL_DIRECT") or os.environ.get("DATABASE_URL")
    if not url:
        # Fall back to .env via Settings
        from app.core.config import get_settings

        s = get_settings()
        url = s.database_url_direct or s.database_url
    return url


def _ssl_enabled() -> bool:
    return os.environ.get("DB_SSL", "true").lower() not in {"0", "false", "no"}


def run_migrations_offline() -> None:
    url, _ = build_async_database_url(_database_url(), force_ssl=False)
    context.configure(
        url=url.render_as_string(hide_password=False),
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _do_run(connection) -> None:  # type: ignore[no-untyped-def]
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    url, connect_args = build_async_database_url(_database_url(), force_ssl=_ssl_enabled())
    engine = create_async_engine(url, connect_args=connect_args)
    async with engine.connect() as connection:
        await connection.run_sync(_do_run)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
