"""Authentication is handled by Clerk; this service only mints one-time WebSocket tickets."""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.container import Container
from app.core.security import new_opaque_token
from app.models import User
from app.repositories.tokens import TokenRepository
from app.services.common import utcnow


class AuthService:
    def __init__(self, session: AsyncSession, container: Container) -> None:
        self.session = session
        self.s = container.settings
        self.tokens = TokenRepository(session)

    async def issue_ws_ticket(self, user: User) -> tuple[str, int]:
        """Browsers cannot set headers on a WebSocket handshake, so a Clerk-authenticated request
        trades its session token for a single-use, 30 s ticket (kept out of logs/URLs history)."""
        raw, digest = new_opaque_token(24)
        ttl = self.s.ws_ticket_ttl_seconds
        self.tokens.add_ticket(digest, user.id, utcnow() + timedelta(seconds=ttl))
        await self.session.commit()
        return raw, ttl
