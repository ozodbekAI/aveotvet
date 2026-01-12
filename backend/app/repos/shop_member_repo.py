from __future__ import annotations

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.shop_member import ShopMember


class ShopMemberRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_for_shop(self, shop_id: int) -> list[ShopMember]:
        res = await self.session.execute(select(ShopMember).where(ShopMember.shop_id == shop_id).order_by(ShopMember.id))
        return list(res.scalars().all())

    async def get(self, shop_id: int, user_id: int) -> ShopMember | None:
        res = await self.session.execute(
            select(ShopMember).where(ShopMember.shop_id == shop_id, ShopMember.user_id == user_id)
        )
        return res.scalar_one_or_none()

    async def upsert(self, shop_id: int, user_id: int, role: str) -> ShopMember:
        m = await self.get(shop_id, user_id)
        if m:
            m.role = role
            await self.session.flush()
            return m
        m = ShopMember(shop_id=shop_id, user_id=user_id, role=role)
        self.session.add(m)
        await self.session.flush()
        return m

    async def delete(self, shop_id: int, user_id: int) -> None:
        await self.session.execute(delete(ShopMember).where(ShopMember.shop_id == shop_id, ShopMember.user_id == user_id))
