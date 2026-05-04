"""Allow multiple daily logs; enforce unique start/end interval per day.

Revision ID: 6c7d8e9f0a12
Revises: 5b6c7d8e9f01
Create Date: 2026-04-30
"""

from alembic import op


revision = "6c7d8e9f0a12"
down_revision = "5b6c7d8e9f01"
branch_labels = None
depends_on = None


def upgrade():
    # Old shape: one row per (water_system_id, log_date).
    op.execute(
        "ALTER TABLE water_energy_logging_daily DROP CONSTRAINT IF EXISTS uq_water_energy_logging_daily_sid_date"
    )
    op.execute("DROP INDEX IF EXISTS uq_water_energy_logging_daily_sid_date")
    op.execute("DROP INDEX IF EXISTS uq_water_energy_logging_daily_sid_date_times")
    op.create_unique_constraint(
        "uq_water_energy_logging_daily_sid_date_times",
        "water_energy_logging_daily",
        ["water_system_id", "log_date", "pump_start_time", "pump_end_time"],
    )


def downgrade():
    op.execute(
        "ALTER TABLE water_energy_logging_daily DROP CONSTRAINT IF EXISTS uq_water_energy_logging_daily_sid_date_times"
    )
    op.execute("DROP INDEX IF EXISTS uq_water_energy_logging_daily_sid_date_times")
    op.create_unique_constraint(
        "uq_water_energy_logging_daily_sid_date",
        "water_energy_logging_daily",
        ["water_system_id", "log_date"],
    )
