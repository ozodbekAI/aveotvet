from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Shop(Base):
    __tablename__ = "shops"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)

    wb_token_enc: Mapped[str] = mapped_column(Text, nullable=False)  # encrypted or plain (see core.crypto)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    owner = relationship("User", back_populates="shops")
    settings = relationship("ShopSettings", back_populates="shop", uselist=False, cascade="all,delete-orphan")
    members = relationship("ShopMember", back_populates="shop", cascade="all,delete-orphan")
    feedbacks = relationship("Feedback", back_populates="shop", cascade="all,delete-orphan")
    questions = relationship("Question", back_populates="shop", cascade="all,delete-orphan")
    product_cards = relationship("ProductCard", back_populates="shop", cascade="all,delete-orphan")

    # Signatures are stored in a separate table to avoid copying JSON into settings
    # and to support brand/type filters.
    signatures = relationship("Signature", back_populates="shop", cascade="all,delete-orphan")