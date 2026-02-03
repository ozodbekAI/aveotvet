from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.api.access import require_shop_access, require_admin_write
from app.models.enums import UserRole, ShopMemberRole
from app.models.shop_member import ShopMember
from app.models.shop import Shop
from app.repos.shop_member_repo import ShopMemberRepo
from app.repos.user_repo import UserRepo
from app.core.crypto import encrypt_secret, decrypt_secret
from app.services.wb_analytics_client import WBAnalyticsClient, cache_get, cache_set
from app.repos.shop_repo import ShopRepo
from app.repos.job_repo import JobRepo
from app.schemas.shop import ShopCreate, ShopOut, ShopTokenVerifyIn, ShopTokenVerifyOut
from app.services.wb_common_client import WBCommonClient, WBCommonApiError

router = APIRouter()


@router.get("", response_model=list[ShopOut])
async def list_shops(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    if getattr(user, "role", "user") == UserRole.super_admin.value:
        res = await db.execute(select(Shop).order_by(Shop.id))
        shops = list(res.scalars().all())
        return [ShopOut.model_validate({"id": s.id, "name": s.name, "my_role": ShopMemberRole.owner.value}) for s in shops]

    res_owner = await db.execute(select(Shop).where(Shop.owner_user_id == user.id, Shop.is_active.is_(True)))
    owner_shops = list(res_owner.scalars().all())

    res_mem = await db.execute(
        select(Shop, ShopMember.role)
        .join(ShopMember, ShopMember.shop_id == Shop.id)
        .where(ShopMember.user_id == user.id, Shop.is_active.is_(True))
    )
    member_rows = res_mem.all()

    by_id: dict[int, dict] = {s.id: {"id": s.id, "name": s.name, "my_role": ShopMemberRole.owner.value} for s in owner_shops}
    for s, role in member_rows:
        if s.id not in by_id:
            by_id[s.id] = {"id": s.id, "name": s.name, "my_role": role or ShopMemberRole.manager.value}
    # deterministic order
    return [ShopOut.model_validate(v) for v in sorted(by_id.values(), key=lambda x: x["id"]) ]


@router.post("", response_model=ShopOut)
async def create_shop(payload: ShopCreate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    # await require_admin_write(user)

    # Check if this token is already used by another shop
    existing_shops = await db.execute(select(Shop).where(Shop.is_active.is_(True)))
    for shop in existing_shops.scalars().all():
        if shop.wb_token_enc:
            try:
                existing_token = decrypt_secret(shop.wb_token_enc)
                if existing_token == payload.wb_token:
                    raise HTTPException(
                        status_code=409, 
                        detail=f"Этот токен уже используется магазином «{shop.name}». Один токен можно использовать только для одного магазина."
                    )
            except Exception:
                # Skip shops with invalid/corrupted tokens
                pass

    # Auto-detect shop name from WB seller-info (Common API).
    shop_name: str | None = None
    client = WBCommonClient(token=payload.wb_token)
    try:
        info = await client.seller_info()
        trade = (info.get("tradeMark") or "").strip() if isinstance(info, dict) else ""
        nm = (info.get("name") or "").strip() if isinstance(info, dict) else ""
        shop_name = trade or nm
    except WBCommonApiError as e:
        # Invalid token or WB outage.
        raise HTTPException(status_code=422, detail=f"WB token invalid or seller-info unavailable ({getattr(e, 'status_code', None)})")
    finally:
        await client.aclose()

    if not shop_name:
        # Fallback to provided name if WB did not return a usable value.
        shop_name = (payload.name or "").strip() or None

    if not shop_name:
        raise HTTPException(status_code=422, detail="Не удалось определить название магазина по токену")

    repo = ShopRepo(db)
    shop = await repo.create(owner_user_id=user.id, name=shop_name, wb_token_enc=encrypt_secret(payload.wb_token))
    
    # Auto-trigger initial sync for feedbacks, questions, chats, and cards
    job_repo = JobRepo(db)
    await job_repo.enqueue("feedback_sync", {"shop_id": shop.id, "is_answered": False, "take": 5000, "skip": 0})
    await job_repo.enqueue("feedback_sync", {"shop_id": shop.id, "is_answered": True, "take": 5000, "skip": 0})
    await job_repo.enqueue("questions_sync", {"shop_id": shop.id, "take": 5000, "skip": 0})
    await job_repo.enqueue("sync_chats", {"shop_id": shop.id})
    await job_repo.enqueue("cards_sync", {"shop_id": shop.id})
    
    await db.commit()
    return shop


@router.post("/verify-token", response_model=ShopTokenVerifyOut)
async def verify_shop_token(payload: ShopTokenVerifyIn, user=Depends(get_current_user)):
    """Verify WB token and return seller-info.

    Used by onboarding: user inputs token only, we auto-fetch shop name.
    """

    client = WBCommonClient(token=payload.wb_token)
    try:
        info = await client.seller_info()
    except WBCommonApiError as e:
        return ShopTokenVerifyOut(ok=False, name=None, sid=None, tradeMark=None, shop_name=None)
    finally:
        await client.aclose()

    trade = (info.get("tradeMark") or "").strip() if isinstance(info, dict) else ""
    nm = (info.get("name") or "").strip() if isinstance(info, dict) else ""
    sid = (info.get("sid") or "").strip() if isinstance(info, dict) else ""
    shop_name = trade or nm or None
    return ShopTokenVerifyOut(ok=True, name=nm or None, sid=sid or None, tradeMark=trade or None, shop_name=shop_name)


@router.get("/{shop_id}", response_model=ShopOut)
async def get_shop(
    request: Request,
    shop_id: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    access = await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)
    return {"id": access.shop.id, "name": access.shop.name, "my_role": access.role}


@router.get("/{shop_id}/token")
async def get_shop_token(
    shop_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    access = await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.owner.value)
    return {"wb_token": decrypt_secret(access.shop.wb_token_enc)}


@router.get("/{shop_id}/brands")
async def list_shop_brands(
    shop_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    access = await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.manager.value)

    cached = cache_get(shop_id)
    if cached is not None:
        return {"data": cached, "cached": True}

    token = decrypt_secret(access.shop.wb_token_enc)
    client = WBAnalyticsClient(token=token)
    try:
        brands = await client.list_brands()
    finally:
        await client.aclose()

    seen: set[str] = set()
    uniq: list[str] = []
    for b in brands:
        k = b.strip()
        if not k:
            continue
        if k.lower() in seen:
            continue
        seen.add(k.lower())
        uniq.append(k)

    cache_set(shop_id, uniq)
    return {"data": uniq, "cached": False}

@router.get("/{shop_id}/members")
async def list_members(
    shop_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    access = await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.owner.value)
    members = await ShopMemberRepo(db).list_for_shop(shop_id)
    users_by_id = {}
    repo = UserRepo(db)
    for m in members:
        u = await repo.get(m.user_id)
        users_by_id[m.user_id] = u.email if u else None
    return [{"user_id": m.user_id, "email": users_by_id.get(m.user_id), "role": m.role} for m in members]

@router.post("/{shop_id}/members")
async def add_member(
    shop_id: int,
    payload: dict,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    access = await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.owner.value)
    email = (payload.get("email") or "").strip().lower()
    role = ShopMemberRole.manager.value
    if not email:
        raise HTTPException(status_code=400, detail="email is required")

    urepo = UserRepo(db)
    target = await urepo.get_by_email(email)
    if not target:
        import secrets
        temp_password = secrets.token_urlsafe(10)
        from app.core.security import hash_password
        target = await urepo.create(email=email, password_hash=hash_password(temp_password), role=UserRole.user.value)

    await ShopMemberRepo(db).upsert(shop_id=shop_id, user_id=target.id, role=role)
    await db.commit()
    resp = {"ok": True}
    if 'temp_password' in locals():
        resp["temp_password"] = temp_password
    return resp

@router.put("/{shop_id}/members/{user_id}")
async def update_member(
    shop_id: int,
    user_id: int,
    payload: dict,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    access = await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.owner.value)

    if int(user_id) == int(user.id):
        raise HTTPException(status_code=403, detail="Cannot change your own shop role")

    is_super_admin = getattr(user, "role", UserRole.user.value) == UserRole.super_admin.value
    if int(user_id) == int(access.shop.owner_user_id) and not is_super_admin:
        raise HTTPException(status_code=403, detail="Cannot change primary shop owner role")

    role = ShopMemberRole.manager.value
    await ShopMemberRepo(db).upsert(shop_id=shop_id, user_id=user_id, role=role)
    await db.commit()
    return {"ok": True}

@router.delete("/{shop_id}/members/{user_id}")
async def delete_member(
    shop_id: int,
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    access = await require_shop_access(db, user, shop_id, request=request, min_role=ShopMemberRole.owner.value)
    if int(user_id) == int(user.id):
        raise HTTPException(status_code=403, detail="Cannot remove yourself from the shop")

    if user_id == access.shop.owner_user_id:
        raise HTTPException(status_code=400, detail="Cannot remove shop owner")
    await ShopMemberRepo(db).delete(shop_id=shop_id, user_id=user_id)
    await db.commit()
    return {"ok": True}

