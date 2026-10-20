"""Test environment. Integration tests need a throw-away Postgres:

TEST_DATABASE_URL=postgresql://user:pass@localhost/vaultchat_test?sslmode=disable pytest
"""

from __future__ import annotations

import os

os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "postgresql://x:x@localhost/none?sslmode=disable")
os.environ.update(
    {
        "ENV": "test",
        "LOG_LEVEL": "WARNING",
        "CLERK_SECRET_KEY": "sk_test_fake",
        "CLERK_ISSUER": "https://clerk.test",
        "CLERK_WEBHOOK_SECRET": "whsec_dGVzdC13ZWJob29rLXNlY3JldC0xMjM0NTY3ODkwMTI=",
        "CLERK_SYNC_TTL_SECONDS": "0",
        "CLERK_ADMIN_SYNC_TTL_SECONDS": "0",  # every request re-syncs with the fake
        "PURGE_INTERVAL_SECONDS": "3600",
        "WS_RATE_LIMIT_MESSAGES": "20",
        "ALLOWED_ORIGINS": "http://localhost:3000",
    }
)
