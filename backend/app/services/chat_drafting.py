from __future__ import annotations

import re

from app.models.settings import ShopSettings
from app.services.openai_client import OpenAIService
from app.core.config import settings
from app.services.prompt_prefs import load_prompt_prefs
from app.services.prompt_store import PromptBundle, render_template, DEFAULT_CHAT_INSTRUCTIONS_TEMPLATE


_MAX_LEN_HARD = 1500

PHONE_RE = re.compile(r"(\+?\d[\d\s\-()]{7,}\d)")
URL_RE = re.compile(r"(https?://\S+)", re.IGNORECASE)


def build_chat_instructions(shop_settings: ShopSettings, bundle: PromptBundle | None = None) -> str:
    prefs = load_prompt_prefs(shop_settings)
    lang = shop_settings.language
    tone = shop_settings.tone

    addr_rule = None
    if bundle and isinstance(getattr(bundle, "address_format_map", None), dict):
        addr_rule = (bundle.address_format_map.get(prefs.address_format) or "").strip() or None
    if not addr_rule:
        if prefs.address_format == "vy_caps":
            addr_rule = "Use polite address with capitalized 'Вы/Ваш/Вам'."
        elif prefs.address_format == "ty":
            addr_rule = "Use informal address 'ты/твой'."
        else:
            addr_rule = "Use polite address 'вы/ваш/вам' (lowercase)."

    # Chat emoji policy is a bit stricter (1 max) but still configurable via global map.
    if bundle and isinstance(getattr(bundle, "emoji_rule_map", None), dict):
        emoji_rule = (bundle.emoji_rule_map.get("on" if prefs.emoji_enabled else "off") or "").strip()
        emoji_rule = emoji_rule or ("Emojis: allowed (1 max) if appropriate." if prefs.emoji_enabled else "Emojis: disabled.")
    else:
        emoji_rule = "Emojis: allowed (1 max) if appropriate." if prefs.emoji_enabled else "Emojis: disabled."

    stop_words_rule = ""
    if prefs.stop_words:
        stop_words_rule = "Avoid these words/phrases: " + ", ".join(prefs.stop_words)

    template = (bundle.chat_instructions_template if bundle else DEFAULT_CHAT_INSTRUCTIONS_TEMPLATE)
    return render_template(
        template,
        {
            "language": lang,
            "tone": tone,
            "hard_max_len": _MAX_LEN_HARD,
            "addr_rule": addr_rule,
            "emoji_rule": emoji_rule,
            "stop_words_rule": stop_words_rule,
        },
    )


def sanitize(text: str) -> str:
    t = (text or "").strip()
    t = URL_RE.sub("", t)
    t = PHONE_RE.sub("", t)
    if len(t) > _MAX_LEN_HARD:
        t = t[:_MAX_LEN_HARD].rstrip()
    return t


async def generate_chat_reply(
    openai: OpenAIService,
    shop_settings: ShopSettings,
    last_buyer_message: str,
    context: dict | None = None,
    bundle: PromptBundle | None = None,
) -> tuple[str, str, str | None]:
    instructions = build_chat_instructions(shop_settings, bundle=bundle)

    ctx_lines: list[str] = []
    if context:
        # Keep it short — the chat model input must be compact.
        gd = context.get("goodCard") if isinstance(context, dict) else None
        if isinstance(gd, dict):
            ctx_lines.append(
                f"Product context: nmID={gd.get('nmID')} size={gd.get('size')} price={gd.get('price')} {gd.get('priceCurrency')}"
            )

    input_text = "\n".join(["Buyer message:", last_buyer_message] + ([""] + ctx_lines if ctx_lines else []))

    res = await openai.generate_text(model=settings.OPENAI_MODEL, instructions=instructions, input_text=input_text)
    return sanitize(res.text), res.model, res.response_id
