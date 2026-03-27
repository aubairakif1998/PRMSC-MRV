"""
Verification Routes
===================
Handles the complete MRV verification workflow.

Workflow:
1. Operator submits data → status = 'submitted'
2. Analyst reviews → status = 'under_review'  
3. Analyst verifies → status = 'verified' (or 'rejected')
4. Environment Manager approves → status = 'approved'

Only 'approved' data can be used for emission calculations.
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app.extensions import db
from app.models.models import (
    User, Submission, VerificationLog, Notification,
    MonthlyWaterData, MonthlyEnergyData, WaterSystem, SolarSystem,
    SUBMISSION_STATUS_DRAFT, SUBMISSION_STATUS_SUBMITTED, 
    SUBMISSION_STATUS_UNDER_REVIEW, SUBMISSION_STATUS_VERIFIED,
    SUBMISSION_STATUS_REJECTED, SUBMISSION_STATUS_APPROVED
)

verification_bp = Blueprint('verification', __name__, url_prefix='/api/verification')


def log_verification_action(submission_id, action_type, user_id, role, comment=None):
    """
    Helper function to create an audit log entry.
    This creates complete audit trails for compliance.
    """
    log = VerificationLog(
        submission_id=submission_id,
        action_type=action_type,
        performed_by=user_id,
        role=role,
        comment=comment
    )
    db.session.add(log)


def create_notification(user_id, title, message, submission_id=None):
    """
    Helper function to create a notification for a user.
    """
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        submission_id=submission_id
    )
    db.session.add(notification)


def notify_analysts(title, message, submission_id=None):
    """
    Notify all analysts about a new submission or action.
    """
    analysts = User.query.filter(User.role.in_(['analyst', 'environment_manager'])).all()
    for analyst in analysts:
        create_notification(analyst.id, title, message, submission_id)


def notify_operator(operator_id, title, message, submission_id=None):
    """
    Notify an operator about verification status changes.
    """
    create_notification(operator_id, title, message, submission_id)


# ============================================================
# OPERATOR APIs - Submit and Manage Submissions
# ============================================================

@verification_bp.route('/submit', methods=['POST'])
@jwt_required()
def submit_data():
    """
    Operator submits monthly data for verification.
    
    Request body:
    {
        "submission_type": "water_system" | "solar_system",
        "record_id": "uuid of monthly data record"
    }
    
    Returns: Created submission with status 'submitted'
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'operator':
        return jsonify({'error': 'Only operators can submit data'}), 403
    
    data = request.get_json()
    
    # Validate required fields
    if not data or not data.get('submission_type') or not data.get('record_id'):
        return jsonify({'error': 'submission_type and record_id are required'}), 400
    
    submission_type = data['submission_type']
    record_id = data['record_id']
    
    # Validate submission type
    if submission_type not in ['water_system', 'solar_system']:
        return jsonify({'error': 'Invalid submission_type'}), 400
    
    # Check if record exists and belongs to this operator
    if submission_type == 'water_system':
        record = MonthlyWaterData.query.get(record_id)
        if not record:
            return jsonify({'error': 'Water data record not found'}), 404
    else:
        record = MonthlyEnergyData.query.get(record_id)
        if not record:
            return jsonify({'error': 'Solar data record not found'}), 404
    
    # Check if there's already a submission for this record
    existing = Submission.query.filter_by(record_id=record_id).first()
    if existing:
        if existing.status in ['approved', 'under_review']:
            return jsonify({'error': 'This record is already under review or approved'}), 400
        if existing.status == 'submitted':
            return jsonify({'error': 'This record is already submitted'}), 400
        # If rejected, operator can edit and resubmit
    
    # Create new submission
    submission = Submission(
        operator_id=current_user_id,
        submission_type=submission_type,
        record_id=record_id,
        status=SUBMISSION_STATUS_SUBMITTED,
        submitted_at=datetime.utcnow()
    )
    
    # Update the record status
    record.status = SUBMISSION_STATUS_SUBMITTED
    
    # Create audit log
    log_verification_action(
        submission.id, 'submit', 
        current_user_id, current_user.role,
        'Data submitted for verification'
    )
    
    # Notify analysts
    if submission_type == 'water_system':
        system = WaterSystem.query.get(record.water_system_id)
        details = (
            f"New Monthly Water Report ({record.month}/{record.year}) submitted by {current_user.name}.\n"
            f"Location: {system.tehsil}, {system.village} {system.settlement or ''}\n"
            f"Pump Operating Hours: {record.pump_operating_hours or 'N/A'}\n"
            f"Total Water Pumped: {record.total_water_pumped or 'N/A'}"
        )
        notify_analysts('New Detailed Water Submission', details, submission.id)
    else:
        system = SolarSystem.query.get(record.solar_system_id)
        details = (
            f"New Monthly Solar Report ({record.month}/{record.year}) submitted by {current_user.name}.\n"
            f"Location: {system.tehsil}, {system.village} {system.settlement or ''}\n"
            f"Energy Consumed from Grid: {record.energy_consumed_from_grid or 'N/A'}\n"
            f"Energy Exported to Grid: {record.energy_exported_to_grid or 'N/A'}"
        )
        notify_analysts('New Detailed Solar Submission', details, submission.id)
    
    db.session.add(submission)
    db.session.commit()
    
    return jsonify({
        'message': 'Data submitted successfully',
        'submission': {
            'id': submission.id,
            'submission_type': submission.submission_type,
            'status': submission.status,
            'submitted_at': submission.submitted_at.isoformat()
        }
    }), 201


