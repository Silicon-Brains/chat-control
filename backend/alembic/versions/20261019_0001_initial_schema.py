"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-10-19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

USER_ROLE = pg.ENUM("admin", "user", name="user_role", create_type=False)
USER_STATUS = pg.ENUM("active", "disabled", name="user_status", create_type=False)
CONV_TYPE = pg.ENUM("direct", "group", "broadcast", name="conversation_type", create_type=False)
MEMBER_ROLE = pg.ENUM("owner", "member", "sender", name="member_role", create_type=False)

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    bind = op.get_bind()
    for e in (USER_ROLE, USER_STATUS, CONV_TYPE, MEMBER_ROLE):
        e.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("username", sa.String(24), nullable=False),
        sa.Column("display_name", sa.String(64), nullable=False),
        sa.Column("role", USER_ROLE, server_default="user", nullable=False),
        sa.Column("code_hash", sa.Text(), nullable=False),
        sa.Column("totp_secret_enc", sa.LargeBinary()),
        sa.Column("totp_last_step", sa.BigInteger()),
        sa.Column("public_key", sa.LargeBinary()),
        sa.Column("key_fingerprint", sa.String(64)),
        sa.Column("status", USER_STATUS, server_default="active", nullable=False),
        sa.Column("failed_attempts", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("locked_until", TS),
        sa.Column("token_version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("created_by", pg.UUID(as_uuid=True)),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
        sa.Column("last_login_at", TS),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("username", name="uq_users_username"),
        sa.CheckConstraint("username ~ '^[a-z0-9_]{3,24}$'", name="ck_users_username_format"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name="fk_users_created_by_users", ondelete="SET NULL"),
    )

    op.create_table(
        "refresh_tokens",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("family_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.LargeBinary(), nullable=False),
        sa.Column("user_agent", sa.String(256)),
        sa.Column("ip", pg.INET()),
        sa.Column("expires_at", TS, nullable=False),
        sa.Column("revoked_at", TS),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_refresh_tokens"),
        sa.UniqueConstraint("token_hash", name="uq_refresh_tokens_token_hash"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_refresh_tokens_user_id_users", ondelete="CASCADE"),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_family_id", "refresh_tokens", ["family_id"])
    op.create_index("ix_refresh_tokens_expires_at", "refresh_tokens", ["expires_at"])

    op.create_table(
        "ws_tickets",
        sa.Column("token_hash", sa.LargeBinary(), nullable=False),
        sa.Column("user_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("expires_at", TS, nullable=False),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("token_hash", name="pk_ws_tickets"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_ws_tickets_user_id_users", ondelete="CASCADE"),
    )
    op.create_index("ix_ws_tickets_expires_at", "ws_tickets", ["expires_at"])

    op.create_table(
        "conversations",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("type", CONV_TYPE, nullable=False),
        sa.Column("name", sa.String(100)),
        sa.Column("direct_pair_key", sa.String(73)),
        sa.Column("current_key_version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("rotation_required", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_by", pg.UUID(as_uuid=True)),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_conversations"),
        sa.UniqueConstraint("direct_pair_key", name="uq_conversations_direct_pair_key"),
        sa.CheckConstraint(
            "(type = 'direct' AND direct_pair_key IS NOT NULL AND name IS NULL) OR "
            "(type <> 'direct' AND direct_pair_key IS NULL AND name IS NOT NULL)",
            name="ck_conversations_shape",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], name="fk_conversations_created_by_users", ondelete="SET NULL"
        ),
    )

    op.create_table(
        "conversation_members",
        sa.Column("conversation_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("role", MEMBER_ROLE, server_default="member", nullable=False),
        sa.Column("last_read_at", TS),
        sa.Column("joined_at", TS, server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("conversation_id", "user_id", name="pk_conversation_members"),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversations.id"],
            name="fk_conversation_members_conversation_id_conversations",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_conversation_members_user_id_users", ondelete="CASCADE"
        ),
    )
    op.create_index("ix_conversation_members_user_id", "conversation_members", ["user_id"])

    op.create_table(
        "conversation_keys",
        sa.Column("conversation_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("key_version", sa.Integer(), nullable=False),
        sa.Column("wrapped_key", sa.LargeBinary(), nullable=False),
        sa.Column("wrapper_pub", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("conversation_id", "user_id", "key_version", name="pk_conversation_keys"),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversations.id"],
            name="fk_conversation_keys_conversation_id_conversations",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name="fk_conversation_keys_user_id_users", ondelete="CASCADE"
        ),
    )
    op.create_index("ix_conversation_keys_user_id", "conversation_keys", ["user_id"])

    op.create_table(
        "messages",
        sa.Column("id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("sender_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("ciphertext", sa.LargeBinary(), nullable=False),
        sa.Column("nonce", sa.LargeBinary(), nullable=False),
        sa.Column("key_version", sa.Integer(), nullable=False),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", TS, server_default=sa.text("now() + interval '10 hours'"), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_messages"),
        sa.CheckConstraint("octet_length(ciphertext) BETWEEN 16 AND 8192", name="ck_messages_ciphertext_size"),
        sa.CheckConstraint("octet_length(nonce) = 12", name="ck_messages_nonce_size"),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversations.id"],
            name="fk_messages_conversation_id_conversations",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], name="fk_messages_sender_id_users", ondelete="CASCADE"),
    )
    op.create_index(
        "ix_messages_conversation_history",
        "messages",
        ["conversation_id", sa.text("created_at DESC"), sa.text("id DESC")],
    )
    op.create_index("ix_messages_expires_at", "messages", ["expires_at"])
    op.create_index("ix_messages_conversation_key_version", "messages", ["conversation_id", "key_version"])
    op.create_index("ix_messages_sender_id", "messages", ["sender_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("actor_id", pg.UUID(as_uuid=True)),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("target_id", pg.UUID(as_uuid=True)),
        sa.Column("ip", pg.INET()),
        sa.Column("meta", pg.JSONB()),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_audit_logs"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], name="fk_audit_logs_actor_id_users", ondelete="SET NULL"),
    )
    op.create_index("ix_audit_logs_created_at", "audit_logs", [sa.text("created_at DESC")])
    op.create_index("ix_audit_logs_action_created_at", "audit_logs", ["action", sa.text("created_at DESC")])


def downgrade() -> None:
    for table in (
        "audit_logs",
        "messages",
        "conversation_keys",
        "conversation_members",
        "conversations",
        "ws_tickets",
        "refresh_tokens",
        "users",
    ):
        op.drop_table(table)
    bind = op.get_bind()
    for e in (MEMBER_ROLE, CONV_TYPE, USER_STATUS, USER_ROLE):
        e.drop(bind, checkfirst=True)
