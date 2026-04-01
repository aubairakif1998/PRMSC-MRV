"""Drop status from solar_energy_logging_monthly (manager-submitted only).

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-30

"""
from alembic import op
import sqlalchemy as sa


revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column("solar_energy_logging_monthly", "status")


def downgrade():
    op.add_column(
        "solar_energy_logging_monthly",
        sa.Column("status", sa.String(length=20), nullable=True),
    )
    op.execute(
        "UPDATE solar_energy_logging_monthly SET status = 'submitted' WHERE status IS NULL"
    )
