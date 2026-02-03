from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.api.access import require_admin_read, require_super_admin
from app.models.shop import Shop
from app.core.crypto import encrypt_secret, decrypt_secret
from app.repos.audit_repo import AuditRepo
from sqlalchemy import select


router = APIRouter()


def _mask(token: str | None) -> str | None:
    if not token:
        return None
    t = str(token)
    if len(t) <= 8:
        return "***"
    return t[:4] + "..." + t[-4:]


class IntegrationUpdateIn(BaseModel):
    wb_token: str = Field(..., min_length=10)


@router.get("/shops/{shop_id}")
async def integration_read(shop_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """admin.integration.read (super_admin + support_admin)."""
    await require_admin_read(user)
    shop = await db.get(Shop, int(shop_id))
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    token = decrypt_secret(shop.wb_token_enc) if shop.wb_token_enc else None
    return {
        "shop_id": shop.id,
        "shop_name": shop.name,
        "wb_token_masked": _mask(token),
        "has_token": bool(token),
    }


@router.put("/shops/{shop_id}")
async def integration_update(shop_id: int, payload: IntegrationUpdateIn, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """admin.integration.update (super_admin only)."""
    await require_super_admin(user)
    shop = await db.get(Shop, int(shop_id))
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    # Check if this token is already used by another shop
    existing_shops = await db.execute(select(Shop).where(Shop.is_active.is_(True), Shop.id != shop_id))
    for existing_shop in existing_shops.scalars().all():
        if existing_shop.wb_token_enc:
            try:
                existing_token = decrypt_secret(existing_shop.wb_token_enc)
                if existing_token == payload.wb_token:
                    raise HTTPException(
                        status_code=409, 
                        detail=f"Этот токен уже используется магазином «{existing_shop.name}». Один токен можно использовать только для одного магазина."
                    )
            except HTTPException:
                raise
            except Exception:
                pass
    
    shop.wb_token_enc = encrypt_secret(payload.wb_token)
    await AuditRepo(db).log("admin.integration.update", int(user.id), entity="shop", entity_id=shop.id)
    await db.commit()
    return {"ok": True}


@router.post("/shops/{shop_id}/reset")
async def integration_reset(shop_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """admin.integration.reset (super_admin only)."""
    await require_super_admin(user)
    shop = await db.get(Shop, int(shop_id))
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    shop.wb_token_enc = None
    await AuditRepo(db).log("admin.integration.reset", int(user.id), entity="shop", entity_id=shop.id)
    await db.commit()
    return {"ok": True}
