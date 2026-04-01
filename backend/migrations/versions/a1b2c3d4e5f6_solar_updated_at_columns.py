"""solar_systems and solar_energy_logging_monthly updated_at

Revision ID: a1b2c3d4e5f6
Revises: 9a0b1c2d3e4f
Create Date: 2026-03-30

"""
from alembic import op
import sqlalchemy as sa


revision = "a1b2c3d4e5f6"
down_revision = "9a0b1c2d3e4f"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "solar_systems",
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "solar_energy_logging_monthly",
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.execute(
        "UPDATE solar_systems SET updated_at = created_at WHERE updated_at IS NULL"
    )
    op.execute(
        "UPDATE solar_energy_logging_monthly SET updated_at = created_at WHERE updated_at IS NULL"
    )


def downgrade():
    op.drop_column("solar_energy_logging_monthly", "updated_at")
    op.drop_column("solar_systems", "updated_at")