@verification_bp.route('/my-submissions', methods=['GET'])
@jwt_required()
def get_my_submissions():
    """
    Get all submissions by the current operator.
    Includes filters for status.
    """
    current_user_id = get_jwt_identity()
    
    status = request.args.get('status')
    query = Submission.query.filter_by(operator_id=current_user_id)
    
    if status:
        query = query.filter_by(status=status)
    
    submissions = query.order_by(Submission.created_at.desc()).all()
    
    result = []
    for sub in submissions:
        # Get system info
        system_info = {}
        if sub.submission_type == 'water_system':
            record = MonthlyWaterData.query.get(sub.record_id)
            if record:
                system = WaterSystem.query.get(record.water_system_id)
                if system:
                    system_info = {
                        'village': system.village,
                        'tehsil': system.tehsil,
                        'year': record.year,
                        'month': record.month
                    }
        else:
            record = MonthlyEnergyData.query.get(sub.record_id)
            if record:
                system = SolarSystem.query.get(record.solar_system_id)
                if system:
                    system_info = {
                        'village': system.village,
                        'tehsil': system.tehsil,
                        'year': record.year,
                        'month': record.month
                    }
        
        result.append({
            'id': sub.id,
            'submission_type': sub.submission_type,
            'status': sub.status,
            'submitted_at': sub.submitted_at.isoformat() if sub.submitted_at else None,
            'reviewed_at': sub.reviewed_at.isoformat() if sub.reviewed_at else None,
            'approved_at': sub.approved_at.isoformat() if sub.approved_at else None,
            'remarks': sub.remarks,
            'system_info': system_info
        })
    
    return jsonify({'submissions': result})


# ============================================================
# ANALYST APIs - Review and Verify Submissions
# ============================================================

