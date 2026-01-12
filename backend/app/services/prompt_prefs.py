from __future__ import annotations

import random
from dataclasses import dataclass

from app.models.settings import ShopSettings


# UI "Tone of voice" options (see screenshots)
ToneKey = str


@dataclass(frozen=True)
class PromptPrefs:
    # Advanced settings
    address_format: str  # vy_caps | vy_lower | ty
    use_buyer_name: bool
    mention_product_name: bool
    answer_length: str  # short | default | long
    emoji_enabled: bool
    photo_reaction_enabled: bool
    delivery_method: str | None

    # Per bucket tone-of-voice
    tone_positive: ToneKey
    tone_neutral: ToneKey
    tone_negative: ToneKey
    tone_question: ToneKey

    # UI-only (still stored for parity)
    chat_confirm_send: bool
    chat_confirm_ai_insert: bool
    recommend_products: bool

    # Content controls
    stop_words: list[str]


DEFAULT_PREFS = PromptPrefs(
    address_format="vy_lower",
    use_buyer_name=False,
    mention_product_name=True,
    answer_length="default",
    emoji_enabled=False,
    photo_reaction_enabled=False,
    delivery_method=None,
    tone_positive="none",
    tone_neutral="none",
    tone_negative="none",
    tone_question="none",
    chat_confirm_send=True,
    chat_confirm_ai_insert=True,
    recommend_products=False,
    stop_words=[],
)


def load_prompt_prefs(s: ShopSettings) -> PromptPrefs:
    """Extract UI-like prompt preferences from ShopSettings.config.

    We keep everything in `config` to avoid migrations while remaining backward compatible.
    Expected JSON shape (recommended):

    {
      "advanced": {
        "address_format": "vy_caps"|"vy_lower"|"ty",
        "use_buyer_name": true,
        "mention_product_name": true,
        "answer_length": "short"|"default"|"long",
        "emoji_enabled": false,
        "photo_reaction_enabled": false,
        "delivery_method": "..."|null,
        "tone_of_voice": {
          "positive": "friendly"|"business"|...|"none",
          "neutral":  "...",
          "negative": "...",
          "question": "..."
        },
        "stop_words": ["..."]
      },
      "chat": {"confirm_send": true, "confirm_ai_insert": true},
      "recommendations": {"enabled": false}
    }
    """

    cfg = s.config or {}
    adv = cfg.get("advanced") if isinstance(cfg, dict) else None
    adv = adv if isinstance(adv, dict) else {}

    tov = adv.get("tone_of_voice")
    tov = tov if isinstance(tov, dict) else {}

    chat = cfg.get("chat") if isinstance(cfg, dict) else None
    chat = chat if isinstance(chat, dict) else {}

    rec = cfg.get("recommendations") if isinstance(cfg, dict) else None
    rec = rec if isinstance(rec, dict) else {}

    stop_words = adv.get("stop_words")
    if not isinstance(stop_words, list):
        stop_words = []
    stop_words = [str(x) for x in stop_words if isinstance(x, str) and x.strip()]

    def _get_bool(d: dict, k: str, default: bool) -> bool:
        v = d.get(k)
        return v if isinstance(v, bool) else default

    def _get_str(d: dict, k: str, default: str) -> str:
        v = d.get(k)
        return v if isinstance(v, str) and v.strip() else default

    # Dynamic codes (not restricted to an enum). Super-admin defines the mapping.
    address_format = _get_str(adv, "address_format", DEFAULT_PREFS.address_format).strip().lower()[:64]
    answer_length = _get_str(adv, "answer_length", DEFAULT_PREFS.answer_length).strip().lower()[:64]

    delivery_method = adv.get("delivery_method")
    if not (isinstance(delivery_method, str) and delivery_method.strip()):
        delivery_method = None

    def _tone(key: str, default: str = "none") -> str:
        v = tov.get(key)
        return v if isinstance(v, str) and v.strip() else default

    return PromptPrefs(
        address_format=address_format,
        use_buyer_name=_get_bool(adv, "use_buyer_name", DEFAULT_PREFS.use_buyer_name),
        mention_product_name=_get_bool(adv, "mention_product_name", DEFAULT_PREFS.mention_product_name),
        answer_length=answer_length,
        emoji_enabled=_get_bool(adv, "emoji_enabled", DEFAULT_PREFS.emoji_enabled),
        photo_reaction_enabled=_get_bool(adv, "photo_reaction_enabled", DEFAULT_PREFS.photo_reaction_enabled),
        delivery_method=delivery_method,
        tone_positive=_tone("positive"),
        tone_neutral=_tone("neutral"),
        tone_negative=_tone("negative"),
        tone_question=_tone("question"),
        chat_confirm_send=_get_bool(chat, "confirm_send", DEFAULT_PREFS.chat_confirm_send),
        chat_confirm_ai_insert=_get_bool(chat, "confirm_ai_insert", DEFAULT_PREFS.chat_confirm_ai_insert),
        recommend_products=_get_bool(rec, "enabled", DEFAULT_PREFS.recommend_products),
        stop_words=stop_words,
    )


