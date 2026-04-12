from flask import Blueprint, request, jsonify, current_app
from app.extensions import db
from sqlalchemy import extract

from app.constants.tehsils import canonical_tehsil
from app.models.models import (
    WaterSystem,
    WaterEnergyLoggingDaily,
    SolarSystem,
    SolarEnergyLoggingMonthly,
    Notification,
    User,
    UserWaterSystem,
    Submission,
    VerificationLog,
    SUBMISSION_STATUS_DRAFTED,
    SUBMISSION_STATUS_SUBMITTED,
    SUBMISSION_STATUS_ACCEPTED,
    SUBMISSION_STATUS_REJECTED,
    SUBMISSION_STATUS_REVERTED_BACK,
)
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.utils.decorators import min_role_required
from app.rbac import (
    ADMIN,
    SUPER_ADMIN,
    SYSTEM_ADMIN,
    ROLE_RANK,
    user_rank,
    user_assigned_tehsils,
    user_can_view_submission_detail,
    can_access_tehsil,
    submission_tehsil,
    user_can_verify_submission,
    user_role_code,
)
from app.utils.water_submission_detail import build_water_submission_detail_response
from app.utils.operator_helpers import (
    ALLOWED_EXTENSIONS,
    allowed_file,
    coerce_optional_float as _coerce_optional_float,
    find_solar_system_by_location,
    parse_date,
)
from app.services import UserService, StorageService
from app.utils.workflow_helpers import log_verification_action, notify_operator
from app.utils.in_app_notifications import (
    get_notifications_response,
    mark_all_notifications_read_response,
    mark_notification_read_response,
)
from app.utils.in_app_notifications import (
    get_notifications_response,
    mark_all_notifications_read_response,
    mark_notification_read_response,
)
from app.utils.pump_times import apply_pump_time_fields_from_payload, time_to_json
from app.services.tehsil_access import (
    TehsilAccessDenied,
    assert_user_may_access_tehsil,
    assert_user_may_access_water_system,
    assert_user_may_log_water_system,
    assert_user_may_view_or_log_water_system,
    assert_user_may_access_solar_system,
)
from datetime import date, datetime

tehsil_manager_bp = Blueprint("tehsil_manager", __name__)


@tehsil_manager_bp.route("/logging-compliance", methods=["GET"])
@jwt_required()
@min_role_required("ADMIN")
def get_logging_compliance():
    """
    Tehsil manager: per water system, whether a tubewell daily log exists for `water_date`
    and its workflow status; per solar site, whether a monthly grid log exists for `solar_year`/`solar_month`.
    Scoped to the user's tehsils (or all systems for SUPER_ADMIN+).
    """
    user = UserService.get_user_by_id(get_jwt_identity())
    if not user:
        return jsonify({"message": "User not found"}), 404

    rk = user_rank(user)
    ts = list(user_assigned_tehsils(user))

    water_date_s = request.args.get("water_date")
    solar_year = request.args.get("solar_year", type=int)
    solar_month = request.args.get("solar_month", type=int)

    today = date.today()
    try:
        if water_date_s:
            water_day = datetime.strptime(water_date_s, "%Y-%m-%d").date()
        else:
            water_day = today
    except ValueError:
        return jsonify({"message": "Invalid water_date; use YYYY-MM-DD"}), 400

    if solar_year is None:
        solar_year = today.year
    if solar_month is None:
        solar_month = today.month
    if solar_month < 1 or solar_month > 12:
        return jsonify({"message": "solar_month must be 1–12"}), 400

    if rk >= ROLE_RANK[SUPER_ADMIN]:
        water_q = WaterSystem.query
        solar_q = SolarSystem.query
    elif ts:
        water_q = WaterSystem.query.filter(WaterSystem.tehsil.in_(ts))
        solar_q = SolarSystem.query.filter(SolarSystem.tehsil.in_(ts))
    else:
        return jsonify(
            {
                "water_date": water_day.isoformat(),
                "solar_year": solar_year,
                "solar_month": solar_month,
                "water_systems": [],
                "solar_systems": [],
            }
        ), 200

    water_systems = water_q.order_by(
        WaterSystem.tehsil, WaterSystem.village, WaterSystem.unique_identifier
    ).all()
    solar_systems = solar_q.order_by(
        SolarSystem.tehsil, SolarSystem.village, SolarSystem.unique_identifier
    ).all()

    ws_ids = [ws.id for ws in water_systems]
    operators_by_water_id: dict[str, list[dict]] = {str(wid): [] for wid in ws_ids}
    if ws_ids:
        op_rows = (
            db.session.query(UserWaterSystem, User)
            .join(User, UserWaterSystem.user_id == User.id)
            .filter(UserWaterSystem.water_system_id.in_(ws_ids))
            .order_by(User.name.asc())
            .all()
        )
        for _uws, op in op_rows:
            wid = str(_uws.water_system_id)
            operators_by_water_id.setdefault(wid, []).append(
                {
                    "id": str(op.id),
                    "name": op.name,
                    "email": op.email,
                    "phone": op.phone or None,
                }
            )

    out_water = []
    for ws in water_systems:
        rec = WaterEnergyLoggingDaily.query.filter_by(
            water_system_id=ws.id,
            log_date=water_day,
        ).first()
        if not rec:
            bucket = "missing"
        elif rec.status == SUBMISSION_STATUS_DRAFTED:
            bucket = "draft"
        elif rec.status == SUBMISSION_STATUS_SUBMITTED:
            bucket = "submitted"
        elif rec.status == SUBMISSION_STATUS_ACCEPTED:
            bucket = "accepted"
        elif rec.status == SUBMISSION_STATUS_REJECTED:
            bucket = "rejected"
        elif rec.status == SUBMISSION_STATUS_REVERTED_BACK:
            bucket = "reverted_back"
        else:
            bucket = rec.status or "unknown"

        out_water.append(
            {
                "id": str(ws.id),
                "tehsil": ws.tehsil,
                "village": ws.village,
                "settlement": ws.settlement,
                "unique_identifier": ws.unique_identifier,
                "assigned_operators": operators_by_water_id.get(str(ws.id), []),
                "daily_status": bucket,
                "daily_log": None
                if not rec
                else {
                    "record_id": str(rec.id),
                    "status": rec.status,
                },
            }
        )

    out_solar = []
    for ss in solar_systems:
        mrec = SolarEnergyLoggingMonthly.query.filter_by(
            solar_system_id=ss.id,
            year=solar_year,
            month=solar_month,
        ).first()
        out_solar.append(
            {
                "id": str(ss.id),
                "tehsil": ss.tehsil,
                "village": ss.village,
                "settlement": ss.settlement,
                "unique_identifier": ss.unique_identifier,
                "monthly_status": "missing" if not mrec else "logged",
                "monthly_log": None
                if not mrec
                else {
                    "record_id": str(mrec.id),
                    "has_data": True,
                },
            }
        )

    return jsonify(
        {
            "water_date": water_day.isoformat(),
            "solar_year": solar_year,
            "solar_month": solar_month,
            "water_systems": out_water,
            "solar_systems": out_solar,
        }
    ), 200


