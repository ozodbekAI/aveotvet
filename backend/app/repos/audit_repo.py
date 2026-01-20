from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog


class AuditRepo:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(
        self,
        action: str,
        user_id: int | None,
        entity: str | None = None,
        entity_id: str | int | None = None,
        details: str | None = None,
    ) -> AuditLog:
        row = AuditLog(
            user_id=user_id,
            action=action[:64],
            entity=entity[:64] if entity else None,
            entity_id=str(entity_id)[:64] if entity_id is not None else None,
            details=details,
        )
        self.db.add(row)
        await self.db.flush()
        return row
