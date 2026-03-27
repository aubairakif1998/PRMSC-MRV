import os

from flask import Flask, send_from_directory
from flask_cors import CORS

from .config import config_by_name
from .db.supabase_client import mask_database_uri
from .extensions import db, jwt, migrate


def _register_extensions(app: Flask) -> None:
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)


def _register_blueprints(app: Flask) -> None:
    from .routes.auth import auth_bp
    from .routes.main import main_bp
    from .routes.users import users_bp

    from .routes.analyst import analyst_bp
    from .routes.dashboard import dashboard_bp
    from .routes.emissions import emissions_bp
    from .routes.operator import operator_bp
    from .routes.predictions import predictions_bp
    from .routes.verification import verification_bp

    blueprints = [
        (main_bp, ""),
        (auth_bp, "/api/auth"),
        (users_bp, "/api/users"),
        (operator_bp, "/api/operator"),
        (analyst_bp, "/api/analyst"),
        (emissions_bp, "/api/emissions"),
        (verification_bp, "/api/verification"),
        (predictions_bp, "/api/predictions"),
        (dashboard_bp, "/api/dashboard"),
    ]

    for bp, prefix in blueprints:
        if prefix:
            app.register_blueprint(bp, url_prefix=prefix)
        else:
            app.register_blueprint(bp)


def create_app():
    app = Flask(__name__)
    env_name = os.getenv("FLASK_ENV", "development")
    app.config.from_object(config_by_name.get(env_name, config_by_name["development"]))
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
