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

    # --- GPT accounting ---
    # Exchange rate used to convert cost_usd -> cost_rub at the moment of generation.
    USD_TO_RUB: float = 90.0

    # Optional per-model pricing config. If empty, cost will be recorded as 0
    # but token counts will still be persisted.
    # Format: {"model": {"input_per_1k_usd": 0.15, "output_per_1k_usd": 0.6}}
    MODEL_PRICING: dict = Field(default_factory=dict)

    WORKER_POLL_INTERVAL_SEC: int = 2
    WORKER_MAX_JOBS_PER_TICK: int = 10

    # Autosync (worker scheduler)
    AUTO_SYNC_ENABLED: bool = True
    AUTO_SYNC_INTERVAL_MIN: int = 120       # 2h - feedbacks sync

    # Questions/chats sync intervals
    QUESTIONS_SYNC_INTERVAL_MIN: int = 120  # 2h
    CHATS_SYNC_INTERVAL_MIN: int = 120      # 2h
    FULL_SYNC_INTERVAL_MIN: int = 120       # 2h - full sync all data

    # Autosync safety caps
    AUTO_SYNC_TAKE: int = 500
    AUTO_SYNC_MAX_TOTAL: int = 2000

    # Manual sync safety cap (per job)
    SYNC_MAX_TOTAL: int = 20000

    # Billing
    CREDITS_PER_DRAFT: int = 1
    CREDITS_PER_PUBLISH: int = 0

    # Product cards sync (Content API) - used for returning product photo URL in feedback API
    CARDS_SYNC_ENABLED: bool = True
    CARDS_SYNC_INTERVAL_MIN: int = 180  # 3h
    CARDS_SYNC_PAGES_PER_RUN: int = 5
    CARDS_SYNC_LIMIT: int = 100

    # WB API retry / throttling
    WB_MAX_RETRIES: int = 5
    WB_CONTENT_MIN_INTERVAL_SEC: float = 0.65

    # Debug logging for product cards / image resolution.
    # When enabled, logs will include samples of nmIDs and photo keys.
    DEBUG_PRODUCT_CARDS: bool = False
    DEBUG_PRODUCT_CARDS_SAMPLE: int = 25

    CORS_ORIGINS: str = "*"


settings = Settings()