@verification_bp.route('/pending', methods=['GET'])
@jwt_required()
def get_pending_submissions():
    """
    Get all submissions pending verification.
    Analysts see: submitted, under_review, verified, rejected
    Environment Managers see: verified (ready for approval)
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if current_user.role not in ['analyst', 'environment_manager', 'operations_department']:
        return jsonify({'error': 'Access denied'}), 403
    
    # All managerial and analytical roles can see all types of submissions
    statuses = [
        SUBMISSION_STATUS_SUBMITTED, 
        SUBMISSION_STATUS_UNDER_REVIEW, 
        SUBMISSION_STATUS_VERIFIED, 
        SUBMISSION_STATUS_REJECTED,
        SUBMISSION_STATUS_APPROVED
    ]
    
    submissions = Submission.query.filter(Submission.status.in_(statuses)).order_by(
        Submission.submitted_at.asc()
    ).all()
    
    result = []
    for sub in submissions:
        operator = User.query.get(sub.operator_id)
        system_info = {}
        
        if sub.submission_type == 'water_system':
            record = MonthlyWaterData.query.get(sub.record_id)
            if record:
                system = WaterSystem.query.get(record.water_system_id)
                if system:
                    system_info = {
                        'id': system.id,
                        'uid': system.unique_identifier,
                        'village': system.village,
                        'tehsil': system.tehsil,
                        'year': record.year,
                        'month': record.month,
                        'pump_operating_hours': record.pump_operating_hours,
                        'total_water_pumped': record.total_water_pumped,
                        'bulk_meter_image_url': record.bulk_meter_image_url
                    }
        else:
            record = MonthlyEnergyData.query.get(sub.record_id)
            if record:
                system = SolarSystem.query.get(record.solar_system_id)
                if system:
                    system_info = {
                        'id': system.id,
                        'uid': system.unique_identifier,
                        'village': system.village,
                        'tehsil': system.tehsil,
                        'year': record.year,
                        'month': record.month,
                        'energy_consumed_from_grid': record.energy_consumed_from_grid,
                        'energy_exported_to_grid': record.energy_exported_to_grid,
                        'electricity_bill_image_url': record.electricity_bill_image_url
                    }
        
        result.append({
            'id': sub.id,
            'submission_type': sub.submission_type,
            'status': sub.status,
            'operator_name': operator.name if operator else 'Unknown',
            'operator_email': operator.email if operator else 'Unknown',
            'submitted_at': sub.submitted_at.isoformat() if sub.submitted_at else None,
            'remarks': sub.remarks,
            'system_info': system_info,
            'reviewed_by': sub.reviewed_by,
            'approved_by': sub.approved_by
        })
    
    return jsonify({'submissions': result})


@verification_bp.route('/<submission_id>', methods=['GET'])
@jwt_required()
def get_submission_detail(submission_id):
    """
    Get full details of a submission including all data and audit logs.
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if current_user.role not in ['analyst', 'environment_manager', 'operations_department', 'operator']:
        return jsonify({'error': 'Access denied'}), 403
    
    submission = Submission.query.get(submission_id)
    if not submission:
        return jsonify({'error': 'Submission not found'}), 404
        
    if current_user.role == 'operator' and submission.operator_id != current_user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    operator = User.query.get(submission.operator_id)
    reviewer = User.query.get(submission.reviewed_by) if submission.reviewed_by else None
    approver = User.query.get(submission.approved_by) if submission.approved_by else None

    # Get the actual data record
    record_data = {}
    if submission.submission_type == 'water_system':
        record = MonthlyWaterData.query.get(submission.record_id)
        if record:
            system = WaterSystem.query.get(record.water_system_id)
            record_data = {
                'year': record.year,
                'month': record.month,
                'pump_operating_hours': record.pump_operating_hours,
                'total_water_pumped': record.total_water_pumped,
                'bulk_meter_image_url': record.bulk_meter_image_url,
                'system': {
                    'id': system.id if system else None,
                    'unique_identifier': system.unique_identifier if system else None,
                    'village': system.village if system else None,
                    'tehsil': system.tehsil if system else None,
                    'settlement': system.settlement if system else None,
                    'pump_model': system.pump_model if system else None,
                    'pump_serial_number': system.pump_serial_number if system else None,
                    'start_of_operation': system.start_of_operation.isoformat() if system and system.start_of_operation else None,
                    'depth_of_water_intake': system.depth_of_water_intake if system else None,
                    'height_to_ohr': system.height_to_ohr if system else None,
                    'pump_flow_rate': system.pump_flow_rate if system else None,
                    'meter_model': system.meter_model if system else None,
                    'meter_serial_number': system.meter_serial_number if system else None,
                    'meter_accuracy_class': system.meter_accuracy_class if system else None,
                    'calibration_requirement': system.calibration_requirement if system else None,
                    'installation_date': system.installation_date.isoformat() if system and system.installation_date else None,
                }
            }
    else:
        record = MonthlyEnergyData.query.get(submission.record_id)
        if record:
            system = SolarSystem.query.get(record.solar_system_id)
            record_data = {
                'year': record.year,
                'month': record.month,
                'energy_consumed_from_grid': record.energy_consumed_from_grid,
                'energy_exported_to_grid': record.energy_exported_to_grid,
                'electricity_bill_image_url': record.electricity_bill_image_url,
                'system': {
                    'id': system.id if system else None,
                    'unique_identifier': system.unique_identifier if system else None,
                    'village': system.village if system else None,
                    'tehsil': system.tehsil if system else None,
                    'settlement': system.settlement if system else None,
                    'solar_panel_capacity': system.solar_panel_capacity if system else None,
                    'inverter_capacity': system.inverter_capacity if system else None,
                    'inverter_serial_number': system.inverter_serial_number if system else None,
                    'installation_date': system.installation_date.isoformat() if system and system.installation_date else None,
                    'meter_model': system.meter_model if system else None,
                    'meter_serial_number': system.meter_serial_number if system else None,
                    'green_meter_connection_date': system.green_meter_connection_date.isoformat() if system and system.green_meter_connection_date else None,
                    'calibration_date': system.calibration_date.isoformat() if system and system.calibration_date else None,
                    'remarks': system.remarks if system else None
                }
            }
    
    # Get audit logs
    logs = VerificationLog.query.filter_by(submission_id=submission_id).order_by(
        VerificationLog.timestamp.asc()
    ).all()
    
    audit_trail = []
    for log in logs:
        user = User.query.get(log.performed_by)
        audit_trail.append({
            'action_type': log.action_type,
            'performed_by': user.name if user else 'Unknown',
            'role': log.role,
            'comment': log.comment,
            'timestamp': log.timestamp.isoformat()
        })
    
    return jsonify({
        'submission': {
            'id': submission.id,
            'submission_type': submission.submission_type,
            'status': submission.status,
            'operator_name': operator.name if operator else 'Unknown',
            'operator_email': operator.email if operator else 'Unknown',
            'submitted_at': submission.submitted_at.isoformat() if submission.submitted_at else None,
            'reviewed_at': submission.reviewed_at.isoformat() if submission.reviewed_at else None,
            'approved_at': submission.approved_at.isoformat() if submission.approved_at else None,
            'reviewed_by_name': reviewer.name if reviewer else None,
            'approved_by_name': approver.name if approver else None,
            'remarks': submission.remarks
        },
        'record_data': record_data,
        'audit_trail': audit_trail
    })


