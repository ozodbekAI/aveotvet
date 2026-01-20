from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Shop(Base):
    __tablename__ = "shops"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)

    wb_token_enc: Mapped[str | None] = mapped_column(Text, nullable=True)

    credits_balance: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    credits_spent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_frozen: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    owner = relationship("User", back_populates="shops")
    settings = relationship("ShopSettings", back_populates="shop", uselist=False, cascade="all,delete-orphan")
    members = relationship("ShopMember", back_populates="shop", cascade="all,delete-orphan")
    feedbacks = relationship("Feedback", back_populates="shop", cascade="all,delete-orphan")
    questions = relationship("Question", back_populates="shop", cascade="all,delete-orphan")
    product_cards = relationship("ProductCard", back_populates="shop", cascade="all,delete-orphan")

    signatures = relationship("Signature", back_populates="shop", cascade="all,delete-orphan")