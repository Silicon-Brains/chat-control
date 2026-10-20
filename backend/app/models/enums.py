from __future__ import annotations

import enum
from typing import Any

from sqlalchemy.dialects.postgresql import ENUM as PGEnum


class UserRole(enum.StrEnum):
    ADMIN = "admin"
    USER = "user"


class UserStatus(enum.StrEnum):
    ACTIVE = "active"
    DISABLED = "disabled"


class ConversationType(enum.StrEnum):
    DIRECT = "direct"
    GROUP = "group"
    BROADCAST = "broadcast"


class MemberRole(enum.StrEnum):
    OWNER = "owner"
    MEMBER = "member"
    SENDER = "sender"


def pg_enum(enum_cls: type[enum.Enum], name: str) -> PGEnum:
    """Native PG enum persisted by *value*; type creation is owned by Alembic."""
    kwargs: dict[str, Any] = {
        "name": name,
        "values_callable": lambda e: [m.value for m in e],
        "create_type": False,
    }
    return PGEnum(enum_cls, **kwargs)
