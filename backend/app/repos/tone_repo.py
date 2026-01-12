from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tone import Tone


class ToneRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_all(self) -> list[Tone]:
        res = await self.session.execute(select(Tone).order_by(Tone.sort_order.asc(), Tone.id.asc()))
        return list(res.scalars().all())

    async def list_active(self) -> list[Tone]:
        res = await self.session.execute(
            select(Tone).where(Tone.is_active.is_(True)).order_by(Tone.sort_order.asc(), Tone.id.asc())
        )
        return list(res.scalars().all())

    async def get_by_id(self, tone_id: int) -> Tone | None:
        res = await self.session.execute(select(Tone).where(Tone.id == tone_id))
        return res.scalar_one_or_none()

    async def get_by_code(self, code: str) -> Tone | None:
        res = await self.session.execute(select(Tone).where(Tone.code == code))
        return res.scalar_one_or_none()

    async def create(self, *, code: str, label: str, hint: str | None, instruction: str | None, sort_order: int = 0, is_active: bool = True) -> Tone:
        tone = Tone(
            code=code,
            label=label,
            hint=hint,
            instruction=instruction,
            sort_order=sort_order,
            is_active=is_active,
        )
        self.session.add(tone)
        await self.session.flush()
        return tone

    async def update(self, tone: Tone, data: dict) -> Tone:
        for k, v in data.items():
            if hasattr(tone, k):
                setattr(tone, k, v)
        await self.session.flush()
        return tone

    async def deactivate(self, tone: Tone) -> None:
        tone.is_active = False
        await self.session.flush()
