"""news

Revision ID: 8de4241a799c
Revises: 909e268179ad
Create Date: 2026-01-09 01:39:14.820580

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8de4241a799c'
down_revision = '909e268179ad'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Add column with server default so existing rows get value
    op.add_column(
        "feedbacks",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # 2) (Optional) remove default for future inserts if app sets it itself
    op.alter_column("feedbacks", "created_at", server_default=None)


def downgrade() -> None:
    op.drop_column("feedbacks", "created_at")
    # ### end Alembic commands ###
