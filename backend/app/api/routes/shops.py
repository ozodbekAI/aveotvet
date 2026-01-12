from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.api.access import require_shop_access, require_platform_role
from app.models.enums import UserRole, ShopMemberRole
from app.models.shop_member import ShopMember
from app.models.shop import Shop
from app.repos.shop_member_repo import ShopMemberRepo
from app.repos.user_repo import UserRepo
from app.core.crypto import encrypt_secret, decrypt_secret
from app.services.wb_analytics_client import WBAnalyticsClient, cache_get, cache_set
from app.repos.shop_repo import ShopRepo
from app.schemas.shop import ShopCreate, ShopOut

router = APIRouter()


@router.get("", response_model=list[ShopOut])
async def list_shops(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    # super_admin: all shops
    if getattr(user, "role", "user") == UserRole.super_admin.value:
        res = await db.execute(select(Shop).order_by(Shop.id))
        shops = list(res.scalars().all())
        return [ShopOut.model_validate({"id": s.id, "name": s.name, "my_role": ShopMemberRole.owner.value}) for s in shops]

    # owner or member
    # owner shops
    res_owner = await db.execute(select(Shop).where(Shop.owner_user_id == user.id))
    owner_shops = list(res_owner.scalars().all())

    # member shops
    res_mem = await db.execute(
        select(Shop, ShopMember.role)
        .join(ShopMember, ShopMember.shop_id == Shop.id)
        .where(ShopMember.user_id == user.id)
    )
    member_rows = res_mem.all()

    by_id: dict[int, dict] = {s.id: {"id": s.id, "name": s.name, "my_role": ShopMemberRole.owner.value} for s in owner_shops}
    for s, role in member_rows:
        if s.id not in by_id:
            by_id[s.id] = {"id": s.id, "name": s.name, "my_role": role or ShopMemberRole.viewer.value}
    # deterministic order
    return [ShopOut.model_validate(v) for v in sorted(by_id.values(), key=lambda x: x["id"]) ]


@router.post("", response_model=ShopOut)
async def create_shop(payload: ShopCreate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    # Only platform shop_owner or super_admin can create shops
    await require_platform_role(user, {UserRole.super_admin.value, UserRole.shop_owner.value})

    repo = ShopRepo(db)
    shop = await repo.create(owner_user_id=user.id, name=payload.name, wb_token_enc=encrypt_secret(payload.wb_token))
    await db.commit()
    return shop


@router.get("/{shop_id}", response_model=ShopOut)
async def get_shop(shop_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    access = await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.viewer.value)
    return {"id": access.shop.id, "name": access.shop.name, "my_role": access.role}


@router.get("/{shop_id}/token")
async def get_shop_token(shop_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    access = await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.manager.value)
    # usually you don't expose token; included for debugging.
    return {"wb_token": decrypt_secret(access.shop.wb_token_enc)}


@router.get("/{shop_id}/brands")
async def list_shop_brands(shop_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Return canonical brand list from Wildberries Analytics API.

    Frontend uses this list to ensure signature.brand matches WB brandName exactly.
    Response format matches WB: {"data": ["Brand1", "Brand2", ...]}
    """
    access = await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.viewer.value)

    cached = cache_get(shop_id)
    if cached is not None:
        return {"data": cached, "cached": True}

    token = decrypt_secret(access.shop.wb_token_enc)
    client = WBAnalyticsClient(token=token)
    try:
        brands = await client.list_brands()
    finally:
        await client.aclose()

    # De-dup (while preserving order)
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
async def list_members(shop_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    access = await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.manager.value)
    members = await ShopMemberRepo(db).list_for_shop(shop_id)
    # include user emails
    users_by_id = {}
    repo = UserRepo(db)
    for m in members:
        u = await repo.get(m.user_id)
        users_by_id[m.user_id] = u.email if u else None
    return [{"user_id": m.user_id, "email": users_by_id.get(m.user_id), "role": m.role} for m in members]

@router.post("/{shop_id}/members")
async def add_member(shop_id: int, payload: dict, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    # only shop owner (or super_admin)
    access = await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.owner.value)
    email = (payload.get("email") or "").strip().lower()
    role = payload.get("role") or ShopMemberRole.viewer.value
    password = payload.get("password")
    if not email:
        raise HTTPException(status_code=400, detail="email is required")
    if role not in ShopMemberRole.values():
        raise HTTPException(status_code=400, detail="Invalid shop role")

    urepo = UserRepo(db)
    target = await urepo.get_by_email(email)
    if not target:
        if not (isinstance(password, str) and len(password) >= 6):
            raise HTTPException(status_code=400, detail="password is required to create a new user (min 6 chars)")
        from app.core.security import hash_password
        target = await urepo.create(email=email, password_hash=hash_password(password), role=UserRole.user.value)

    await ShopMemberRepo(db).upsert(shop_id=shop_id, user_id=target.id, role=role)
    await db.commit()
    return {"ok": True}

@router.put("/{shop_id}/members/{user_id}")
async def update_member(shop_id: int, user_id: int, payload: dict, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    access = await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.owner.value)
    role = payload.get("role")
    if role not in ShopMemberRole.values():
        raise HTTPException(status_code=400, detail="Invalid shop role")
    await ShopMemberRepo(db).upsert(shop_id=shop_id, user_id=user_id, role=role)
    await db.commit()
    return {"ok": True}

@router.delete("/{shop_id}/members/{user_id}")
async def delete_member(shop_id: int, user_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    access = await require_shop_access(db, user, shop_id, min_role=ShopMemberRole.owner.value)
    # do not allow deleting the owner himself from membership (keep at least one owner)
    if user_id == access.shop.owner_user_id:
        raise HTTPException(status_code=400, detail="Cannot remove shop owner")
    await ShopMemberRepo(db).delete(shop_id=shop_id, user_id=user_id)
    await db.commit()
    return {"ok": True}

