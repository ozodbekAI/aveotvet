from __future__ import annotations

import random
import re

from app.models.question import Question
from app.models.settings import ShopSettings
from app.services.openai_client import OpenAIService
from app.core.config import settings


_MAX_LEN = 5000

PHONE_RE = re.compile(r"(\+?\d[\d\s\-()]{7,}\d)")
URL_RE = re.compile(r"(https?://\S+)", re.IGNORECASE)


def _pick_signature(shop_settings: ShopSettings) -> str | None:
    pool = shop_settings.signatures or []
    if isinstance(pool, list) and pool:
        strs = [s for s in pool if isinstance(s, str) and s.strip()]
        if strs:
            return random.choice(strs)
    return shop_settings.signature


def build_instructions(shop_settings: ShopSettings) -> str:
    lang = shop_settings.language
    tone = shop_settings.tone
    sig = _pick_signature(shop_settings)

    parts = [
        "You write short, polite marketplace replies to customer product questions.",
        "Output plain text only. No markdown. No links. No phone numbers. No emails.",
        "Keep it respectful, empathic, and professional.",
        "Do not mention that you are an AI.",
        f"Language: {lang}. Tone: {tone}.",
        f"Max length: {_MAX_LEN} characters.",
    ]
    if sig:
        parts.append(f"End with this signature (if appropriate): {sig}")
    return " ".join(parts)


def build_input(question: Question, shop_settings: ShopSettings) -> str:
    pd = question.product_details or {}
    product_name = pd.get("productName")
    brand = pd.get("brandName")
    nm_id = pd.get("nmId")
    supplier_article = pd.get("supplierArticle")

    template = (shop_settings.templates or {}).get("question")

    lines = [
        "Customer question data:",
        f"- Buyer name: {question.user_name}",
        f"- Text: {question.text}",
        f"- Product: {product_name} (brand={brand}, nmId={nm_id}, article={supplier_article})",
    ]
    if template:
        lines.append(f"Preferred reply template (question): {template}")
    return "\n".join([l for l in lines if l is not None])


def sanitize_output(text: str) -> str:
    t = (text or "").strip()
    t = URL_RE.sub("", t)
    t = PHONE_RE.sub("", t)
    t = re.sub(r"\n{3,}", "\n\n", t).strip()
    if len(t) > _MAX_LEN:
        t = t[:_MAX_LEN].rstrip()
    return t


async def generate_question_draft_text(
    openai: OpenAIService,
    question: Question,
    shop_settings: ShopSettings,
) -> tuple[str, str, str | None]:
    instructions = build_instructions(shop_settings)
    input_text = build_input(question, shop_settings)

    res = await openai.generate_text(
        model=settings.OPENAI_MODEL,
        instructions=instructions,
        input_text=input_text,
    )
    return sanitize_output(res.text), res.model, res.response_id
