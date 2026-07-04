"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


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
        for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
        if o.strip()
    ]

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def enforce_installed_client(self) -> bool:
        """Production defaults to enforced; development defaults to relaxed."""
        default = self.is_production
        return _env_bool("SSC_ENFORCE_INSTALLED_CLIENT", default)


@lru_cache
def get_settings() -> Settings:
    return Settings()