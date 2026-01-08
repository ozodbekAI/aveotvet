"""questions and signatures

Revision ID: 0003_questions_and_signatures
Revises: 0002_settings_and_chats
Create Date: 2026-01-06

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0003_questions_and_signatures"
down_revision = "0002_settings_and_chats"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # shop_settings: add signature pool + questions workflow
    op.add_column("shop_settings", sa.Column("signatures", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")))
    op.add_column("shop_settings", sa.Column("questions_reply_mode", sa.String(length=16), nullable=False, server_default=sa.text("'semi'")))
    op.add_column("shop_settings", sa.Column("questions_auto_draft", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("shop_settings", sa.Column("questions_auto_publish", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("shop_settings", sa.Column("last_questions_sync_at", sa.DateTime(timezone=True), nullable=True))

    # questions
    op.create_table(
        "questions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("shop_id", sa.Integer(), sa.ForeignKey("shops.id", ondelete="CASCADE"), nullable=False),
        sa.Column("wb_id", sa.String(length=64), nullable=False),
        sa.Column("created_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("user_name", sa.String(length=120), nullable=True),
        sa.Column("state", sa.String(length=32), nullable=True),
        sa.Column("was_viewed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("answer_text", sa.Text(), nullable=True),
        sa.Column("answer_editable", sa.Boolean(), nullable=True),
        sa.Column("product_details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("raw", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_questions_shop_id", "questions", ["shop_id"])
    op.create_index("ix_questions_wb_id", "questions", ["wb_id"])
    op.create_index("ix_questions_created_date", "questions", ["created_date"])
    op.create_index("ix_questions_user_name", "questions", ["user_name"])
    op.create_unique_constraint("uq_questions_shop_wb", "questions", ["shop_id", "wb_id"])

    op.create_table(
        "question_drafts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("question_id", sa.Integer(), sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False),
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
    op.create_index("ix_question_drafts_question_id", "question_drafts", ["question_id"])


def downgrade() -> None:
    op.drop_index("ix_question_drafts_question_id", table_name="question_drafts")
    op.drop_table("question_drafts")

    op.drop_constraint("uq_questions_shop_wb", "questions", type_="unique")
    op.drop_index("ix_questions_user_name", table_name="questions")
    op.drop_index("ix_questions_created_date", table_name="questions")
    op.drop_index("ix_questions_wb_id", table_name="questions")
    op.drop_index("ix_questions_shop_id", table_name="questions")
    op.drop_table("questions")

    op.drop_column("shop_settings", "last_questions_sync_at")
    op.drop_column("shop_settings", "questions_auto_publish")
    op.drop_column("shop_settings", "questions_auto_draft")
    op.drop_column("shop_settings", "questions_reply_mode")
    op.drop_column("shop_settings", "signatures")