@verification_bp.route('/<submission_id>/verify', methods=['POST'])
@jwt_required()
def verify_submission(submission_id):
    """
    Analyst verifies a submission after reviewing the data.
    
    Request body:
    {
        "remarks": "Optional comments"
    }
    
    Status changes: submitted/under_review → verified
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'analyst':
        return jsonify({'error': 'Only analysts can verify submissions'}), 403
    
    submission = Submission.query.get(submission_id)
    if not submission:
        return jsonify({'error': 'Submission not found'}), 404
    
    if submission.status not in [SUBMISSION_STATUS_SUBMITTED, SUBMISSION_STATUS_UNDER_REVIEW]:
        return jsonify({'error': f'Cannot verify submission in {submission.status} status'}), 400
    
    data = request.get_json() or {}
    remarks = data.get('remarks', '')
    
    # Update submission
    submission.status = SUBMISSION_STATUS_VERIFIED
    submission.reviewed_at = datetime.utcnow()
    submission.reviewed_by = current_user_id
    submission.remarks = remarks
    
    # Update the actual record status
    if submission.submission_type == 'water_system':
        record = MonthlyWaterData.query.get(submission.record_id)
    else:
        record = MonthlyEnergyData.query.get(submission.record_id)
    
    if record:
        record.status = SUBMISSION_STATUS_VERIFIED
    
    # Create audit log
    log_verification_action(
        submission.id, 'verify',
        current_user_id, current_user.role,
        remarks or 'Submission verified'
    )
    
    # Notify operator
    notify_operator(
        submission.operator_id,
        'Submission Verified',
        f'Your {submission.submission_type} submission has been verified by {current_user.name}',
        submission.id
    )
    
    # Notify environment managers
    notify_analysts(
        'Verification Complete',
        f'{submission.submission_type} data verified by {current_user.name} - Ready for approval',
        submission.id
    )
    
    db.session.commit()
    
    return jsonify({
        'message': 'Submission verified successfully',
        'submission': {
            'id': submission.id,
            'status': submission.status,
            'reviewed_at': submission.reviewed_at.isoformat()
        }
    })


@verification_bp.route('/<submission_id>/reject', methods=['POST'])
@jwt_required()
def reject_submission(submission_id):
    """
    Analyst rejects a submission.
    
    Request body:
    {
        "remarks": "Required reason for rejection"
    }
    
    Status changes: submitted/under_review → rejected
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'analyst':
        return jsonify({'error': 'Only analysts can reject submissions'}), 403
    
    submission = Submission.query.get(submission_id)
    if not submission:
        return jsonify({'error': 'Submission not found'}), 404
    
    if submission.status not in [SUBMISSION_STATUS_SUBMITTED, SUBMISSION_STATUS_UNDER_REVIEW]:
        return jsonify({'error': f'Cannot reject submission in {submission.status} status'}), 400
    
    data = request.get_json() or {}
    remarks = data.get('remarks', '')
    
    if not remarks:
        return jsonify({'error': 'Rejection reason is required'}), 400
    
    # Update submission
    submission.status = SUBMISSION_STATUS_REJECTED
    submission.reviewed_at = datetime.utcnow()
    submission.reviewed_by = current_user_id
    submission.remarks = remarks
    
    # Update the actual record status
    if submission.submission_type == 'water_system':
        record = MonthlyWaterData.query.get(submission.record_id)
    else:
        record = MonthlyEnergyData.query.get(submission.record_id)
    
    if record:
        record.status = SUBMISSION_STATUS_REJECTED
    
    # Create audit log
    log_verification_action(
        submission.id, 'reject',
        current_user_id, current_user.role,
        remarks
    )
    
    # Notify operator
    notify_operator(
        submission.operator_id,
        'Submission Rejected',
        f'Your {submission.submission_type} submission was rejected: {remarks}',
        submission.id
    )
    
    db.session.commit()
    
    return jsonify({
        'message': 'Submission rejected',
        'submission': {
            'id': submission.id,
            'status': submission.status,
            'remarks': submission.remarks
        }
    })


