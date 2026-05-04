from flask import Blueprint, request, jsonify, current_app
from app.extensions import db
from sqlalchemy import extract, or_

from app.constants.tehsils import canonical_tehsil
from app.models.models import (
    WaterSystem,
    WaterEnergyLoggingDaily,
    SolarSystem,
    SolarEnergyLoggingMonthly,
    User,
    Submission,
    SUBMISSION_STATUS_DRAFTED,
    SUBMISSION_STATUS_SUBMITTED,
    SUBMISSION_STATUS_REJECTED,
    SUBMISSION_STATUS_ACCEPTED,
    SUBMISSION_STATUS_REVERTED_BACK,
    WATER_LOG_OPERATOR_EDITABLE,
    normalize_water_submission_status,
)
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.utils.decorators import min_role_required, tubewell_user_required
from app.rbac import (
    ADMIN,
    SUPER_ADMIN,
    SYSTEM_ADMIN,
    ROLE_RANK,
    USER,
    user_rank,
    user_role_code,
    user_assigned_tehsils,
)
from app.utils.operator_helpers import (
    ALLOWED_EXTENSIONS,
    allowed_file,
    coerce_optional_float as _coerce_optional_float,
    find_solar_system_by_location,
    parse_date,
)
from app.utils.workflow_helpers import log_verification_action, notify_analysts
from app.services import UserService, StorageService
from app.utils.pump_times import (
    apply_pump_time_fields_from_payload,
    parse_time_of_day,
    time_to_json,
)
from app.services.tehsil_access import (
    TehsilAccessDenied,
    assert_user_may_access_tehsil,
    assert_user_may_access_water_system,
    assert_user_may_log_water_system,
    assert_user_may_view_or_log_water_system,
    assert_user_may_access_solar_system,
    assigned_water_system_id_set,
)
from app.utils.water_submission_detail import build_water_submission_detail_response
from app.utils.in_app_notifications import (
    get_notifications_response,
    mark_all_notifications_read_response,
    mark_notification_read_response,
)
import calendar
from datetime import date, datetime

tubewell_operator_bp = Blueprint("tubewell_operator", __name__)


def _signature_payload_ok(value: str) -> bool:
    """Basic guardrails: non-empty SVG, reasonable size."""
    if not isinstance(value, str):
        return False
    v = value.strip()
    if not v:
        return False
    # Prevent huge payloads (roughly 150KB of SVG markup).
    return len(v) <= 150_000


def _require_operator_signature(user) -> tuple[bool, tuple]:
    """Enforce that the current tubewell operator has a saved signature."""
    if not user or user_role_code(user) != USER:
        return False, (jsonify({"error": "Only tubewell operators can perform this action"}), 403)
    sig = getattr(user, "signature_svg", None)
    if not sig or not str(sig).strip():
        return False, (
            jsonify(
                {
                    "error": "Signature required",
                    "message": "Please add your signature before submitting a water log.",
                }
            ),
            400,
        )
    return True, ()


def _signature_svg_or_none(user) -> str | None:
    sig = getattr(user, "signature_svg", None)
    if sig and str(sig).strip():
        return str(sig).strip()
    return None


@tubewell_operator_bp.route("/notifications", methods=["GET"])
@jwt_required()
def tubewell_get_notifications():
    """Same payload as tehsil_manager `get_notifications` — shared util."""
    return get_notifications_response()


@tubewell_operator_bp.route("/notifications/<notification_id>/read", methods=["POST"])
@jwt_required()
def tubewell_mark_notification_read(notification_id):
    return mark_notification_read_response(notification_id)


@tubewell_operator_bp.route("/notifications/read-all", methods=["POST"])
@jwt_required()
def tubewell_mark_all_notifications_read():
    return mark_all_notifications_read_response()


