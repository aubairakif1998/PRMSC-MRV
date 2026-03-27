from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt, jwt_required

from app.services import UserService

users_bp = Blueprint("users", __name__)


@users_bp.route("/", methods=["GET"])
@jwt_required()
def list_users():
    claims = get_jwt()
    role = claims.get("role")
    if role not in {"analyst", "environment_manager", "operations_department"}:
        return jsonify({"message": "Access Forbidden: Insufficient permissions"}), 403

    users = UserService.get_all_users()
    return jsonify(
        {
            "users": [
                {
                    "id": str(user.id),
                    "name": user.name,
                    "email": user.email,
                    "role": user.role,
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                }
                for user in users
            ]
        }
    ), 200

