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
    tables = inspector.get_table_names()

    if "monthly_water_data" in tables:
        water_cols = {col["name"] for col in inspector.get_columns("monthly_water_data")}
        if "bulk_meter_image_path" in water_cols and "bulk_meter_image_url" not in water_cols:
            op.alter_column(
                "monthly_water_data",
                "bulk_meter_image_path",
                new_column_name="bulk_meter_image_url",
            )

    if "monthly_energy_data" in tables:
        energy_cols = {col["name"] for col in inspector.get_columns("monthly_energy_data")}
        if "electricity_bill_image" in energy_cols and "electricity_bill_image_url" not in energy_cols:
            op.alter_column(
                "monthly_energy_data",
                "electricity_bill_image",
                new_column_name="electricity_bill_image_url",
            )

    if "image_verifications" in tables:
        verification_cols = {
            col["name"] for col in inspector.get_columns("image_verifications")
        }
        if "image_path" in verification_cols and "image_url" not in verification_cols:
            op.alter_column(
                "image_verifications",
                "image_path",
                new_column_name="image_url",
            )

    # Current table names, legacy column names (e.g. table renamed in 6f708 before columns were updated).
    if "water_energy_logging_daily" in tables:
        wcols = {c["name"] for c in inspector.get_columns("water_energy_logging_daily")}
        if "bulk_meter_image_path" in wcols and "bulk_meter_image_url" not in wcols:
            op.alter_column(
                "water_energy_logging_daily",
                "bulk_meter_image_path",
                new_column_name="bulk_meter_image_url",
            )

    if "solar_energy_logging_monthly" in tables:
        scols = {c["name"] for c in inspector.get_columns("solar_energy_logging_monthly")}
        if "electricity_bill_image" in scols and "electricity_bill_image_url" not in scols:
            op.alter_column(
                "solar_energy_logging_monthly",
                "electricity_bill_image",
                new_column_name="electricity_bill_image_url",
            )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    tables = inspector.get_table_names()

    if "image_verifications" in tables:
        verification_cols = {
            col["name"] for col in inspector.get_columns("image_verifications")
        }
        if "image_url" in verification_cols and "image_path" not in verification_cols:
            op.alter_column(
                "image_verifications",
                "image_url",
                new_column_name="image_path",
            )

    if "monthly_energy_data" in tables:
        energy_cols = {col["name"] for col in inspector.get_columns("monthly_energy_data")}
        if "electricity_bill_image_url" in energy_cols and "electricity_bill_image" not in energy_cols:
            op.alter_column(
                "monthly_energy_data",
                "electricity_bill_image_url",
                new_column_name="electricity_bill_image",
            )

    if "monthly_water_data" in tables:
        water_cols = {col["name"] for col in inspector.get_columns("monthly_water_data")}
        if "bulk_meter_image_url" in water_cols and "bulk_meter_image_path" not in water_cols:
            op.alter_column(
                "monthly_water_data",
                "bulk_meter_image_url",
                new_column_name="bulk_meter_image_path",
            )

    if "water_energy_logging_daily" in tables:
        wcols = {c["name"] for c in inspector.get_columns("water_energy_logging_daily")}
        if "bulk_meter_image_url" in wcols and "bulk_meter_image_path" not in wcols:
            op.alter_column(
                "water_energy_logging_daily",
                "bulk_meter_image_url",
                new_column_name="bulk_meter_image_path",
            )

    if "solar_energy_logging_monthly" in tables:
        scols = {c["name"] for c in inspector.get_columns("solar_energy_logging_monthly")}
        if "electricity_bill_image_url" in scols and "electricity_bill_image" not in scols:
            op.alter_column(
                "solar_energy_logging_monthly",
                "electricity_bill_image_url",
                new_column_name="electricity_bill_image",
            )

