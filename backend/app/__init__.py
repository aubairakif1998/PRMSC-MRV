import os
import tempfile

from flask import Flask, send_from_directory
from flask_cors import CORS

from .config import config_by_name
from .db.supabase_client import build_database_uri, mask_database_uri
from .extensions import db, jwt, migrate


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
    # Render (and similar PaaS): ephemeral disk — use /tmp for uploads/instance.
    _on_render = os.environ.get("RENDER", "").lower() in ("1", "true", "yes")
    flask_kw = {}
    if _on_render:
        flask_kw["instance_path"] = os.path.join(tempfile.gettempdir(), "mrv_instance")

    app = Flask(__name__, **flask_kw)
    env_name = os.getenv("FLASK_ENV", "development")
    app.config.from_object(config_by_name.get(env_name, config_by_name["development"]))

    if _on_render:
        app.config["UPLOAD_FOLDER"] = os.path.join(tempfile.gettempdir(), "mrv_uploads")

    db_url = os.environ.get("DATABASE_URL", "").strip()
    if not db_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Set it in the host environment (e.g. Render → Environment)."
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

    # Explicit origins (not "*"): browsers disallow credentials + wildcard ACAO.
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": app.config["CORS_ORIGINS"],
                "allow_headers": [
                    "Content-Type",
                    "Authorization",
                    "Accept",
                    "Origin",
                    "X-Requested-With",
                    "Idempotency-Key",
                    "X-Idempotency-Key",
                ],
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
                "supports_credentials": True,
            }
        },
        supports_credentials=True,
        automatic_options=True,
    )

    @app.route("/api/uploads/<path:filename>")
    def uploaded_file(filename):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    masked_uri = mask_database_uri(app.config["SQLALCHEMY_DATABASE_URI"])
    app.logger.info("Database configured: %s", masked_uri)
    return app
