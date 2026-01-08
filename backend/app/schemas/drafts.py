from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel


class DraftOut(BaseModel):
    id: int
    feedback_id: int
    status: str
    text: str
    openai_model: str | None = None
    openai_response_id: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True
