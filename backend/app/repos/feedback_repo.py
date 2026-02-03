from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import select, func, and_, or_, desc, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.feedback import Feedback
from app.models.draft import FeedbackDraft


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
        date_from_unix: int | None = None,
        date_to_unix: int | None = None,
        rating: int | None = None,
        rating_min: int | None = None,
        rating_max: int | None = None,
        has_text: bool | None = None,
        has_media: bool | None = None,
    ) -> tuple[list[Feedback], int]:
        cond = [Feedback.shop_id == shop_id]
        if is_answered is True:
            cond.append(Feedback.answer_text.is_not(None))
        elif is_answered is False:
            cond.append(Feedback.answer_text.is_(None))
        if user_name:
            cond.append(Feedback.user_name == user_name)
        # Date range
        if date_from_unix is not None:
            dt_from = datetime.fromtimestamp(int(date_from_unix), tz=timezone.utc)
            cond.append(Feedback.created_date >= dt_from)
        if date_to_unix is not None:
            dt_to = datetime.fromtimestamp(int(date_to_unix), tz=timezone.utc)
            cond.append(Feedback.created_date <= dt_to)

        # Rating filter - support both exact and range
        if rating is not None:
            cond.append(Feedback.product_valuation == int(rating))
        elif rating_min is not None or rating_max is not None:
            if rating_min is not None:
                cond.append(Feedback.product_valuation >= int(rating_min))
            if rating_max is not None:
                cond.append(Feedback.product_valuation <= int(rating_max))

        # Text presence
        if has_text is True:
            cond.append(and_(Feedback.text.is_not(None), func.length(func.trim(Feedback.text)) > 0))
        elif has_text is False:
            cond.append(or_(Feedback.text.is_(None), func.length(func.trim(Feedback.text)) == 0))

        # Media presence (photoLinks or video)
        # NB: In some historical records photo_links may be a scalar JSON value.
        # jsonb_array_length() throws for scalars, so we guard by jsonb_typeof(...)=array.
        photo_len = case(
            (func.jsonb_typeof(Feedback.photo_links) == "array", func.jsonb_array_length(Feedback.photo_links)),
            else_=0,
        )
        if has_media is True:
            cond.append(or_(photo_len > 0, Feedback.video.is_not(None)))
        elif has_media is False:
            cond.append(and_(photo_len == 0, Feedback.video.is_(None)))

        if q:
            qv = q.strip()
            like = f"%{qv}%"

            exprs = [
                Feedback.text.ilike(like),
                Feedback.pros.ilike(like),
                Feedback.cons.ilike(like),
                Feedback.user_name.ilike(like),
                # Search product details (name, brand, supplier article)
                Feedback.product_details["productName"].astext.ilike(like),
                Feedback.product_details["brandName"].astext.ilike(like),
                Feedback.product_details["supplierArticle"].astext.ilike(like),
            ]

            # Also search by nm_id column directly
            if qv.isdigit():
                exprs.append(Feedback.nm_id == int(qv))
                # Direct match by nmId / imtId stored in productDetails
                exprs.append(Feedback.product_details["nmId"].astext == qv)
                exprs.append(Feedback.product_details["nmID"].astext == qv)
                exprs.append(Feedback.product_details["imtId"].astext == qv)

            cond.append(or_(*exprs))

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

    async def list_unanswered_without_drafts(self, shop_id: int, *, limit: int) -> list[Feedback]:
        """Return newest unanswered feedbacks that do not yet have any draft."""
        q = (
            select(Feedback)
            .outerjoin(FeedbackDraft, FeedbackDraft.feedback_id == Feedback.id)
            .where(Feedback.shop_id == shop_id)
            .where(Feedback.answer_text.is_(None))
            .where(FeedbackDraft.id.is_(None))
            .order_by(desc(Feedback.created_date))
            .limit(int(limit))
        )
        rows = await self.session.execute(q)
        return list(rows.scalars().all())

    async def get_product_analytics(self, shop_id: int, limit: int = 5) -> dict:
        """
        Return analytics grouped by product:
        - top_products: products with most positive reviews (4-5 stars)
        - problem_products: products with most negative reviews (1-2 stars)
        """
        from datetime import timedelta

        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)

        # Get product name from JSONB
        product_name_expr = Feedback.product_details["productName"].astext

        # Top products (rating 4-5)
        top_q = (
            select(
                product_name_expr.label("product_name"),
                func.count().label("total_count"),
                func.sum(
                    case((Feedback.created_date >= week_ago, 1), else_=0)
                ).label("recent_count"),
            )
            .where(
                Feedback.shop_id == shop_id,
                Feedback.product_valuation.in_([4, 5]),
                product_name_expr.isnot(None),
            )
            .group_by(product_name_expr)
            .order_by(func.count().desc())
            .limit(limit)
        )
        top_rows = (await self.session.execute(top_q)).mappings().all()

        # Problem products (rating 1-2)
        problem_q = (
            select(
                product_name_expr.label("product_name"),
                func.count().label("total_count"),
                func.sum(
                    case((Feedback.created_date >= week_ago, 1), else_=0)
                ).label("recent_count"),
            )
            .where(
                Feedback.shop_id == shop_id,
                Feedback.product_valuation.in_([1, 2]),
                product_name_expr.isnot(None),
            )
            .group_by(product_name_expr)
            .order_by(func.count().desc())
            .limit(limit)
        )
        problem_rows = (await self.session.execute(problem_q)).mappings().all()

        return {
            "top_products": [
                {
                    "name": row["product_name"],
                    "count": row["total_count"],
                    "recent": row["recent_count"] or 0,
                }
                for row in top_rows
            ],
            "problem_products": [
                {
                    "name": row["product_name"],
                    "count": row["total_count"],
                    "recent": row["recent_count"] or 0,
                }
                for row in problem_rows
            ],
        }
