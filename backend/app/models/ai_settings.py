from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AISettings(Base):
    """Single-row table with global AI providers/flags/policies.

    We intentionally keep this very flexible (JSON) for v1.
    """

    __tablename__ = "ai_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    providers: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    feature_flags: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    policies: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
