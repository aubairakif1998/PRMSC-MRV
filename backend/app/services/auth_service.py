from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta

from flask import current_app

from app.extensions import db
from app.models.models import PasswordResetToken, User


def _hash_reset_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class AuthService:
    @staticmethod
    def authenticate(email: str, password: str) -> User | None:
        user = User.query.filter_by(email=email.strip().lower()).first()
        if not user or not user.check_password(password):
            return None
        return user

    @staticmethod
    def change_password(user: User, current_password: str, new_password: str) -> None:
        min_len = int(current_app.config.get("PASSWORD_MIN_LENGTH", 8))
        if not user.check_password(current_password):
            raise ValueError("Current password is incorrect")
        if len(new_password) < min_len:
            raise ValueError(f"New password must be at least {min_len} characters")
        if new_password == current_password:
            raise ValueError("New password must be different from the current password")

        user.set_password(new_password)
        PasswordResetToken.query.filter_by(user_id=user.id).delete()
        db.session.commit()

    @staticmethod
    def request_password_reset(email: str) -> tuple[User | None, str | None]:
        """
        Create a new reset token for the user. Returns (user, raw_token) or (None, None).
        """
        user = User.query.filter_by(email=email.strip().lower()).first()
        if not user:
            return None, None

        PasswordResetToken.query.filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        ).delete(synchronize_session=False)

        raw = secrets.token_urlsafe(48)
        ttl_h = int(current_app.config.get("PASSWORD_RESET_TOKEN_TTL_HOURS", 1))
        expires = datetime.utcnow() + timedelta(hours=ttl_h)

        row = PasswordResetToken(
            user_id=user.id,
            token_hash=_hash_reset_token(raw),
            expires_at=expires,
        )
        db.session.add(row)
        db.session.commit()
        return user, raw

    @staticmethod
    def reset_password_with_token(raw_token: str, new_password: str) -> None:
        min_len = int(current_app.config.get("PASSWORD_MIN_LENGTH", 8))
        if len(new_password) < min_len:
            raise ValueError(f"Password must be at least {min_len} characters")

        if not raw_token or not raw_token.strip():
            raise ValueError("token is required")

        th = _hash_reset_token(raw_token.strip())
        now = datetime.utcnow()
        row = (
            PasswordResetToken.query.filter_by(token_hash=th, used_at=None)
            .filter(PasswordResetToken.expires_at > now)
            .first()
        )
        if not row:
            raise ValueError("Invalid or expired reset token")

        user = User.query.get(row.user_id)
        if not user:
            raise ValueError("Invalid or expired reset token")

        user.set_password(new_password)
        row.used_at = now
        PasswordResetToken.query.filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.id != row.id,
        ).delete(synchronize_session=False)
        db.session.commit()
