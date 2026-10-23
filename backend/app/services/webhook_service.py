"""Clerk webhook events -> immediate local sync (bans, role changes and deletions take effect at once)."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.container import Container
from app.core.errors import Forbidden
from app.integrations.clerk import ClerkUser
from app.repositories.users import UserRepository
from app.services.admin_service import AdminService
from app.services.identity_service import IdentityService

log = logging.getLogger("app.webhooks")


class WebhookService:
    def __init__(self, session: AsyncSession, container: Container) -> None:
        self.session, self.c = session, container

    async def handle(self, event_type: str, data: dict[str, Any]) -> None:
        if event_type in ("user.created", "user.updated"):
            cu = ClerkUser.from_api(data)
            existing = await UserRepository(self.session).get_by_clerk_id(cu.id)
            try:
                user = await IdentityService(self.session, self.c).apply(cu, existing)
            except Forbidden:  # not invited: never provisioned, nothing to sync
                log.info("ignored webhook for un-invited user")
                return
        elif event_type == "user.deleted" and data.get("id"):
            await AdminService(self.session, self.c).delete_local_by_clerk_id(str(data["id"]))
        else:
            log.debug("unhandled webhook event %s", event_type)
