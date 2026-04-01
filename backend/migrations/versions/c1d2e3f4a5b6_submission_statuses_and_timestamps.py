"""Align water submission statuses; add created_at/updated_at across tables.

Revision ID: c1d2e3f4a5b6
Revises: b2c3d4e5f6a7
Create Date: 2026-03-31

"""
from alembic import op
import sqlalchemy as sa


revision = "c1d2e3f4a5b6"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade():
    # --- Status renames (water logs + submissions) ---
    op.execute(
        "UPDATE water_energy_logging_daily SET status = 'drafted' WHERE status = 'draft'"
    )
    op.execute(
        "UPDATE water_energy_logging_daily SET status = 'accepted' "
        "WHERE status IN ('verified', 'approved')"
    )
    op.execute(
        "UPDATE water_energy_logging_daily SET status = 'submitted' "
        "WHERE status = 'under_review'"
    )

    op.execute("UPDATE submissions SET status = 'drafted' WHERE status = 'draft'")
    op.execute(
        "UPDATE submissions SET status = 'accepted' "
        "WHERE status IN ('verified', 'approved')"
    )
    op.execute(
        "UPDATE submissions SET status = 'submitted' WHERE status = 'under_review'"
    )

    op.alter_column(
        "water_energy_logging_daily",
        "status",
        existing_type=sa.String(length=20),
        type_=sa.String(length=24),
        existing_nullable=True,
    )

    # --- water_energy_logging_daily.updated_at ---
    op.add_column(
        "water_energy_logging_daily",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=True,
        ),
    )
    op.execute(
        "UPDATE water_energy_logging_daily SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP)"
    )
    op.alter_column(
        "water_energy_logging_daily", "updated_at", existing_type=sa.DateTime(), nullable=False
    )

    # --- roles.updated_at ---
    op.add_column(
        "roles",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=True,
        ),
    )
    op.execute(
        "UPDATE roles SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP)"
    )
    op.alter_column("roles", "updated_at", existing_type=sa.DateTime(), nullable=False)

    # --- user_tehsils ---
    op.add_column(
        "user_tehsils",
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=True,
        ),
    )
    op.add_column(
        "user_tehsils",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=True,
        ),
    )
    op.execute(
        "UPDATE user_tehsils SET created_at = CURRENT_TIMESTAMP, "
        "updated_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"
    )
    op.alter_column(
        "user_tehsils", "created_at", existing_type=sa.DateTime(), nullable=False
    )
    op.alter_column(
        "user_tehsils", "updated_at", existing_type=sa.DateTime(), nullable=False
    )

    # --- user_water_systems ---
    op.add_column(
        "user_water_systems",
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=True,
        ),
    )
    op.add_column(
        "user_water_systems",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=True,
        ),
    )
    op.execute(
        "UPDATE user_water_systems SET created_at = CURRENT_TIMESTAMP, "
        "updated_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"
    )
    op.alter_column(
        "user_water_systems", "created_at", existing_type=sa.DateTime(), nullable=False
    )
    op.alter_column(
        "user_water_systems", "updated_at", existing_type=sa.DateTime(), nullable=False
    )

    # --- users.updated_at ---
    op.add_column(
        "users",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=True,
        ),
    )
    op.execute(
        "UPDATE users SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP)"
    )
    op.alter_column("users", "updated_at", existing_type=sa.DateTime(), nullable=False)

    # --- password_reset_tokens.updated_at ---
    op.add_column(
        "password_reset_tokens",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=True,
        ),
    )
    op.execute(
        "UPDATE password_reset_tokens SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP)"
    )
    op.alter_column(
        "password_reset_tokens", "updated_at", existing_type=sa.DateTime(), nullable=False
    )

    # --- water_systems.updated_at ---
    op.add_column(
        "water_systems",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=True,
        ),
    )
    op.execute(
        "UPDATE water_systems SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP)"
    )
    op.alter_column(
        "water_systems", "updated_at", existing_type=sa.DateTime(), nullable=False
    )

    # --- verification_logs: timestamp -> created_at + updated_at ---
    op.add_column(
        "verification_logs",
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=True,
        ),
    )
    op.add_column(
        "verification_logs",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=True,
        ),
    )
    # Column was named "timestamp" (reserved word in SQL — quote in PostgreSQL)
    op.execute(
        'UPDATE verification_logs SET created_at = "timestamp", updated_at = "timestamp"'
    )
    op.execute(
        "UPDATE verification_logs SET created_at = CURRENT_TIMESTAMP "
        "WHERE created_at IS NULL"
    )
    op.execute(
        "UPDATE verification_logs SET updated_at = created_at WHERE updated_at IS NULL"
    )
    op.alter_column(
        "verification_logs", "created_at", existing_type=sa.DateTime(), nullable=False
    )
    op.alter_column(
        "verification_logs", "updated_at", existing_type=sa.DateTime(), nullable=False
    )
    op.drop_column("verification_logs", "timestamp")

    # --- notifications.updated_at ---
    op.add_column(
        "notifications",
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=True,
        ),
    )
    op.execute(
        "UPDATE notifications SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP)"
    )
    op.alter_column(
        "notifications", "updated_at", existing_type=sa.DateTime(), nullable=False
    )


def downgrade():
    op.drop_column("notifications", "updated_at")

    op.add_column(
        "verification_logs",
        sa.Column("timestamp", sa.DateTime(), nullable=True),
    )
    op.execute("UPDATE verification_logs SET timestamp = created_at")
    op.alter_column("verification_logs", "timestamp", nullable=False)
    op.drop_column("verification_logs", "updated_at")
    op.drop_column("verification_logs", "created_at")

    op.drop_column("water_systems", "updated_at")
    op.drop_column("password_reset_tokens", "updated_at")
    op.drop_column("users", "updated_at")
    op.drop_column("user_water_systems", "updated_at")
    op.drop_column("user_water_systems", "created_at")
    op.drop_column("user_tehsils", "updated_at")
    op.drop_column("user_tehsils", "created_at")
    op.drop_column("roles", "updated_at")
    op.drop_column("water_energy_logging_daily", "updated_at")

    op.alter_column(
        "water_energy_logging_daily",
        "status",
        existing_type=sa.String(length=24),
        type_=sa.String(length=20),
        existing_nullable=True,
    )

    op.execute(
        "UPDATE water_energy_logging_daily SET status = 'draft' WHERE status = 'drafted'"
    )
    op.execute(
        "UPDATE water_energy_logging_daily SET status = 'verified' WHERE status = 'accepted'"
    )
    op.execute("UPDATE submissions SET status = 'draft' WHERE status = 'drafted'")
    op.execute(
        "UPDATE submissions SET status = 'verified' WHERE status = 'accepted'"
    )