def _coerce_optional_str(val):
    if val is None:
        return None
    s = str(val).strip()
    return s if s != "" else None


@tehsil_manager_bp.route("/tehsil-manager/submission/<submission_id>", methods=["GET"])
@jwt_required()
@min_role_required("ADMIN")
def get_tehsil_manager_water_submission_detail(submission_id):
    """Tehsil manager / operations: detail for a water submission in an accessible tehsil."""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    if not current_user:
        return jsonify({"error": "User not found"}), 404

    submission = Submission.query.get(submission_id)
    if not submission:
        return jsonify({"error": "Submission not found"}), 404
    if submission.submission_type != "water_system":
        return jsonify({"error": "Only water submissions are supported"}), 400

    if not user_can_view_submission_detail(
        current_user, submission, str(current_user_id)
    ):
        return jsonify({"error": "Access denied"}), 403

    return jsonify(build_water_submission_detail_response(submission))


@tehsil_manager_bp.route('/water-system', methods=['POST'])
@jwt_required()
@min_role_required('ADMIN')
def add_water_system():
    data = request.get_json()
    user = UserService.get_user_by_id(get_jwt_identity())
    if not user:
        return jsonify({"message": "User not found"}), 404

    tehsil_raw = data.get('tehsil')
    ct = canonical_tehsil(tehsil_raw)
    if not ct:
        return jsonify({"message": "Invalid or unknown tehsil"}), 400
    try:
        assert_user_may_access_tehsil(user, ct, for_write=True)
    except TehsilAccessDenied:
        return jsonify({"message": "You cannot manage water systems in this tehsil"}), 403

    village = data.get('village')
    settlement = data.get('settlement', '')

    query = WaterSystem.query.filter_by(tehsil=ct, village=village)
    if settlement:
        query = query.filter_by(settlement=settlement)

    existing_system = query.first()

    if existing_system:
        try:
            assert_user_may_access_tehsil(user, existing_system.tehsil, for_write=True)
        except TehsilAccessDenied:
            return jsonify({"message": "You cannot manage water systems in this tehsil"}), 403
        # Update existing system
        existing_system.pump_model = _coerce_optional_str(data.get("pump_model"))
        existing_system.pump_serial_number = _coerce_optional_str(
            data.get("pump_serial_number")
        )
        existing_system.start_of_operation = parse_date(data.get('start_of_operation'))
        try:
            if "latitude" in data:
                existing_system.latitude = _coerce_optional_float(data.get("latitude"))
            if "longitude" in data:
                existing_system.longitude = _coerce_optional_float(data.get("longitude"))
        except ValueError as exc:
            return jsonify({"message": str(exc)}), 400
        # Coerce numeric fields (treat "" as NULL)
        try:
            existing_system.depth_of_water_intake = _coerce_optional_float(
                data.get("depth_of_water_intake")
            )
            existing_system.height_to_ohr = _coerce_optional_float(
                data.get("height_to_ohr")
            )
            existing_system.pump_flow_rate = _coerce_optional_float(
                data.get("pump_flow_rate")
            )
        except ValueError as exc:
            return jsonify({"message": str(exc)}), 400
        existing_system.meter_model = _coerce_optional_str(data.get("meter_model"))
        existing_system.meter_serial_number = _coerce_optional_str(
            data.get("meter_serial_number")
        )
        existing_system.meter_accuracy_class = _coerce_optional_str(
            data.get("meter_accuracy_class")
        )
        existing_system.calibration_requirement = _coerce_optional_str(
            data.get("calibration_requirement")
        )
        existing_system.installation_date = parse_date(data.get('installation_date'))
        
        try:
            db.session.commit()
            return jsonify({"message": "Water system updated successfully", "id": str(existing_system.id)}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"message": "Error updating system", "error": str(e)}), 500
    
    # Generate unique_identifier if not provided
    unique_id = data.get('unique_identifier')
    if not unique_id:
        # Create a unique ID using UUID to avoid collisions
        import uuid
        unique_id = f"WS-{ct[:3].upper()}-{village[:3].upper()}-{settlement[:3].upper() if settlement else 'XXX'}-{str(uuid.uuid4())[:8]}"

    # Helper function to convert empty strings to None for numeric fields
    def to_float_or_none(value):
        if value is None or value == '':
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None

    new_system = WaterSystem(
        tehsil=ct,
        village=village,
        settlement=settlement,
        unique_identifier=unique_id,
        latitude=to_float_or_none(data.get("latitude")),
        longitude=to_float_or_none(data.get("longitude")),
        pump_model=data.get('pump_model'),
        pump_serial_number=data.get('pump_serial_number'),
        start_of_operation=parse_date(data.get('start_of_operation')),
        depth_of_water_intake=to_float_or_none(data.get('depth_of_water_intake')),
        height_to_ohr=to_float_or_none(data.get('height_to_ohr')),
        pump_flow_rate=to_float_or_none(data.get('pump_flow_rate')),
        meter_model=data.get('meter_model'),
        meter_serial_number=data.get('meter_serial_number'),
        meter_accuracy_class=data.get('meter_accuracy_class'),
        calibration_requirement=data.get('calibration_requirement'),
        installation_date=parse_date(data.get('installation_date')),
        created_by=get_jwt_identity()
    )
    db.session.add(new_system)
    db.session.commit()
    return jsonify({"message": "Water system added successfully", "id": str(new_system.id)}), 201



