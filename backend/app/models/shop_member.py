from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ShopMember(Base):
    __tablename__ = "shop_members"
    __table_args__ = (
        UniqueConstraint("shop_id", "user_id", name="uq_shop_members_shop_user"),
        Index("ix_shop_members_shop_id", "shop_id"),
        Index("ix_shop_members_user_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # v1 RBAC: only owner/manager are supported
    role: Mapped[str] = mapped_column(String(16), default="manager", nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    shop = relationship("Shop", back_populates="members")
    user = relationship("User")
