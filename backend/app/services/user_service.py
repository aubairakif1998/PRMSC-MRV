from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models.models import Role, User, UserWaterSystem, WaterSystem
from app.rbac import USER, user_role_code
from app.services.tehsil_access import (
    assert_actor_may_assign_water_systems_to_operator,
    assert_user_may_access_water_system,
    manageable_water_system_ids_for_assignment,
    TehsilAccessDenied,
)


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

    @staticmethod
    def list_tubewell_operator_assignments(actor: User) -> dict:
        """Operators with at least one assignment in the actor's manageable scope, plus catalog."""
        manageable = manageable_water_system_ids_for_assignment(actor)
        if not manageable:
            return {
                "operators": [],
                "eligible_operators": [],
                "water_systems_catalog": [],
            }

        operator_ids = (
            db.session.query(UserWaterSystem.user_id)
            .filter(UserWaterSystem.water_system_id.in_(manageable))
            .distinct()
            .all()
        )
        uid_list = [r[0] for r in operator_ids]

        operators_out: list[dict] = []
        for uid in uid_list:
            u = User.query.get(uid)
            if not u or user_role_code(u) != USER:
                continue
            ws_rows = (
                WaterSystem.query.join(
                    UserWaterSystem,
                    UserWaterSystem.water_system_id == WaterSystem.id,
                )
                .filter(
                    UserWaterSystem.user_id == uid,
                    WaterSystem.id.in_(manageable),
                )
                .order_by(
                    WaterSystem.tehsil,
                    WaterSystem.village,
                    WaterSystem.unique_identifier,
                )
                .all()
            )
            operators_out.append(
                {
                    "id": str(u.id),
                    "name": u.name,
                    "email": u.email,
                    "phone": u.phone or None,
                    "water_systems": [
                        {
                            "id": str(ws.id),
                            "unique_identifier": ws.unique_identifier,
                            "village": ws.village,
                            "tehsil": ws.tehsil,
                            "settlement": ws.settlement,
                        }
                        for ws in ws_rows
                    ],
                }
            )
        operators_out.sort(key=lambda row: row["name"].lower())

        by_id: dict[str, dict] = {row["id"]: row for row in operators_out}

        all_uids_with_any_link = {
            r[0]
            for r in db.session.query(UserWaterSystem.user_id).distinct().all()
        }
        uids_external_only = all_uids_with_any_link - set(uid_list)
        for uid in uids_external_only:
            u = User.query.get(uid)
            if not u or user_role_code(u) != USER:
                continue
            sid = str(u.id)
            if sid in by_id:
                continue
            by_id[sid] = {
                "id": sid,
                "name": u.name,
                "email": u.email,
                "phone": u.phone or None,
                "water_systems": [],
            }

        # Tubewell operators with no user_water_systems rows yet (can receive first assignment).
        role_user = Role.query.filter_by(code=USER).first()
        if role_user:
            linked_subq = db.session.query(UserWaterSystem.user_id).distinct()
            unassigned = (
                User.query.filter(
                    User.role_id == role_user.id,
                    ~User.id.in_(linked_subq),
                )
                .order_by(User.created_at.desc())
                .limit(200)
                .all()
            )
            for u in unassigned:
                sid = str(u.id)
                if sid in by_id:
                    continue
                by_id[sid] = {
                    "id": sid,
                    "name": u.name,
                    "email": u.email,
                    "phone": u.phone or None,
                    "water_systems": [],
                }

        eligible_operators = sorted(
            by_id.values(),
            key=lambda row: row["name"].lower(),
        )

        catalog = (
            WaterSystem.query.filter(WaterSystem.id.in_(manageable))
            .order_by(
                WaterSystem.tehsil,
                WaterSystem.village,
                WaterSystem.unique_identifier,
            )
            .all()
        )
        water_systems_catalog = [
            {
                "id": str(ws.id),
                "unique_identifier": ws.unique_identifier,
                "village": ws.village,
                "tehsil": ws.tehsil,
                "settlement": ws.settlement,
            }
            for ws in catalog
        ]

        return {
            "operators": operators_out,
            "eligible_operators": eligible_operators,
            "water_systems_catalog": water_systems_catalog,
        }

    @staticmethod
    def replace_tubewell_operator_water_assignments(
        actor: User,
        operator_id: str,
        water_system_ids: list,
    ) -> User:
        """
        Replace this operator's assignments within the actor's manageable scope.
        Systems outside that scope are unchanged. Omitting a system ID revokes it (in scope).
        """
        manageable = manageable_water_system_ids_for_assignment(actor)
        if not manageable:
            raise TehsilAccessDenied("No permission to manage water system assignments")

        op = UserService.get_user_by_id(operator_id)
        if not op or user_role_code(op) != USER:
            raise ValueError("User is not a tubewell operator")

        want: set[str] = set()
        for raw in water_system_ids or []:
            if raw is None:
                continue
            sid = str(raw).strip()
            if not sid:
                continue
            ws = WaterSystem.query.get(sid)
            if not ws:
                raise ValueError(f"Water system not found: {sid}")
            if str(ws.id) not in manageable:
                raise TehsilAccessDenied(
                    "One or more water systems are outside your assignment scope"
                )
            assert_user_may_access_water_system(actor, ws, for_write=True)
            want.add(str(ws.id))

        UserWaterSystem.query.filter(
            UserWaterSystem.user_id == operator_id,
            UserWaterSystem.water_system_id.in_(manageable),
        ).delete(synchronize_session=False)

        for sid in sorted(want):
            db.session.add(UserWaterSystem(user_id=operator_id, water_system_id=sid))

        db.session.commit()
        return UserService.get_user_by_id(operator_id)
