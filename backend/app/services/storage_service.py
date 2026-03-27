import uuid
from datetime import datetime

import boto3
from botocore.client import Config as BotoConfig
from werkzeug.utils import secure_filename


class StorageService:
    @staticmethod
    def _build_client(app_config):
        access_key = app_config.get("SUPABASE_S3_ACCESS_KEY_ID")
        secret_key = app_config.get("SUPABASE_S3_SECRET_ACCESS_KEY")
        endpoint = app_config.get("SUPABASE_S3_ENDPOINT")
        region = app_config.get("SUPABASE_S3_REGION")

        if not access_key or not secret_key:
            raise ValueError("Supabase S3 credentials are missing in environment.")
        if not endpoint:
            raise ValueError("SUPABASE_S3_ENDPOINT is required.")

        return boto3.client(
            "s3",
            endpoint_url=endpoint,
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=BotoConfig(signature_version="s3v4"),
        )

    @staticmethod
    def _public_url(app_config, object_key: str) -> str:
        bucket = app_config.get("SUPABASE_STORAGE_BUCKET")
        public_base = (app_config.get("SUPABASE_STORAGE_PUBLIC_BASE_URL") or "").rstrip("/")
        if not public_base:
            raise ValueError("SUPABASE_STORAGE_PUBLIC_BASE_URL is missing.")
        return f"{public_base}/{bucket}/{object_key}"

    @staticmethod
    def upload_file_storage(file_storage, app_config, folder: str = "uploads") -> dict:
        """
        Uploads file to Supabase S3-compatible storage and returns object key + public URL.
        """
        bucket = app_config.get("SUPABASE_STORAGE_BUCKET")
        if not bucket:
            raise ValueError("SUPABASE_STORAGE_BUCKET is required.")

        safe_name = secure_filename(file_storage.filename or "file")
        if not safe_name:
            safe_name = "file"

        now = datetime.utcnow()
        object_key = (
            f"{folder.strip('/')}/{now.year}/{now.month:02d}/{uuid.uuid4().hex}_{safe_name}"
        )

        client = StorageService._build_client(app_config)
        extra_args = {"ContentType": file_storage.mimetype} if file_storage.mimetype else None
        if extra_args:
            client.upload_fileobj(file_storage.stream, bucket, object_key, ExtraArgs=extra_args)
        else:
            client.upload_fileobj(file_storage.stream, bucket, object_key)

        return {
            "bucket": bucket,
            "object_key": object_key,
            "public_url": StorageService._public_url(app_config, object_key),
        }

