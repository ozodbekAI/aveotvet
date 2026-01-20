from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import (
    health,
    auth,
    shops,
    settings,
    feedbacks,
    buyers,
    chats,
    questions,
    jobs,
    drafts,
    admin,
    prompts,
    dashboard,
    billing,
    admin_dashboard,
    admin_payments,
    admin_ops,
    admin_audit,
    admin_logs,
    admin_ai,
    admin_integrations,
)

router = APIRouter()
router.include_router(health.router, tags=["health"])
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(shops.router, prefix="/shops", tags=["shops"])
router.include_router(settings.router, prefix="/settings", tags=["settings"])
router.include_router(billing.router, prefix="/billing", tags=["billing"])
router.include_router(feedbacks.router, prefix="/feedbacks", tags=["feedbacks"])
router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
router.include_router(drafts.router, prefix="/drafts", tags=["drafts"])
router.include_router(questions.router, prefix="/questions", tags=["questions"])
router.include_router(buyers.router, prefix="/buyers", tags=["buyers"])
router.include_router(chats.router, prefix="/chats", tags=["chats"])
router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
router.include_router(prompts.router, prefix="/prompts", tags=["prompts"])
router.include_router(admin.router, prefix="/admin", tags=["admin"])
router.include_router(admin_dashboard.router, prefix="/admin/dashboard", tags=["admin_dashboard"])
router.include_router(admin_payments.router, prefix="/admin/payments", tags=["admin_payments"])
router.include_router(admin_ops.router, prefix="/admin/ops", tags=["admin_ops"])
router.include_router(admin_audit.router, prefix="/admin/audit", tags=["admin_audit"])
router.include_router(admin_logs.router, prefix="/admin/logs", tags=["admin_logs"])
router.include_router(admin_ai.router, prefix="/admin/ai", tags=["admin_ai"])
router.include_router(admin_integrations.router, prefix="/admin/integrations", tags=["admin_integrations"])
