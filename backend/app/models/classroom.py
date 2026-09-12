import random
import string
from sqlalchemy import Column, Integer, String, ForeignKey, Table, DateTime, func, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

def generate_classroom_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

# Bảng trung gian học sinh - lớp học
class ClassroomStudent(Base):
    __tablename__ = "classroom_students"
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), primary_key=True, index=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True, index=True)

class ClassroomExam(Base):
    __tablename__ = "classroom_exams"
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), primary_key=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), primary_key=True)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    due_date = Column(DateTime(timezone=True), nullable=True)

class Classroom(Base):
    __tablename__ = "classrooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    code = Column(String(6), unique=True, index=True, default=generate_classroom_code)
    code_expires_at = Column(DateTime(timezone=True), nullable=True)
    is_deleted = Column(Boolean, default=False, index=True)
    instructor_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    instructor = relationship("User", backref="taught_classrooms")
    students = relationship(
        "User",
        secondary="classroom_students",
        secondaryjoin="and_(ClassroomStudent.student_id == User.id, ClassroomStudent.is_active == True)",
        backref="active_classrooms",
        overlaps="all_students,all_classrooms,classrooms"
    )
    all_students = relationship(
        "User",
        secondary="classroom_students",
        overlaps="students,classrooms,active_classrooms"
    )
    exams = relationship("Exam", secondary="classroom_exams", back_populates="classrooms", overlaps="exams")
    assignments = relationship("Assignment", back_populates="classroom", cascade="all, delete-orphan")

class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), index=True)
    due_date = Column(DateTime(timezone=True), nullable=True, index=True)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True, index=True)
    open_date = Column(DateTime(timezone=True), nullable=True, index=True)
    max_attempts = Column(Integer, nullable=True)  # None = dùng giá trị mặc định của đề
    show_answers_after_submit = Column(Boolean, nullable=True)  # None = dùng giá trị mặc định của đề
    duration_minutes_override = Column(Integer, nullable=True)  # None = dùng thời gian của đề

    exam = relationship("Exam")
    classroom = relationship("Classroom", back_populates="assignments")
