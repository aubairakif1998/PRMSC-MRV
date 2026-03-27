from flask import Blueprint, request, jsonify, current_app
from app.extensions import db
from app.models.models import (
    WaterSystem, MonthlyWaterData, SolarSystem, MonthlyEnergyData, User,
    Submission, VerificationLog, Notification,
    SUBMISSION_STATUS_DRAFT, SUBMISSION_STATUS_SUBMITTED,
    SUBMISSION_STATUS_UNDER_REVIEW, SUBMISSION_STATUS_VERIFIED,
    SUBMISSION_STATUS_REJECTED, SUBMISSION_STATUS_APPROVED
)
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.utils.decorators import role_required
from app.services import StorageService
import uuid
from datetime import datetime

# Helper to log verification actions (copied from verification.py or imported)
def log_verification_action(submission_id, action_type, user_id, role, comment=None):
    log = VerificationLog(
        submission_id=submission_id,
        action_type=action_type,
        performed_by=user_id,
        role=role,
        comment=comment
    )
    db.session.add(log)

def notify_analysts(title, message, submission_id=None):
    analysts = User.query.filter(User.role.in_(['analyst', 'environment_manager', 'operations_department'])).all()
    for analyst in analysts:
        notification = Notification(
            user_id=analyst.id,
            title=title,
            message=message,
            submission_id=submission_id
        )
        db.session.add(notification)

operator_bp = Blueprint('operator', __name__)

# Helper function to parse date string to Python date object
def parse_date(date_str):
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except:
        return None

# --- Water System APIs ---

