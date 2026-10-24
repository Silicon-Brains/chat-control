"""Support encrypted message edits and deletion tombstones.

Revision ID: 0008
Revises: 0007
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.add_column("messages", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_messages_conversation_updates", "messages", ["conversation_id", "updated_at", "id"])
    op.alter_column("messages", "ciphertext", existing_type=sa.LargeBinary(), nullable=True)
    op.alter_column("messages", "nonce", existing_type=sa.LargeBinary(), nullable=True)


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM messages WHERE deleted_at IS NOT NULL"))
    op.alter_column("messages", "ciphertext", existing_type=sa.LargeBinary(), nullable=False)
    op.alter_column("messages", "nonce", existing_type=sa.LargeBinary(), nullable=False)
    op.drop_index("ix_messages_conversation_updates", table_name="messages")
    op.drop_column("messages", "deleted_at")
    op.drop_column("messages", "updated_at")
