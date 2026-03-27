import os
from dotenv import load_dotenv

from .db.supabase_client import build_database_uri

load_dotenv()


class Config:
    # Security
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-key-123")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "jwt-dev-key")

    # Database (Supabase PostgreSQL only)
    SQLALCHEMY_DATABASE_URI = build_database_uri(os.environ.get("DATABASE_URL", ""))
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
