from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.schemas.user_schema import ValidationError, validate_onboard_operator_payload
from app.services import UserService
from app.services.tehsil_access import TehsilAccessDenied
from app.utils.decorators import min_role_required

users_bp = Blueprint("users", __name__)


@users_bp.route("/", methods=["GET"])
@jwt_required()
@min_role_required("SUPER_ADMIN")
def list_users():
    users = UserService.get_all_users()
    return jsonify(
        {
            "users": [
                {
                    "id": str(user.id),
                    "name": user.name,
                    "email": user.email,
                    "role": user.role,
                    # USER: canonical tehsils implied by assigned water systems; ADMIN+: user_tehsils
                    "tehsils": user.assigned_tehsils,
                    "water_system_ids": user.assigned_water_system_ids,
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                }
                for user in users
            ]
        }
    ), 200


@users_bp.route("/onboard-operator", methods=["POST"])
@jwt_required()
@min_role_required("ADMIN")
def onboard_operator():
    try:
        payload = validate_onboard_operator_payload(request.get_json())
    except ValidationError as exc:
        return jsonify({"message": str(exc)}), 400

    actor = UserService.get_user_by_id(get_jwt_identity())
    if not actor:
        return jsonify({"message": "User not found"}), 404

    try:
        user = UserService.create_tubewell_operator(
            name=payload["name"],
            email=payload["email"],
            password=payload["password"],
            water_system_ids=payload["water_system_ids"],
            actor=actor,
        )
    except TehsilAccessDenied as exc:
        return jsonify({"message": str(exc)}), 403
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    return (
        jsonify(
            {
                "message": "Tubewell operator created",
                "user": {
                    "id": str(user.id),
                    "name": user.name,
                    "email": user.email,
                    "role": user.role,
                    "tehsils": user.assigned_tehsils,
                    "water_system_ids": user.assigned_water_system_ids,
                },
            }
        ),
        201,
    )
