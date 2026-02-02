from __future__ import annotations

from pydantic import BaseModel, Field


class ShopCreate(BaseModel):
    # Name is optional: we auto-detect it from WB seller-info using wb_token.
    name: str | None = Field(default=None, max_length=120)
    wb_token: str = Field(min_length=20)


class ShopTokenVerifyIn(BaseModel):
    wb_token: str = Field(min_length=20)


class ShopTokenVerifyOut(BaseModel):
    ok: bool
    name: str | None = None
    sid: str | None = None
    tradeMark: str | None = None
    # The value we will use as shop name.
    shop_name: str | None = None


class ShopOut(BaseModel):
    id: int
    name: str
    my_role: str | None = None

    class Config:
        from_attributes = True
