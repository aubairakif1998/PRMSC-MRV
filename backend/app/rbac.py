"""
Role hierarchy (highest rank first):

  SYSTEM_ADMIN  (4) — MRV COO — program-wide read-only (see ``tehsil_access`` ``for_write``)
  SUPER_ADMIN   (3) — Manager Operations — program-wide read-only
  ADMIN         (2) — Tehsil Manager — water/solar registry + solar logging + review of tubewell submissions (scoped tehsils)
  USER          (1) — Tubewell Operator — daily water logging only (assigned water systems; tehsil derived)

Only canonical JWT/DB codes are accepted (no legacy aliases).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from app.constants.tehsils import canonical_tehsil

if TYPE_CHECKING:
    from app.models.models import User

SYSTEM_ADMIN = "SYSTEM_ADMIN"
SUPER_ADMIN = "SUPER_ADMIN"
ADMIN = "ADMIN"
USER = "USER"

ROLE_RANK: dict[str, int] = {
    USER: 1,
    ADMIN: 2,
    SUPER_ADMIN: 3,
    SYSTEM_ADMIN: 4,
}

ORDER_LOW_TO_HIGH: tuple[str, ...] = (USER, ADMIN, SUPER_ADMIN, SYSTEM_ADMIN)


def normalize_role_code(role: str | None) -> str | None:
    if not role:
        return None
    r = role.strip()
    if r in ROLE_RANK:
        return r
    return None


def hierarchy_rank(role_code: str | None) -> int:
    code = normalize_role_code(role_code)
    if not code:
        return 0
    return ROLE_RANK.get(code, 0)


def rank_at_least(role_code: str | None, min_code: str) -> bool:
    return hierarchy_rank(role_code) >= ROLE_RANK[min_code]


def effective_permissions(permissions_json: Any) -> set[str]:
    if not permissions_json:
        return set()
    if isinstance(permissions_json, list):
        return set(permissions_json)
    return set()


def has_permission(permissions_json: Any, permission: str) -> bool:
    perms = effective_permissions(permissions_json)
    return permission in perms


def user_assigned_tehsils(user: User) -> frozenset[str]:
    """
    Tehsil managers: canonical tehsils from user_tehsils.
    Tubewell operators: canonical tehsils implied by assigned water systems (no user_tehsils rows).
    """
    if user_role_code(user) == USER:
        from app.services.tehsil_access import operator_tehsils_derived_from_water_systems

        return operator_tehsils_derived_from_water_systems(user)
    links = getattr(user, "tehsil_links", None) or []
    return frozenset(link.tehsil for link in links)


def user_rank(user: User) -> int:
    if user.assigned_role is not None:
        return user.assigned_role.hierarchy_rank or 1
    return hierarchy_rank(getattr(user, "role", None))


def user_role_code(user: User) -> str:
    if user.assigned_role is not None:
        return user.assigned_role.code
    return normalize_role_code(getattr(user, "role", None)) or USER


def can_access_tehsil(user: User, tehsil: str | None) -> bool:
    if user_rank(user) >= ROLE_RANK[SUPER_ADMIN]:
        return True
    code = user_role_code(user)
    if code not in (USER, ADMIN):
        return False
    c = canonical_tehsil(tehsil)
    if not c:
        return False
    return c in user_assigned_tehsils(user)


def tehsil_scope_denied_message() -> dict[str, str]:
    return {"error": "Access denied for this tehsil"}


def submission_tehsil(submission) -> str | None:
    from app.models.models import (
        SolarEnergyLoggingMonthly,
        SolarSystem,
        WaterEnergyLoggingDaily,
        WaterSystem,
    )

    if submission.submission_type == "water_system":
        record = WaterEnergyLoggingDaily.query.get(submission.record_id)
        if not record:
            return None
        system = WaterSystem.query.get(record.water_system_id)
        return system.tehsil if system else None
    if submission.submission_type == "solar_system":
        record = SolarEnergyLoggingMonthly.query.get(submission.record_id)
        if not record:
            return None
        system = SolarSystem.query.get(record.solar_system_id)
        return system.tehsil if system else None
    return None


def user_can_access_submission(user: User, submission) -> bool:
    if user_rank(user) >= ROLE_RANK[SUPER_ADMIN]:
        return True
    if user_role_code(user) == USER:
        if str(submission.operator_id) != str(user.id):
            return False
        if submission.submission_type == "water_system":
            from app.models.models import WaterEnergyLoggingDaily
            from app.services.tehsil_access import assigned_water_system_id_set

            record = WaterEnergyLoggingDaily.query.get(submission.record_id)
            if not record:
                return False
            return str(record.water_system_id) in assigned_water_system_id_set(user)
        t = submission_tehsil(submission)
        return t is not None and can_access_tehsil(user, t)
    if user_role_code(user) == ADMIN:
        t = submission_tehsil(submission)
        return can_access_tehsil(user, t)
    return False


def user_can_view_submission_detail(user: User, submission, current_user_id: str) -> bool:
    if user_role_code(user) == USER:
        if str(submission.operator_id) != str(current_user_id):
            return False
        if submission.submission_type == "water_system":
            from app.models.models import WaterEnergyLoggingDaily
            from app.services.tehsil_access import assigned_water_system_id_set

            record = WaterEnergyLoggingDaily.query.get(submission.record_id)
            if not record:
                return False
            return str(record.water_system_id) in assigned_water_system_id_set(user)
        return can_access_tehsil(user, submission_tehsil(submission))
    if user_rank(user) >= ROLE_RANK[SUPER_ADMIN]:
        return True
    if user_role_code(user) == ADMIN:
        return can_access_tehsil(user, submission_tehsil(submission))
    return False


def user_can_verify_submission(user: User, submission) -> bool:
    """Tehsil managers (ADMIN) only; SUPER_ADMIN+ are read-only for verification."""
    rk = user_rank(user)
    if rk < ROLE_RANK[ADMIN]:
        return False
    if rk >= ROLE_RANK[SUPER_ADMIN]:
        return False
    t = submission_tehsil(submission)
    return can_access_tehsil(user, t)
