"""Guaranteed ephemerality: batched hard-delete of expired rows (reads also filter ``expires_at``)."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from datetime import timedelta

from app.core.container import Container
from app.repositories.audit import AuditRepository
from app.repositories.conversations import ConversationRepository
from app.repositories.messages import MessageRepository
from app.services.common import utcnow

log = logging.getLogger("app.purge")


class PurgeService:
    def __init__(self, container: Container) -> None:
        self.c = container
        self.s = container.settings

    async def purge_messages(self) -> int:
        total = 0
        for _ in range(self.s.purge_max_batches_per_tick):
            async with self.c.session_factory() as session:
                rows = await MessageRepository(session).delete_expired_batch(self.s.purge_batch_size)
                await session.commit()
                if not rows:
                    break
                total += len(rows)
            if len(rows) < self.s.purge_batch_size:
                break
        return total

    async def housekeeping(self) -> dict[str, int]:
        async with self.c.session_factory() as session:
            out = {
                "old_keys": await ConversationRepository(session).delete_superseded_keys(),
                "audit_logs": await AuditRepository(session).delete_older_than(
                    utcnow() - timedelta(days=self.s.audit_retention_days)
                ),
            }
            await session.commit()
            return out

    async def run_once(self, *, with_housekeeping: bool = True) -> int:
        deleted = await self.purge_messages()
        if with_housekeeping:
            await self.housekeeping()
        self.c.purge_state.last_run_at = utcnow()
        self.c.purge_state.last_deleted = deleted
        return deleted

    async def run_forever(self, stop: asyncio.Event) -> None:
        tick = 0
        while not stop.is_set():
            tick += 1
            try:  # messages every tick, housekeeping every 10th
                await self.run_once(with_housekeeping=tick % 10 == 1)
            except Exception:
                log.exception("purge tick failed")
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(stop.wait(), timeout=self.s.purge_interval_seconds)
