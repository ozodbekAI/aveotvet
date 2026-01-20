from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import ShopCreditLedger
from app.models.shop import Shop


class ShopBillingRepo:
    """Shop-scoped credits.

    All credit mutations are recorded in an immutable ledger.
    """

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_balance(self, shop_id: int) -> int:
        shop = await self.session.get(Shop, shop_id)
        return int(getattr(shop, "credits_balance", 0) or 0) if shop else 0

    async def apply_credits(
        self,
        shop_id: int,
        *,
        delta: int,
        reason: str,
        actor_user_id: int | None = None,
        meta: dict | None = None,
    ) -> int:
        """Apply delta to shop credits atomically (row-locked).

        delta > 0: topup/refund
        delta < 0: charge

        Returns new balance.
        """
        res = await self.session.execute(
            select(Shop).where(Shop.id == int(shop_id)).with_for_update()
        )
        shop = res.scalar_one_or_none()
        if not shop:
            raise ValueError("Shop not found")
        if not bool(getattr(shop, "is_active", True)):
            raise ValueError("Shop is inactive")

        cur = int(getattr(shop, "credits_balance", 0) or 0)
        new = cur + int(delta)
        if new < 0:
            raise ValueError("Insufficient credits")

        shop.credits_balance = new
        if delta < 0:
            shop.credits_spent = int(getattr(shop, "credits_spent", 0) or 0) + (-int(delta))

        self.session.add(
            ShopCreditLedger(
                shop_id=int(shop_id),
                actor_user_id=int(actor_user_id) if actor_user_id is not None else None,
                delta=int(delta),
                balance_after=new,
                reason=str(reason)[:64],
                meta=meta or {},
            )
        )
        await self.session.flush()
        return new

    async def try_charge(
        self,
        shop_id: int,
        *,
        amount: int,
        reason: str,
        actor_user_id: int | None = None,
        meta: dict | None = None,
    ) -> bool:
        try:
            await self.apply_credits(
                shop_id,
                delta=-int(amount),
                reason=reason,
                actor_user_id=actor_user_id,
                meta=meta,
            )
            return True
        except ValueError:
            return False
