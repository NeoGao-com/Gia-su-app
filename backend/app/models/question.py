from sqlalchemy.sql import func
from sqlalchemy import DateTime
from sqlalchemy import Column, Integer, String, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
import enum

class QuestionType(str, enum.Enum):
    MULTIPLE_CHOICE = "MULTIPLE_CHOICE"
    TRUE_FALSE = "TRUE_FALSE"
    SHORT_ANSWER = "SHORT_ANSWER"
    FILL_IN_BLANK = "FILL_IN_BLANK"
    ESSAY = "ESSAY"

class DifficultyLevel(str, enum.Enum):
    NHAN_BIET = "NHAN_BIET"
    THONG_HIEU = "THONG_HIEU"
    VAN_DUNG = "VAN_DUNG"
    VAN_DUNG_CAO = "VAN_DUNG_CAO"

class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)
    content = Column(String)
    question_type = Column(String, default=QuestionType.MULTIPLE_CHOICE)
    subject = Column(String, index=True)
    grade_level = Column(Integer, index=True)
    chapter = Column(String, nullable=True)
    lesson = Column(String, nullable=True)
    topic = Column(String, nullable=True)
    difficulty = Column(String, default=DifficultyLevel.THONG_HIEU, index=True)
    media = Column(JSON, nullable=True)
    options = Column(JSON, nullable=True)
    sub_questions = Column(JSON, nullable=True)
    correct_answers = Column(JSON, nullable=True)
    correct_option = Column(Integer, nullable=True)
    sample_solution = Column(String, nullable=True)
    correct_answer = Column(String, nullable=True)
    blanks = Column(JSON, nullable=True)
    image_url = Column(String, nullable=True)
    latex_code = Column(String, nullable=True)
    explanation = Column(String, nullable=True)
    tags = Column(JSON, nullable=True)
    status = Column(String, default="DRAFT", index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), index=True)

class QuestionAuditLog(Base):
    __tablename__ = "question_audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), index=True)
    action = Column(String, index=True) # CREATE, UPDATE, DELETE, STATUS_CHANGE
    modified_by_id = Column(Integer, ForeignKey("users.id"), index=True)
    old_data = Column(JSON, nullable=True)
    new_data = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

from sqlalchemy import Boolean

class QuestionCategory(Base):
    __tablename__ = "question_categories"
    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String, index=True)
    grade_level = Column(Integer, index=True)
    chapter = Column(String, nullable=True, index=True)
    lesson = Column(String, nullable=True, index=True)
    topic = Column(String, nullable=True, index=True)
    is_deleted = Column(Boolean, default=False, index=True)
    created_by_id = Column(Integer, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class CategoryAuditLog(Base):
    __tablename__ = "category_audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, nullable=True, index=True)
    action = Column(String, index=True) # CREATE, DELETE, RESTORE
    user_id = Column(Integer, nullable=True, index=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())