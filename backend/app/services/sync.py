from __future__ import annotations

from datetime import datetime, timezone

from app.core.config import settings
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
    max_total: int | None = None,
) -> dict:
    token = decrypt_secret(shop.wb_token_enc)
    wb = WBClient(token=token)
    max_total_eff = int(max_total or settings.SYNC_MAX_TOTAL)
    max_total_eff = max(1, min(max_total_eff, settings.SYNC_MAX_TOTAL))

    repo = FeedbackRepo(session)

    total_fetched = 0
    total_upserted = 0
    skip_cur = int(skip or 0)

    # Track newest createdDate we actually saw.
    max_created_at: datetime | None = None
    existing_cursor = getattr(shop_settings, "last_feedback_created_at", None)
    if isinstance(existing_cursor, datetime):
        max_created_at = existing_cursor

    last_data: dict = {}
    try:
        while total_fetched < max_total_eff:
            page_take = int(take or 1)
            remaining = max_total_eff - total_fetched
            if page_take > remaining:
                page_take = remaining

            payload = await wb.feedbacks_list(
                is_answered=is_answered,
                take=page_take,
                skip=skip_cur,
                order=order,
                date_from=date_from_unix,
                date_to=date_to_unix,
            )
            data = payload.get("data") or {}
            last_data = data
            feedbacks = data.get("feedbacks") or []
            if not feedbacks:
                break

            for fb_payload in feedbacks:
                fb = await repo.upsert_from_wb(shop_id=shop.id, payload=fb_payload)
                total_upserted += 1
                try:
                    if max_created_at is None or fb.created_date > max_created_at:
                        max_created_at = fb.created_date
                except Exception:
                    pass

            total_fetched += len(feedbacks)
            if len(feedbacks) < page_take:
                break
            skip_cur += page_take
    finally:
        await wb.aclose()

    now = datetime.now(timezone.utc)
    shop_settings.last_sync_at = now

    # Only move cursor forward.
    try:
        if max_created_at is not None:
            prev = getattr(shop_settings, "last_feedback_created_at", None)
            if prev is None or (isinstance(prev, datetime) and max_created_at > prev):
                shop_settings.last_feedback_created_at = max_created_at
    except Exception:
        pass

    await session.flush()

    return {
        "count_unanswered": last_data.get("countUnanswered"),
        "count_archive": last_data.get("countArchive"),
        "fetched": total_fetched,
        "upserted": total_upserted,
        "cursor_at": max_created_at.isoformat() if isinstance(max_created_at, datetime) else None,
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
    max_total: int | None = None,
) -> dict:
    token = decrypt_secret(shop.wb_token_enc)
    wb = WBClient(token=token)
    max_total_eff = int(max_total or settings.SYNC_MAX_TOTAL)
    max_total_eff = max(1, min(max_total_eff, settings.SYNC_MAX_TOTAL))

    repo = QuestionRepo(session)
    total_fetched = 0
    total_upserted = 0
    skip_cur = int(skip or 0)
    last_data: dict = {}
    try:
        while total_fetched < max_total_eff:
            page_take = int(take or 1)
            remaining = max_total_eff - total_fetched
            if page_take > remaining:
                page_take = remaining

            payload = await wb.questions_list(
                is_answered=is_answered,
                take=page_take,
                skip=skip_cur,
                order=order,
                date_from=date_from_unix,
                date_to=date_to_unix,
            )
            data = payload.get("data") or {}
            last_data = data
            questions = data.get("questions") or []
            if not questions:
                break

            for q_payload in questions:
                await repo.upsert_from_wb(shop_id=shop.id, payload=q_payload)
                total_upserted += 1
            total_fetched += len(questions)
            if len(questions) < page_take:
                break
            skip_cur += page_take
    finally:
        await wb.aclose()

    shop_settings.last_questions_sync_at = datetime.now(timezone.utc)
    await session.flush()

    return {
        "count_unanswered": last_data.get("countUnanswered"),
        "count_archive": last_data.get("countArchive"),
        "fetched": total_fetched,
        "upserted": total_upserted,
    }
