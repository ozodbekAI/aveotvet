from __future__ import annotations

from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.billing import CreditLedger, ShopCreditLedger
from app.schemas.billing import BillingMeResponse, LedgerItem, ShopBillingResponse, BillingShopsResponse
from app.api.access import require_shop_access
from app.models.enums import ShopMemberRole
from app.models.shop_member import ShopMember
from app.models.enums import UserRole
from app.models.shop import Shop


router = APIRouter()


@router.get("/me", response_model=BillingMeResponse)
async def billing_me(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    rows = await db.execute(
        select(CreditLedger)
        .where(CreditLedger.user_id == user.id)
        .order_by(CreditLedger.id.desc())
        .limit(50)
    )
    items = list(rows.scalars().all())
    return BillingMeResponse(
        credits_balance=int(getattr(user, "credits_balance", 0) or 0),
        credits_spent=int(getattr(user, "credits_spent", 0) or 0),
        recent=[LedgerItem.model_validate(it) for it in items],
    )


@router.get("/shops", response_model=BillingShopsResponse)
async def billing_shops(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    # v1 policy: store billing is visible only to the shop owner.
    # Global admins should use /admin/* endpoints.
    if getattr(user, "role", UserRole.user.value) in {UserRole.super_admin.value, UserRole.support_admin.value}:
        raise HTTPException(status_code=403, detail="Use admin billing endpoints")

    rows_o = await db.execute(select(Shop).where(Shop.owner_user_id == user.id))
    owner_shops = list(rows_o.scalars().all())
    if not owner_shops:
        raise HTTPException(status_code=403, detail="Owner access required")

    out = [
        ShopBillingResponse(
            shop_id=s.id,
            credits_balance=int(getattr(s, "credits_balance", 0) or 0),
            credits_spent=int(getattr(s, "credits_spent", 0) or 0),
            recent=[],
        )
        for s in sorted(owner_shops, key=lambda x: x.id)
    ]
    return BillingShopsResponse(shops=out)


@router.get("/shops/{shop_id}", response_model=ShopBillingResponse)
async def billing_shop(
    shop_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.owner.value)

    shop = await db.get(Shop, shop_id)
    if not shop:
        return ShopBillingResponse(shop_id=shop_id, credits_balance=0, credits_spent=0, recent=[])

    rows = await db.execute(
        select(ShopCreditLedger)
        .where(ShopCreditLedger.shop_id == shop_id)
        .order_by(ShopCreditLedger.id.desc())
        .limit(50)
    )
    items = list(rows.scalars().all())
    return ShopBillingResponse(
        shop_id=shop_id,
        credits_balance=int(getattr(shop, "credits_balance", 0) or 0),
        credits_spent=int(getattr(shop, "credits_spent", 0) or 0),
        recent=[LedgerItem.model_validate(it) for it in items],
    )