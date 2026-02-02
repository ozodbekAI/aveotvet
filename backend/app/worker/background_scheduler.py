"""Background scheduler that runs with uvicorn (FastAPI lifespan).

This module provides an async background task that runs scheduler + worker
automatically when FastAPI app starts, eliminating the need for a separate worker process.
"""

from __future__ import annotations

import asyncio
import traceback
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy import text

from app.core.config import settings
from app.core.db import AsyncSessionMaker, engine
from app.repos.job_repo import JobRepo
from app.worker.tasks import handle_job
from app.worker.scheduler import scheduler_tick


log = logging.getLogger(__name__)

# Global flag to control the background loop
_running = False
_task: asyncio.Task | None = None


async def _worker_tick() -> None:
    """Process pending jobs from the queue."""
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
                log.warning("[background-worker] job %s failed: %s\n%s", job.id, err, tb)


async def _background_loop() -> None:
    """Main background loop that runs scheduler + worker ticks."""
    global _running
    log.info("[background-scheduler] started")
    
    while _running:
        try:
            # Run scheduler tick (enqueues periodic jobs)
            async with AsyncSessionMaker() as s:
                async with s.begin():
                    await scheduler_tick(s)
        except Exception as e:
            log.error("[background-scheduler] scheduler error: %s", e)

        try:
            # Run worker tick (processes jobs)
            await _worker_tick()
        except Exception as e:
            log.error("[background-scheduler] worker error: %s", e)

        # Wait before next iteration
        await asyncio.sleep(settings.WORKER_POLL_INTERVAL_SEC)
    
    log.info("[background-scheduler] stopped")


def start_background_scheduler() -> None:
    """Start the background scheduler task."""
    global _running, _task
    if _running:
        return
    
    _running = True
    _task = asyncio.create_task(_background_loop())
    log.info("[background-scheduler] task created")


async def stop_background_scheduler() -> None:
    """Stop the background scheduler task gracefully."""
    global _running, _task
    if not _running:
        return
    
    _running = False
    if _task is not None:
        # Give it a moment to finish current iteration
        try:
            await asyncio.wait_for(_task, timeout=10.0)
        except asyncio.TimeoutError:
            _task.cancel()
            try:
                await _task
            except asyncio.CancelledError:
                pass
        _task = None
    log.info("[background-scheduler] task stopped")


@asynccontextmanager
async def lifespan_with_scheduler(app) -> AsyncGenerator[None, None]:
    """FastAPI lifespan context manager that starts/stops the background scheduler.
    
    Also runs startup DB patches (tones table, etc.).
    
    Usage in main.py:
        from app.worker.background_scheduler import lifespan_with_scheduler
        app = FastAPI(lifespan=lifespan_with_scheduler)
    """
    # Startup: run DB patches first
    await _startup_db_patch()
    
    # Start the background scheduler
    start_background_scheduler()
    
    yield
    
    # Shutdown
    await stop_background_scheduler()


async def _startup_db_patch() -> None:
    """Lightweight DB forward-compat patches + seeds.

    We avoid requiring Alembic for small additions used by UI.
    Safe to run multiple times.

    What we ensure:
    - `tones` table exists (for dynamic Tone picker)
    - `example` column exists
    - default tone rows are inserted when the table is empty
    """
    try:
        if not (settings.DATABASE_URL or "").startswith("postgres"):
            return

        DEFAULT_TONES = [
            {
                "code": "none",
                "label": "Без тональности",
                "hint": "Настройка по умолчанию. Тональность отключена.",
                "instruction": "",
                "example": "Спасибо за отзыв!",
                "sort_order": 0,
            },
            {
                "code": "business",
                "label": "Деловая",
                "hint": "Официальный стиль ответа.",
                "instruction": "Business tone. Formal, concise, no slang.",
                "example": "Благодарим за обратную связь. Мы ценим ваше мнение.",
                "sort_order": 10,
            },
            {
                "code": "friendly",
                "label": "Дружелюбная",
                "hint": "Тёплый и доброжелательный тон.",
                "instruction": "Friendly tone. Warm, polite, positive. No slang.",
                "example": "Спасибо за отзыв! Очень рады, что вам понравилось 😊",
                "sort_order": 20,
            },
            {
                "code": "joking",
                "label": "Шутливая",
                "hint": "Лёгкая шутка допустима, но без фамильярности.",
                "instruction": "Light joking tone. One gentle joke max. Still polite and professional.",
                "example": "Спасибо! Будем стараться не только радовать, но и удивлять 😉",
                "sort_order": 30,
            },
            {
                "code": "serious",
                "label": "Серьёзная",
                "hint": "Строго и по делу.",
                "instruction": "Serious tone. Strictly factual, no jokes, no emojis.",
                "example": "Спасибо за отзыв. Учтём замечания и улучшим качество.",
                "sort_order": 40,
            },
            {
                "code": "empathetic",
                "label": "Эмпатичная",
                "hint": "С сочувствием, акцент на понимание клиента.",
                "instruction": "Empathetic tone. Show understanding, apologize if appropriate, offer help.",
                "example": "Спасибо, что написали. Нам очень жаль, что возникла ситуация — мы разберёмся.",
                "sort_order": 50,
            },
        ]

        async with engine.begin() as conn:
            # 1) Ensure table exists
            await conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS tones (
                        id SERIAL PRIMARY KEY,
                        code VARCHAR(64) NOT NULL UNIQUE,
                        label VARCHAR(128) NOT NULL,
                        hint VARCHAR(255) NULL,
                        instruction TEXT NULL,
                        example TEXT NULL,
                        sort_order INTEGER NOT NULL DEFAULT 0,
                        is_active BOOLEAN NOT NULL DEFAULT TRUE
                    )
                    """
                )
            )

            # 2) Ensure columns exist (forward-compat)
            await conn.execute(text("ALTER TABLE tones ADD COLUMN IF NOT EXISTS hint VARCHAR(255)"))
            await conn.execute(text("ALTER TABLE tones ADD COLUMN IF NOT EXISTS instruction TEXT"))
            await conn.execute(text("ALTER TABLE tones ADD COLUMN IF NOT EXISTS example TEXT"))
            await conn.execute(text("ALTER TABLE tones ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0"))
            await conn.execute(text("ALTER TABLE tones ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE"))

            # 3) Seed defaults only when empty
            res = await conn.execute(text("SELECT COUNT(*) FROM tones"))
            cnt = int(res.scalar_one() or 0)
            if cnt == 0:
                for t in DEFAULT_TONES:
                    await conn.execute(
                        text(
                            """
                            INSERT INTO tones (code, label, hint, instruction, example, sort_order, is_active)
                            VALUES (:code, :label, :hint, :instruction, :example, :sort_order, TRUE)
                            ON CONFLICT (code) DO NOTHING
                            """
                        ),
                        t,
                    )
        log.info("[startup] DB patches applied successfully")
    except Exception as e:
        log.warning("[startup] DB patch failed: %s", e)
        # Do not block app startup if DB patch fails.
