"""ADMIN/SUPER_ADMIN: tehsil facility + solar log permissions (replace systems.read_scoped).

Revision ID: f6a7b8c9d0e1
Revises: e4f5a6b7c8d9
Create Date: 2026-03-31

Keeps DB roles.permissions in sync with `app.constants.permissions.PERMISSIONS_ADMIN`
for environments that already ran d3e4f5a6b7c8 before facility strings were added.
"""
from __future__ import annotations

import json

from alembic import op
from sqlalchemy import text

revision = "f6a7b8c9d0e1"
down_revision = "e4f5a6b7c8d9"
branch_labels = None
depends_on = None

_USER = [
    "submissions.submit",
    "submissions.read_own",
    "water_logs.write_assigned",
    "submissions.edit_draft_or_reverted",
    "notifications.read",
    "dashboard.operator",
]

# State before this migration (d3 ADMIN after e4 USER fix).
_ADMIN_BEFORE = _USER + [
    "submissions.verify",
    "submissions.reject",
    "submissions.revert",
    "submissions.queue",
    "systems.read_scoped",
    "audit.read_scoped",
    "dashboard.staff",
]
_SUPER_BEFORE = _ADMIN_BEFORE + [
    "submissions.approve",
    "users.read",
    "dashboard.program",
]

_ADMIN_AFTER = _USER + [
    "water_systems.manage_tehsil",
    "solar_systems.manage_tehsil",
    "solar_monthly_logs.write_tehsil",
    "submissions.verify",
    "submissions.reject",
    "submissions.revert",
    "submissions.queue",
    "audit.read_scoped",
    "dashboard.staff",
]
_SUPER_AFTER = _ADMIN_AFTER + [
    "submissions.approve",
    "users.read",
    "dashboard.program",
]


def _update(code: str, perms: list[str]) -> None:
    bind = op.get_bind()
    bind.execute(
        text(
            """
            UPDATE roles
            SET permissions = CAST(:p AS JSON),
                updated_at = CURRENT_TIMESTAMP
            WHERE code = :code
            """
        ),
        {"p": json.dumps(perms), "code": code},
    )


def upgrade() -> None:
    _update("ADMIN", _ADMIN_AFTER)
    _update("SUPER_ADMIN", _SUPER_AFTER)


def downgrade() -> None:
    _update("ADMIN", _ADMIN_BEFORE)
    _update("SUPER_ADMIN", _SUPER_BEFORE)
