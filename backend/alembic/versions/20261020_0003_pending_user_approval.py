"""Add pending state for Clerk self-signups awaiting admin approval.

Revision ID: 0003
Revises: 0002
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'pending'")
    op.execute("ALTER TABLE users ALTER COLUMN status SET DEFAULT 'pending'")


def downgrade() -> None:
    # Pending registrations are kept but become disabled when reverting the feature.
    op.execute("UPDATE users SET status = 'disabled' WHERE status = 'pending'")
    op.execute("ALTER TABLE users ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TYPE user_status RENAME TO user_status_old")
    op.execute("CREATE TYPE user_status AS ENUM ('active', 'disabled')")
    op.execute("ALTER TABLE users ALTER COLUMN status TYPE user_status USING status::text::user_status")
    op.execute("ALTER TABLE users ALTER COLUMN status SET DEFAULT 'active'")
    op.execute("DROP TYPE user_status_old")
