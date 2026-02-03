from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.repos.product_card_repo import ProductCardRepo

from app.api.deps import get_db, get_current_user
from app.api.access import require_shop_access
from app.models.enums import ShopMemberRole
from app.repos.shop_repo import ShopRepo
from app.repos.feedback_repo import FeedbackRepo
from app.repos.draft_repo import DraftRepo
from app.repos.shop_billing_repo import ShopBillingRepo
from app.schemas.drafts import DraftListItem, DraftDetail, DraftUpdateRequest

import logging

from app.services.prompt_store import get_global_bundle


log = logging.getLogger(__name__)

router = APIRouter()


def _get_shop_or_404(shop):
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


async def _attach_product_images(db: AsyncSession, shop_id: int, drafts: list) -> None:

    nm_ids: list[int] = []
    for d in drafts or []:
        fb = getattr(d, "feedback", None)
        nm = getattr(fb, "nm_id", None) if fb is not None else None
        if nm is None:
            continue
        try:
            nm_ids.append(int(nm))
        except Exception:
            continue

    if not nm_ids:
        return

    uniq = sorted(set(nm_ids))
    thumbs = await ProductCardRepo(db).get_thumbnails(shop_id=shop_id, nm_ids=uniq)

    # if settings.DEBUG_PRODUCT_CARDS:
    #     missing = len(uniq) - len(thumbs)
    #     if missing > 0:
    #         log.warning(
    #             "[drafts] missing product thumbs for shop_id=%s: %s/%s",
    #             shop_id,
    #             missing,
    #             len(uniq),
    #         )

    for d in drafts or []:
        fb = getattr(d, "feedback", None)
        if fb is None:
            continue
        nm = getattr(fb, "nm_id", None)
        if nm is None:
            continue
        try:
            url = thumbs.get(int(nm))
        except Exception:
            url = None
        if url:
            setattr(fb, "_product_image_url", url)


@router.get("/{shop_id}/drafts", response_model=list[DraftListItem])
async def list_drafts(
    shop_id: int,
    response: Response,
    request: Request,
    status: str | None = Query(default=None, description="drafted|published|rejected"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    (await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)).shop
    
    drafts, total = await DraftRepo(db).list_by_shop(
        shop_id=shop_id,
        status=status,
        limit=limit,
        offset=offset
    )

    await _attach_product_images(db, shop_id, drafts)
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
    return drafts


@router.get("/{shop_id}/drafts/pending", response_model=list[DraftListItem])
async def list_pending_drafts(
    shop_id: int,
    response: Response,
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None),
    has_text: bool | None = Query(default=None),
    has_media: bool | None = Query(default=None),
    rating_min: int | None = Query(default=None, ge=1, le=5),
    rating_max: int | None = Query(default=None, ge=1, le=5),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    List pending drafts (status=drafted) that are waiting for review.
    This is most useful when auto_draft=true but auto_publish=false.
    """
    (await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)).shop
    
    drafts, total = await DraftRepo(db).list_pending(
        shop_id=shop_id,
        limit=limit,
        offset=offset,
        q=q,
        has_text=has_text,
        has_media=has_media,
        rating_min=rating_min,
        rating_max=rating_max,
    )

    await _attach_product_images(db, shop_id, drafts)
    if response is not None:
        response.headers["X-Total-Count"] = str(total)
    return drafts


@router.get("/{shop_id}/drafts/{draft_id}", response_model=DraftDetail)
async def get_draft(
    shop_id: int,
    draft_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get specific draft details."""
    (await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)).shop
    
    draft = await DraftRepo(db).get_with_feedback(draft_id)
    if not draft or draft.feedback.shop_id != shop_id:
        raise HTTPException(status_code=404, detail="Draft not found")

    await _attach_product_images(db, shop_id, [draft])
    
    return draft


