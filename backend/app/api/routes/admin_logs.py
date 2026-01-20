from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.api.access import require_admin_read, require_super_admin
from app.models.job import Job
from app.models.enums import JobStatus


router = APIRouter()


@router.get("",
            summary="List recent job errors")
async def list_logs(
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    shop_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """admin.logs.read (super_admin + support_admin).

    For v1, we expose worker/job failures as operational logs.
    """
    await require_admin_read(user)
    q = select(Job).where(Job.status == JobStatus.failed.value).order_by(desc(Job.id)).limit(limit).offset(offset)
    rows = await db.execute(q)
    jobs = list(rows.scalars().all())
    out = []
    for j in jobs:
        sid = None
        if isinstance(j.payload, dict):
            sid = j.payload.get("shop_id")
        if shop_id is not None and sid is not None and int(sid) != int(shop_id):
            continue
        out.append(
            {
                "id": j.id,
                "type": j.type,
                "status": j.status,
                "attempts": j.attempts,
                "max_attempts": j.max_attempts,
                "run_at": j.run_at,
                "payload": j.payload,
                "last_error": j.last_error,
                "created_at": j.created_at,
            }
        )
    return out


@router.get("/export")
async def export_logs(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """admin.logs.export (super_admin only)."""
    await require_super_admin(user)
    q = select(Job).where(Job.status == JobStatus.failed.value).order_by(desc(Job.id)).limit(5000)
    rows = await db.execute(q)
    jobs = list(rows.scalars().all())

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "type", "status", "attempts", "max_attempts", "run_at", "payload", "last_error", "created_at"])
    for j in jobs:
        writer.writerow([j.id, j.type, j.status, j.attempts, j.max_attempts, j.run_at, j.payload, j.last_error, j.created_at])
    buf.seek(0)

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=job_errors.csv"},
    )
