from __future__ import annotations

from datetime import datetime
import logging

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product_card import ProductCard
from app.core.config import settings


log = logging.getLogger(__name__)


class ProductCardRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_nm_id(self, shop_id: int, nm_id: int) -> ProductCard | None:
        res = await self.session.execute(
            select(ProductCard).where(and_(ProductCard.shop_id == shop_id, ProductCard.nm_id == nm_id))
        )
        return res.scalar_one_or_none()

    async def upsert_from_wb(self, shop_id: int, card: dict, *, synced_at: datetime | None = None) -> ProductCard:
        """Upsert a product card from WB Content API payload."""
        nm_id = int(card.get("nmID"))
        existing = await self.get_by_nm_id(shop_id=shop_id, nm_id=nm_id)
        if existing:
            obj = existing
        else:
            obj = ProductCard(shop_id=shop_id, nm_id=nm_id)
            self.session.add(obj)

        obj.vendor_code = card.get("vendorCode")
        obj.title = card.get("title")
        obj.brand = card.get("brand")
        obj.subject_id = card.get("subjectID")
        obj.subject_name = card.get("subjectName")

        photos = card.get("photos")
        obj.photos = photos

        # Prefer a square/preview image, fallback to big.
        thumb = None
        if isinstance(photos, list) and photos:
            ph0 = photos[0] or {}
            if isinstance(ph0, dict):
                thumb = ph0.get("square") or ph0.get("c246x328") or ph0.get("c516x688") or ph0.get("big")
        obj.thumb_url = thumb

        if thumb is None and isinstance(photos, list) and photos:
            # Helpful debug for cases where Content API response structure differs.
            ph0 = photos[0] or {}
            if isinstance(ph0, dict):
                keys = sorted([str(k) for k in ph0.keys()])
                if settings.DEBUG_PRODUCT_CARDS:
                    log.warning(
                        "[product-cards] thumb_url is None for nm_id=%s (shop_id=%s). photo keys=%s",
                        nm_id,
                        shop_id,
                        keys,
                    )

        # updatedAt is not guaranteed to exist in every response payload, but often does.
        wb_updated_at_raw = card.get("updatedAt")
        if wb_updated_at_raw:
            try:
                obj.wb_updated_at = (
                    wb_updated_at_raw
                    if isinstance(wb_updated_at_raw, datetime)
                    else datetime.fromisoformat(str(wb_updated_at_raw).replace("Z", "+00:00"))
                )
            except Exception:
                obj.wb_updated_at = None

        obj.raw = card
        if synced_at is not None:
            obj.synced_at = synced_at

        await self.session.flush()
        return obj

    async def get_thumbnails(self, shop_id: int, nm_ids: list[int]) -> dict[int, str]:
        if not nm_ids:
            return {}
        res = await self.session.execute(
            select(ProductCard.nm_id, ProductCard.thumb_url).where(
                ProductCard.shop_id == shop_id, ProductCard.nm_id.in_(nm_ids), ProductCard.thumb_url.is_not(None)
            )
        )
        rows = res.all()
        out: dict[int, str] = {}
        for nm_id, url in rows:
            if nm_id is not None and url:
                out[int(nm_id)] = str(url)
        return out
