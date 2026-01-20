from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="user", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Increment to invalidate all existing JWT sessions.
    session_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    credits_balance: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    credits_spent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    shops = relationship("Shop", back_populates="owner", cascade="all,delete-orphan")