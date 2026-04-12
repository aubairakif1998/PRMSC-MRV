"""
Tehsil-scoped access:

- SUPER_ADMIN+ : read all tehsils (list/detail). Mutations pass ``for_write=True`` and
  deny these roles (program viewers are read-only).
- ADMIN (tehsil manager): union of rows in user_tehsils (explicit tehsil assignment).
- USER (tubewell operator): no user_tehsils rows — tehsil access is implied only from
  assigned water systems (user_water_systems → water_systems.tehsil).

Managers assign operators to concrete water systems they created; operators cannot be
given a standalone tehsil scope without water-system links.
"""

from __future__ import annotations

from app.constants.tehsils import canonical_tehsil
from app.models.models import SolarSystem, User, WaterSystem
from app.rbac import ADMIN, ROLE_RANK, SUPER_ADMIN, USER, user_rank, user_role_code


class TehsilAccessDenied(Exception):
    """Raised when a user may not access a tehsil or resource in that tehsil."""

    pass


def assigned_tehsil_set(user: User) -> frozenset[str]:
    """Persisted tehsil links (tehsil managers only in practice)."""
    links = getattr(user, "tehsil_links", None) or []
    return frozenset(link.tehsil for link in links)


def canonical_assigned_tehsil_set(user: User) -> frozenset[str]:
    """
    Tehsil manager's ``user_tehsils``, normalized to predefined names (see ``canonical_tehsil``).
    Use this when comparing to ``water_systems.tehsil`` so casing/spelling cannot bypass scope.
    """
    if user_role_code(user) != ADMIN:
        return frozenset()
    links = getattr(user, "tehsil_links", None) or []
    out: set[str] = set()
    for link in links:
        c = canonical_tehsil(link.tehsil)
        if c:
            out.add(c)
    return frozenset(out)


def has_full_tehsil_access(user: User) -> bool:
    return user_rank(user) >= ROLE_RANK[SUPER_ADMIN]


def operator_tehsils_derived_from_water_systems(user: User) -> frozenset[str]:
    """
    Canonical tehsils of all water systems assigned to this tubewell operator.
    Used instead of user_tehsils for USER role.
    """
    links = getattr(user, "water_system_links", None) or []
    ids = frozenset(str(link.water_system_id) for link in links)
    if not ids:
        return frozenset()
    out: set[str] = set()
    for ws in WaterSystem.query.filter(WaterSystem.id.in_(ids)).all():
        c = canonical_tehsil(ws.tehsil)
        if c:
            out.add(c)
    return frozenset(out)


def user_may_access_tehsil(
    user: User, tehsil: str | None, *, for_write: bool = False
) -> bool:
    """
    Read: USER / ADMIN by assignment; SUPER_ADMIN+ see all tehsils.

    Write (``for_write=True``): tubewell operators may write logs in their tehsils;
    tehsil managers may mutate facilities in assigned tehsils; SUPER_ADMIN+ cannot write.
    """
    if not tehsil:
        return False
    c = canonical_tehsil(tehsil)
    if not c:
        return False
    if for_write:
        if user_rank(user) >= ROLE_RANK[SUPER_ADMIN]:
            return False
        code = user_role_code(user)
        if code == USER:
            return c in operator_tehsils_derived_from_water_systems(user)
        if code == ADMIN:
            return c in canonical_assigned_tehsil_set(user)
        return False
    if has_full_tehsil_access(user):
        return True
    code = user_role_code(user)
    if code not in (USER, ADMIN):
        return False
    if code == USER:
        return c in operator_tehsils_derived_from_water_systems(user)
    return c in canonical_assigned_tehsil_set(user)


def assert_user_may_access_tehsil(
    user: User, tehsil: str | None, *, for_write: bool = False
) -> None:
    if user_may_access_tehsil(user, tehsil, for_write=for_write):
        return
    raise TehsilAccessDenied(
        "Read-only role — cannot modify data for this tehsil"
        if for_write
        else "Not allowed for this tehsil"
    )


def assigned_water_system_id_set(user: User) -> frozenset[str]:
    links = getattr(user, "water_system_links", None) or []
    return frozenset(str(link.water_system_id) for link in links)


def assert_user_may_access_water_system(
    user: User, system: WaterSystem | None, *, for_write: bool = False
) -> None:
    if system is None:
        raise TehsilAccessDenied("System not found")
    assert_user_may_access_tehsil(user, system.tehsil, for_write=for_write)


def assert_user_may_log_water_system(user: User, system: WaterSystem | None) -> None:
    """Tubewell operators may only log against explicitly assigned water systems."""
    if system is None:
        raise TehsilAccessDenied("System not found")
    if user_role_code(user) != USER:
        raise TehsilAccessDenied("Only tubewell operators may log water system data")
    if str(system.id) not in assigned_water_system_id_set(user):
        raise TehsilAccessDenied(
            "This water system is not assigned to your account — contact your tehsil manager"
        )


def assert_user_may_view_or_log_water_system(user: User, system: WaterSystem | None) -> None:
    """
    USER: must have explicit water-system assignment.
    ADMIN+: tehsil scope via user_tehsils (oversight / PDF / config).
    """
    if system is None:
        raise TehsilAccessDenied("System not found")
    if user_role_code(user) == USER:
        assert_user_may_log_water_system(user, system)
        return
    assert_user_may_access_water_system(user, system)


def assert_user_may_access_solar_system(
    user: User, system: SolarSystem | None, *, for_write: bool = False
) -> None:
    if system is None:
        raise TehsilAccessDenied("System not found")
    assert_user_may_access_tehsil(user, system.tehsil, for_write=for_write)


def assert_actor_may_assign_water_systems_to_operator(
    actor: User, water_system_ids: list[str]
) -> list[WaterSystem]:
    """
    Resolve systems; ensure each exists and lies in the actor's tehsils (ADMIN only).
    """
    if not water_system_ids:
        raise ValueError("At least one water_system_id is required")

    systems: list[WaterSystem] = []
    seen: set[str] = set()
    for raw in water_system_ids:
        sid = str(raw).strip()
        if not sid or sid in seen:
            continue
        seen.add(sid)
        ws = WaterSystem.query.get(sid)
        if not ws:
            raise ValueError(f"Water system not found: {sid}")
        systems.append(ws)

    if not systems:
        raise ValueError("At least one valid water_system_id is required")

    if user_role_code(actor) != ADMIN:
        raise TehsilAccessDenied("Only tehsil managers can assign water systems to operators")

    actor_ts = canonical_assigned_tehsil_set(actor)
    for ws in systems:
        ct = canonical_tehsil(ws.tehsil)
        if not ct or ct not in actor_ts:
            raise TehsilAccessDenied(
                f"Water system {ws.id} is outside your tehsil scope — you cannot assign it"
            )
    return systems


def manageable_water_system_ids_for_assignment(actor: User) -> set[str]:
    """
    IDs of water systems a tehsil manager may link to tubewell operators.

    Only ``ADMIN`` users (tehsil managers) with ``user_tehsils`` may manage links.
    Systems are included only when ``water_systems.tehsil`` matches one of the manager's
    assigned tehsils (after canonicalization). Program-wide roles do not receive all IDs here.
    """
    ids: set[str] = set()
    if user_role_code(actor) != ADMIN:
        return set()
    actor_ts = canonical_assigned_tehsil_set(actor)
    if not actor_ts:
        return set()
    for ws in WaterSystem.query.all():
        c = canonical_tehsil(ws.tehsil)
        if c and c in actor_ts:
            ids.add(str(ws.id))
    return ids
