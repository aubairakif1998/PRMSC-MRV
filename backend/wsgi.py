"""
WSGI entry for production (Gunicorn on Render, etc.).

Set FLASK_ENV=production and all secrets via the host environment (not this file).
"""
import os

# Render / Docker: default to production when not explicitly development.
if not os.environ.get("FLASK_ENV"):
    os.environ["FLASK_ENV"] = "production"

from app import create_app  # noqa: E402

app = create_app()
