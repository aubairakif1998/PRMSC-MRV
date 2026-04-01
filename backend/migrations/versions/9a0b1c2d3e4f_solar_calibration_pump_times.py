"""drop solar_systems.calibration_date; pump start/end times on water_energy_logging_daily

Revision ID: 9a0b1c2d3e4f
Revises: 8d9e0f1a2b3c
Create Date: 2026-03-30 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "9a0b1c2d3e4f"
down_revision = "8d9e0f1a2b3c"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    cols = {c["name"] for c in insp.get_columns("water_energy_logging_daily")}
    if "pump_start_time" not in cols:
        op.add_column(
            "water_energy_logging_daily",
            sa.Column("pump_start_time", sa.Time(), nullable=True),
        )
    if "pump_end_time" not in cols:
        op.add_column(
            "water_energy_logging_daily",
            sa.Column("pump_end_time", sa.Time(), nullable=True),
        )

    solar_cols = {c["name"] for c in insp.get_columns("solar_systems")}
    if "calibration_date" in solar_cols:
        op.drop_column("solar_systems", "calibration_date")


def downgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    cols = {c["name"] for c in insp.get_columns("water_energy_logging_daily")}
    if "pump_end_time" in cols:
        op.drop_column("water_energy_logging_daily", "pump_end_time")
    if "pump_start_time" in cols:
        op.drop_column("water_energy_logging_daily", "pump_start_time")

    solar_cols = {c["name"] for c in insp.get_columns("solar_systems")}
    if "calibration_date" not in solar_cols:
        op.add_column(
            "solar_systems",
            sa.Column("calibration_date", sa.Date(), nullable=True),
        )
