from __future__ import annotations

from pydantic import BaseModel, Field, field_validator
from typing import Literal


class ToneOfVoiceConfig(BaseModel):
    """Tone of voice settings per feedback type."""
    positive: str | None = Field(default=None, description="Tone for positive reviews")
    neutral: str | None = Field(default=None, description="Tone for neutral reviews")
    negative: str | None = Field(default=None, description="Tone for negative reviews")
    question: str | None = Field(default=None, description="Tone for questions")


class AdvancedConfig(BaseModel):
    """Advanced prompt configuration."""
    address_format: Literal["vy_caps", "vy_lower", "ty"] | None = Field(
        default=None,
        description="How to address customers: vy_caps (Вы), vy_lower (вы), ty (ты)"
    )
    use_buyer_name: bool | None = Field(default=None, description="Include buyer's name in response")
    mention_product_name: bool | None = Field(default=None, description="Mention product name in response")
    answer_length: Literal["short", "default", "long"] | None = Field(
        default=None,
        description="Preferred response length"
    )
    emoji_enabled: bool | None = Field(default=None, description="Allow emojis in responses")
    photo_reaction_enabled: bool | None = Field(
        default=None,
        description="Thank customers for photos/videos"
    )
    delivery_method: str | None = Field(default=None, description="Delivery method to mention")
    tone_of_voice: ToneOfVoiceConfig | None = Field(default=None, description="Tone settings per type")
    stop_words: list[str] | None = Field(default=None, description="Words/phrases to avoid")

    @staticmethod
    def _coerce_bool(v):
        if v is None:
            return None
        if isinstance(v, bool):
            return v
        if isinstance(v, int) and v in (0, 1):
            return bool(v)
        if isinstance(v, str):
            s = v.strip().lower()
            if s in ("true", "1", "yes", "y", "on"):
                return True
            if s in ("false", "0", "no", "n", "off"):
                return False
        return v

    @field_validator("use_buyer_name", "mention_product_name", "emoji_enabled", "photo_reaction_enabled", mode="before")
    @classmethod
    def normalize_bool_fields(cls, v):
        vv = cls._coerce_bool(v)
        # If still not bool/None, keep original so pydantic raises a clear error.
        return vv

    @field_validator("address_format", mode="before")
    @classmethod
    def normalize_address_format(cls, v):
        """Accept legacy/loose values and normalize.

        Allowed canonical values:
          - vy_caps
          - vy_lower
          - ty

        Legacy values observed in older frontends/DB:
          - vy
          - vyCaps / VY_CAPS / vy-caps
          - localized labels ("вы", "ты")
          - objects like { value: "vy_caps" }
        """
        if v is None:
            return None

        if isinstance(v, dict) and "value" in v:
            v = v.get("value")

        if isinstance(v, str):
            s = v.strip().lower()
            aliases = {
                "vy": "vy_caps",
                "vycaps": "vy_caps",
                "vy-caps": "vy_caps",
                "vy_upper": "vy_caps",
                "vyupper": "vy_caps",
                "vy_cap": "vy_caps",
                "vylower": "vy_lower",
                "vy-lower": "vy_lower",
                "vy_lowercase": "vy_lower",
                "вы": "vy_lower",
                "ты": "ty",
            }
            s = aliases.get(s, s)
            if s in ("vy_caps", "vy_lower", "ty"):
                return s

        raise ValueError("address_format must be one of: vy_caps, vy_lower, ty")

    @field_validator("stop_words")
    @classmethod
    def validate_stop_words(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        return [word.strip()[:100] for word in v if isinstance(word, str) and word.strip()]


class ChatConfig(BaseModel):
    """Chat-related settings."""
    confirm_send: bool | None = Field(default=None, description="Show confirmation before sending")
    confirm_ai_insert: bool | None = Field(
        default=None,
        description="Show confirmation before inserting AI response"
    )

    @field_validator("confirm_send", "confirm_ai_insert", mode="before")
    @classmethod
    def normalize_chat_bools(cls, v):
        return AdvancedConfig._coerce_bool(v)


class RecommendationsConfig(BaseModel):
    """Product recommendations settings."""
    enabled: bool | None = Field(default=None, description="Enable product recommendations")

    @field_validator("enabled", mode="before")
    @classmethod
    def normalize_enabled(cls, v):
        return AdvancedConfig._coerce_bool(v)


class ConfigUpdate(BaseModel):
    """Full config structure for updates."""
    advanced: AdvancedConfig | None = None
    chat: ChatConfig | None = None
    recommendations: RecommendationsConfig | None = None


class ConfigResponse(BaseModel):
    """Full config structure for responses."""
    advanced: AdvancedConfig = Field(default_factory=AdvancedConfig)
    chat: ChatConfig = Field(default_factory=ChatConfig)
    recommendations: RecommendationsConfig = Field(default_factory=RecommendationsConfig)