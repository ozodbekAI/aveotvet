from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class QuestionListItem(BaseModel):
    wb_id: str
    created_date: datetime
    user_name: str | None = None
    text: str | None = None
    state: str | None = None
    was_viewed: bool
    answer_text: str | None = None
    product_details: dict | None = None

    class Config:
        from_attributes = True


class QuestionDetail(QuestionListItem):
    raw: dict | None = None


class QuestionSyncRequest(BaseModel):
    is_answered: bool = Field(default=False)
    take: int = Field(default=100, ge=1, le=1000)
    skip: int = Field(default=0, ge=0)
    order: str = Field(default="dateDesc")
    date_from_unix: int | None = None
    date_to_unix: int | None = None


class QuestionAnswerRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
