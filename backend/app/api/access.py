from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.shop import Shop
from app.models.shop_member import ShopMember
from app.models.enums import shop_role_at_least, ShopMemberRole, UserRole
from app.models.user import User


@dataclass(frozen=True)
class ShopAccess:
    shop: Shop
    role: str  # ShopMemberRole value

    def at_least(self, min_role: str) -> bool:
        return shop_role_at_least(self.role, min_role)


async def require_super_admin(user: User) -> None:
    if getattr(user, "role", "user") != UserRole.super_admin.value:
        raise HTTPException(status_code=403, detail="Super admin access required")


async def require_platform_role(user: User, allowed: set[str]) -> None:
    if getattr(user, "role", "user") not in allowed:
        raise HTTPException(status_code=403, detail="Access denied")


async def get_shop_access(db: AsyncSession, user: User, shop_id: int) -> ShopAccess | None:
    res = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = res.scalar_one_or_none()
    if not shop:
        return None

    if getattr(user, "role", "user") == UserRole.super_admin.value:
        return ShopAccess(shop=shop, role=ShopMemberRole.owner.value)

    if shop.owner_user_id == user.id:
        return ShopAccess(shop=shop, role=ShopMemberRole.owner.value)

    res = await db.execute(select(ShopMember).where(ShopMember.shop_id == shop_id, ShopMember.user_id == user.id))
    m = res.scalar_one_or_none()
    if not m:
        return None
    return ShopAccess(shop=shop, role=m.role)


async def require_shop_access(
    db: AsyncSession,
    user: User,
    shop_id: int,
    *,
    min_role: str = ShopMemberRole.viewer.value,
) -> ShopAccess:
    access = await get_shop_access(db, user, shop_id)
    if not access:
        raise HTTPException(status_code=404, detail="Shop not found")
    if not shop_role_at_least(access.role, min_role):
        raise HTTPException(status_code=403, detail="Insufficient shop role")
    return access
