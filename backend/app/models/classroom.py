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
    posts = relationship("ClassroomPost", back_populates="classroom", cascade="all, delete-orphan")

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

class ClassroomPost(Base):
    __tablename__ = "classroom_posts"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    content = Column(String, nullable=False)
    image_url = Column(String, nullable=True)
    is_pinned = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    classroom = relationship("Classroom", back_populates="posts")
    user = relationship("User", backref="classroom_posts")
    comments = relationship("ClassroomComment", back_populates="post", cascade="all, delete-orphan", order_by="ClassroomComment.created_at.asc()")

class ClassroomComment(Base):
    __tablename__ = "classroom_comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("classroom_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(String, nullable=False)
    image_url = Column(String, nullable=True)
    is_teacher_answer = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    post = relationship("ClassroomPost", back_populates="comments")
    user = relationship("User", backref="classroom_comments")
