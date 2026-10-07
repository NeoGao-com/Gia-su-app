from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class ScheduleEventBase(BaseModel):
    title: str
    description: Optional[str] = None
    classroom_id: Optional[int] = None
    day_of_week: int # 1: T2 -> 7: CN
    start_time: str # "HH:MM"
    end_time: str # "HH:MM"
    duration_minutes: Optional[int] = 90
    color: Optional[str] = "#4f46e5"
    is_recurring: Optional[bool] = True
    specific_date: Optional[str] = None

class ScheduleEventCreate(ScheduleEventBase):
    pass

class ScheduleEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    classroom_id: Optional[int] = None
    day_of_week: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    color: Optional[str] = None
    is_recurring: Optional[bool] = None
    specific_date: Optional[str] = None

class ScheduleEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    teacher_id: int
    classroom_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    day_of_week: int
    start_time: str
    end_time: str
    duration_minutes: int
    color: str
    is_recurring: bool
    specific_date: Optional[str] = None
    created_at: Optional[datetime] = None
    
    # Extra fields for UI display
    teacher_name: Optional[str] = None
    classroom_name: Optional[str] = None
