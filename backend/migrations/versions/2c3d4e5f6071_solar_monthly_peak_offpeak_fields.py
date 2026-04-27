"""Solar monthly logging: peak/off-peak import/export/net fields.

Revision ID: 2c3d4e5f6071
Revises: 1b2c3d4e5f60
Create Date: 2026-04-27
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "2c3d4e5f6071"
down_revision = "1b2c3d4e5f60"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    cols = {c["name"] for c in insp.get_columns("solar_energy_logging_monthly")}

    with op.batch_alter_table("solar_energy_logging_monthly") as batch:
        for name in (
            "export_off_peak",
            "export_peak",
            "import_off_peak",
            "import_peak",
            "net_off_peak",
            "net_peak",
        ):
            if name not in cols:
                batch.add_column(sa.Column(name, sa.Float(), nullable=True))

        # Drop legacy columns (explicitly not keeping compatibility).
        if "energy_consumed_from_grid" in cols:
            batch.drop_column("energy_consumed_from_grid")
        if "energy_exported_to_grid" in cols:
            batch.drop_column("energy_exported_to_grid")


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    cols = {c["name"] for c in insp.get_columns("solar_energy_logging_monthly")}

    with op.batch_alter_table("solar_energy_logging_monthly") as batch:
        # Restore legacy columns.
        if "energy_consumed_from_grid" not in cols:
            batch.add_column(sa.Column("energy_consumed_from_grid", sa.Float(), nullable=True))
        if "energy_exported_to_grid" not in cols:
            batch.add_column(sa.Column("energy_exported_to_grid", sa.Float(), nullable=True))

        for name in (
            "net_peak",
            "net_off_peak",
            "import_peak",
            "import_off_peak",
            "export_peak",
            "export_off_peak",
        ):
            if name in cols:
                batch.drop_column(name)

