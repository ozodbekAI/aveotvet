from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.core.crypto import encrypt_secret, decrypt_secret
from app.repos.shop_repo import ShopRepo
from app.schemas.shop import ShopCreate, ShopOut

router = APIRouter()


@router.get("", response_model=list[ShopOut])
async def list_shops(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    return await ShopRepo(db).list_by_owner(user.id)


@router.post("", response_model=ShopOut)
async def create_shop(payload: ShopCreate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    repo = ShopRepo(db)
    shop = await repo.create(owner_user_id=user.id, name=payload.name, wb_token_enc=encrypt_secret(payload.wb_token))
    await db.commit()
    return shop


@router.get("/{shop_id}", response_model=ShopOut)
async def get_shop(shop_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    shop = await ShopRepo(db).get(user.id, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


@router.get("/{shop_id}/token")
async def get_shop_token(shop_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    shop = await ShopRepo(db).get(user.id, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    # usually you don't expose token; included for debugging.
    return {"wb_token": decrypt_secret(shop.wb_token_enc)}
