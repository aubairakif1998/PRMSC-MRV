"""rbac roles table, user role_id/tehsil, seed COO/managers/tehsil admins

Revision ID: 2b3c4d5e6f7a
Revises: 1a2b3c4d5e6f
Create Date: 2026-03-30 12:00:00.000000

Password for all seeded logins: SEED_DEFAULT_PASSWORD env var, or
PrmscMrv_Seed_ChangeMe! — change after first deploy.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text
from werkzeug.security import generate_password_hash

revision = "2b3c4d5e6f7a"
down_revision = "1a2b3c4d5e6f"
branch_labels = None
depends_on = None

ROLE_USER = "f1111111-1111-4111-a111-111111111101"
ROLE_ADMIN = "f1111111-1111-4111-a111-111111111102"
ROLE_SUPER_ADMIN = "f1111111-1111-4111-a111-111111111103"
ROLE_SYSTEM_ADMIN = "f1111111-1111-4111-a111-111111111104"

TEHSILS = [
    "AHMADPUR SIAL",
    "ALIPUR",
    "BAHAWALNAGAR",
    "BHOWANA",
    "DARYA KHAN",
    "ISA KHEL",
    "KALLAR KAHAR",
    "KAHROR PACCA",
    "KHAIRPUR TAMEWALI",
    "KOT MOMIN",
    "LIAQATPUR",
    "NOORPUR THAL",
    "PAKPATTAN",
    "ROJHAN",
    "SHUJABAD",
    "TAUNSA",
]


def _perm_sets() -> tuple[list[str], list[str], list[str], list[str]]:
    user_p = [
        "submissions.submit",
        "submissions.read_own",
        "systems.manage_own",
        "emissions.access",
        "dashboard.operator",
    ]
    admin_p = user_p + [
        "submissions.verify",
        "submissions.reject",
        "submissions.queue",
        "systems.read_scoped",
        "audit.read_scoped",
        "dashboard.staff",
    ]
    super_p = admin_p + [
        "submissions.approve",
        "users.read",
        "emissions.read_all",
        "dashboard.program",
    ]
    system_p = ["*"]
    return user_p, admin_p, super_p, system_p


def _ensure_roles_seeded(bind):
    inspector = inspect(bind)
    if "roles" not in inspector.get_table_names():
        user_p, admin_p, super_p, system_p = _perm_sets()
        op.create_table(
            "roles",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("code", sa.String(50), nullable=False, unique=True),
            sa.Column("display_name", sa.String(120), nullable=False),
            sa.Column("hierarchy_rank", sa.Integer(), nullable=False),
            sa.Column("permissions", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
        now = datetime.utcnow()
        rows = [
            {
                "id": ROLE_USER,
                "code": "USER",
                "display_name": "Tubewell Operator",
                "hierarchy_rank": 1,
                "permissions": user_p,
                "created_at": now,
            },
            {
                "id": ROLE_ADMIN,
                "code": "ADMIN",
                "display_name": "Tehsil Manager Operator",
                "hierarchy_rank": 2,
                "permissions": admin_p,
                "created_at": now,
            },
            {
                "id": ROLE_SUPER_ADMIN,
                "code": "SUPER_ADMIN",
                "display_name": "Manager Operations",
                "hierarchy_rank": 3,
                "permissions": super_p,
                "created_at": now,
            },
            {
                "id": ROLE_SYSTEM_ADMIN,
                "code": "SYSTEM_ADMIN",
                "display_name": "MRV COO",
                "hierarchy_rank": 4,
                "permissions": system_p,
                "created_at": now,
            },
        ]
        op.bulk_insert(
            sa.table(
                "roles",
                sa.column("id", sa.String),
                sa.column("code", sa.String),
                sa.column("display_name", sa.String),
                sa.column("hierarchy_rank", sa.Integer),
                sa.column("permissions", sa.JSON),
                sa.column("created_at", sa.DateTime),
            ),
            rows,
        )
        return

    cnt = bind.execute(text("SELECT COUNT(*) FROM roles")).scalar() or 0
    if cnt == 0:
        user_p, admin_p, super_p, system_p = _perm_sets()
        now = datetime.utcnow()
        rows = [
            (ROLE_USER, "USER", "Tubewell Operator", 1, user_p, now),
            (ROLE_ADMIN, "ADMIN", "Tehsil Manager Operator", 2, admin_p, now),
            (ROLE_SUPER_ADMIN, "SUPER_ADMIN", "Manager Operations", 3, super_p, now),
            (ROLE_SYSTEM_ADMIN, "SYSTEM_ADMIN", "MRV COO", 4, system_p, now),
        ]
        for rid, code, dn, hr, perms, ts in rows:
            bind.execute(
                text(
                    """
                    INSERT INTO roles (id, code, display_name, hierarchy_rank, permissions, created_at)
                    VALUES (:id, :code, :dn, :hr, CAST(:perms AS JSONB), :ts)
                    """
                ),
                {
                    "id": rid,
                    "code": code,
                    "dn": dn,
                    "hr": hr,
                    "perms": json.dumps(perms),
                    "ts": ts,
                },
            )


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    user_col_names = {c["name"] for c in inspector.get_columns("users")}

    _ensure_roles_seeded(bind)

    if "role" in user_col_names and "role_id" not in user_col_names:
        op.add_column("users", sa.Column("role_id", sa.String(36), nullable=True))
        op.add_column("users", sa.Column("tehsil", sa.String(100), nullable=True))

        op.execute(
            text(
                """
                UPDATE users SET role_id = CASE
                    WHEN LOWER(role) = 'operator' THEN :rid_user
                    WHEN LOWER(role) = 'analyst' THEN :rid_admin
                    WHEN LOWER(role) IN ('environment_manager', 'operations_department') THEN :rid_super
                    ELSE :rid_user
                END
                """
            ).bindparams(
                rid_user=ROLE_USER,
                rid_admin=ROLE_ADMIN,
                rid_super=ROLE_SUPER_ADMIN,
            )
        )

        op.execute(
            text("UPDATE users SET role_id = :rid WHERE role_id IS NULL").bindparams(
                rid=ROLE_USER
            )
        )

        op.alter_column("users", "role_id", existing_type=sa.String(36), nullable=False)
        op.drop_column("users", "role")
        op.create_foreign_key(
            "users_role_id_fkey",
            "users",
            "roles",
            ["role_id"],
            ["id"],
        )
    else:
        if "tehsil" not in user_col_names:
            op.add_column("users", sa.Column("tehsil", sa.String(100), nullable=True))
        if "role_id" in user_col_names:
            op.execute(
                text("UPDATE users SET role_id = :rid WHERE role_id IS NULL").bindparams(
                    rid=ROLE_USER
                )
            )

    seed_password = os.environ.get("SEED_DEFAULT_PASSWORD", "PrmscMrv_Seed_ChangeMe!")
    pwd_hash = generate_password_hash(seed_password)

    seed_users = [
        (
            str(uuid.uuid4()),
            "MRV COO (Seed)",
            "mrv.coo@prmsc-mrv.seed",
            pwd_hash,
            ROLE_SYSTEM_ADMIN,
            None,
        ),
        (
            str(uuid.uuid4()),
            "Manager Operations 1 (Seed)",
            "manager.ops1@prmsc-mrv.seed",
            pwd_hash,
            ROLE_SUPER_ADMIN,
            None,
        ),
        (
            str(uuid.uuid4()),
            "Manager Operations 2 (Seed)",
            "manager.ops2@prmsc-mrv.seed",
            pwd_hash,
            ROLE_SUPER_ADMIN,
            None,
        ),
        (
            str(uuid.uuid4()),
            "Manager Operations 3 (Seed)",
            "manager.ops3@prmsc-mrv.seed",
            pwd_hash,
            ROLE_SUPER_ADMIN,
            None,
        ),
    ]

    for uid, name, email, ph, rid, tehsil in seed_users:
        bind.execute(
            text(
                """
                INSERT INTO users (id, name, email, password_hash, phone, role_id, tehsil, created_at)
                VALUES (:id, :name, :email, :ph, NULL, :rid, :tehsil, NOW())
                ON CONFLICT (email) DO NOTHING
                """
            ),
            {"id": uid, "name": name, "email": email, "ph": ph, "rid": rid, "tehsil": tehsil},
        )

    for tehsil_name in TEHSILS:
        slug = (
            tehsil_name.lower()
            .replace(" ", "_")
            .replace(".", "")
            .replace("'", "")
        )
        email = f"tehsil.admin.{slug}@prmsc-mrv.seed"
        uid = str(uuid.uuid4())
        bind.execute(
            text(
                """
                INSERT INTO users (id, name, email, password_hash, phone, role_id, tehsil, created_at)
                VALUES (:id, :name, :email, :ph, NULL, :rid, :tehsil, NOW())
                ON CONFLICT (email) DO NOTHING
                """
            ),
            {
                "id": uid,
                "name": f"Tehsil Manager — {tehsil_name}",
                "email": email,
                "ph": pwd_hash,
                "rid": ROLE_ADMIN,
                "tehsil": tehsil_name,
            },
        )


def downgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "roles" not in inspector.get_table_names():
        return

    user_cols = {c["name"] for c in inspector.get_columns("users")}

    if "role_id" in user_cols:
        op.add_column(
            "users",
            sa.Column("role", sa.String(50), nullable=True),
        )
        op.execute(
            text(
                """
                UPDATE users u
                SET role = r.code
                FROM roles r
                WHERE u.role_id = r.id
                """
            )
        )
        op.execute(text("UPDATE users SET role = 'USER' WHERE role IS NULL"))
        op.alter_column("users", "role", existing_type=sa.String(50), nullable=False)

        inspector = inspect(bind)
        fk_names = [
            fk["name"]
            for fk in inspector.get_foreign_keys("users")
            if fk.get("referred_table") == "roles"
        ]
        for fk in fk_names:
            op.drop_constraint(fk, "users", type_="foreignkey")

        op.drop_column("users", "role_id")
    if "tehsil" in user_cols:
        op.drop_column("users", "tehsil")
    op.drop_table("roles")
