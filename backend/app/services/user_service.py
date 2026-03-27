from app.models.models import User


class UserService:
    @staticmethod
    def get_user_by_id(user_id: str) -> User | None:
        return User.query.get(user_id)

    @staticmethod
    def get_all_users():
        return User.query.order_by(User.created_at.desc()).all()

