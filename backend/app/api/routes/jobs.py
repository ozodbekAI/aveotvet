from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.api.deps import get_db, get_current_user
from app.models.job import Job
from app.repos.shop_repo import ShopRepo
from app.schemas.jobs import JobOut

router = APIRouter()


async def _authorize_job(user_id: int, db: AsyncSession, job: Job) -> None:
    shop_id = None
    if isinstance(job.payload, dict):
        shop_id = job.payload.get("shop_id")
    if shop_id is None:
        raise HTTPException(status_code=403, detail="Forbidden")
    shop = await ShopRepo(db).get(user_id, int(shop_id))
    if not shop:
        raise HTTPException(status_code=403, detail="Forbidden")


@router.get("/{job_id}", response_model=JobOut)
async def get_job(job_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    await _authorize_job(user.id, db, job)
    return job


@router.get("", response_model=list[JobOut])
async def list_jobs(
    shop_id: int | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    q = select(Job).order_by(desc(Job.id)).limit(limit).offset(offset)
    res = await db.execute(q)
    jobs = list(res.scalars().all())

    out: list[Job] = []
    for j in jobs:
        if not isinstance(j.payload, dict):
            continue
        sid = j.payload.get("shop_id")
        if sid is None:
            continue
        if shop_id is not None and int(sid) != int(shop_id):
            continue
        shop = await ShopRepo(db).get(user.id, int(sid))
        if shop:
            out.append(j)
    return out
