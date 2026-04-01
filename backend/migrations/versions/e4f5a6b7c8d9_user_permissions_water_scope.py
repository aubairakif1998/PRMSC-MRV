"""Narrow USER role: replace systems.manage_own with water log + draft/revert scope.

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-03-31

For databases that already ran d3e4f5a6b7c8 with ``systems.manage_own`` on USER.
"""
from __future__ import annotations

import json

from alembic import op
from sqlalchemy import text

revision = "e4f5a6b7c8d9"
down_revision = "d3e4f5a6b7c8"
branch_labels = None
depends_on = None

_USER_AFTER_D3 = [
    "submissions.submit",
    "submissions.read_own",
    "systems.manage_own",
    "notifications.read",
    "dashboard.operator",
]

_USER_NEW = [
    "submissions.submit",
    "submissions.read_own",
    "water_logs.write_assigned",
    "submissions.edit_draft_or_reverted",
    "notifications.read",
    "dashboard.operator",
]


def _set_user_perms(perms: list[str]) -> None:
    bind = op.get_bind()
    bind.execute(
        text(
            """
            UPDATE roles
            SET permissions = CAST(:p AS JSON),
                updated_at = CURRENT_TIMESTAMP
            WHERE code = 'USER'
            """
        ),
        {"p": json.dumps(perms)},
    )


def upgrade() -> None:
    _set_user_perms(_USER_NEW)


def downgrade() -> None:
    _set_user_perms(_USER_AFTER_D3)
