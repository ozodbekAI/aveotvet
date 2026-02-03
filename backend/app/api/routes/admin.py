from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.api.access import require_super_admin, require_admin_read, require_admin_write
from app.models.enums import UserRole
from app.repos.user_repo import UserRepo
from app.repos.shop_repo import ShopRepo
from app.repos.shop_billing_repo import ShopBillingRepo
from app.repos.audit_repo import AuditRepo
from app.repos.job_repo import JobRepo
from app.models.shop import Shop
from app.models.shop_member import ShopMember
from app.core.crypto import encrypt_secret, decrypt_secret
from sqlalchemy import select, func
from app.repos.prompt_repo import PromptRepo
from app.repos.tone_repo import ToneRepo
from app.schemas.tone import ToneCreate, ToneUpdate
from app.services.prompt_store import get_global_bundle, set_global_bundle

router = APIRouter()


class CreditsUpdate(BaseModel):
    delta: int = Field(..., ge=-100000000, le=100000000)
    reason: str = Field(default="admin_adjust", max_length=64)
    meta: dict | None = None


class ShopCreateAdmin(BaseModel):
    owner_user_id: int
    name: str = Field(..., min_length=1, max_length=120)
    wb_token: str = Field(..., min_length=10)


class ShopUpdateAdmin(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    owner_user_id: int | None = None
    is_active: bool | None = None
    is_frozen: bool | None = None
    wb_token: str | None = None


@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await require_admin_read(user)
    is_support = getattr(user, "role", UserRole.user.value) == UserRole.support_admin.value
    users = await UserRepo(db).list_all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "role": getattr(u, "role", UserRole.user.value),
            "is_active": u.is_active,
            # LEGACY user-scoped credits (kept for backward compatibility)
            "credits_balance": None if is_support else int(getattr(u, "credits_balance", 0) or 0),
            "credits_spent": None if is_support else int(getattr(u, "credits_spent", 0) or 0),
        }
        for u in users
    ]


