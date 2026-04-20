"""Add users.signature_svg.

Revision ID: 0b6a1f2c3d4e
Revises: h1i2j3k4l5m6
Create Date: 2026-04-20
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0b6a1f2c3d4e"
down_revision = "h1i2j3k4l5m6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("signature_svg", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("users", "signature_svg")

