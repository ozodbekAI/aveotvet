from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel


class ChatSessionOut(BaseModel):
    chat_id: str
    client_id: str | None = None
    client_name: str | None = None
    good_card: dict | None = None
    last_message: dict | None = None
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
