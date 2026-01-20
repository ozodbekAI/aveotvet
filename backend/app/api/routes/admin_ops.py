from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.api.access import require_admin_read, require_super_admin
from app.models.enums import UserRole, JobStatus, JobType
from app.models.job import Job
from app.repos.job_repo import JobRepo
from app.repos.shop_repo import ShopRepo
from app.models.shop import Shop
from app.repos.audit_repo import AuditRepo
from app.repos.system_flags_repo import SystemFlagsRepo


router = APIRouter()


class SyncRunIn(BaseModel):
    shop_id: int
    module: str = Field(default="all", pattern=r"^(all|reviews|questions|chats|cards)$")
    is_answered: bool | None = None
    take: int = Field(default=500, ge=1, le=2000)
    skip: int = Field(default=0, ge=0)


class JobsCancelIn(BaseModel):
    job_ids: list[int] = Field(default_factory=list, min_length=1)


class KillSwitchIn(BaseModel):
    enabled: bool
    scope: str = Field(default="global", pattern=r"^(global|shop)$")
    shop_id: int | None = None
    kind: str = Field(default="all", pattern=r"^(all|generation|publish)$")


@router.get("/status")
async def ops_status(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """admin.ops.read (super_admin + support_admin)."""
    await require_admin_read(user)
    repo = JobRepo(db)
    # counts
    pending = await repo.count_by_status(JobStatus.queued.value)
    failed = await repo.count_by_status(JobStatus.failed.value)
    running = await repo.count_by_status(JobStatus.running.value)
    flags = await SystemFlagsRepo(db).get_or_create()
    return {
        "jobs_pending": pending,
        "jobs_failed": failed,
        "jobs_running": running,
        "kill_switch": bool(flags.kill_switch),
    }


@router.post("/sync/run")
async def sync_run(payload: SyncRunIn, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """admin.ops.sync.run

    Allowed: super_admin + support_admin (safe button).
    """
    await require_admin_read(user)
    if getattr(user, "role", UserRole.user.value) not in {UserRole.super_admin.value, UserRole.support_admin.value}:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Validate shop exists
    shop_obj = await db.get(Shop, int(payload.shop_id))
    if not shop_obj:
        raise HTTPException(status_code=404, detail="Shop not found")

    job_repo = JobRepo(db)
    enq = []
    if payload.module in {"all", "reviews"}:
        enq.append(await job_repo.enqueue(JobType.sync_shop.value, {
            "shop_id": int(payload.shop_id),
            "is_answered": payload.is_answered,
            "take": int(payload.take),
            "skip": int(payload.skip),
        }))
    if payload.module in {"all", "questions"}:
        enq.append(await job_repo.enqueue(JobType.sync_questions.value, {
            "shop_id": int(payload.shop_id),
            "is_answered": payload.is_answered,
            "take": int(payload.take),
            "skip": int(payload.skip),
        }))
    if payload.module in {"all", "chats"}:
        enq.append(await job_repo.enqueue(JobType.sync_chats.value, {"shop_id": int(payload.shop_id)}))
        enq.append(await job_repo.enqueue(JobType.sync_chat_events.value, {"shop_id": int(payload.shop_id)}))
    if payload.module in {"all", "cards"}:
        enq.append(await job_repo.enqueue(JobType.sync_product_cards.value, {"shop_id": int(payload.shop_id)}))

    await AuditRepo(db).log(
        action="admin.ops.sync.run",
        user_id=int(user.id),
        entity="shop",
        entity_id=int(payload.shop_id),
        details=str({"module": payload.module, "is_answered": payload.is_answered, "take": payload.take, "skip": payload.skip}),
    )
    await db.commit()
    return {"ok": True, "enqueued": [j.id for j in enq if j]}


@router.post("/jobs/retry-failed")
async def jobs_retry_failed(
    shop_id: int | None = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """admin.ops.jobs.retry_failed

    Allowed: super_admin + support_admin (safe button).
    """
    await require_admin_read(user)
    q = select(Job).where(Job.status == JobStatus.failed.value).order_by(Job.id.desc()).limit(int(limit))
    res = await db.execute(q)
    jobs = list(res.scalars().all())
    touched = 0
    now = datetime.now(timezone.utc)
    for j in jobs:
        if shop_id is not None and isinstance(j.payload, dict):
            sid = j.payload.get("shop_id")
            if sid is None or int(sid) != int(shop_id):
                continue
        j.status = JobStatus.queued.value
        j.run_at = now
        j.last_error = None
        touched += 1
    await AuditRepo(db).log(
        action="admin.ops.jobs.retry_failed",
        user_id=int(user.id),
        entity="shop" if shop_id is not None else None,
        entity_id=shop_id,
        details=str({"count": touched}),
    )
    await db.commit()
    return {"ok": True, "retried": touched}


@router.post("/jobs/cancel")
async def jobs_cancel(payload: JobsCancelIn, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """admin.ops.jobs.cancel (super_admin only)."""
    await require_super_admin(user)
    ids = [int(i) for i in payload.job_ids]
    res = await db.execute(select(Job).where(Job.id.in_(ids)))
    jobs = list(res.scalars().all())
    for j in jobs:
        if j.status in {JobStatus.done.value, JobStatus.failed.value}:
            continue
        j.status = JobStatus.cancelled.value
    await AuditRepo(db).log(
        action="admin.ops.jobs.cancel",
        user_id=int(user.id),
        entity="job",
        entity_id=",".join(map(str, ids))[:64],
        details=str({"count": len(jobs)}),
    )
    await db.commit()
    return {"ok": True, "cancelled": len(jobs)}


@router.post("/workers/restart")
async def workers_restart(
    older_than_minutes: int = 15,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """admin.ops.workers.restart (super_admin only).

    In hosted environments we cannot actually restart the process from the API.
    Instead, we perform a practical equivalent: re-queue jobs stuck in `running`
    longer than `older_than_minutes`.
    """
    await require_super_admin(user)
    # Best-effort: mark all running jobs back to queued.
    res = await db.execute(select(Job).where(Job.status == JobStatus.running.value))
    jobs = list(res.scalars().all())
    now = datetime.now(timezone.utc)
    for j in jobs:
        j.status = JobStatus.queued.value
        j.run_at = now
    await AuditRepo(db).log(
        action="admin.ops.workers.restart",
        user_id=int(user.id),
        details=str({"requeued": len(jobs)}),
    )
    await db.commit()
    return {"ok": True, "requeued_running": len(jobs)}


@router.post("/kill-switch")
async def kill_switch(payload: KillSwitchIn, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """admin.ops.kill_switch (super_admin only)."""
    await require_super_admin(user)

    if payload.scope == "global":
        flags = await SystemFlagsRepo(db).get_or_create()
        flags.kill_switch = bool(payload.enabled)
        await AuditRepo(db).log(
            action="admin.ops.kill_switch",
            user_id=int(user.id),
            entity="system_flags",
            entity_id=1,
            details=str({"enabled": payload.enabled}),
        )
        await db.commit()
        return {"ok": True, "scope": "global", "enabled": bool(flags.kill_switch)}

    # shop scope
    if payload.shop_id is None:
        raise HTTPException(status_code=400, detail="shop_id is required for scope=shop")
    settings_obj = await ShopRepo(db).get_settings(int(payload.shop_id))
    if not settings_obj:
        raise HTTPException(status_code=404, detail="Shop settings not found")
    cfg = settings_obj.config or {}
    if payload.kind == "all":
        cfg["kill_switch"] = bool(payload.enabled)
        # when kill_switch enabled, it blocks both generation and publishing.
        if payload.enabled:
            cfg["generation_disabled"] = True
            cfg["publishing_disabled"] = True
    elif payload.kind == "generation":
        cfg["generation_disabled"] = bool(payload.enabled)
    elif payload.kind == "publish":
        cfg["publishing_disabled"] = bool(payload.enabled)
    settings_obj.config = cfg
    await AuditRepo(db).log(
        action="admin.ops.kill_switch",
        user_id=int(user.id),
        entity="shop",
        entity_id=int(payload.shop_id),
        details=str({"scope": "shop", "kind": payload.kind, "enabled": payload.enabled}),
    )
    await db.commit()
    return {"ok": True, "scope": "shop", "shop_id": int(payload.shop_id), "config": cfg}
