from __future__ import annotations

from datetime import datetime

from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.question import Question


class QuestionRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_wb_id(self, shop_id: int, wb_id: str) -> Question | None:
        res = await self.session.execute(select(Question).where(Question.shop_id == shop_id, Question.wb_id == wb_id))
        return res.scalar_one_or_none()

    async def upsert_from_wb(self, shop_id: int, payload: dict) -> Question:
        wb_id = str(payload.get("id"))
        created_date_raw = payload.get("createdDate")
        if not created_date_raw:
            raise ValueError("WB payload missing createdDate")
        created_date = created_date_raw if isinstance(created_date_raw, datetime) else datetime.fromisoformat(created_date_raw.replace("Z", "+00:00"))

        existing = await self.get_by_wb_id(shop_id=shop_id, wb_id=wb_id)
        if existing:
            q = existing
        else:
            q = Question(shop_id=shop_id, wb_id=wb_id, created_date=created_date)
            self.session.add(q)

        q.text = payload.get("text")
        q.user_name = payload.get("userName")
        q.state = payload.get("state")
        q.was_viewed = bool(payload.get("wasViewed", False))

        ans = payload.get("answer") or {}
        q.answer_text = ans.get("text")
        q.answer_editable = ans.get("editable")

        q.product_details = payload.get("productDetails")
        q.raw = payload

        await self.session.flush()
        return q

    async def list(
        self,
        shop_id: int,
        is_answered: bool | None,
        q: str | None,
        user_name: str | None,
        limit: int,
        offset: int,
    ) -> tuple[list[Question], int]:
        cond = [Question.shop_id == shop_id]
        if is_answered is True:
            cond.append(Question.answer_text.is_not(None))
        elif is_answered is False:
            cond.append(Question.answer_text.is_(None))
        if user_name:
            cond.append(Question.user_name == user_name)
        if q:
            like = f"%{q}%"
            cond.append(or_(Question.text.ilike(like),))

        base = select(Question).where(and_(*cond))
        total_q = select(func.count()).select_from(base.subquery())
        total = (await self.session.execute(total_q)).scalar_one()

        rows = await self.session.execute(base.order_by(desc(Question.created_date)).limit(limit).offset(offset))
        return list(rows.scalars().all()), total

    async def buyers_agg(self, shop_id: int, q: str | None, limit: int, offset: int):
        cond = [Question.shop_id == shop_id, Question.user_name.is_not(None)]
        if q:
            cond.append(Question.user_name.ilike(f"%{q}%"))

        sub = (
            select(
                Question.user_name.label("user_name"),
                func.count().label("total_questions"),
                func.sum(func.case((Question.answer_text.is_(None), 1), else_=0)).label("unanswered_questions"),
                func.max(Question.created_date).label("last_question_at"),
            )
            .where(and_(*cond))
            .group_by(Question.user_name)
            .order_by(func.max(Question.created_date).desc())
            .limit(limit)
            .offset(offset)
        )
        rows = (await self.session.execute(sub)).mappings().all()

        total_q = select(func.count()).select_from(
            select(Question.user_name).where(and_(*cond)).group_by(Question.user_name).subquery()
        )
        total = (await self.session.execute(total_q)).scalar_one()
        return rows, total
