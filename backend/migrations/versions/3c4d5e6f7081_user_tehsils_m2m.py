"""user_tehsils many-to-many; drop users.tehsil

Revision ID: 3c4d5e6f7081
Revises: 2b3c4d5e6f7a
Create Date: 2026-03-30 14:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision = "3c4d5e6f7081"
down_revision = "2b3c4d5e6f7a"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "user_tehsils" not in inspector.get_table_names():
        op.create_table(
            "user_tehsils",
            sa.Column("user_id", sa.String(36), nullable=False),
            sa.Column("tehsil", sa.String(100), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("user_id", "tehsil"),
        )

    # Fresh DBs already have user_tehsils from create_all; 2b3c still stores tehsil on users — copy then drop.
    user_cols = {c["name"] for c in inspect(bind).get_columns("users")}
    if "tehsil" in user_cols:
        op.execute(
            text(
                """
                INSERT INTO user_tehsils (user_id, tehsil)
                SELECT id, TRIM(tehsil)
                FROM users
                WHERE tehsil IS NOT NULL AND TRIM(tehsil) <> ''
                ON CONFLICT DO NOTHING
                """
            )
        )
        op.drop_column("users", "tehsil")


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "user_tehsils" not in inspector.get_table_names():
        return

    op.add_column(
        "users",
        sa.Column("tehsil", sa.String(100), nullable=True),
    )
    op.execute(
        text(
            """
            UPDATE users u
            SET tehsil = x.tehsil
            FROM (
                SELECT user_id, MIN(tehsil) AS tehsil
                FROM user_tehsils
                GROUP BY user_id
            ) x
            WHERE u.id = x.user_id
            """
        )
    )
    op.drop_table("user_tehsils")
