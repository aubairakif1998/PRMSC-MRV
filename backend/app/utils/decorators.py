from functools import wraps

from flask import jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request

from app.rbac import ADMIN, ROLE_RANK, USER, hierarchy_rank, normalize_role_code, user_assigned_tehsils
from app.services import UserService


def _claims_rank(claims: dict) -> int:
    r = claims.get("hierarchy_rank")
    if r is not None:
        return int(r)
    return hierarchy_rank(claims.get("role"))


def min_role_required(min_code: str):
    """
    Allow access if the caller's role rank is >= the given role's rank
    (higher roles inherit lower-tier access).
    """
    mc = normalize_role_code(min_code) or min_code
    need = ROLE_RANK.get(mc)
    if need is None:
        raise ValueError(f"min_role_required: invalid role {min_code!r}")

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if request.method == "OPTIONS":
                return fn(*args, **kwargs)

            verify_jwt_in_request()
            claims = get_jwt()
            if _claims_rank(claims) < need:
                return (
                    jsonify(
                        {
                            "message": "Access Forbidden: insufficient role level",
                            "min_role": min_code,
                            "your_role": claims.get("role"),
                        }
                    ),
                    403,
                )
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def tubewell_user_required(fn):
    """Strict USER role with at least one water system assigned by a tehsil manager."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        if request.method == "OPTIONS":
            return fn(*args, **kwargs)

        verify_jwt_in_request()
        claims = get_jwt()
        if normalize_role_code(claims.get("role")) != USER:
            return (
                jsonify(
                    {
                        "message": "Access Forbidden: tubewell operator role required",
                        "your_role": claims.get("role"),
                    }
                ),
                403,
            )
        user = UserService.get_user_by_id(get_jwt_identity())
        if not user:
            return jsonify({"message": "User not found"}), 404
        if not user.assigned_water_system_ids:
            return (
                jsonify(
                    {
                        "message": "No water systems assigned — contact your tehsil manager",
                    }
                ),
                403,
            )
        return fn(*args, **kwargs)

    return wrapper


def tehsil_manager_required(fn):
    """Strict ADMIN role with at least one assigned tehsil (solar monthly logging)."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        if request.method == "OPTIONS":
            return fn(*args, **kwargs)

        verify_jwt_in_request()
        claims = get_jwt()
        if normalize_role_code(claims.get("role")) != ADMIN:
            return (
                jsonify(
                    {
                        "message": "Access Forbidden: tehsil manager role required",
                        "your_role": claims.get("role"),
                    }
                ),
                403,
            )
        user = UserService.get_user_by_id(get_jwt_identity())
        if not user:
            return jsonify({"message": "User not found"}), 404
        if not user_assigned_tehsils(user):
            return (
                jsonify(
                    {
                        "message": "No tehsil assignments — contact operations",
                    }
                ),
                403,
            )
        return fn(*args, **kwargs)

    return wrapper
