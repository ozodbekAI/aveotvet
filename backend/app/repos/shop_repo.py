from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.shop import Shop
from app.models.settings import ShopSettings


class ShopRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_by_owner(self, owner_user_id: int) -> list[Shop]:
        res = await self.session.execute(select(Shop).where(Shop.owner_user_id == owner_user_id).order_by(Shop.id))
        return list(res.scalars().all())

    async def get(self, owner_user_id: int, shop_id: int) -> Shop | None:
        res = await self.session.execute(
            select(Shop).where(Shop.owner_user_id == owner_user_id, Shop.id == shop_id)
        )
        return res.scalar_one_or_none()

    async def create(self, owner_user_id: int, name: str, wb_token_enc: str) -> Shop:
        shop = Shop(owner_user_id=owner_user_id, name=name, wb_token_enc=wb_token_enc)
        self.session.add(shop)
        await self.session.flush()


        self.session.add(ShopSettings(shop_id=shop.id))
        await self.session.flush()
        return shop

    async def get_settings(self, shop_id: int) -> ShopSettings | None:
        res = await self.session.execute(select(ShopSettings).where(ShopSettings.shop_id == shop_id))
        return res.scalar_one_or_none()
