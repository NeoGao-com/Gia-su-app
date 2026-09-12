from pydantic import BaseModel, model_validator
from typing import List, Optional, Any
from datetime import datetime

class QuestionBase(BaseModel):
    content: str
    question_type: str = "MULTIPLE_CHOICE"
    options: Optional[List[str]] = None
    sub_questions: Optional[List[Any]] = None
    blanks: Optional[List[Any]] = None
    sample_solution: Optional[str] = None
    correct_answer: Optional[str] = None
    correct_answers: Optional[List[str]] = None
    correct_option: Optional[int] = None
    subject: str = "Toán"
    grade_level: int = 10
    chapter: Optional[str] = None
    lesson: Optional[str] = None
    topic: Optional[str] = None
    difficulty: str = "THONG_HIEU"
    status: str = "PUBLISHED"
    explanation: Optional[str] = None
    image_url: Optional[str] = None
    latex_code: Optional[str] = None

class QuestionCreate(QuestionBase):
    pass

class QuestionUpdate(BaseModel):
    content: Optional[str] = None
    question_type: Optional[str] = None
    options: Optional[List[str]] = None
    sub_questions: Optional[List[Any]] = None
    blanks: Optional[List[Any]] = None
    sample_solution: Optional[str] = None
    correct_answer: Optional[str] = None
    correct_answers: Optional[List[str]] = None
    correct_option: Optional[int] = None
    subject: Optional[str] = None
    grade_level: Optional[int] = None
    chapter: Optional[str] = None
    lesson: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    status: Optional[str] = None
    explanation: Optional[str] = None
    image_url: Optional[str] = None
    latex_code: Optional[str] = None

class QuestionResponse(QuestionBase):
    id: int
    code: Optional[str] = None
    created_by_id: Optional[int] = None
    created_at: Optional[datetime] = None
    creator_name: Optional[str] = None

    class Config:
        from_attributes = True
