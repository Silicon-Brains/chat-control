"""Application-scoped singletons, created in the lifespan and stored on ``app.state``."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.core.rate_limit import RateLimiter
from app.integrations.clerk import ClerkApi, ClerkTokenVerifier


@dataclass
class PurgeState:
    last_run_at: datetime | None = None
    last_deleted: int | None = None


@dataclass
class Container:
    settings: Settings
    engine: AsyncEngine
    session_factory: async_sessionmaker[AsyncSession]
    clerk: ClerkApi
    verifier: ClerkTokenVerifier
    limiter: RateLimiter
    purge_state: PurgeState = field(default_factory=PurgeState)
