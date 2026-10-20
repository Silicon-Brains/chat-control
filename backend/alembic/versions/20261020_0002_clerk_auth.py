"""Clerk authentication: identities live in Clerk, credentials are removed from our schema.

Legacy hex-code accounts cannot be mapped to Clerk users, so this migration DELETES all existing
users and the data hanging off them (conversations, messages). Safe pre-launch; back up first otherwise.

Revision ID: 0002
Revises: 0001
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute("DELETE FROM conversations")  # cascades members/keys/messages
    op.execute("DELETE FROM users")
    op.drop_table("refresh_tokens")
    op.add_column("users", sa.Column("clerk_user_id", sa.String(64), nullable=False))
    op.add_column("users", sa.Column("email", sa.String(254), nullable=True))
    op.add_column("users", sa.Column("synced_at", sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint("uq_users_clerk_user_id", "users", ["clerk_user_id"])
    for col in ("code_hash", "totp_secret_enc", "totp_last_step", "failed_attempts", "locked_until", "token_version"):
        op.drop_column("users", col)


def downgrade() -> None:
    op.execute("DELETE FROM users")
    op.add_column("users", sa.Column("code_hash", sa.Text(), nullable=False))
    op.add_column("users", sa.Column("totp_secret_enc", sa.LargeBinary(), nullable=True))
    op.add_column("users", sa.Column("totp_last_step", sa.BigInteger(), nullable=True))
    op.add_column("users", sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default=sa.text("0")))
    op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default=sa.text("1")))
    op.drop_constraint("uq_users_clerk_user_id", "users", type_="unique")
    for col in ("synced_at", "email", "clerk_user_id"):
        op.drop_column("users", col)
    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.LargeBinary(), nullable=False),
        sa.Column("user_agent", sa.String(256), nullable=True),
        sa.Column("ip", postgresql.INET(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_refresh_tokens"),
        sa.UniqueConstraint("token_hash", name="uq_refresh_tokens_token_hash"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_refresh_tokens_user_id_users", ondelete="CASCADE"),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_family_id", "refresh_tokens", ["family_id"])
    op.create_index("ix_refresh_tokens_expires_at", "refresh_tokens", ["expires_at"])
