from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.repos.prompt_repo import PromptRepo
from app.repos.tone_repo import ToneRepo


DEFAULT_TONE_OPTIONS = [
    {
        "value": "none",
        "label": "Без тональности",
        "hint": "Настройка по умолчанию. Тональность отключена.",
        "example": "Спасибо за отзыв!",
    },
    {
        "value": "business",
        "label": "Деловая",
        "hint": "Официальный стиль ответа.",
        "example": "Благодарим за обратную связь. Мы ценим ваше мнение.",
    },
    {
        "value": "friendly",
        "label": "Дружелюбная",
        "hint": "Тёплый и доброжелательный тон.",
        "example": "Спасибо за отзыв! Очень рады, что вам понравилось 😊",
    },
    {
        "value": "joking",
        "label": "Шутливая",
        "hint": "Лёгкая шутка допустима, но без фамильярности.",
        "example": "Спасибо! Будем стараться не только радовать, но и удивлять 😉",
    },
    {
        "value": "serious",
        "label": "Серьёзная",
        "hint": "Строго и по делу.",
        "example": "Спасибо за отзыв. Учтём замечания и улучшим качество.",
    },
    {
        "value": "empathetic",
        "label": "Эмпатичная",
        "hint": "С сочувствием, акцент на понимание клиента.",
        "example": "Спасибо, что написали. Нам очень жаль, что возникла ситуация — мы разберёмся.",
    },
]

DEFAULT_TONE_MAP = {
    "none": "",
    "business": "Business tone. Formal, concise, no slang.",
    "friendly": "Friendly tone. Warm, polite, positive. No slang.",
    "joking": "Light joking tone. One gentle joke max. Still polite and professional.",
    "serious": "Serious tone. Strictly factual, no jokes, no emojis.",
    "empathetic": "Empathetic tone. Show understanding, apologize if appropriate, offer help.",
}


# Dynamic UI options (super-admin editable)
DEFAULT_ADDRESS_FORMAT_OPTIONS = [
    {"value": "vy_caps", "label": "Вы (с заглавной)", "hint": "Обращаться на ‘Вы/Ваш/Вам’ с заглавной буквы."},
    {"value": "vy_lower", "label": "вы (со строчной)", "hint": "Обращаться на ‘вы/ваш/вам’ со строчной буквы."},
    {"value": "ty", "label": "ты", "hint": "Неформальное обращение ‘ты/твой’."},
]

DEFAULT_ADDRESS_FORMAT_MAP = {
    "vy_caps": "Use polite address with capitalized 'Вы/Ваш/Вам'.",
    "vy_lower": "Use polite address 'вы/ваш/вам' (lowercase).",
    "ty": "Use informal address 'ты/твой'.",
}

DEFAULT_ANSWER_LENGTH_OPTIONS = [
    {"value": "short", "label": "Короткий", "hint": "1–2 предложения."},
    {"value": "default", "label": "Обычный", "hint": "Стандартная длина."},
    {"value": "long", "label": "Развернутый", "hint": "До ~5 предложений при необходимости."},
]

DEFAULT_ANSWER_LENGTH_MAP = {
    "short": "Keep it short (1-2 sentences).",
    "default": "Answer length: default.",
    "long": "Allow a longer answer if needed (up to ~5 sentences).",
}

DEFAULT_EMOJI_RULE_MAP = {
    # We keep this map small; UI controls the boolean and we choose on/off rule.
    "on": "Emojis: allowed (1-2 max) if appropriate.",
    "off": "Emojis: disabled.",
}

DEFAULT_REVIEW_INSTRUCTIONS_TEMPLATE = (
    "You write marketplace seller replies to customer reviews. "
    "Output plain text only. No markdown. No links. No phone numbers. No emails. "
    "Do not mention that you are an AI. "
    "{addr_rule} {length_rule} {emoji_rule} "
    "Language: {language}. Base tone: {tone}. "
    "Hard max length: {hard_max_len} characters. "
    "{stop_words_rule} {signature_rule}"
).strip()

DEFAULT_QUESTION_INSTRUCTIONS_TEMPLATE = (
    "You write marketplace seller replies to customer questions. "
    "Output plain text only. No markdown. No links. No phone numbers. No emails. "
    "Do not mention that you are an AI. "
    "{addr_rule} {length_rule} {emoji_rule} "
    "Language: {language}. Base tone: {tone}. "
    "Hard max length: {hard_max_len} characters. "
    "{stop_words_rule} {signature_rule}"
).strip()

DEFAULT_CHAT_INSTRUCTIONS_TEMPLATE = (
    "You write short, helpful seller replies in a marketplace buyer chat. "
    "Output plain text only. No markdown. No links. No phone numbers. No emails. "
    "Be concise and clear. Ask clarifying questions only if required. "
    "{addr_rule} {emoji_rule} "
    "{stop_words_rule} "
    "Language: {language}. Tone: {tone}. "
    "Max length: {hard_max_len} characters."
).strip()


