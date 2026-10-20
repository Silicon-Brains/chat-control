"""Increase encrypted message storage for client-encrypted voice messages.

Revision ID: 0005
Revises: 0004
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "ALTER TABLE messages "
            "DROP CONSTRAINT IF EXISTS ck_messages_ciphertext_size, "
            "DROP CONSTRAINT IF EXISTS ck_messages_ck_messages_ciphertext_size"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE messages ADD CONSTRAINT ck_messages_ciphertext_size "
            "CHECK (octet_length(ciphertext) BETWEEN 16 AND 262144)"
        )
    )


def downgrade() -> None:
    oversized = op.get_bind().execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM messages WHERE octet_length(ciphertext) > 8192)")
    ).scalar_one()
    if oversized:
        raise RuntimeError("Cannot downgrade while voice messages larger than 8 KB are stored")
    op.execute(
        sa.text(
            "ALTER TABLE messages "
            "DROP CONSTRAINT IF EXISTS ck_messages_ciphertext_size, "
            "DROP CONSTRAINT IF EXISTS ck_messages_ck_messages_ciphertext_size"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE messages ADD CONSTRAINT ck_messages_ciphertext_size "
            "CHECK (octet_length(ciphertext) BETWEEN 16 AND 8192)"
        )
    )
