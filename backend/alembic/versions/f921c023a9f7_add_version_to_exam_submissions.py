"""add_version_to_exam_submissions

Revision ID: f921c023a9f7
Revises: 3009208ef384
Create Date: 2026-08-17 04:45:55.268219

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f921c023a9f7'
down_revision: Union[str, Sequence[str], None] = '3009208ef384'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('exam_submissions', sa.Column('version', sa.Integer(), nullable=False, server_default='1'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('exam_submissions', 'version')
