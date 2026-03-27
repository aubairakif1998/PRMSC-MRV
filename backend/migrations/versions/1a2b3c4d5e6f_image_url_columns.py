"""rename image path columns to image url columns

Revision ID: 1a2b3c4d5e6f
Revises: 0ff4d28da12d
Create Date: 2026-03-25 00:10:00.000000
"""

from alembic import op
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = "1a2b3c4d5e6f"
down_revision = "0ff4d28da12d"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)

    water_cols = {col["name"] for col in inspector.get_columns("monthly_water_data")}
    if "bulk_meter_image_path" in water_cols and "bulk_meter_image_url" not in water_cols:
        op.alter_column(
            "monthly_water_data",
            "bulk_meter_image_path",
            new_column_name="bulk_meter_image_url",
        )

    energy_cols = {col["name"] for col in inspector.get_columns("monthly_energy_data")}
    if "electricity_bill_image" in energy_cols and "electricity_bill_image_url" not in energy_cols:
        op.alter_column(
            "monthly_energy_data",
            "electricity_bill_image",
            new_column_name="electricity_bill_image_url",
        )

    verification_cols = {col["name"] for col in inspector.get_columns("image_verifications")}
    if "image_path" in verification_cols and "image_url" not in verification_cols:
        op.alter_column(
            "image_verifications",
            "image_path",
            new_column_name="image_url",
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)

    verification_cols = {col["name"] for col in inspector.get_columns("image_verifications")}
    if "image_url" in verification_cols and "image_path" not in verification_cols:
        op.alter_column(
            "image_verifications",
            "image_url",
            new_column_name="image_path",
        )

    energy_cols = {col["name"] for col in inspector.get_columns("monthly_energy_data")}
    if "electricity_bill_image_url" in energy_cols and "electricity_bill_image" not in energy_cols:
        op.alter_column(
            "monthly_energy_data",
            "electricity_bill_image_url",
            new_column_name="electricity_bill_image",
        )

    water_cols = {col["name"] for col in inspector.get_columns("monthly_water_data")}
    if "bulk_meter_image_url" in water_cols and "bulk_meter_image_path" not in water_cols:
        op.alter_column(
            "monthly_water_data",
            "bulk_meter_image_url",
            new_column_name="bulk_meter_image_path",
        )

