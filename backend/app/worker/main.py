from __future__ import annotations

import asyncio
import traceback

from app.core.config import settings
from app.core.db import AsyncSessionMaker
from app.repos.job_repo import JobRepo
from app.models.enums import JobStatus
from app.worker.tasks import handle_job
from app.worker.scheduler import scheduler_tick


async def worker_tick() -> None:
    async with AsyncSessionMaker() as session:
        repo = JobRepo(session)

        async with session.begin():
            jobs = await repo.fetch_for_work(limit=settings.WORKER_MAX_JOBS_PER_TICK)
            for job in jobs:
                await repo.mark_running(job.id)

        for job in jobs:
            try:
                async with AsyncSessionMaker() as s2:
                    async with s2.begin():
                        await handle_job(s2, job.type, job.payload)
                        await JobRepo(s2).mark_done(job.id)
            except Exception as e:
                err = f"{type(e).__name__}: {e}"
                tb = traceback.format_exc()
                async with AsyncSessionMaker() as s3:
                    async with s3.begin():
                        await JobRepo(s3).mark_failed(job.id, error=err)
                print(f"[worker] job {job.id} failed: {err}\n{tb}")


async def main() -> None:
    print("[worker] started")
    while True:
        # periodic scheduling (autosync)
        try:
            async with AsyncSessionMaker() as s:
                async with s.begin():
                    await scheduler_tick(s)
        except Exception as e:
            print(f"[worker] scheduler error: {e}")

        await worker_tick()
        await asyncio.sleep(settings.WORKER_POLL_INTERVAL_SEC)


if __name__ == "__main__":
    asyncio.run(main())
