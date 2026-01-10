from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.api.deps import get_db, get_current_user
from app.repos.shop_repo import ShopRepo
from app.repos.feedback_repo import FeedbackRepo
from app.repos.product_card_repo import ProductCardRepo
from app.repos.draft_repo import DraftRepo
from app.repos.job_repo import JobRepo
from app.models.enums import JobType
from app.schemas.feedback import (
    FeedbackListItem,
    FeedbackDetail,
    SyncRequest,
    AnswerRequest,
    DraftCreateResponse,
)
from app.services.openai_client import OpenAIService
from app.services.drafting import generate_draft_text
from app.services.wb_client import WBClient
from app.core.crypto import decrypt_secret
from app.core.config import settings


log = logging.getLogger(__name__)

router = APIRouter()


def _get_shop_or_404(shop):
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


@router.post("/{shop_id}/sync")
async def request_sync(shop_id: int, payload: SyncRequest, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    shop = _get_shop_or_404(await ShopRepo(db).get(user.id, shop_id))

    job = await JobRepo(db).enqueue(
        type=JobType.sync_shop.value,
        payload={
            "shop_id": shop_id,
            "is_answered": payload.is_answered,
            "date_from_unix": payload.date_from_unix,
            "date_to_unix": payload.date_to_unix,
            "order": payload.order,
            "take": payload.take,
            "skip": payload.skip,
        },
    )
    await db.commit()
    return {"queued": True, "job_id": job.id}


@router.get("/{shop_id}", response_model=list[FeedbackListItem])
async def list_feedbacks(
    shop_id: int,
    response: Response,
    is_answered: bool | None = Query(default=None),
    q: str | None = Query(default=None),
    user_name: str | None = Query(default=None),
    # Extra filters (to match frontend UI)
    date_from_unix: int | None = Query(default=None, description="Unix seconds (inclusive)"),
    date_to_unix: int | None = Query(default=None, description="Unix seconds (inclusive)"),
    rating: int | None = Query(default=None, ge=1, le=5),
    has_text: bool | None = Query(default=None),
    has_media: bool | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    _get_shop_or_404(await ShopRepo(db).get(user.id, shop_id))

    rows, total = await FeedbackRepo(db).list(
        shop_id=shop_id,
        is_answered=is_answered,
        q=q,
        user_name=user_name,
        date_from_unix=date_from_unix,
        date_to_unix=date_to_unix,
        rating=rating,
        has_text=has_text,
        has_media=has_media,
        limit=limit,
        offset=offset,
    )

    # Debug: show nmID extraction quality.
    if settings.DEBUG_PRODUCT_CARDS:
        nm_sample = [r.nm_id for r in rows if r.nm_id is not None][: settings.DEBUG_PRODUCT_CARDS_SAMPLE]
        log.info(
            "[feedbacks] list shop_id=%s rows=%s total=%s distinct_nm_ids=%s sample_nm_ids=%s",
            shop_id,
            len(rows),
            total,
            len({r.nm_id for r in rows if r.nm_id is not None}),
            nm_sample,
        )

    # Attach product photo from cached product cards (Content API).
    nm_ids = [r.nm_id for r in rows if getattr(r, "nm_id", None) is not None]
    nm_unique = list({int(x) for x in nm_ids})
    thumbs = await ProductCardRepo(db).get_thumbnails(shop_id=shop_id, nm_ids=nm_unique)
    for r in rows:
        nm = getattr(r, "nm_id", None)
        if nm is not None:
            setattr(r, "_product_image_url", thumbs.get(int(nm)))

    # Summary logs: why product_image_url may be null.
    if nm_unique:
        missing = [x for x in nm_unique if x not in thumbs]
        if missing:
            sample = missing[: settings.DEBUG_PRODUCT_CARDS_SAMPLE]
            log.warning(
                "[feedbacks] missing product thumbs shop_id=%s missing=%s/%s sample_missing_nm_ids=%s",
                shop_id,
                len(missing),
                len(nm_unique),
                sample,
            )
        else:
            if settings.DEBUG_PRODUCT_CARDS:
                log.info(
                    "[feedbacks] all thumbs present shop_id=%s nm_ids=%s",
                    shop_id,
                    len(nm_unique),
                )
    else:
        log.warning(
            "[feedbacks] no nm_id extracted for returned rows shop_id=%s (product_image_url will be null)",
            shop_id,
        )

    response.headers["X-Total-Count"] = str(total)
    return rows


@router.get("/{shop_id}/{wb_id}", response_model=FeedbackDetail)
async def get_feedback(shop_id: int, wb_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    _get_shop_or_404(await ShopRepo(db).get(user.id, shop_id))

    fb = await FeedbackRepo(db).get_by_wb_id(shop_id, wb_id)
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found in DB. Run sync first.")

    # Attach product image
    if getattr(fb, "nm_id", None) is not None:
        thumbs = await ProductCardRepo(db).get_thumbnails(shop_id=shop_id, nm_ids=[int(fb.nm_id)])
        url = thumbs.get(int(fb.nm_id))
        setattr(fb, "_product_image_url", url)
        if url is None:
            log.warning(
                "[feedbacks] detail missing thumb shop_id=%s wb_id=%s nm_id=%s",
                shop_id,
                wb_id,
                fb.nm_id,
            )
    return fb


@router.post("/{shop_id}/{wb_id}/draft", response_model=DraftCreateResponse)
async def generate_draft(shop_id: int, wb_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    _get_shop_or_404(await ShopRepo(db).get(user.id, shop_id))

    s = await ShopRepo(db).get_settings(shop_id)
    if not s:
        raise HTTPException(status_code=404, detail="Settings not found")

    fb = await FeedbackRepo(db).get_by_wb_id(shop_id, wb_id)
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found in DB. Run sync first.")

    openai = OpenAIService()
    text, model, response_id = await generate_draft_text(openai, fb, s)

    draft = await DraftRepo(db).create(feedback_id=fb.id, text=text, openai_model=model, openai_response_id=response_id)
    await db.commit()
    return DraftCreateResponse(draft_id=draft.id, status=draft.status, text=draft.text)


@router.post("/{shop_id}/{wb_id}/publish")
async def publish_answer(shop_id: int, wb_id: str, payload: AnswerRequest | None = None, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    shop = _get_shop_or_404(await ShopRepo(db).get(user.id, shop_id))

    fb = await FeedbackRepo(db).get_by_wb_id(shop_id, wb_id)
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found in DB. Run sync first.")

    text = payload.text if payload else None
    if not text:
        latest = await DraftRepo(db).latest_for_feedback(fb.id)
        if not latest:
            raise HTTPException(status_code=400, detail="No text provided and no draft exists")
        text = latest.text

    token = decrypt_secret(shop.wb_token_enc)
    wb = WBClient(token=token)
    try:
        await wb.feedback_answer_create(wb_id=wb_id, text=text)
    finally:
        await wb.aclose()

    fb.answer_text = text
    await db.commit()
    return {"published": True}


@router.post("/{shop_id}/{wb_id}/answer/edit")
async def edit_answer(shop_id: int, wb_id: str, payload: AnswerRequest, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    shop = _get_shop_or_404(await ShopRepo(db).get(user.id, shop_id))

    token = decrypt_secret(shop.wb_token_enc)
    wb = WBClient(token=token)
    try:
        await wb.feedback_answer_edit(wb_id=wb_id, text=payload.text)
    finally:
        await wb.aclose()

    fb = await FeedbackRepo(db).get_by_wb_id(shop_id, wb_id)
    if fb:
        fb.answer_text = payload.text
    await db.commit()
    return {"edited": True}


# Pins (proxy)
@router.get("/{shop_id}/pins")
async def pins_list(
    shop_id: int,
    state: str | None = Query(default=None, description="pinned|unpinned"),
    pin_on: str | None = Query(default=None, description="nm|imt"),
    nm_id: int | None = Query(default=None),
    feedback_id: int | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    next_: int | None = Query(default=None, alias="next"),
    limit: int = Query(default=100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    shop = _get_shop_or_404(await ShopRepo(db).get(user.id, shop_id))
    token = decrypt_secret(shop.wb_token_enc)
    wb = WBClient(token=token)
    try:
        # WB API supports multiple filters; keep pass-through minimal
        resp = await wb.pins_list(date_from=date_from, date_to=date_to, next_=next_, limit=limit)
        return resp
    finally:
        await wb.aclose()


@router.get("/{shop_id}/pins/limits")
async def pins_limits(shop_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    shop = _get_shop_or_404(await ShopRepo(db).get(user.id, shop_id))
    token = decrypt_secret(shop.wb_token_enc)
    wb = WBClient(token=token)
    try:
        resp = await wb.pins_limits()
        return resp
    finally:
        await wb.aclose()


@router.post("/{shop_id}/pins/pin")
async def pin_feedback(shop_id: int, feedback_id: str, pin_on: str = "imt", db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    shop = _get_shop_or_404(await ShopRepo(db).get(user.id, shop_id))
    token = decrypt_secret(shop.wb_token_enc)
    wb = WBClient(token=token)
    try:
        return await wb.pin_feedback(feedback_id=feedback_id, pin_on=pin_on)
    finally:
        await wb.aclose()


@router.delete("/{shop_id}/pins/unpin")
async def unpin_feedback(shop_id: int, pin_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    shop = _get_shop_or_404(await ShopRepo(db).get(user.id, shop_id))
    token = decrypt_secret(shop.wb_token_enc)
    wb = WBClient(token=token)
    try:
        await wb.unpin_feedback(pin_id=pin_id)
        return {"unpinned": True}
    finally:
        await wb.aclose()
