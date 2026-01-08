from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.repos.shop_repo import ShopRepo
from app.schemas.settings import SettingsOut, SettingsUpdate

router = APIRouter()


@router.get("/{shop_id}", response_model=SettingsOut)
async def get_settings(shop_id: int, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    shop = await ShopRepo(db).get(user.id, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    s = await ShopRepo(db).get_settings(shop_id)
    if not s:
        raise HTTPException(status_code=404, detail="Settings not found")
    return s


@router.put("/{shop_id}", response_model=SettingsOut)
async def update_settings(shop_id: int, payload: SettingsUpdate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    shop = await ShopRepo(db).get(user.id, shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    s = await ShopRepo(db).get_settings(shop_id)
    if not s:
        raise HTTPException(status_code=404, detail="Settings not found")

    data = payload.model_dump(exclude_unset=True)

    # Lightweight validation for UI-like signature pool
    if "signatures" in data:
        sigs = data.get("signatures")
        if sigs is None:
            data["signatures"] = []
        elif not isinstance(sigs, list) or any((not isinstance(x, str)) for x in sigs):
            raise HTTPException(status_code=422, detail="signatures must be a list of strings")

    for k, v in data.items():
        setattr(s, k, v)

    await db.commit()
    return s
