"""Remove obsolete WebSocket ticket storage.

Revision ID: 0007
Revises: 0006
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_table("ws_tickets", if_exists=True)


def downgrade() -> None:
    op.create_table(
        "ws_tickets",
        sa.Column("token_hash", sa.LargeBinary(), nullable=False),
        sa.Column("user_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("token_hash", name="pk_ws_tickets"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_ws_tickets_user_id_users", ondelete="CASCADE"),
    )
    op.create_index("ix_ws_tickets_expires_at", "ws_tickets", ["expires_at"])
