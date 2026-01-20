from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel


class BuyerListItem(BaseModel):
    user_name: str
    total_feedbacks: int
    unanswered_feedbacks: int
    last_feedback_at: datetime | None = None

    total_questions: int = 0
    unanswered_questions: int = 0
    last_question_at: datetime | None = None


class BuyerThreadItem(BaseModel):
    item_type: str = "feedback"  
    wb_id: str
    created_date: datetime
    product_valuation: int | None = None
    text: str | None = None
    answer_text: str | None = None
    product_details: dict | None = None
