from __future__ import annotations

import re
import random

from app.models.feedback import Feedback
from app.models.settings import ShopSettings
from app.services.openai_client import OpenAIService
from app.core.config import settings
from app.services.prompt_prefs import load_prompt_prefs, tone_instruction, pick_signature
from app.services.prompt_store import PromptBundle, render_template, DEFAULT_REVIEW_INSTRUCTIONS_TEMPLATE


_MAX_LEN_HARD = 5000

PHONE_RE = re.compile(r"(\+?\d[\d\s\-()]{7,}\d)")
URL_RE = re.compile(r"(https?://\S+)", re.IGNORECASE)


def _bucket_by_rating(rating: int | None) -> str:
    r = rating or 0
    if r <= 2:
        return "negative"
    if r == 3:
        return "neutral"
    return "positive"


def build_instructions(
    shop_settings: ShopSettings,
    bundle: PromptBundle | None = None,
    *,
    brand: str | None = None,
) -> str:
    prefs = load_prompt_prefs(shop_settings)
    lang = shop_settings.language
    base_tone = shop_settings.tone

    sig = pick_signature(shop_settings, kind="review", brand=brand)

    if prefs.address_format == "vy_caps":
        addr_rule = "Use polite address with capitalized 'Вы/Ваш/Вам'."
    elif prefs.address_format == "ty":
        addr_rule = "Use informal address 'ты/твой'."
    else:
        addr_rule = "Use polite address 'вы/ваш/вам' (lowercase)."

    if prefs.answer_length == "short":
        length_rule = "Keep it short (1-2 sentences)."
    elif prefs.answer_length == "long":
        length_rule = "Allow a longer answer if needed (up to ~5 sentences)."
    else:
        length_rule = "Answer length: default."

    emoji_rule = "Emojis: allowed (1-2 max) if appropriate." if prefs.emoji_enabled else "Emojis: disabled."

    stop_words_rule = ""
    if prefs.stop_words:
        stop_words_rule = "Avoid these words/phrases: " + ", ".join(prefs.stop_words)

    signature_rule = f"End with this signature (if appropriate): {sig}" if sig else ""

    template = (bundle.review_instructions_template if bundle else DEFAULT_REVIEW_INSTRUCTIONS_TEMPLATE)
    return render_template(
        template,
        {
            "addr_rule": addr_rule,
            "length_rule": length_rule,
            "emoji_rule": emoji_rule,
            "language": lang,
            "tone": base_tone,
            "hard_max_len": _MAX_LEN_HARD,
            "stop_words_rule": stop_words_rule,
            "signature_rule": signature_rule,
        },
    )


def build_input(feedback: Feedback, shop_settings: ShopSettings, bundle: PromptBundle | None = None) -> str:
    prefs = load_prompt_prefs(shop_settings)
    pd = feedback.product_details or {}
    product_name = pd.get("productName") if prefs.mention_product_name else None
    brand = pd.get("brandName")
    nm_id = pd.get("nmId")
    supplier_article = pd.get("supplierArticle")

    bucket = _bucket_by_rating(feedback.product_valuation)
    template = (shop_settings.templates or {}).get(bucket)

    tone_key = {
        "positive": prefs.tone_positive,
        "neutral": prefs.tone_neutral,
        "negative": prefs.tone_negative,
    }.get(bucket, "none")
    tone_note = None
    if bundle and isinstance(getattr(bundle, "tone_map", None), dict):
        tone_note = (bundle.tone_map.get(tone_key) or "").strip() or None
    if not tone_note:
        tone_note = tone_instruction(tone_key)

    buyer_name = feedback.user_name if prefs.use_buyer_name else None

    lines = [
        "Customer feedback data:",
        f"- Rating: {feedback.product_valuation}",
        f"- Buyer name: {buyer_name}",
        f"- Text: {feedback.text}",
        f"- Pros: {feedback.pros}",
        f"- Cons: {feedback.cons}",
        f"- Product: {product_name} (brand={brand}, nmId={nm_id}, article={supplier_article})" if product_name else f"- Product: (brand={brand}, nmId={nm_id}, article={supplier_article})",
    ]
    if prefs.photo_reaction_enabled and (feedback.photo_links or feedback.video):
        lines.append("- Customer attached photos/video: yes. Please thank the customer for the media if appropriate.")
    if template:
        lines.append(f"Preferred reply template for this rating bucket ({bucket}): {template}")
    if prefs.delivery_method:
        lines.append(f"- Delivery method selected in shop settings: {prefs.delivery_method}")
    if tone_note:
        lines.append(f"- Style requirement (tone of voice): {tone_note}")
    return "\n".join([l for l in lines if l is not None])


def sanitize_output(text: str) -> str:
    t = (text or "").strip()
    t = URL_RE.sub("", t)
    t = PHONE_RE.sub("", t)
    t = re.sub(r"\n{3,}", "\n\n", t).strip()
    if len(t) > _MAX_LEN_HARD:
        t = t[:_MAX_LEN_HARD].rstrip()
    return t


def contains_blacklist(feedback: Feedback, shop_settings: ShopSettings) -> bool:
    bl = shop_settings.blacklist_keywords or []
    hay = " ".join([feedback.text or "", feedback.pros or "", feedback.cons or ""]).lower()
    for kw in bl:
        if isinstance(kw, str) and kw.strip() and kw.lower() in hay:
            return True
    return False


def effective_mode_for_rating(shop_settings: ShopSettings, rating: int | None) -> str:
    base = shop_settings.reply_mode or "semi"
    mp = shop_settings.rating_mode_map or {}
    key = str(int(rating)) if rating is not None else "0"
    v = mp.get(key)
    if v in ("manual", "semi", "auto"):
        return v
    return base


async def generate_draft_text(openai: OpenAIService, feedback: Feedback, shop_settings: ShopSettings, bundle: PromptBundle | None = None) -> tuple[str, str, str | None]:
    pd = feedback.product_details or {}
    brand = pd.get("brandName")
    brand = brand.strip() if isinstance(brand, str) and brand.strip() else None

    instructions = build_instructions(shop_settings, bundle=bundle, brand=brand)
    input_text = build_input(feedback, shop_settings, bundle=bundle)

    res = await openai.generate_text(
        model=settings.OPENAI_MODEL,
        instructions=instructions,
        input_text=input_text,
    )
    return sanitize_output(res.text), res.model, res.response_id
