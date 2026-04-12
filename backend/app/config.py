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

    # Populated in create_app via app.cors.resolve_cors_allowlist (from CORS_ORIGINS env).
    CORS_ORIGINS: list[str] = []

    # File Uploads
    UPLOAD_FOLDER = os.path.join(os.getcwd(), "app", "uploads")
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max upload size
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "pdf"}

    # Password reset (optional SMTP; link base for emails)
    PASSWORD_MIN_LENGTH = int(os.environ.get("PASSWORD_MIN_LENGTH", "8"))
    PASSWORD_RESET_TOKEN_TTL_HOURS = int(
        os.environ.get("PASSWORD_RESET_TOKEN_TTL_HOURS", "1")
    )
    PASSWORD_RESET_FRONTEND_URL = os.environ.get(
        "PASSWORD_RESET_FRONTEND_URL", ""
    ).rstrip("/")
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "").strip()
    MAIL_PORT = int(os.environ.get("MAIL_PORT", "587"))
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "true").lower() in (
        "1",
        "true",
        "yes",
    )
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD", "")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", "")


class DevelopmentConfig(Config):
    DEBUG = True
    # When true and DEBUG, POST /auth/forgot-password may include reset_token in JSON (local only).
    PASSWORD_RESET_DEV_RETURN_TOKEN = os.environ.get(
        "PASSWORD_RESET_DEV_RETURN_TOKEN", ""
    ).lower() in ("1", "true", "yes")


class ProductionConfig(Config):
    DEBUG = False
    PASSWORD_RESET_DEV_RETURN_TOKEN = False


config_by_name = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
}
