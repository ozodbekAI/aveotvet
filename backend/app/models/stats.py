from __future__ import annotations

from datetime import datetime, date, timezone

from sqlalchemy import DateTime, Date, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class HourlyStat(Base):
    __tablename__ = "hourly_stats"
    __table_args__ = (
        UniqueConstraint("shop_id", "bucket_utc", "metric", name="uq_hourly_stats"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id", ondelete="CASCADE"), index=True, nullable=False)

    # Start of hour in UTC
    bucket_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    metric: Mapped[str] = mapped_column(String(48), index=True, nullable=False)

    value_int: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    value_num: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)


class DailyStat(Base):
    __tablename__ = "daily_stats"
    __table_args__ = (
        UniqueConstraint("shop_id", "day_utc", "metric", name="uq_daily_stats"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id", ondelete="CASCADE"), index=True, nullable=False)

    day_utc: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    metric: Mapped[str] = mapped_column(String(48), index=True, nullable=False)

    value_int: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    value_num: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