@tehsil_manager_bp.route('/solar-system', methods=['POST'])
@jwt_required()
@min_role_required('ADMIN')
def add_solar_system():
    data = request.get_json()
    user = UserService.get_user_by_id(get_jwt_identity())
    if not user:
        return jsonify({"message": "User not found"}), 404

    tehsil_raw = data.get('tehsil')
    ct = canonical_tehsil(tehsil_raw)
    if not ct:
        return jsonify({"message": "Invalid or unknown tehsil"}), 400
    try:
        assert_user_may_access_tehsil(user, ct, for_write=True)
    except TehsilAccessDenied:
        return jsonify({"message": "You cannot manage solar systems in this tehsil"}), 403

    village = data.get('village')
    if not village:
        return jsonify({"message": "village is required"}), 400

    settlement_raw = (data.get("settlement") or "").strip()
    settlement_db = settlement_raw if settlement_raw else None

    existing_system = find_solar_system_by_location(ct, village, settlement_raw)

    if existing_system:
        try:
            assert_user_may_access_tehsil(user, existing_system.tehsil, for_write=True)
        except TehsilAccessDenied:
            return jsonify({"message": "You cannot manage solar systems in this tehsil"}), 403
        # Update existing system (coerce all fields; treat "" as NULL)
        existing_system.installation_location = _coerce_optional_str(
            data.get("installation_location")
        )
        try:
            if "latitude" in data:
                existing_system.latitude = _coerce_optional_float(data.get("latitude"))
            if "longitude" in data:
                existing_system.longitude = _coerce_optional_float(data.get("longitude"))
            existing_system.solar_panel_capacity = _coerce_optional_float(
                data.get("solar_panel_capacity")
            )
            existing_system.inverter_capacity = _coerce_optional_float(
                data.get("inverter_capacity")
            )
        except ValueError as exc:
            return jsonify({"message": str(exc)}), 400
        existing_system.inverter_serial_number = _coerce_optional_str(
            data.get("inverter_serial_number")
        )
        existing_system.installation_date = parse_date(data.get("installation_date"))
        existing_system.meter_model = _coerce_optional_str(data.get("meter_model"))
        existing_system.meter_serial_number = _coerce_optional_str(
            data.get("meter_serial_number")
        )
        existing_system.green_meter_connection_date = parse_date(
            data.get("green_meter_connection_date")
        )
        existing_system.remarks = _coerce_optional_str(data.get("remarks"))
        
        try:
            db.session.commit()
            return jsonify({"message": "Solar system updated successfully", "id": str(existing_system.id)}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"message": "Error updating system", "error": str(e)}), 500
    
    # Generate unique_identifier if not provided
    unique_id = data.get('unique_identifier')
    if not unique_id:
        # Create a unique ID using UUID to avoid collisions
        import uuid
        unique_id = f"SS-{ct[:3].upper()}-{village[:3].upper()}-{settlement_raw[:3].upper() if settlement_raw else 'XXX'}-{str(uuid.uuid4())[:8]}"

    new_system = SolarSystem(
        tehsil=ct,
        village=village,
        settlement=settlement_db,
        unique_identifier=unique_id,
        latitude=_coerce_optional_float(data.get("latitude")),
        longitude=_coerce_optional_float(data.get("longitude")),
        installation_location=data.get('installation_location'),
        solar_panel_capacity=data.get('solar_panel_capacity'),
        inverter_capacity=data.get('inverter_capacity'),
        inverter_serial_number=data.get('inverter_serial_number'),
        installation_date=parse_date(data.get('installation_date')),
        meter_model=data.get('meter_model'),
        meter_serial_number=data.get('meter_serial_number'),
        green_meter_connection_date=parse_date(data.get('green_meter_connection_date')),
        remarks=data.get('remarks'),
        created_by=get_jwt_identity()
    )
    db.session.add(new_system)
    db.session.commit()
    return jsonify({"message": "Solar system added successfully", "id": str(new_system.id)}), 201

# --- Solar Monthly Data ---



@tehsil_manager_bp.route('/solar-data', methods=['POST'])
@jwt_required()
@min_role_required('ADMIN')
def submit_solar_data():
    data = request.get_json()
    user = UserService.get_user_by_id(get_jwt_identity())
    ss = SolarSystem.query.get(data.get('solar_system_id'))
    try:
        assert_user_may_access_solar_system(user, ss, for_write=True)
    except TehsilAccessDenied:
        return jsonify({"message": "Access denied for this solar system"}), 403
    new_record = SolarEnergyLoggingMonthly(
        solar_system_id=data.get('solar_system_id'),
        year=data.get('year'),
        month=data.get('month'),
        energy_consumed_from_grid=data.get('energy_consumed_from_grid'),
        energy_exported_to_grid=data.get('energy_exported_to_grid'),
    )
    db.session.add(new_record)
    db.session.commit()
    return jsonify({"message": "Solar data saved successfully", "id": str(new_record.id)}), 201

# --- File Upload API ---
# Why multipart/form-data?
#   Regular JSON cannot carry binary file data (images, PDFs).
#   The browser sends the file as raw bytes using multipart/form-data format.
#   Flask reads the file from request.files['file']

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS






@tehsil_manager_bp.route('/water-system/<system_id>', methods=['PUT'])
@jwt_required()
@min_role_required('ADMIN')
def update_water_system(system_id):
    """Update a registered water system (tehsil manager — same scope as POST upsert)."""
    data = request.get_json() or {}
    user = UserService.get_user_by_id(get_jwt_identity())
    system = WaterSystem.query.get(system_id)
    if not system:
        return jsonify({"message": "Water system not found"}), 404
    try:
        assert_user_may_access_water_system(user, system, for_write=True)
    except TehsilAccessDenied:
        return jsonify({"message": "Access denied for this water system"}), 403

    if "tehsil" in data:
        ct_new = canonical_tehsil(data.get("tehsil"))
        if not ct_new or ct_new != system.tehsil:
            return jsonify({"message": "Cannot change tehsil on an existing water system"}), 400
    if "village" in data and str(data.get("village") or "").strip() != str(
        system.village
    ).strip():
        return jsonify({"message": "Cannot change village on an existing water system"}), 400
    if "settlement" in data:
        incoming = (data.get("settlement") or "").strip() or None
        current = (system.settlement or "").strip() or None
        if incoming != current:
            return jsonify({"message": "Cannot change settlement on an existing water system"}), 400

    if "pump_model" in data:
        system.pump_model = _coerce_optional_str(data.get("pump_model"))
    if "pump_serial_number" in data:
        system.pump_serial_number = _coerce_optional_str(data.get("pump_serial_number"))
    if "start_of_operation" in data:
        system.start_of_operation = parse_date(data.get("start_of_operation"))
    try:
        if "latitude" in data:
            system.latitude = _coerce_optional_float(data.get("latitude"))
        if "longitude" in data:
            system.longitude = _coerce_optional_float(data.get("longitude"))
        if "depth_of_water_intake" in data:
            system.depth_of_water_intake = _coerce_optional_float(
                data.get("depth_of_water_intake")
            )
        if "height_to_ohr" in data:
            system.height_to_ohr = _coerce_optional_float(data.get("height_to_ohr"))
        if "pump_flow_rate" in data:
            system.pump_flow_rate = _coerce_optional_float(data.get("pump_flow_rate"))
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    if "meter_model" in data:
        system.meter_model = _coerce_optional_str(data.get("meter_model"))
    if "meter_serial_number" in data:
        system.meter_serial_number = _coerce_optional_str(data.get("meter_serial_number"))
    if "meter_accuracy_class" in data:
        system.meter_accuracy_class = _coerce_optional_str(data.get("meter_accuracy_class"))
    if "calibration_requirement" in data:
        system.calibration_requirement = _coerce_optional_str(
            data.get("calibration_requirement")
        )
    if "installation_date" in data:
        system.installation_date = parse_date(data.get("installation_date"))

    try:
        db.session.commit()
        return jsonify(
            {
                "message": "Water system updated successfully",
                "id": str(system.id),
                "updated_at": system.updated_at.isoformat() if system.updated_at else None,
            }
        ), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error updating system", "error": str(e)}), 500




