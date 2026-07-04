"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def _default_cors_origins() -> str:
    if os.getenv("SSC_ENV", "development") == "production":
        return "https://www.supersecurechat.com,https://supersecurechat.com"
    return "http://localhost:3000"


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        return int(raw.strip())
    except ValueError:
        return default


class Settings:
    env: str = os.getenv("SSC_ENV", "development")
    mongo_url: str = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    mongo_db: str = os.getenv("MONGO_DB", "ssc")
    redis_url: str | None = os.getenv("REDIS_URL")
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-only-change-me")
    libretranslate_api_key: str | None = os.getenv("LIBRETRANSLATE_API_KEY")
    api_prefix: str = "/api"
    cors_origins: list[str] = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", _default_cors_origins()).split(",")
        if o.strip()
    ]

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def mongo_server_selection_timeout_ms(self) -> int:
        default = 30000 if os.getenv("SSC_ENV", self.env) == "production" else 1000
        return _env_int("MONGO_SERVER_SELECTION_TIMEOUT_MS", default)

    @property
    def enforce_installed_client(self) -> bool:
        """Production defaults to enforced; development defaults to relaxed."""
        default = self.is_production
        return _env_bool("SSC_ENFORCE_INSTALLED_CLIENT", default)


@lru_cache
def get_settings() -> Settings:
    return Settings()