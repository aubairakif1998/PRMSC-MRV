"""Add signature snapshot to water logs.

Revision ID: 0d8e9f0a1b2c
Revises: 0c7d8e9f0a1b
Create Date: 2026-04-20
"""

from alembic import op
import sqlalchemy as sa


revision = "0d8e9f0a1b2c"
down_revision = "0c7d8e9f0a1b"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "water_energy_logging_daily",
        sa.Column("signature_svg_snapshot", sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_column("water_energy_logging_daily", "signature_svg_snapshot")

