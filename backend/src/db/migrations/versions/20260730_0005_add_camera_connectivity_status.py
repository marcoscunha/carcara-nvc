"""add connectivity_status to cameras

Revision ID: 20260730_0005
Revises: 20260523_0004
Create Date: 2026-07-30 00:00:00.000000

Adds a hardware-connectivity flag distinct from ``is_active`` (user intent).
``connectivity_status`` is owned by the system: it becomes ``offline`` when the
underlying local device is detached and ``online`` when it is present again.
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20260730_0005"
down_revision = "20260523_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "cameras",
        sa.Column("connectivity_status", sa.String(), nullable=False, server_default="unknown"),
    )
    # Seed existing active cameras as online so the UI does not show them offline
    # until the next connectivity sync runs.
    op.execute("UPDATE cameras SET connectivity_status = 'online' WHERE is_active")


def downgrade() -> None:
    op.drop_column("cameras", "connectivity_status")
