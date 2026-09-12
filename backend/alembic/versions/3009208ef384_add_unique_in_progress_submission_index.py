"""add_unique_in_progress_submission_index

Revision ID: 3009208ef384
Revises: ef52ffee864a
Create Date: 2026-08-17 04:44:03.017859

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3009208ef384'
down_revision: Union[str, Sequence[str], None] = 'ef52ffee864a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create a unique partial index for IN_PROGRESS submissions per user and exam
    op.execute(
        "CREATE UNIQUE INDEX idx_unique_in_progress_submission "
        "ON exam_submissions (user_id, exam_id) "
        "WHERE status = 'IN_PROGRESS'"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP INDEX IF EXISTS idx_unique_in_progress_submission")
