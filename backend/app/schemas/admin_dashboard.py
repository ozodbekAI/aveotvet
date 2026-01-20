from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel


class SystemHealthOut(BaseModel):
    active_shops: int
    shops_with_sync_errors: int
    generation_queue_size: int
    generation_errors_24h: int
    autopublish_enabled_shops: int
    autopublish_errors_24h: int


class IncidentItem(BaseModel):
    shop_id: int
    shop_name: str
    incident_type: str
    since: datetime | None = None


class IncidentsOut(BaseModel):
    items: list[IncidentItem] = []


class FinanceSummaryOut(BaseModel):
    period: str
    date_from: datetime | None = None
    date_to: datetime | None = None

    money_received_rub: float = 0
    gpt_cost_rub: float = 0
    gross_result_rub: float = 0


class GptCostBreakdownRow(BaseModel):
    operation_type: str
    gpt_cost_rub: float
    percent: float


class FinanceBreakdownOut(BaseModel):
    summary: FinanceSummaryOut
    breakdown: list[GptCostBreakdownRow] = []
    top_shops: list[dict] = []
    incidents: list[dict] = []


class OpsSummaryOut(BaseModel):
    jobs_pending: int = 0
    jobs_running: int = 0
    jobs_failed_24h: int = 0
    jobs_retrying: int = 0
    avg_generation_time_sec: float = 0


class ErrorRow(BaseModel):
    error_type: str
    count_24h: int
    last_seen: datetime | None = None


class OpsDashboardOut(BaseModel):
    summary: OpsSummaryOut
    errors: list[ErrorRow] = []


class ShopDashboardOut(BaseModel):
    shop_id: int
    shop_name: str
    sync_status: str | None = None
    last_sync_at: datetime | None = None
    balance: int | None = None
    gpt_cost_24h_rub: float = 0
    responses_generated_24h: int = 0
    responses_published_24h: int = 0
