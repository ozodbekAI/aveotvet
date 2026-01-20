from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PromptRecord(Base):
    __tablename__ = "prompt_records"
    __table_args__ = (
        UniqueConstraint("scope", "key", name="uq_prompt_records_scope_key"),
        Index("ix_prompt_records_scope", "scope"),
        Index("ix_prompt_records_key", "key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    scope: Mapped[str] = mapped_column(String(32), default="global", nullable=False)

    key: Mapped[str] = mapped_column(String(64), nullable=False)

    value_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    value_json: Mapped[dict | list | None] = mapped_column(JSONB, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
