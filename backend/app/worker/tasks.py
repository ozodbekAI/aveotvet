from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.shop import Shop
from app.models.feedback import Feedback
from app.models.question import Question
from app.models.enums import JobType, DraftStatus
from app.repos.shop_repo import ShopRepo
from app.repos.feedback_repo import FeedbackRepo
from app.repos.draft_repo import DraftRepo
from app.repos.question_repo import QuestionRepo
from app.repos.question_draft_repo import QuestionDraftRepo
from app.repos.job_repo import JobRepo
from app.repos.chat_repo import ChatRepo
from app.services.sync import sync_feedbacks, sync_questions
from app.services.product_cards_sync import sync_product_cards
from app.services.openai_client import OpenAIService
from app.services.prompt_store import get_global_bundle
from app.services.drafting import generate_draft_text, effective_mode_for_rating, contains_blacklist
from app.services.question_drafting import generate_question_draft_text
from app.services.wb_client import WBClient
from app.core.crypto import decrypt_secret
from app.services.wb_chat_client import WBChatClient
from app.services.chat_drafting import generate_chat_reply


async def handle_job(session: AsyncSession, job_type: str, payload: dict) -> None:
    if job_type == JobType.sync_shop.value:
        await _job_sync_shop(session, payload)
        return
    if job_type == JobType.sync_questions.value:
        await _job_sync_questions(session, payload)
        return
    if job_type == JobType.generate_draft.value:
        await _job_generate_draft(session, payload)
        return
    if job_type == JobType.publish_answer.value:
        await _job_publish_answer(session, payload)
        return
    if job_type == JobType.generate_question_draft.value:
        await _job_generate_question_draft(session, payload)
        return
    if job_type == JobType.publish_question_answer.value:
        await _job_publish_question_answer(session, payload)
        return
    if job_type == JobType.sync_chats.value:
        await _job_sync_chats(session, payload)
        return
    if job_type == JobType.sync_chat_events.value:
        await _job_sync_chat_events(session, payload)
        return
    if job_type == JobType.generate_chat_draft.value:
        await _job_generate_chat_draft(session, payload)
        return
    if job_type == JobType.send_chat_message.value:
        await _job_send_chat_message(session, payload)
        return
    if job_type == JobType.sync_product_cards.value:
        await _job_sync_product_cards(session, payload)
        return
    raise ValueError(f"Unknown job type: {job_type}")


def _text_hits_blacklist(text: str | None, keywords: list) -> bool:
    if not text:
        return False
    t = text.lower()
    for kw in keywords or []:
        if isinstance(kw, str) and kw.strip() and kw.strip().lower() in t:
            return True
    return False


async def _job_sync_shop(session: AsyncSession, payload: dict) -> None:
    shop_id = int(payload["shop_id"])
    is_answered = bool(payload.get("is_answered", False))
    take = int(payload.get("take", 500))
    skip = int(payload.get("skip", 0))
    order = payload.get("order", "dateDesc")
    date_from_unix = payload.get("date_from_unix")
    date_to_unix = payload.get("date_to_unix")

    shop = await session.get(Shop, shop_id)
    if not shop:
        return
    settings_obj = await ShopRepo(session).get_settings(shop_id)
    if not settings_obj:
        return

    await sync_feedbacks(
        session,
        shop,
        settings_obj,
        is_answered=is_answered,
        take=take,
        skip=skip,
        order=order,
        date_from_unix=date_from_unix,
        date_to_unix=date_to_unix,
    )

    if settings_obj.auto_draft and not is_answered and (settings_obj.reply_mode in ("semi", "auto")):
        repo = FeedbackRepo(session)
        feedbacks, _ = await repo.list(shop_id=shop_id, is_answered=False, q=None, user_name=None, limit=take, offset=0)
        job_repo = JobRepo(session)
        draft_repo = DraftRepo(session)
        for fb in feedbacks:
            existing = await draft_repo.latest_for_feedback(fb.id)
            if existing:
                continue
            await job_repo.enqueue(JobType.generate_draft.value, {"shop_id": shop_id, "feedback_id": fb.id})

    await session.flush()


async def _job_sync_questions(session: AsyncSession, payload: dict) -> None:
    shop_id = int(payload["shop_id"])
    is_answered = bool(payload.get("is_answered", False))
    take = int(payload.get("take", 500))
    skip = int(payload.get("skip", 0))
    order = payload.get("order", "dateDesc")
    date_from_unix = payload.get("date_from_unix")
    date_to_unix = payload.get("date_to_unix")

    shop = await session.get(Shop, shop_id)
    if not shop:
        return
    settings_obj = await ShopRepo(session).get_settings(shop_id)
    if not settings_obj:
        return

    await sync_questions(
        session,
        shop,
        settings_obj,
        is_answered=is_answered,
        take=take,
        skip=skip,
        order=order,
        date_from_unix=date_from_unix,
        date_to_unix=date_to_unix,
    )


