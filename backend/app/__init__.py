import os
import tempfile

from flask import Flask, send_from_directory

from .config import config_by_name
from .cors import init_cors, resolve_cors_allowlist
from .db.supabase_client import build_database_uri, mask_database_uri
from .extensions import db, jwt, migrate


def _uses_ephemeral_disk() -> bool:
    """Render, Vercel, and similar hosts: no durable local filesystem."""
    truthy = ("1", "true", "yes")
    render = os.environ.get("RENDER", "").lower() in truthy
    vercel = os.environ.get("VERCEL", "").lower() in truthy
    return render or vercel


def _register_extensions(app: Flask) -> None:
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)


def _register_blueprints(app: Flask) -> None:
    from .routes.auth import auth_bp
    from .routes.main import main_bp
    from .routes.users import users_bp

    from .routes.dashboard import dashboard_bp
    from .routes.tehsil_manager import tehsil_manager_bp
    from .routes.tubewell_operator import tubewell_operator_bp
    # Operator: both blueprints share /api/operator (route paths must stay unique).
    # Verification queue + in-app notifications: /api/operator/verification/* and /api/operator/notifications*
    blueprints = [
        (main_bp, ""),
        (auth_bp, "/api/auth"),
        (users_bp, "/api/users"),
        (tehsil_manager_bp, "/api/operator"),
        (tubewell_operator_bp, "/api/operator"),
        (dashboard_bp, "/api/dashboard"),
    ]

    for bp, prefix in blueprints:
        if prefix:
            app.register_blueprint(bp, url_prefix=prefix)
        else:
            app.register_blueprint(bp)


def create_app():
    # Ephemeral disk (Render, Vercel, etc.): use /tmp for uploads/instance.
    ephemeral = _uses_ephemeral_disk()
    flask_kw = {}
    if ephemeral:
        flask_kw["instance_path"] = os.path.join(tempfile.gettempdir(), "mrv_instance")

    app = Flask(__name__, **flask_kw)
    env_name = os.getenv("FLASK_ENV", "development")
    app.config.from_object(config_by_name.get(env_name, config_by_name["development"]))
    app.config["CORS_ORIGINS"] = resolve_cors_allowlist(flask_env=env_name)

    if ephemeral:
        app.config["UPLOAD_FOLDER"] = os.path.join(tempfile.gettempdir(), "mrv_uploads")

    # Vercel: one function invocation per request — avoid holding pooled connections.
    if os.environ.get("VERCEL", "").lower() in ("1", "true", "yes"):
        from sqlalchemy.pool import NullPool

        engine_opts = dict(app.config.get("SQLALCHEMY_ENGINE_OPTIONS") or {})
        engine_opts["pool_pre_ping"] = True
        engine_opts["poolclass"] = NullPool
        app.config["SQLALCHEMY_ENGINE_OPTIONS"] = engine_opts

    db_url = os.environ.get("DATABASE_URL", "").strip()
    if not db_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Set it in the host environment "
            "(e.g. Render → Environment or Vercel → Settings → Environment Variables)."
        )
    app.config["SQLALCHEMY_DATABASE_URI"] = build_database_uri(db_url)

    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = False
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_HEADER_NAME"] = "Authorization"
    app.config["JWT_HEADER_TYPE"] = "Bearer"

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(app.instance_path, exist_ok=True)

    _register_extensions(app)
    _register_blueprints(app)

    init_cors(app)
    app.logger.info(
        "CORS allowlist: %d origin(s) from CORS_ORIGINS",
        len(app.config["CORS_ORIGINS"]),
    )

    @app.route("/api/uploads/<path:filename>")
    def uploaded_file(filename):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    masked_uri = mask_database_uri(app.config["SQLALCHEMY_DATABASE_URI"])
    app.logger.info("Database configured: %s", masked_uri)
    return app
