"""Shared parsing / lookup helpers for operator (tehsil + tubewell) routes."""

from datetime import datetime

from sqlalchemy import or_

from app.models.models import SolarSystem


def parse_date(date_str):
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except Exception:
        return None


ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "pdf"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def find_solar_system_by_location(
    tehsil_canonical: str, village: str, settlement_raw: str | None
):
    if not village:
        return None
    st = (settlement_raw or "").strip()
    if st:
        return SolarSystem.query.filter_by(
            tehsil=tehsil_canonical, village=village, settlement=st
        ).first()
    return (
        SolarSystem.query.filter_by(tehsil=tehsil_canonical, village=village)
        .filter(or_(SolarSystem.settlement.is_(None), SolarSystem.settlement == ""))
        .first()
    )


def coerce_optional_float(val):
    if val is None or val == "":
        return None
    if isinstance(val, bool):
        raise ValueError(f"Invalid numeric value: {val!r}")
    if isinstance(val, (int, float)):
        return float(val)
    try:
        return float(str(val).strip())
    except ValueError:
        raise ValueError(f"Invalid numeric value: {val!r}")
