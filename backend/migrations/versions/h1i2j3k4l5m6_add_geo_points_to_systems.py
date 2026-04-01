"""Add latitude/longitude to water_systems & solar_systems.

Revision ID: h1i2j3k4l5m6
Revises: g7b8c9d0e1f2
Create Date: 2026-04-01
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "h1i2j3k4l5m6"
down_revision = "g7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("water_systems") as batch:
        batch.add_column(sa.Column("latitude", sa.Float(), nullable=True))
        batch.add_column(sa.Column("longitude", sa.Float(), nullable=True))

    with op.batch_alter_table("solar_systems") as batch:
        batch.add_column(sa.Column("latitude", sa.Float(), nullable=True))
        batch.add_column(sa.Column("longitude", sa.Float(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("solar_systems") as batch:
        batch.drop_column("longitude")
        batch.drop_column("latitude")

    with op.batch_alter_table("water_systems") as batch:
        batch.drop_column("longitude")
        batch.drop_column("latitude")