def tone_instruction(tone_key: str) -> str | None:
    """Map UI tone key -> short natural-language instruction.

    We keep this deliberately short; the worker already has additional guardrails.
    """

    key = (tone_key or "").strip().lower()
    if not key or key in ("none", "без тональности", "no", "off"):
        return None

    mapping: dict[str, str] = {
        "business": "Business tone: formal, concise, without slang.",
        "деловая": "Business tone: formal, concise, without slang.",

        "joking": "Light, appropriate humor if it does not undermine the situation.",
        "шутливая": "Light, appropriate humor if it does not undermine the situation.",

        "serious": "Serious tone: focus on facts, apologies, and next steps; avoid jokes.",
        "серьёзная": "Serious tone: focus on facts, apologies, and next steps; avoid jokes.",
        "серьезная": "Serious tone: focus on facts, apologies, and next steps; avoid jokes.",

        "encouraging": "Encouraging tone: reassure the customer and offer help.",
        "ободряющая": "Encouraging tone: reassure the customer and offer help.",

        "caring": "Caring tone: warm, empathic, service-oriented.",
        "заботливая": "Caring tone: warm, empathic, service-oriented.",

        "cheerful": "Cheerful tone: friendly, upbeat, but still professional.",
        "весёлая": "Cheerful tone: friendly, upbeat, but still professional.",
        "веселая": "Cheerful tone: friendly, upbeat, but still professional.",

        "friendly": "Friendly tone: personable and approachable.",
        "дружелюбная": "Friendly tone: personable and approachable.",

        "chatty": "Conversational tone: slightly more talkative, but keep it readable.",
        "болтливая": "Conversational tone: slightly more talkative, but keep it readable.",

        "respectful": "Respectful tone: neutral, polite, and tactful.",
        "уважительная": "Respectful tone: neutral, polite, and tactful.",

        "poetic": "Poetic tone: mild metaphors are allowed, but keep the meaning clear.",
        "поэтическая": "Poetic tone: mild metaphors are allowed, but keep the meaning clear.",

        "dramatic": "Dramatic tone: expressive, but not exaggerated.",
        "драматическая": "Dramatic tone: expressive, but not exaggerated.",

        "scientific": "Scientific tone: factual, structured, and precise.",
        "научная": "Scientific tone: factual, structured, and precise.",
    }
    return mapping.get(key) or f"Tone of voice: {tone_key}."


def pick_signature(
    s: ShopSettings,
    *,
    kind: str,
    brand: str | None = None,
) -> str | None:

    pool = s.signatures or []
    candidates: list[str] = []
    kind_l = (kind or "").strip().lower()
    brand_l = (brand or "").strip().lower() or None

    if isinstance(pool, list):
        for item in pool:
            if isinstance(item, str) and item.strip():
                candidates.append(item.strip())
                continue
            if isinstance(item, dict):
                text = item.get("text")
                if not (isinstance(text, str) and text.strip()):
                    continue
                tp = item.get("type")
                tp = tp.strip().lower() if isinstance(tp, str) else "all"
                if tp not in ("all", kind_l):
                    continue
                b = item.get("brand")
                b = b.strip().lower() if isinstance(b, str) and b.strip() else "all"
                if b != "all" and brand_l and b != brand_l:
                    continue
                # if signature is brand-specific but we don't know brand -> skip
                if b != "all" and not brand_l:
                    continue
                candidates.append(text.strip())

    if candidates:
        return random.choice(candidates)
    return s.signature
