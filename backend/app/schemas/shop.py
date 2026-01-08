from __future__ import annotations

from pydantic import BaseModel, Field


class ShopCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    wb_token: str = Field(min_length=20)


class ShopOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True
