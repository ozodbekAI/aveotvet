from __future__ import annotations

from datetime import datetime, timezone, timedelta
from sqlalchemy import select, and_, asc, update, func, cast, Integer
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job
from app.models.enums import JobStatus


class JobRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def enqueue(self, type: str, payload: dict, run_at: datetime | None = None, max_attempts: int = 5) -> Job:
        job = Job(type=type, payload=payload, run_at=run_at or datetime.now(timezone.utc), max_attempts=max_attempts)
        self.session.add(job)
        await self.session.flush()
        return job

    async def fetch_for_work(self, limit: int) -> list[Job]:
        q = (
            select(Job)
            .where(and_(Job.status == JobStatus.queued.value, Job.run_at <= datetime.now(timezone.utc)))
            .order_by(asc(Job.run_at), asc(Job.id))
            .with_for_update(skip_locked=True)
            .limit(limit)
        )
        res = await self.session.execute(q)
        return list(res.scalars().all())

    async def mark_running(self, job_id: int) -> None:
        await self.session.execute(update(Job).where(Job.id == job_id).values(status=JobStatus.running.value))

    async def mark_done(self, job_id: int) -> None:
        await self.session.execute(update(Job).where(Job.id == job_id).values(status=JobStatus.done.value))

    async def mark_failed(self, job_id: int, error: str, retry_in_seconds: int | None = None) -> None:
        job = await self.session.get(Job, job_id)
        if not job:
            return
        job.attempts += 1
        job.last_error = error[:4000]
        if job.attempts >= job.max_attempts:
            job.status = JobStatus.failed.value
        else:
            job.status = JobStatus.queued.value
            if retry_in_seconds:
                job.run_at = datetime.now(timezone.utc) + timedelta(seconds=retry_in_seconds)
        await self.session.flush()

    async def exists_pending_for_shop(
        self,
        job_type: str,
        shop_id: int,
        *,
        max_age_minutes: int = 180,
    ) -> bool:
        """Return True if there is a queued/running job of given type for this shop.

        We look only at reasonably recent jobs to avoid a permanently stuck old record blocking scheduling.
        """
        since = datetime.now(timezone.utc) - timedelta(minutes=max_age_minutes)
        q = select(func.count()).select_from(Job).where(
            Job.type == job_type,
            Job.status.in_([JobStatus.queued.value, JobStatus.running.value]),
            Job.created_at >= since,
            cast(Job.payload["shop_id"].astext, Integer) == int(shop_id),
        )
        cnt = (await self.session.execute(q)).scalar_one()
        return int(cnt) > 0

    async def count_by_status(self, status: str) -> int:
        q = select(func.count()).select_from(Job).where(Job.status == status)
        return int((await self.session.execute(q)).scalar_one() or 0)
