from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel


class JobOut(BaseModel):
    id: int
    type: str
    status: str
    attempts: int
    max_attempts: int
    run_at: datetime
    payload: dict
    last_error: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
