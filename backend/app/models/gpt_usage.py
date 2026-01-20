from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class GptUsage(Base):
    """Per-operation GPT usage accounting.

    cost_usd/cost_rub are computed at the time of generation.
    """

    __tablename__ = "gpt_usage"

    id: Mapped[int] = mapped_column(primary_key=True)

    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id", ondelete="CASCADE"), index=True, nullable=False)

    model: Mapped[str] = mapped_column(String(64), nullable=False)
    operation_type: Mapped[str] = mapped_column(String(32), index=True, nullable=False)

    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    cost_usd: Mapped[float] = mapped_column(Numeric(14, 6), default=0, nullable=False)
    cost_rub: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)

    # Optional link to OpenAI response id for debug.
    response_id: Mapped[str | None] = mapped_column(String(128), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
