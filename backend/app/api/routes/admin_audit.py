from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.api.access import require_admin_read
from app.models.audit import AuditLog


router = APIRouter()


@router.get("")
async def list_audit_logs(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user_id: int | None = Query(default=None),
    action: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """admin.audit.read (super_admin + support_admin)."""
    await require_admin_read(user)
    q = select(AuditLog)
    if user_id is not None:
        q = q.where(AuditLog.user_id == int(user_id))
    if action:
        q = q.where(AuditLog.action == action)
    q = q.order_by(desc(AuditLog.id)).limit(limit).offset(offset)
    rows = await db.execute(q)
    logs = list(rows.scalars().all())
    return [
        {
            "id": l.id,
            "user_id": l.user_id,
            "action": l.action,
            "entity": l.entity,
            "entity_id": l.entity_id,
            "details": l.details,
            "created_at": l.created_at,
        }
        for l in logs
    ]