@tehsil_manager_bp.route("/water-system/<system_id>", methods=["GET"])
@jwt_required()
@min_role_required("ADMIN")
def get_water_system(system_id):
    """Get a registered water system by id (tehsil-scoped)."""
    user = UserService.get_user_by_id(get_jwt_identity())
    system = WaterSystem.query.get(system_id)
    if not system:
        return jsonify({"message": "Water system not found"}), 404
    try:
        assert_user_may_access_water_system(user, system)
    except TehsilAccessDenied:
        return jsonify({"message": "Access denied for this water system"}), 403

    return (
        jsonify(
            {
                "id": str(system.id),
                "tehsil": system.tehsil,
                "village": system.village,
                "settlement": system.settlement or "",
                "unique_identifier": system.unique_identifier,
                "latitude": system.latitude,
                "longitude": system.longitude,
                "pump_model": system.pump_model,
                "pump_serial_number": system.pump_serial_number,
                "start_of_operation": system.start_of_operation.isoformat()
                if system.start_of_operation
                else None,
                "depth_of_water_intake": system.depth_of_water_intake,
                "height_to_ohr": system.height_to_ohr,
                "pump_flow_rate": system.pump_flow_rate,
                "meter_model": system.meter_model,
                "meter_serial_number": system.meter_serial_number,
                "meter_accuracy_class": system.meter_accuracy_class,
                "calibration_requirement": system.calibration_requirement,
                "installation_date": system.installation_date.isoformat()
                if system.installation_date
                else None,
                "created_by": system.created_by,
                "created_at": system.created_at.isoformat() if system.created_at else None,
                "updated_at": system.updated_at.isoformat() if system.updated_at else None,
            }
        ),
        200,
    )


@tehsil_manager_bp.route('/water-system/<system_id>', methods=['DELETE'])
@jwt_required()
@min_role_required('ADMIN')
def delete_water_system(system_id):
    """Delete a water system and all its associated data (tehsil managers only)."""
    user = UserService.get_user_by_id(get_jwt_identity())
    system = WaterSystem.query.filter_by(id=system_id).first()
    if not system:
        return jsonify({"message": "Water system not found"}), 404
    try:
        assert_user_may_access_water_system(user, system, for_write=True)
    except TehsilAccessDenied:
        return jsonify({"message": "Access denied for this water system"}), 403

    # Delete associated monthly water data first
    WaterEnergyLoggingDaily.query.filter_by(water_system_id=system_id).delete()
    
    db.session.delete(system)
    db.session.commit()
    
    return jsonify({"message": "Water system deleted successfully"}), 200




