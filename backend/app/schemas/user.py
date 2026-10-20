from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.base import CamelModel, b64_bytes

# ECDH P-256 SPKI is 91 bytes; allow raw uncompressed points (65) too.
PublicKeyBytes = b64_bytes(65, 120)


class RegisterKeyRequest(CamelModel):
    public_key: PublicKeyBytes


class DirectoryUser(CamelModel):
    id: uuid.UUID
    username: str
    display_name: str
    public_key: PublicKeyBytes | None = None
    key_fingerprint: str | None = None


class DirectoryPage(CamelModel):
    items: list[DirectoryUser]
    next_cursor: str | None = None


class MeResponse(CamelModel):
    id: uuid.UUID
    username: str
    display_name: str
    role: str
    email: str | None = None
    key_fingerprint: str | None = None
    has_public_key: bool
    created_at: datetime


EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class InviteRequest(CamelModel):
    email_address: str = Field(pattern=EMAIL_PATTERN, max_length=254)


class InvitationOut(CamelModel):
    id: str
    email_address: str
    status: str
    created_at: datetime


class AdminUpdateUserRequest(CamelModel):
    status: Literal["active", "disabled"]


class AdminUserOut(CamelModel):
    id: uuid.UUID
    username: str
    display_name: str
    email: str | None = None
    role: str
    status: str
    key_fingerprint: str | None = None
    created_at: datetime
    last_login_at: datetime | None = None


class AdminUserPage(CamelModel):
    items: list[AdminUserOut]
    next_cursor: str | None = None


class AuditOut(CamelModel):
    id: int
    actor_id: uuid.UUID | None = None
    action: str
    target_id: uuid.UUID | None = None
    ip: str | None = None
    meta: dict[str, object] | None = None
    created_at: datetime


class AuditPage(CamelModel):
    items: list[AuditOut]
    next_cursor: str | None = None


class AdminStats(CamelModel):
    users_total: int
    users_active: int
    users_disabled: int
    live_messages: int
    ws_connections: int
    conversations_total: int
    last_purge_at: datetime | None = None
    last_purge_deleted: int | None = None
