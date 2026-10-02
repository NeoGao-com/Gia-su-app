from pydantic import BaseModel, model_validator, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
from .exam import ExamResponse

class AssignmentBase(BaseModel):
    exam_id: int
    classroom_id: Optional[int] = None
    due_date: Optional[datetime] = None
    open_date: Optional[datetime] = None
    max_attempts: Optional[int] = Field(None, gt=0)

    @model_validator(mode="after")
    def validate_dates_and_attempts(self) -> "AssignmentBase":
        if self.open_date is not None and self.due_date is not None:
            if self.open_date > self.due_date:
                raise ValueError("open_date must be before due_date")
        if self.max_attempts is not None and self.max_attempts <= 0:
            raise ValueError("max_attempts must be greater than 0")
        return self

class AssignmentCreate(AssignmentBase):
    pass


class AssignmentCreateBody(BaseModel):
    """Schema body riêng cho endpoint POST /classrooms/{classroom_id}/exams.
    Không bắt buộc classroom_id trong body vì đã có trong URL."""
    exam_id: int
    due_date: Optional[datetime] = None
    open_date: Optional[datetime] = None
    max_attempts: Optional[int] = Field(None, gt=0, le=10)
    classroom_id: Optional[int] = None
    show_answers_after_submit: Optional[bool] = None
    duration_minutes_override: Optional[int] = Field(None, gt=0, le=600)

    @model_validator(mode="after")
    def validate_dates_and_attempts(self) -> "AssignmentCreateBody":
        if self.open_date is not None and self.due_date is not None:
            if self.open_date > self.due_date:
                raise ValueError("open_date must be before due_date")
        if self.max_attempts is not None and self.max_attempts <= 0:
            raise ValueError("max_attempts must be greater than 0")
        return self

class AssignmentUpdateBody(BaseModel):
    due_date: Optional[datetime] = None
    open_date: Optional[datetime] = None
    max_attempts: Optional[int] = Field(None, gt=0, le=10)
    show_answers_after_submit: Optional[bool] = None
    duration_minutes_override: Optional[int] = Field(None, gt=0, le=600)

    @model_validator(mode="after")
    def validate_dates_and_attempts(self) -> "AssignmentUpdateBody":
        if self.open_date is not None and self.due_date is not None:
            if self.open_date > self.due_date:
                raise ValueError("open_date must be before due_date")
        if self.max_attempts is not None and self.max_attempts <= 0:
            raise ValueError("max_attempts must be greater than 0")
        return self

class AssignByLessonRequest(BaseModel):
    classroom_id: int
    title: str
    description: Optional[str] = None
    subject: str = "Toán"
    grade_level: int = 10
    chapter: str
    lesson: str
    question_ids: Optional[list[int]] = None
    question_count: Optional[int] = Field(None, gt=0, le=100)
    duration_minutes: int = 45
    pass_score: Optional[float] = 5.0
    due_date: Optional[datetime] = None
    open_date: Optional[datetime] = None
    max_attempts: int = 1
    show_answers_after_submit: bool = True

class AssignmentResponse(AssignmentBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    assigned_at: Optional[datetime] = None
    is_active: bool = True
    show_answers_after_submit: Optional[bool] = None
    duration_minutes_override: Optional[int] = None
    exam: Optional[ExamResponse] = None