@tehsil_manager_bp.route('/solar-systems', methods=['GET'])
@jwt_required()
@min_role_required('ADMIN')
def get_solar_systems():
    """Tehsil managers (write) and program roles (read-all) — solar site registry.

    Optional query params (same semantics as /dashboard/*): tehsil, village —
    omit or use 'All Tehsils' / 'All Villages' for no filter.
    """
    current_user_id = get_jwt_identity()
    user = UserService.get_user_by_id(current_user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404
    rk = user_rank(user)
    ts = list(user_assigned_tehsils(user))
    filter_tehsil = request.args.get("tehsil")
    filter_village = request.args.get("village")

    if rk >= ROLE_RANK[SUPER_ADMIN]:
        q = SolarSystem.query
    elif ts:
        q = SolarSystem.query.filter(SolarSystem.tehsil.in_(ts))
    else:
        return jsonify([]), 200

    if filter_tehsil and filter_tehsil != "All Tehsils":
        q = q.filter(SolarSystem.tehsil == filter_tehsil)
    if filter_village and filter_village != "All Villages":
        q = q.filter(SolarSystem.village == filter_village)

    systems = q.all()
    return jsonify(
        [
            {
                "id": str(s.id),
                "tehsil": s.tehsil,
                "village": s.village,
                "settlement": s.settlement,
                "unique_identifier": s.unique_identifier,
                "latitude": s.latitude,
                "longitude": s.longitude,
                "installation_location": s.installation_location,
                "solar_panel_capacity": s.solar_panel_capacity,
                "inverter_capacity": s.inverter_capacity,
                "inverter_serial_number": s.inverter_serial_number,
                "installation_date": s.installation_date.isoformat()
                if s.installation_date
                else None,
                "meter_model": s.meter_model,
                "meter_serial_number": s.meter_serial_number,
                "green_meter_connection_date": s.green_meter_connection_date.isoformat()
                if s.green_meter_connection_date
                else None,
                "remarks": s.remarks,
                "created_by": s.created_by,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
                "monthly_log_count": SolarEnergyLoggingMonthly.query.filter_by(
                    solar_system_id=s.id
                ).count(),
            }
            for s in systems
        ]
    ), 200




@tehsil_manager_bp.route('/solar-system/<system_id>', methods=['DELETE'])
@jwt_required()
@min_role_required('ADMIN')
def delete_solar_system(system_id):
    """Delete a solar system and all its associated data (tehsil managers only)."""
    user = UserService.get_user_by_id(get_jwt_identity())
    system = SolarSystem.query.filter_by(id=system_id).first()
    if not system:
        return jsonify({"message": "Solar system not found"}), 404
    try:
        assert_user_may_access_solar_system(user, system, for_write=True)
    except TehsilAccessDenied:
        return jsonify({"message": "Access denied for this solar system"}), 403

    log_count = SolarEnergyLoggingMonthly.query.filter_by(
        solar_system_id=system_id
    ).count()
    if log_count > 0:
        return (
            jsonify(
                {
                    "message": (
                        "This solar site has monthly energy submissions and cannot be deleted. "
                        "Remove those monthly records first if your process allows it, or contact operations."
                    ),
                }
            ),
            409,
        )

    db.session.delete(system)
    db.session.commit()

    return jsonify({"message": "Solar system deleted successfully"}), 200




@tehsil_manager_bp.route('/solar-system/<system_id>', methods=['GET'])
@jwt_required()
@min_role_required('ADMIN')
def get_solar_system(system_id):
    user = UserService.get_user_by_id(get_jwt_identity())
    system = SolarSystem.query.filter_by(id=system_id).first()
    if not system:
        return jsonify({"message": "Solar system not found"}), 404
    try:
        assert_user_may_access_solar_system(user, system)
    except TehsilAccessDenied:
        return jsonify({"message": "Access denied for this solar system"}), 403

    return (
        jsonify(
            {
                "id": str(system.id),
                "tehsil": system.tehsil,
                "village": system.village,
                "settlement": system.settlement or "",
                "unique_identifier": system.unique_identifier,
                "latitude": system.latitude,
                "longitude": system.longitude,
                "installation_location": system.installation_location,
                "solar_panel_capacity": system.solar_panel_capacity,
                "inverter_capacity": system.inverter_capacity,
                "inverter_serial_number": system.inverter_serial_number,
                "installation_date": system.installation_date.isoformat()
                if system.installation_date
                else None,
                "meter_model": system.meter_model,
                "meter_serial_number": system.meter_serial_number,
                "green_meter_connection_date": system.green_meter_connection_date.isoformat()
                if system.green_meter_connection_date
                else None,
                "remarks": system.remarks,
                "created_at": system.created_at.isoformat() if system.created_at else None,
                "updated_at": system.updated_at.isoformat() if system.updated_at else None,
                "monthly_log_count": SolarEnergyLoggingMonthly.query.filter_by(
                    solar_system_id=system.id
                ).count(),
            }
        ),
        200,
    )




@tehsil_manager_bp.route('/solar-system/<system_id>', methods=['PUT'])
@jwt_required()
@min_role_required('ADMIN')
def update_solar_system(system_id):
    user = UserService.get_user_by_id(get_jwt_identity())
    system = SolarSystem.query.filter_by(id=system_id).first()
    if not system:
        return jsonify({"message": "Solar system not found"}), 404
    try:
        assert_user_may_access_solar_system(user, system, for_write=True)
    except TehsilAccessDenied:
        return jsonify({"message": "Access denied for this solar system"}), 403

    data = request.get_json() or {}
    if "tehsil" in data:
        ct_new = canonical_tehsil(data.get("tehsil"))
        if not ct_new or ct_new != system.tehsil:
            return jsonify({"message": "Cannot change tehsil on an existing solar site"}), 400
    if "village" in data and str(data.get("village") or "").strip() != str(
        system.village
    ).strip():
        return jsonify({"message": "Cannot change village on an existing solar site"}), 400
    if "settlement" in data:
        incoming = (data.get("settlement") or "").strip() or None
        current = (system.settlement or "").strip() or None
        if incoming != current:
            return jsonify({"message": "Cannot change settlement on an existing solar site"}), 400

    if "installation_location" in data:
        system.installation_location = _coerce_optional_str(
            data.get("installation_location")
        )
    try:
        if "latitude" in data:
            system.latitude = _coerce_optional_float(data.get("latitude"))
        if "longitude" in data:
            system.longitude = _coerce_optional_float(data.get("longitude"))
        if "solar_panel_capacity" in data:
            system.solar_panel_capacity = _coerce_optional_float(
                data.get("solar_panel_capacity")
            )
        if "inverter_capacity" in data:
            system.inverter_capacity = _coerce_optional_float(data.get("inverter_capacity"))
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    if "inverter_serial_number" in data:
        system.inverter_serial_number = _coerce_optional_str(
            data.get("inverter_serial_number")
        )
    if "installation_date" in data:
        system.installation_date = parse_date(data.get("installation_date"))
    if "meter_model" in data:
        system.meter_model = _coerce_optional_str(data.get("meter_model"))
    if "meter_serial_number" in data:
        system.meter_serial_number = _coerce_optional_str(data.get("meter_serial_number"))
    if "green_meter_connection_date" in data:
        system.green_meter_connection_date = parse_date(
            data.get("green_meter_connection_date")
        )
    if "remarks" in data:
        system.remarks = _coerce_optional_str(data.get("remarks"))

    try:
        db.session.commit()
        return (
            jsonify(
                {
                    "message": "Solar system updated successfully",
                    "id": str(system.id),
                    "updated_at": system.updated_at.isoformat()
                    if system.updated_at
                    else None,
                }
            ),
            200,
        )
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error updating system", "error": str(e)}), 500




@tehsil_manager_bp.route('/solar-system-config', methods=['GET'])
@jwt_required()
@min_role_required('ADMIN')
def get_solar_system_config():
    """Get solar system configuration by location for auto-fill."""
    user = UserService.get_user_by_id(get_jwt_identity())
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    settlement = request.args.get('settlement', '')

    if not tehsil or not village:
        return jsonify({"message": "Tehsil and village are required"}), 400

    ct = canonical_tehsil(tehsil)
    if not ct:
        return jsonify({"message": "Invalid tehsil"}), 400
    try:
        assert_user_may_access_tehsil(user, ct)
    except TehsilAccessDenied:
        return jsonify({"message": "Access denied for this tehsil"}), 403

    system = find_solar_system_by_location(ct, village, settlement)

    if system:
        return jsonify({
            "exists": True,
            "config": {
                "id": str(system.id),
                "installation_location": system.installation_location,
                "solar_panel_capacity": system.solar_panel_capacity,
                "inverter_capacity": system.inverter_capacity,
                "inverter_serial_number": system.inverter_serial_number,
                "installation_date": system.installation_date.isoformat() if system.installation_date else None,
                "meter_model": system.meter_model,
                "meter_serial_number": system.meter_serial_number,
                "green_meter_connection_date": system.green_meter_connection_date.isoformat() if system.green_meter_connection_date else None,
                "remarks": system.remarks,
                "created_at": system.created_at.isoformat() if system.created_at else None,
                "updated_at": system.updated_at.isoformat() if system.updated_at else None,
                "monthly_log_count": SolarEnergyLoggingMonthly.query.filter_by(
                    solar_system_id=system.id
                ).count(),
            }
        }), 200
    
    # NO FALLBACK - if no data found, return empty
    return jsonify({"exists": False, "config": None}), 200

# ============================================================
# DRAFT DATA APIs - Save and manage draft entries
# ============================================================







# ============================================================
# MONTHLY WATER SUPPLY DATA APIs (New Form)
# ============================================================



@tehsil_manager_bp.route('/solar-supply-data', methods=['GET'])
@jwt_required()
@min_role_required('ADMIN')
def get_solar_supply_data():
    """
    Get monthly solar energy data by location (tehsil managers / operations — not tubewell operators).
    Query params: tehsil, village, settlement, year
    """
    user = UserService.get_user_by_id(get_jwt_identity())
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    settlement = request.args.get('settlement', '')
    year = request.args.get('year', type=int)

    if not tehsil or not village:
        return jsonify({"message": "Tehsil and village are required"}), 400

    ct = canonical_tehsil(tehsil)
    if not ct:
        return jsonify({"message": "Invalid tehsil"}), 400
    try:
        assert_user_may_access_tehsil(user, ct)
    except TehsilAccessDenied:
        return jsonify({"message": "Access denied for this tehsil"}), 403

    system = find_solar_system_by_location(ct, village, settlement)

    if not system:
        return jsonify([]), 200
    
    # Get monthly data for this system and year
    query = SolarEnergyLoggingMonthly.query.filter_by(solar_system_id=system.id)
    if year:
        query = query.filter_by(year=year)
    
    records = query.order_by(SolarEnergyLoggingMonthly.month).all()

    out = []
    for r in records:
        out.append(
            {
                "id": str(r.id),
                "year": r.year,
                "month": r.month,
                "energy_consumed_from_grid": r.energy_consumed_from_grid,
                "energy_exported_to_grid": r.energy_exported_to_grid,
                "remarks": r.remarks,
                "electricity_bill_image_url": r.electricity_bill_image_url,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
        )
    return jsonify(out), 200




@tehsil_manager_bp.route("/solar-supply-data/record/<record_id>", methods=["GET"])
@jwt_required()
@min_role_required("ADMIN")
def get_solar_supply_data_record(record_id):
    user = UserService.get_user_by_id(get_jwt_identity())
    record = SolarEnergyLoggingMonthly.query.get(record_id)
    if not record:
        return jsonify({"message": "Monthly solar record not found"}), 404
    system = SolarSystem.query.get(record.solar_system_id)
    try:
        assert_user_may_access_solar_system(user, system)
    except TehsilAccessDenied:
        return jsonify({"message": "Access denied for this solar site"}), 403

    return (
        jsonify(
            {
                "id": str(record.id),
                "solar_system_id": str(record.solar_system_id),
                "tehsil": system.tehsil,
                "village": system.village,
                "settlement": system.settlement or "",
                "year": record.year,
                "month": record.month,
                "energy_consumed_from_grid": record.energy_consumed_from_grid,
                "energy_exported_to_grid": record.energy_exported_to_grid,
                "remarks": record.remarks,
                "electricity_bill_image_url": record.electricity_bill_image_url,
                "created_at": record.created_at.isoformat() if record.created_at else None,
                "updated_at": record.updated_at.isoformat() if record.updated_at else None,
            }
        ),
        200,
    )




@tehsil_manager_bp.route("/solar-supply-data/record/<record_id>", methods=["PUT"])
@jwt_required()
@min_role_required("ADMIN")
def update_solar_supply_data_record(record_id):
    user = UserService.get_user_by_id(get_jwt_identity())
    op_user = user
    if not op_user:
        return jsonify({"message": "User not found"}), 404
    record = SolarEnergyLoggingMonthly.query.get(record_id)
    if not record:
        return jsonify({"message": "Monthly solar record not found"}), 404
    system = SolarSystem.query.get(record.solar_system_id)
    try:
        assert_user_may_access_solar_system(user, system, for_write=True)
    except TehsilAccessDenied:
        return jsonify({"message": "Access denied for this solar site"}), 403

    data = request.get_json() or {}
    try:
        if "energy_consumed_from_grid" in data:
            record.energy_consumed_from_grid = _coerce_optional_float(
                data.get("energy_consumed_from_grid")
            )
        if "energy_exported_to_grid" in data:
            record.energy_exported_to_grid = _coerce_optional_float(
                data.get("energy_exported_to_grid")
            )
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    if "remarks" in data:
        record.remarks = data.get("remarks")

    new_url = data.get("image_url") or data.get("image_path")
    if new_url and str(new_url).strip() != (record.electricity_bill_image_url or ""):
        StorageService.try_delete_public_object(
            current_app.config, record.electricity_bill_image_url
        )
        record.electricity_bill_image_url = str(new_url).strip() or None

    db.session.commit()
    return (
        jsonify(
            {
                "message": "Monthly solar record updated",
                "id": str(record.id),
                "updated_at": record.updated_at.isoformat() if record.updated_at else None,
            }
        ),
        200,
    )




@tehsil_manager_bp.route("/solar-supply-data/record/<record_id>", methods=["DELETE"])
@jwt_required()
@min_role_required("ADMIN")
def delete_solar_supply_data_record(record_id):
    user = UserService.get_user_by_id(get_jwt_identity())
    record = SolarEnergyLoggingMonthly.query.get(record_id)
    if not record:
        return jsonify({"message": "Monthly solar record not found"}), 404
    system = SolarSystem.query.get(record.solar_system_id)
    try:
        assert_user_may_access_solar_system(user, system, for_write=True)
    except TehsilAccessDenied:
        return jsonify({"message": "Access denied for this solar site"}), 403

    StorageService.try_delete_public_object(
        current_app.config, record.electricity_bill_image_url
    )
    legacy_sub = Submission.query.filter_by(record_id=str(record.id)).first()
    if legacy_sub:
        VerificationLog.query.filter_by(submission_id=legacy_sub.id).delete()
        Notification.query.filter_by(submission_id=legacy_sub.id).delete()
        db.session.delete(legacy_sub)
    db.session.delete(record)
    db.session.commit()
    return jsonify({"message": "Monthly solar record deleted"}), 200




@tehsil_manager_bp.route('/solar-supply-data', methods=['POST'])
@jwt_required()
@min_role_required('ADMIN')
def save_solar_supply_data():
    """
    Save monthly solar energy data (tehsil managers / operations — not tubewell operators).
    No verification workflow: rows are persisted as the source of truth for MRV.
    Request body: { data: [...], year: 2025, image_url?: str }
    """
    data = request.get_json()
    rows = data.get('data', [])
    year = data.get('year', datetime.now().year)
    image_url = data.get('image_url') or data.get('image_path')
    current_user_id = get_jwt_identity()

    if not rows:
        return jsonify({"message": "No data provided"}), 400

    saved_ids = []
    errors = []
    op_user = UserService.get_user_by_id(current_user_id)
    if not op_user:
        return jsonify({"message": "User not found"}), 404

    for i, row in enumerate(rows):
        try:
            tehsil = row.get('tehsil')
            village = row.get('village')
            monthly_data = row.get('monthlyData', [])

            ct = canonical_tehsil(tehsil)
            if not ct:
                errors.append(f"Row {i+1}: invalid tehsil")
                continue
            try:
                assert_user_may_access_tehsil(op_user, ct, for_write=True)
            except TehsilAccessDenied:
                errors.append(f"Row {i+1}: tehsil not permitted for your account")
                continue

            system = find_solar_system_by_location(ct, village, row.get("settlement"))

            if not system:
                errors.append(
                    f"Row {i+1}: No solar system for this location — your tehsil manager must register it first"
                )
                continue

            # Save monthly data
            row_energy_error = False
            for month_record in monthly_data:
                month = month_record.get('month')
                try:
                    energy_consumed = _coerce_optional_float(
                        month_record.get("energy_consumed_from_grid")
                    )
                    energy_exported = _coerce_optional_float(
                        month_record.get("energy_exported_to_grid")
                    )
                except ValueError as exc:
                    errors.append(
                        f"Row {i+1}, month {month_record.get('month')}: {exc}"
                    )
                    row_energy_error = True
                    break
                # Check if record exists
                existing = SolarEnergyLoggingMonthly.query.filter_by(
                    solar_system_id=system.id,
                    year=year,
                    month=month
                ).first()

                if existing:
                    existing.energy_consumed_from_grid = energy_consumed
                    existing.energy_exported_to_grid = energy_exported
                    if "remarks" in month_record:
                        existing.remarks = month_record.get("remarks")
                    if image_url and (existing.electricity_bill_image_url or "") != str(
                        image_url
                    ).strip():
                        StorageService.try_delete_public_object(
                            current_app.config, existing.electricity_bill_image_url
                        )
                        existing.electricity_bill_image_url = str(image_url).strip()
                else:
                    new_record = SolarEnergyLoggingMonthly(
                        solar_system_id=system.id,
                        year=year,
                        month=month,
                        energy_consumed_from_grid=energy_consumed,
                        energy_exported_to_grid=energy_exported,
                        electricity_bill_image_url=str(image_url).strip()
                        if image_url
                        else None,
                        remarks=month_record.get("remarks"),
                    )
                    db.session.add(new_record)
                    db.session.flush()

            if row_energy_error:
                continue

            saved_ids.append(str(system.id))

        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
    
    if errors:
        db.session.rollback()
        return jsonify({"message": "Validation errors", "errors": errors}), 400
    
    db.session.commit()
    return jsonify(
        {
            "message": f"Saved solar data for {len(saved_ids)} location(s)",
            "ids": saved_ids,
        }
    ), 201

# --- PDF Report Generation ---


# ── Tehsil manager: water submission review (was verification_tehsil blueprint) ──


@tehsil_manager_bp.route("/verification/pending", methods=["GET"])
@jwt_required()
@min_role_required("ADMIN")
def get_pending_submissions():
    """Water submission queue for tehsil managers (submitted + history)."""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)

    statuses = [
        SUBMISSION_STATUS_SUBMITTED,
        SUBMISSION_STATUS_REJECTED,
        SUBMISSION_STATUS_ACCEPTED,
        SUBMISSION_STATUS_REVERTED_BACK,
    ]

    submissions = (
        Submission.query.filter(
            Submission.status.in_(statuses),
            Submission.submission_type == "water_system",
        )
        .order_by(Submission.submitted_at.asc())
        .all()
    )

    if user_role_code(current_user) == ADMIN:
        submissions = [
            s
            for s in submissions
            if can_access_tehsil(current_user, submission_tehsil(s))
        ]

    result = []
    for sub in submissions:
        operator = User.query.get(sub.operator_id)
        reviewer = User.query.get(sub.reviewed_by) if sub.reviewed_by else None
        system_info = {}

        record = WaterEnergyLoggingDaily.query.get(sub.record_id)
        if record:
            system = WaterSystem.query.get(record.water_system_id)
            if system:
                system_info = {
                    "id": system.id,
                    "uid": system.unique_identifier,
                    "village": system.village,
                    "tehsil": system.tehsil,
                    "year": record.log_date.year if record.log_date else None,
                    "month": record.log_date.month if record.log_date else None,
                    "last_edited_at": record.updated_at.isoformat()
                    if getattr(record, "updated_at", None)
                    else None,
                    "pump_start_time": record.pump_start_time.isoformat(
                        timespec="seconds"
                    )
                    if record.pump_start_time
                    else None,
                    "pump_end_time": record.pump_end_time.isoformat(timespec="seconds")
                    if record.pump_end_time
                    else None,
                    "pump_operating_hours": record.pump_operating_hours,
                    "total_water_pumped": record.total_water_pumped,
                    "bulk_meter_image_url": record.bulk_meter_image_url,
                }

        result.append(
            {
                "id": sub.id,
                "submission_type": sub.submission_type,
                "status": sub.status,
                "operator_name": operator.name if operator else "Unknown",
                "operator_email": operator.email if operator else "Unknown",
                "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
                "reviewed_at": sub.reviewed_at.isoformat() if sub.reviewed_at else None,
                "remarks": sub.remarks,
                "system_info": system_info,
                "reviewed_by": sub.reviewed_by,
                "reviewed_by_name": reviewer.name if reviewer else None,
                "approved_by": sub.approved_by,
            }
        )

    return jsonify({"submissions": result})


@tehsil_manager_bp.route("/verification/<submission_id>/verify", methods=["POST"])
@jwt_required()
def accept_submission(submission_id):
    """Tehsil manager (or operations) accepts a submitted water log → `accepted`."""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)

    submission = Submission.query.get(submission_id)
    if not submission:
        return jsonify({"error": "Submission not found"}), 404

    if not user_can_verify_submission(current_user, submission):
        return jsonify({"error": "Only tehsil managers can accept submissions"}), 403

    if submission.status != SUBMISSION_STATUS_SUBMITTED:
        return jsonify(
            {
                "error": f"Can only accept submissions in {SUBMISSION_STATUS_SUBMITTED!r} status"
            }
        ), 400

    data = request.get_json() or {}
    remarks = data.get("remarks", "")

    submission.status = SUBMISSION_STATUS_ACCEPTED
    submission.reviewed_at = datetime.utcnow()
    submission.reviewed_by = current_user_id
    submission.remarks = remarks

    if submission.submission_type == "water_system":
        record = WaterEnergyLoggingDaily.query.get(submission.record_id)
        if record:
            record.status = SUBMISSION_STATUS_ACCEPTED

    log_verification_action(
        submission.id,
        "accept",
        current_user_id,
        current_user.role,
        remarks or "Submission accepted",
    )

    notify_operator(
        submission.operator_id,
        "Submission accepted",
        f"Your water submission was accepted by {current_user.name}.",
        submission.id,
    )

    db.session.commit()

    return jsonify(
        {
            "message": "Submission accepted",
            "submission": {
                "id": submission.id,
                "status": submission.status,
                "reviewed_at": submission.reviewed_at.isoformat(),
            },
        }
    )


