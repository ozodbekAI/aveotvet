from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True, extra="ignore")

    APP_ENV: str = "dev"
    APP_NAME: str = "wb-otveto-backend"
    API_PREFIX: str = "/api"

    DATABASE_URL: str = Field(default="postgresql+asyncpg://postgres:postgres@localhost:5432/wb_otveto")

    JWT_SECRET_KEY: str = "change_me"
    JWT_ACCESS_TTL_MIN: int = 60 * 24 * 7  # 7 days

    FERNET_KEY: str | None = None

    OPENAI_API_KEY: str | None = None
    OPENAI_MODEL: str = "gpt-5.2"
    OPENAI_TIMEOUT_SEC: int = 60

    WORKER_POLL_INTERVAL_SEC: int = 2
    WORKER_MAX_JOBS_PER_TICK: int = 10

    CORS_ORIGINS: str = "*"


settings = Settings()
