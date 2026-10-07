import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.classroom import Classroom, ClassroomStudent
from app.models.schedule import ScheduleEvent
from app.schemas.schedule import (
    ScheduleEventCreate, ScheduleEventUpdate, ScheduleEventResponse
)
from app.core.security import get_current_user, get_current_teacher

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/schedule", tags=["schedule"])

def parse_time_mins(t_str: str) -> int:
    try:
        parts = t_str.strip().split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return 0

def format_mins_to_time(total_mins: int) -> str:
    h = (total_mins // 60) % 24
    m = total_mins % 60
    return f"{h:02d}:{m:02d}"

@router.get("/teacher", summary="Lấy danh sách thời khóa biểu của giáo viên")
async def get_teacher_schedule(
    classroom_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    query = (
        select(ScheduleEvent)
        .options(selectinload(ScheduleEvent.classroom), selectinload(ScheduleEvent.teacher))
        .filter(ScheduleEvent.teacher_id == current_user.id)
    )
    if classroom_id:
        query = query.filter(ScheduleEvent.classroom_id == classroom_id)

    res = await db.execute(query.order_by(ScheduleEvent.day_of_week, ScheduleEvent.start_time))
    events = res.scalars().all()

    # Get teacher's classrooms for filtering and selecting in UI
    cls_query = select(Classroom).filter(Classroom.instructor_id == current_user.id, Classroom.is_deleted == False)
    cls_res = await db.execute(cls_query)
    classrooms = cls_res.scalars().all()

    result_events = []
    for ev in events:
        c_name = ev.classroom.name if ev.classroom else None
        t_name = ev.teacher.full_name or ev.teacher.email if ev.teacher else current_user.full_name
        result_events.append({
            "id": ev.id,
            "teacher_id": ev.teacher_id,
            "classroom_id": ev.classroom_id,
            "title": ev.title,
            "description": ev.description,
            "day_of_week": ev.day_of_week,
            "start_time": ev.start_time,
            "end_time": ev.end_time,
            "duration_minutes": ev.duration_minutes,
            "color": ev.color,
            "is_recurring": ev.is_recurring,
            "specific_date": ev.specific_date,
            "created_at": ev.created_at,
            "teacher_name": t_name,
            "classroom_name": c_name,
        })

    return {
        "events": result_events,
        "classrooms": [{"id": c.id, "name": c.name, "code": c.code} for c in classrooms]
    }

@router.post("/events", summary="Giáo viên tạo khối sự kiện thời khóa biểu mới")
async def create_schedule_event(
    payload: ScheduleEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    if not (1 <= payload.day_of_week <= 7):
        raise HTTPException(status_code=400, detail="Ngày trong tuần không hợp lệ (1: Thứ 2 đến 7: Chủ nhật)")

    start_mins = parse_time_mins(payload.start_time)
    end_mins = parse_time_mins(payload.end_time)
    if end_mins <= start_mins:
        # Default duration 90 minutes if invalid
        end_mins = start_mins + 90
        payload.end_time = format_mins_to_time(end_mins)

    duration = payload.duration_minutes or (end_mins - start_mins)
    if duration < 15:
        duration = 15

    new_event = ScheduleEvent(
        teacher_id=current_user.id,
        classroom_id=payload.classroom_id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        day_of_week=payload.day_of_week,
        start_time=payload.start_time.strip(),
        end_time=payload.end_time.strip(),
        duration_minutes=duration,
        color=payload.color or "#4f46e5",
        is_recurring=payload.is_recurring if payload.is_recurring is not None else True,
        specific_date=payload.specific_date.strip() if payload.specific_date else None
    )

    db.add(new_event)
    await db.commit()
    await db.refresh(new_event)

    c_name = None
    if new_event.classroom_id:
        c_obj = await db.get(Classroom, new_event.classroom_id)
        if c_obj:
            c_name = c_obj.name

    return {
        "id": new_event.id,
        "teacher_id": new_event.teacher_id,
        "classroom_id": new_event.classroom_id,
        "title": new_event.title,
        "description": new_event.description,
        "day_of_week": new_event.day_of_week,
        "start_time": new_event.start_time,
        "end_time": new_event.end_time,
        "duration_minutes": new_event.duration_minutes,
        "color": new_event.color,
        "is_recurring": new_event.is_recurring,
        "specific_date": new_event.specific_date,
        "created_at": new_event.created_at,
        "teacher_name": current_user.full_name or current_user.email,
        "classroom_name": c_name
    }

@router.put("/events/{event_id}", summary="Giáo viên cập nhật khối sự kiện (kéo thả, resize, đổi màu)")
async def update_schedule_event(
    event_id: int,
    payload: ScheduleEventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    event = await db.get(ScheduleEvent, event_id)
    if not event or event.teacher_id != current_user.id:
        raise HTTPException(status_code=404, detail="Sự kiện không tồn tại hoặc bạn không có quyền sửa")

    if "title" in payload.model_fields_set and payload.title:
        event.title = payload.title.strip()
    if "description" in payload.model_fields_set:
        event.description = payload.description.strip() if payload.description else None
    if "classroom_id" in payload.model_fields_set:
        event.classroom_id = payload.classroom_id if (payload.classroom_id and payload.classroom_id > 0) else None
    if "day_of_week" in payload.model_fields_set and payload.day_of_week and 1 <= payload.day_of_week <= 7:
        event.day_of_week = payload.day_of_week
    if "color" in payload.model_fields_set and payload.color:
        event.color = payload.color
    if "is_recurring" in payload.model_fields_set and payload.is_recurring is not None:
        event.is_recurring = payload.is_recurring
    if "specific_date" in payload.model_fields_set:
        event.specific_date = payload.specific_date.strip() if payload.specific_date else None

    # Handle time / resize updates
    if payload.start_time is not None:
        event.start_time = payload.start_time.strip()
    if payload.end_time is not None:
        event.end_time = payload.end_time.strip()

    if payload.duration_minutes is not None:
        event.duration_minutes = max(15, payload.duration_minutes)
        # Recalculate end_time if start_time is set
        start_mins = parse_time_mins(event.start_time)
        event.end_time = format_mins_to_time(start_mins + event.duration_minutes)
    elif payload.start_time is not None or payload.end_time is not None:
        start_mins = parse_time_mins(event.start_time)
        end_mins = parse_time_mins(event.end_time)
        if end_mins > start_mins:
            event.duration_minutes = end_mins - start_mins

    await db.commit()
    await db.refresh(event)

    c_name = None
    if event.classroom_id:
        c_obj = await db.get(Classroom, event.classroom_id)
        if c_obj:
            c_name = c_obj.name

    return {
        "id": event.id,
        "teacher_id": event.teacher_id,
        "classroom_id": event.classroom_id,
        "title": event.title,
        "description": event.description,
        "day_of_week": event.day_of_week,
        "start_time": event.start_time,
        "end_time": event.end_time,
        "duration_minutes": event.duration_minutes,
        "color": event.color,
        "is_recurring": event.is_recurring,
        "specific_date": event.specific_date,
        "created_at": event.created_at,
        "teacher_name": current_user.full_name or current_user.email,
        "classroom_name": c_name
    }

@router.delete("/events/{event_id}", summary="Giáo viên xóa khối sự kiện")
async def delete_schedule_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    event = await db.get(ScheduleEvent, event_id)
    if not event or event.teacher_id != current_user.id:
        raise HTTPException(status_code=404, detail="Sự kiện không tồn tại hoặc bạn không có quyền xóa")

    await db.delete(event)
    await db.commit()
    return {"message": "Đã xóa sự kiện thành công", "deleted_id": event_id}

@router.get("/student", summary="Học sinh xem thời khóa biểu các lớp tham gia (Chỉ xem)")
async def get_student_schedule(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Find all active classrooms for current student
    stmt_classes = select(ClassroomStudent.classroom_id).filter(
        ClassroomStudent.student_id == current_user.id,
        ClassroomStudent.is_active == True
    )
    res_classes = await db.execute(stmt_classes)
    classroom_ids = res_classes.scalars().all()

    if not classroom_ids:
        return {"events": [], "classrooms": []}

    # Fetch events in those classrooms
    query = (
        select(ScheduleEvent)
        .options(selectinload(ScheduleEvent.classroom), selectinload(ScheduleEvent.teacher))
        .filter(ScheduleEvent.classroom_id.in_(classroom_ids))
        .order_by(ScheduleEvent.day_of_week, ScheduleEvent.start_time)
    )
    res = await db.execute(query)
    events = res.scalars().all()

    # Fetch classroom objects
    cls_query = select(Classroom).filter(Classroom.id.in_(classroom_ids))
    cls_res = await db.execute(cls_query)
    classrooms = cls_res.scalars().all()

    result_events = []
    for ev in events:
        c_name = ev.classroom.name if ev.classroom else None
        t_name = ev.teacher.full_name or ev.teacher.email if ev.teacher else "Giáo viên"
        result_events.append({
            "id": ev.id,
            "teacher_id": ev.teacher_id,
            "classroom_id": ev.classroom_id,
            "title": ev.title,
            "description": ev.description,
            "day_of_week": ev.day_of_week,
            "start_time": ev.start_time,
            "end_time": ev.end_time,
            "duration_minutes": ev.duration_minutes,
            "color": ev.color,
            "is_recurring": ev.is_recurring,
            "specific_date": ev.specific_date,
            "created_at": ev.created_at,
            "teacher_name": t_name,
            "classroom_name": c_name,
        })

    return {
        "events": result_events,
        "classrooms": [{"id": c.id, "name": c.name, "code": c.code} for c in classrooms]
    }
