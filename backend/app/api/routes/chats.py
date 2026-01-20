from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.api.deps import get_db, get_current_user
from app.api.access import require_shop_access
from app.models.enums import ShopMemberRole, UserRole
from app.repos.shop_repo import ShopRepo
from app.repos.job_repo import JobRepo
from app.repos.chat_repo import ChatRepo
from app.models.enums import JobType
from app.schemas.chat import ChatSessionOut, ChatEventOut, ChatDraftOut, ChatSessionsPageOut, ChatSessionRowOut
from app.services.openai_client import OpenAIService
from app.services.chat_drafting import generate_chat_reply
from app.services.prompt_store import get_global_bundle
from app.core.config import settings
from app.repos.shop_billing_repo import ShopBillingRepo
from app.core.crypto import decrypt_secret
from app.services.wb_chat_client import WBChatClient
from app.models.shop import Shop
from app.models.shop_member import ShopMember
from app.models.product_card import ProductCard


async def _attach_product_fields(db: AsyncSession, sessions: list[ChatSessionOut], shop_id: int | None = None) -> list[ChatSessionOut]:
    """Enrich chat sessions with product fields from cached product_cards.

    WB chat payload includes goodCard.nmID, but not a stable image URL for UI.
    We resolve (shop_id, nm_id) -> ProductCard.thumb_url/title/brand.
    """

    pairs: list[tuple[int, int]] = []
    for s in sessions:
        gc = s.good_card or {}
        nm = gc.get("nmID") if isinstance(gc, dict) else None
        if isinstance(nm, int) and shop_id is not None:
            pairs.append((shop_id, nm))

    if not pairs:
        return sessions

    # bulk load product cards
    nm_ids = sorted({nm for _, nm in pairs})
    q = select(ProductCard).where(and_(ProductCard.shop_id == shop_id, ProductCard.nm_id.in_(nm_ids)))
    res = await db.execute(q)
    cards = {int(c.nm_id): c for c in res.scalars().all()}

    for s in sessions:
        gc = s.good_card or {}
        nm = gc.get("nmID") if isinstance(gc, dict) else None
        if isinstance(nm, int) and nm in cards:
            c = cards[nm]
            s.nm_id = int(c.nm_id)
            s.product_title = c.title
            s.product_brand = c.brand
            s.product_thumb_url = c.thumb_url
        elif isinstance(nm, int):
            s.nm_id = nm
    return sessions

router = APIRouter()


async def _accessible_shop_ids(db: AsyncSession, request: Request, user, shop_id: int | None) -> list[int]:
    if shop_id is not None:
        (await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)).shop
        return [int(shop_id)]

    if getattr(user, "role", "user") == UserRole.super_admin.value:
        res = await db.execute(select(Shop.id).order_by(Shop.id))
        return [int(x) for x in res.scalars().all()]

    res_owner = await db.execute(select(Shop.id).where(Shop.owner_user_id == user.id))
    owner_ids = set(int(x) for x in res_owner.scalars().all())

    res_mem = await db.execute(select(ShopMember.shop_id).where(ShopMember.user_id == user.id))
    member_ids = set(int(x) for x in res_mem.scalars().all())

    return sorted(owner_ids.union(member_ids))


@router.post("/{shop_id}/sync")
async def sync_chats(shop_id: int, request: Request, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    (await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)).shop

    job = await JobRepo(db).enqueue(JobType.sync_chats.value, {"shop_id": shop_id})
    # also enqueue events pull (one page) to keep messages fresh
    await JobRepo(db).enqueue(JobType.sync_chat_events.value, {"shop_id": shop_id})
    await db.commit()
    return {"queued": True, "job_id": job.id}


