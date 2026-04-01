import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from app.schemas.user_schema import (
    ValidationError,
    validate_change_password_payload,
    validate_forgot_password_payload,
    validate_login_payload,
    validate_reset_password_payload,
)
from app.services import AuthService, UserService
from app.services.email_service import send_password_reset_email

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["POST"])
def login():
    try:
        payload = validate_login_payload(request.get_json())
    except ValidationError as exc:
        return jsonify({"message": str(exc)}), 400

    user = AuthService.authenticate(payload["email"], payload["password"])
    if user:
        user = UserService.get_user_by_id(str(user.id)) or user
        expires = datetime.timedelta(hours=24)
        rank = user.assigned_role.hierarchy_rank if user.assigned_role else 1
        tehsils = user.assigned_tehsils
        water_system_ids = user.assigned_water_system_ids
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims={
                "role": user.role,
                "name": user.name,
                "tehsils": tehsils,
                "water_system_ids": water_system_ids,
                "hierarchy_rank": rank,
            },
            expires_delta=expires,
        )
        return jsonify(
            {
                "token": access_token,
                "user": {
                    "id": str(user.id),
                    "name": user.name,
                    "role": user.role,
                    "tehsils": tehsils,
                    "water_system_ids": water_system_ids,
                },
            }
        ), 200
    return jsonify({"message": "Invalid email or password"}), 401


@auth_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    """Authenticated user updates password (requires current password)."""
    try:
        payload = validate_change_password_payload(request.get_json())
    except ValidationError as exc:
        return jsonify({"message": str(exc)}), 400

    user_id = get_jwt_identity()
    user = UserService.get_user_by_id(user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404

    try:
        AuthService.change_password(
            user,
            payload["current_password"],
            payload["new_password"],
        )
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    return jsonify({"message": "Password updated successfully"}), 200


@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    """
    Request a password reset. Response is always the same whether the email exists.
    If MAIL_SERVER is set, sends email. If DEBUG and PASSWORD_RESET_DEV_RETURN_TOKEN, includes token.
    """
    try:
        payload = validate_forgot_password_payload(request.get_json())
    except ValidationError as exc:
        return jsonify({"message": str(exc)}), 400

    user, raw_token = AuthService.request_password_reset(payload["email"])

    if user and raw_token:
        try:
            if send_password_reset_email(current_app, user.email, raw_token):
                current_app.logger.info("Password reset email sent to %s", user.email)
        except OSError as exc:
            current_app.logger.exception("Failed to send password reset email: %s", exc)
            # Do not reveal delivery failure to anonymous clients
        except Exception as exc:  # noqa: BLE001 — SMTP errors vary
            current_app.logger.exception("Failed to send password reset email: %s", exc)

    msg = (
        "If an account exists for that email, you will receive password reset "
        "instructions shortly."
    )
    body: dict = {"message": msg}
    if (
        current_app.debug
        and current_app.config.get("PASSWORD_RESET_DEV_RETURN_TOKEN")
        and user
        and raw_token
    ):
        body["reset_token"] = raw_token

    return jsonify(body), 200


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    """Complete reset using token from forgot-password (email or dev response)."""
    try:
        payload = validate_reset_password_payload(request.get_json())
    except ValidationError as exc:
        return jsonify({"message": str(exc)}), 400

    try:
        AuthService.reset_password_with_token(
            payload["token"],
            payload["new_password"],
        )
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    return jsonify({"message": "Password has been reset. You can sign in now."}), 200


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
            "tehsils": user.assigned_tehsils,
            "water_system_ids": user.assigned_water_system_ids,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
    ), 200
