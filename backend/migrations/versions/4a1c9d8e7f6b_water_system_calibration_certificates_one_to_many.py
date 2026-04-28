"""Water system calibration certificates: allow multiple per system.

Revision ID: 4a1c9d8e7f6b
Revises: 3f7a9b1c2d4e
Create Date: 2026-04-27
"""

from alembic import op


revision = "4a1c9d8e7f6b"
down_revision = "3f7a9b1c2d4e"
branch_labels = None
depends_on = None


def upgrade():
    # Drop the unique constraint so multiple certificates can be stored per water system.
    op.drop_constraint(
        "uq_ws_calibration_cert_water_system_id",
        "water_system_calibration_certificates",
        type_="unique",
    )


def downgrade():
    # Re-add unique constraint (may fail if duplicate rows exist).
    op.create_unique_constraint(
        "uq_ws_calibration_cert_water_system_id",
        "water_system_calibration_certificates",
        ["water_system_id"],
    )

