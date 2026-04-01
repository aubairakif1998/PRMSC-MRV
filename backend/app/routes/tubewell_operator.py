from flask import Blueprint, request, jsonify, current_app
from app.extensions import db
from sqlalchemy import extract

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
from app.utils.pump_times import apply_pump_time_fields_from_payload, time_to_json
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
from datetime import date, datetime

tubewell_operator_bp = Blueprint("tubewell_operator", __name__)


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

    data = request.get_json() or {}
    record_id = data.get("record_id")
    if not record_id:
        return jsonify({"error": "record_id is required"}), 400

    submission_type = "water_system"

    record = WaterEnergyLoggingDaily.query.get(record_id)
    if not record:
        return jsonify({"error": "Water data record not found"}), 404

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

    if record_type == "solar":
        if user_role_code(user) != ADMIN:
            return (
                jsonify(
                    {
                        "message": "Solar evidence upload requires tehsil manager role",
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

    folder = 'water-images' if record_type == 'water' else 'solar-images'
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
    """Tubewell operators: assigned systems; ADMIN: tehsil scope; SUPER_ADMIN+ read all."""
    current_user_id = get_jwt_identity()
    user = UserService.get_user_by_id(current_user_id)
    if not user:
        return jsonify({"message": "User not found"}), 404
    rk = user_rank(user)
    ts = list(user_assigned_tehsils(user))
    if rk >= ROLE_RANK[SUPER_ADMIN]:
        systems = WaterSystem.query.all()
    elif user_role_code(user) == USER:
        wids = user.assigned_water_system_ids
        systems = (
            WaterSystem.query.filter(WaterSystem.id.in_(wids)).all() if wids else []
        )
    elif ts:
        systems = WaterSystem.query.filter(WaterSystem.tehsil.in_(ts)).all()
    else:
        systems = []
    return jsonify([{
        "id": str(s.id),
        "tehsil": s.tehsil,
        "village": s.village,
        "settlement": s.settlement,
        "unique_identifier": s.unique_identifier,
        "latitude": getattr(s, "latitude", None),
        "longitude": getattr(s, "longitude", None),
        "pump_model": s.pump_model,
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
        query = WaterSystem.query.filter_by(tehsil=ct, village=village).filter(WaterSystem.settlement == None)
    
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
                "calibration_requirement": system.calibration_requirement,
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
            "pump_start_time": time_to_json(record.pump_start_time),
            "pump_end_time": time_to_json(record.pump_end_time),
            "pump_operating_hours": record.pump_operating_hours,
            "total_water_pumped": record.total_water_pumped,
            "bulk_meter_image_url": record.bulk_meter_image_url,
            "status": record.status,
            "tehsil": system.tehsil if system else None,
            "village": system.village if system else None,
            "settlement": system.settlement if system else None,
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
    if "year" in data or "month" in data:
        y = data.get("year", record.log_date.year if record.log_date else None)
        m = data.get("month", record.log_date.month if record.log_date else None)
        if y is None or m is None:
            return jsonify({"error": "year and month are required to update period"}), 400
        try:
            record.log_date = date(int(y), int(m), 1)
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid year or month"}), 400

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
        ).filter(WaterSystem.settlement == None).first()
    
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
                "pump_start_time": time_to_json(r.pump_start_time),
                "pump_end_time": time_to_json(r.pump_end_time),
                "pump_operating_hours": r.pump_operating_hours,
                "total_water_pumped": r.total_water_pumped,
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
    data = request.get_json()
    rows = data.get('data', [])
    year = data.get('year', datetime.now().year)
    status = normalize_water_submission_status(data.get('status'))
    image_url = data.get('image_url') or data.get('image_path')
    current_user_id = get_jwt_identity()
    
    if not rows:
        return jsonify({"message": "No data provided"}), 400
    
    saved_record_ids = []
    saved_ids = []
    errors = []
    op_user = UserService.get_user_by_id(current_user_id)

    for i, row in enumerate(rows):
        try:
            tehsil = row.get('tehsil')
            village = row.get('village')
            settlement = row.get('settlement', '')
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
                ).filter(WaterSystem.settlement == None).first()

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
                month = month_record.get("month")
                pump_hours = month_record.get("pump_operating_hours")
                total_water = month_record.get("total_water_pumped")
                if month is None:
                    errors.append(f"Row {i+1}: missing month in monthlyData")
                    raise ValueError("missing month")
                try:
                    log_d = date(int(year), int(month), 1)
                except (TypeError, ValueError):
                    errors.append(f"Row {i+1}: invalid year or month in monthlyData")
                    raise ValueError("invalid date")

                existing = WaterEnergyLoggingDaily.query.filter_by(
                    water_system_id=system.id,
                    log_date=log_d,
                ).first()

                if existing:
                    existing.total_water_pumped = total_water
                    existing.status = status
                    apply_pump_time_fields_from_payload(existing, month_record)
                    if (
                        existing.pump_start_time is None or existing.pump_end_time is None
                    ) and pump_hours is not None:
                        existing.pump_operating_hours = pump_hours
                else:
                    new_record = WaterEnergyLoggingDaily(
                        water_system_id=system.id,
                        log_date=log_d,
                        total_water_pumped=total_water,
                        status=status,
                        bulk_meter_image_url=image_url,
                    )
                    apply_pump_time_fields_from_payload(new_record, month_record)
                    if (
                        new_record.pump_start_time is None
                        or new_record.pump_end_time is None
                    ) and pump_hours is not None:
                        new_record.pump_operating_hours = pump_hours
                    db.session.add(new_record)
                    db.session.flush()
                
                if existing and image_url:
                    existing.bulk_meter_image_url = image_url

                # If status is submitted, create a verification submission
                if status == SUBMISSION_STATUS_SUBMITTED:
                    rec = existing if existing else new_record
                    record_id_to_link = str(rec.id)
                    saved_record_ids.append(record_id_to_link)
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
        "ids": saved_ids
    }), 201

