"""Add bulk-meter cumulative reading columns to water daily logs.

Revision ID: j3k4l5m6n7o8
Revises: d9879edd2c90
Create Date: 2026-06-17
"""

from alembic import op
import sqlalchemy as sa


revision = "j3k4l5m6n7o8"
down_revision = "d9879edd2c90"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "water_energy_logging_daily",
        sa.Column("meter_reading_start", sa.Float(), nullable=True),
    )
    op.add_column(
        "water_energy_logging_daily",
        sa.Column("meter_reading_end", sa.Float(), nullable=True),
    )


def downgrade():
    op.drop_column("water_energy_logging_daily", "meter_reading_end")
    op.drop_column("water_energy_logging_daily", "meter_reading_start")