@tubewell_operator_bp.route("/submit", methods=["POST"])
@jwt_required()
def submit_data_for_verification():
    """Tubewell operator submits a water daily log row for tehsil manager review."""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)

    if user_role_code(current_user) != USER:
        return jsonify({"error": "Only tubewell operators can submit data"}), 403
    ok, err = _require_operator_signature(current_user)
    if not ok:
        return err

    data = request.get_json() or {}
    record_id = data.get("record_id")
    if not record_id:
        return jsonify({"error": "record_id is required"}), 400

    submission_type = "water_system"

    record = WaterEnergyLoggingDaily.query.get(record_id)
    if not record:
        return jsonify({"error": "Water data record not found"}), 404
    record.signed = True
    record.signature_svg_snapshot = _signature_svg_or_none(current_user)

    existing = Submission.query.filter_by(record_id=record_id).first()
    if existing:
        if existing.status == SUBMISSION_STATUS_SUBMITTED:
            return jsonify({"error": "This record is already submitted"}), 400
        if existing.status == SUBMISSION_STATUS_ACCEPTED:
            return jsonify({"error": "This record is already accepted"}), 400
        if existing.status not in (
            SUBMISSION_STATUS_REJECTED,
            SUBMISSION_STATUS_REVERTED_BACK,
            SUBMISSION_STATUS_DRAFTED,
        ):
            return jsonify(
                {"error": f"Cannot resubmit from status {existing.status}"}
            ), 400
        existing.status = SUBMISSION_STATUS_SUBMITTED
        existing.submitted_at = datetime.utcnow()
        existing.reviewed_at = None
        existing.reviewed_by = None
        existing.remarks = None
        submission = existing
        db.session.flush()
    else:
        submission = Submission(
            operator_id=current_user_id,
            submission_type=submission_type,
            record_id=record_id,
            status=SUBMISSION_STATUS_SUBMITTED,
            submitted_at=datetime.utcnow(),
        )
        db.session.add(submission)
        db.session.flush()

    record.status = SUBMISSION_STATUS_SUBMITTED

    log_verification_action(
        submission.id,
        "submit",
        current_user_id,
        current_user.role,
        "Data submitted for verification",
    )

    system = WaterSystem.query.get(record.water_system_id)
    details = (
        f"New Monthly Water Report ({record.log_date.month}/{record.log_date.year}) submitted by {current_user.name}.\n"
        f"Location: {system.tehsil}, {system.village} {system.settlement or ''}\n"
        f"Pump Operating Hours: {record.pump_operating_hours or 'N/A'}\n"
        f"Total Water Pumped: {record.total_water_pumped or 'N/A'}"
    )
    notify_analysts(
        "New Detailed Water Submission", details, submission.id, tehsil=system.tehsil
    )

    db.session.commit()

    return (
        jsonify(
            {
                "message": "Data submitted successfully",
                "submission": {
                    "id": submission.id,
                    "submission_type": submission.submission_type,
                    "status": submission.status,
                    "submitted_at": submission.submitted_at.isoformat(),
                },
            }
        ),
        201,
    )


@tubewell_operator_bp.route("/my-submissions", methods=["GET"])
@jwt_required()
def get_my_submissions():
    """Water submission history for the current tubewell operator."""
    current_user_id = get_jwt_identity()

    status = request.args.get("status")
    query = Submission.query.filter_by(
        operator_id=current_user_id,
        submission_type="water_system",
    )

    if status:
        query = query.filter_by(status=status)

    submissions = query.order_by(Submission.created_at.desc()).all()

    result = []
    for sub in submissions:
        system_info = {}
        record = WaterEnergyLoggingDaily.query.get(sub.record_id)
        if record:
            system = WaterSystem.query.get(record.water_system_id)
            if system:
                system_info = {
                    "village": system.village,
                    "tehsil": system.tehsil,
                    "year": record.log_date.year if record.log_date else None,
                    "month": record.log_date.month if record.log_date else None,
                }

        result.append(
            {
                "id": sub.id,
                "record_id": sub.record_id,
                "submission_type": sub.submission_type,
                "status": sub.status,
                "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
                "reviewed_at": sub.reviewed_at.isoformat() if sub.reviewed_at else None,
                "approved_at": sub.approved_at.isoformat() if sub.approved_at else None,
                "remarks": sub.remarks,
                "system_info": system_info,
            }
        )

    return jsonify({"submissions": result})


@tubewell_operator_bp.route("/signature", methods=["GET"])
@jwt_required()
@min_role_required("USER")
def get_operator_signature():
    """Return current user's saved signature (SVG markup)."""
    u = UserService.get_user_by_id(get_jwt_identity())
    if not u:
        return jsonify({"message": "User not found"}), 404
    if user_role_code(u) != USER:
        return jsonify({"message": "Only tubewell operators can access signature"}), 403
    return jsonify({"signature_svg": u.signature_svg}), 200


@tubewell_operator_bp.route("/signature", methods=["PUT"])
@jwt_required()
@min_role_required("USER")
def put_operator_signature():
    """Create or update the current user's signature."""
    u = UserService.get_user_by_id(get_jwt_identity())
    if not u:
        return jsonify({"message": "User not found"}), 404
    if user_role_code(u) != USER:
        return jsonify({"message": "Only tubewell operators can edit signature"}), 403
    data = request.get_json(silent=True) or {}
    svg = data.get("signature_svg")
    if not _signature_payload_ok(svg):
        return jsonify({"message": "Invalid signature_svg"}), 400
    u.signature_svg = str(svg).strip()
    db.session.commit()
    return jsonify({"message": "Signature saved"}), 200


