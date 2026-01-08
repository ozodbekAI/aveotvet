"""init

Revision ID: 0001_init
Revises: 
Create Date: 2026-01-05

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "shops",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("wb_token_enc", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_shops_owner_user_id", "shops", ["owner_user_id"])

    op.create_table(
        "shop_settings",
        sa.Column("shop_id", sa.Integer(), sa.ForeignKey("shops.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("auto_sync", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("auto_draft", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("auto_publish", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("min_rating_to_autopublish", sa.Integer(), nullable=False, server_default=sa.text("4")),
        sa.Column("language", sa.String(), nullable=False, server_default=sa.text("'ru'")),
        sa.Column("tone", sa.String(), nullable=False, server_default=sa.text("'polite'")),
        sa.Column("signature", sa.String(), nullable=True),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "feedbacks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("shop_id", sa.Integer(), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("wb_id", sa.String(length=64), nullable=False),
        sa.Column("created_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("pros", sa.Text(), nullable=True),
        sa.Column("cons", sa.Text(), nullable=True),
        sa.Column("product_valuation", sa.Integer(), nullable=True),
        sa.Column("user_name", sa.String(length=120), nullable=True),
        sa.Column("state", sa.String(length=32), nullable=True),
        sa.Column("was_viewed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("answer_text", sa.Text(), nullable=True),
        sa.Column("answer_state", sa.String(length=32), nullable=True),
        sa.Column("answer_editable", sa.Boolean(), nullable=True),
        sa.Column("product_details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("photo_links", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("video", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("bables", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("raw", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_feedbacks_shop_id", "feedbacks", ["shop_id"])
    op.create_index("ix_feedbacks_wb_id", "feedbacks", ["wb_id"])
    op.create_index("ix_feedbacks_created_date", "feedbacks", ["created_date"])
    op.create_index("ix_feedbacks_user_name", "feedbacks", ["user_name"])
    op.create_unique_constraint("uq_feedbacks_shop_wb", "feedbacks", ["shop_id", "wb_id"])

    op.create_table(
        "feedback_drafts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("feedback_id", sa.Integer(), sa.ForeignKey("feedbacks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default=sa.text("'drafted'")),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("openai_model", sa.String(length=64), nullable=True),
        sa.Column("openai_response_id", sa.String(length=64), nullable=True),
        sa.Column("prompt_version", sa.String(length=32), nullable=False, server_default=sa.text("'v1'")),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_feedback_drafts_feedback_id", "feedback_drafts", ["feedback_id"])

    op.create_table(
        "jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default=sa.text("'queued'")),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default=sa.text("5")),
        sa.Column("run_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("last_error", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_jobs_type", "jobs", ["type"])
    op.create_index("ix_jobs_status", "jobs", ["status"])
    op.create_index("ix_jobs_run_at", "jobs", ["run_at"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("entity", sa.String(length=64), nullable=True),
        sa.Column("entity_id", sa.String(length=64), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])


def downgrade() -> None:
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index("ix_jobs_run_at", table_name="jobs")
    op.drop_index("ix_jobs_status", table_name="jobs")
    op.drop_index("ix_jobs_type", table_name="jobs")
    op.drop_table("jobs")

    op.drop_index("ix_feedback_drafts_feedback_id", table_name="feedback_drafts")
    op.drop_table("feedback_drafts")

    op.drop_constraint("uq_feedbacks_shop_wb", "feedbacks", type_="unique")
    op.drop_index("ix_feedbacks_user_name", table_name="feedbacks")
    op.drop_index("ix_feedbacks_created_date", table_name="feedbacks")
    op.drop_index("ix_feedbacks_wb_id", table_name="feedbacks")
    op.drop_index("ix_feedbacks_shop_id", table_name="feedbacks")
    op.drop_table("feedbacks")

    op.drop_table("shop_settings")

    op.drop_index("ix_shops_owner_user_id", table_name="shops")
    op.drop_table("shops")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
