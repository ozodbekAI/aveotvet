from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Signature(Base):
    __tablename__ = "signatures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    shop_id: Mapped[int] = mapped_column(
        ForeignKey("shops.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    # Actual signature text (placed at the end of reply)
    text: Mapped[str] = mapped_column(Text, nullable=False)

    # all | review | question | chat
    type: Mapped[str] = mapped_column(String(16), default="all", nullable=False, index=True)

    # all | brand name
    brand: Mapped[str] = mapped_column(String(128), default="all", nullable=False, index=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    shop = relationship("Shop", back_populates="signatures")
