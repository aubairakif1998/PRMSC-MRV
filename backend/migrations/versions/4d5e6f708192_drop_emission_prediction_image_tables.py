"""drop emission_results, prediction_results, image_verifications

Revision ID: 4d5e6f708192
Revises: 3c4d5e6f7081
Create Date: 2026-03-30 18:00:00.000000
"""

from alembic import op
from sqlalchemy import inspect

revision = "4d5e6f708192"
down_revision = "3c4d5e6f7081"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    names = set(inspector.get_table_names())
    # Drop in any order; use IF EXISTS pattern via pre-check for portability.
    for table in ("prediction_results", "emission_results", "image_verifications"):
        if table in names:
            op.drop_table(table)


def downgrade():
    # Intentionally empty: cached result / verification tables are not restored.
    pass