async def _job_sync_product_cards(session: AsyncSession, payload: dict) -> None:
    """Sync product cards (Content API) to be able to return product photos with feedbacks."""
    shop_id = int(payload["shop_id"])
    pages = int(payload.get("pages", 5))
    limit = int(payload.get("limit", 100))

    shop = await session.get(Shop, shop_id)
    if not shop:
        return
    settings_obj = await ShopRepo(session).get_settings(shop_id)
    if not settings_obj:
        return

    await sync_product_cards(session, shop, settings_obj, pages=pages, limit=limit)

    await session.flush()


async def _job_generate_draft(session: AsyncSession, payload: dict) -> None:
    shop_id = int(payload["shop_id"])
    feedback_id = int(payload["feedback_id"])

    shop = await session.get(Shop, shop_id)
    if not shop:
        return
    settings_obj = await ShopRepo(session).get_settings(shop_id)
    if not settings_obj:
        return

    feedback = await session.get(Feedback, feedback_id)
    if not feedback or feedback.answer_text:
        return

    # If blacklist detected -> keep manual workflow (still can draft, but never auto-publish)
    bl_hit = contains_blacklist(feedback, settings_obj)

    openai = OpenAIService()
    bundle = await get_global_bundle(session)
    text, model, response_id = await generate_draft_text(openai, feedback, settings_obj, bundle=bundle)
    draft = await DraftRepo(session).create(feedback_id=feedback.id, text=text, openai_model=model, openai_response_id=response_id)

    # rating-based workflow
    rating = feedback.product_valuation or 0
    eff_mode = effective_mode_for_rating(settings_obj, rating)

    # UI parity: auto-publish is decided by per-rating mode (auto) plus blacklist guard.
    # Older versions also used `auto_publish` and `min_rating_to_autopublish`, but those
    # settings do not exist in the UI shown in screenshots and would block per-rating auto.
    if (not bl_hit) and eff_mode == "auto":
        await JobRepo(session).enqueue(
            JobType.publish_answer.value,
            {"shop_id": shop_id, "feedback_id": feedback.id, "draft_id": draft.id},
        )


async def _job_publish_answer(session: AsyncSession, payload: dict) -> None:
    shop_id = int(payload["shop_id"])
    feedback_id = int(payload["feedback_id"])
    draft_id = payload.get("draft_id")

    shop = await session.get(Shop, shop_id)
    if not shop:
        return
    feedback = await session.get(Feedback, feedback_id)
    if not feedback or feedback.answer_text:
        return

    draft_repo = DraftRepo(session)
    draft = None
    if draft_id is not None:
        draft = await draft_repo.get(int(draft_id))
    if draft is None:
        draft = await draft_repo.latest_for_feedback(feedback.id)
    if not draft:
        return

    token = decrypt_secret(shop.wb_token_enc)
    wb = WBClient(token=token)
    try:
        await wb.feedback_answer_create(wb_id=feedback.wb_id, text=draft.text)
    finally:
        await wb.aclose()

    feedback.answer_text = draft.text
    draft.status = DraftStatus.published.value
    await session.flush()


async def _job_generate_question_draft(session: AsyncSession, payload: dict) -> None:
    shop_id = int(payload["shop_id"])
    question_id = int(payload["question_id"])

    settings_obj = await ShopRepo(session).get_settings(shop_id)
    if not settings_obj:
        return

    question = await session.get(Question, question_id)
    if not question or question.answer_text:
        return

    bl_hit = _text_hits_blacklist(question.text, settings_obj.blacklist_keywords)

    openai = OpenAIService()
    bundle = await get_global_bundle(session)
    text, model, response_id = await generate_question_draft_text(openai, question, settings_obj, bundle=bundle)
    draft = await QuestionDraftRepo(session).create(question_id=question.id, text=text, openai_model=model, openai_response_id=response_id)

    # UI parity: auto-publish for questions is defined by mode = "auto" (plus blacklist guard).
    # Older versions also had `questions_auto_publish`, but it would block UI mode.
    if (not bl_hit) and settings_obj.questions_reply_mode == "auto":
        await JobRepo(session).enqueue(
            JobType.publish_question_answer.value,
            {"shop_id": shop_id, "question_id": question.id, "draft_id": draft.id},
        )


