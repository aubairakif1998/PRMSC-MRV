"""Refresh roles.permissions: align with water MRV; drop obsolete emissions.*.

Revision ID: d3e4f5a6b7c8
Revises: c1d2e3f4a5b6
Create Date: 2026-03-31

"""
from __future__ import annotations

import json

from alembic import op
from sqlalchemy import text

revision = "d3e4f5a6b7c8"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None

# Previous values (for downgrade) — from 2b3c4d5e6f7a _perm_sets()
_OLD_USER = [
    "submissions.submit",
    "submissions.read_own",
    "systems.manage_own",
    "emissions.access",
    "dashboard.operator",
]
_OLD_ADMIN = _OLD_USER + [
    "submissions.verify",
    "submissions.reject",
    "submissions.queue",
    "systems.read_scoped",
    "audit.read_scoped",
    "dashboard.staff",
]
_OLD_SUPER = _OLD_ADMIN + [
    "submissions.approve",
    "users.read",
    "emissions.read_all",
    "dashboard.program",
]
_OLD_SYSTEM = ["*"]

# Keep in sync with `app.constants.permissions` (same strings).
_NEW_USER = [
    "submissions.submit",
    "submissions.read_own",
    "water_logs.write_assigned",
    "submissions.edit_draft_or_reverted",
    "notifications.read",
    "dashboard.operator",
]
_NEW_ADMIN = _NEW_USER + [
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
_NEW_SUPER = [
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
_NEW_SYSTEM = _NEW_SUPER + [
    "org.read_all",
]


def _update_permissions(code: str, perms: list[str]) -> None:
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
    _update_permissions("USER", _NEW_USER)
    _update_permissions("ADMIN", _NEW_ADMIN)
    _update_permissions("SUPER_ADMIN", _NEW_SUPER)
    _update_permissions("SYSTEM_ADMIN", _NEW_SYSTEM)


def downgrade() -> None:
    _update_permissions("USER", _OLD_USER)
    _update_permissions("ADMIN", _OLD_ADMIN)
    _update_permissions("SUPER_ADMIN", _OLD_SUPER)
    _update_permissions("SYSTEM_ADMIN", _OLD_SYSTEM)