@tehsil_manager_bp.route("/verification/<submission_id>/reject", methods=["POST"])
@jwt_required()
def reject_submission(submission_id):
    """Reject a submitted water log (requires remarks)."""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)

    submission = Submission.query.get(submission_id)
    if not submission:
        return jsonify({"error": "Submission not found"}), 404

    if not user_can_verify_submission(current_user, submission):
        return jsonify({"error": "Only tehsil managers can reject submissions"}), 403

    if submission.status != SUBMISSION_STATUS_SUBMITTED:
        return jsonify(
            {
                "error": f"Can only reject submissions in {SUBMISSION_STATUS_SUBMITTED!r} status"
            }
        ), 400

    data = request.get_json() or {}
    remarks = data.get("remarks", "")

    if not remarks:
        return jsonify({"error": "Rejection reason is required"}), 400

    submission.status = SUBMISSION_STATUS_REJECTED
    submission.reviewed_at = datetime.utcnow()
    submission.reviewed_by = current_user_id
    submission.remarks = remarks

    if submission.submission_type == "water_system":
        record = WaterEnergyLoggingDaily.query.get(submission.record_id)
        if record:
            record.status = SUBMISSION_STATUS_REJECTED

    log_verification_action(
        submission.id,
        "reject",
        current_user_id,
        current_user.role,
        remarks,
    )

    notify_operator(
        submission.operator_id,
        "Submission rejected",
        f"Your {submission.submission_type} submission was rejected: {remarks}",
        submission.id,
    )

    db.session.commit()

    return jsonify(
        {
            "message": "Submission rejected",
            "submission": {
                "id": submission.id,
                "status": submission.status,
                "remarks": submission.remarks,
            },
        }
    )


