from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import decode_token
from app.repos.user_repo import UserRepo

bearer = HTTPBearer(auto_error=False)


async def get_db() -> AsyncSession:
    async for s in get_session():
        yield s


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
):
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(creds.credentials)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    sub = payload.get("sub")
    if not sub or not str(sub).isdigit():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    user = await UserRepo(db).get(int(sub))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

    # Session invalidation: token must match current session_version.
    token_sv = payload.get("sv")
    try:
        token_sv_int = int(token_sv) if token_sv is not None else 1
    except Exception:
        token_sv_int = 1
    user_sv = int(getattr(user, "session_version", 1) or 1)
    if token_sv_int != user_sv:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    return user
