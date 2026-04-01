"""user_water_systems: tubewell operators assigned to explicit water systems

Revision ID: 7b8c9d0e1f2a
Revises: 6f708192abcd
Create Date: 2026-03-30 23:30:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision = "7b8c9d0e1f2a"
down_revision = "6f708192abcd"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    tables = set(insp.get_table_names())

    if "user_water_systems" not in tables:
        op.create_table(
            "user_water_systems",
            sa.Column("user_id", sa.String(36), nullable=False),
            sa.Column("water_system_id", sa.String(36), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["water_system_id"], ["water_systems.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("user_id", "water_system_id"),
        )

    insp = inspect(bind)
    idx_names = {ix["name"] for ix in insp.get_indexes("user_water_systems")}
    if "ix_user_water_systems_water_system_id" not in idx_names:
        op.create_index(
            "ix_user_water_systems_water_system_id",
            "user_water_systems",
            ["water_system_id"],
        )

    # Legacy: tubewell operators had tehsil scope via user_tehsils; map to explicit water systems.
    if "user_tehsils" in insp.get_table_names():
        op.execute(
            text(
                """
                INSERT INTO user_water_systems (user_id, water_system_id)
                SELECT ut.user_id, w.id
                FROM user_tehsils ut
                INNER JOIN users u ON u.id = ut.user_id
                INNER JOIN roles r ON r.id = u.role_id AND r.code = 'USER'
                INNER JOIN water_systems w ON w.tehsil = ut.tehsil
                ON CONFLICT DO NOTHING
                """
            )
        )


def downgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    if "user_water_systems" not in insp.get_table_names():
        return
    op.drop_index("ix_user_water_systems_water_system_id", table_name="user_water_systems")
    op.drop_table("user_water_systems")