@tehsil_manager_bp.route("/verification/<submission_id>/revert", methods=["POST"])
@jwt_required()
def revert_submission(submission_id):
    """Return a submitted row to the tubewell operator (`reverted_back`). Only from `submitted`."""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)

    submission = Submission.query.get(submission_id)
    if not submission:
        return jsonify({"error": "Submission not found"}), 404

    if not user_can_verify_submission(current_user, submission):
        return jsonify({"error": "Only tehsil managers can revert submissions"}), 403

    if submission.status != SUBMISSION_STATUS_SUBMITTED:
        return jsonify(
            {
                "error": "Can only revert submissions that are pending review (submitted)"
            }
        ), 400

    if submission.submission_type == "water_system":
        record = WaterEnergyLoggingDaily.query.get(submission.record_id)
        if not record or record.status != SUBMISSION_STATUS_SUBMITTED:
            return jsonify({"error": "Water record is not in submitted state"}), 400

    data = request.get_json() or {}
    remarks = data.get("remarks", "")

    submission.status = SUBMISSION_STATUS_REVERTED_BACK
    submission.reviewed_at = datetime.utcnow()
    submission.reviewed_by = current_user_id
    submission.remarks = remarks or None

    if submission.submission_type == "water_system":
        record = WaterEnergyLoggingDaily.query.get(submission.record_id)
        if record:
            record.status = SUBMISSION_STATUS_REVERTED_BACK

    log_verification_action(
        submission.id,
        "revert",
        current_user_id,
        current_user.role,
        remarks or "Returned to operator for corrections",
    )

    notify_operator(
        submission.operator_id,
        "Submission returned",
        f"Your submission was returned by {current_user.name} for corrections."
        + (f" Note: {remarks}" if remarks else ""),
        submission.id,
    )

    db.session.commit()

    return jsonify(
        {
            "message": "Submission reverted to operator",
            "submission": {
                "id": submission.id,
                "status": submission.status,
                "remarks": submission.remarks,
            },
        }
    )


