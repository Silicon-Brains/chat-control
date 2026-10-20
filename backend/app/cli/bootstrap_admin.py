"""Create the first admin. Run once on a trusted machine (needs the production env vars):

    python -m app.cli.bootstrap_admin --email you@company.com

* If that e-mail already has a Clerk account: its ``public_metadata.role`` is set to ``admin``.
* Otherwise an invitation with ``role=admin`` is sent; sign up through the e-mail link.
Further admins: set ``{"role": "admin"}`` in the Clerk dashboard (User -> Metadata -> Public).
"""

from __future__ import annotations

import argparse
import asyncio
import re
from types import SimpleNamespace
from typing import Any

from app.core.config import get_settings
from app.db.session import create_engine, create_session_factory
from app.integrations.clerk import ClerkClient
from app.repositories.audit import AuditRepository
from app.repositories.users import UserRepository
from app.services.identity_service import IdentityService

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


async def bootstrap(email: str, *, clerk: Any | None = None) -> str:
    s = get_settings()
    clerk = clerk or ClerkClient(s.clerk_secret_key.get_secret_value(), s.clerk_api_url)
    engine = create_engine(s)
    try:
        existing = await clerk.find_user_by_email(email)
        if existing is None:
            await clerk.create_invitation(email, role="admin", redirect_url=s.invitation_redirect_url)
            return f"No Clerk account for {email}: invitation (role=admin) sent. Sign up via the e-mail link."
        await clerk.set_user_role(existing.id, "admin")
        container: Any = SimpleNamespace(settings=s, clerk=clerk)  # IdentityService needs only these two
        async with create_session_factory(engine)() as session:
            fresh = await clerk.get_user(existing.id)
            local = await UserRepository(session).get_by_clerk_id(existing.id, for_update=True)
            user = await IdentityService(session, container).apply(fresh, local)
            AuditRepository(session).add("admin.bootstrap", actor_id=user.id, meta={"via": "cli"})
            await session.commit()
        return f"{email} is now an admin (username '{user.username}')."
    finally:
        await clerk.aclose()
        await engine.dispose()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--email", required=True)
    args = ap.parse_args()
    if not EMAIL_RE.fullmatch(args.email):
        raise SystemExit("invalid e-mail address")
    print(asyncio.run(bootstrap(args.email.strip().lower())))


if __name__ == "__main__":
    main()
