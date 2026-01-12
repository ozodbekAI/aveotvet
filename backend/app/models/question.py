from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Boolean, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id", ondelete="CASCADE"), index=True, nullable=False)

    wb_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    created_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)

    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_name: Mapped[str | None] = mapped_column(String(120), index=True, nullable=True)

    state: Mapped[str | None] = mapped_column(String(32), nullable=True)
    was_viewed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Answer info
    answer_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    answer_editable: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    product_details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    raw: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    shop = relationship("Shop", back_populates="questions")
    drafts = relationship("QuestionDraft", back_populates="question", cascade="all,delete-orphan")

    __table_args__ = (
        UniqueConstraint("shop_id", "wb_id", name="uq_questions_shop_wb"),
    )