@tehsil_manager_bp.route("/verification/audit-logs", methods=["GET"])
@jwt_required()
@min_role_required("ADMIN")
def get_verification_audit_logs():
    """Audit trail for water submissions (tehsil-scoped for ADMIN)."""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)

    submission_id = request.args.get("submission_id")
    action_type = request.args.get("action_type")
    user_id = request.args.get("user_id")

    query = VerificationLog.query

    if submission_id:
        query = query.filter_by(submission_id=submission_id)
    if action_type:
        query = query.filter_by(action_type=action_type)
    if user_id:
        query = query.filter_by(performed_by=user_id)

    logs = query.order_by(VerificationLog.created_at.desc()).limit(100).all()

    if user_role_code(current_user) == ADMIN:
        logs = [
            lg
            for lg in logs
            if (
                (sub := Submission.query.get(lg.submission_id))
                and can_access_tehsil(current_user, submission_tehsil(sub))
            )
        ]

    result = []
    for log in logs:
        user = User.query.get(log.performed_by)
        result.append(
            {
                "id": log.id,
                "submission_id": log.submission_id,
                "action_type": log.action_type,
                "performed_by_name": user.name if user else "Unknown",
                "role": log.role,
                "comment": log.comment,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
        )

    return jsonify({"audit_logs": result})


@tehsil_manager_bp.route("/verification/stats", methods=["GET"])
@jwt_required()
@min_role_required("ADMIN")
def get_verification_stats():
    """Verification statistics for water submissions."""
    current_user = User.query.get(get_jwt_identity())

    if user_role_code(current_user) == ADMIN:
        scoped = [
            s
            for s in Submission.query.filter_by(submission_type="water_system").all()
            if can_access_tehsil(current_user, submission_tehsil(s))
        ]
        total = len(scoped)
        pending = len([s for s in scoped if s.status == SUBMISSION_STATUS_SUBMITTED])
        accepted = len([s for s in scoped if s.status == SUBMISSION_STATUS_ACCEPTED])
        rejected = len([s for s in scoped if s.status == SUBMISSION_STATUS_REJECTED])
        reverted = len(
            [s for s in scoped if s.status == SUBMISSION_STATUS_REVERTED_BACK]
        )
        accepted_subs = [
            s
            for s in scoped
            if s.status == SUBMISSION_STATUS_ACCEPTED
            and s.submitted_at
            and s.reviewed_at
        ]
    else:
        water = Submission.query.filter_by(submission_type="water_system")
        total = water.count()
        pending = water.filter_by(status=SUBMISSION_STATUS_SUBMITTED).count()
        accepted = water.filter_by(status=SUBMISSION_STATUS_ACCEPTED).count()
        rejected = water.filter_by(status=SUBMISSION_STATUS_REJECTED).count()
        reverted = water.filter_by(status=SUBMISSION_STATUS_REVERTED_BACK).count()
        accepted_subs = water.filter(
            Submission.status == SUBMISSION_STATUS_ACCEPTED,
            Submission.submitted_at.isnot(None),
            Submission.reviewed_at.isnot(None),
        ).all()

    avg_review_time_hours = 0
    if accepted_subs:
        total_hours = sum(
            [
                (sub.reviewed_at - sub.submitted_at).total_seconds() / 3600
                for sub in accepted_subs
                if sub.reviewed_at and sub.submitted_at
            ]
        )
        avg_review_time_hours = round(float(total_hours / len(accepted_subs)), 2)

    return jsonify(
        {
            "total_submissions": total,
            "pending_review": pending,
            "accepted": accepted,
            "rejected": rejected,
            "reverted_back": reverted,
            "avg_review_time_hours": avg_review_time_hours,
        }
    )


# ── In-app notifications (all authenticated roles; shared `/api/operator/notifications*`) ──


@tehsil_manager_bp.route("/notifications", methods=["GET"])
@jwt_required()
def get_notifications():
    return get_notifications_response()


@tehsil_manager_bp.route("/notifications/<notification_id>/read", methods=["POST"])
@jwt_required()
def mark_notification_read(notification_id):
    return mark_notification_read_response(notification_id)


@tehsil_manager_bp.route("/notifications/read-all", methods=["POST"])
@jwt_required()
def mark_all_notifications_read():
    return mark_all_notifications_read_response()

