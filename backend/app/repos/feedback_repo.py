from __future__ import annotations

from datetime import datetime
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.feedback import Feedback


class FeedbackRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_wb_id(self, shop_id: int, wb_id: str) -> Feedback | None:
        res = await self.session.execute(select(Feedback).where(Feedback.shop_id == shop_id, Feedback.wb_id == wb_id))
        return res.scalar_one_or_none()

    async def upsert_from_wb(self, shop_id: int, payload: dict) -> Feedback:
        wb_id = str(payload.get("id"))
        created_date_raw = payload.get("createdDate")
        if not created_date_raw:
            raise ValueError("WB payload missing createdDate")
        # parse ISO string in app.services.wb_client; here we accept datetime already or string
        created_date = created_date_raw if isinstance(created_date_raw, datetime) else datetime.fromisoformat(created_date_raw.replace("Z", "+00:00"))

        existing = await self.get_by_wb_id(shop_id=shop_id, wb_id=wb_id)
        if existing:
            fb = existing
        else:
            fb = Feedback(shop_id=shop_id, wb_id=wb_id, created_date=created_date)
            self.session.add(fb)

        fb.text = payload.get("text")
        fb.pros = payload.get("pros")
        fb.cons = payload.get("cons")
        fb.product_valuation = payload.get("productValuation")
        fb.user_name = payload.get("userName")
        fb.state = payload.get("state")
        fb.was_viewed = bool(payload.get("wasViewed", False))

        ans = payload.get("answer") or {}
        fb.answer_text = ans.get("text")
        fb.answer_state = ans.get("state")
        fb.answer_editable = ans.get("editable")

        fb.product_details = payload.get("productDetails")
        fb.photo_links = payload.get("photoLinks")
        fb.video = payload.get("video")
        fb.bables = payload.get("bables")
        fb.raw = payload

        await self.session.flush()
        return fb

    async def list(
        self,
        shop_id: int,
        is_answered: bool | None,
        q: str | None,
        user_name: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[Feedback], int]:
        cond = [Feedback.shop_id == shop_id]
        if is_answered is True:
            cond.append(Feedback.answer_text.is_not(None))
        elif is_answered is False:
            cond.append(Feedback.answer_text.is_(None))
        if user_name:
            cond.append(Feedback.user_name == user_name)
        if q:
            like = f"%{q}%"
            cond.append(
                or_(
                    Feedback.text.ilike(like),
                    Feedback.pros.ilike(like),
                    Feedback.cons.ilike(like),
                )
            )

        base = select(Feedback).where(and_(*cond))
        total_q = select(func.count()).select_from(base.subquery())
        total = (await self.session.execute(total_q)).scalar_one()

        rows = await self.session.execute(
            base.order_by(desc(Feedback.created_date)).limit(limit).offset(offset)
        )
        return list(rows.scalars().all()), total

    async def buyers_agg(self, shop_id: int, q: str | None, limit: int, offset: int):
        # aggregate by user_name
        cond = [Feedback.shop_id == shop_id, Feedback.user_name.is_not(None)]
        if q:
            cond.append(Feedback.user_name.ilike(f"%{q}%"))

        sub = (
            select(
                Feedback.user_name.label("user_name"),
                func.count().label("total_feedbacks"),
                func.sum(func.case((Feedback.answer_text.is_(None), 1), else_=0)).label("unanswered_feedbacks"),
                func.max(Feedback.created_date).label("last_feedback_at"),
            )
            .where(and_(*cond))
            .group_by(Feedback.user_name)
            .order_by(func.max(Feedback.created_date).desc())
            .limit(limit)
            .offset(offset)
        )
        rows = (await self.session.execute(sub)).mappings().all()

        total_q = select(func.count()).select_from(
            select(Feedback.user_name)
            .where(and_(*cond))
            .group_by(Feedback.user_name)
            .subquery()
        )
        total = (await self.session.execute(total_q)).scalar_one()
        return rows, total
