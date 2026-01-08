from __future__ import annotations

import re
import random

from app.models.feedback import Feedback
from app.models.settings import ShopSettings
from app.services.openai_client import OpenAIService
from app.core.config import settings


_MAX_LEN = 5000

PHONE_RE = re.compile(r"(\+?\d[\d\s\-()]{7,}\d)")
URL_RE = re.compile(r"(https?://\S+)", re.IGNORECASE)


def _bucket_by_rating(rating: int | None) -> str:
    r = rating or 0
    if r <= 2:
        return "negative"
    if r == 3:
        return "neutral"
    return "positive"


def build_instructions(shop_settings: ShopSettings) -> str:
    lang = shop_settings.language
    tone = shop_settings.tone
    sig = None
    pool = shop_settings.signatures or []
    if isinstance(pool, list) and pool:
        try:
            sig = random.choice([s for s in pool if isinstance(s, str) and s.strip()])
        except Exception:
            sig = None
    if not sig:
        sig = shop_settings.signature

    parts = [
        "You write short, polite marketplace replies to customer feedback.",
        "Output plain text only. No markdown. No links. No phone numbers. No emails.",
        "Keep it respectful, empathic, and professional.",
        "Do not mention that you are an AI.",
        f"Language: {lang}. Tone: {tone}.",
        f"Max length: {_MAX_LEN} characters.",
    ]
    if sig:
        parts.append(f"End with this signature (if appropriate): {sig}")
    return " ".join(parts)


def build_input(feedback: Feedback, shop_settings: ShopSettings) -> str:
    pd = feedback.product_details or {}
    product_name = pd.get("productName")
    brand = pd.get("brandName")
    nm_id = pd.get("nmId")
    supplier_article = pd.get("supplierArticle")

    bucket = _bucket_by_rating(feedback.product_valuation)
    template = (shop_settings.templates or {}).get(bucket)

    lines = [
        "Customer feedback data:",
        f"- Rating: {feedback.product_valuation}",
        f"- Buyer name: {feedback.user_name}",
        f"- Text: {feedback.text}",
        f"- Pros: {feedback.pros}",
        f"- Cons: {feedback.cons}",
        f"- Product: {product_name} (brand={brand}, nmId={nm_id}, article={supplier_article})",
    ]
    if template:
        lines.append(f"Preferred reply template for this rating bucket ({bucket}): {template}")
    return "\n".join([l for l in lines if l is not None])


def sanitize_output(text: str) -> str:
    t = (text or "").strip()
    t = URL_RE.sub("", t)
    t = PHONE_RE.sub("", t)
    t = re.sub(r"\n{3,}", "\n\n", t).strip()
    if len(t) > _MAX_LEN:
        t = t[:_MAX_LEN].rstrip()
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


async def generate_draft_text(openai: OpenAIService, feedback: Feedback, shop_settings: ShopSettings) -> tuple[str, str, str | None]:
    instructions = build_instructions(shop_settings)
    input_text = build_input(feedback, shop_settings)

    res = await openai.generate_text(
        model=settings.OPENAI_MODEL,
        instructions=instructions,
        input_text=input_text,
    )
    return sanitize_output(res.text), res.model, res.response_id
