"""Add solar/electricity/green connection dates to solar_systems.

Revision ID: 1b2c3d4e5f60
Revises: 0f2a3b4c5d6e
Create Date: 2026-04-27
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "1b2c3d4e5f60"
down_revision = "0f2a3b4c5d6e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    cols = {c["name"] for c in insp.get_columns("solar_systems")}

    with op.batch_alter_table("solar_systems") as batch:
        if "solar_connection_date" not in cols:
            batch.add_column(sa.Column("solar_connection_date", sa.Date(), nullable=True))
        if "electricity_connection_date" not in cols:
            batch.add_column(
                sa.Column("electricity_connection_date", sa.Date(), nullable=True)
            )
        if "green_connection_date" not in cols:
            batch.add_column(sa.Column("green_connection_date", sa.Date(), nullable=True))

    # Backfill from legacy columns when present.
    cols = {c["name"] for c in insp.get_columns("solar_systems")}
    if "solar_connection_date" in cols and "installation_date" in cols:
        op.execute(
            sa.text(
                """
                UPDATE solar_systems
                SET solar_connection_date = installation_date
                WHERE solar_connection_date IS NULL AND installation_date IS NOT NULL
                """
            )
        )
    if "green_connection_date" in cols and "green_meter_connection_date" in cols:
        op.execute(
            sa.text(
                """
                UPDATE solar_systems
                SET green_connection_date = green_meter_connection_date
                WHERE green_connection_date IS NULL AND green_meter_connection_date IS NOT NULL
                """
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    cols = {c["name"] for c in insp.get_columns("solar_systems")}

    with op.batch_alter_table("solar_systems") as batch:
        if "green_connection_date" in cols:
            batch.drop_column("green_connection_date")
        if "electricity_connection_date" in cols:
            batch.drop_column("electricity_connection_date")
        if "solar_connection_date" in cols:
            batch.drop_column("solar_connection_date")

