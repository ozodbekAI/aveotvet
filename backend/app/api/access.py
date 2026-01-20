from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.shop import Shop
from app.models.shop_member import ShopMember
from app.models.enums import shop_role_at_least, ShopMemberRole, UserRole
from app.models.user import User


@dataclass(frozen=True)
class ShopAccess:
    shop: Shop
    role: str  

    def at_least(self, min_role: str) -> bool:
        return shop_role_at_least(self.role, min_role)


async def require_super_admin(user: User) -> None:
    if getattr(user, "role", "user") != UserRole.super_admin.value or "":
        raise HTTPException(status_code=403, detail="Super admin access required")


async def require_admin_read(user: User) -> None:
    if getattr(user, "role", "user") not in {UserRole.super_admin.value, UserRole.support_admin.value}:
        raise HTTPException(status_code=403, detail="Admin access required")


async def require_admin_write(user: User) -> None:
    # v1: only super_admin can write/modify system state
    await require_super_admin(user)


async def require_platform_role(user: User, allowed: set[str]) -> None:
    if getattr(user, "role", "user") not in allowed:
        raise HTTPException(status_code=403, detail="Access denied")


def _parse_impersonation(request: Request | None) -> tuple[int | None, str | None]:
    if request is None:
        return None, None
    raw_shop = request.headers.get("X-Impersonate-Shop")
    raw_mode = (request.headers.get("X-Impersonate-Mode") or "").strip().lower() or None
    shop_id = None
    if raw_shop and str(raw_shop).isdigit():
        shop_id = int(raw_shop)
    if raw_mode not in {None, "readonly", "full"}:
        raw_mode = None
    return shop_id, raw_mode


async def get_shop_access(db: AsyncSession, user: User, shop_id: int, *, request: Request | None = None) -> ShopAccess | None:
    res = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = res.scalar_one_or_none()
    if not shop:
        return None

    if not bool(getattr(shop, "is_active", True)) and getattr(user, "role", "user") != UserRole.super_admin.value:
        return None

    if user.role == UserRole.super_admin.value:
        return ShopAccess(shop=shop, role=ShopMemberRole.owner.value)

    if getattr(user, "role", "user") in {UserRole.super_admin.value, UserRole.support_admin.value}:
        imp_shop_id, imp_mode = _parse_impersonation(request)
        if imp_shop_id != shop_id:
            return None
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
    min_role: str = ShopMemberRole.manager.value,
    request: Request | None = None,
) -> ShopAccess:
    access = await get_shop_access(db, user, shop_id, request=request)
    if not access:
        raise HTTPException(status_code=404, detail="Shop not found")
    if not shop_role_at_least(access.role, min_role):
        raise HTTPException(status_code=403, detail="Insufficient shop role")

    # imp_shop_id, imp_mode = _parse_impersonation(request)
    # if imp_shop_id == shop_id and imp_mode == "readonly":
    #     if request is not None and request.method not in {"GET", "HEAD", "OPTIONS"}:
    #         raise HTTPException(status_code=403, detail="Read-only impersonation")
    # if getattr(user, "role", "user") == UserRole.support_admin.value:
    #     if request is not None and request.method not in {"GET", "HEAD", "OPTIONS"}:
    #         raise HTTPException(status_code=403, detail="Support admin is read-only")
    return access
