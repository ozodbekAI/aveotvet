from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class PaymentCreateIn(BaseModel):
    shop_id: int
    amount_rub: float
    source: str = "manual"
    comment: str | None = None


class PaymentOut(BaseModel):
    id: int
    shop_id: int
    amount_rub: float
    source: str
    comment: str | None = None
    created_at: datetime
