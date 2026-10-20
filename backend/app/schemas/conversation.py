from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field, model_validator

from app.schemas.base import CamelModel, b64_bytes

WrappedKey = b64_bytes(32, 512)
WrapperPub = b64_bytes(65, 120)


class KeyGrant(CamelModel):
    """A conversation key wrapped (ECDH+HKDF+AES-GCM, client side) for one member."""

    user_id: uuid.UUID
    wrapped_key: WrappedKey
    wrapper_pub: WrapperPub


class MemberKey(KeyGrant):
    role: Literal["member", "sender"] = "member"


class CreateConversationRequest(CamelModel):
    type: Literal["direct", "group", "broadcast"]
    name: str | None = Field(default=None, min_length=1, max_length=100)
    members: list[MemberKey] = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def _shape(self) -> CreateConversationRequest:
        if self.type == "direct" and self.name is not None:
            raise ValueError("direct conversations have no name")
        if self.type != "direct" and not self.name:
            raise ValueError("name is required for group and broadcast conversations")
        return self


class AddMembersRequest(CamelModel):
    key_version: int = Field(ge=1, description="Key version the client wrapped for (must equal current)")
    members: list[MemberKey] = Field(min_length=1, max_length=200)


class RemoveMemberRequest(CamelModel):
    """Removing a member rotates the key: supply new wrapped keys for everyone who stays."""

    key_version: int = Field(ge=1, description="Current key version before rotation")
    new_keys: list[KeyGrant] = Field(default_factory=list, max_length=500)


class RotateKeyRequest(CamelModel):
    key_version: int = Field(ge=1, description="Current key version before rotation")
    keys: list[KeyGrant] = Field(min_length=1, max_length=500)


class GrantKeysRequest(CamelModel):
    key_version: int = Field(ge=1, description="Current key version being granted")
    keys: list[KeyGrant] = Field(min_length=1, max_length=500)


class MemberOut(CamelModel):
    user_id: uuid.UUID
    role: str
    display_name: str
    management_verified: bool = False
    has_current_key: bool | None = None


class ConversationOut(CamelModel):
    id: uuid.UUID
    type: str
    name: str | None = None
    current_key_version: int
    rotation_required: bool
    created_at: datetime
    members: list[MemberOut]
    my_role: str | None = None
    has_current_key: bool | None = None
    unread_count: int = 0
    last_message_at: datetime | None = None


class ConversationKeyOut(CamelModel):
    key_version: int
    wrapped_key: WrappedKey
    wrapper_pub: WrapperPub


class ConversationCreated(CamelModel):
    id: uuid.UUID
    current_key_version: int
    created: bool = True
