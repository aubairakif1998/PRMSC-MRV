"""Water calibration: is_active + drop water-system calibration notes.

Revision ID: 5b6c7d8e9f01
Revises: 4a1c9d8e7f6b
Create Date: 2026-04-27
"""

from alembic import op
import sqlalchemy as sa


revision = "5b6c7d8e9f01"
down_revision = "4a1c9d8e7f6b"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "water_system_calibration_certificates",
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    # Remove server default after backfill.
    op.alter_column(
        "water_system_calibration_certificates",
        "is_active",
        server_default=None,
    )

    # Ensure at most one active cert per water system (Postgres partial unique index).
    op.create_index(
        "uq_ws_calibration_one_active",
        "water_system_calibration_certificates",
        ["water_system_id"],
        unique=True,
        postgresql_where=sa.text("is_active"),
    )

    # Drop calibration notes from water systems.
    op.drop_column("water_systems", "calibration_requirement")


def downgrade():
    op.add_column(
        "water_systems",
        sa.Column("calibration_requirement", sa.Text(), nullable=True),
    )
    op.drop_index("uq_ws_calibration_one_active", table_name="water_system_calibration_certificates")
    op.drop_column("water_system_calibration_certificates", "is_active")
