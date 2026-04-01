"""In-app notification list / read handlers (used by tehsil_manager_bp under /api/operator)."""

from datetime import datetime

from flask import jsonify
from flask_jwt_extended import get_jwt_identity

from app.extensions import db
from app.models.models import Notification


def get_notifications_response():
    current_user_id = get_jwt_identity()

    notifications = (
        Notification.query.filter_by(user_id=current_user_id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )

    result = []
    for notif in notifications:
        result.append(
            {
                "id": notif.id,
                "title": notif.title,
                "message": notif.message,
                "is_read": notif.is_read,
                "submission_id": notif.submission_id,
                "created_at": notif.created_at.isoformat(),
            }
        )

    unread_count = Notification.query.filter_by(
        user_id=current_user_id, is_read=False
    ).count()

    return jsonify({"notifications": result, "unread_count": unread_count})


def mark_notification_read_response(notification_id):
    current_user_id = get_jwt_identity()

    notification = Notification.query.get(notification_id)
    if not notification:
        return jsonify({"error": "Notification not found"}), 404

    if notification.user_id != current_user_id:
        return jsonify({"error": "Access denied"}), 403

    notification.is_read = True
    notification.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({"message": "Notification marked as read"})


def mark_all_notifications_read_response():
    current_user_id = get_jwt_identity()

    Notification.query.filter_by(user_id=current_user_id, is_read=False).update(
        {"is_read": True, "updated_at": datetime.utcnow()}
    )

    db.session.commit()

    return jsonify({"message": "All notifications marked as read"})
