from pydantic import BaseModel, field_validator, model_validator, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class ExamBase(BaseModel):
    title: str
    duration_minutes: int = Field(..., gt=0)
    pass_score: Optional[float] = Field(None, ge=0.0, le=10.0)
    max_attempts: Optional[int] = Field(None, gt=0)
    show_answers_after_submit: Optional[bool] = False

    @field_validator("duration_minutes")
    @classmethod
    def validate_duration(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("duration_minutes must be greater than 0")
        return v

    @field_validator("pass_score")
    @classmethod
    def validate_pass_score(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v < 0 or v > 10):
            raise ValueError("pass_score must be between 0 and 10")
        return v

    @field_validator("max_attempts")
    @classmethod
    def validate_max_attempts(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError("max_attempts must be greater than 0")
        return v

class ExamCreate(ExamBase):
    question_ids: List[int]
    question_points: Optional[List[float]] = None

    @model_validator(mode="after")
    def validate_exam_create(self) -> "ExamCreate":
        if not self.question_ids:
            raise ValueError("question_ids cannot be empty")
        if self.question_points is not None:
            if len(self.question_points) != len(self.question_ids):
                raise ValueError("question_points must have the same length as question_ids")
            for pt in self.question_points:
                if pt <= 0:
                    raise ValueError("All question points must be greater than 0")
        return self

class ExamUpdate(BaseModel):
    title: Optional[str] = None
    duration_minutes: Optional[int] = None
    pass_score: Optional[float] = None
    is_published: Optional[bool] = None
    show_answers_after_submit: Optional[bool] = None
    max_attempts: Optional[int] = None
    question_ids: Optional[List[int]] = None
    question_points: Optional[List[float]] = None

    @model_validator(mode="after")
    def validate_exam_update(self) -> "ExamUpdate":
        if self.duration_minutes is not None and self.duration_minutes <= 0:
            raise ValueError("duration_minutes must be greater than 0")
        if self.pass_score is not None and (self.pass_score < 0 or self.pass_score > 10):
            raise ValueError("pass_score must be between 0 and 10")
        if self.max_attempts is not None and self.max_attempts <= 0:
            raise ValueError("max_attempts must be greater than 0")
        if self.question_ids is not None:
            if not self.question_ids:
                raise ValueError("question_ids cannot be empty")
        if self.question_points is not None and self.question_ids is not None:
            if len(self.question_points) != len(self.question_ids):
                raise ValueError("question_points must have the same length as question_ids")
        return self

class ExamResponse(ExamBase):
    id: int
    created_at: datetime
    created_by_id: int

    class Config:
        from_attributes = True

class StudentExamResponse(ExamResponse):
    attempts_taken: int = 0
    question_count: int = 0

class ExamDetailResponse(ExamResponse):
    questions: List[Dict] # Simplified for now, or use QuestionResponse

class ExamSubmissionRequest(BaseModel):
    exam_id: int
    answers: Dict[Any, Any] # Allow string or int keys (question_id as key)
    time_spent: Optional[int] = 0

class ExamSubmissionResponse(BaseModel):
    id: int
    exam_id: int
    user_id: int
    score: Optional[float]
    auto_score: Optional[float] = None
    essay_score: Optional[float] = None
    submitted_at: datetime
    grading_status: str
    status: Optional[str] = "IN_PROGRESS"
    started_at: Optional[datetime] = None
    last_saved_at: Optional[datetime] = None
    attempt_number: Optional[int] = 1
    version: Optional[int] = 1

    class Config:
        from_attributes = True

class ExamSubmissionSaveRequest(BaseModel):
    answers: Dict[str, Any]
    version: int = 1

class EssayGradeRequest(BaseModel):
    question_ids: Optional[List[int]] = None # Optional list of specific essay question IDs to grade

class ExamMatrixBase(BaseModel):
    name: str
    description: Optional[str] = None
    subject: str
    grade_level: int
    matrix_config: Dict[str, Any]  # cấu hình chi tiết

class ExamMatrixCreate(ExamMatrixBase):
    pass

class ExamMatrixUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    grade_level: Optional[int] = None
    matrix_config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class ExamMatrixResponse(ExamMatrixBase):
    id: int
    total_questions: int
    is_active: bool
    created_at: datetime
    created_by_id: int

    class Config:
        from_attributes = True

class ExamMatrixGenerateRequest(BaseModel):
    matrix_id: int
    title: str
    duration_minutes: int = Field(..., gt=0)
    pass_score: Optional[float] = Field(None, ge=0.0, le=10.0)
    max_attempts: Optional[int] = Field(None, gt=0)
    show_answers_after_submit: Optional[bool] = False
    is_published: bool = False