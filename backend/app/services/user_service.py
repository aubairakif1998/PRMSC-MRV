from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models.models import Role, User, UserWaterSystem
from app.rbac import USER
from app.services.tehsil_access import assert_actor_may_assign_water_systems_to_operator


class UserService:
    @staticmethod
    def get_user_by_id(user_id: str) -> User | None:
        return (
            User.query.options(
                selectinload(User.tehsil_links),
                selectinload(User.water_system_links),
            ).get(user_id)
        )

    @staticmethod
    def get_all_users():
        return (
            User.query.options(
                selectinload(User.tehsil_links),
                selectinload(User.water_system_links),
            )
            .order_by(User.created_at.desc())
            .all()
        )

    @staticmethod
    def create_tubewell_operator(
        name: str,
        email: str,
        password: str,
        water_system_ids: list,
        actor: User,
    ) -> User:
        systems = assert_actor_may_assign_water_systems_to_operator(actor, water_system_ids)

        email_n = email.strip().lower()
        if User.query.filter_by(email=email_n).first():
            raise ValueError("User already exists with this email")
        role_row = Role.query.filter_by(code=USER).first()
        if not role_row:
            raise ValueError("System roles are not initialized; run database migrations")

        u = User(name=name.strip(), email=email_n, role_id=role_row.id)
        u.set_password(password)
        db.session.add(u)
        db.session.flush()
        for s in systems:
            db.session.add(UserWaterSystem(user_id=u.id, water_system_id=s.id))
        db.session.commit()
        return UserService.get_user_by_id(u.id)
