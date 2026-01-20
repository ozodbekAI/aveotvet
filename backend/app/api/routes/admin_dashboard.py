from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.api.access import require_super_admin
from app.repos.admin_dashboard_repo import AdminDashboardRepo
from app.schemas.admin_dashboard import SystemHealthOut, FinanceBreakdownOut, OpsDashboardOut, ShopDashboardOut

router = APIRouter()


@router.get("/system-health", response_model=SystemHealthOut)
async def system_health(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await require_super_admin(user)
    data = await AdminDashboardRepo(db).system_health()
    return SystemHealthOut(**data)


@router.get("/finance", response_model=FinanceBreakdownOut)
async def finance(
    period: str = Query("last_7_days", pattern=r"^(today|last_7_days|last_30_days|all_time)$"),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await require_super_admin(user)
    data = await AdminDashboardRepo(db).finance(period)
    return FinanceBreakdownOut(**data)


@router.get("/ops", response_model=OpsDashboardOut)
async def ops(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await require_super_admin(user)
    data = await AdminDashboardRepo(db).ops()
    return OpsDashboardOut(**data)


@router.get("/shops/{shop_id}", response_model=ShopDashboardOut)
async def shop_dashboard(shop_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await require_super_admin(user)
    data = await AdminDashboardRepo(db).shop_dashboard(shop_id)
    if not data:
        return ShopDashboardOut(shop_id=shop_id, shop_name="(not found)")
    return ShopDashboardOut(**data)
