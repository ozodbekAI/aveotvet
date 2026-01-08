from __future__ import annotations

import re

from app.models.settings import ShopSettings
from app.services.openai_client import OpenAIService
from app.core.config import settings

_MAX_LEN = 1500

PHONE_RE = re.compile(r"(\+?\d[\d\s\-()]{7,}\d)")
URL_RE = re.compile(r"(https?://\S+)", re.IGNORECASE)


def build_chat_instructions(shop_settings: ShopSettings) -> str:
    parts = [
        "You write short, helpful seller replies in a marketplace buyer chat.",
        "Output plain text only. No markdown. No links. No phone numbers. No emails.",
        "Be concise and clear. Ask clarifying questions only if required.",
        f"Language: {shop_settings.language}. Tone: {shop_settings.tone}.",
        f"Max length: {_MAX_LEN} characters.",
    ]
    return " ".join(parts)


def sanitize(text: str) -> str:
    t = (text or "").strip()
    t = URL_RE.sub("", t)
    t = PHONE_RE.sub("", t)
    if len(t) > _MAX_LEN:
        t = t[:_MAX_LEN].rstrip()
    return t


async def generate_chat_reply(openai: OpenAIService, shop_settings: ShopSettings, last_buyer_message: str, context: dict | None = None) -> tuple[str, str, str | None]:
    instructions = build_chat_instructions(shop_settings)
    ctx_lines = []
    if context:
        # keep light
        gd = context.get("goodCard")
        if gd:
            ctx_lines.append(f"Product context: nmID={gd.get('nmID')} size={gd.get('size')} price={gd.get('price')} {gd.get('priceCurrency')}")
    input_text = "\n".join(["Buyer message:", last_buyer_message] + ([""] + ctx_lines if ctx_lines else []))

    res = await openai.generate_text(model=settings.OPENAI_MODEL, instructions=instructions, input_text=input_text)
    return sanitize(res.text), res.model, res.response_id
