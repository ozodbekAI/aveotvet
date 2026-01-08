"""settings_and_chats

Revision ID: 0002_settings_and_chats
Revises: 0001_init
Create Date: 2026-01-05

"""
from __future__ import annotations
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_settings_and_chats"
down_revision = "0001_init"
branch_labels = None
depends_on = None

DEFAULT_RATING_MODE_MAP = {"1": "manual", "2": "manual", "3": "semi", "4": "auto", "5": "auto"}


def upgrade() -> None:
    # shop_settings new columns
    op.add_column("shop_settings", sa.Column("reply_mode", sa.String(length=16), nullable=False, server_default=sa.text("'semi'")))
    op.add_column(
    "shop_settings",
    sa.Column(
        "rating_mode_map",
        postgresql.JSONB(astext_type=sa.Text()),
        nullable=False,
        server_default=sa.text(f"'{json.dumps(DEFAULT_RATING_MODE_MAP)}'::jsonb"),
    ),
)
    op.add_column("shop_settings", sa.Column("blacklist_keywords", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")))
    op.add_column("shop_settings", sa.Column("whitelist_keywords", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")))
    op.add_column("shop_settings", sa.Column("templates", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.add_column("shop_settings", sa.Column("chat_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("shop_settings", sa.Column("chat_auto_reply", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("shop_settings", sa.Column("last_chat_sync_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("shop_settings", sa.Column("chat_next_ms", sa.Integer(), nullable=True))

    # chat tables
    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("shop_id", sa.Integer(), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chat_id", sa.String(length=128), nullable=False),
        sa.Column("reply_sign", sa.Text(), nullable=False),
        sa.Column("client_id", sa.String(length=64), nullable=True),
        sa.Column("client_name", sa.String(length=128), nullable=True),
        sa.Column("good_card", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("last_message", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_chat_sessions_shop_id", "chat_sessions", ["shop_id"])
    op.create_unique_constraint("uq_chat_sessions_shop_chat", "chat_sessions", ["shop_id", "chat_id"])

    op.create_table(
        "chat_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("shop_id", sa.Integer(), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_id", sa.String(length=64), nullable=False),
        sa.Column("chat_id", sa.String(length=128), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("is_new_chat", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("add_timestamp_ms", sa.BigInteger(), nullable=True),
        sa.Column("message", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("raw", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_chat_events_shop_id", "chat_events", ["shop_id"])
    op.create_index("ix_chat_events_chat_id", "chat_events", ["chat_id"])
    op.create_unique_constraint("uq_chat_events_shop_event", "chat_events", ["shop_id", "event_id"])

    op.create_table(
        "chat_drafts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("shop_id", sa.Integer(), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chat_id", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default=sa.text("'drafted'")),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("openai_model", sa.String(length=64), nullable=True),
        sa.Column("openai_response_id", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_chat_drafts_shop_id", "chat_drafts", ["shop_id"])
    op.create_index("ix_chat_drafts_chat_id", "chat_drafts", ["chat_id"])


def downgrade() -> None:
    op.drop_index("ix_chat_drafts_chat_id", table_name="chat_drafts")
    op.drop_index("ix_chat_drafts_shop_id", table_name="chat_drafts")
    op.drop_table("chat_drafts")

    op.drop_constraint("uq_chat_events_shop_event", "chat_events", type_="unique")
    op.drop_index("ix_chat_events_chat_id", table_name="chat_events")
    op.drop_index("ix_chat_events_shop_id", table_name="chat_events")
    op.drop_table("chat_events")

    op.drop_constraint("uq_chat_sessions_shop_chat", "chat_sessions", type_="unique")
    op.drop_index("ix_chat_sessions_shop_id", table_name="chat_sessions")
    op.drop_table("chat_sessions")

    op.drop_column("shop_settings", "chat_next_ms")
    op.drop_column("shop_settings", "last_chat_sync_at")
    op.drop_column("shop_settings", "chat_auto_reply")
    op.drop_column("shop_settings", "chat_enabled")
    op.drop_column("shop_settings", "templates")
    op.drop_column("shop_settings", "whitelist_keywords")
    op.drop_column("shop_settings", "blacklist_keywords")
    op.drop_column("shop_settings", "rating_mode_map")
    op.drop_column("shop_settings", "reply_mode")
