from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.api.access import require_admin_read, require_super_admin
from app.repos.ai_settings_repo import AISettingsRepo
from app.repos.audit_repo import AuditRepo


router = APIRouter()


@router.get("/providers")
async def providers_read(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """admin.ai.providers.read

    Read is allowed to super_admin and support_admin (support gets no money numbers anyway).
    """
    await require_admin_read(user)
    row = await AISettingsRepo(db).get_or_create()
    return {"providers": row.providers}


@router.put("/providers")
async def providers_update(payload: dict, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """admin.ai.providers.update (super_admin only)."""
    await require_super_admin(user)
    row = await AISettingsRepo(db).get_or_create()
    row.providers = payload.get("providers") or {}
    await AuditRepo(db).log("admin.ai.providers.update", int(user.id), entity="ai_settings", entity_id=1)
    await db.commit()
    return {"ok": True}


@router.get("/feature-flags")
async def feature_flags_read(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """admin.ai.feature_flags.read"""
    await require_admin_read(user)
    row = await AISettingsRepo(db).get_or_create()
    return {"feature_flags": row.feature_flags}


@router.put("/feature-flags")
async def feature_flags_update(payload: dict, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """admin.ai.feature_flags.update (super_admin only)."""
    await require_super_admin(user)
    row = await AISettingsRepo(db).get_or_create()
    row.feature_flags = payload.get("feature_flags") or {}
    await AuditRepo(db).log("admin.ai.feature_flags.update", int(user.id), entity="ai_settings", entity_id=1)
    await db.commit()
    return {"ok": True}


@router.get("/policies")
async def policies_read(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """admin.ai.policies.read (not in TZ list but useful for admin UI)."""
    await require_admin_read(user)
    row = await AISettingsRepo(db).get_or_create()
    return {"policies": row.policies}


@router.put("/policies")
async def policies_update(payload: dict, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """admin.ai.policies.update (super_admin only)."""
    await require_super_admin(user)
    row = await AISettingsRepo(db).get_or_create()
    row.policies = payload.get("policies") or {}
    await AuditRepo(db).log("admin.ai.policies.update", int(user.id), entity="ai_settings", entity_id=1)
    await db.commit()
    return {"ok": True}
