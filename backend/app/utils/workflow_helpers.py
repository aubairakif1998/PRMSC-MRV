"""Shared audit logging and notifications for submissions (operator + verification flows)."""

from app.constants.tehsils import canonical_tehsil
from app.extensions import db
from app.models.models import Notification, Role, User, UserTehsil, VerificationLog
from app.rbac import ADMIN, SUPER_ADMIN, SYSTEM_ADMIN, user_role_code


def log_verification_action(submission_id, action_type, user_id, role, comment=None):
    log = VerificationLog(
        submission_id=submission_id,
        action_type=action_type,
        performed_by=user_id,
        role=role,
        comment=comment,
    )
    db.session.add(log)


def create_notification(user_id, title, message, submission_id=None):
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        submission_id=submission_id,
    )
    db.session.add(notification)


def notify_analysts(title, message, submission_id=None, tehsil=None):
    """Notify SUPER_ADMIN+, and ADMIN users linked to the submission tehsil."""
    recipients: dict[str, User] = {}
    for u in User.query.join(Role).filter(
        Role.code.in_([SYSTEM_ADMIN, SUPER_ADMIN])
    ).all():
        recipients[str(u.id)] = u
    if tehsil:
        c = canonical_tehsil(tehsil)
        if c:
            for row in UserTehsil.query.filter_by(tehsil=c).all():
                u = User.query.get(row.user_id)
                if u and user_role_code(u) == ADMIN:
                    recipients[str(u.id)] = u
    for u in recipients.values():
        create_notification(u.id, title, message, submission_id)


def notify_operator(operator_id, title, message, submission_id=None):
    create_notification(operator_id, title, message, submission_id)
