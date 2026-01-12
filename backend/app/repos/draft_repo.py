from __future__ import annotations

from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.draft import FeedbackDraft
from app.models.feedback import Feedback
from app.models.enums import DraftStatus


class DraftRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self, 
        feedback_id: int, 
        text: str, 
        openai_model: str | None, 
        openai_response_id: str | None
    ) -> FeedbackDraft:
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
            select(FeedbackDraft)
            .where(FeedbackDraft.feedback_id == feedback_id)
            .order_by(desc(FeedbackDraft.id))
            .limit(1)
        )
        return res.scalar_one_or_none()

    async def get(self, draft_id: int) -> FeedbackDraft | None:
        res = await self.session.execute(
            select(FeedbackDraft).where(FeedbackDraft.id == draft_id)
        )
        return res.scalar_one_or_none()

    async def get_with_feedback(self, draft_id: int) -> FeedbackDraft | None:
        """Get draft with joined feedback data."""
        res = await self.session.execute(
            select(FeedbackDraft)
            .options(joinedload(FeedbackDraft.feedback))
            .where(FeedbackDraft.id == draft_id)
        )
        return res.scalar_one_or_none()

    async def list_by_shop(
        self,
        shop_id: int,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[FeedbackDraft], int]:
        """List all drafts for a shop with optional status filter."""
        query = (
            select(FeedbackDraft)
            .join(Feedback)
            .where(Feedback.shop_id == shop_id)
            .options(joinedload(FeedbackDraft.feedback))
            .order_by(desc(FeedbackDraft.created_at))
        )
        
        if status:
            query = query.where(FeedbackDraft.status == status)
        
        # Get total count
        count_query = (
            select(func.count(FeedbackDraft.id))
            .join(Feedback)
            .where(Feedback.shop_id == shop_id)
        )
        if status:
            count_query = count_query.where(FeedbackDraft.status == status)
        
        count_result = await self.session.execute(count_query)
        total = count_result.scalar() or 0
        
        # Get paginated results
        query = query.limit(limit).offset(offset)
        result = await self.session.execute(query)
        drafts = list(result.scalars().all())
        
        return drafts, total

    async def list_pending(
        self,
        shop_id: int,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[FeedbackDraft], int]:
        """
        List pending drafts (status='drafted') for a shop.
        These are auto-generated drafts waiting for review.
        """
        return await self.list_by_shop(
            shop_id=shop_id,
            status="drafted",
            limit=limit,
            offset=offset
        )

    async def get_stats(self, shop_id: int) -> dict:
        """Get draft statistics for a shop."""
        from app.models.enums import DraftStatus
        
        # Count by status
        drafted_query = (
            select(func.count(FeedbackDraft.id))
            .join(Feedback)
            .where(Feedback.shop_id == shop_id)
            .where(FeedbackDraft.status == DraftStatus.drafted.value)
        )
        
        published_query = (
            select(func.count(FeedbackDraft.id))
            .join(Feedback)
            .where(Feedback.shop_id == shop_id)
            .where(FeedbackDraft.status == DraftStatus.published.value)
        )
        
        rejected_query = (
            select(func.count(FeedbackDraft.id))
            .join(Feedback)
            .where(Feedback.shop_id == shop_id)
            .where(FeedbackDraft.status == DraftStatus.rejected.value)
        )
        
        total_query = (
            select(func.count(FeedbackDraft.id))
            .join(Feedback)
            .where(Feedback.shop_id == shop_id)
        )
        
        drafted_result = await self.session.execute(drafted_query)
        published_result = await self.session.execute(published_query)
        rejected_result = await self.session.execute(rejected_query)
        total_result = await self.session.execute(total_query)
        
        return {
            "total": total_result.scalar() or 0,
            "drafted": drafted_result.scalar() or 0,
            "published": published_result.scalar() or 0,
            "rejected": rejected_result.scalar() or 0,
        }

    async def count_pending_by_shop(self, shop_id: int) -> int:
        """Quick count of pending drafts for a shop."""
        from app.models.enums import DraftStatus
        
        query = (
            select(func.count(FeedbackDraft.id))
            .join(Feedback)
            .where(Feedback.shop_id == shop_id)
            .where(FeedbackDraft.status == DraftStatus.drafted.value)
        )
        
        result = await self.session.execute(query)
        return result.scalar() or 0
    
    async def update_text(
        self,
        draft_id: int,
        *,
        text: str,
        openai_model: str | None,
        openai_response_id: str | None,
    ) -> FeedbackDraft | None:
        res = await self.session.execute(
            select(FeedbackDraft).where(FeedbackDraft.id == draft_id)
        )
        d = res.scalar_one_or_none()
        if not d:
            return None

        d.text = text
        d.openai_model = openai_model
        d.openai_response_id = openai_response_id

        # ixtiyoriy: regenerate bo'lsa status qayta drafted bo'lsin
        if hasattr(d, "status"):
            d.status = DraftStatus.drafted.value if "DraftStatus" in globals() else "drafted"

        await self.session.flush()
        return d