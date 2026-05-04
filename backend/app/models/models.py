from datetime import datetime

from sqlalchemy import Time

from app.extensions import db
import uuid
from werkzeug.security import generate_password_hash, check_password_hash

# Helper to generate uuid string
def get_uuid():
    return str(uuid.uuid4())

# Water log + submission workflow (tubewell operator ↔ tehsil manager)
SUBMISSION_STATUS_DRAFTED = "drafted"
SUBMISSION_STATUS_SUBMITTED = "submitted"
SUBMISSION_STATUS_ACCEPTED = "accepted"
SUBMISSION_STATUS_REJECTED = "rejected"
SUBMISSION_STATUS_REVERTED_BACK = "reverted_back"

# Rows a tubewell operator may edit or delete (water_energy_logging_daily)
WATER_LOG_OPERATOR_EDITABLE = frozenset(
    (SUBMISSION_STATUS_DRAFTED, SUBMISSION_STATUS_REVERTED_BACK)
)


def normalize_water_submission_status(value: str | None) -> str:
    """Map API/legacy values to canonical status strings."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return SUBMISSION_STATUS_DRAFTED
    v = str(value).strip().lower()
    if v == "draft":
        return SUBMISSION_STATUS_DRAFTED
    legacy = {
        "under_review": SUBMISSION_STATUS_SUBMITTED,
        "verified": SUBMISSION_STATUS_ACCEPTED,
        "approved": SUBMISSION_STATUS_ACCEPTED,
    }
    if v in legacy:
        return legacy[v]
    canon = {
        "drafted": SUBMISSION_STATUS_DRAFTED,
        "submitted": SUBMISSION_STATUS_SUBMITTED,
        "accepted": SUBMISSION_STATUS_ACCEPTED,
        "rejected": SUBMISSION_STATUS_REJECTED,
        "reverted_back": SUBMISSION_STATUS_REVERTED_BACK,
    }
    return canon.get(v, str(value).strip())

class Role(db.Model):
    """
    Canonical RBAC role: code matches JWT claim and API checks.
    hierarchy_rank: higher value = more privilege (4 = SYSTEM_ADMIN).
    permissions: JSON list of strings (see ``app.constants.permissions``).
    """

    __tablename__ = "roles"

    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    code = db.Column(db.String(50), unique=True, nullable=False)
    display_name = db.Column(db.String(120), nullable=False)
    hierarchy_rank = db.Column(db.Integer, nullable=False)
    permissions = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserTehsil(db.Model):
    """Many-to-many: tehsil manager (ADMIN) ↔ predefined tehsil. Tubewell operators use UserWaterSystem only."""

    __tablename__ = "user_tehsils"

    user_id = db.Column(
        db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    tehsil = db.Column(db.String(100), primary_key=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserWaterSystem(db.Model):
    """Tubewell operator ↔ water systems they may log data for (subset of tehsil)."""

    __tablename__ = "user_water_systems"

    user_id = db.Column(
        db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    water_system_id = db.Column(
        db.String(36), db.ForeignKey("water_systems.id", ondelete="CASCADE"), primary_key=True
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserManagerOperation(db.Model):
    """Manager ↔ tehsil scope for operational oversight (seeded via migration)."""

    __tablename__ = "user_manageroperation"

    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    user_id = db.Column(
        db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    tehsil = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("user_id", "tehsil", name="uq_user_manageroperation_user_tehsil"),
    )


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(20))
    # Operator signature captured in the mobile app (stored as SVG markup string).
    signature_svg = db.Column(db.Text)
    role_id = db.Column(db.String(36), db.ForeignKey('roles.id'), nullable=False)
    assigned_role = db.relationship(
        'Role', backref=db.backref('users', lazy='dynamic'), lazy='joined'
    )
    tehsil_links = db.relationship(
        'UserTehsil',
        backref='user',
        cascade='all, delete-orphan',
        lazy='selectin',
    )
    water_system_links = db.relationship(
        "UserWaterSystem",
        backref="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def role(self):
        return self.assigned_role.code if self.assigned_role else None

    @property
    def assigned_tehsils(self) -> list[str]:
        """Tehsil managers: persisted links. Tubewell operators: tehsils implied by assigned water systems."""
        if self.role == "USER":
            from app.services.tehsil_access import operator_tehsils_derived_from_water_systems

            return sorted(operator_tehsils_derived_from_water_systems(self))
        return [link.tehsil for link in self.tehsil_links]

    @property
    def assigned_water_system_ids(self) -> list[str]:
        return [str(link.water_system_id) for link in self.water_system_links]

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class PasswordResetToken(db.Model):
    """One-time token for /auth/forgot-password → /auth/reset-password."""

    __tablename__ = "password_reset_tokens"

    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = db.Column(db.String(64), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WaterSystem(db.Model):
    __tablename__ = 'water_systems'
    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    tehsil = db.Column(db.String(100), nullable=False)
    village = db.Column(db.String(100), nullable=False)
    settlement = db.Column(db.String(150))
    unique_identifier = db.Column(db.String(100), unique=True, nullable=False)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    pump_model = db.Column(db.String(100))
    pump_serial_number = db.Column(db.String(100))
    start_of_operation = db.Column(db.Date)
    depth_of_water_intake = db.Column(db.Float)
    height_to_ohr = db.Column(db.Float)
    pump_flow_rate = db.Column(db.Float)
    bulk_meter_installed = db.Column(db.Boolean, nullable=False, default=True)
    # No bulk meter installed: capture design/assumption inputs.
    ohr_tank_capacity = db.Column(db.Float)  # m³
    ohr_fill_required = db.Column(db.Float)  # m³ required to fill OHR
    pump_capacity = db.Column(db.Float)  # (unit as entered by tehsil manager)
    pump_head = db.Column(db.Float)  # meters
    pump_horse_power = db.Column(db.Float)  # HP / kVA / W as entered (numeric)
    time_to_fill = db.Column(db.Float)  # minutes
    meter_model = db.Column(db.String(100))
    meter_serial_number = db.Column(db.String(100))
    meter_accuracy_class = db.Column(db.String(50))
    installation_date = db.Column(db.Date)
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    records = db.relationship(
        "WaterEnergyLoggingDaily", backref="system", lazy=True
    )


class WaterSystemCalibrationCertificate(db.Model):
    """Calibration certificate metadata for one water system (1:N)."""

    __tablename__ = "water_system_calibration_certificates"

    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    water_system_id = db.Column(
        db.String(36),
        db.ForeignKey("water_systems.id", ondelete="CASCADE"),
        nullable=False,
    )
    file_url = db.Column(db.Text, nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    expiry_date = db.Column(db.Date, nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    water_system = db.relationship(
        "WaterSystem",
        backref=db.backref("calibration_certificates", lazy="selectin"),
    )


class WaterEnergyLoggingDaily(db.Model):
    """Tubewell operator daily water / pump logs (multiple rows/day allowed per time interval)."""

    __tablename__ = "water_energy_logging_daily"
    __table_args__ = (
        db.UniqueConstraint(
            "water_system_id",
            "log_date",
            "pump_start_time",
            "pump_end_time",
            name="uq_water_energy_logging_daily_sid_date_times",
        ),
    )

    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    water_system_id = db.Column(
        db.String(36), db.ForeignKey("water_systems.id"), nullable=False
    )
    log_date = db.Column(db.Date, nullable=False)
    pump_start_time = db.Column(Time, nullable=True)
    pump_end_time = db.Column(Time, nullable=True)
    pump_operating_hours = db.Column(db.Float)
    total_water_pumped = db.Column(db.Float)
    bulk_meter_image_url = db.Column(db.Text)
    signed = db.Column(db.Boolean, nullable=False, default=False)
    # Snapshot of operator signature (SVG) at time of submission.
    signature_svg_snapshot = db.Column(db.Text)
    status = db.Column(db.String(24), default=SUBMISSION_STATUS_DRAFTED)
    remarks = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SolarSystem(db.Model):
    __tablename__ = 'solar_systems'
    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    tehsil = db.Column(db.String(100), nullable=False)
    village = db.Column(db.String(100), nullable=False)
    settlement = db.Column(db.String(150))
    unique_identifier = db.Column(db.String(100), unique=True, nullable=False)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    installation_location = db.Column(db.String(100))
    solar_panel_capacity = db.Column(db.Float)
    inverter_capacity = db.Column(db.Float)
    inverter_serial_number = db.Column(db.String(100))
    # Dates
    # Legacy field kept for backward compatibility with older clients.
    installation_date = db.Column(db.Date)
    # New fields
    solar_connection_date = db.Column(db.Date)
    electricity_connection_date = db.Column(db.Date)
    green_connection_date = db.Column(db.Date)
    meter_model = db.Column(db.String(100))
    meter_serial_number = db.Column(db.String(100))
    # Legacy field kept for backward compatibility with older clients.
    green_meter_connection_date = db.Column(db.Date)
    remarks = db.Column(db.Text)
    created_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    records = db.relationship(
        "SolarEnergyLoggingMonthly", backref="system", lazy=True
    )


class SolarEnergyLoggingMonthly(db.Model):
    """Tehsil manager monthly solar grid / export logs."""

    __tablename__ = "solar_energy_logging_monthly"

    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    solar_system_id = db.Column(
        db.String(36), db.ForeignKey("solar_systems.id"), nullable=False
    )
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)
    export_off_peak = db.Column(db.Float)
    export_peak = db.Column(db.Float)
    import_off_peak = db.Column(db.Float)
    import_peak = db.Column(db.Float)
    net_off_peak = db.Column(db.Float)
    net_peak = db.Column(db.Float)
    electricity_bill_image_url = db.Column(db.Text)
    remarks = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ============================================================
# VERIFICATION WORKFLOW MODELS
# ============================================================

class Submission(db.Model):
    """
    Water verification workflow (links to water_energy_logging_daily rows).

    Status: drafted → submitted → accepted | rejected | reverted_back
    (reverted_back returns the row to the tubewell operator for edits.)
    """
    __tablename__ = 'submissions'
    
    id = db.Column(db.String(36), primary_key=True, default=get_uuid)
    
    # Who submitted this data
    operator_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    operator = db.relationship('User', foreign_keys=[operator_id], backref='submissions')
    
    # Type of submission: water_system or solar_system
    submission_type = db.Column(db.String(50), nullable=False)  # 'water_system' or 'solar_system'
    
    # Record ID in water_energy_logging_daily or solar_energy_logging_monthly
    record_id = db.Column(db.String(36), nullable=False)
    
    status = db.Column(db.String(30), default=SUBMISSION_STATUS_DRAFTED, nullable=False)

    submitted_at = db.Column(db.DateTime)
    reviewed_at = db.Column(db.DateTime)
    approved_at = db.Column(db.DateTime)

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
    
    comment = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


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
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
