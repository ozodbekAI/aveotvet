from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel


class ChatSessionOut(BaseModel):
    chat_id: str
    client_id: str | None = None
    client_name: str | None = None
    good_card: dict | None = None
    last_message: dict | None = None
    # Convenience product fields for UI (resolved from cached product_cards by good_card.nmID).
    nm_id: int | None = None
    product_title: str | None = None
    product_brand: str | None = None
    product_thumb_url: str | None = None
    unread_count: int = 0
    updated_at: datetime

    class Config:
        from_attributes = True


class ChatEventOut(BaseModel):
    event_id: str
    chat_id: str
    event_type: str
    is_new_chat: bool
    add_timestamp_ms: int | None = None
    message: dict | None = None
    raw: dict

    class Config:
        from_attributes = True


class ChatDraftOut(BaseModel):
    id: int
    chat_id: str
    status: str
    text: str
    openai_model: str | None = None
    openai_response_id: str | None = None

    class Config:
        from_attributes = True


class ChatSessionRowOut(ChatSessionOut):
    shop_id: int
    shop_name: str


class ChatSessionsPageOut(BaseModel):
    total: int
    items: list[ChatSessionRowOut]
