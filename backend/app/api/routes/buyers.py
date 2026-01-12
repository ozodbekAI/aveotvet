from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.api.access import require_shop_access
from app.models.enums import ShopMemberRole
from app.repos.feedback_repo import FeedbackRepo
from app.repos.question_repo import QuestionRepo
from app.schemas.buyers import BuyerListItem, BuyerThreadItem

router = APIRouter()


@router.get("/{shop_id}", response_model=list[BuyerListItem])
async def buyers_list(
    shop_id: int,
    q: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    (await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.viewer.value)).shop

    # Merge buyers stats from feedbacks + questions (Otveto-like "Threads" view)
    fb_rows, _ = await FeedbackRepo(db).buyers_agg(shop_id=shop_id, q=q, limit=limit, offset=offset)
    q_rows, _ = await QuestionRepo(db).buyers_agg(shop_id=shop_id, q=q, limit=limit, offset=offset)

    by: dict[str, dict] = {}
    for r in fb_rows:
        by[r["user_name"]] = {**r}
    for r in q_rows:
        u = r["user_name"]
        base = by.get(u) or {
            "user_name": u,
            "total_feedbacks": 0,
            "unanswered_feedbacks": 0,
            "last_feedback_at": None,
        }
        base.update(r)
        by[u] = base

    # Sort by most recent activity across feedback/question
    def _last_ts(v: dict):
        a = v.get("last_feedback_at")
        b = v.get("last_question_at")
        return max([x for x in [a, b] if x is not None], default=None)

    merged = list(by.values())
    merged.sort(key=lambda v: _last_ts(v) or 0, reverse=True)
    merged = merged[offset : offset + limit]
    return [BuyerListItem(**r) for r in merged]


@router.get("/{shop_id}/{user_name}/thread", response_model=list[BuyerThreadItem])
async def buyer_thread(
    shop_id: int,
    user_name: str,
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    (await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.viewer.value)).shop

    fb_rows, _ = await FeedbackRepo(db).list(shop_id=shop_id, is_answered=None, q=None, user_name=user_name, limit=limit, offset=0)
    q_rows, _ = await QuestionRepo(db).list(shop_id=shop_id, is_answered=None, q=None, user_name=user_name, limit=limit, offset=0)

    items: list[BuyerThreadItem] = []
    for r in fb_rows:
        items.append(
            BuyerThreadItem(
                item_type="feedback",
                wb_id=r.wb_id,
                created_date=r.created_date,
                product_valuation=r.product_valuation,
                text=r.text,
                answer_text=r.answer_text,
                product_details=r.product_details,
            )
        )
    for r in q_rows:
        items.append(
            BuyerThreadItem(
                item_type="question",
                wb_id=r.wb_id,
                created_date=r.created_date,
                product_valuation=None,
                text=r.text,
                answer_text=r.answer_text,
                product_details=r.product_details,
            )
        )

    items.sort(key=lambda it: it.created_date, reverse=True)
    return items[offset : offset + limit]
