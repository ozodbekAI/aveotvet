from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.api.access import require_super_admin
from app.repos.payment_repo import PaymentRepo
from app.schemas.payments import PaymentCreateIn, PaymentOut

router = APIRouter()


@router.get("", response_model=list[PaymentOut])
async def list_payments(
    shop_id: int | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await require_super_admin(user)
    items = await PaymentRepo(db).list(limit=limit, offset=offset, shop_id=shop_id)
    return [
        PaymentOut(
            id=p.id,
            shop_id=p.shop_id,
            amount_rub=float(p.amount_rub),
            source=p.source,
            comment=p.comment,
            created_at=p.created_at,
        )
        for p in items
    ]


@router.post("", response_model=PaymentOut)
async def create_payment(
    payload: PaymentCreateIn,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await require_super_admin(user)
    p = await PaymentRepo(db).create(
        shop_id=payload.shop_id,
        amount_rub=payload.amount_rub,
        source=payload.source,
        comment=payload.comment,
    )
    await db.commit()
    return PaymentOut(
        id=p.id,
        shop_id=p.shop_id,
        amount_rub=float(p.amount_rub),
        source=p.source,
        comment=p.comment,
        created_at=p.created_at,
    )
