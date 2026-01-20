from __future__ import annotations

from datetime import datetime, date, timedelta, timezone
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, func, and_, or_, desc, cast, Integer
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.api.access import require_shop_access
from app.models.enums import ShopMemberRole, UserRole, JobType
from app.models.shop import Shop
from app.models.shop_member import ShopMember
from app.models.feedback import Feedback
from app.models.question import Question
from app.models.chat import ChatSession
from app.repos.job_repo import JobRepo
from app.schemas.dashboard import (
    DashboardFeedbacksOut,
    DashboardKpis,
    DashboardLineBlock,
    DashboardLinePoint,
    DashboardMeta,
    DashboardSyncOut,
    DashboardTopBlock,
    DashboardTopItem,
)


router = APIRouter()


def _range_dates(
    *,
    range_days: int,
    period: str | None,
    date_from_unix: int | None,
    date_to_unix: int | None,
) -> tuple[date, date]:
    if date_from_unix is not None and date_to_unix is not None:
        d_from = datetime.fromtimestamp(int(date_from_unix), tz=timezone.utc).date()
        d_to = datetime.fromtimestamp(int(date_to_unix), tz=timezone.utc).date()
        if d_to < d_from:
            raise HTTPException(status_code=400, detail="date_to_unix must be >= date_from_unix")
        return d_from, d_to

    if period:
        p = period.strip().lower()
        if p == "all":
            # "Весь период" in UI. For dashboards we cap to 365 days to avoid huge daily time-series.
            range_days = 365
        else:
            m = re.match(r"^(\d{1,3})d$", p)
            if not m:
                raise HTTPException(status_code=400, detail="Invalid period format. Expected like '14d' or 'all'.")
            range_days = int(m.group(1))

    if range_days < 1 or range_days > 365:
        raise HTTPException(status_code=400, detail="range_days must be between 1 and 365")

    today = datetime.now(timezone.utc).date()
    d_from = today - timedelta(days=range_days - 1)
    return d_from, today


def _fmt_period(d_from: date, d_to: date) -> str:
    return f"{d_from.strftime('%d.%m')} — {d_to.strftime('%d.%m')}"


def _date_bounds_utc(d_from: date, d_to: date) -> tuple[datetime, datetime]:
    dt_from = datetime(d_from.year, d_from.month, d_from.day, tzinfo=timezone.utc)
    # inclusive end of day
    dt_to = datetime(d_to.year, d_to.month, d_to.day, 23, 59, 59, tzinfo=timezone.utc)
    return dt_from, dt_to


async def _accessible_shop_ids(db: AsyncSession, request: Request, user, shop_id: int | None) -> list[int]:
    if shop_id is not None:
        (await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)).shop
        return [int(shop_id)]

    # "Все магазины" = all accessible shops.
    if getattr(user, "role", "user") == UserRole.super_admin.value:
        res = await db.execute(select(Shop.id).order_by(Shop.id))
        return [int(x) for x in res.scalars().all()]

    # owner shops
    res_owner = await db.execute(select(Shop.id).where(Shop.owner_user_id == user.id))
    owner_ids = set(int(x) for x in res_owner.scalars().all())

    # member shops
    res_mem = await db.execute(select(ShopMember.shop_id).where(ShopMember.user_id == user.id))
    member_ids = set(int(x) for x in res_mem.scalars().all())

    ids = sorted(owner_ids.union(member_ids))
    return ids


