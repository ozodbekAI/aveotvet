from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.api.access import require_shop_access
from app.models.enums import ShopMemberRole
from app.repos.shop_repo import ShopRepo
from app.repos.job_repo import JobRepo
from app.repos.chat_repo import ChatRepo
from app.models.enums import JobType
from app.schemas.chat import ChatSessionOut, ChatEventOut, ChatDraftOut
from app.services.openai_client import OpenAIService
from app.services.chat_drafting import generate_chat_reply
from app.services.prompt_store import get_global_bundle
from app.core.crypto import decrypt_secret
from app.services.wb_chat_client import WBChatClient

router = APIRouter()


@router.post("/{shop_id}/sync")
async def sync_chats(shop_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    (await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.manager.value)).shop

    job = await JobRepo(db).enqueue(JobType.sync_chats.value, {"shop_id": shop_id})
    # also enqueue events pull (one page) to keep messages fresh
    await JobRepo(db).enqueue(JobType.sync_chat_events.value, {"shop_id": shop_id})
    await db.commit()
    return {"queued": True, "job_id": job.id}


@router.get("/{shop_id}", response_model=list[ChatSessionOut])
async def list_chats(
    shop_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    (await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.viewer.value)).shop
    return await ChatRepo(db).list_sessions(shop_id=shop_id, limit=limit, offset=offset)


@router.get("/{shop_id}/{chat_id}/events", response_model=list[ChatEventOut])
async def chat_events(
    shop_id: int,
    chat_id: str,
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    (await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.viewer.value)).shop
    return await ChatRepo(db).list_events(shop_id=shop_id, chat_id=chat_id, limit=limit, offset=offset)


@router.post("/{shop_id}/{chat_id}/draft", response_model=ChatDraftOut)
async def suggest_chat_reply(shop_id: int, chat_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    (await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.operator.value)).shop
    settings_obj = await ShopRepo(db).get_settings(shop_id)
    if not settings_obj or not settings_obj.chat_enabled:
        raise HTTPException(status_code=400, detail="Chat is disabled in settings")

    # use newest buyer message from stored events
    events = await ChatRepo(db).list_events(shop_id=shop_id, chat_id=chat_id, limit=50, offset=0)
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
        raise HTTPException(status_code=400, detail="No messages cached for this chat. Run /sync first.")

    openai = OpenAIService()
    bundle = await get_global_bundle(db)
    text, model, rid = await generate_chat_reply(openai, settings_obj, last_text, context=ctx, bundle=bundle)
    draft = await ChatRepo(db).create_draft(shop_id=shop_id, chat_id=chat_id, text=text, openai_model=model, openai_response_id=rid)
    await db.commit()
    return draft


@router.post("/{shop_id}/{chat_id}/send")
async def send_chat_message(
    shop_id: int,
    chat_id: str,
    message: str | None = Form(default=None),
    use_latest_draft: bool = Form(default=True),
    files: list[UploadFile] | None = File(default=None),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    shop = (await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.operator.value)).shop

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
async def download_chat_file(shop_id: int, download_id: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    shop = (await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.viewer.value)).shop

    token = decrypt_secret(shop.wb_token_enc)
    client = WBChatClient(token=token)
    try:
        resp = await client.download(download_id)
        # proxy bytes (small files); for large you'd stream
        return resp.content
    finally:
        await client.aclose()
