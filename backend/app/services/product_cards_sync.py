from __future__ import annotations

from datetime import datetime, timezone
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_secret
from app.core.config import settings
from app.models.shop import Shop
from app.models.settings import ShopSettings
from app.repos.product_card_repo import ProductCardRepo
from app.services.wb_content_client import WBContentClient


log = logging.getLogger(__name__)


async def sync_product_cards(
    session: AsyncSession,
    shop: Shop,
    shop_settings: ShopSettings,
    *,
    pages: int,
    limit: int,
) -> dict:
    """Sync a portion of product cards into local DB.

    We use cursor pagination and store cursor in shop_settings.
    When we reach the end (cursor.total < limit or empty list), cursor is reset to restart from beginning.
    """

    token = decrypt_secret(shop.wb_token_enc)
    client = WBContentClient(token=token, locale=shop_settings.language or "ru")
    try:
        repo = ProductCardRepo(session)
        total_fetched = 0
        total_upserted = 0

        log.info(
            "[cards-sync] start shop_id=%s pages=%s limit=%s cursor_updated_at=%s cursor_nm_id=%s",
            shop.id,
            pages,
            limit,
            shop_settings.cards_cursor_updated_at,
            shop_settings.cards_cursor_nm_id,
        )

        cur_updated_at = shop_settings.cards_cursor_updated_at
        cur_nm_id = shop_settings.cards_cursor_nm_id

        for _ in range(max(1, int(pages))):
            payload = await client.cards_list(
                cursor_updated_at=cur_updated_at,
                cursor_nm_id=cur_nm_id,
                limit=int(limit),
                with_photo=-1,
                ascending=False,
            )

            cards = payload.get("cards") or []
            cursor = payload.get("cursor") or {}

            log.info(
                "[cards-sync] page cards=%s cursor.total=%s cursor.updatedAt=%s cursor.nmID=%s",
                len(cards),
                cursor.get("total"),
                cursor.get("updatedAt"),
                cursor.get("nmID"),
            )

            if not cards:
                # nothing returned -> reset cursor and stop
                log.warning(
                    "[cards-sync] empty page -> reset cursor shop_id=%s",
                    shop.id,
                )
                shop_settings.cards_cursor_updated_at = None
                shop_settings.cards_cursor_nm_id = None
                break

            now = datetime.now(timezone.utc)
            missing_thumb = 0
            for c in cards:
                obj = await repo.upsert_from_wb(shop_id=shop.id, card=c, synced_at=now)
                if obj.thumb_url is None:
                    missing_thumb += 1
                total_upserted += 1
            total_fetched += len(cards)

            if missing_thumb:
                log.warning(
                    "[cards-sync] cards without thumb_url=%s/%s (shop_id=%s)",
                    missing_thumb,
                    len(cards),
                    shop.id,
                )

            # advance cursor
            next_updated_at_raw = cursor.get("updatedAt")
            next_nm_id = cursor.get("nmID")
            if next_updated_at_raw and next_nm_id is not None:
                try:
                    next_updated_at = (
                        next_updated_at_raw
                        if isinstance(next_updated_at_raw, datetime)
                        else datetime.fromisoformat(str(next_updated_at_raw).replace("Z", "+00:00"))
                    )
                except Exception:
                    next_updated_at = None
                if next_updated_at is not None:
                    cur_updated_at = next_updated_at
                    cur_nm_id = int(next_nm_id)
                    shop_settings.cards_cursor_updated_at = cur_updated_at
                    shop_settings.cards_cursor_nm_id = cur_nm_id

            if settings.DEBUG_PRODUCT_CARDS:
                log.info(
                    "[cards-sync] cursor advanced to updated_at=%s nm_id=%s",
                    shop_settings.cards_cursor_updated_at,
                    shop_settings.cards_cursor_nm_id,
                )

            # end condition per docs: when cursor.total < limit
            try:
                total_in_cursor = int(cursor.get("total") or 0)
            except Exception:
                total_in_cursor = 0
            if total_in_cursor < int(limit):
                # finished full scan; reset cursor to start next cycle
                log.info(
                    "[cards-sync] end of scan (cursor.total=%s < limit=%s) -> reset cursor shop_id=%s",
                    total_in_cursor,
                    limit,
                    shop.id,
                )
                shop_settings.cards_cursor_updated_at = None
                shop_settings.cards_cursor_nm_id = None
                break

        shop_settings.last_cards_sync_at = datetime.now(timezone.utc)
        await session.flush()

        log.info(
            "[cards-sync] done shop_id=%s fetched=%s upserted=%s next_cursor_updated_at=%s next_cursor_nm_id=%s",
            shop.id,
            total_fetched,
            total_upserted,
            shop_settings.cards_cursor_updated_at,
            shop_settings.cards_cursor_nm_id,
        )

        return {
            "fetched": total_fetched,
            "upserted": total_upserted,
            "cursor_updated_at": shop_settings.cards_cursor_updated_at.isoformat() if shop_settings.cards_cursor_updated_at else None,
            "cursor_nm_id": shop_settings.cards_cursor_nm_id,
        }
    finally:
        await client.aclose()