@router.post("/users")
async def create_user(payload: dict, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Create a platform user (super_admin only).

    Body: {email, password, role?, is_active?}
    """
    await require_admin_write(user)
    email = str(payload.get("email") or "").strip().lower()
    password = payload.get("password")
    role = payload.get("role") or UserRole.user.value
    is_active = bool(payload.get("is_active", True))
    if not email:
        raise HTTPException(status_code=400, detail="email is required")
    if not (isinstance(password, str) and len(password) >= 6):
        raise HTTPException(status_code=400, detail="password is required (min 6 chars)")
    if role not in UserRole.values():
        raise HTTPException(status_code=400, detail="Invalid role")
    repo = UserRepo(db)
    existing = await repo.get_by_email(email)
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    from app.core.security import hash_password
    u = await repo.create(email=email, password_hash=hash_password(password), role=role)
    u.is_active = is_active
    await db.commit()
    return {"id": u.id}


@router.put("/users/{user_id}/active")
async def set_user_active(user_id: int, payload: dict, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await require_admin_write(user)
    is_active = payload.get("is_active")
    if not isinstance(is_active, bool):
        raise HTTPException(status_code=400, detail="is_active must be boolean")
    repo = UserRepo(db)
    u = await repo.get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.is_active = is_active
    await AuditRepo(db).log("admin.user.deactivate" if not is_active else "admin.user.activate", int(user.id), entity="user", entity_id=user_id)
    await db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/reset_password")
async def reset_password(user_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """admin.user.reset_password (super_admin only). Returns a temporary password."""
    await require_super_admin(user)
    repo = UserRepo(db)
    u = await repo.get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    import secrets
    temp = secrets.token_urlsafe(10)
    from app.core.security import hash_password
    u.password_hash = hash_password(temp)
    await AuditRepo(db).log("admin.user.reset_password", int(user.id), entity="user", entity_id=user_id)
    await db.commit()
    return {"ok": True, "temp_password": temp}


@router.post("/users/{user_id}/session/invalidate")
async def invalidate_sessions(user_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """admin.user.session.invalidate (super_admin only)."""
    await require_super_admin(user)
    repo = UserRepo(db)
    u = await repo.get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.session_version = int(getattr(u, "session_version", 1) or 1) + 1
    await AuditRepo(db).log("admin.user.session.invalidate", int(user.id), entity="user", entity_id=user_id)
    await db.commit()
    return {"ok": True, "session_version": u.session_version}


@router.get("/users/{user_id}/shops")
async def user_shops(user_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await require_admin_read(user)
    rows = await db.execute(
        select(Shop.id, Shop.name, ShopMember.role)
        .select_from(ShopMember)
        .join(Shop, Shop.id == ShopMember.shop_id)
        .where(ShopMember.user_id == user_id)
        .order_by(Shop.id)
    )
    return [{"shop_id": sid, "shop_name": name, "role": role} for sid, name, role in rows.all()]


@router.get("/shops")
async def list_shops_admin(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """List all shops with owner & billing info (super_admin only)."""
    await require_admin_read(user)
    is_support = getattr(user, "role", UserRole.user.value) == UserRole.support_admin.value

    rows = await db.execute(select(Shop).order_by(Shop.id))
    shops = list(rows.scalars().all())

    # owner emails
    urepo = UserRepo(db)
    out = []
    for s in shops:
        owner = await urepo.get(int(s.owner_user_id))
        out.append(
            {
                "id": s.id,
                "name": s.name,
                "owner_user_id": s.owner_user_id,
                "owner_email": owner.email if owner else None,
                "is_active": bool(getattr(s, "is_active", True)),
                "created_at": s.created_at,
                "credits_balance": None if is_support else int(getattr(s, "credits_balance", 0) or 0),
                "credits_spent": None if is_support else int(getattr(s, "credits_spent", 0) or 0),
            }
        )
    return out


@router.post("/shops")
async def create_shop_admin(payload: ShopCreateAdmin, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await require_admin_write(user)
    
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
                pass
    
    # ensure owner exists
    owner = await UserRepo(db).get(int(payload.owner_user_id))
    if not owner:
        raise HTTPException(status_code=404, detail="Owner user not found")
    shop = await ShopRepo(db).create(
        owner_user_id=int(payload.owner_user_id),
        name=payload.name,
        wb_token_enc=encrypt_secret(payload.wb_token),
    )
    
    # Auto-trigger initial sync for feedbacks, questions, chats, and cards
    job_repo = JobRepo(db)
    await job_repo.enqueue("feedback_sync", {"shop_id": shop.id, "is_answered": False, "take": 5000, "skip": 0})
    await job_repo.enqueue("feedback_sync", {"shop_id": shop.id, "is_answered": True, "take": 5000, "skip": 0})
    await job_repo.enqueue("questions_sync", {"shop_id": shop.id, "take": 5000, "skip": 0})
    await job_repo.enqueue("sync_chats", {"shop_id": shop.id})
    await job_repo.enqueue("cards_sync", {"shop_id": shop.id})
    
    await db.commit()
    return {"id": shop.id}


@router.put("/shops/{shop_id}")
async def update_shop_admin(shop_id: int, payload: ShopUpdateAdmin, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await require_admin_write(user)
    shop = await db.get(Shop, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    data = payload.model_dump(exclude_unset=True)
    if "owner_user_id" in data:
        owner = await UserRepo(db).get(int(data["owner_user_id"]))
        if not owner:
            raise HTTPException(status_code=404, detail="Owner user not found")
        shop.owner_user_id = int(data["owner_user_id"])
    if "name" in data and data["name"] is not None:
        shop.name = str(data["name"])[:120]
    if "is_active" in data and data["is_active"] is not None:
        shop.is_active = bool(data["is_active"])
    if "is_frozen" in data and data["is_frozen"] is not None:
        shop.is_frozen = bool(data["is_frozen"])
    if "wb_token" in data and data["wb_token"]:
        new_token = str(data["wb_token"])
        # Check if this token is already used by another shop
        existing_shops = await db.execute(select(Shop).where(Shop.is_active.is_(True), Shop.id != shop_id))
        for existing_shop in existing_shops.scalars().all():
            if existing_shop.wb_token_enc:
                try:
                    existing_token = decrypt_secret(existing_shop.wb_token_enc)
                    if existing_token == new_token:
                        raise HTTPException(
                            status_code=409, 
                            detail=f"Этот токен уже используется магазином «{existing_shop.name}». Один токен можно использовать только для одного магазина."
                        )
                except HTTPException:
                    raise
                except Exception:
                    pass
        shop.wb_token_enc = encrypt_secret(new_token)

    await AuditRepo(db).log("admin.shop.update", int(user.id), entity="shop", entity_id=shop_id)

    await db.commit()
    return {"ok": True}


@router.post("/shops/{shop_id}/disable")
async def disable_shop(shop_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """admin.shop.disable (super_admin only)."""
    await require_super_admin(user)
    shop = await db.get(Shop, int(shop_id))
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    shop.is_active = False
    await AuditRepo(db).log("admin.shop.disable", int(user.id), entity="shop", entity_id=shop.id)
    await db.commit()
    return {"ok": True}


@router.post("/shops/{shop_id}/freeze")
async def freeze_shop(shop_id: int, payload: dict, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """admin.shop.freeze (super_admin only)."""
    await require_super_admin(user)
    enabled = payload.get("is_frozen")
    if not isinstance(enabled, bool):
        raise HTTPException(status_code=400, detail="is_frozen must be boolean")
    shop = await db.get(Shop, int(shop_id))
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    shop.is_frozen = bool(enabled)
    await AuditRepo(db).log("admin.shop.freeze", int(user.id), entity="shop", entity_id=shop.id, details=str({"is_frozen": enabled}))
    await db.commit()
    return {"ok": True, "is_frozen": shop.is_frozen}


@router.post("/shops/{shop_id}/credits")
async def update_shop_credits(shop_id: int, payload: CreditsUpdate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Adjust shop credits (super_admin only)."""
    await require_super_admin(user)
    try:
        new_balance = await ShopBillingRepo(db).apply_credits(
            shop_id,
            delta=int(payload.delta),
            reason=payload.reason,
            actor_user_id=int(user.id),
            meta=payload.meta,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.commit()
    return {"ok": True, "credits_balance": new_balance}


@router.post("/users/{user_id}/credits")
async def update_user_credits(user_id: int, payload: CreditsUpdate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await require_super_admin(user)
    repo = UserRepo(db)
    u = await repo.get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        new_balance = await repo.apply_credits(user_id, delta=int(payload.delta), reason=payload.reason, meta=payload.meta)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.commit()
    return {"ok": True, "credits_balance": new_balance}


@router.put("/users/{user_id}/role")
async def update_user_role(user_id: int, payload: dict, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await require_admin_write(user)

    # Safety: do not allow a user to change their own platform role (prevents lock-out).
    if int(user_id) == int(user.id):
        raise HTTPException(status_code=403, detail="Cannot change your own platform role")

    role = payload.get("role")
    if role not in UserRole.values():
        raise HTTPException(status_code=400, detail="Invalid role")
    repo = UserRepo(db)
    u = await repo.get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.role = role
    await db.commit()
    return {"ok": True}


@router.get("/prompts")
async def get_prompts(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await require_super_admin(user)
    bundle = await get_global_bundle(db)
    return bundle.as_dict()


@router.put("/prompts")
async def update_prompts(payload: dict, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await require_super_admin(user)

    if "key" in payload and "value" in payload:
        key = str(payload.get("key") or "").strip()
        if not key:
            raise HTTPException(status_code=400, detail="key is required")
        value = payload.get("value")
        repo = PromptRepo(db)
        if isinstance(value, (dict, list)):
            await repo.set_json(scope="global", key=key, value_json=value)
        else:
            await repo.set_text(scope="global", key=key, value_text=str(value) if value is not None else "")
        bundle = await get_global_bundle(db)
        await db.commit()
        return bundle.as_dict()

    if "tone_map" in payload and not isinstance(payload.get("tone_map"), dict):
        raise HTTPException(status_code=400, detail="tone_map must be an object")
    if "tone_options" in payload and not isinstance(payload.get("tone_options"), list):
        raise HTTPException(status_code=400, detail="tone_options must be an array")

    bundle = await set_global_bundle(db, payload)
    await db.commit()
    return bundle.as_dict()


@router.get("/prompts/{key}")
async def get_prompt_by_key(key: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await require_super_admin(user)
    bundle = await get_global_bundle(db)
    data = bundle.as_dict()
    if key not in data:
        raise HTTPException(status_code=404, detail="Unknown key")
    return {"key": key, "value": data[key]}


@router.put("/prompts/{key}")
async def put_prompt_by_key(key: str, payload: dict, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Upsert single prompt record.

    Body supports: {"value": <text|json>}.
    """
    await require_super_admin(user)
    value = payload.get("value") if isinstance(payload, dict) else None
    repo = PromptRepo(db)
    if isinstance(value, (dict, list)):
        await repo.set_json(scope="global", key=key, value_json=value)
    else:
        await repo.set_text(scope="global", key=key, value_text=str(value) if value is not None else "")
    bundle = await get_global_bundle(db)
    await db.commit()
    return {"ok": True, "key": key, "value": bundle.as_dict().get(key)}


@router.get("/tones")
async def list_tones(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await require_super_admin(user)
    try:
        tones = await ToneRepo(db).list_all()
    except Exception:
        raise HTTPException(status_code=500, detail="Tones table is missing. Run migrations (alembic upgrade head).")
    return [
        {
            "id": t.id,
            "code": t.code,
            "label": t.label,
            "hint": t.hint,
            "instruction": t.instruction,
            "example": getattr(t, "example", None),
            "sort_order": t.sort_order,
            "is_active": t.is_active,
        }
        for t in tones
    ]


@router.post("/tones")
async def create_tone(payload: ToneCreate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await require_super_admin(user)
    repo = ToneRepo(db)
    try:
        existing = await repo.get_by_code(payload.code)
    except Exception:
        raise HTTPException(status_code=500, detail="Tones table is missing. Run migrations (alembic upgrade head).")
    if existing:
        raise HTTPException(status_code=400, detail="Tone code already exists")
    tone = await repo.create(
        code=payload.code,
        label=payload.label,
        hint=payload.hint,
        instruction=payload.instruction,
        example=payload.example,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    await db.commit()
    return {"id": tone.id}


@router.put("/tones/{tone_id}")
async def update_tone(tone_id: int, payload: ToneUpdate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await require_super_admin(user)
    repo = ToneRepo(db)
    try:
        tone = await repo.get_by_id(tone_id)
    except Exception:
        raise HTTPException(status_code=500, detail="Tones table is missing. Run migrations (alembic upgrade head).")
    if not tone:
        raise HTTPException(status_code=404, detail="Tone not found")
    data = payload.model_dump(exclude_unset=True)
    await repo.update(tone, data)
    await db.commit()
    return {"ok": True}


@router.delete("/tones/{tone_id}")
async def delete_tone(tone_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await require_super_admin(user)
    repo = ToneRepo(db)
    try:
        tone = await repo.get_by_id(tone_id)
    except Exception:
        raise HTTPException(status_code=500, detail="Tones table is missing. Run migrations (alembic upgrade head).")
    if not tone:
        raise HTTPException(status_code=404, detail="Tone not found")
    await repo.deactivate(tone)
    await db.commit()
    return {"ok": True}