@tubewell_operator_bp.route("/signature", methods=["DELETE"])
@jwt_required()
@min_role_required("USER")
def delete_operator_signature():
    """Delete the current user's signature."""
    u = UserService.get_user_by_id(get_jwt_identity())
    if not u:
        return jsonify({"message": "User not found"}), 404
    if user_role_code(u) != USER:
        return jsonify({"message": "Only tubewell operators can delete signature"}), 403
    u.signature_svg = None
    db.session.commit()
    return jsonify({"message": "Signature deleted"}), 200


@tubewell_operator_bp.route("/tubewell/submission/<submission_id>", methods=["GET"])
@jwt_required()
def get_tubewell_water_submission_detail(submission_id):
    """Tubewell operator: full detail for a water submission they own (assigned water system)."""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    if user_role_code(current_user) != USER:
        return jsonify({"error": "Only tubewell operators can use this endpoint"}), 403

    submission = Submission.query.get(submission_id)
    if not submission:
        return jsonify({"error": "Submission not found"}), 404
    if submission.submission_type != "water_system":
        return jsonify({"error": "Only water submissions are supported"}), 400
    if str(submission.operator_id) != str(current_user_id):
        return jsonify({"error": "Access denied"}), 403

    record = WaterEnergyLoggingDaily.query.get(submission.record_id)
    if not record:
        return jsonify({"error": "Record not found"}), 404
    if str(record.water_system_id) not in assigned_water_system_id_set(current_user):
        return jsonify({"error": "Access denied"}), 403

    return jsonify(build_water_submission_detail_response(submission))


@tubewell_operator_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_image():
    """
    Water evidence: tubewell operators (USER) with assigned water systems only.
    Solar / net-metering evidence: tehsil managers (ADMIN) only (program roles are read-only).
    """
    user = UserService.get_user_by_id(get_jwt_identity())
    if not user:
        return jsonify({"message": "User not found"}), 404

    record_type = request.form.get('record_type', 'water')

    if record_type in ("solar", "water_calibration"):
        if user_role_code(user) != ADMIN:
            return (
                jsonify(
                    {
                        "message": "This evidence upload requires tehsil manager role",
                    }
                ),
                403,
            )
    else:
        if user_role_code(user) != USER:
            return (
                jsonify(
                    {
                        "message": "Water evidence upload requires tubewell operator role",
                    }
                ),
                403,
            )
        if not user.assigned_water_system_ids:
            return (
                jsonify(
                    {
                        "message": "No water systems assigned — contact your tehsil manager",
                    }
                ),
                403,
            )

    # Check if a file was included in the request
    if 'file' not in request.files:
        return jsonify({"message": "No file provided"}), 400

    file = request.files['file']
    record_id = request.form.get('record_id')

    if file.filename == '':
        return jsonify({"message": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"message": "File type not allowed. Use PNG, JPG, JPEG, GIF, or PDF."}), 400

    if record_type == "solar":
        folder = "solar-images"
    elif record_type == "water_calibration":
        folder = "water-calibration-certificates"
    else:
        folder = "water-images"
    try:
        upload_result = StorageService.upload_file_storage(
            file_storage=file,
            app_config=current_app.config,
            folder=folder,
        )
    except Exception as exc:
        return jsonify({"message": "Image upload failed", "error": str(exc)}), 500
    image_url = upload_result["public_url"]

    # Update the related record with the image URL
    if record_id:
        if record_type == 'water':
            record = WaterEnergyLoggingDaily.query.get(record_id)
            if record:
                ws = WaterSystem.query.get(record.water_system_id)
                try:
                    assert_user_may_log_water_system(user, ws)
                except TehsilAccessDenied:
                    return jsonify({"message": "Access denied for this record"}), 403
                record.bulk_meter_image_url = image_url
                db.session.commit()
        elif record_type == 'solar':
            record = SolarEnergyLoggingMonthly.query.get(record_id)
            if record:
                ss = SolarSystem.query.get(record.solar_system_id)
                try:
                    assert_user_may_access_solar_system(user, ss, for_write=True)
                except TehsilAccessDenied:
                    return jsonify({"message": "Access denied for this record"}), 403
                if (record.electricity_bill_image_url or "") != image_url:
                    StorageService.try_delete_public_object(
                        current_app.config, record.electricity_bill_image_url
                    )
                    record.electricity_bill_image_url = image_url
                db.session.commit()

    return jsonify({
        "message": "File uploaded successfully",
        "image_url": image_url,
        "path": image_url,
        "bucket": upload_result["bucket"],
        "object_key": upload_result["object_key"],
    }), 201


