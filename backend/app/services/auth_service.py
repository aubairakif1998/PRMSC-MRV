from app.extensions import db
from app.models.models import User


class AuthService:
    @staticmethod
    def register_user(name: str, email: str, password: str, role: str = "operator") -> User:
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            raise ValueError("User already exists with this email")

        new_user = User(name=name, email=email, role=role)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.commit()
        return new_user

    @staticmethod
    def authenticate(email: str, password: str) -> User | None:
        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            return None
        return user

