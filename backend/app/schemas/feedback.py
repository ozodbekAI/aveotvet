from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel


class FeedbackListItem(BaseModel):
    wb_id: str
    created_date: datetime
    product_valuation: int | None = None
    user_name: str | None = None
    text: str | None = None
    pros: str | None = None
    cons: str | None = None
    was_viewed: bool
    answer_text: str | None = None
    answer_editable: bool | None = None
    product_details: dict | None = None

    nm_id: int | None = None
    product_image_url: str | None = None

    class Config:
        from_attributes = True


class FeedbackDetail(FeedbackListItem):
    photo_links: list | None = None
    video: dict | None = None
    bables: list | None = None
    raw: dict


class SyncRequest(BaseModel):
    # None means "all" (both answered and unanswered)
    is_answered: bool | None = None
    date_from_unix: int | None = None
    date_to_unix: int | None = None
    order: str = "dateDesc"
    take: int = 500
    skip: int = 0


class AnswerRequest(BaseModel):
    text: str


class DraftCreateResponse(BaseModel):
    draft_id: int
    status: str
    text: str


class BulkDraftRequest(BaseModel):
    limit: int = 30


class BulkDraftResponse(BaseModel):
    queued: int
    skipped_existing: int
    limited_by_balance: bool
