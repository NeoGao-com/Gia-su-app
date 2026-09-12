from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Boolean, JSON, Table, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.question import Question
from app.models.user import User
# Bảng classroom_exams được khai báo trong app.models.classroom (ClassroomExam).
# Vì app.models.classroom được import TRƯỚC app.models.exam trong main.py,
# Table này đã có trong Base.metadata trước khi Exam mapper được compile.

# 1. Bảng trung gian (phải đặt TRƯỚC class Exam)
exam_questions = Table(
    "exam_questions",
    Base.metadata,
    Column("exam_id", Integer, ForeignKey("exams.id", ondelete="CASCADE"), primary_key=True),
    Column("question_id", Integer, ForeignKey("questions.id", ondelete="CASCADE"), primary_key=True),
)

# 2. Model Ma trận đề thi
class ExamMatrix(Base):
    __tablename__ = "exam_matrices"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    subject = Column(String, nullable=False)
    grade_level = Column(Integer, nullable=False)
    # Cấu trúc ma trận: JSON lưu cấu hình số lượng câu hỏi theo topic/difficulty/type
    # Ví dụ: {"chapters": [{"chapter": "Chương I", "topics": [{"topic": "Dạng 1", "difficulties": {"NHAN_BIET": 2, "THONG_HIEU": 3}}]}]}
    matrix_config = Column(JSON, nullable=False)
    total_questions = Column(Integer, default=0)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by_id = Column(Integer, ForeignKey("users.id"), index=True)

    creator = relationship("User", backref="created_matrices")

# 3. Model Đề thi
class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    duration_minutes = Column(Integer, default=45)  # Thời gian làm bài (phút)
    pass_score = Column(Float, nullable=True)        # Điểm đạt
    is_published = Column(Boolean, default=False, index=True)
    is_deleted = Column(Boolean, default=False, index=True)
    show_answers_after_submit = Column(Boolean, default=False)
    max_attempts = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by_id = Column(Integer, ForeignKey("users.id"), index=True)

    # Quan hệ (Relationships)
    creator = relationship("User", backref="created_exams")
    questions = relationship("Question", secondary=exam_questions, backref="exams")
    submissions = relationship("ExamSubmission", back_populates="exam", cascade="all, delete-orphan")
    classrooms = relationship("Classroom", secondary="classroom_exams", back_populates="exams", overlaps="exams")


# 3. Model Bài nộp của học sinh
class ExamSubmission(Base):
    __tablename__ = "exam_submissions"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    score = Column(Float, nullable=True)
    auto_score = Column(Float, nullable=True)
    answers = Column(JSON, nullable=True)
    graded_answers = Column(JSON, nullable=True)
    time_spent = Column(Integer, default=0)         # Thời gian làm bài thực tế (giây)
    grading_status = Column(String, default="GRADED", index=True) # "GRADED" hoặc "PENDING_ESSAY"
    essay_score = Column(Float, nullable=True)
    question_snapshot = Column(JSON, nullable=True) # Snapshot câu hỏi khi nộp
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    status = Column(String, default="IN_PROGRESS")  # "IN_PROGRESS", "SUBMITTED", "GRADED", "PENDING_ESSAY"
    started_at = Column(DateTime(timezone=True), nullable=True)
    last_saved_at = Column(DateTime(timezone=True), nullable=True)
    attempt_number = Column(Integer, default=1)
    version = Column(Integer, nullable=False, default=1)

    # Quan hệ (Relationships)
    exam = relationship("Exam", back_populates="submissions")
    user = relationship("User", backref="submissions")