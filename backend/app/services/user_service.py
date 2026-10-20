from __future__ import annotations

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.container import Container
from app.core.encoding import fingerprint
from app.core.errors import Conflict, ValidationFailed
from app.models import User
from app.repositories.audit import AuditRepository
from app.repositories.users import UserRepository
from app.services.common import parse_uuid_cursor


def normalize_p256_public_key(data: bytes) -> bytes:
    """Accept SPKI DER (WebCrypto ``spki``) or a raw uncompressed point; return SPKI DER."""
    try:
        if len(data) == 65 and data[0] == 0x04:
            key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), data)
        else:
            loaded = serialization.load_der_public_key(data)
            if not isinstance(loaded, ec.EllipticCurvePublicKey):
                raise ValueError("not an EC key")
            key = loaded
        if not isinstance(key.curve, ec.SECP256R1):
            raise ValueError("wrong curve")
    except ValueError as exc:
        raise ValidationFailed("publicKey must be a valid ECDH P-256 public key") from exc
    return key.public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)


class UserService:
    def __init__(self, session: AsyncSession, container: Container) -> None:
        self.session = session
        self.users = UserRepository(session)
        self.audit = AuditRepository(session)

    async def directory(self, *, q: str | None, cursor: str | None, limit: int) -> tuple[list[User], str | None]:
        rows = await self.users.directory_page(q=q, after_id=parse_uuid_cursor(cursor), limit=limit)
        next_cursor = str(rows[limit - 1].id) if len(rows) > limit else None
        return rows[:limit], next_cursor

    async def register_public_key(self, user: User, raw_key: bytes, *, ip: str) -> None:
        """First-login key registration. A *different* key is refused: replacing a key
        silently would let a stolen session impersonate the user. Lost device => admin
        resets the code, which clears the key."""
        locked = await self.users.get(user.id, for_update=True)
        assert locked is not None
        der = normalize_p256_public_key(raw_key)
        if locked.public_key is not None:
            if locked.public_key == der:
                return
            raise Conflict(
                "A different key is already registered; ask an admin to reset your code", code="KEY_ALREADY_REGISTERED"
            )
        locked.public_key = der
        locked.key_fingerprint = fingerprint(der)
        self.audit.add("key.register", actor_id=user.id, ip=ip, meta={"fingerprint": locked.key_fingerprint})
        await self.session.commit()