async def _job_publish_question_answer(session: AsyncSession, payload: dict) -> None:
    shop_id = int(payload["shop_id"])
    question_id = int(payload["question_id"])
    draft_id = payload.get("draft_id")

    shop = await session.get(Shop, shop_id)
    if not shop:
        return
    question = await session.get(Question, question_id)
    if not question or question.answer_text:
        return

    draft_repo = QuestionDraftRepo(session)
    draft = None
    if draft_id is not None:
        draft = await draft_repo.get(int(draft_id))
    if draft is None:
        draft = await draft_repo.latest_for_question(question.id)
    if not draft:
        return

    token = decrypt_secret(shop.wb_token_enc)
    wb = WBClient(token=token)
    try:
        await wb.question_answer_or_edit(wb_id=question.wb_id, text=draft.text)
    finally:
        await wb.aclose()

    question.answer_text = draft.text
    draft.status = DraftStatus.published.value
    draft.published_at = datetime.now(timezone.utc)
    await session.flush()


async def _job_sync_chats(session: AsyncSession, payload: dict) -> None:
    shop_id = int(payload["shop_id"])
    shop = await session.get(Shop, shop_id)
    if not shop:
        return
    settings_obj = await ShopRepo(session).get_settings(shop_id)
    if not settings_obj or not settings_obj.chat_enabled:
        return

    token = decrypt_secret(shop.wb_token_enc)
    client = WBChatClient(token=token)
    try:
        resp = await client.chats_list()
    finally:
        await client.aclose()

    chats = resp.get("result") or []
    repo = ChatRepo(session)
    for ch in chats:
        await repo.upsert_session(shop_id=shop_id, payload=ch)

    settings_obj.last_chat_sync_at = datetime.now(timezone.utc)
    await session.flush()


async def _job_sync_chat_events(session: AsyncSession, payload: dict) -> None:
    shop_id = int(payload["shop_id"])
    shop = await session.get(Shop, shop_id)
    if not shop:
        return
    settings_obj = await ShopRepo(session).get_settings(shop_id)
    if not settings_obj or not settings_obj.chat_enabled:
        return

    token = decrypt_secret(shop.wb_token_enc)
    client = WBChatClient(token=token)
    try:
        resp = await client.events(next_ms=settings_obj.chat_next_ms)
    finally:
        await client.aclose()

    result = resp.get("result") or {}
    nxt = result.get("next")
    total = result.get("totalEvents") or 0
    events = result.get("events") or []

    repo = ChatRepo(session)
    for ev in events:
        await repo.add_event(shop_id=shop_id, ev=ev)

    if nxt is not None:
        settings_obj.chat_next_ms = int(nxt)

    settings_obj.last_chat_sync_at = datetime.now(timezone.utc)

    # If there are still events to consume, re-enqueue one more pull (keeps each job short).
    if int(total) > 0:
        await JobRepo(session).enqueue(JobType.sync_chat_events.value, {"shop_id": shop_id})

    await session.flush()


async def _job_generate_chat_draft(session: AsyncSession, payload: dict) -> None:
    shop_id = int(payload["shop_id"])
    chat_id = payload["chat_id"]

    settings_obj = await ShopRepo(session).get_settings(shop_id)
    if not settings_obj or not settings_obj.chat_enabled:
        return

    repo = ChatRepo(session)
    events = await repo.list_events(shop_id=shop_id, chat_id=chat_id, limit=50, offset=0)
    last_text = None
    ctx = None
    for ev in events:
        msg = ev.message or {}
        t = msg.get("text") if isinstance(msg, dict) else None
        if t:
            last_text = t
            ctx = (msg.get("attachments") or {}) if isinstance(msg, dict) else None
            break
    if not last_text:
        return

    openai = OpenAIService()
    bundle = await get_global_bundle(session)
    text, model, rid = await generate_chat_reply(openai, settings_obj, last_text, context=ctx, bundle=bundle)
    await repo.create_draft(shop_id=shop_id, chat_id=chat_id, text=text, openai_model=model, openai_response_id=rid)


async def _job_send_chat_message(session: AsyncSession, payload: dict) -> None:
    shop_id = int(payload["shop_id"])
    chat_id = payload["chat_id"]
    text = payload.get("text")

    shop = await session.get(Shop, shop_id)
    if not shop:
        return
    settings_obj = await ShopRepo(session).get_settings(shop_id)
    if not settings_obj or not settings_obj.chat_enabled:
        return

    repo = ChatRepo(session)
    sess = await repo.get_session_by_chat_id(shop_id=shop_id, chat_id=chat_id)
    if not sess:
        return

    if not text:
        d = await repo.latest_draft(shop_id=shop_id, chat_id=chat_id)
        if not d:
            return
        text = d.text

    token = decrypt_secret(shop.wb_token_enc)
    client = WBChatClient(token=token)
    try:
        await client.send_message(reply_sign=sess.reply_sign, message=text)
    finally:
        await client.aclose()
