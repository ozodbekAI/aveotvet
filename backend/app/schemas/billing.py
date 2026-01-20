from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class LedgerItem(BaseModel):
    id: int
    delta: int
    balance_after: int
    reason: str
    meta: dict
    created_at: datetime

    class Config:
        from_attributes = True


class BillingMeResponse(BaseModel):
    credits_balance: int
    credits_spent: int
    recent: list[LedgerItem]


class ShopBillingResponse(BaseModel):
    shop_id: int
    credits_balance: int
    credits_spent: int
    recent: list[LedgerItem]


class BillingShopsResponse(BaseModel):
    shops: list[ShopBillingResponse]