@tubewell_operator_bp.route('/water-systems', methods=['GET'])
@jwt_required()
@min_role_required('USER')
def get_water_systems():
    """Tubewell operators: assigned systems; ADMIN: tehsil scope; SUPER_ADMIN+ read all.

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
        q = WaterSystem.query
    elif user_role_code(user) == USER:
        wids = user.assigned_water_system_ids
        if not wids:
            return jsonify([]), 200
        q = WaterSystem.query.filter(WaterSystem.id.in_(wids))
    elif ts:
        q = WaterSystem.query.filter(WaterSystem.tehsil.in_(ts))
    else:
        return jsonify([]), 200

    if filter_tehsil and filter_tehsil != "All Tehsils":
        q = q.filter(WaterSystem.tehsil == filter_tehsil)
    if filter_village and filter_village != "All Villages":
        q = q.filter(WaterSystem.village == filter_village)

    systems = q.all()
    return jsonify([{
        "id": str(s.id),
        "tehsil": s.tehsil,
        "village": s.village,
        "settlement": s.settlement,
        "unique_identifier": s.unique_identifier,
        "latitude": getattr(s, "latitude", None),
        "longitude": getattr(s, "longitude", None),
        "pump_model": s.pump_model,
        "bulk_meter_installed": getattr(s, "bulk_meter_installed", None),
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if getattr(s, "updated_at", None) else None,
    } for s in systems]), 200




@tubewell_operator_bp.route('/water-system-config', methods=['GET'])
@jwt_required()
@min_role_required('USER')
def get_water_system_config():
    """Get water system configuration by location for auto-fill."""
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

    if settlement:
        query = WaterSystem.query.filter_by(tehsil=ct, village=village, settlement=settlement)
    else:
        query = WaterSystem.query.filter_by(tehsil=ct, village=village).filter(
            or_(
                WaterSystem.settlement.is_(None),
                WaterSystem.settlement == "",
            )
        )
    
    system = query.first()

    if system:
        try:
            assert_user_may_view_or_log_water_system(user, system)
        except TehsilAccessDenied:
            return jsonify({"message": "Access denied for this water system"}), 403
        return jsonify({
            "exists": True,
            "config": {
                "pump_model": system.pump_model,
                "pump_serial_number": system.pump_serial_number,
                "start_of_operation": system.start_of_operation.isoformat() if system.start_of_operation else None,
                "depth_of_water_intake": system.depth_of_water_intake,
                "height_to_ohr": system.height_to_ohr,
                "pump_flow_rate": system.pump_flow_rate,
                "meter_model": system.meter_model,
                "meter_serial_number": system.meter_serial_number,
                "meter_accuracy_class": system.meter_accuracy_class,
                "installation_date": system.installation_date.isoformat() if system.installation_date else None,
            }
        }), 200
    
    # NO FALLBACK - if no data found, return empty
    return jsonify({"exists": False, "config": None}), 200




@tubewell_operator_bp.route('/water-data/drafts', methods=['GET'])
@jwt_required()
@min_role_required('USER')
def get_water_drafts():
    """Draft water rows: operators only for assigned systems; others by tehsil scope."""
    user = UserService.get_user_by_id(get_jwt_identity())
    rk = user_rank(user)
    ts = list(user_assigned_tehsils(user))
    if rk >= ROLE_RANK[SUPER_ADMIN]:
        system_ids = [s.id for s in WaterSystem.query.all()]
    elif user_role_code(user) == USER:
        wids = user.assigned_water_system_ids
        if not wids:
            return jsonify({'drafts': []})
        system_ids = wids
    elif ts:
        system_ids = [s.id for s in WaterSystem.query.filter(WaterSystem.tehsil.in_(ts)).all()]
    else:
        return jsonify({'drafts': []})

    drafts = WaterEnergyLoggingDaily.query.filter(
        WaterEnergyLoggingDaily.water_system_id.in_(system_ids),
        WaterEnergyLoggingDaily.status == SUBMISSION_STATUS_DRAFTED,
    ).order_by(WaterEnergyLoggingDaily.created_at.desc()).all()

    result = []
    for draft in drafts:
        system = WaterSystem.query.get(draft.water_system_id)
        result.append(
            {
                "id": str(draft.id),
                "system_id": str(draft.water_system_id),
                "village": system.village if system else "Unknown",
                "tehsil": system.tehsil if system else "Unknown",
                "year": draft.log_date.year if draft.log_date else None,
                "month": draft.log_date.month if draft.log_date else None,
                "day": draft.log_date.day if draft.log_date else None,
                "bulk_meter_image_url": draft.bulk_meter_image_url,
                "signed": draft.signed,
                "status": draft.status,
                "created_at": draft.created_at.isoformat() if draft.created_at else None,
            }
        )
    
    return jsonify({'drafts': result})




@tubewell_operator_bp.route('/water-data/draft/<record_id>', methods=['GET'])
@jwt_required()
def get_water_draft(record_id):
    """Get a specific water data draft."""
    current_user_id = get_jwt_identity()
    
    record = WaterEnergyLoggingDaily.query.get(record_id)
    if not record:
        return jsonify({'error': 'Record not found'}), 404
    
    u = UserService.get_user_by_id(current_user_id)
    system = WaterSystem.query.get(record.water_system_id)
    try:
        assert_user_may_view_or_log_water_system(u, system)
    except TehsilAccessDenied:
        return jsonify({'error': 'Access denied'}), 403

    return jsonify(
        {
            "id": str(record.id),
            "water_system_id": str(record.water_system_id),
            "year": record.log_date.year if record.log_date else None,
            "month": record.log_date.month if record.log_date else None,
            "day": record.log_date.day if record.log_date else None,
            "pump_start_time": time_to_json(record.pump_start_time),
            "pump_end_time": time_to_json(record.pump_end_time),
            "pump_operating_hours": record.pump_operating_hours,
            "total_water_pumped": record.total_water_pumped,
            "bulk_meter_image_url": record.bulk_meter_image_url,
            "signed": record.signed,
            "signature_svg_snapshot": record.signature_svg_snapshot,
            "status": record.status,
            "tehsil": system.tehsil if system else None,
            "village": system.village if system else None,
            "settlement": system.settlement if system else None,
            "bulk_meter_installed": system.bulk_meter_installed if system else None,
        }
    )




@tubewell_operator_bp.route('/water-data/draft/<record_id>', methods=['PUT'])
@jwt_required()
def update_water_draft(record_id):
    """Update a water data draft."""
    current_user_id = get_jwt_identity()
    
    record = WaterEnergyLoggingDaily.query.get(record_id)
    if not record:
        return jsonify({'error': 'Record not found'}), 404
    
    u = UserService.get_user_by_id(current_user_id)
    if user_role_code(u) != USER:
        return jsonify({'error': 'Only tubewell operators can edit water logs'}), 403
    if record.status not in WATER_LOG_OPERATOR_EDITABLE:
        return jsonify(
            {'error': 'Only drafted or reverted_back rows can be edited'}
        ), 400

    system = WaterSystem.query.get(record.water_system_id)
    try:
        assert_user_may_view_or_log_water_system(u, system)
    except TehsilAccessDenied:
        return jsonify({'error': 'Access denied'}), 403

    data = request.get_json()

    apply_pump_time_fields_from_payload(record, data)
    if "total_water_pumped" in data:
        record.total_water_pumped = data["total_water_pumped"]
    if "year" in data or "month" in data or "day" in data:
        y = data.get("year", record.log_date.year if record.log_date else None)
        m = data.get("month", record.log_date.month if record.log_date else None)
        d = data.get("day", record.log_date.day if record.log_date else None)
        if y is None or m is None:
            return jsonify({"error": "year and month are required to update period"}), 400
        try:
            yi, mi = int(y), int(m)
            if d is None:
                today = date.today()
                if yi == today.year and mi == today.month:
                    di = min(today.day, calendar.monthrange(yi, mi)[1])
                else:
                    di = 1
            else:
                di = int(d)
            last = calendar.monthrange(yi, mi)[1]
            if di < 1 or di > last:
                return jsonify({"error": f"day must be between 1 and {last}"}), 400
            record.log_date = date(yi, mi, di)
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid year, month, or day"}), 400

    # Reject duplicate interval for same system and day.
    if record.pump_start_time is not None and record.pump_end_time is not None:
        conflict = (
            WaterEnergyLoggingDaily.query.filter(
                WaterEnergyLoggingDaily.id != record.id,
                WaterEnergyLoggingDaily.water_system_id == record.water_system_id,
                WaterEnergyLoggingDaily.log_date == record.log_date,
                WaterEnergyLoggingDaily.pump_start_time == record.pump_start_time,
                WaterEnergyLoggingDaily.pump_end_time == record.pump_end_time,
            ).first()
        )
        if conflict:
            return jsonify(
                {
                    "error": "Duplicate interval",
                    "message": "A log already exists for this day with the same pump start/end time.",
                }
            ), 400

    db.session.commit()

    return jsonify({"message": "Draft updated successfully", "id": str(record.id)})




@tubewell_operator_bp.route('/water-data/draft/<record_id>/submit', methods=['POST'])
@jwt_required()
def submit_water_draft(record_id):
    """Submit a water data draft for verification."""
    current_user_id = get_jwt_identity()
    
    record = WaterEnergyLoggingDaily.query.get(record_id)
    if not record:
        return jsonify({'error': 'Record not found'}), 404
    
    u = UserService.get_user_by_id(current_user_id)
    if user_role_code(u) != USER:
        return jsonify({'error': 'Only tubewell operators can submit water logs'}), 403
    ok, err = _require_operator_signature(u)
    if not ok:
        return err
    if record.status not in WATER_LOG_OPERATOR_EDITABLE:
        return jsonify(
            {'error': 'Only drafted or reverted_back rows can be submitted'}
        ), 400

    system = WaterSystem.query.get(record.water_system_id)
    try:
        assert_user_may_view_or_log_water_system(u, system)
    except TehsilAccessDenied:
        return jsonify({'error': 'Access denied'}), 403

    record.status = SUBMISSION_STATUS_SUBMITTED
    record.signed = True
    record.signature_svg_snapshot = _signature_svg_or_none(u)

    existing_sub = Submission.query.filter_by(record_id=str(record.id)).first()
    current_user = User.query.get(current_user_id)
    if not existing_sub:
        submission = Submission(
            operator_id=current_user_id,
            submission_type='water_system',
            record_id=str(record.id),
            status=SUBMISSION_STATUS_SUBMITTED,
            submitted_at=datetime.utcnow()
        )
        db.session.add(submission)
        db.session.flush()
        
        log_verification_action(
            submission.id,
            "submit",
            current_user_id,
            current_user.role,
            f"Water data for {record.log_date.month}/{record.log_date.year} submitted from draft",
        )

        details = (
            f"New Monthly Water Report ({record.log_date.month}/{record.log_date.year}) submitted by {current_user.name}.\n"
            f"Location: {system.tehsil}, {system.village} {system.settlement or ''}\n"
            f"Pump Operating Hours: {record.pump_operating_hours or 'N/A'}\n"
            f"Total Water Pumped: {record.total_water_pumped or 'N/A'}"
        )
        notify_analysts(
            'New Detailed Water Submission',
            details,
            submission.id,
            tehsil=system.tehsil,
        )
    else:
        if existing_sub.status in (
            SUBMISSION_STATUS_REJECTED,
            SUBMISSION_STATUS_REVERTED_BACK,
            SUBMISSION_STATUS_DRAFTED,
        ):
            existing_sub.status = SUBMISSION_STATUS_SUBMITTED
            existing_sub.submitted_at = datetime.utcnow()
        elif existing_sub.status == SUBMISSION_STATUS_SUBMITTED:
            return jsonify({'error': 'This record is already submitted'}), 400
        elif existing_sub.status == SUBMISSION_STATUS_ACCEPTED:
            return jsonify({'error': 'This record is already accepted'}), 400

    db.session.commit()
    
    return jsonify({
        'message': 'Data submitted for verification',
        'id': str(record.id),
        'status': record.status
    })




@tubewell_operator_bp.route('/water-data/draft/<record_id>', methods=['DELETE'])
@jwt_required()
def delete_water_draft(record_id):
    """Delete a water row only while it is still `drafted` (tubewell operator)."""
    current_user_id = get_jwt_identity()
    u = UserService.get_user_by_id(current_user_id)
    if user_role_code(u) != USER:
        return jsonify({'error': 'Only tubewell operators can delete water drafts'}), 403

    record = WaterEnergyLoggingDaily.query.get(record_id)
    if not record:
        return jsonify({'error': 'Record not found'}), 404
    if record.status != SUBMISSION_STATUS_DRAFTED:
        return jsonify({'error': 'Only drafted rows can be deleted'}), 400

    system = WaterSystem.query.get(record.water_system_id)
    if not system:
        return jsonify({'error': 'Access denied'}), 403
    try:
        assert_user_may_view_or_log_water_system(u, system)
    except TehsilAccessDenied:
        return jsonify({'error': 'Access denied'}), 403

    db.session.delete(record)
    db.session.commit()

    return jsonify({'message': 'Draft deleted successfully'}), 200




@tubewell_operator_bp.route('/water-supply-data', methods=['GET'])
@jwt_required()
@tubewell_user_required
def get_water_supply_data():
    """
    Get monthly water supply data by location.
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

    if settlement:
        system = WaterSystem.query.filter_by(
            tehsil=ct,
            village=village,
            settlement=settlement
        ).first()
    else:
        system = WaterSystem.query.filter_by(
            tehsil=ct,
            village=village
        ).filter(
            or_(
                WaterSystem.settlement.is_(None),
                WaterSystem.settlement == "",
            )
        ).first()
    
    if not system:
        return jsonify([]), 200

    try:
        assert_user_may_log_water_system(user, system)
    except TehsilAccessDenied:
        return jsonify({"message": "Access denied for this water system"}), 403

    query = WaterEnergyLoggingDaily.query.filter_by(water_system_id=system.id)
    if year is not None:
        query = query.filter(extract("year", WaterEnergyLoggingDaily.log_date) == year)

    records = query.order_by(WaterEnergyLoggingDaily.log_date).all()

    return jsonify(
        [
            {
                "id": str(r.id),
                "year": r.log_date.year if r.log_date else None,
                "month": r.log_date.month if r.log_date else None,
                "day": r.log_date.day if r.log_date else None,
                "pump_start_time": time_to_json(r.pump_start_time),
                "pump_end_time": time_to_json(r.pump_end_time),
                "pump_operating_hours": r.pump_operating_hours,
                "total_water_pumped": r.total_water_pumped,
                "bulk_meter_image_url": r.bulk_meter_image_url,
                "status": r.status,
                "remarks": r.remarks,
            }
            for r in records
        ]
    ), 200




