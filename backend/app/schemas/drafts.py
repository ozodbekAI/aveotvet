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

from datetime import datetime
from pydantic import BaseModel, Field


class FeedbackShortInfo(BaseModel):
    """Short feedback info for draft list."""
    id: int
    wb_id: str
    # WB feedback timestamp (preferred for UI)
    created_date: datetime

    user_name: str | None
    text: str | None
    pros: str | None = None
    cons: str | None = None
    product_valuation: int | None
    was_viewed: bool | None = None

    # Answer info (if already published on WB)
    answer_text: str | None = None
    answer_editable: bool | None = None

    # Product info (needed for WB-like table + detail panel)
    product_details: dict | None = None

    # Derived helper fields (read from Feedback properties)
    nm_id: int | None = None
    product_name: str | None = None
    supplier_article: str | None = None
    brand_name: str | None = None
    product_image_url: str | None = None
    
    class Config:
        from_attributes = True


class DraftListItem(BaseModel):
    """Draft list item with basic info."""
    id: int
    feedback_id: int
    status: str
    text: str
    created_at: datetime
    published_at: datetime | None
    
    feedback: FeedbackShortInfo
    
    class Config:
        from_attributes = True


class DraftDetail(BaseModel):
    """Full draft details."""
    id: int
    feedback_id: int
    status: str
    text: str
    openai_model: str | None
    openai_response_id: str | None
    prompt_version: str
    error: str | None
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None
    
    # Include feedback info (with product fields)
    feedback: FeedbackShortInfo
    
    class Config:
        from_attributes = True


class DraftUpdateRequest(BaseModel):
    """Request to update draft."""
    text: str | None = Field(default=None, description="Updated draft text")
    status: str | None = Field(
        default=None, 
        description="Draft status: drafted|published|rejected"
    )


class DraftStats(BaseModel):
    """Draft statistics."""
    total: int = Field(description="Total drafts")
    drafted: int = Field(description="Pending drafts waiting for review")
    published: int = Field(description="Published drafts")
    rejected: int = Field(description="Rejected drafts")