from __future__ import annotations

from pydantic import BaseModel, Field, field_validator
from app.schemas.config_schemas import ConfigUpdate, ConfigResponse


class SignatureItem(BaseModel):
    text: str = Field(min_length=1, max_length=300)
    type: str = Field(default="all", description="all | review | question | chat")
    brand: str = Field(default="all", description="all | brand name")
    is_active: bool = Field(default=True)
    created_at: str | None = None

    @field_validator("type")
    @classmethod
    def _validate_type(cls, v: str) -> str:
        vv = (v or "").strip().lower()
        if vv not in ("all", "review", "question", "chat"):
            raise ValueError("type must be one of: all, review, question, chat")
        return vv

    @field_validator("brand")
    @classmethod
    def _validate_brand(cls, v: str) -> str:
        vv = (v or "").strip()
        return vv or "all"


class SettingsOut(BaseModel):
    shop_id: int

    auto_sync: bool
    reply_mode: str
    auto_draft: bool
    auto_publish: bool
    auto_draft_limit_per_sync: int

    rating_mode_map: dict
    min_rating_to_autopublish: int

    language: str
    tone: str
    signature: str | None
    signatures: list[str | SignatureItem]

    blacklist_keywords: list
    whitelist_keywords: list
    templates: dict

    chat_enabled: bool
    chat_auto_reply: bool

    questions_reply_mode: str
    questions_auto_draft: bool
    questions_auto_publish: bool

    config: ConfigResponse

    class Config:
        from_attributes = True
    
    @field_validator("config", mode="before")
    @classmethod
    def ensure_config_structure(cls, v):
        """Ensure config has proper structure even if it's empty in DB."""
        if not v or not isinstance(v, dict):
            return {
                "advanced": {},
                "chat": {},
                "recommendations": {}
            }
        
        result = {
            "advanced": v.get("advanced", {}),
            "chat": v.get("chat", {}),
            "recommendations": v.get("recommendations", {})
        }
        return result


class SettingsUpdate(BaseModel):
    auto_sync: bool | None = None
    reply_mode: str | None = Field(default=None, description="manual | semi | auto")
    auto_draft: bool | None = None
    auto_publish: bool | None = None

    # Limit for auto-drafting on each sync cycle. 0 = unlimited.
    auto_draft_limit_per_sync: int | None = Field(default=None, ge=0, le=5000)
    
    rating_mode_map: dict | None = None
    min_rating_to_autopublish: int | None = Field(default=None, ge=1, le=5)
    
    language: str | None = None
    tone: str | None = None
    signature: str | None = None
    signatures: list[str | SignatureItem] | None = None
    
    blacklist_keywords: list | None = None
    whitelist_keywords: list | None = None
    templates: dict | None = None
    
    chat_enabled: bool | None = None
    chat_auto_reply: bool | None = None
    
    questions_reply_mode: str | None = Field(default=None, description="manual | semi | auto")
    questions_auto_draft: bool | None = None
    questions_auto_publish: bool | None = None
    
    config: ConfigUpdate | None = None