@tubewell_operator_bp.route('/water-supply-data', methods=['POST'])
@jwt_required()
@tubewell_user_required
def save_water_supply_data():
    """
    Save monthly water supply data for multiple locations.
    Request body: { data: [...], year: 2025, status: 'drafted'|'submitted' }
    """
    data = request.get_json(silent=True) or {}
    raw_rows = data.get("data")
    if raw_rows is None:
        rows = []
    elif not isinstance(raw_rows, list):
        return jsonify(
            {
                "message": "Invalid payload",
                "errors": ["data must be a JSON array"],
            }
        ), 400
    else:
        rows = raw_rows
    year_raw = data.get('year', datetime.now().year)
    try:
        year = int(year_raw)
    except (TypeError, ValueError):
        return jsonify({"message": "Invalid year", "errors": ["year must be an integer"]}), 400
    status = normalize_water_submission_status(data.get('status'))
    image_url = data.get('image_url') or data.get('image_path')
    current_user_id = get_jwt_identity()
    
    if not rows:
        return jsonify({"message": "No data provided"}), 400
    
    # Record ids saved/updated by this request (useful for drafts).
    saved_record_ids = []
    saved_ids = []
    errors = []
    op_user = UserService.get_user_by_id(current_user_id)
    if status == SUBMISSION_STATUS_SUBMITTED:
        ok, err = _require_operator_signature(op_user)
        if not ok:
            return err

    for i, row in enumerate(rows):
        try:
            if not isinstance(row, dict):
                errors.append(f"Row {i+1}: each data item must be an object")
                continue
            tehsil = row.get('tehsil')
            village = (row.get('village') or '').strip() if isinstance(row.get('village'), str) else row.get('village')
            if village is not None and not isinstance(village, str):
                village = str(village).strip()
            settlement = row.get('settlement', '') or ''
            if isinstance(settlement, str):
                settlement = settlement.strip()
            else:
                settlement = str(settlement).strip() if settlement is not None else ''
            monthly_data = row.get('monthlyData', [])
            if not isinstance(monthly_data, list):
                errors.append(f"Row {i+1}: monthlyData must be an array")
                continue
            if not village:
                errors.append(f"Row {i+1}: missing village")
                continue

            ct = canonical_tehsil(tehsil)
            if not ct:
                errors.append(f"Row {i+1}: invalid tehsil")
                continue
            try:
                assert_user_may_access_tehsil(op_user, ct, for_write=True)
            except TehsilAccessDenied:
                errors.append(f"Row {i+1}: tehsil not permitted for your account")
                continue

            if settlement:
                system = WaterSystem.query.filter_by(
                    tehsil=ct,
                    village=village,
                    settlement=settlement
                ).first()
            else:
                system = WaterSystem.query.filter_by(
                    tehsil=ct,
                    village=village
                ).filter(
                    or_(
                        WaterSystem.settlement.is_(None),
                        WaterSystem.settlement == "",
                    )
                ).first()

            if not system:
                errors.append(
                    f"Row {i+1}: No water system for this location — your tehsil manager must register it first"
                )
                continue

            try:
                assert_user_may_log_water_system(op_user, system)
            except TehsilAccessDenied:
                errors.append(
                    f"Row {i+1}: this water system is not assigned to your account"
                )
                continue

            # Save monthly data
            for month_record in monthly_data:
                if not isinstance(month_record, dict):
                    errors.append(f"Row {i+1}: each monthlyData item must be an object")
                    continue
                no_bulk_meter_installed = getattr(system, "bulk_meter_installed", True) is False
                month = month_record.get("month")
                try:
                    pump_hours = _coerce_optional_float(
                        month_record.get("pump_operating_hours")
                    )
                    total_water = _coerce_optional_float(
                        month_record.get("total_water_pumped")
                    )
                except ValueError as ve:
                    errors.append(
                        f"Row {i+1}: invalid number in monthlyData ({ve})"
                    )
                    continue
                if month is None:
                    errors.append(f"Row {i+1}: missing month in monthlyData")
                    raise ValueError("missing month")
                try:
                    yi, mi = int(year), int(month)
                except (TypeError, ValueError):
                    errors.append(f"Row {i+1}: invalid year or month in monthlyData")
                    raise ValueError("invalid date")
                day_raw = month_record.get("day")
                today = date.today()
                if day_raw is None or (
                    isinstance(day_raw, str) and not str(day_raw).strip()
                ):
                    # Default: today's calendar day if logging the current month, else 1st
                    if yi == today.year and mi == today.month:
                        day = min(today.day, calendar.monthrange(yi, mi)[1])
                    else:
                        day = 1
                else:
                    try:
                        day = int(day_raw)
                    except (TypeError, ValueError):
                        errors.append(f"Row {i+1}: invalid day in monthlyData")
                        raise ValueError("invalid day")
                last = calendar.monthrange(yi, mi)[1]
                if day < 1 or day > last:
                    errors.append(
                        f"Row {i+1}: day must be between 1 and {last} for this month"
                    )
                    raise ValueError("invalid day range")
                try:
                    log_d = date(yi, mi, day)
                except (TypeError, ValueError):
                    errors.append(f"Row {i+1}: invalid log date")
                    raise ValueError("invalid date")

                start_raw = month_record.get("pump_start_time")
                end_raw = month_record.get("pump_end_time")
                start_time = parse_time_of_day(start_raw)
                end_time = parse_time_of_day(end_raw)
                if start_time is None or end_time is None:
                    errors.append(
                        f"Row {i+1}: pump_start_time and pump_end_time are required and must be valid times"
                    )
                    continue

                if no_bulk_meter_installed:
                    # No-bulk-meter systems are logged by operating interval only.
                    total_water = None

                # Allow multiple logs/day, but reject duplicate interval.
                duplicate_interval = WaterEnergyLoggingDaily.query.filter_by(
                    water_system_id=system.id,
                    log_date=log_d,
                    pump_start_time=start_time,
                    pump_end_time=end_time,
                ).first()
                if duplicate_interval:
                    errors.append(
                        f"Row {i+1}: duplicate log interval for this system/day (same pump_start_time and pump_end_time)"
                    )
                    continue

                new_record = WaterEnergyLoggingDaily(
                    water_system_id=system.id,
                    log_date=log_d,
                    total_water_pumped=total_water,
                    status=status,
                    bulk_meter_image_url=None if no_bulk_meter_installed else image_url,
                    signed=status == SUBMISSION_STATUS_SUBMITTED,
                    signature_svg_snapshot=_signature_svg_or_none(op_user)
                    if status == SUBMISSION_STATUS_SUBMITTED
                    else None,
                )
                apply_pump_time_fields_from_payload(new_record, month_record)
                if (
                    new_record.pump_start_time is None
                    or new_record.pump_end_time is None
                ) and pump_hours is not None:
                    new_record.pump_operating_hours = pump_hours
                db.session.add(new_record)
                db.session.flush()
                saved_record_ids.append(str(new_record.id))

                # If status is submitted, create a verification submission
                if status == SUBMISSION_STATUS_SUBMITTED:
                    rec = new_record
                    record_id_to_link = str(rec.id)
                    existing_sub = Submission.query.filter_by(record_id=record_id_to_link).first()
                    
                    if not existing_sub:
                        current_user = User.query.get(current_user_id)
                        submission = Submission(
                            operator_id=current_user_id,
                            submission_type='water_system',
                            record_id=record_id_to_link,
                            status=SUBMISSION_STATUS_SUBMITTED,
                            submitted_at=datetime.utcnow()
                        )
                        db.session.add(submission)
                        db.session.flush()
                        
                        log_verification_action(
                            submission.id, 'submit', 
                            current_user_id, current_user.role,
                            f'Water data for {month}/{year} submitted via form'
                        )
                        
                        details = (
                            f"New Monthly Water Report ({month}/{year}) submitted by {current_user.name}.\n"
                            f"Location: {system.tehsil}, {system.village} {system.settlement or ''}\n"
                            f"Pump Operating Hours: {rec.pump_operating_hours or 'N/A'}\n"
                            f"Total Water Pumped: {total_water or 'N/A'}"
                        )
                        notify_analysts(
                            'New Detailed Water Submission',
                            details,
                            submission.id,
                            tehsil=system.tehsil,
                        )
                    else:
                        if existing_sub.status in (
                            SUBMISSION_STATUS_REJECTED,
                            SUBMISSION_STATUS_REVERTED_BACK,
                            SUBMISSION_STATUS_DRAFTED,
                        ):
                            existing_sub.status = SUBMISSION_STATUS_SUBMITTED
                            existing_sub.submitted_at = datetime.utcnow()
            
            if row.get("remarks"):
                first_record = (
                    WaterEnergyLoggingDaily.query.filter(
                        WaterEnergyLoggingDaily.water_system_id == system.id,
                        extract("year", WaterEnergyLoggingDaily.log_date) == year,
                    )
                    .order_by(WaterEnergyLoggingDaily.log_date)
                    .first()
                )
                if first_record:
                    first_record.remarks = row.get("remarks")
            
            saved_ids.append(str(system.id))
            
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
    
    if errors:
        db.session.rollback()
        return jsonify({"message": "Validation errors", "errors": errors}), 400
    
    db.session.commit()
    return jsonify({
        "message": f"Saved data for {len(saved_ids)} location(s) as {status}",
        "ids": saved_ids,
        "record_ids": saved_record_ids,
    }), 201

