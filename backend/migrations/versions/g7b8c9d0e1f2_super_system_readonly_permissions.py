"""SUPER_ADMIN / SYSTEM_ADMIN: read-only permission strings (no writes, no wildcard).

Revision ID: g7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-03-31

Aligns ``roles.permissions`` with ``app.constants.permissions`` for program viewers.
"""
from __future__ import annotations

import json

from alembic import op
from sqlalchemy import text

revision = "g7b8c9d0e1f2"
down_revision = "f6a7b8c9d0e1"
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

_ADMIN_F6 = _USER + [
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

# State before this migration (f6 SUPER_ADMIN; SYSTEM_ADMIN still ``*`` from d3).
_SUPER_BEFORE = _ADMIN_F6 + [
    "submissions.approve",
    "users.read",
    "dashboard.program",
]
_SYSTEM_BEFORE = ["*"]

_SUPER_AFTER = [
    "data.read_all",
    "dashboard.program",
    "users.read",
    "submissions.read_all",
    "water_systems.read_all",
    "solar_systems.read_all",
    "water_logs.read_all",
    "solar_monthly_logs.read_all",
    "audit.read_all",
    "notifications.read",
]
_SYSTEM_AFTER = _SUPER_AFTER + [
    "org.read_all",
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
    _update("SUPER_ADMIN", _SUPER_AFTER)
    _update("SYSTEM_ADMIN", _SYSTEM_AFTER)


def downgrade() -> None:
    _update("SUPER_ADMIN", _SUPER_BEFORE)
    _update("SYSTEM_ADMIN", _SYSTEM_BEFORE)
