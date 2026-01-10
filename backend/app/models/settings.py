from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Boolean, Integer, String, BigInteger
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ShopSettings(Base):
    __tablename__ = "shop_settings"

    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id", ondelete="CASCADE"), primary_key=True)

    auto_sync: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    reply_mode: Mapped[str] = mapped_column(String(16), default="semi", nullable=False)

    auto_draft: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    auto_publish: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    rating_mode_map: Mapped[dict] = mapped_column(JSONB, default=lambda: {"1":"manual","2":"manual","3":"semi","4":"auto","5":"auto"}, nullable=False)

    # Minimum rating that can be auto-published even if rating_mode_map is "auto"
    min_rating_to_autopublish: Mapped[int] = mapped_column(Integer, default=4, nullable=False)

    # Language & style
    language: Mapped[str] = mapped_column(String(8), default="ru", nullable=False)
    tone: Mapped[str] = mapped_column(String(24), default="polite", nullable=False)  
    signature: Mapped[str | None] = mapped_column(String(120), default=None, nullable=True)

    # Pool of signatures (UI-like). If present, drafting may pick one.
    signatures: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)

    # Content policies
    blacklist_keywords: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)  # force manual
    whitelist_keywords: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)  # may override to semi/auto (optional)

    # Reply templates (optional). Example:
    # {"positive": "...", "neutral":"...", "negative":"...", "question":"..."}
    templates: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    # Questions workflow (separate from feedbacks)
    questions_reply_mode: Mapped[str] = mapped_column(String(16), default="semi", nullable=False)
    questions_auto_draft: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    questions_auto_publish: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Buyers chat preferences
    chat_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    chat_auto_reply: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Raw JSON for future extensibility (additional prompt params, exclusions, etc.)
    config: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    # Sync markers
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_questions_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_chat_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    chat_next_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)  # WB events paginator (ms)

    # Product cards sync (Content API) - used to attach product photos to feedback list.
    last_cards_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cards_cursor_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cards_cursor_nm_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    shop = relationship("Shop", back_populates="settings")
