"""
Who may create/update logging rows:

- Water (daily): USER (tubewell operator) only.
- Solar (monthly): ADMIN (tehsil manager) only.
"""

from __future__ import annotations

from app.models.models import User
from app.rbac import ADMIN, USER, user_assigned_tehsils, user_role_code
from app.services.tehsil_access import assigned_water_system_id_set


class LoggingAccessDenied(PermissionError):
    pass


def assert_tubewell_operator_for_water_logging(user: User | None) -> None:
    if not user:
        raise LoggingAccessDenied("User not found")
    if user_role_code(user) != USER:
        raise LoggingAccessDenied(
            "Only tubewell operators may create or edit water system logs"
        )
    if not assigned_water_system_id_set(user):
        raise LoggingAccessDenied(
            "No water systems assigned — contact your tehsil manager"
        )


def assert_tehsil_manager_for_solar_logging(user: User | None) -> None:
    if not user:
        raise LoggingAccessDenied("User not found")
    if user_role_code(user) != ADMIN:
        raise LoggingAccessDenied(
            "Only tehsil managers may create or edit solar system logs"
        )
    if not user_assigned_tehsils(user):
        raise LoggingAccessDenied(
            "No tehsil assignments — contact operations"
        )
