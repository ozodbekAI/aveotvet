from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, text, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.shop import Shop
from app.models.settings import ShopSettings
from app.models.job import Job
from app.models.enums import JobStatus, JobType
from app.models.payments import Payment
from app.models.gpt_usage import GptUsage


class AdminDashboardRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def system_health(self) -> dict:
        now = datetime.now(timezone.utc)
        since_24h = now - timedelta(hours=24)

        active_shops = (await self.db.execute(select(func.count(Shop.id)).where(Shop.is_active.is_(True)))).scalar_one() or 0

        sync_failed_q = select(func.count(func.distinct(text("(payload->>'shop_id')"))))\
            .select_from(Job)\
            .where(Job.type == JobType.sync_shop.value)\
            .where(Job.status == JobStatus.failed.value)\
            .where(Job.updated_at >= since_24h)
        shops_with_sync_errors = int((await self.db.execute(sync_failed_q)).scalar() or 0)

        gen_types = [JobType.generate_draft.value, JobType.generate_question_draft.value, JobType.generate_chat_draft.value]
        generation_queue_size = int((await self.db.execute(select(func.count(Job.id)).where(Job.type.in_(gen_types)).where(Job.status == JobStatus.queued.value))).scalar() or 0)

        generation_errors_24h = int((await self.db.execute(select(func.count(Job.id)).where(Job.type.in_(gen_types)).where(Job.status == JobStatus.failed.value).where(Job.updated_at >= since_24h))).scalar() or 0)

        ap_enabled = select(func.count(ShopSettings.shop_id)).where(
            (ShopSettings.auto_publish.is_(True)) | (ShopSettings.questions_auto_publish.is_(True)) | (ShopSettings.chat_auto_reply.is_(True))
        )
        autopublish_enabled_shops = int((await self.db.execute(ap_enabled)).scalar() or 0)

        publish_types = [JobType.publish_answer.value, JobType.publish_question_answer.value, JobType.send_chat_message.value]
        autopublish_errors_24h = int((await self.db.execute(select(func.count(Job.id)).where(Job.type.in_(publish_types)).where(Job.status == JobStatus.failed.value).where(Job.updated_at >= since_24h))).scalar() or 0)

        return {
            "active_shops": int(active_shops),
            "shops_with_sync_errors": shops_with_sync_errors,
            "generation_queue_size": generation_queue_size,
            "generation_errors_24h": generation_errors_24h,
            "autopublish_enabled_shops": autopublish_enabled_shops,
            "autopublish_errors_24h": autopublish_errors_24h,
        }

    def _period_range(self, period: str) -> tuple[datetime | None, datetime | None]:
        now = datetime.now(timezone.utc)
        if period == "today":
            start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
            return start, now
        if period == "last_7_days":
            return now - timedelta(days=7), now
        if period == "last_30_days":
            return now - timedelta(days=30), now
        if period == "all_time":
            return None, None
        # default
        return now - timedelta(days=7), now

    async def finance(self, period: str) -> dict:
        date_from, date_to = self._period_range(period)

        pay_q = select(func.coalesce(func.sum(Payment.amount_rub), 0))
        gpt_q = select(func.coalesce(func.sum(GptUsage.cost_rub), 0))
        if date_from and date_to:
            pay_q = pay_q.where(Payment.created_at >= date_from).where(Payment.created_at <= date_to)
            gpt_q = gpt_q.where(GptUsage.created_at >= date_from).where(GptUsage.created_at <= date_to)

        money_received = float((await self.db.execute(pay_q)).scalar_one() or 0)
        gpt_cost = float((await self.db.execute(gpt_q)).scalar_one() or 0)

        # Breakdown by operation_type
        breakdown_q = select(
            GptUsage.operation_type,
            func.coalesce(func.sum(GptUsage.cost_rub), 0).label("cost"),
        ).group_by(GptUsage.operation_type)
        if date_from and date_to:
            breakdown_q = breakdown_q.where(GptUsage.created_at >= date_from).where(GptUsage.created_at <= date_to)
        rows = (await self.db.execute(breakdown_q)).all()

        breakdown = []
        total = gpt_cost if gpt_cost > 0 else 0.0
        for op, cost in rows:
            c = float(cost or 0)
            breakdown.append({
                "operation_type": op,
                "gpt_cost_rub": c,
                "percent": (c / total * 100.0) if total else 0.0,
            })
        breakdown.sort(key=lambda x: x["gpt_cost_rub"], reverse=True)

        # Top shops by GPT cost
        top_q = select(
            Shop.id,
            Shop.name,
            func.coalesce(func.sum(GptUsage.cost_rub), 0).label("gpt_cost_rub"),
            func.count(GptUsage.id).label("generations_count"),
        ).join(Shop, Shop.id == GptUsage.shop_id).group_by(Shop.id)
        if date_from and date_to:
            top_q = top_q.where(GptUsage.created_at >= date_from).where(GptUsage.created_at <= date_to)
        top_q = top_q.order_by(text("gpt_cost_rub DESC")).limit(20)
        top_rows = (await self.db.execute(top_q)).all()
        top_shops = [
            {"shop_id": int(sid), "shop": name, "gpt_cost_rub": float(cost or 0), "generations_count": int(cnt or 0)}
            for sid, name, cost, cnt in top_rows
        ]

        # Financial incidents: zero balance shops
        zero_q = select(Shop.id, Shop.name).where(Shop.credits_balance <= 0)
        zero_rows = (await self.db.execute(zero_q)).all()
        incidents = [{"shop_id": int(sid), "shop": name, "incident_type": "zero_balance"} for sid, name in zero_rows]

        return {
            "summary": {
                "period": period,
                "date_from": date_from,
                "date_to": date_to,
                "money_received_rub": money_received,
                "gpt_cost_rub": gpt_cost,
                "gross_result_rub": money_received - gpt_cost,
            },
            "breakdown": breakdown,
            "top_shops": top_shops,
            "incidents": incidents,
        }

    async def ops(self) -> dict:
        now = datetime.now(timezone.utc)
        since_24h = now - timedelta(hours=24)

        jobs_pending = int((await self.db.execute(select(func.count(Job.id)).where(Job.status == JobStatus.queued.value))).scalar() or 0)
        jobs_running = int((await self.db.execute(select(func.count(Job.id)).where(Job.status == JobStatus.running.value))).scalar() or 0)
        jobs_failed = int((await self.db.execute(select(func.count(Job.id)).where(Job.status == JobStatus.failed.value).where(Job.updated_at >= since_24h))).scalar() or 0)
        jobs_retrying = int((await self.db.execute(select(func.count(Job.id)).where(Job.status == JobStatus.retrying.value))).scalar() or 0)

        # Avg generation time for generation jobs that completed in last 24h (best-effort)
        gen_types = [JobType.generate_draft.value, JobType.generate_question_draft.value, JobType.generate_chat_reply.value]
        avg_q = select(func.avg(func.extract("epoch", Job.updated_at - Job.created_at))).where(
            Job.type.in_(gen_types),
            Job.status == JobStatus.done.value,
            Job.updated_at >= since_24h,
        )
        avg_sec = float((await self.db.execute(avg_q)).scalar() or 0.0)

        # Errors table
        # Group by a coarse error type prefix (split by ':')
        err_expr = func.split_part(func.coalesce(Job.last_error, ""), ":", 1)
        errs_q = select(
            err_expr.label("err"),
            func.count(Job.id).label("cnt"),
            func.max(Job.updated_at).label("last_seen"),
        ).where(Job.status == JobStatus.failed.value).where(Job.updated_at >= since_24h).group_by(err_expr).order_by(text("cnt DESC")).limit(30)
        errs = (await self.db.execute(errs_q)).all()
        errors = [
            {"error_type": (e or "unknown"), "count_24h": int(c or 0), "last_seen": ls}
            for e, c, ls in errs
        ]

        return {
            "summary": {
                "jobs_pending": jobs_pending,
                "jobs_running": jobs_running,
                "jobs_failed_24h": jobs_failed,
                "jobs_retrying": jobs_retrying,
                "avg_generation_time_sec": avg_sec,
            },
            "errors": errors,
        }

    async def shop_dashboard(self, shop_id: int) -> dict:
        now = datetime.now(timezone.utc)
        since_24h = now - timedelta(hours=24)

        shop = await self.db.get(Shop, shop_id)
        if not shop:
            return {}
        settings_obj = await self.db.get(ShopSettings, shop_id)

        balance_row = int(getattr(shop, "credits_balance", 0) or 0)

        gpt_cost_24h = float((await self.db.execute(select(func.coalesce(func.sum(GptUsage.cost_rub), 0)).where(GptUsage.shop_id == shop_id).where(GptUsage.created_at >= since_24h))).scalar_one() or 0)
        responses_generated_24h = int((await self.db.execute(select(func.count(GptUsage.id)).where(GptUsage.shop_id == shop_id).where(GptUsage.created_at >= since_24h))).scalar_one() or 0)

        # Published answers: jobs done in last 24h
        pub_types = [JobType.publish_answer.value, JobType.publish_question_answer.value, JobType.send_chat_message.value]
        responses_published_24h = int((await self.db.execute(select(func.count(Job.id)).where(Job.type.in_(pub_types)).where(Job.status == JobStatus.done.value).where(Job.updated_at >= since_24h).where(text("(payload->>'shop_id')::int = :sid")).params(sid=shop_id))).scalar() or 0)

        sync_status = None
        last_sync_at = getattr(settings_obj, "last_sync_at", None) if settings_obj else None
        if last_sync_at and (now - last_sync_at) < timedelta(hours=2):
            sync_status = "ok"
        elif last_sync_at:
            sync_status = "stale"
        else:
            sync_status = "unknown"

        return {
            "shop_id": shop.id,
            "shop_name": shop.name,
            "sync_status": sync_status,
            "last_sync_at": last_sync_at,
            "balance": balance_row,
            "gpt_cost_24h_rub": gpt_cost_24h,
            "responses_generated_24h": responses_generated_24h,
            "responses_published_24h": responses_published_24h,
        }