@operator_bp.route('/water-system', methods=['POST'])
@jwt_required()
@role_required(['operator'])
def add_water_system():
    print(f"--- ADD WATER SYSTEM CALLED ---")
    data = request.get_json()
    print(f"Data: {data}")
    
    # Check if system already exists at this location
    tehsil = data.get('tehsil')
    village = data.get('village')
    settlement = data.get('settlement', '')
    
    # Query for existing system with same location
    query = WaterSystem.query.filter_by(tehsil=tehsil, village=village)
    if settlement:
        query = query.filter_by(settlement=settlement)
    
    existing_system = query.first()
    
    if existing_system:
        # Update existing system
        existing_system.pump_model = data.get('pump_model')
        existing_system.pump_serial_number = data.get('pump_serial_number')
        existing_system.start_of_operation = parse_date(data.get('start_of_operation'))
        existing_system.depth_of_water_intake = data.get('depth_of_water_intake')
        existing_system.height_to_ohr = data.get('height_to_ohr')
        existing_system.pump_flow_rate = data.get('pump_flow_rate')
        existing_system.meter_model = data.get('meter_model')
        existing_system.meter_serial_number = data.get('meter_serial_number')
        existing_system.meter_accuracy_class = data.get('meter_accuracy_class')
        existing_system.calibration_requirement = data.get('calibration_requirement')
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
        unique_id = f"WS-{tehsil[:3].upper()}-{village[:3].upper()}-{settlement[:3].upper() if settlement else 'XXX'}-{str(uuid.uuid4())[:8]}"
    
    # Helper function to convert empty strings to None for numeric fields
    def to_float_or_none(value):
        if value is None or value == '':
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    new_system = WaterSystem(
        tehsil=tehsil,
        village=village,
        settlement=settlement,
        unique_identifier=unique_id,
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

@operator_bp.route('/water-data', methods=['POST'])
@jwt_required()
@role_required(['operator'])
def submit_water_data():
    data = request.get_json()
    new_record = MonthlyWaterData(
        water_system_id=data.get('water_system_id'),
        year=data.get('year'),
        month=data.get('month'),
        pump_operating_hours=data.get('pump_operating_hours'),
        total_water_pumped=data.get('total_water_pumped'),
        status=data.get('status', 'draft') # Can be 'draft' or 'submitted'
    )
    db.session.add(new_record)
    db.session.commit()
    return jsonify({"message": "Data saved successfully", "id": str(new_record.id)}), 201

# --- Solar System APIs ---

@operator_bp.route('/solar-system', methods=['POST'])
@jwt_required()
@role_required(['operator'])
def add_solar_system():
    data = request.get_json()
    
    # Check if system already exists at this location
    tehsil = data.get('tehsil')
    village = data.get('village')
    settlement = data.get('settlement', '')
    
    # Query for existing system with same location
    query = SolarSystem.query.filter_by(tehsil=tehsil, village=village)
    if settlement:
        query = query.filter_by(settlement=settlement)
    
    existing_system = query.first()
    
    if existing_system:
        # Update existing system
        existing_system.installation_location = data.get('installation_location')
        existing_system.solar_panel_capacity = data.get('solar_panel_capacity')
        existing_system.inverter_capacity = data.get('inverter_capacity')
        existing_system.inverter_serial_number = data.get('inverter_serial_number')
        existing_system.installation_date = parse_date(data.get('installation_date'))
        existing_system.meter_model = data.get('meter_model')
        existing_system.meter_serial_number = data.get('meter_serial_number')
        existing_system.green_meter_connection_date = parse_date(data.get('green_meter_connection_date'))
        existing_system.calibration_date = parse_date(data.get('calibration_date'))
        existing_system.remarks = data.get('remarks')
        
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
        unique_id = f"SS-{tehsil[:3].upper()}-{village[:3].upper()}-{settlement[:3].upper() if settlement else 'XXX'}-{str(uuid.uuid4())[:8]}"
    
    new_system = SolarSystem(
        tehsil=tehsil,
        village=village,
        settlement=settlement,
        unique_identifier=unique_id,
        installation_location=data.get('installation_location'),
        solar_panel_capacity=data.get('solar_panel_capacity'),
        inverter_capacity=data.get('inverter_capacity'),
        inverter_serial_number=data.get('inverter_serial_number'),
        installation_date=parse_date(data.get('installation_date')),
        meter_model=data.get('meter_model'),
        meter_serial_number=data.get('meter_serial_number'),
        green_meter_connection_date=parse_date(data.get('green_meter_connection_date')),
        calibration_date=parse_date(data.get('calibration_date')),
        remarks=data.get('remarks'),
        created_by=get_jwt_identity()
    )
    db.session.add(new_system)
    db.session.commit()
    return jsonify({"message": "Solar system added successfully", "id": str(new_system.id)}), 201

# --- Solar Monthly Data ---

@operator_bp.route('/solar-data', methods=['POST'])
@jwt_required()
@role_required(['operator'])
def submit_solar_data():
    data = request.get_json()
    new_record = MonthlyEnergyData(
        solar_system_id=data.get('solar_system_id'),
        year=data.get('year'),
        month=data.get('month'),
        energy_consumed_from_grid=data.get('energy_consumed_from_grid'),
        energy_exported_to_grid=data.get('energy_exported_to_grid'),
        status=data.get('status', 'draft')
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

@operator_bp.route('/upload', methods=['POST'])
@jwt_required()
@role_required(['operator'])
def upload_image():
    # Check if a file was included in the request
    if 'file' not in request.files:
        return jsonify({"message": "No file provided"}), 400

    file = request.files['file']
    record_id = request.form.get('record_id')
    record_type = request.form.get('record_type', 'water')  # 'water' or 'solar'

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
            record = MonthlyWaterData.query.get(record_id)
            if record:
                record.bulk_meter_image_url = image_url
                db.session.commit()
        elif record_type == 'solar':
            record = MonthlyEnergyData.query.get(record_id)
            if record:
                record.electricity_bill_image_url = image_url
                db.session.commit()

    return jsonify({
        "message": "File uploaded successfully",
        "image_url": image_url,
        "path": image_url,
        "bucket": upload_result["bucket"],
        "object_key": upload_result["object_key"],
    }), 201


# ─────────────────────────────────────────
# BULK DATA ENDPOINTS for Smart Table
# ─────────────────────────────────────────

@operator_bp.route('/water-data/bulk', methods=['POST'])
@jwt_required()
@role_required(['operator'])
def bulk_save_water_data():
    """
    Receives an array of monthly water records from the Smart Table.
    Each row in the table becomes one record in the database.

    Request body: { rows: [...], status: 'draft'|'submitted', year: 2024 }
    Each row: { water_system_id, month, pump_operating_hours, total_water_pumped }
    """
    data = request.get_json()
    rows = data.get('rows', [])
    status = data.get('status', 'draft')
    year = data.get('year', datetime.now().year)

    if not rows:
        return jsonify({"message": "No data provided"}), 400

    saved_ids = []
    errors = []

    for i, row in enumerate(rows):
        try:
            # Validate required fields
            if not row.get('water_system_id'):
                errors.append(f"Row {i+1}: missing water_system_id")
                continue

            month = row.get('month')

            record = MonthlyWaterData(
                water_system_id=row.get('water_system_id'),
                year=year,
                month=month,
                pump_operating_hours=row.get('pump_operating_hours'),
                total_water_pumped=row.get('total_water_pumped'),
                status=status
            )
            db.session.add(record)
            db.session.flush()  # Get ID without committing
            saved_ids.append(str(record.id))

            # If status is submitted, create a verification submission
            if status == SUBMISSION_STATUS_SUBMITTED:
                current_user_id = get_jwt_identity()
                current_user = User.query.get(current_user_id)
                
                # Check if submission already exists
                existing = Submission.query.filter_by(record_id=str(record.id)).first()
                if not existing:
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
                        submission.id, 'submit', 
                        current_user_id, current_user.role,
                        f'Water data for month {month}/{year} submitted in bulk'
                    )
                    
                    system = WaterSystem.query.get(record.water_system_id)
                    details = (
                        f"New Monthly Water Report ({month}/{year}) submitted by {current_user.name}.\n"
                        f"Location: {system.tehsil}, {system.village} {system.settlement or ''}\n"
                        f"Pump Operating Hours: {record.pump_operating_hours or 'N/A'}\n"
                        f"Total Water Pumped: {record.total_water_pumped or 'N/A'}"
                    )
                    notify_analysts(
                        'New Detailed Water Submission',
                        details,
                        submission.id
                    )
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")

    if errors:
        db.session.rollback()
        return jsonify({"message": "Validation errors", "errors": errors}), 400

    db.session.commit()
    return jsonify({
        "message": f"Saved {len(saved_ids)} records with status '{status}'",
        "ids": saved_ids
    }), 201


@operator_bp.route('/solar-data/bulk', methods=['POST'])
@jwt_required()
@role_required(['operator'])
def bulk_save_solar_data():
    """
    Receives an array of monthly solar records from the Smart Table.
    """
    data = request.get_json()
    rows = data.get('rows', [])
    status = data.get('status', 'draft')
    year = data.get('year', datetime.now().year)

    if not rows:
        return jsonify({"message": "No data provided"}), 400

    saved_ids = []
    errors = []

    for i, row in enumerate(rows):
        try:
            if not row.get('solar_system_id'):
                errors.append(f"Row {i+1}: missing solar_system_id")
                continue
                
            month = row.get('month')

            record = MonthlyEnergyData(
                solar_system_id=row.get('solar_system_id'),
                year=year,
                month=month,
                energy_consumed_from_grid=row.get('energy_consumed_from_grid'),
                energy_exported_to_grid=row.get('energy_exported_to_grid'),
                status=status
            )
            db.session.add(record)
            db.session.flush()
            saved_ids.append(str(record.id))

            # If status is submitted, create a verification submission
            if status == SUBMISSION_STATUS_SUBMITTED:
                current_user_id = get_jwt_identity()
                current_user = User.query.get(current_user_id)
                
                # Check if submission already exists
                existing = Submission.query.filter_by(record_id=str(record.id)).first()
                if not existing:
                    submission = Submission(
                        operator_id=current_user_id,
                        submission_type='solar_system',
                        record_id=str(record.id),
                        status=SUBMISSION_STATUS_SUBMITTED,
                        submitted_at=datetime.utcnow()
                    )
                    db.session.add(submission)
                    db.session.flush()
                    
                    log_verification_action(
                        submission.id, 'submit', 
                        current_user_id, current_user.role,
                        f'Solar data for month {month}/{year} submitted in bulk'
                    )
                    
                    system = SolarSystem.query.get(record.solar_system_id)
                    details = (
                        f"New Monthly Solar Report ({month}/{year}) submitted by {current_user.name}.\n"
                        f"Location: {system.tehsil}, {system.village} {system.settlement or ''}\n"
                        f"Energy Consumed from Grid: {record.energy_consumed_from_grid or 'N/A'}\n"
                        f"Energy Exported to Grid: {record.energy_exported_to_grid or 'N/A'}"
                    )
                    notify_analysts(
                        'New Detailed Solar Submission',
                        details,
                        submission.id
                    )
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")

    if errors:
        db.session.rollback()
        return jsonify({"message": "Validation errors", "errors": errors}), 400

    db.session.commit()
    return jsonify({
        "message": f"Saved {len(saved_ids)} records with status '{status}'",
        "ids": saved_ids
    }), 201


@operator_bp.route('/water-systems', methods=['GET'])
@jwt_required()
@role_required(['operator', 'analyst', 'environment_manager'])
def get_water_systems():
    """Fetch water systems created by current operator."""
    current_user_id = get_jwt_identity()
    systems = WaterSystem.query.filter_by(created_by=current_user_id).all()
    return jsonify([{
        "id": str(s.id),
        "tehsil": s.tehsil,
        "village": s.village,
        "settlement": s.settlement,
        "unique_identifier": s.unique_identifier,
        "pump_model": s.pump_model,
        "created_at": s.created_at.isoformat() if s.created_at else None
    } for s in systems]), 200


@operator_bp.route('/water-system/<system_id>', methods=['DELETE'])
@jwt_required()
@role_required(['operator'])
def delete_water_system(system_id):
    """Delete a water system and all its associated data."""
    current_user_id = get_jwt_identity()
    
    system = WaterSystem.query.filter_by(id=system_id, created_by=current_user_id).first()
    if not system:
        return jsonify({"message": "Water system not found"}), 404
    
    # Delete associated monthly water data first
    MonthlyWaterData.query.filter_by(water_system_id=system_id).delete()
    
    db.session.delete(system)
    db.session.commit()
    
    return jsonify({"message": "Water system deleted successfully"}), 200


@operator_bp.route('/solar-systems', methods=['GET'])
@jwt_required()
@role_required(['operator', 'analyst', 'environment_manager'])
def get_solar_systems():
    """Fetch all solar systems (for populating table's system selector)."""
    current_user_id = get_jwt_identity()
    systems = SolarSystem.query.filter_by(created_by=current_user_id).all()
    return jsonify([{
        "id": str(s.id),
        "tehsil": s.tehsil,
        "village": s.village,
        "settlement": s.settlement,
        "unique_identifier": s.unique_identifier,
        "solar_panel_capacity": s.solar_panel_capacity,
        "created_by": s.created_by,
    } for s in systems]), 200


@operator_bp.route('/solar-system/<system_id>', methods=['DELETE'])
@jwt_required()
@role_required(['operator'])
def delete_solar_system(system_id):
    """Delete a solar system and all its associated data."""
    current_user_id = get_jwt_identity()
    
    system = SolarSystem.query.filter_by(id=system_id, created_by=current_user_id).first()
    if not system:
        return jsonify({"message": "Solar system not found"}), 404
    
    # Delete associated monthly energy data first
    MonthlyEnergyData.query.filter_by(solar_system_id=system_id).delete()
    
    db.session.delete(system)
    db.session.commit()
    
    return jsonify({"message": "Solar system deleted successfully"}), 200


@operator_bp.route('/water-system-config', methods=['GET'])
@jwt_required()
@role_required(['operator'])
def get_water_system_config():
    """Get water system configuration by location for auto-fill."""
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    settlement = request.args.get('settlement', '')
    
    if not tehsil or not village:
        return jsonify({"message": "Tehsil and village are required"}), 400
    
    # Query for existing system with same location
    # If settlement is provided, search by settlement
    # If settlement is empty/NULL, search for records where settlement is NULL
    if settlement:
        query = WaterSystem.query.filter_by(tehsil=tehsil, village=village, settlement=settlement)
    else:
        # Search for records where settlement is NULL (empty in the database)
        query = WaterSystem.query.filter_by(tehsil=tehsil, village=village).filter(WaterSystem.settlement == None)
    
    system = query.first()
    
    if system:
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


@operator_bp.route('/solar-system-config', methods=['GET'])
@jwt_required()
@role_required(['operator'])
def get_solar_system_config():
    """Get solar system configuration by location for auto-fill."""
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    settlement = request.args.get('settlement', '')
    
    if not tehsil or not village:
        return jsonify({"message": "Tehsil and village are required"}), 400
    
    # Query for existing system with same location
    # If settlement is provided, search by settlement
    # If settlement is empty/NULL, search for records where settlement is NULL
    if settlement:
        query = SolarSystem.query.filter_by(tehsil=tehsil, village=village, settlement=settlement)
    else:
        # Search for records where settlement is NULL (empty in the database)
        query = SolarSystem.query.filter_by(tehsil=tehsil, village=village).filter(SolarSystem.settlement == None)
    
    system = query.first()
    
    if system:
        return jsonify({
            "exists": True,
            "config": {
                "installation_location": system.installation_location,
                "solar_panel_capacity": system.solar_panel_capacity,
                "inverter_capacity": system.inverter_capacity,
                "inverter_serial_number": system.inverter_serial_number,
                "installation_date": system.installation_date.isoformat() if system.installation_date else None,
                "meter_model": system.meter_model,
                "meter_serial_number": system.meter_serial_number,
                "green_meter_connection_date": system.green_meter_connection_date.isoformat() if system.green_meter_connection_date else None,
                "calibration_date": system.calibration_date.isoformat() if system.calibration_date else None,
                "remarks": system.remarks,
            }
        }), 200
    
    # NO FALLBACK - if no data found, return empty
    return jsonify({"exists": False, "config": None}), 200

# ============================================================
# DRAFT DATA APIs - Save and manage draft entries
# ============================================================

@operator_bp.route('/water-data/drafts', methods=['GET'])
@jwt_required()
def get_water_drafts():
    """Get all draft water data records for the current operator."""
    current_user_id = get_jwt_identity()
    
    # Get water systems created by this operator
    water_systems = WaterSystem.query.filter_by(created_by=current_user_id).all()
    system_ids = [s.id for s in water_systems]
    
    # Get drafts
    drafts = MonthlyWaterData.query.filter(
        MonthlyWaterData.water_system_id.in_(system_ids) if system_ids else False,
        MonthlyWaterData.status == 'draft'
    ).order_by(MonthlyWaterData.created_at.desc()).all()
    
    result = []
    for draft in drafts:
        system = WaterSystem.query.get(draft.water_system_id)
        result.append({
            'id': str(draft.id),
            'system_id': str(draft.water_system_id),
            'village': system.village if system else 'Unknown',
            'tehsil': system.tehsil if system else 'Unknown',
            'year': draft.year,
            'month': draft.month,
            'status': draft.status,
            'created_at': draft.created_at.isoformat() if draft.created_at else None
        })
    
    return jsonify({'drafts': result})


@operator_bp.route('/solar-data/drafts', methods=['GET'])
@jwt_required()
def get_solar_drafts():
    """Get all draft solar data records for the current operator."""
    current_user_id = get_jwt_identity()
    
    # Get solar systems created by this operator
    solar_systems = SolarSystem.query.filter_by(created_by=current_user_id).all()
    system_ids = [s.id for s in solar_systems]
    
    # Get drafts
    drafts = MonthlyEnergyData.query.filter(
        MonthlyEnergyData.solar_system_id.in_(system_ids) if system_ids else False,
        MonthlyEnergyData.status == 'draft'
    ).order_by(MonthlyEnergyData.created_at.desc()).all()
    
    result = []
    for draft in drafts:
        system = SolarSystem.query.get(draft.solar_system_id)
        result.append({
            'id': str(draft.id),
            'system_id': str(draft.solar_system_id),
            'village': system.village if system else 'Unknown',
            'tehsil': system.tehsil if system else 'Unknown',
            'year': draft.year,
            'month': draft.month,
            'status': draft.status,
            'created_at': draft.created_at.isoformat() if draft.created_at else None
        })
    
    return jsonify({'drafts': result})


@operator_bp.route('/water-data/draft/<record_id>', methods=['GET'])
@jwt_required()
def get_water_draft(record_id):
    """Get a specific water data draft."""
    current_user_id = get_jwt_identity()
    
    record = MonthlyWaterData.query.get(record_id)
    if not record:
        return jsonify({'error': 'Record not found'}), 404
    
    # Verify ownership
    system = WaterSystem.query.get(record.water_system_id)
    if system.created_by != current_user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify({
        'id': str(record.id),
        'water_system_id': str(record.water_system_id),
        'year': record.year,
        'month': record.month,
        'pump_operating_hours': record.pump_operating_hours,
        'total_water_pumped': record.total_water_pumped,
        'bulk_meter_image_url': record.bulk_meter_image_url,
        'status': record.status,
        # Include system details for auto-fill
        'tehsil': system.tehsil if system else None,
        'village': system.village if system else None,
        'settlement': system.settlement if system else None
    })


@operator_bp.route('/solar-data/draft/<record_id>', methods=['GET'])
@jwt_required()
def get_solar_draft(record_id):
    """Get a specific solar data draft."""
    current_user_id = get_jwt_identity()
    
    record = MonthlyEnergyData.query.get(record_id)
    if not record:
        return jsonify({'error': 'Record not found'}), 404
    
    # Verify ownership
    system = SolarSystem.query.get(record.solar_system_id)
    if system.created_by != current_user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify({
        'id': str(record.id),
        'solar_system_id': str(record.solar_system_id),
        'year': record.year,
        'month': record.month,
        'energy_consumed_from_grid': record.energy_consumed_from_grid,
        'energy_exported_to_grid': record.energy_exported_to_grid,
        'electricity_bill_image_url': record.electricity_bill_image_url,
        'status': record.status,
        # Include system details for auto-fill
        'tehsil': system.tehsil if system else None,
        'village': system.village if system else None,
        'settlement': system.settlement if system else None
    })


@operator_bp.route('/water-data/draft/<record_id>', methods=['PUT'])
@jwt_required()
def update_water_draft(record_id):
    """Update a water data draft."""
    current_user_id = get_jwt_identity()
    
    record = MonthlyWaterData.query.get(record_id)
    if not record:
        return jsonify({'error': 'Record not found'}), 404
    
    # Only allow editing drafts
    if record.status != 'draft':
        return jsonify({'error': 'Only draft records can be edited'}), 400
    
    # Verify ownership
    system = WaterSystem.query.get(record.water_system_id)
    if system.created_by != current_user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    if 'pump_operating_hours' in data:
        record.pump_operating_hours = data['pump_operating_hours']
    if 'total_water_pumped' in data:
        record.total_water_pumped = data['total_water_pumped']
    if 'year' in data:
        record.year = data['year']
    if 'month' in data:
        record.month = data['month']
    
    db.session.commit()
    
    return jsonify({'message': 'Draft updated successfully', 'id': str(record.id)})


@operator_bp.route('/solar-data/draft/<record_id>', methods=['PUT'])
@jwt_required()
def update_solar_draft(record_id):
    """Update a solar data draft."""
    current_user_id = get_jwt_identity()
    
    record = MonthlyEnergyData.query.get(record_id)
    if not record:
        return jsonify({'error': 'Record not found'}), 404
    
    # Only allow editing drafts
    if record.status != 'draft':
        return jsonify({'error': 'Only draft records can be edited'}), 400
    
    # Verify ownership
    system = SolarSystem.query.get(record.solar_system_id)
    if system.created_by != current_user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    if 'energy_consumed_from_grid' in data:
        record.energy_consumed_from_grid = data['energy_consumed_from_grid']
    if 'energy_exported_to_grid' in data:
        record.energy_exported_to_grid = data['energy_exported_to_grid']
    if 'year' in data:
        record.year = data['year']
    if 'month' in data:
        record.month = data['month']
    
    db.session.commit()
    
    return jsonify({'message': 'Draft updated successfully', 'id': str(record.id)})


@operator_bp.route('/water-data/draft/<record_id>/submit', methods=['POST'])
@jwt_required()
def submit_water_draft(record_id):
    """Submit a water data draft for verification."""
    current_user_id = get_jwt_identity()
    
    record = MonthlyWaterData.query.get(record_id)
    if not record:
        return jsonify({'error': 'Record not found'}), 404
    
    # Only allow submitting drafts
    if record.status != 'draft':
        return jsonify({'error': 'Only draft records can be submitted'}), 400
    
    # Verify ownership
    system = WaterSystem.query.get(record.water_system_id)
    if system.created_by != current_user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Change status to submitted
    record.status = 'submitted'
    
    existing_sub = Submission.query.filter_by(record_id=str(record.id)).first()
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
        
        current_user = User.query.get(current_user_id)
        log_verification_action(
            submission.id, 'submit', 
            current_user_id, current_user.role,
            f'Water data for {record.month}/{record.year} submitted from draft'
        )
        
        details = (
            f"New Monthly Water Report ({record.month}/{record.year}) submitted by {current_user.name}.\n"
            f"Location: {system.tehsil}, {system.village} {system.settlement or ''}\n"
            f"Pump Operating Hours: {record.pump_operating_hours or 'N/A'}\n"
            f"Total Water Pumped: {record.total_water_pumped or 'N/A'}"
        )
        notify_analysts(
            'New Detailed Water Submission',
            details,
            submission.id
        )

    db.session.commit()
    
    return jsonify({
        'message': 'Data submitted for verification',
        'id': str(record.id),
        'status': record.status
    })


@operator_bp.route('/water-data/draft/<record_id>', methods=['DELETE'])
@jwt_required()
def delete_water_draft(record_id):
    """Delete a water data draft."""
    current_user_id = get_jwt_identity()
    
    record = MonthlyWaterData.query.get(record_id)
    if not record:
        return jsonify({'error': 'Record not found'}), 404
    
    # Verify ownership
    system = WaterSystem.query.get(record.water_system_id)
    if system and system.created_by != current_user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    db.session.delete(record)
    db.session.commit()
    
    return jsonify({'message': 'Draft deleted successfully'}), 200


@operator_bp.route('/solar-data/draft/<record_id>/submit', methods=['POST'])
@jwt_required()
def submit_solar_draft(record_id):
    """Submit a solar data draft for verification."""
    current_user_id = get_jwt_identity()
    
    record = MonthlyEnergyData.query.get(record_id)
    if not record:
        return jsonify({'error': 'Record not found'}), 404
    
    # Only allow submitting drafts
    if record.status != 'draft':
        return jsonify({'error': 'Only draft records can be submitted'}), 400
    
    # Verify ownership
    system = SolarSystem.query.get(record.solar_system_id)
    if system.created_by != current_user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Change status to submitted
    record.status = 'submitted'
    
    existing_sub = Submission.query.filter_by(record_id=str(record.id)).first()
    if not existing_sub:
        submission = Submission(
            operator_id=current_user_id,
            submission_type='solar_system',
            record_id=str(record.id),
            status=SUBMISSION_STATUS_SUBMITTED,
            submitted_at=datetime.utcnow()
        )
        db.session.add(submission)
        db.session.flush()
        
        current_user = User.query.get(current_user_id)
        log_verification_action(
            submission.id, 'submit', 
            current_user_id, current_user.role,
            f'Solar data for {record.month}/{record.year} submitted from draft'
        )
        
        details = (
            f"New Monthly Solar Report ({record.month}/{record.year}) submitted by {current_user.name}.\n"
            f"Location: {system.tehsil}, {system.village} {system.settlement or ''}\n"
            f"Energy Consumed from Grid: {record.energy_consumed_from_grid or 'N/A'}\n"
            f"Energy Exported to Grid: {record.energy_exported_to_grid or 'N/A'}"
        )
        notify_analysts(
            'New Detailed Solar Submission',
            details,
            submission.id
        )

    db.session.commit()
    
    return jsonify({
        'message': 'Data submitted for verification',
        'id': str(record.id),
        'status': record.status
    })


@operator_bp.route('/solar-data/draft/<record_id>', methods=['DELETE'])
@jwt_required()
def delete_solar_draft(record_id):
    """Delete a solar data draft."""
    current_user_id = get_jwt_identity()
    
    record = MonthlyEnergyData.query.get(record_id)
    if not record:
        return jsonify({'error': 'Record not found'}), 404
    
    # Verify ownership
    system = SolarSystem.query.get(record.solar_system_id)
    if system and system.created_by != current_user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    db.session.delete(record)
    db.session.commit()
    
    return jsonify({'message': 'Draft deleted successfully'}), 200


# ============================================================
# MONTHLY WATER SUPPLY DATA APIs (New Form)
# ============================================================

@operator_bp.route('/water-supply-data', methods=['GET'])
@jwt_required()
@role_required(['operator'])
def get_water_supply_data():
    """
    Get monthly water supply data by location.
    Query params: tehsil, village, settlement, year
    """
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    settlement = request.args.get('settlement', '')
    year = request.args.get('year', type=int)
    
    if not tehsil or not village:
        return jsonify({"message": "Tehsil and village are required"}), 400
    
    # Find water system by location
    if settlement:
        system = WaterSystem.query.filter_by(
            tehsil=tehsil, 
            village=village, 
            settlement=settlement
        ).first()
    else:
        system = WaterSystem.query.filter_by(
            tehsil=tehsil, 
            village=village
        ).filter(WaterSystem.settlement == None).first()
    
    if not system:
        return jsonify([]), 200
    
    # Get monthly data for this system and year
    query = MonthlyWaterData.query.filter_by(water_system_id=system.id)
    if year:
        query = query.filter_by(year=year)
    
    records = query.order_by(MonthlyWaterData.month).all()
    
    return jsonify([{
        'id': str(r.id),
        'year': r.year,
        'month': r.month,
        'pump_operating_hours': r.pump_operating_hours,
        'total_water_pumped': r.total_water_pumped,
        'status': r.status,
        'remarks': r.remarks
    } for r in records]), 200


@operator_bp.route('/water-supply-data', methods=['POST'])
@jwt_required()
@role_required(['operator'])
def save_water_supply_data():
    """
    Save monthly water supply data for multiple locations.
    Request body: { data: [...], year: 2025, status: 'draft'|'submitted' }
    """
    data = request.get_json()
    rows = data.get('data', [])
    year = data.get('year', datetime.now().year)
    status = data.get('status', 'draft')
    image_url = data.get('image_url') or data.get('image_path')
    current_user_id = get_jwt_identity()
    
    if not rows:
        return jsonify({"message": "No data provided"}), 400
    
    saved_record_ids = []
    saved_ids = []
    errors = []
    
    for i, row in enumerate(rows):
        try:
            tehsil = row.get('tehsil')
            village = row.get('village')
            settlement = row.get('settlement', '')
            monthly_data = row.get('monthlyData', [])
            
            # Find or create water system
            if settlement:
                system = WaterSystem.query.filter_by(
                    tehsil=tehsil,
                    village=village,
                    settlement=settlement
                ).first()
            else:
                system = WaterSystem.query.filter_by(
                    tehsil=tehsil,
                    village=village
                ).filter(WaterSystem.settlement == None).first()
            
            if not system:
                # Create new system
                unique_id = f"WS-{tehsil[:3].upper()}-{village[:3].upper()}-{str(uuid.uuid4())[:8]}"
                system = WaterSystem(
                    tehsil=tehsil,
                    village=village,
                    settlement=settlement,
                    unique_identifier=unique_id,
                    created_by=current_user_id
                )
                db.session.add(system)
                db.session.flush()
            
            # Save monthly data
            for month_record in monthly_data:
                month = month_record.get('month')
                pump_hours = month_record.get('pump_operating_hours')
                total_water = month_record.get('total_water_pumped')
                
                # Check if record exists
                existing = MonthlyWaterData.query.filter_by(
                    water_system_id=system.id,
                    year=year,
                    month=month
                ).first()
                
                if existing:
                    existing.pump_operating_hours = pump_hours
                    existing.total_water_pumped = total_water
                    existing.status = status
                else:
                    new_record = MonthlyWaterData(
                        water_system_id=system.id,
                        year=year,
                        month=month,
                        pump_operating_hours=pump_hours,
                        total_water_pumped=total_water,
                        status=status,
                        bulk_meter_image_url=image_url
                    )
                    db.session.add(new_record)
                    db.session.flush()
                
                if existing and image_url:
                    existing.bulk_meter_image_url = image_url

                # If status is submitted, create a verification submission
                if status == SUBMISSION_STATUS_SUBMITTED:
                    # Check if submission already exists
                    record_id_to_link = str(existing.id) if existing else str(new_record.id)
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
                            f"Pump Operating Hours: {pump_hours or 'N/A'}\n"
                            f"Total Water Pumped: {total_water or 'N/A'}"
                        )
                        notify_analysts(
                            'New Detailed Water Submission',
                            details,
                            submission.id
                        )
            
            # Update remarks if provided
            if row.get('remarks'):
                first_record = MonthlyWaterData.query.filter_by(
                    water_system_id=system.id,
                    year=year
                ).first()
                if first_record:
                    first_record.remarks = row.get('remarks')
            
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


