from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SystemFlags(Base):
    """Single-row table for operational kill-switch and other global flags."""

    __tablename__ = "system_flags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kill_switch: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
