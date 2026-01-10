from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ProductCard(Base):
    __tablename__ = "product_cards"

    id: Mapped[int] = mapped_column(primary_key=True)

    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id", ondelete="CASCADE"), index=True, nullable=False)

    nm_id: Mapped[int] = mapped_column(BigInteger, index=True, nullable=False)

    vendor_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    brand: Mapped[str | None] = mapped_column(String(160), nullable=True)

    subject_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    subject_name: Mapped[str | None] = mapped_column(String(160), nullable=True)

    thumb_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    photos: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    raw: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    wb_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    shop = relationship("Shop", back_populates="product_cards")

    __table_args__ = (
        UniqueConstraint("shop_id", "nm_id", name="uq_product_cards_shop_nm"),
    )
