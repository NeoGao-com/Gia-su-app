from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List
from datetime import datetime

class ClassroomBase(BaseModel):
    name: str
    description: Optional[str] = None

class ClassroomCreate(ClassroomBase):
    instructor_id: Optional[int] = None
    code_expires_at: Optional[datetime] = None

class ClassroomUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    instructor_id: Optional[int] = None
    code_expires_at: Optional[datetime] = None

from app.schemas.auth import UserResponse
from app.schemas.exam import ExamResponse
from app.schemas.assignment import AssignmentResponse as AssignmentSchemaResponse, AssignmentCreate

class ClassroomResponse(ClassroomBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    code_expires_at: Optional[datetime] = None
    instructor_id: Optional[int] = None
    created_at: Optional[datetime] = None
    instructor: Optional[UserResponse] = None
    students: List[UserResponse] = []
    exams: List[ExamResponse] = []
    assignments: List[AssignmentSchemaResponse] = []

    @field_validator("assignments", mode="before")
    @classmethod
    def filter_active_assignments(cls, v):
        if not v:
            return []
        filtered = []
        for a in v:
            is_active = getattr(a, "is_active", True)
            if isinstance(a, dict):
                is_active = a.get("is_active", True)
            if is_active:
                filtered.append(a)
        return filtered



class JoinClassroomRequest(BaseModel):
    code: str

class GradebookEntry(BaseModel):
    student_id: int
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    scores: dict

class GradebookResponse(BaseModel):
    students: List[UserResponse]
    assignments: List[AssignmentSchemaResponse]
    gradebook: List[GradebookEntry]
    total: int
    page: int
    limit: int

class DiscussionAuthor(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None

class CommentCreate(BaseModel):
    content: str
    image_url: Optional[str] = None

class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    post_id: int
    user_id: int
    content: str
    image_url: Optional[str] = None
    is_teacher_answer: bool = False
    created_at: Optional[datetime] = None
    author: Optional[DiscussionAuthor] = None

class PostCreate(BaseModel):
    title: str
    content: str
    image_url: Optional[str] = None

class PostResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    classroom_id: int
    user_id: int
    title: str
    content: str
    image_url: Optional[str] = None
    is_pinned: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    author: Optional[DiscussionAuthor] = None
    comments_count: int = 0
    comments: Optional[List[CommentResponse]] = []

