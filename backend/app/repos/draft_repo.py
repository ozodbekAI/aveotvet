from __future__ import annotations

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.draft import FeedbackDraft


class DraftRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, feedback_id: int, text: str, openai_model: str | None, openai_response_id: str | None) -> FeedbackDraft:
        d = FeedbackDraft(
            feedback_id=feedback_id,
            text=text,
            openai_model=openai_model,
            openai_response_id=openai_response_id,
        )
        self.session.add(d)
        await self.session.flush()
        return d

    async def latest_for_feedback(self, feedback_id: int) -> FeedbackDraft | None:
        res = await self.session.execute(
            select(FeedbackDraft).where(FeedbackDraft.feedback_id == feedback_id).order_by(desc(FeedbackDraft.id)).limit(1)
        )
        return res.scalar_one_or_none()

    async def get(self, draft_id: int) -> FeedbackDraft | None:
        res = await self.session.execute(select(FeedbackDraft).where(FeedbackDraft.id == draft_id))
        return res.scalar_one_or_none()