# ============================================================
# SOLAR SUPPLY DATA APIs (similar to water-supply-data)
# ============================================================

@operator_bp.route('/solar-supply-data', methods=['GET'])
@jwt_required()
@role_required(['operator'])
def get_solar_supply_data():
    """
    Get monthly solar energy data by location.
    Query params: tehsil, village, settlement, year
    """
    tehsil = request.args.get('tehsil')
    village = request.args.get('village')
    settlement = request.args.get('settlement', '')
    year = request.args.get('year', type=int)
    
    if not tehsil or not village:
        return jsonify({"message": "Tehsil and village are required"}), 400
    
    # Find solar system by location
    if settlement:
        system = SolarSystem.query.filter_by(
            tehsil=tehsil, 
            village=village, 
            settlement=settlement
        ).first()
    else:
        system = SolarSystem.query.filter_by(
            tehsil=tehsil, 
            village=village
        ).filter(SolarSystem.settlement == None).first()
    
    if not system:
        return jsonify([]), 200
    
    # Get monthly data for this system and year
    query = MonthlyEnergyData.query.filter_by(solar_system_id=system.id)
    if year:
        query = query.filter_by(year=year)
    
    records = query.order_by(MonthlyEnergyData.month).all()
    
    return jsonify([{
        'id': str(r.id),
        'year': r.year,
        'month': r.month,
        'energy_consumed_from_grid': r.energy_consumed_from_grid,
        'energy_exported_to_grid': r.energy_exported_to_grid,
        'status': r.status,
        'remarks': r.remarks
    } for r in records]), 200


