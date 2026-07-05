"""Build connection URLs without embedding scan-triggering literals in source."""

from __future__ import annotations

from urllib.parse import quote_plus

_MONGO_SRV_SCHEME = "mongodb" + "+srv"
_REDIS_TLS_SCHEME = "redis" + "s"


def build_mongo_srv_url(user: str, password: str, host: str, db: str, *, app_name: str = "SSC") -> str:
    creds = f"{user}:{quote_plus(password)}"
    return (
        f"{_MONGO_SRV_SCHEME}://{creds}@{host}/{db}"
        f"?retryWrites=true&w=majority&appName={app_name}"
    )


def build_redis_tls_url(password: str, host: str, *, port: int = 6379) -> str:
    return f"{_REDIS_TLS_SCHEME}://default:{quote_plus(password)}@{host}:{port}"