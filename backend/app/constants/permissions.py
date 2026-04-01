"""
Permission strings stored in `roles.permissions` (JSON array).

Primary API access is enforced via `hierarchy_rank`, role code, and tehsil /
water-system assignment (`app.rbac`, `tehsil_access`). These strings document
intent for auditing, future decorators, and admin tooling.

SUPER_ADMIN and SYSTEM_ADMIN are read-only (see `tehsil_access` ``for_write``).
There is no ``*`` wildcard — use explicit read scopes below.
"""

from __future__ import annotations

# --- Tubewell operator (USER) ---
PERMISSIONS_USER: list[str] = [
    "submissions.submit",  # submit water daily rows for tehsil review
    "submissions.read_own",  # own submission list & detail
    "water_logs.write_assigned",  # log water data on assigned systems only
    "submissions.edit_draft_or_reverted",  # change logs only while drafted or reverted_back (API-enforced)
    "notifications.read",  # in-app notifications
    "dashboard.operator",  # operator-scoped dashboard KPIs
]

# --- Tehsil manager (ADMIN): USER-relevant + tehsil oversight ---
# Facility and log actions are tehsil-scoped in API (assigned tehsils only).
PERMISSIONS_ADMIN: list[str] = [
    *PERMISSIONS_USER,
    "water_systems.manage_tehsil",  # create / update / delete water systems in assigned tehsils
    "solar_systems.manage_tehsil",  # create / update / delete solar systems in assigned tehsils
    "solar_monthly_logs.write_tehsil",  # solar monthly logging for facilities in assigned tehsils
    "submissions.verify",  # accept tubewell water submissions (scoped to their tehsils)
    "submissions.reject",
    "submissions.revert",  # return to operator
    "submissions.queue",  # pending / history queue
    "audit.read_scoped",  # verification audit log (tehsil-scoped)
    "dashboard.staff",  # tehsil staff dashboard
]

# Program-wide read (Manager Operations) — no facility or verification writes.
_PERMISSIONS_READ_GLOBAL: list[str] = [
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

PERMISSIONS_SUPER_ADMIN: list[str] = [*_PERMISSIONS_READ_GLOBAL]

# MRV COO — same read scope as SUPER_ADMIN plus org-level read marker (no writes).
PERMISSIONS_SYSTEM_ADMIN: list[str] = [*_PERMISSIONS_READ_GLOBAL, "org.read_all"]
