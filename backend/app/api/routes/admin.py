from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.api.access import require_super_admin
from app.models.enums import UserRole
from app.repos.user_repo import UserRepo
from app.repos.prompt_repo import PromptRepo
from app.repos.tone_repo import ToneRepo
from app.schemas.tone import ToneCreate, ToneUpdate
from app.services.prompt_store import get_global_bundle, set_global_bundle

router = APIRouter()


@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await require_super_admin(user)
    users = await UserRepo(db).list_all()
    return [{"id": u.id, "email": u.email, "role": getattr(u, "role", UserRole.user.value), "is_active": u.is_active} for u in users]


@router.put("/users/{user_id}/role")
async def update_user_role(user_id: int, payload: dict, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    await require_super_admin(user)
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
