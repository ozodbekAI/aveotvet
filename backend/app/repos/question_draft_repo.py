from __future__ import annotations

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.question_draft import QuestionDraft


class QuestionDraftRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, draft_id: int) -> QuestionDraft | None:
        return await self.session.get(QuestionDraft, draft_id)

    async def latest_for_question(self, question_id: int) -> QuestionDraft | None:
        res = await self.session.execute(
            select(QuestionDraft)
            .where(QuestionDraft.question_id == question_id)
            .order_by(desc(QuestionDraft.created_at))
            .limit(1)
        )
        return res.scalar_one_or_none()

    async def create(
        self,
        *,
        question_id: int,
        text: str,
        openai_model: str | None = None,
        openai_response_id: str | None = None,
        prompt_version: str = "v1",
    ) -> QuestionDraft:
        d = QuestionDraft(
            question_id=question_id,
            text=text,
            openai_model=openai_model,
            openai_response_id=openai_response_id,
            prompt_version=prompt_version,
        )
        self.session.add(d)
        await self.session.flush()
        return d