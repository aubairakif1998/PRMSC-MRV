"""Water systems: bulk meter installed + alternative required fields.

Revision ID: 0e1f2a3b4c5d
Revises: 0d8e9f0a1b2c
Create Date: 2026-04-20
"""

from alembic import op
import sqlalchemy as sa


revision = "0e1f2a3b4c5d"
down_revision = "0d8e9f0a1b2c"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "water_systems",
        sa.Column(
            "bulk_meter_installed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.add_column("water_systems", sa.Column("ohr_tank_capacity", sa.Float(), nullable=True))
    op.add_column("water_systems", sa.Column("ohr_fill_required", sa.Float(), nullable=True))
    op.add_column("water_systems", sa.Column("pump_capacity", sa.Float(), nullable=True))
    op.add_column("water_systems", sa.Column("pump_head", sa.Float(), nullable=True))
    op.add_column("water_systems", sa.Column("pump_horse_power", sa.Float(), nullable=True))
    op.add_column("water_systems", sa.Column("time_to_fill", sa.Float(), nullable=True))

    # Remove server default; app-level default stays.
    op.alter_column("water_systems", "bulk_meter_installed", server_default=None)


def downgrade():
    op.drop_column("water_systems", "time_to_fill")
    op.drop_column("water_systems", "pump_horse_power")
    op.drop_column("water_systems", "pump_head")
    op.drop_column("water_systems", "pump_capacity")
    op.drop_column("water_systems", "ohr_fill_required")
    op.drop_column("water_systems", "ohr_tank_capacity")
    op.drop_column("water_systems", "bulk_meter_installed")

