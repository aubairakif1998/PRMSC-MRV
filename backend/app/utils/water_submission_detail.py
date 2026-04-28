"""Serialize water `Submission` + daily log + audit trail for detail APIs."""

from __future__ import annotations

from app.models.models import (
    Submission,
    User,
    VerificationLog,
    WaterEnergyLoggingDaily,
    WaterSystem,
)


def build_water_submission_detail_response(submission: Submission) -> dict:
    """Build JSON body for a water submission. Caller must ensure type is `water_system`."""
    submission_id = submission.id

    operator = User.query.get(submission.operator_id)
    reviewer = User.query.get(submission.reviewed_by) if submission.reviewed_by else None
    approver = User.query.get(submission.approved_by) if submission.approved_by else None

    record_data: dict = {}
    record = WaterEnergyLoggingDaily.query.get(submission.record_id)
    if record:
        system = WaterSystem.query.get(record.water_system_id)
        record_data = {
            "year": record.log_date.year if record.log_date else None,
            "month": record.log_date.month if record.log_date else None,
            "day": record.log_date.day if record.log_date else None,
            "log_date": record.log_date.isoformat() if record.log_date else None,
            "last_edited_at": record.updated_at.isoformat()
            if getattr(record, "updated_at", None)
            else None,
            "pump_start_time": record.pump_start_time.isoformat(timespec="seconds")
            if record.pump_start_time
            else None,
            "pump_end_time": record.pump_end_time.isoformat(timespec="seconds")
            if record.pump_end_time
            else None,
            "pump_operating_hours": record.pump_operating_hours,
            "total_water_pumped": record.total_water_pumped,
            "bulk_meter_image_url": record.bulk_meter_image_url,
            "signed": getattr(record, "signed", False),
            "signature_svg_snapshot": getattr(record, "signature_svg_snapshot", None),
            "system": {
                "id": system.id if system else None,
                "unique_identifier": system.unique_identifier if system else None,
                "village": system.village if system else None,
                "tehsil": system.tehsil if system else None,
                "settlement": system.settlement if system else None,
                "pump_model": system.pump_model if system else None,
                "pump_serial_number": system.pump_serial_number if system else None,
                "start_of_operation": system.start_of_operation.isoformat()
                if system and system.start_of_operation
                else None,
                "depth_of_water_intake": system.depth_of_water_intake if system else None,
                "height_to_ohr": system.height_to_ohr if system else None,
                "pump_flow_rate": system.pump_flow_rate if system else None,
                "meter_model": system.meter_model if system else None,
                "meter_serial_number": system.meter_serial_number if system else None,
                "meter_accuracy_class": system.meter_accuracy_class if system else None,
                "installation_date": system.installation_date.isoformat()
                if system and system.installation_date
                else None,
            },
        }

    logs = (
        VerificationLog.query.filter_by(submission_id=submission_id)
        .order_by(VerificationLog.created_at.asc())
        .all()
    )

    audit_trail = []
    for log in logs:
        u = User.query.get(log.performed_by)
        audit_trail.append(
            {
                "action_type": log.action_type,
                "performed_by": u.name if u else "Unknown",
                "role": log.role,
                "comment": log.comment,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
        )

    return {
        "submission": {
            "id": submission.id,
            "submission_type": submission.submission_type,
            "status": submission.status,
            "operator_name": operator.name if operator else "Unknown",
            "operator_email": operator.email if operator else "Unknown",
            "submitted_at": submission.submitted_at.isoformat()
            if submission.submitted_at
            else None,
            "reviewed_at": submission.reviewed_at.isoformat()
            if submission.reviewed_at
            else None,
            "approved_at": submission.approved_at.isoformat()
            if submission.approved_at
            else None,
            "reviewed_by_name": reviewer.name if reviewer else None,
            "approved_by_name": approver.name if approver else None,
            "remarks": submission.remarks,
        },
        "record_data": record_data,
        "audit_trail": audit_trail,
    }
