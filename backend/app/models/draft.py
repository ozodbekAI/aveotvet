from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Text, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import DraftStatus


class FeedbackDraft(Base):
    __tablename__ = "feedback_drafts"

    id: Mapped[int] = mapped_column(primary_key=True)
    feedback_id: Mapped[int] = mapped_column(ForeignKey("feedbacks.id", ondelete="CASCADE"), index=True, nullable=False)

    status: Mapped[str] = mapped_column(String(16), default=DraftStatus.drafted.value, nullable=False)

    text: Mapped[str] = mapped_column(Text, nullable=False)

    openai_model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    openai_response_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    prompt_version: Mapped[str] = mapped_column(String(32), default="v1", nullable=False)

    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    feedback = relationship("Feedback", back_populates="drafts")
