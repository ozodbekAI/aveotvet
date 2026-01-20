from __future__ import annotations

from fastapi import APIRouter, Request

router = APIRouter()

@router.get("/health")
async def health():
    return {"ok": True}
