from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payments import Payment


class PaymentRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, shop_id: int, amount_rub: float, source: str = "manual", comment: str | None = None) -> Payment:
        p = Payment(shop_id=int(shop_id), amount_rub=amount_rub, source=source[:32], comment=comment)
        self.db.add(p)
        await self.db.flush()
        return p

    async def list(self, *, limit: int = 100, offset: int = 0, shop_id: int | None = None) -> list[Payment]:
        q = select(Payment).order_by(Payment.created_at.desc()).limit(limit).offset(offset)
        if shop_id is not None:
            q = q.where(Payment.shop_id == int(shop_id))
        res = await self.db.execute(q)
        return list(res.scalars().all())