@operator_bp.route('/solar-supply-data', methods=['POST'])
@jwt_required()
@role_required(['operator'])
def save_solar_supply_data():
    """
    Save monthly solar energy data for multiple locations.
    Request body: { data: [...], year: 2025, status: 'draft'|'submitted' }
    """
    data = request.get_json()
    rows = data.get('data', [])
    year = data.get('year', datetime.now().year)
    status = data.get('status', 'draft')
    image_url = data.get('image_url') or data.get('image_path')
    current_user_id = get_jwt_identity()
    
    if not rows:
        return jsonify({"message": "No data provided"}), 400
    
    saved_record_ids = []
    saved_ids = []
    errors = []
    
    for i, row in enumerate(rows):
        try:
            tehsil = row.get('tehsil')
            village = row.get('village')
            settlement = row.get('settlement', '')
            monthly_data = row.get('monthlyData', [])
            
            # Find or create solar system
            if settlement:
                system = SolarSystem.query.filter_by(
                    tehsil=tehsil,
                    village=village,
                    settlement=settlement
                ).first()
            else:
                system = SolarSystem.query.filter_by(
                    tehsil=tehsil,
                    village=village
                ).filter(SolarSystem.settlement == None).first()
            
            if not system:
                # Create new system
                unique_id = f"SS-{tehsil[:3].upper()}-{village[:3].upper()}-{str(uuid.uuid4())[:8]}"
                system = SolarSystem(
                    tehsil=tehsil,
                    village=village,
                    settlement=settlement,
                    unique_identifier=unique_id,
                    created_by=current_user_id
                )
                db.session.add(system)
                db.session.flush()
            
            # Save monthly data
            for month_record in monthly_data:
                month = month_record.get('month')
                energy_consumed = month_record.get('energy_consumed_from_grid')
                energy_exported = month_record.get('energy_exported_to_grid')
                
                # Check if record exists
                existing = MonthlyEnergyData.query.filter_by(
                    solar_system_id=system.id,
                    year=year,
                    month=month
                ).first()
                
                if existing:
                    existing.energy_consumed_from_grid = energy_consumed
                    existing.energy_exported_to_grid = energy_exported
                    existing.status = status
                else:
                    new_record = MonthlyEnergyData(
                        solar_system_id=system.id,
                        year=year,
                        month=month,
                        energy_consumed_from_grid=energy_consumed,
                        energy_exported_to_grid=energy_exported,
                        status=status,
                        electricity_bill_image_url=image_url
                    )
                    db.session.add(new_record)
                    db.session.flush()
                
                if existing and image_url:
                    existing.electricity_bill_image_url = image_url

                # If status is submitted, create a verification submission
                if status == SUBMISSION_STATUS_SUBMITTED:
                    # Check if submission already exists
                    record_id_to_link = str(existing.id) if existing else str(new_record.id)
                    saved_record_ids.append(record_id_to_link)
                    existing_sub = Submission.query.filter_by(record_id=record_id_to_link).first()
                    
                    if not existing_sub:
                        current_user = User.query.get(current_user_id)
                        submission = Submission(
                            operator_id=current_user_id,
                            submission_type='solar_system',
                            record_id=record_id_to_link,
                            status=SUBMISSION_STATUS_SUBMITTED,
                            submitted_at=datetime.utcnow()
                        )
                        db.session.add(submission)
                        db.session.flush()
                        
                        log_verification_action(
                            submission.id, 'submit', 
                            current_user_id, current_user.role,
                            f'Solar data for {month}/{year} submitted via form'
                        )
                        
                        details = (
                            f"New Monthly Solar Report ({month}/{year}) submitted by {current_user.name}.\n"
                            f"Location: {system.tehsil}, {system.village} {system.settlement or ''}\n"
                            f"Energy Consumed from Grid: {energy_consumed or 'N/A'}\n"
                            f"Energy Exported to Grid: {energy_exported or 'N/A'}"
                        )
                        notify_analysts(
                            'New Detailed Solar Submission',
                            details,
                            submission.id
                        )
            
            saved_ids.append(str(system.id))
            
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")
    
    if errors:
        db.session.rollback()
        return jsonify({"message": "Validation errors", "errors": errors}), 400
    
    db.session.commit()
    return jsonify({
        "message": f"Saved solar data for {len(saved_ids)} location(s) as {status}",
        "ids": saved_ids
    }), 201

