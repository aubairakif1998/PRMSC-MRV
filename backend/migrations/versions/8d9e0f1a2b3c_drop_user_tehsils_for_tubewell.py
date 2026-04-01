"""Remove user_tehsils rows for tubewell operators (scope = water systems only)

Revision ID: 8d9e0f1a2b3c
Revises: 7b8c9d0e1f2a
Create Date: 2026-03-30 12:00:00.000000
"""

from alembic import op
from sqlalchemy import inspect, text

revision = "8d9e0f1a2b3c"
down_revision = "7b8c9d0e1f2a"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = inspect(bind)
    if "user_tehsils" not in insp.get_table_names():
        return
    op.execute(
        text(
            """
            DELETE FROM user_tehsils
            WHERE user_id IN (
                SELECT u.id FROM users u
                INNER JOIN roles r ON r.id = u.role_id AND r.code = 'USER'
            )
            """
        )
    )


def downgrade():
    pass
