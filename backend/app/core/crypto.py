from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _fernet() -> Fernet | None:
    if not settings.FERNET_KEY:
        return None
    return Fernet(settings.FERNET_KEY.encode("utf-8"))


def encrypt_secret(value: str) -> str:
    f = _fernet()
    if f is None:
        return value
    return f.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: str) -> str:
    f = _fernet()
    if f is None:
        return value
    try:
        return f.decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        # If key changed, avoid crashing and return raw (caller can handle).
        return value
