from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.signature import Signature


class SignatureRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_active(self, *, shop_id: int) -> list[Signature]:
        res = await self.session.execute(
            select(Signature)
            .where(Signature.shop_id == shop_id, Signature.is_active.is_(True))
            .order_by(Signature.id)
        )
        return list(res.scalars().all())

    async def replace_all(self, *, shop_id: int, items: list[dict]) -> None:
        """Replace all signatures for a shop (idempotent).

        Expected item shape:
        {
          "text": str,
          "type": "all"|"review"|"question"|"chat",
          "brand": "all"|"<brand>",
          "is_active": bool
        }
        """

        # Wipe existing
        await self.session.execute(delete(Signature).where(Signature.shop_id == shop_id))

        now = datetime.now(timezone.utc)
        for it in items or []:
            text = (it.get("text") if isinstance(it, dict) else None)
            if not isinstance(text, str) or not text.strip():
                continue

            tp = (it.get("type") if isinstance(it, dict) else None)
            tp = tp.strip().lower() if isinstance(tp, str) else "all"
            if tp not in ("all", "review", "question", "chat"):
                tp = "all"

            brand = (it.get("brand") if isinstance(it, dict) else None)
            brand = brand.strip() if isinstance(brand, str) and brand.strip() else "all"

            is_active = (it.get("is_active") if isinstance(it, dict) else True)
            if not isinstance(is_active, bool):
                is_active = True

            self.session.add(
                Signature(
                    shop_id=shop_id,
                    text=text.strip()[:300],
                    type=tp,
                    brand=brand[:128],
                    is_active=is_active,
                    created_at=now,
                    updated_at=now,
                )
            )

        await self.session.flush()