@dataclass(frozen=True)
class PromptBundle:
    review_instructions_template: str
    question_instructions_template: str
    chat_instructions_template: str
    tone_map: dict[str, str]
    tone_options: list[dict[str, Any]]

    address_format_map: dict[str, str]
    address_format_options: list[dict[str, Any]]

    answer_length_map: dict[str, str]
    answer_length_options: list[dict[str, Any]]

    emoji_rule_map: dict[str, str]

    def as_dict(self) -> dict[str, Any]:
        return {
            "review_instructions_template": self.review_instructions_template,
            "question_instructions_template": self.question_instructions_template,
            "chat_instructions_template": self.chat_instructions_template,
            "tone_map": self.tone_map,
            "tone_options": self.tone_options,

            "address_format_map": self.address_format_map,
            "address_format_options": self.address_format_options,
            "answer_length_map": self.answer_length_map,
            "answer_length_options": self.answer_length_options,
            "emoji_rule_map": self.emoji_rule_map,
        }


async def get_global_bundle(session: AsyncSession) -> PromptBundle:
    repo = PromptRepo(session)

    def _text(key: str, default: str) -> str:
        # fallback to default if missing or empty
        return default

    # read records (avoid 5 queries by listing once)
    recs = await repo.list_scope("global")
    by_key = {r.key: r for r in recs}

    def get_text(key: str, default: str) -> str:
        r = by_key.get(key)
        v = (r.value_text if r else None) if r else None
        if isinstance(v, str) and v.strip():
            return v
        return default

    def get_json(key: str, default):
        r = by_key.get(key)
        v = (r.value_json if r else None) if r else None
        return v if isinstance(v, (dict, list)) else default

    # Prefer tones from dedicated table. If no tones are configured yet,
    # fallback to prompt_records JSON (backward compatible), then defaults.
    try:
        tones = await ToneRepo(session).list_active()
    except Exception:
        # DB might not have the tones table yet (migrations not applied)
        tones = []
    if tones:
        tone_options = [
            {"value": t.code, "label": t.label, "hint": t.hint, "example": getattr(t, "example", None)}
            for t in tones
        ]
        tone_map = {t.code: (t.instruction or "") for t in tones}
    else:
        tone_map = get_json("tone_map", DEFAULT_TONE_MAP)
        tone_options = get_json("tone_options", DEFAULT_TONE_OPTIONS)

    # address / length / emoji maps and options
    address_format_map = get_json("address_format_map", DEFAULT_ADDRESS_FORMAT_MAP)
    address_format_options = get_json("address_format_options", DEFAULT_ADDRESS_FORMAT_OPTIONS)
    answer_length_map = get_json("answer_length_map", DEFAULT_ANSWER_LENGTH_MAP)
    answer_length_options = get_json("answer_length_options", DEFAULT_ANSWER_LENGTH_OPTIONS)
    emoji_rule_map = get_json("emoji_rule_map", DEFAULT_EMOJI_RULE_MAP)

    return PromptBundle(
        review_instructions_template=get_text("review_instructions_template", DEFAULT_REVIEW_INSTRUCTIONS_TEMPLATE),
        question_instructions_template=get_text("question_instructions_template", DEFAULT_QUESTION_INSTRUCTIONS_TEMPLATE),
        chat_instructions_template=get_text("chat_instructions_template", DEFAULT_CHAT_INSTRUCTIONS_TEMPLATE),
        tone_map=tone_map,
        tone_options=tone_options,

        address_format_map=address_format_map,
        address_format_options=address_format_options,
        answer_length_map=answer_length_map,
        answer_length_options=answer_length_options,
        emoji_rule_map=emoji_rule_map,
    )


async def set_global_bundle(session: AsyncSession, payload: dict) -> PromptBundle:
    repo = PromptRepo(session)

    # text fields
    if "review_instructions_template" in payload:
        await repo.set_text(scope="global", key="review_instructions_template", value_text=payload.get("review_instructions_template"))
    if "question_instructions_template" in payload:
        await repo.set_text(scope="global", key="question_instructions_template", value_text=payload.get("question_instructions_template"))
    if "chat_instructions_template" in payload:
        await repo.set_text(scope="global", key="chat_instructions_template", value_text=payload.get("chat_instructions_template"))

    # json fields
    if "tone_map" in payload:
        await repo.set_json(scope="global", key="tone_map", value_json=payload.get("tone_map"))
    if "tone_options" in payload:
        await repo.set_json(scope="global", key="tone_options", value_json=payload.get("tone_options"))

    if "address_format_map" in payload:
        await repo.set_json(scope="global", key="address_format_map", value_json=payload.get("address_format_map"))
    if "address_format_options" in payload:
        await repo.set_json(scope="global", key="address_format_options", value_json=payload.get("address_format_options"))

    if "answer_length_map" in payload:
        await repo.set_json(scope="global", key="answer_length_map", value_json=payload.get("answer_length_map"))
    if "answer_length_options" in payload:
        await repo.set_json(scope="global", key="answer_length_options", value_json=payload.get("answer_length_options"))

    if "emoji_rule_map" in payload:
        await repo.set_json(scope="global", key="emoji_rule_map", value_json=payload.get("emoji_rule_map"))

    await session.flush()
    return await get_global_bundle(session)


class _SafeFormatDict(dict):
    def __missing__(self, key):
        return ""


def render_template(template: str, values: dict) -> str:
    try:
        return (template or "").format_map(_SafeFormatDict(values)).strip()
    except Exception:
        # If template has invalid braces etc — fallback to raw template (do not crash)
        return (template or "").strip()
