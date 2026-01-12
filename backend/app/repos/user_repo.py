from __future__ import annotations

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_email(self, email: str) -> User | None:
        res = await self.session.execute(select(User).where(User.email == email))
        return res.scalar_one_or_none()

    async def create(self, email: str, password_hash: str, role: str = "user") -> User:
        user = User(email=email, password_hash=password_hash, role=role)
        self.session.add(user)
        await self.session.flush()
        return user

    async def get(self, user_id: int) -> User | None:
        res = await self.session.execute(select(User).where(User.id == user_id))
        return res.scalar_one_or_none()

    async def count(self) -> int:
        res = await self.session.execute(select(func.count(User.id)))
        return int(res.scalar_one() or 0)

    async def list_all(self) -> list[User]:
        res = await self.session.execute(select(User).order_by(User.id))
        return list(res.scalars().all())