async def _feedbacks_kpis(db: AsyncSession, shop_ids: list[int], dt_from: datetime, dt_to: datetime) -> DashboardKpis:
    cond = [Feedback.shop_id.in_(shop_ids), Feedback.created_date >= dt_from, Feedback.created_date <= dt_to]

    total_q = select(func.count()).select_from(Feedback).where(and_(*cond))
    total = int((await db.execute(total_q)).scalar_one() or 0)

    pending_q = select(func.count()).select_from(Feedback).where(and_(*cond, Feedback.answer_text.is_(None)))
    pending = int((await db.execute(pending_q)).scalar_one() or 0)

    answered = max(total - pending, 0)

    # Average rating across all reviews with rating set
    avg_q = select(func.avg(cast(Feedback.product_valuation, Integer))).where(and_(*cond, Feedback.product_valuation.is_not(None)))
    avg_val = (await db.execute(avg_q)).scalar_one()
    avg_rating = float(avg_val or 0.0)

    # Positive share = % of ratings 4-5 among rated reviews
    rated_cnt_q = select(func.count()).select_from(Feedback).where(and_(*cond, Feedback.product_valuation.is_not(None)))
    rated_cnt = int((await db.execute(rated_cnt_q)).scalar_one() or 0)
    if rated_cnt > 0:
        pos_cnt_q = select(func.count()).select_from(Feedback).where(and_(*cond, Feedback.product_valuation.in_([4, 5])))
        pos_cnt = int((await db.execute(pos_cnt_q)).scalar_one() or 0)
        positive_share = int(round((pos_cnt / rated_cnt) * 100))
    else:
        positive_share = 0

    return DashboardKpis(
        total=total,
        pending=pending,
        unanswered=pending,
        answered=answered,
        avgRating=round(avg_rating, 1),
        positiveShare=positive_share,
    )


async def _timeseries_feedbacks(
    db: AsyncSession,
    shop_ids: list[int],
    d_from: date,
    d_to: date,
) -> list[DashboardLinePoint]:
    dt_from, dt_to = _date_bounds_utc(d_from, d_to)
    day_expr = func.date_trunc("day", Feedback.created_date).label("day")
    q = (
        select(day_expr, func.count().label("cnt"))
        .where(and_(Feedback.shop_id.in_(shop_ids), Feedback.created_date >= dt_from, Feedback.created_date <= dt_to))
        .group_by(day_expr)
        .order_by(day_expr)
    )
    rows = (await db.execute(q)).all()
    by_day: dict[date, int] = {}
    for day_dt, cnt in rows:
        try:
            by_day[day_dt.date()] = int(cnt)
        except Exception:
            continue

    out: list[DashboardLinePoint] = []
    cur = d_from
    while cur <= d_to:
        out.append(DashboardLinePoint(d=cur.strftime("%d.%m"), v=by_day.get(cur, 0)))
        cur = cur + timedelta(days=1)
    return out


async def _top_products_feedbacks(
    db: AsyncSession,
    shop_ids: list[int],
    dt_from: datetime,
    dt_to: datetime,
    *,
    positive: bool,
    limit: int,
) -> list[DashboardTopItem]:
    title_expr = Feedback.product_details["productName"].astext
    brand_expr = Feedback.product_details["brandName"].astext

    cond = [
        Feedback.shop_id.in_(shop_ids),
        Feedback.created_date >= dt_from,
        Feedback.created_date <= dt_to,
        title_expr.is_not(None),
    ]

    if positive:
        cond.append(Feedback.product_valuation.in_([4, 5]))
    else:
        # "Отрицательные" in UI: everything <= 3
        cond.append(Feedback.product_valuation.is_not(None))
        cond.append(Feedback.product_valuation <= 3)

    q = (
        select(
            title_expr.label("title"),
            brand_expr.label("brand"),
            func.count().label("cnt"),
        )
        .where(and_(*cond))
        .group_by(title_expr, brand_expr)
        .order_by(desc(func.count()))
        .limit(limit)
    )
    rows = (await db.execute(q)).mappings().all()
    out: list[DashboardTopItem] = []
    for r in rows:
        out.append(
            DashboardTopItem(
                title=str(r.get("title") or ""),
                brand=r.get("brand"),
                count=int(r.get("cnt") or 0),
            )
        )
    return out


