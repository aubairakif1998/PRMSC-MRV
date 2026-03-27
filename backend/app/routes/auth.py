import datetime
from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from app.extensions import db
from app.schemas.user_schema import (
    ValidationError,
    validate_login_payload,
    validate_registration_payload,
)
from app.services import AuthService, UserService

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
def register():
    try:
        payload = validate_registration_payload(request.get_json())
        AuthService.register_user(
            name=payload["name"],
            email=payload["email"],
            password=payload["password"],
            role=payload["role"],
        )
        return jsonify({"message": "Successfully registered. You can now login."}), 201
    except ValidationError as exc:
        return jsonify({"message": str(exc)}), 400
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 409
    except Exception as exc:
        db.session.rollback()
        return jsonify({"message": "Registration failed. Please try again", "error": str(exc)}), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    try:
        payload = validate_login_payload(request.get_json())
    except ValidationError as exc:
        return jsonify({"message": str(exc)}), 400

    user = AuthService.authenticate(payload["email"], payload["password"])
    if user:
        expires = datetime.timedelta(hours=24)
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims={"role": user.role, "name": user.name},
            expires_delta=expires,
        )
        return jsonify(
            {
                "token": access_token,
                "user": {
                    "id": str(user.id),
                    "name": user.name,
                    "role": user.role,
                },
            }
        ), 200
    return jsonify({"message": "Invalid email or password"}), 401


@auth_bp.route("/profile", methods=["GET"])
@jwt_required()
def profile():
    current_user_id = get_jwt_identity()
    user = UserService.get_user_by_id(current_user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404

    return jsonify(
        {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
    ), 200