@router.get("/page", response_model=ChatSessionsPageOut)
async def list_chats_page(
    request: Request,
    shop_id: int | None = Query(default=None, description="Specific shop id, or omit for 'Все магазины'"),
    limit: int = Query(default=10, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    date_from_unix: int | None = Query(default=None, description="UTC unix seconds"),
    date_to_unix: int | None = Query(default=None, description="UTC unix seconds"),
    unread: bool | None = Query(default=None, description="true=only unread, false=only read"),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    shop_ids = await _accessible_shop_ids(db, request,user, shop_id)
    if not shop_ids:
        raise HTTPException(status_code=404, detail="No accessible shops")

    dt_from = datetime.fromtimestamp(date_from_unix, tz=timezone.utc) if date_from_unix is not None else None
    dt_to = datetime.fromtimestamp(date_to_unix, tz=timezone.utc) if date_to_unix is not None else None

    total, rows = await ChatRepo(db).list_sessions_page(
        shop_ids=shop_ids,
        limit=limit,
        offset=offset,
        dt_from=dt_from,
        dt_to=dt_to,
        unread=unread,
    )

    items: list[ChatSessionRowOut] = []
    for session_obj, shop_name in rows:
        base_model = ChatSessionOut.model_validate(session_obj)
        # attach product fields from cached product_cards (best-effort)
        await _attach_product_fields(db, [base_model], shop_id=session_obj.shop_id)
        base = base_model.model_dump() if hasattr(base_model, "model_dump") else base_model.dict()
        items.append(ChatSessionRowOut(**base, shop_id=session_obj.shop_id, shop_name=shop_name))

    return ChatSessionsPageOut(total=total, items=items)


@router.get("/{shop_id}", response_model=list[ChatSessionOut])
async def list_chats(
    shop_id: int,
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    (await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)).shop
    sessions = await ChatRepo(db).list_sessions(shop_id=shop_id, limit=limit, offset=offset)
    out = [ChatSessionOut.model_validate(s) for s in sessions]
    await _attach_product_fields(db, out, shop_id=shop_id)
    return out


@router.get("/{shop_id}/{chat_id}/events", response_model=list[ChatEventOut])
async def chat_events(
    shop_id: int,
    chat_id: str,
    request: Request,
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    (await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)).shop

    repo = ChatRepo(db)
    items = await repo.list_events(shop_id=shop_id, chat_id=chat_id, limit=limit, offset=offset)
    if items:
        return items

    # Fallback: if DB cache is empty (e.g., first open), pull a few pages from WB
    # /api/v1/seller/events and filter by chatID.
    shop = await db.get(Shop, shop_id)
    if not shop:
        return []
    token = decrypt_secret(shop.wb_token_enc)
    client = WBChatClient(token=token)
    try:
        collected: list[ChatEventOut] = []
        next_ms: int | None = None
        loops = 0
        while len(collected) < min(limit, 500) and loops < 6:
            loops += 1
            resp = await client.events(next_ms=next_ms)
            result = resp.get("result") or {}
            next_ms = result.get("next")
            events = result.get("events") or []
            if not events:
                break

            # Save everything we see (improves cache), but only return requested chat.
            for ev in events:
                try:
                    await repo.add_event(shop_id=shop_id, ev=ev)
                except Exception:
                    # ignore malformed events; do not break the whole endpoint
                    continue
            await db.flush()

            for ev in events:
                if ev.get("chatID") == chat_id:
                    try:
                        # Return DB-model-compatible shape.
                        collected.append(ChatEventOut.model_validate(ev))
                    except Exception:
                        pass

            if next_ms is None:
                break
    finally:
        await client.aclose()

    # Re-read from DB for consistent ordering/pagination.
    return await repo.list_events(shop_id=shop_id, chat_id=chat_id, limit=limit, offset=offset)


@router.post("/{shop_id}/{chat_id}/draft", response_model=ChatDraftOut)
async def suggest_chat_reply(shop_id: int, chat_id: str, request: Request, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    (await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)).shop
    settings_obj = await ShopRepo(db).get_settings(shop_id)
    if not settings_obj or not settings_obj.chat_enabled:
        raise HTTPException(status_code=400, detail="Chat is disabled in settings")

    repo = ChatRepo(db)

    # Use newest buyer message from stored events. If cache is empty, pull events on demand.
    events = await repo.list_events(shop_id=shop_id, chat_id=chat_id, limit=50, offset=0)
    if not events:
        # best-effort on-demand pull (same logic as GET /events fallback)
        shop = await db.get(Shop, shop_id)
        if shop:
            token = decrypt_secret(shop.wb_token_enc)
            client = WBChatClient(token=token)
            try:
                next_ms: int | None = None
                loops = 0
                while loops < 6:
                    loops += 1
                    resp = await client.events(next_ms=next_ms)
                    result = resp.get("result") or {}
                    next_ms = result.get("next")
                    batch = result.get("events") or []
                    if not batch:
                        break
                    for ev in batch:
                        try:
                            await repo.add_event(shop_id=shop_id, ev=ev)
                        except Exception:
                            continue
                    await db.flush()
                    if any((ev.get("chatID") == chat_id) for ev in batch):
                        break
                    if next_ms is None:
                        break
            finally:
                await client.aclose()

        events = await repo.list_events(shop_id=shop_id, chat_id=chat_id, limit=50, offset=0)
    last_text = None
    ctx = None
    for ev in events:
        msg = ev.message or {}
        # event contains message.text from buyer or seller; we want buyer message if possible.
        t = msg.get("text") if isinstance(msg, dict) else None
        if t:
            last_text = t
            ctx = (msg.get("attachments") or {}) if isinstance(msg, dict) else None
            break

    if not last_text:
        raise HTTPException(status_code=400, detail="No messages found for this chat yet.")

    # Billing: charge credits before spending OpenAI tokens.
    credits_per_draft = int(getattr(settings, "CREDITS_PER_DRAFT", 1) or 1)
    charged = False
    if credits_per_draft > 0:
        charged = await ShopBillingRepo(db).try_charge(
            shop_id,
            amount=credits_per_draft,
            reason="chat_draft_api",
            meta={"shop_id": shop_id, "chat_id": chat_id},
        )
        if not charged:
            raise HTTPException(status_code=402, detail="Insufficient credits")

    openai = OpenAIService()
    bundle = await get_global_bundle(db)
    try:
        text, model, rid = await generate_chat_reply(openai, settings_obj, last_text, context=ctx, bundle=bundle)
    except Exception:
        if charged and credits_per_draft > 0:
            await ShopBillingRepo(db).apply_credits(
                shop_id,
                delta=credits_per_draft,
                reason="refund_chat_draft_api_error",
                meta={"shop_id": shop_id, "chat_id": chat_id},
            )
            await db.flush()
        raise
    draft = await repo.create_draft(shop_id=shop_id, chat_id=chat_id, text=text, openai_model=model, openai_response_id=rid)
    await db.commit()
    return draft


@router.post("/{shop_id}/{chat_id}/send")
async def send_chat_message(
    shop_id: int,
    chat_id: str,
    request: Request,
    message: str | None = Form(default=None),
    use_latest_draft: bool = Form(default=True),
    files: list[UploadFile] | None = File(default=None),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    shop = (await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)).shop

    settings_obj = await ShopRepo(db).get_settings(shop_id)
    if not settings_obj or not settings_obj.chat_enabled:
        raise HTTPException(status_code=400, detail="Chat is disabled in settings")

    repo = ChatRepo(db)
    session_obj = await repo.get_session_by_chat_id(shop_id=shop_id, chat_id=chat_id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Chat not found in DB. Run /sync first.")

    text = message
    if (not text) and use_latest_draft:
        d = await repo.latest_draft(shop_id=shop_id, chat_id=chat_id)
        if d:
            text = d.text

    if not text and not files:
        raise HTTPException(status_code=400, detail="Provide message or file(s)")

    token = decrypt_secret(shop.wb_token_enc)
    client = WBChatClient(token=token)
    try:
        mfiles = None
        if files:
            mfiles = []
            for f in files:
                blob = await f.read()
                mfiles.append((f.filename, blob, f.content_type or "application/octet-stream"))
        res = await client.send_message(reply_sign=session_obj.reply_sign, message=text, files=mfiles)
    finally:
        await client.aclose()

    await db.commit()
    return {"sent": True, "wb": res}


@router.get("/{shop_id}/download/{download_id}")
async def download_chat_file(shop_id: int, download_id: str, request: Request, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    shop = (await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)).shop

    token = decrypt_secret(shop.wb_token_enc)
    client = WBChatClient(token=token)
    try:
        resp = await client.download(download_id)
        # proxy bytes (small files); for large you'd stream
        return resp.content
    finally:
        await client.aclose()