@router.put("/{shop_id}/drafts/{draft_id}", response_model=DraftDetail)
async def update_draft(
    shop_id: int,
    draft_id: int,
    request: Request,
    payload: DraftUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Update draft text before publishing.
    Useful for manually editing auto-generated drafts.
    """
    (await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)).shop
    
    draft = await DraftRepo(db).get_with_feedback(draft_id)
    if not draft or draft.feedback.shop_id != shop_id:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    if payload.text is not None:
        draft.text = payload.text
    
    if payload.status is not None:
        draft.status = payload.status
    
    await db.commit()
    await db.refresh(draft)
    
    return draft


@router.post("/{shop_id}/drafts/{draft_id}/approve")
async def approve_draft(
    shop_id: int,
    draft_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Approve and publish a draft.
    This will publish the draft to Wildberries.
    """
    shop = (await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)).shop
    
    draft = await DraftRepo(db).get_with_feedback(draft_id)
    if not draft or draft.feedback.shop_id != shop_id:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    if draft.status != "drafted":
        raise HTTPException(status_code=400, detail="Only drafted drafts can be approved")
    
    if draft.feedback.answer_text:
        raise HTTPException(status_code=400, detail="Feedback already has an answer")
    
    from app.services.wb_client import WBClient
    from app.core.crypto import decrypt_secret
    from app.models.enums import DraftStatus
    from datetime import datetime, timezone
    
    token = decrypt_secret(shop.wb_token_enc)
    wb = WBClient(token=token)
    try:
        await wb.feedback_answer_create(wb_id=draft.feedback.wb_id, text=draft.text)
    finally:
        await wb.aclose()
    
    draft.feedback.answer_text = draft.text
    draft.status = DraftStatus.published.value
    draft.published_at = datetime.now(timezone.utc)
    
    await db.commit()
    
    return {"approved": True, "published": True}


@router.post("/{shop_id}/drafts/{draft_id}/reject")
async def reject_draft(
    shop_id: int,
    draft_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Reject a draft.
    This marks the draft as rejected and won't be published.
    """
    (await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)).shop
    
    draft = await DraftRepo(db).get_with_feedback(draft_id)
    if not draft or draft.feedback.shop_id != shop_id:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    if draft.status != "drafted":
        raise HTTPException(status_code=400, detail="Only drafted drafts can be rejected")
    
    from app.models.enums import DraftStatus
    
    draft.status = DraftStatus.rejected.value
    await db.commit()
    
    return {"rejected": True}

@router.post("/{shop_id}/drafts/{draft_id}/regenerate")
async def regenerate_draft(
    shop_id: int,
    draft_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Regenerate a draft with current settings.

    UX expectation: the same draft record should be updated in-place.
    """
    (await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)).shop
    
    draft = await DraftRepo(db).get_with_feedback(draft_id)
    if not draft or draft.feedback.shop_id != shop_id:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    settings_obj = await ShopRepo(db).get_settings(shop_id)
    if not settings_obj:
        raise HTTPException(status_code=404, detail="Settings not found")
    
    # Billing: charge credits before spending OpenAI tokens.
    credits_per_draft = int(getattr(app_settings, "CREDITS_PER_DRAFT", 1) or 1)
    charged = False
    if credits_per_draft > 0:
        charged = await ShopBillingRepo(db).try_charge(
            shop_id,
            amount=credits_per_draft,
            reason="feedback_regenerate",
            meta={"shop_id": shop_id, "draft_id": draft_id, "feedback_id": draft.feedback_id},
        )
        if not charged:
            raise HTTPException(status_code=402, detail="Insufficient credits")

    from app.services.openai_client import OpenAIService
    from app.services.drafting import generate_draft_text
    from app.services.gpt_accounting import record_gpt_usage
    bundle = await get_global_bundle(db)

    openai = OpenAIService()
    try:
        text, model, response_id, prompt_tokens, completion_tokens = await generate_draft_text(
            openai, draft.feedback, settings_obj, bundle=bundle
        )
    except Exception:
        if charged and credits_per_draft > 0:
            await ShopBillingRepo(db).apply_credits(
                shop_id,
                delta=credits_per_draft,
                reason="refund_feedback_regenerate_error",
                meta={"shop_id": shop_id, "draft_id": draft_id, "feedback_id": draft.feedback_id},
            )
            await db.flush()
        raise
    
    updated = await DraftRepo(db).update_text(
        draft_id,
        text=text,
        openai_model=model,
        openai_response_id=response_id,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Draft not found")

    await record_gpt_usage(
        db,
        shop_id=shop_id,
        model=model,
        operation_type="review_draft",
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        response_id=response_id,
    )

    await db.commit()
    await db.refresh(updated)

    return {
        "regenerated": True,
        "draft_id": updated.id,
        "text": updated.text,
    }


@router.get("/{shop_id}/drafts/stats")
async def get_draft_stats(
    shop_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Get draft statistics for the shop.
    Useful for dashboard showing pending drafts count.
    """
    (await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)).shop
    
    stats = await DraftRepo(db).get_stats(shop_id)
    return stats