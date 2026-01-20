from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.core.security import hash_password, verify_password, create_access_token
from app.repos.user_repo import UserRepo
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from app.models.enums import UserRole

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    repo = UserRepo(db)
    existing = await repo.get_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_count = await repo.count()
    role = UserRole.super_admin.value if user_count == 0 else UserRole.user.value
    user = await repo.create(email=payload.email, password_hash=hash_password(payload.password), role=role)
    await db.commit()
    return TokenResponse(access_token=create_access_token(str(user.id), extra={"sv": int(getattr(user, "session_version", 1) or 1)}))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    repo = UserRepo(db)
    user = await repo.get_by_email(payload.email)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(access_token=create_access_token(str(user.id), extra={"sv": int(getattr(user, "session_version", 1) or 1)}))

@router.get("/me")
async def me(user=Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "role": getattr(user, "role", "user"),
        "credits_balance": int(getattr(user, "credits_balance", 0) or 0),
        "credits_spent": int(getattr(user, "credits_spent", 0) or 0),
    }

