from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text, UniqueConstraint, Boolean, BigInteger, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id", ondelete="CASCADE"), index=True, nullable=False)

    chat_id: Mapped[str] = mapped_column(String(128), nullable=False)
    reply_sign: Mapped[str] = mapped_column(Text, nullable=False)

    client_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    client_name: Mapped[str | None] = mapped_column(String(128), nullable=True)

    good_card: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    last_message: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint("shop_id", "chat_id", name="uq_chat_sessions_shop_chat"),
    )


class ChatEvent(Base):
    __tablename__ = "chat_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id", ondelete="CASCADE"), index=True, nullable=False)

    event_id: Mapped[str] = mapped_column(String(64), nullable=False)
    chat_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)

    is_new_chat: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    add_timestamp_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    message: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    raw: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint("shop_id", "event_id", name="uq_chat_events_shop_event"),
    )


class ChatDraft(Base):
    __tablename__ = "chat_drafts"

    id: Mapped[int] = mapped_column(primary_key=True)
    shop_id: Mapped[int] = mapped_column(ForeignKey("shops.id", ondelete="CASCADE"), index=True, nullable=False)
    chat_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)

    status: Mapped[str] = mapped_column(String(16), default="drafted", nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)

    openai_model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    openai_response_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
