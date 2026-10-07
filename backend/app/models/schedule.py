from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class ScheduleEvent(Base):
    __tablename__ = "schedule_events"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="SET NULL"), nullable=True, index=True)
    
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # 1: Thứ Hai, 2: Thứ Ba, 3: Thứ Tư, 4: Thứ Năm, 5: Thứ Sáu, 6: Thứ Bảy, 7: Chủ Nhật
    day_of_week = Column(Integer, nullable=False, index=True)
    
    # Format "HH:MM", ví dụ "07:30", "09:00"
    start_time = Column(String(10), nullable=False)
    end_time = Column(String(10), nullable=False)
    duration_minutes = Column(Integer, default=90, nullable=False)
    
    # Mã màu (VD: "#4f46e5", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0284c7")
    color = Column(String(30), default="#4f46e5", nullable=False)
    
    # Cứ tuần sau giống tuần này hay chỉ là sự kiện ngoài lề 1 lần
    is_recurring = Column(Boolean, default=True, index=True)
    
    # Format "YYYY-MM-DD" cho sự kiện ngoài lề cụ thể
    specific_date = Column(String(20), nullable=True, index=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    teacher = relationship("User", foreign_keys=[teacher_id])
    classroom = relationship("Classroom", foreign_keys=[classroom_id])
