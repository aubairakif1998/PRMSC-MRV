"""User manager operation table (manager ↔ tehsil) + seed rows.

Revision ID: 0f2a3b4c5d6e
Revises: 0e1f2a3b4c5d
Create Date: 2026-04-23
"""

from alembic import op
import sqlalchemy as sa


revision = "0f2a3b4c5d6e"
down_revision = "0e1f2a3b4c5d"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "user_manageroperation",
        sa.Column("id", sa.String(length=36), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tehsil", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("user_id", "tehsil", name="uq_user_manageroperation_user_tehsil"),
    )

    # Seed mappings (canonical tehsil strings are stored as provided).
    seed_rows = [
        # NorthManager (8cb71d7d-25f1-4c22-b98f-e1f84c6aed92)
        {"id": "c0bcbf3a-5f44-4b79-9c0f-06f6b1d3b1a1", "user_id": "8cb71d7d-25f1-4c22-b98f-e1f84c6aed92", "tehsil": "KALLAR KAHAR"},
        {"id": "3d7dd8d7-8b9c-4f3c-9e9d-2b2a2a4c9d10", "user_id": "8cb71d7d-25f1-4c22-b98f-e1f84c6aed92", "tehsil": "KOT MOMIN"},
        {"id": "2df9e7fd-2f1d-4f86-93a2-7840e0f9153b", "user_id": "8cb71d7d-25f1-4c22-b98f-e1f84c6aed92", "tehsil": "NOORPUR THAL"},
        {"id": "a9b2fbd1-8a41-4c5b-98a3-4b0f9f8d0a12", "user_id": "8cb71d7d-25f1-4c22-b98f-e1f84c6aed92", "tehsil": "ISA KHEL"},

        # CentralManager (56eb3f2d-7dff-4fe7-9748-0e98e1ea4dae)
        {"id": "c9f4e3e0-0b4f-4b4f-9c3b-0d1fd5a7c2a1", "user_id": "56eb3f2d-7dff-4fe7-9748-0e98e1ea4dae", "tehsil": "PAKPATTAN"},
        {"id": "b4e3d0c2-8b1f-4b5d-88e9-52a39d62b7b2", "user_id": "56eb3f2d-7dff-4fe7-9748-0e98e1ea4dae", "tehsil": "BHOWANA"},
        {"id": "6dd39d45-8fda-4c61-8d55-9b8a3d40d3f1", "user_id": "56eb3f2d-7dff-4fe7-9748-0e98e1ea4dae", "tehsil": "AHMADPUR SIAL"},
        {"id": "70d7f4b7-6e13-4f1f-9a3e-6b6c0f7b2e11", "user_id": "56eb3f2d-7dff-4fe7-9748-0e98e1ea4dae", "tehsil": "DARYA KHAN"},

        # SouthManager (c7858e4c-9fc8-40a7-83d1-8b2604dfcf97)
        {"id": "0b2fb6c6-2c4f-49e0-9f0f-2c9dd8b2a3a1", "user_id": "c7858e4c-9fc8-40a7-83d1-8b2604dfcf97", "tehsil": "KAHROR PACCA"},
        {"id": "5c7ad4a1-7a4a-4c4b-9d64-1f5d8d2f4e22", "user_id": "c7858e4c-9fc8-40a7-83d1-8b2604dfcf97", "tehsil": "KHAIRPUR TAMEWALI"},
        {"id": "d1c5e9a3-4d58-4a45-8a8e-5e43b9d8c3a3", "user_id": "c7858e4c-9fc8-40a7-83d1-8b2604dfcf97", "tehsil": "ROJHAN"},
        {"id": "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c64", "user_id": "c7858e4c-9fc8-40a7-83d1-8b2604dfcf97", "tehsil": "TAUNSA"},
        {"id": "7f6e5d4c-3b2a-4c1d-9e8f-7a6b5c4d3e21", "user_id": "c7858e4c-9fc8-40a7-83d1-8b2604dfcf97", "tehsil": "SHUJABAD"},
        {"id": "4e3d2c1b-0a9f-4b8c-9d7e-6f5a4b3c2d10", "user_id": "c7858e4c-9fc8-40a7-83d1-8b2604dfcf97", "tehsil": "BAHAWALNAGAR"},
        {"id": "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d", "user_id": "c7858e4c-9fc8-40a7-83d1-8b2604dfcf97", "tehsil": "ALIPUR"},
        {"id": "6b5c4d3e-2f1a-4b0c-9d8e-7f6a5b4c3d2e", "user_id": "c7858e4c-9fc8-40a7-83d1-8b2604dfcf97", "tehsil": "LIAQATPUR"},
    ]

    op.bulk_insert(
        sa.table(
            "user_manageroperation",
            sa.Column("id", sa.String(length=36)),
            sa.Column("user_id", sa.String(length=36)),
            sa.Column("tehsil", sa.String(length=100)),
        ),
        seed_rows,
    )


def downgrade():
    op.drop_table("user_manageroperation")

