from datetime import datetime
from app.extensions import db
import uuid
from werkzeug.security import generate_password_hash, check_password_hash

# Helper to generate uuid string
def get_uuid():
    return str(uuid.uuid4())

# Submission Status Constants
SUBMISSION_STATUS_DRAFT = 'draft'
SUBMISSION_STATUS_SUBMITTED = 'submitted'
SUBMISSION_STATUS_UNDER_REVIEW = 'under_review'
SUBMISSION_STATUS_VERIFIED = 'verified'
SUBMISSION_STATUS_REJECTED = 'rejected'
SUBMISSION_STATUS_APPROVED = 'approved'

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(20))
    role = db.Column(db.String(50), nullable=False, default='operator') # 'operator', 'analyst', etc.
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class WaterSystem(db.Model):
    __tablename__ = 'water_systems'
    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    tehsil = db.Column(db.String(100), nullable=False)
    village = db.Column(db.String(100), nullable=False)
    settlement = db.Column(db.String(150))
    unique_identifier = db.Column(db.String(100), unique=True, nullable=False)
    pump_model = db.Column(db.String(100))
    pump_serial_number = db.Column(db.String(100))
    start_of_operation = db.Column(db.Date)
    depth_of_water_intake = db.Column(db.Float)
    height_to_ohr = db.Column(db.Float)
    pump_flow_rate = db.Column(db.Float)
    meter_model = db.Column(db.String(100))
    meter_serial_number = db.Column(db.String(100))
    meter_accuracy_class = db.Column(db.String(50))
    calibration_requirement = db.Column(db.Text)
    installation_date = db.Column(db.Date)
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship to monthly data
    records = db.relationship('MonthlyWaterData', backref='system', lazy=True)

class MonthlyWaterData(db.Model):
    __tablename__ = 'monthly_water_data'
    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    water_system_id = db.Column(db.String(36), db.ForeignKey('water_systems.id'), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)
    pump_operating_hours = db.Column(db.Float)
    total_water_pumped = db.Column(db.Float)
    bulk_meter_image_url = db.Column(db.Text)
    status = db.Column(db.String(20), default='draft') # 'draft' or 'submitted'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class SolarSystem(db.Model):
    __tablename__ = 'solar_systems'
    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    tehsil = db.Column(db.String(100), nullable=False)
    village = db.Column(db.String(100), nullable=False)
    settlement = db.Column(db.String(150))
    unique_identifier = db.Column(db.String(100), unique=True, nullable=False)
    installation_location = db.Column(db.String(100))
    solar_panel_capacity = db.Column(db.Float)
    inverter_capacity = db.Column(db.Float)
    inverter_serial_number = db.Column(db.String(100))
    installation_date = db.Column(db.Date)
    meter_model = db.Column(db.String(100))
    meter_serial_number = db.Column(db.String(100))
    green_meter_connection_date = db.Column(db.Date)
    calibration_date = db.Column(db.Date)
    remarks = db.Column(db.Text)
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship to monthly data
    records = db.relationship('MonthlyEnergyData', backref='system', lazy=True)

class MonthlyEnergyData(db.Model):
    __tablename__ = 'monthly_energy_data'
    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    solar_system_id = db.Column(db.String(36), db.ForeignKey('solar_systems.id'), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)
    energy_consumed_from_grid = db.Column(db.Float)
    energy_exported_to_grid = db.Column(db.Float)
    electricity_bill_image_url = db.Column(db.Text)
    status = db.Column(db.String(20), default='draft') # 'draft' or 'submitted'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class ImageVerification(db.Model):
    __tablename__ = 'image_verifications'
    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    linked_record_id = db.Column(db.String(36), nullable=False)
    record_type = db.Column(db.String(20), nullable=False) # 'water' or 'solar'
    image_url = db.Column(db.Text, nullable=False)
    verification_status = db.Column(db.String(20))
    verified_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    verified_at = db.Column(db.DateTime, default=datetime.utcnow)
    comment = db.Column(db.Text)

class EmissionResult(db.Model):
    __tablename__ = 'emission_results'
    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    system_type = db.Column(db.String(20), nullable=False)
    system_id = db.Column(db.String(36), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    baseline_emission = db.Column(db.Float)
    project_emission = db.Column(db.Float)
    emission_reduction = db.Column(db.Float)
    calculated_at = db.Column(db.DateTime, default=datetime.utcnow)

class PredictionResult(db.Model):
    __tablename__ = 'prediction_results'
    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    prediction_type = db.Column(db.String(100))
    system_id = db.Column(db.String(36), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    predicted_value = db.Column(db.Float)
    model_used = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# ============================================================
# VERIFICATION WORKFLOW MODELS
# ============================================================

class Submission(db.Model):
    """
    Represents a data submission that goes through the verification workflow.
    
    Status Flow:
    - draft: Operator is still editing
    - submitted: Operator submitted for verification
    - under_review: Analyst is reviewing
    - verified: Analyst verified the data
    - rejected: Rejected (can be edited and resubmitted)
    - approved: Environment Manager approved (ready for emission calculations)
    """
    __tablename__ = 'submissions'
    
    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    
    # Who submitted this data
    operator_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    operator = db.relationship('User', foreign_keys=[operator_id], backref='submissions')
    
    # Type of submission: water_system or solar_system
    submission_type = db.Column(db.String(50), nullable=False)  # 'water_system' or 'solar_system'
    
    # The actual record ID being submitted (monthly_water_data or monthly_energy_data)
    record_id = db.Column(db.String(36), nullable=False)
    
    # Current status in the verification workflow
    status = db.Column(db.String(30), default='draft', nullable=False)
    # Values: draft, submitted, under_review, verified, rejected, approved
    
    # Timestamps for tracking
    submitted_at = db.Column(db.DateTime)
    reviewed_at = db.Column(db.DateTime)
    approved_at = db.Column(db.DateTime)
    
    # Users who reviewed/approved
    reviewed_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    approved_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    reviewer = db.relationship('User', foreign_keys=[reviewed_by], backref='reviews')
    approver = db.relationship('User', foreign_keys=[approved_by], backref='approvals')
    
    # Comments/remarks from reviewer
    remarks = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class VerificationLog(db.Model):
    """
    Audit trail for all verification actions.
    
    This creates a complete audit trail for compliance and transparency.
    Every action (submit, review, verify, reject, approve) is logged here.
    """
    __tablename__ = 'verification_logs'
    
    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    
    # Link to submission
    submission_id = db.Column(db.String(36), db.ForeignKey('submissions.id'), nullable=False)
    submission = db.relationship('Submission', backref='logs')
    
    # Type of action performed
    action_type = db.Column(db.String(50), nullable=False)
    # Values: submit, review, verify, reject, approve, resubmit
    
    # Who performed the action
    performed_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    user = db.relationship('User', backref='verification_actions')
    
    # Role at time of action
    role = db.Column(db.String(50), nullable=False)
    
    # Optional comment
    comment = db.Column(db.Text)
    
    # Timestamp
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)


class Notification(db.Model):
    """
    Simple notification system for users.
    
    Users receive notifications when:
    - Their submission is verified/rejected
    - New submission is available for review
    - Verification is approved
    """
    __tablename__ = 'notifications'
    
    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    
    # Who receives the notification
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    user = db.relationship('User', backref='notifications')
    
    # Notification title and message
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    
    # Related submission (optional)
    submission_id = db.Column(db.String(36), db.ForeignKey('submissions.id'))
    
    # Read status
    is_read = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