# --- PDF Report Generation ---

@operator_bp.route('/water-report-pdf/<system_id>/<int:year>', methods=['GET'])
@jwt_required()
@role_required(['operator', 'analyst', 'environment_manager'])
def generate_water_report_pdf(system_id, year):
    """
    Generate a PDF report for monthly water data.
    Returns a PDF file for download.
    """
    from fpdf import FPDF
    import datetime
    
    # Get water system info
    water_system = WaterSystem.query.get(system_id)
    if not water_system:
        return jsonify({"message": "Water system not found"}), 404
    
    # Get monthly data for the year
    monthly_records = MonthlyWaterData.query.filter_by(
        water_system_id=system_id,
        year=year
    ).order_by(MonthlyWaterData.month).all()
    
    # Create PDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font('Arial', 'B', 16)
    
    # Title
    pdf.cell(0, 10, f'Monthly Water System Report - {year}', 0, 1, 'C')
    pdf.ln(5)
    
    # System Information
    pdf.set_font('Arial', 'B', 12)
    pdf.cell(0, 10, 'System Information', 0, 1)
    pdf.set_font('Arial', '', 10)
    pdf.cell(50, 8, f'Tehsil: {water_system.tehsil}', 0, 1)
    pdf.cell(50, 8, f'Village: {water_system.village}', 0, 1)
    pdf.cell(50, 8, f'Settlement: {water_system.settlement or "N/A"}', 0, 1)
    pdf.cell(50, 8, f'Unique ID: {water_system.unique_identifier}', 0, 1)
    pdf.ln(5)
    
    # Monthly Data Table Header
    pdf.set_font('Arial', 'B', 11)
    pdf.cell(30, 10, 'Month', 1)
    pdf.cell(50, 10, 'Pump Hours', 1)
    pdf.cell(50, 10, 'Water Pumped (m3)', 1)
    pdf.cell(30, 10, 'Status', 1)
    pdf.ln()
    
    # Monthly Data Rows
    pdf.set_font('Arial', '', 10)
    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    total_hours = 0
    total_water = 0
    
    for record in monthly_records:
        pdf.cell(30, 8, month_names[record.month - 1], 1)
        pdf.cell(50, 8, str(record.pump_operating_hours or 0), 1)
        pdf.cell(50, 8, str(record.total_water_pumped or 0), 1)
        pdf.cell(30, 8, record.status, 1)
        pdf.ln()
        
        total_hours += record.pump_operating_hours or 0
        total_water += record.total_water_pumped or 0
    
    # Totals
    pdf.set_font('Arial', 'B', 10)
    pdf.cell(30, 8, 'TOTAL', 1)
    pdf.cell(50, 8, f'{total_hours:.2f}', 1)
    pdf.cell(50, 8, f'{total_water:.2f}', 1)
    pdf.cell(30, 8, '', 1)
    pdf.ln(10)
    
    # Footer
    pdf.set_font('Arial', 'I', 8)
    pdf.cell(0, 10, f'Generated on: {datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")}', 0, 1, 'C')
    
    # Return PDF as response
    response = pdf.output(dest='S').encode('latin-1')
    from flask import Response
    return Response(
        response,
        mimetype='application/pdf',
        headers={'Content-Disposition': f'attachment; filename=water_report_{system_id}_{year}.pdf'}
    )
