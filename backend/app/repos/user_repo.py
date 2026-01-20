from __future__ import annotations

from sqlalchemy import select, func

from app.models.billing import CreditLedger
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

    async def get_balance(self, user_id: int) -> int:
        u = await self.get(user_id)
        return int(getattr(u, "credits_balance", 0) or 0) if u else 0

    async def apply_credits(self, user_id: int, *, delta: int, reason: str, meta: dict | None = None) -> int:
        """Apply a credit delta atomically (row-locked).

        delta > 0: topup/refund
        delta < 0: charge

        Returns new balance.
        """
        res = await self.session.execute(
            select(User).where(User.id == user_id).with_for_update()
        )
        u = res.scalar_one_or_none()
        if not u:
            raise ValueError("User not found")

        cur = int(getattr(u, "credits_balance", 0) or 0)
        new = cur + int(delta)
        if new < 0:
            raise ValueError("Insufficient credits")

        u.credits_balance = new
        if delta < 0:
            u.credits_spent = int(getattr(u, "credits_spent", 0) or 0) + (-int(delta))

        self.session.add(
            CreditLedger(
                user_id=user_id,
                delta=int(delta),
                balance_after=new,
                reason=str(reason)[:64],
                meta=meta or {},
            )
        )
        await self.session.flush()
        return new

    async def try_charge(self, user_id: int, *, amount: int, reason: str, meta: dict | None = None) -> bool:
        """Charge credits; returns False if insufficient."""
        try:
            await self.apply_credits(user_id, delta=-int(amount), reason=reason, meta=meta)
            return True
        except ValueError:
            return False


