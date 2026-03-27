class ValidationError(ValueError):
    pass


def validate_registration_payload(data: dict) -> dict:
    if not data:
        raise ValidationError("Request body is required")

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role = (data.get("role") or "operator").strip()

    if not name:
        raise ValidationError("name is required")
    if not email:
        raise ValidationError("email is required")
    if "@" not in email:
        raise ValidationError("email is invalid")
    if not password:
        raise ValidationError("password is required")

    return {
        "name": name,
        "email": email,
        "password": password,
        "role": role,
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

