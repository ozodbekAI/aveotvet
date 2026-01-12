from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.prompt_record import PromptRecord


class PromptRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, *, scope: str, key: str) -> PromptRecord | None:
        res = await self.session.execute(select(PromptRecord).where(PromptRecord.scope == scope, PromptRecord.key == key))
        return res.scalar_one_or_none()

    async def set_text(self, *, scope: str, key: str, value_text: str | None) -> PromptRecord:
        rec = await self.get(scope=scope, key=key)
        now = datetime.now(timezone.utc)
        if rec:
            rec.value_text = value_text
            rec.updated_at = now
            await self.session.flush()
            return rec
        rec = PromptRecord(scope=scope, key=key, value_text=value_text, value_json=None, updated_at=now)
        self.session.add(rec)
        await self.session.flush()
        return rec

    async def set_json(self, *, scope: str, key: str, value_json: dict | list | None) -> PromptRecord:
        rec = await self.get(scope=scope, key=key)
        now = datetime.now(timezone.utc)
        if rec:
            rec.value_json = value_json
            rec.updated_at = now
            await self.session.flush()
            return rec
        rec = PromptRecord(scope=scope, key=key, value_text=None, value_json=value_json, updated_at=now)
        self.session.add(rec)
        await self.session.flush()
        return rec

    async def list_scope(self, scope: str) -> list[PromptRecord]:
        res = await self.session.execute(select(PromptRecord).where(PromptRecord.scope == scope).order_by(PromptRecord.key))
        return list(res.scalars().all())
