import os
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _load_env() -> None:
    """Load .env then .env.production so production can use a dedicated file."""
    load_dotenv(_BACKEND_ROOT / ".env")
    prod = _BACKEND_ROOT / ".env.production"
    if prod.is_file():
        load_dotenv(prod, override=True)


_load_env()


def _parse_cors_origins() -> list[str]:
    """
    Comma-separated CORS_ORIGINS env var. When unset, allow common local dev URLs
    (needed for credentialed requests: wildcard origin is invalid with credentials).
    """
    raw = os.environ.get("CORS_ORIGINS", "").strip()
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:4200",
        "http://127.0.0.1:4200",
    ]


class Config:
    # Security
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-key-123")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "jwt-dev-key")

    # Database (Supabase PostgreSQL only) — validated URI set in create_app()
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "") or ""
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
    }

    # Supabase Storage (S3 compatible)
    SUPABASE_STORAGE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "mrv-public")
    SUPABASE_S3_ENDPOINT = os.environ.get(
        "SUPABASE_S3_ENDPOINT",
        "https://roqrkkzaayrzarpdnuvx.storage.supabase.co/storage/v1/s3",
    )
    SUPABASE_S3_REGION = os.environ.get("SUPABASE_S3_REGION", "ap-southeast-1")
    SUPABASE_S3_ACCESS_KEY_ID = os.environ.get("SUPABASE_S3_ACCESS_KEY_ID")
    SUPABASE_S3_SECRET_ACCESS_KEY = os.environ.get("SUPABASE_S3_SECRET_ACCESS_KEY")
    SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
    SUPABASE_STORAGE_PUBLIC_BASE_URL = os.environ.get(
        "SUPABASE_STORAGE_PUBLIC_BASE_URL",
        f"{SUPABASE_URL}/storage/v1/object/public" if SUPABASE_URL else "",
    )

    CORS_ORIGINS = _parse_cors_origins()

    # File Uploads
    UPLOAD_FOLDER = os.path.join(os.getcwd(), "app", "uploads")
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max upload size
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "pdf"}

class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
}
