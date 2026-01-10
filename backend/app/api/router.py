from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import health, auth, shops, settings, feedbacks, buyers, chats, questions, jobs, drafts

router = APIRouter()
router.include_router(health.router, tags=["health"])
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(shops.router, prefix="/shops", tags=["shops"])
router.include_router(settings.router, prefix="/settings", tags=["settings"])
router.include_router(feedbacks.router, prefix="/feedbacks", tags=["feedbacks"])
router.include_router(drafts.router, prefix="/drafts", tags=["drafts"])
router.include_router(questions.router, prefix="/questions", tags=["questions"])
router.include_router(buyers.router, prefix="/buyers", tags=["buyers"])
router.include_router(chats.router, prefix="/chats", tags=["chats"])
router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
