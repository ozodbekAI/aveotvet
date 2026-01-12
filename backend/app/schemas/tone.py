from __future__ import annotations

from pydantic import BaseModel, Field


class ToneOut(BaseModel):
    id: int
    code: str
    label: str
    hint: str | None = None
    instruction: str | None = None
    sort_order: int = 0
    is_active: bool = True


class ToneCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=64)
    label: str = Field(..., min_length=1, max_length=128)
    hint: str | None = Field(None, max_length=255)
    instruction: str | None = None
    sort_order: int = 0
    is_active: bool = True


class ToneUpdate(BaseModel):
    label: str | None = Field(None, min_length=1, max_length=128)
    hint: str | None = Field(None, max_length=255)
    instruction: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None