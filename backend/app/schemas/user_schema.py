class ValidationError(ValueError):
    pass


def validate_onboard_operator_payload(data: dict) -> dict:
    """
    Tubewell operator onboarding: tehsil managers pass water_system_ids only.
    Operators are not given standalone tehsil rows; tehsils in API responses are derived from those systems.
    """
    if not data:
        raise ValidationError("Request body is required")

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name:
        raise ValidationError("name is required")
    if not email:
        raise ValidationError("email is required")
    if "@" not in email:
        raise ValidationError("email is invalid")
    if not password:
        raise ValidationError("password is required")

    raw_ids = data.get("water_system_ids")
    if raw_ids is None:
        raise ValidationError(
            "water_system_ids is required (non-empty array of registered water system IDs)"
        )
    if not isinstance(raw_ids, list) or len(raw_ids) < 1:
        raise ValidationError("water_system_ids must be a non-empty array")

    water_system_ids = []
    seen: set[str] = set()
    for x in raw_ids:
        sid = str(x).strip() if x is not None else ""
        if not sid or sid in seen:
            continue
        seen.add(sid)
        water_system_ids.append(sid)

    if len(water_system_ids) < 1:
        raise ValidationError("At least one water_system_id is required")

    return {
        "name": name,
        "email": email,
        "password": password,
        "water_system_ids": water_system_ids,
    }


def validate_login_payload(data: dict) -> dict:
    if not data:
        raise ValidationError("Request body is required")

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email:
        raise ValidationError("email is required")
    if not password:
        raise ValidationError("password is required")

    return {
        "email": email,
        "password": password,
    }


def validate_change_password_payload(data: dict) -> dict:
    if not data:
        raise ValidationError("Request body is required")

    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    if not current_password:
        raise ValidationError("current_password is required")
    if not new_password:
        raise ValidationError("new_password is required")

    return {
        "current_password": current_password,
        "new_password": new_password,
    }


def validate_forgot_password_payload(data: dict) -> dict:
    if not data:
        raise ValidationError("Request body is required")

    email = (data.get("email") or "").strip().lower()
    if not email:
        raise ValidationError("email is required")
    if "@" not in email:
        raise ValidationError("email is invalid")

    return {"email": email}


def validate_reset_password_payload(data: dict) -> dict:
    if not data:
        raise ValidationError("Request body is required")

    token = (data.get("token") or "").strip()
    new_password = data.get("new_password") or ""

    if not token:
        raise ValidationError("token is required")
    if not new_password:
        raise ValidationError("new_password is required")

    return {"token": token, "new_password": new_password}
