from __future__ import annotations

from datetime import date
from pydantic import BaseModel


class DashboardKpis(BaseModel):
    """KPI block aligned to frontend components/modules/dashboard-module.tsx.

    Frontend expects camelCase keys here.
    """

    total: int = 0
    pending: int = 0
    unanswered: int = 0
    answered: int = 0

    # Reviews-only KPIs ("Отзывы" tab). For other tabs they will be 0.
    avgRating: float = 0.0
    positiveShare: int = 0


class DashboardLinePoint(BaseModel):
    """Line chart point (d=date label, v=value) as used by recharts in the frontend."""

    d: str
    v: int


class DashboardLineBlock(BaseModel):
    data: list[DashboardLinePoint]
    periodText: str
    previousData: list[DashboardLinePoint] = []
    previousPeriodText: str | None = None


class DashboardTopItem(BaseModel):
    title: str
    brand: str | None = None
    count: int


class DashboardTopBlock(BaseModel):
    positive: list[DashboardTopItem] = []
    negative: list[DashboardTopItem] = []


class DashboardMeta(BaseModel):
    shop_ids: list[int]
    range_days: int
    date_from: date
    date_to: date


class DashboardFeedbacksOut(BaseModel):
    meta: DashboardMeta
    kpis: DashboardKpis
    line: DashboardLineBlock
    top: DashboardTopBlock


class DashboardSyncOut(BaseModel):
    queued: int
    skipped: int
    job_ids: list[int]
