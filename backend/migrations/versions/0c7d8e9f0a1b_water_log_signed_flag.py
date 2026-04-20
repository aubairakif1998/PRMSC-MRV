"""Add signed flag to water logs.

Revision ID: 0c7d8e9f0a1b
Revises: 0b6a1f2c3d4e
Create Date: 2026-04-20
"""

from alembic import op
import sqlalchemy as sa


revision = "0c7d8e9f0a1b"
down_revision = "0b6a1f2c3d4e"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "water_energy_logging_daily",
        sa.Column("signed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    # Drop default after backfill to keep inserts explicit in app code.
    op.alter_column("water_energy_logging_daily", "signed", server_default=None)


def downgrade():
    op.drop_column("water_energy_logging_daily", "signed")

