"""initial schema

Revision ID: 0ff4d28da12d
Revises:
Create Date: 2026-03-25 00:00:00.000000
"""

from alembic import op

from app.extensions import db
from app.models import *  # noqa: F401,F403

# revision identifiers, used by Alembic.
revision = "0ff4d28da12d"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    db.metadata.create_all(bind=bind)


def downgrade():
    bind = op.get_bind()
    db.metadata.drop_all(bind=bind)

