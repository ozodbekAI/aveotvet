from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_flags import SystemFlags


class SystemFlagsRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create(self) -> SystemFlags:
        row = await self.db.get(SystemFlags, 1)
        if row:
            return row
        row = SystemFlags(id=1, kill_switch=False)
        self.db.add(row)
        await self.db.flush()
        return row

    async def is_kill_switch_on(self) -> bool:
        row = await self.get_or_create()
        return bool(row.kill_switch)