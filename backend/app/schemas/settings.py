from __future__ import annotations

from pydantic import BaseModel, Field


class SettingsOut(BaseModel):
    shop_id: int

    auto_sync: bool
    reply_mode: str
    auto_draft: bool
    auto_publish: bool

    rating_mode_map: dict
    min_rating_to_autopublish: int

    language: str
    tone: str
    signature: str | None
    signatures: list

    blacklist_keywords: list
    whitelist_keywords: list
    templates: dict

    chat_enabled: bool
    chat_auto_reply: bool

    questions_reply_mode: str
    questions_auto_draft: bool
    questions_auto_publish: bool

    config: dict

    class Config:
        from_attributes = True


class SettingsUpdate(BaseModel):
    auto_sync: bool | None = None
    reply_mode: str | None = Field(default=None, description="manual | semi | auto")

    auto_draft: bool | None = None
    auto_publish: bool | None = None

    rating_mode_map: dict | None = None
    min_rating_to_autopublish: int | None = Field(default=None, ge=1, le=5)

    language: str | None = None
    tone: str | None = None
    signature: str | None = None
    signatures: list | None = None

    blacklist_keywords: list | None = None
    whitelist_keywords: list | None = None
    templates: dict | None = None

    chat_enabled: bool | None = None
    chat_auto_reply: bool | None = None

    questions_reply_mode: str | None = Field(default=None, description="manual | semi | auto")
    questions_auto_draft: bool | None = None
    questions_auto_publish: bool | None = None

    config: dict | None = None