@router.get("/feedbacks", response_model=DashboardFeedbacksOut)
async def dashboard_feedbacks(
    request: Request,
    shop_id: int | None = Query(default=None),
    period: str | None = Query(default=None, description="Frontend-style period, e.g. '7d', '14d', '30d'"),
    range_days: int = Query(default=14, ge=1, le=365),
    date_from_unix: int | None = Query(default=None),
    date_to_unix: int | None = Query(default=None),
    top_n: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    shop_ids = await _accessible_shop_ids(db, request, user, shop_id)
    if not shop_ids:
        raise HTTPException(status_code=404, detail="No accessible shops")

    d_from, d_to = _range_dates(range_days=range_days, period=period, date_from_unix=date_from_unix, date_to_unix=date_to_unix)
    dt_from, dt_to = _date_bounds_utc(d_from, d_to)

    kpis = await _feedbacks_kpis(db, shop_ids, dt_from, dt_to)
    current_line = await _timeseries_feedbacks(db, shop_ids, d_from, d_to)

    # Previous period for legend/compare
    eff_days = (d_to - d_from).days + 1
    prev_to = d_from - timedelta(days=1)
    prev_from = prev_to - timedelta(days=(eff_days - 1))
    prev_line = await _timeseries_feedbacks(db, shop_ids, prev_from, prev_to)

    top_pos = await _top_products_feedbacks(db, shop_ids, dt_from, dt_to, positive=True, limit=top_n)
    top_neg = await _top_products_feedbacks(db, shop_ids, dt_from, dt_to, positive=False, limit=top_n)

    return DashboardFeedbacksOut(
        meta=DashboardMeta(shop_ids=shop_ids, range_days=eff_days, date_from=d_from, date_to=d_to),
        kpis=kpis,
        line=DashboardLineBlock(
            data=current_line,
            periodText=_fmt_period(d_from, d_to),
            previousData=prev_line,
            previousPeriodText=_fmt_period(prev_from, prev_to),
        ),
        top=DashboardTopBlock(positive=top_pos, negative=top_neg),
    )


@router.post("/feedbacks/sync", response_model=DashboardSyncOut)
async def dashboard_feedbacks_sync(
    request: Request,
    shop_id: int | None = Query(default=None),
    period: str | None = Query(default=None, description="Frontend-style period, e.g. '7d', '14d', '30d'"),
    range_days: int = Query(default=14, ge=1, le=365),
    date_from_unix: int | None = Query(default=None),
    date_to_unix: int | None = Query(default=None),
    take: int = Query(default=5000, ge=1, le=20000),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    shop_ids = await _accessible_shop_ids(db,request, user, shop_id)
    if not shop_ids:
        raise HTTPException(status_code=404, detail="No accessible shops")

    # Use same window for sync.
    d_from, d_to = _range_dates(range_days=range_days, period=period, date_from_unix=date_from_unix, date_to_unix=date_to_unix)
    dt_from, dt_to = _date_bounds_utc(d_from, d_to)
    from_unix = int(dt_from.timestamp())
    to_unix = int(dt_to.timestamp())

    repo = JobRepo(db)
    queued = 0
    skipped = 0
    job_ids: list[int] = []
    for sid in shop_ids:
        # avoid spamming queue: if recent pending sync exists, skip
        if await repo.exists_pending_for_shop(JobType.sync_shop.value, sid):
            skipped += 1
            continue

        for is_answered in (False, True):
            job = await repo.enqueue(
                type=JobType.sync_shop.value,
                payload={
                    "shop_id": sid,
                    "is_answered": is_answered,
                    "date_from_unix": from_unix,
                    "date_to_unix": to_unix,
                    "order": "dateDesc",
                    "take": take,
                    "skip": 0,
                },
            )
            queued += 1
            job_ids.append(job.id)

    await db.commit()
    return DashboardSyncOut(queued=queued, skipped=skipped, job_ids=job_ids)


# Aliases for earlier naming (if frontend or docs refer to reviews)
@router.get("/reviews", response_model=DashboardFeedbacksOut)
async def dashboard_reviews_alias(
    request: Request,
    shop_id: int | None = Query(default=None),
    period: str | None = Query(default=None, description="Frontend-style period, e.g. '7d', '14d', '30d'"),
    range_days: int = Query(default=14, ge=1, le=365),
    date_from_unix: int | None = Query(default=None),
    date_to_unix: int | None = Query(default=None),
    top_n: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    return await dashboard_feedbacks(
        shop_id=shop_id,
        period=period,
        range_days=range_days,
        date_from_unix=date_from_unix,
        date_to_unix=date_to_unix,
        top_n=top_n,
        db=db,
        user=user,
    )


@router.post("/reviews/sync", response_model=DashboardSyncOut)
async def dashboard_reviews_sync_alias(
    request: Request,
    shop_id: int | None = Query(default=None),
    period: str | None = Query(default=None, description="Frontend-style period, e.g. '7d', '14d', '30d'"),
    range_days: int = Query(default=14, ge=1, le=365),
    date_from_unix: int | None = Query(default=None),
    date_to_unix: int | None = Query(default=None),
    take: int = Query(default=5000, ge=1, le=20000),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    return await dashboard_feedbacks_sync(
        shop_id=shop_id,
        period=period,
        range_days=range_days,
        date_from_unix=date_from_unix,
        date_to_unix=date_to_unix,
        take=take,
        db=db,
        user=user,
    )


# Questions/chats: lightweight placeholders so frontend can already integrate tabs.
@router.get("/questions", response_model=DashboardFeedbacksOut)
async def dashboard_questions(
    request: Request,
    shop_id: int | None = Query(default=None),
    period: str | None = Query(default=None, description="Frontend-style period, e.g. '7d', '14d', '30d'"),
    range_days: int = Query(default=14, ge=1, le=365),
    date_from_unix: int | None = Query(default=None),
    date_to_unix: int | None = Query(default=None),
    top_n: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    shop_ids = await _accessible_shop_ids(db, request, user, shop_id)
    if not shop_ids:
        raise HTTPException(status_code=404, detail="No accessible shops")

    d_from, d_to = _range_dates(range_days=range_days, period=period, date_from_unix=date_from_unix, date_to_unix=date_to_unix)
    dt_from, dt_to = _date_bounds_utc(d_from, d_to)

    # KPIs (questions answered/unanswered)
    cond = [Question.shop_id.in_(shop_ids), Question.created_date >= dt_from, Question.created_date <= dt_to]
    total = int((await db.execute(select(func.count()).select_from(Question).where(and_(*cond)))).scalar_one() or 0)
    pending = int((await db.execute(select(func.count()).select_from(Question).where(and_(*cond, Question.answer_text.is_(None))))).scalar_one() or 0)
    answered = max(total - pending, 0)
    kpis = DashboardKpis(total=total, pending=pending, unanswered=pending, answered=answered, avgRating=0.0, positiveShare=0)

    # Timeseries: reuse same line format
    day_expr = func.date_trunc("day", Question.created_date).label("day")
    q = (
        select(day_expr, func.count().label("cnt"))
        .where(and_(Question.shop_id.in_(shop_ids), Question.created_date >= dt_from, Question.created_date <= dt_to))
        .group_by(day_expr)
        .order_by(day_expr)
    )
    rows = (await db.execute(q)).all()
    by_day: dict[date, int] = {r[0].date(): int(r[1]) for r in rows}
    data: list[DashboardLinePoint] = []
    cur = d_from
    while cur <= d_to:
        data.append(DashboardLinePoint(d=cur.strftime("%d.%m"), v=by_day.get(cur, 0)))
        cur += timedelta(days=1)

    # Previous
    eff_days = (d_to - d_from).days + 1
    prev_to = d_from - timedelta(days=1)
    prev_from = prev_to - timedelta(days=(eff_days - 1))
    prev_data = []
    # keep cheap: no extra query if not needed
    prev_data = await _timeseries_questions(db, shop_ids, prev_from, prev_to)

    # Top block not used yet for questions; return empty.
    return DashboardFeedbacksOut(
        meta=DashboardMeta(shop_ids=shop_ids, range_days=eff_days, date_from=d_from, date_to=d_to),
        kpis=kpis,
        line=DashboardLineBlock(
            data=data,
            periodText=_fmt_period(d_from, d_to),
            previousData=prev_data,
            previousPeriodText=_fmt_period(prev_from, prev_to),
        ),
        top=DashboardTopBlock(positive=[], negative=[]),
    )


async def _timeseries_questions(db: AsyncSession, shop_ids: list[int], d_from: date, d_to: date) -> list[DashboardLinePoint]:
    dt_from, dt_to = _date_bounds_utc(d_from, d_to)
    day_expr = func.date_trunc("day", Question.created_date).label("day")
    q = (
        select(day_expr, func.count().label("cnt"))
        .where(and_(Question.shop_id.in_(shop_ids), Question.created_date >= dt_from, Question.created_date <= dt_to))
        .group_by(day_expr)
        .order_by(day_expr)
    )
    rows = (await db.execute(q)).all()
    by_day: dict[date, int] = {}
    for day_dt, cnt in rows:
        try:
            by_day[day_dt.date()] = int(cnt)
        except Exception:
            continue
    out: list[DashboardLinePoint] = []
    cur = d_from
    while cur <= d_to:
        out.append(DashboardLinePoint(d=cur.strftime("%d.%m"), v=by_day.get(cur, 0)))
        cur += timedelta(days=1)
    return out


@router.post("/questions/sync", response_model=DashboardSyncOut)
async def dashboard_questions_sync(
    request: Request,
    shop_id: int | None = Query(default=None),
    period: str | None = Query(default=None, description="Frontend-style period, e.g. '7d', '14d', '30d'"),
    range_days: int = Query(default=14, ge=1, le=365),
    date_from_unix: int | None = Query(default=None),
    date_to_unix: int | None = Query(default=None),
    take: int = Query(default=5000, ge=1, le=20000),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    shop_ids = await _accessible_shop_ids(db, user, shop_id)
    if not shop_ids:
        raise HTTPException(status_code=404, detail="No accessible shops")

    d_from, d_to = _range_dates(range_days=range_days, period=period, date_from_unix=date_from_unix, date_to_unix=date_to_unix)
    dt_from, dt_to = _date_bounds_utc(d_from, d_to)
    from_unix = int(dt_from.timestamp())
    to_unix = int(dt_to.timestamp())

    repo = JobRepo(db)
    queued = 0
    skipped = 0
    job_ids: list[int] = []
    for sid in shop_ids:
        if await repo.exists_pending_for_shop(JobType.sync_questions.value, sid):
            skipped += 1
            continue
        for is_answered in (False, True):
            job = await repo.enqueue(
                type=JobType.sync_questions.value,
                payload={
                    "shop_id": sid,
                    "is_answered": is_answered,
                    "date_from_unix": from_unix,
                    "date_to_unix": to_unix,
                    "order": "dateDesc",
                    "take": take,
                    "skip": 0,
                },
            )
            queued += 1
            job_ids.append(job.id)
    await db.commit()
    return DashboardSyncOut(queued=queued, skipped=skipped, job_ids=job_ids)


@router.get("/chats", response_model=DashboardFeedbacksOut)
async def dashboard_chats(
    request: Request,
    shop_id: int | None = Query(default=None),
    period: str | None = Query(default=None, description="Frontend-style period, e.g. '7d', '14d', '30d'"),
    range_days: int = Query(default=14, ge=1, le=365),
    date_from_unix: int | None = Query(default=None),
    date_to_unix: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    shop_ids = await _accessible_shop_ids(db, request, user, shop_id)
    if not shop_ids:
        raise HTTPException(status_code=404, detail="No accessible shops")

    d_from, d_to = _range_dates(range_days=range_days, period=period, date_from_unix=date_from_unix, date_to_unix=date_to_unix)
    dt_from, dt_to = _date_bounds_utc(d_from, d_to)

    # Chats KPI: number of sessions updated in range.
    total = int(
        (await db.execute(
            select(func.count()).select_from(ChatSession).where(
                and_(ChatSession.shop_id.in_(shop_ids), ChatSession.updated_at >= dt_from, ChatSession.updated_at <= dt_to)
            )
        )).scalar_one() or 0
    )
    kpis = DashboardKpis(total=total, pending=0, unanswered=0, answered=0, avgRating=0.0, positiveShare=0)

    # Timeseries based on updated_at
    day_expr = func.date_trunc("day", ChatSession.updated_at).label("day")
    q = (
        select(day_expr, func.count().label("cnt"))
        .where(and_(ChatSession.shop_id.in_(shop_ids), ChatSession.updated_at >= dt_from, ChatSession.updated_at <= dt_to))
        .group_by(day_expr)
        .order_by(day_expr)
    )
    rows = (await db.execute(q)).all()
    by_day: dict[date, int] = {r[0].date(): int(r[1]) for r in rows}
    data: list[DashboardLinePoint] = []
    cur = d_from
    while cur <= d_to:
        data.append(DashboardLinePoint(d=cur.strftime("%d.%m"), v=by_day.get(cur, 0)))
        cur += timedelta(days=1)

    eff_days = (d_to - d_from).days + 1
    prev_to = d_from - timedelta(days=1)
    prev_from = prev_to - timedelta(days=(eff_days - 1))
    prev_data = await _timeseries_chats(db, shop_ids, prev_from, prev_to)

    return DashboardFeedbacksOut(
        meta=DashboardMeta(shop_ids=shop_ids, range_days=eff_days, date_from=d_from, date_to=d_to),
        kpis=kpis,
        line=DashboardLineBlock(
            data=data,
            periodText=_fmt_period(d_from, d_to),
            previousData=prev_data,
            previousPeriodText=_fmt_period(prev_from, prev_to),
        ),
        top=DashboardTopBlock(positive=[], negative=[]),
    )


async def _timeseries_chats(db: AsyncSession, shop_ids: list[int], d_from: date, d_to: date) -> list[DashboardLinePoint]:
    dt_from, dt_to = _date_bounds_utc(d_from, d_to)
    day_expr = func.date_trunc("day", ChatSession.updated_at).label("day")
    q = (
        select(day_expr, func.count().label("cnt"))
        .where(and_(ChatSession.shop_id.in_(shop_ids), ChatSession.updated_at >= dt_from, ChatSession.updated_at <= dt_to))
        .group_by(day_expr)
        .order_by(day_expr)
    )
    rows = (await db.execute(q)).all()
    by_day: dict[date, int] = {}
    for day_dt, cnt in rows:
        try:
            by_day[day_dt.date()] = int(cnt)
        except Exception:
            continue
    out: list[DashboardLinePoint] = []
    cur = d_from
    while cur <= d_to:
        out.append(DashboardLinePoint(d=cur.strftime("%d.%m"), v=by_day.get(cur, 0)))
        cur += timedelta(days=1)
    return out


@router.post("/chats/sync", response_model=DashboardSyncOut)
async def dashboard_chats_sync(
    request: Request,
    shop_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    shop_ids = await _accessible_shop_ids(db, user, shop_id)
    if not shop_ids:
        raise HTTPException(status_code=404, detail="No accessible shops")

    repo = JobRepo(db)
    queued = 0
    skipped = 0
    job_ids: list[int] = []
    for sid in shop_ids:
        if await repo.exists_pending_for_shop(JobType.sync_chats.value, sid):
            skipped += 1
            continue
        job = await repo.enqueue(type=JobType.sync_chats.value, payload={"shop_id": sid})
        queued += 1
        job_ids.append(job.id)
    await db.commit()
    return DashboardSyncOut(queued=queued, skipped=skipped, job_ids=job_ids)
