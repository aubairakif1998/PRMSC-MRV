"""rename energy logging tables; water logs become daily (log_date)

Revision ID: 6f708192abcd
Revises: 5e6f708192ab
Create Date: 2026-03-30 22:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision = "6f708192abcd"
down_revision = "5e6f708192ab"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    tables = set(insp.get_table_names())

    # --- Solar: rename table + optional remarks ---
    if "monthly_energy_data" in tables:
        op.execute(text("ALTER TABLE monthly_energy_data RENAME TO solar_energy_logging_monthly"))
        insp = inspect(bind)
        tables = set(insp.get_table_names())

    if "solar_energy_logging_monthly" in tables:
        scols = {c["name"] for c in insp.get_columns("solar_energy_logging_monthly")}
        if "remarks" not in scols:
            op.add_column(
                "solar_energy_logging_monthly",
                sa.Column("remarks", sa.Text(), nullable=True),
            )

    # --- Water: log_date, drop year/month, rename ---
    if "water_energy_logging_daily" in tables:
        return

    if "monthly_water_data" not in tables:
        return

    wcols = {c["name"] for c in insp.get_columns("monthly_water_data")}

    if "log_date" not in wcols:
        op.add_column("monthly_water_data", sa.Column("log_date", sa.Date(), nullable=True))

    op.execute(
        text(
            """
            UPDATE monthly_water_data
            SET log_date = make_date(year, month, 1)
            WHERE log_date IS NULL
            """
        )
    )

    # Drop duplicate calendar months per system before NOT NULL / unique
    op.execute(
        text(
            """
            DELETE FROM monthly_water_data a
            USING monthly_water_data b
            WHERE a.ctid < b.ctid
              AND a.water_system_id = b.water_system_id
              AND a.year = b.year
              AND a.month = b.month
            """
        )
    )

    op.alter_column("monthly_water_data", "log_date", existing_type=sa.Date(), nullable=False)

    if "year" in wcols:
        op.drop_column("monthly_water_data", "year")
    if "month" in wcols:
        op.drop_column("monthly_water_data", "month")

    wcols2 = {c["name"] for c in inspect(bind).get_columns("monthly_water_data")}
    if "remarks" not in wcols2:
        op.add_column(
            "monthly_water_data",
            sa.Column("remarks", sa.Text(), nullable=True),
        )

    op.execute(text("ALTER TABLE monthly_water_data RENAME TO water_energy_logging_daily"))

    op.create_index(
        "uq_water_energy_logging_daily_sid_date",
        "water_energy_logging_daily",
        ["water_system_id", "log_date"],
        unique=True,
    )


def downgrade():
    pass
