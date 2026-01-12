from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.api.access import require_shop_access
from app.models.enums import ShopMemberRole
from app.repos.shop_repo import ShopRepo
from app.repos.job_repo import JobRepo
from app.repos.question_repo import QuestionRepo
from app.repos.question_draft_repo import QuestionDraftRepo
from app.models.enums import JobType
from app.schemas.question import (
    QuestionListItem,
    QuestionDetail,
    QuestionSyncRequest,
    QuestionAnswerRequest,
)
from app.services.openai_client import OpenAIService
from app.services.question_drafting import generate_question_draft_text
from app.services.prompt_store import get_global_bundle
from app.services.wb_client import WBClient
from app.core.crypto import decrypt_secret


router = APIRouter()


def _get_shop_or_404(shop):
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


@router.post("/{shop_id}/sync")
async def request_sync(shop_id: int, payload: QuestionSyncRequest, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    shop = (await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.manager.value)).shop

    job = await JobRepo(db).enqueue(
        type=JobType.sync_questions.value,
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


@router.get("/{shop_id}", response_model=list[QuestionListItem])
async def list_questions(
    shop_id: int,
    is_answered: bool | None = Query(default=None),
    q: str | None = Query(default=None),
    user_name: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    (await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.viewer.value)).shop

    rows, _total = await QuestionRepo(db).list(
        shop_id=shop_id,
        is_answered=is_answered,
        q=q,
        user_name=user_name,
        limit=limit,
        offset=offset,
    )
    return rows


@router.get("/{shop_id}/{wb_id}", response_model=QuestionDetail)
async def get_question(shop_id: int, wb_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    (await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.viewer.value)).shop

    q = await QuestionRepo(db).get_by_wb_id(shop_id, wb_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found in DB. Run sync first.")
    return q


@router.post("/{shop_id}/{wb_id}/view")
async def mark_viewed(shop_id: int, wb_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    shop = (await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.operator.value)).shop

    token = decrypt_secret(shop.wb_token_enc)
    wb = WBClient(token=token)
    try:
        await wb.question_view(wb_id=wb_id, was_viewed=True)
    finally:
        await wb.aclose()

    q = await QuestionRepo(db).get_by_wb_id(shop_id, wb_id)
    if q:
        q.was_viewed = True
    await db.commit()
    return {"viewed": True}


@router.post("/{shop_id}/{wb_id}/draft")
async def generate_draft(shop_id: int, wb_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    (await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.operator.value)).shop

    s = await ShopRepo(db).get_settings(shop_id)
    if not s:
        raise HTTPException(status_code=404, detail="Settings not found")

    q = await QuestionRepo(db).get_by_wb_id(shop_id, wb_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found in DB. Run sync first.")

    openai = OpenAIService()
    bundle = await get_global_bundle(db)
    text, model, response_id = await generate_question_draft_text(openai, q, s, bundle=bundle)

    draft = await QuestionDraftRepo(db).create(question_id=q.id, text=text, openai_model=model, openai_response_id=response_id)
    await db.commit()
    return {"draft_id": draft.id, "status": draft.status, "text": draft.text}


@router.post("/{shop_id}/{wb_id}/publish")
async def publish_answer(shop_id: int, wb_id: str, payload: QuestionAnswerRequest | None = None, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    shop = (await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.operator.value)).shop

    q = await QuestionRepo(db).get_by_wb_id(shop_id, wb_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found in DB. Run sync first.")

    text = payload.text if payload else None
    if not text:
        latest = await QuestionDraftRepo(db).latest_for_question(q.id)
        if not latest:
            raise HTTPException(status_code=400, detail="No text provided and no draft exists")
        text = latest.text

    token = decrypt_secret(shop.wb_token_enc)
    wb = WBClient(token=token)
    try:
        await wb.question_answer_or_edit(wb_id=wb_id, text=text)
    finally:
        await wb.aclose()

    q.answer_text = text
    await db.commit()
    return {"published": True}


@router.post("/{shop_id}/{wb_id}/reject")
async def reject_question(shop_id: int, wb_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    shop = (await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.operator.value)).shop

    token = decrypt_secret(shop.wb_token_enc)
    wb = WBClient(token=token)
    try:
        await wb.question_reject(wb_id=wb_id)
    finally:
        await wb.aclose()

    q = await QuestionRepo(db).get_by_wb_id(shop_id, wb_id)
    if q:
        q.state = "rejected"
    await db.commit()
    return {"rejected": True}
