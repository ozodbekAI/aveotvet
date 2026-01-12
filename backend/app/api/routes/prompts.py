from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.services.prompt_store import get_global_bundle

router = APIRouter()


@router.get("/tone-options")
async def tone_options(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    bundle = await get_global_bundle(db)
    return bundle.tone_options


@router.get("/ui-options")
async def ui_options(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    """Return dynamic UI choices for shop settings.

    These options are managed by super-admin (stored in prompt_records / tones).
    """

    bundle = await get_global_bundle(db)
    return {
        "tone_options": bundle.tone_options,
        "address_format_options": bundle.address_format_options,
        "answer_length_options": bundle.answer_length_options,
    }
