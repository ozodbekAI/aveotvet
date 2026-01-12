from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_secret
from app.models.shop import Shop
from app.models.settings import ShopSettings
from app.repos.feedback_repo import FeedbackRepo
from app.repos.question_repo import QuestionRepo
from app.services.wb_client import WBClient


async def sync_feedbacks(
    session: AsyncSession,
    shop: Shop,
    shop_settings: ShopSettings,
    *,
    is_answered: bool,
    take: int,
    skip: int,
    order: str,
    date_from_unix: int | None,
    date_to_unix: int | None,
) -> dict:
    token = decrypt_secret(shop.wb_token_enc)
    wb = WBClient(token=token)
    try:
        payload = await wb.feedbacks_list(
            is_answered=is_answered,
            take=take,
            skip=skip,
            order=order,
            date_from=date_from_unix,
            date_to=date_to_unix,
        )
    finally:
        await wb.aclose()

    data = payload.get("data") or {}
    feedbacks = data.get("feedbacks") or []

    repo = FeedbackRepo(session)
    upserted = 0
    for fb_payload in feedbacks:
        await repo.upsert_from_wb(shop_id=shop.id, payload=fb_payload)
        upserted += 1

    shop_settings.last_sync_at = datetime.now(timezone.utc)
    await session.flush()

    return {
        "count_unanswered": data.get("countUnanswered"),
        "count_archive": data.get("countArchive"),
        "fetched": len(feedbacks),
        "upserted": upserted,
    }


async def sync_questions(
    session: AsyncSession,
    shop: Shop,
    shop_settings: ShopSettings,
    *,
    is_answered: bool,
    take: int,
    skip: int,
    order: str,
    date_from_unix: int | None,
    date_to_unix: int | None,
) -> dict:
    token = decrypt_secret(shop.wb_token_enc)
    wb = WBClient(token=token)
    try:
        payload = await wb.questions_list(
            is_answered=is_answered,
            take=take,
            skip=skip,
            order=order,
            date_from=date_from_unix,
            date_to=date_to_unix,
        )
    finally:
        await wb.aclose()

    data = payload.get("data") or {}
    questions = data.get("questions") or []

    repo = QuestionRepo(session)
    upserted = 0
    for q_payload in questions:
        await repo.upsert_from_wb(shop_id=shop.id, payload=q_payload)
        upserted += 1

    shop_settings.last_questions_sync_at = datetime.now(timezone.utc)
    await session.flush()

    return {
        "count_unanswered": data.get("countUnanswered"),
        "count_archive": data.get("countArchive"),
        "fetched": len(questions),
        "upserted": upserted,
    }
