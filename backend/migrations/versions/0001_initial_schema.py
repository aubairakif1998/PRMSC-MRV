"""initial schema — current SQLAlchemy models (single source of truth).

Revision ID: 0ff4d28da12d
Revises:
Create Date: 2026-03-25 00:00:00.000000

Later revisions only adjust legacy DBs; fresh installs match models.py after this step.
"""

from alembic import op
from sqlalchemy import inspect

from app.extensions import db
from app.models import *  # noqa: F401,F403 — register all models on metadata

# revision identifiers, used by Alembic.
revision = "0ff4d28da12d"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    # create_all only creates missing tables — safe on fresh or partially created DBs
    db.metadata.create_all(bind=bind)


def downgrade():
    bind = op.get_bind()
    if inspect(bind).get_table_names():
        db.metadata.drop_all(bind=bind)

