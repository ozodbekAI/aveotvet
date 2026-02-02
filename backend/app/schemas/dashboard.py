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
    draftsReady: int = 0

    # Reviews-only KPIs ("Отзывы" tab). For other tabs they will be 0.
    avgRating: float = 0.0
    positiveShare: int = 0
    
    # Extended stats for tooltips
    processedBySystem: int = 0  # Обработано системой (AI drafts/answered)
    periodGrowth: int = 0       # Прирост за период
    awaitingProcessing: int = 0  # Ожидают обработки
    
    # Chat specific
    closed: int = 0             # Закрыто чатов
    active: int = 0             # Активных чатов
    
    # Negative feedbacks waiting >24h
    negativeWaiting24h: int = 0


class RatingDistribution(BaseModel):
    """Rating breakdown (1-5 stars)."""
    stars5: int = 0
    stars4: int = 0
    stars3: int = 0
    stars2: int = 0
    stars1: int = 0
    
    # Period growth per rating
    stars5Growth: int = 0
    stars4Growth: int = 0
    stars3Growth: int = 0
    stars2Growth: int = 0
    stars1Growth: int = 0
    
    totalRated: int = 0


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
    ratingDistribution: RatingDistribution | None = None


class DashboardSyncOut(BaseModel):
    queued: int
    skipped: int
    job_ids: list[int]


class AttentionItem(BaseModel):
    """Item requiring user attention on dashboard."""
    type: str  # "negative_reviews", "pending_drafts", "unanswered_questions", "active_chats"
    count: int
    title: str
    subtitle: str
    severity: str  # "high", "medium", "low"
    link: str


class DashboardMainOut(BaseModel):
    """Combined dashboard response for main page."""
    feedbacks: DashboardKpis
    questions: DashboardKpis
    chats: DashboardKpis
    attentionItems: list[AttentionItem]
    ratingDistribution: RatingDistribution | None = None
    automationStatus: str  # "ok", "stale", "error"
    automationMode: str  # "autopilot", "control", "manual"
    syncInterval: str
    lastSyncAt: str | None = None
