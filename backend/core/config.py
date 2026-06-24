"""Environment configuration and constants."""
import os
import re
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
APP_NAME = os.environ.get("APP_NAME", "ssc-chat")
TURNSTILE_SECRET = os.environ.get("TURNSTILE_SECRET", "")
TURNSTILE_SITEKEY = os.environ.get("TURNSTILE_SITEKEY", "")
VAPID_PUBLIC = os.environ.get("VAPID_PUBLIC", "")
VAPID_PRIVATE = os.environ.get("VAPID_PRIVATE", "")
VAPID_EMAIL = os.environ.get("VAPID_EMAIL", "admin@ssc.local")
TRANSLATION_ENABLED = os.environ.get("TRANSLATION_ENABLED", "false").lower() == "true"
TURN_URL = os.environ.get("TURN_URL", "")
TURN_USERNAME = os.environ.get("TURN_USERNAME", "")
TURN_CREDENTIAL = os.environ.get("TURN_CREDENTIAL", "")
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
ENV = os.environ.get("ENV", "development").lower()
REDIS_URL = (os.environ.get("REDIS_URL") or "").strip()
_cors_raw = os.environ.get(
    "CORS_ORIGINS", "https://localhost,capacitor://localhost"
)
CORS_ORIGINS = [o.strip() for o in _cors_raw.split(",") if o.strip()]

BANNED_SUBSTRINGS = [
    "ssc", "supersecure", "admin", "root", "moderator", "staff",
    "support", "system", "official", "owner", "team", "bot",
    "sex", "porn", "nude", "fuck", "shit", "bitch",
    "dick", "cock", "pussy", "cunt", "nigg", "faggot",
    "rape", "pedo", "loli", "incest", "whore", "slut",
]
USERNAME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]{3,11}$")