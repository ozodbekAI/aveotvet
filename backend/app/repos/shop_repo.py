from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import set_committed_value

from app.models.shop import Shop
from app.models.shop_member import ShopMember
from app.models.enums import ShopMemberRole
from app.models.settings import ShopSettings
from app.repos.signature_repo import SignatureRepo


class ShopRepo:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_by_owner(self, owner_user_id: int) -> list[Shop]:
        res = await self.session.execute(select(Shop).where(Shop.owner_user_id == owner_user_id).order_by(Shop.id))
        return list(res.scalars().all())

    async def get(self, owner_user_id: int, shop_id: int) -> Shop | None:
        res = await self.session.execute(
            select(Shop).where(Shop.owner_user_id == owner_user_id, Shop.id == shop_id)
        )
        return res.scalar_one_or_none()

    async def create(self, owner_user_id: int, name: str, wb_token_enc: str) -> Shop:
        shop = Shop(owner_user_id=owner_user_id, name=name, wb_token_enc=wb_token_enc)
        self.session.add(shop)
        await self.session.flush()

        # Ensure owner is also present in membership table (so list_shops works)
        self.session.add(ShopMember(shop_id=shop.id, user_id=owner_user_id, role=ShopMemberRole.owner.value))
        await self.session.flush()


        self.session.add(ShopSettings(shop_id=shop.id))
        await self.session.flush()
        return shop

    async def get_settings(self, shop_id: int) -> ShopSettings | None:
        res = await self.session.execute(select(ShopSettings).where(ShopSettings.shop_id == shop_id))
        s: ShopSettings | None = res.scalar_one_or_none()
        if s is None:
            return None

        # Inject signatures from dedicated table into settings object for API/UI parity.
        # Important: use set_committed_value so SQLAlchemy does NOT consider this as a DB update.
        try:
            sigs = await SignatureRepo(self.session).list_active(shop_id=shop_id)
            payload = [
                {
                    "text": x.text,
                    "type": x.type,
                    "brand": x.brand,
                    "is_active": x.is_active,
                    "created_at": x.created_at.isoformat() if getattr(x, "created_at", None) else None,
                }
                for x in (sigs or [])
            ]
            if hasattr(s, "signatures"):
                set_committed_value(s, "signatures", payload)
        except Exception:
            # If migration is not applied yet, keep legacy JSON field.
            pass

        return s
