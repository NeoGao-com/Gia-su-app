"""add_assignment_options

Revision ID: d4e1f7a8b9c0
Revises: f921c023a9f7
Create Date: 2026-09-06 01:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd4e1f7a8b9c0'
down_revision: Union[str, Sequence[str], None] = 'f921c023a9f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    with op.batch_alter_table('assignments') as batch_op:
        batch_op.add_column(sa.Column('max_attempts', sa.Integer(), nullable=True, server_default='1'))
        batch_op.add_column(sa.Column('show_answers_after_submit', sa.Boolean(), nullable=True, server_default='0'))
        batch_op.add_column(sa.Column('duration_minutes_override', sa.Integer(), nullable=True))

def downgrade() -> None:
    with op.batch_alter_table('assignments') as batch_op:
        batch_op.drop_column('duration_minutes_override')
        batch_op.drop_column('show_answers_after_submit')
        batch_op.drop_column('max_attempts')
