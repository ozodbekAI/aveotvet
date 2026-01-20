from __future__ import annotations

from datetime import datetime, timezone, timedelta
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.shop import Shop
from app.models.settings import ShopSettings
from app.models.enums import JobType
from app.repos.job_repo import JobRepo


log = logging.getLogger(__name__)


async def scheduler_tick(session: AsyncSession) -> None:
    """Enqueue periodic jobs (autosync) respecting rate limits.

    This function is designed to be called frequently (e.g. every 10-30 seconds) from the worker loop.
    It schedules:
      * feedbacks sync every AUTO_SYNC_INTERVAL_MIN (unanswered only)
      * product cards sync every CARDS_SYNC_INTERVAL_MIN (paged)

    Duplicate jobs are avoided via JobRepo.exists_pending_for_shop.
    """

    now = datetime.now(timezone.utc)
    job_repo = JobRepo(session)

    if not settings.AUTO_SYNC_ENABLED and not settings.CARDS_SYNC_ENABLED:
        return

    # NOTE:
    # "automation_enabled" (Start/Stop) controls ONLY auto-generation of review drafts.
    # Sync (reviews/cards) must continue to work regardless of this switch.
    q = (
        select(Shop, ShopSettings)
        .join(ShopSettings, ShopSettings.shop_id == Shop.id)
        .where(Shop.is_active.is_(True), Shop.is_frozen.is_(False))
    )
    rows = (await session.execute(q)).all()

    feedback_interval = timedelta(minutes=int(settings.AUTO_SYNC_INTERVAL_MIN))
    cards_interval = timedelta(minutes=int(settings.CARDS_SYNC_INTERVAL_MIN))

    for shop, st in rows:
        # --- Feedbacks autosync (unanswered only) ---
        if settings.AUTO_SYNC_ENABLED and bool(getattr(st, "auto_sync", True)):
            due = st.last_sync_at is None or (now - st.last_sync_at) >= feedback_interval
            if due and not await job_repo.exists_pending_for_shop(JobType.sync_shop.value, shop.id):
                # Incremental: ask WB from last seen feedback createdDate (minus overlap).
                # This is more reliable than last_sync_at when jobs get delayed.
                date_from_unix = None
                cursor = getattr(st, "last_feedback_created_at", None)
                if cursor is not None:
                    try:
                        date_from_unix = int((cursor - timedelta(minutes=5)).timestamp())
                    except Exception:
                        date_from_unix = None

                await job_repo.enqueue(
                    JobType.sync_shop.value,
                    {
                        "shop_id": shop.id,
                        "is_answered": False,
                        "take": int(settings.AUTO_SYNC_TAKE),
                        "skip": 0,
                        "order": "dateDesc",
                        "date_from_unix": date_from_unix,
                        "date_to_unix": None,
                        "max_total": int(settings.AUTO_SYNC_MAX_TOTAL),
                    },
                )
                log.info(
                    "[scheduler] enqueued %s shop_id=%s date_from_unix=%s",
                    JobType.sync_shop.value,
                    shop.id,
                    date_from_unix,
                )

        # --- Product cards sync (Content API) ---
        if settings.CARDS_SYNC_ENABLED:
            due_cards = st.last_cards_sync_at is None or (now - st.last_cards_sync_at) >= cards_interval
            if due_cards and not await job_repo.exists_pending_for_shop(JobType.sync_product_cards.value, shop.id):
                await job_repo.enqueue(
                    JobType.sync_product_cards.value,
                    {
                        "shop_id": shop.id,
                        "pages": int(settings.CARDS_SYNC_PAGES_PER_RUN),
                        "limit": int(settings.CARDS_SYNC_LIMIT),
                    },
                )
                log.info(
                    "[scheduler] enqueued %s shop_id=%s pages=%s limit=%s",
                    JobType.sync_product_cards.value,
                    shop.id,
                    int(settings.CARDS_SYNC_PAGES_PER_RUN),
                    int(settings.CARDS_SYNC_LIMIT),
                )

    await session.flush()
