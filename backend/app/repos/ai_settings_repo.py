from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.ai_settings import AISettings


class AISettingsRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create(self) -> AISettings:
        row = await self.db.get(AISettings, 1)
        if row:
            return row
        row = AISettings(id=1, providers={}, feature_flags={}, policies={})
        self.db.add(row)
        await self.db.flush()
        return row