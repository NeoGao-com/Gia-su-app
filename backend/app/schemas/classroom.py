from pydantic import BaseModel
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
    id: int
    code: str
    code_expires_at: Optional[datetime] = None
    instructor_id: Optional[int] = None
    created_at: Optional[datetime] = None
    instructor: Optional[UserResponse] = None
    students: List[UserResponse] = []
    exams: List[ExamResponse] = []
    assignments: List[AssignmentSchemaResponse] = []

    class Config:
        from_attributes = True

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

