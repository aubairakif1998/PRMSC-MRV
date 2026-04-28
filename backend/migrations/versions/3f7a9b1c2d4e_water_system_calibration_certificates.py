"""Water system calibration certificates table.

Revision ID: 3f7a9b1c2d4e
Revises: 2c3d4e5f6071
Create Date: 2026-04-27
"""

from alembic import op
import sqlalchemy as sa


revision = "3f7a9b1c2d4e"
down_revision = "2c3d4e5f6071"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "water_system_calibration_certificates",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "water_system_id",
            sa.String(length=36),
            sa.ForeignKey("water_systems.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("file_url", sa.Text(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=True, server_default=sa.text("now()")),
        sa.UniqueConstraint("water_system_id", name="uq_ws_calibration_cert_water_system_id"),
    )


def downgrade():
    op.drop_table("water_system_calibration_certificates")