@verification_bp.route('/<submission_id>/approve', methods=['POST'])
@jwt_required()
def approve_submission(submission_id):
    """
    Environment Manager approves a verified submission.
    
    This is the final step - approved data can now be used
    for emission calculations.
    
    Request body:
    {
        "remarks": "Optional comments"
    }
    
    Status changes: verified → approved
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if current_user.role != 'environment_manager':
        return jsonify({'error': 'Only environment managers can approve submissions'}), 403
    
    submission = Submission.query.get(submission_id)
    if not submission:
        return jsonify({'error': 'Submission not found'}), 404
    
    if submission.status != SUBMISSION_STATUS_VERIFIED:
        return jsonify({'error': 'Only verified submissions can be approved'}), 400
    
    data = request.get_json() or {}
    remarks = data.get('remarks', '')
    
    # Update submission
    submission.status = SUBMISSION_STATUS_APPROVED
    submission.approved_at = datetime.utcnow()
    submission.approved_by = current_user_id
    submission.remarks = remarks
    
    # Update the actual record status
    if submission.submission_type == 'water_system':
        record = MonthlyWaterData.query.get(submission.record_id)
    else:
        record = MonthlyEnergyData.query.get(submission.record_id)
    
    if record:
        record.status = SUBMISSION_STATUS_APPROVED
    
    # Create audit log
    log_verification_action(
        submission.id, 'approve',
        current_user_id, current_user.role,
        remarks or 'Submission approved for emission calculations'
    )
    
    # Notify operator
    notify_operator(
        submission.operator_id,
        'Submission Approved',
        f'Your {submission.submission_type} submission has been approved and will be used for emission calculations',
        submission.id
    )
    
    db.session.commit()
    
    return jsonify({
        'message': 'Submission approved successfully',
        'submission': {
            'id': submission.id,
            'status': submission.status,
            'approved_at': submission.approved_at.isoformat()
        }
    })


# ============================================================
# NOTIFICATION APIs
# ============================================================

@verification_bp.route('/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    """
    Get notifications for the current user.
    """
    current_user_id = get_jwt_identity()
    
    notifications = Notification.query.filter_by(
        user_id=current_user_id
    ).order_by(Notification.created_at.desc()).limit(50).all()
    
    result = []
    for notif in notifications:
        result.append({
            'id': notif.id,
            'title': notif.title,
            'message': notif.message,
            'is_read': notif.is_read,
            'submission_id': notif.submission_id,
            'created_at': notif.created_at.isoformat()
        })
    
    # Get unread count
    unread_count = Notification.query.filter_by(
        user_id=current_user_id,
        is_read=False
    ).count()
    
    return jsonify({
        'notifications': result,
        'unread_count': unread_count
    })


@verification_bp.route('/notifications/<notification_id>/read', methods=['POST'])
@jwt_required()
def mark_notification_read(notification_id):
    """
    Mark a notification as read.
    """
    current_user_id = get_jwt_identity()
    
    notification = Notification.query.get(notification_id)
    if not notification:
        return jsonify({'error': 'Notification not found'}), 404
    
    if notification.user_id != current_user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    notification.is_read = True
    db.session.commit()
    
    return jsonify({'message': 'Notification marked as read'})


@verification_bp.route('/notifications/read-all', methods=['POST'])
@jwt_required()
def mark_all_notifications_read():
    """
    Mark all notifications as read for the current user.
    """
    current_user_id = get_jwt_identity()
    
    Notification.query.filter_by(
        user_id=current_user_id,
        is_read=False
    ).update({'is_read': True})
    
    db.session.commit()
    
    return jsonify({'message': 'All notifications marked as read'})


# ============================================================
# AUDIT LOG APIs
# ============================================================

@verification_bp.route('/audit-logs', methods=['GET'])
@jwt_required()
def get_audit_logs():
    """
    Get audit logs with optional filters.
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if current_user.role not in ['analyst', 'environment_manager', 'operations_department']:
        return jsonify({'error': 'Access denied'}), 403
    
    # Get filters
    submission_id = request.args.get('submission_id')
    action_type = request.args.get('action_type')
    user_id = request.args.get('user_id')
    
    query = VerificationLog.query
    
    if submission_id:
        query = query.filter_by(submission_id=submission_id)
    if action_type:
        query = query.filter_by(action_type=action_type)
    if user_id:
        query = query.filter_by(performed_by=user_id)
    
    logs = query.order_by(VerificationLog.timestamp.desc()).limit(100).all()
    
    result = []
    for log in logs:
        user = User.query.get(log.performed_by)
        result.append({
            'id': log.id,
            'submission_id': log.submission_id,
            'action_type': log.action_type,
            'performed_by_name': user.name if user else 'Unknown',
            'role': log.role,
            'comment': log.comment,
            'timestamp': log.timestamp.isoformat()
        })
    
    return jsonify({'audit_logs': result})


