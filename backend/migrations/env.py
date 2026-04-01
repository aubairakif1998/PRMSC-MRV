from __future__ import with_statement

import os
import sys

# Alembic CLI cwd is usually ``backend/``; ensure package root is importable.
_backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

from logging.config import fileConfig

from alembic import context
from flask import current_app

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def get_engine():
    try:
        return current_app.extensions["migrate"].db.get_engine()
    except (TypeError, AttributeError):
        return current_app.extensions["migrate"].db.engine


def get_engine_url():
    try:
        return get_engine().url.render_as_string(hide_password=False).replace("%", "%%")
    except AttributeError:
        return str(get_engine().url).replace("%", "%%")


def get_metadata():
    return current_app.extensions["migrate"].db.metadata


def run_migrations_offline():
    url = get_engine_url()
    context.configure(
        url=url,
        target_metadata=get_metadata(),
        literal_binds=True,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = get_engine()

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=get_metadata(),
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


def run_migrations():
    """Bootstrap Flask app so ``current_app`` works for Alembic and ``flask db``."""
    from app import create_app

    app = create_app()
    with app.app_context():
        if context.is_offline_mode():
            run_migrations_offline()
        else:
            run_migrations_online()


run_migrations()
