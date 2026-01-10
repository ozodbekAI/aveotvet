from __future__ import annotations

import re

from app.models.question import Question
from app.models.settings import ShopSettings
from app.services.openai_client import OpenAIService
from app.core.config import settings
from app.services.prompt_prefs import load_prompt_prefs, tone_instruction, pick_signature


_MAX_LEN_HARD = 5000

PHONE_RE = re.compile(r"(\+?\d[\d\s\-()]{7,}\d)")
URL_RE = re.compile(r"(https?://\S+)", re.IGNORECASE)


def build_instructions(shop_settings: ShopSettings) -> str:
    prefs = load_prompt_prefs(shop_settings)
    lang = shop_settings.language
    base_tone = shop_settings.tone
    sig = pick_signature(shop_settings, kind="question")

    # Address format
    if prefs.address_format == "vy_caps":
        addr = "Use polite address with capitalized 'Вы/Ваш/Вам'."
    elif prefs.address_format == "ty":
        addr = "Use informal address 'ты/твой'."
    else:
        addr = "Use polite address 'вы/ваш/вам' (lowercase)."

    # Length preference
    if prefs.answer_length == "short":
        length_pref = "Prefer short replies (1-2 short paragraphs)."
    elif prefs.answer_length == "long":
        length_pref = "Prefer detailed replies (2-4 short paragraphs), but avoid unnecessary fluff."
    else:
        length_pref = "Prefer medium-length replies (1-3 short paragraphs)."

    emoji_rule = "Do not use emojis." if not prefs.emoji_enabled else "You may use at most 1 relevant emoji if it feels natural."

    stop_words_rule = ""
    if prefs.stop_words:
        stop_words_rule = "Avoid using these words/phrases: " + ", ".join(prefs.stop_words[:30])

    parts = [
        "You write short, polite marketplace replies to customer product questions.",
        "Output plain text only. No markdown. No links. No phone numbers. No emails.",
        "Keep it respectful, empathic, and professional.",
        "Do not mention that you are an AI.",
        addr,
        length_pref,
        emoji_rule,
        f"Language: {lang}. Base tone: {base_tone}.",
        f"Hard max length: {_MAX_LEN_HARD} characters.",
    ]
    if stop_words_rule:
        parts.append(stop_words_rule)
    if sig:
        parts.append(f"End with this signature (if appropriate): {sig}")
    return " ".join(parts)


def build_input(question: Question, shop_settings: ShopSettings) -> str:
    prefs = load_prompt_prefs(shop_settings)
    pd = question.product_details or {}
    product_name = pd.get("productName") if prefs.mention_product_name else None
    brand = pd.get("brandName")
    nm_id = pd.get("nmId")
    supplier_article = pd.get("supplierArticle")

    template = (shop_settings.templates or {}).get("question")

    tone_note = tone_instruction(prefs.tone_question)
    buyer_name = question.user_name if prefs.use_buyer_name else None

    lines = [
        "Customer question data:",
        f"- Buyer name: {buyer_name}",
        f"- Text: {question.text}",
        f"- Product: {product_name} (brand={brand}, nmId={nm_id}, article={supplier_article})" if product_name else f"- Product: (brand={brand}, nmId={nm_id}, article={supplier_article})",
    ]
    if prefs.delivery_method:
        lines.append(f"- Delivery method selected in shop settings: {prefs.delivery_method}")
    if tone_note:
        lines.append(f"- Style requirement (tone of voice): {tone_note}")
    if template:
        lines.append(f"Preferred reply template (question): {template}")
    return "\n".join([l for l in lines if l is not None])


def sanitize_output(text: str) -> str:
    t = (text or "").strip()
    t = URL_RE.sub("", t)
    t = PHONE_RE.sub("", t)
    t = re.sub(r"\n{3,}", "\n\n", t).strip()
    if len(t) > _MAX_LEN_HARD:
        t = t[:_MAX_LEN_HARD].rstrip()
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