# ============================================================
# VERIFICATION STATS APIs
# ============================================================

@verification_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_verification_stats():
    """
    Get verification statistics.
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if current_user.role not in ['analyst', 'environment_manager', 'operations_department']:
        return jsonify({'error': 'Access denied'}), 403
    
    # Count by status
    total = Submission.query.count()
    pending = Submission.query.filter(
        Submission.status.in_([SUBMISSION_STATUS_SUBMITTED, SUBMISSION_STATUS_UNDER_REVIEW])
    ).count()
    verified = Submission.query.filter_by(status=SUBMISSION_STATUS_VERIFIED).count()
    rejected = Submission.query.filter_by(status=SUBMISSION_STATUS_REJECTED).count()
    approved = Submission.query.filter_by(status=SUBMISSION_STATUS_APPROVED).count()
    
    # Calculate average verification time (for approved submissions)
    approved_subs = Submission.query.filter(
        Submission.status == SUBMISSION_STATUS_APPROVED,
        Submission.submitted_at.isnot(None),
        Submission.approved_at.isnot(None)
    ).all()
    
    avg_verification_time_hours = 0
    if approved_subs:
        total_hours = sum([
            (sub.approved_at - sub.submitted_at).total_seconds() / 3600
            for sub in approved_subs
        ])
        avg_verification_time_hours = round(float(total_hours / len(approved_subs)), 2)
    
    return jsonify({
        'total_submissions': total,
        'pending_review': pending,
        'verified': verified,
        'rejected': rejected,
        'approved': approved,
        'avg_verification_time_hours': avg_verification_time_hours
    })
