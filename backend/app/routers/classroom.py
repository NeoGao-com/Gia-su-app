import logging
import random
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Optional
from app.database import get_db, redis_client
from app.models.classroom import Classroom, Assignment, ClassroomStudent, ClassroomExam
from app.models.question import Question
from app.schemas.classroom import (
    ClassroomCreate, ClassroomUpdate, ClassroomResponse,
    AssignmentCreate, JoinClassroomRequest, GradebookResponse
)
from app.schemas.assignment import (
    AssignmentResponse, AssignmentCreateBody,
    AssignmentUpdateBody, AssignByLessonRequest
)
from app.core.security import get_current_teacher, get_current_user
from app.core.rate_limiter import parse_rate_limit
from app.core.config import settings
from app.models.user import User
from app.models.exam import Exam, ExamSubmission

import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/classrooms", tags=["classroom"])

async def invalidate_classroom_cache():
    try:
        keys = await redis_client.keys("classrooms:*")
        if keys:
            await redis_client.delete(*keys)
    except Exception:
        pass
    try:
        from app.routers.analytics import invalidate_analytics_cache
        await invalidate_analytics_cache()
    except Exception:
        pass

@router.post("", response_model=ClassroomResponse, summary="Tạo lớp học mới")
@router.post("/", response_model=ClassroomResponse, include_in_schema=False)
async def create_classroom(
    request: Request,
    class_in: ClassroomCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client_ip = request.client.host if request.client else "unknown"
    if current_user.role != "TEACHER":
        logger.warning(f"Classroom creation failed: Unauthorized access by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=403, detail="Chỉ giáo viên mới có quyền tạo lớp học")

    instructor_id = current_user.id

    classroom = Classroom(
        name=class_in.name,
        description=class_in.description,
        instructor_id=instructor_id,
        code_expires_at=class_in.code_expires_at
    )
    db.add(classroom)
    await db.commit()
    await db.refresh(classroom)

    query = select(Classroom).filter(Classroom.id == classroom.id).options(
        selectinload(Classroom.instructor),
        selectinload(Classroom.students),
        selectinload(Classroom.exams),
        selectinload(Classroom.assignments).selectinload(Assignment.exam)
    )
    result = await db.execute(query)
    cl = result.scalars().first()
    await invalidate_classroom_cache()
    logger.info(f"Classroom created: {cl.id} ({cl.name}) by {current_user.email} from IP {client_ip}")
    return cl

@router.get("", response_model=dict, summary="Lấy danh sách lớp học")
@router.get("/", response_model=dict, include_in_schema=False)
async def get_classrooms(
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cache_key = f"classrooms:list:{current_user.id}:{current_user.role}:{page}:{limit}"
    cached = await redis_client.get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass

    offset = (page - 1) * limit
    query = select(Classroom).options(
        selectinload(Classroom.instructor),
        selectinload(Classroom.students),
        selectinload(Classroom.exams),
        selectinload(Classroom.assignments).selectinload(Assignment.exam)
    ).filter(Classroom.is_deleted == False)
    if current_user.role == "TEACHER":
        query = query.filter(Classroom.instructor_id == current_user.id)
    elif current_user.role == "STUDENT":
        query = query.join(Classroom.students).filter(User.id == current_user.id)

    # Count total
    count_query = select(func.count(Classroom.id)).filter(Classroom.is_deleted == False)
    if current_user.role == "TEACHER":
        count_query = count_query.filter(Classroom.instructor_id == current_user.id)
    elif current_user.role == "STUDENT":
        count_query = count_query.join(Classroom.students).filter(User.id == current_user.id)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    classrooms = result.scalars().all()
    classrooms_response = [ClassroomResponse.model_validate(c).model_dump(mode="json") for c in classrooms]

    res_dict = {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if limit > 0 else 0,
        "items": classrooms_response
    }
    try:
        await redis_client.set(cache_key, json.dumps(res_dict), ex=30)
    except Exception:
        pass

    return res_dict

@router.post("/join", response_model=ClassroomResponse, summary="Tham gia lớp học bằng mã code", dependencies=[Depends(parse_rate_limit(settings.JOIN_CLASS_RATE_LIMIT))])
async def join_classroom(
    request: Request,
    join_in: JoinClassroomRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    client_ip = request.client.host if request.client else "unknown"
    if current_user.role != "STUDENT":
        logger.warning(f"Classroom join failed: Unauthorized role {current_user.role} by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=403, detail="Chỉ học sinh mới có thể tham gia lớp học")

    code_str = join_in.code.strip().upper()

    # Brute-force protection / tracking incorrect code attempts via Redis
    brute_key = f"join_attempts:user={current_user.id}"
    try:
        attempts_str = await redis_client.get(brute_key)
        if attempts_str and int(attempts_str) >= 5:
            logger.warning(f"Classroom join blocked: Too many attempts by {current_user.email} from IP {client_ip}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Bạn đã nhập sai mã lớp học quá nhiều lần. Vui lòng thử lại sau ít phút."
            )
    except HTTPException:
        raise
    except Exception:
        logger.debug("Redis join-attempt check unavailable, continuing without brute-force counter")

    query = select(Classroom).filter(Classroom.code == code_str).options(
        selectinload(Classroom.instructor),
        selectinload(Classroom.students),
        selectinload(Classroom.exams),
        selectinload(Classroom.assignments).selectinload(Assignment.exam)
    )
    result = await db.execute(query)
    classroom = result.scalars().first()
    logger.debug(f"join_classroom code={code_str}, found={classroom is not None}")
    if not classroom:
        # Increment failed attempt counter in Redis (expires in 15 minutes = 900 seconds)
        try:
            current_attempts = await redis_client.get(brute_key)
            if current_attempts is None:
                await redis_client.set(brute_key, 1, ex=900)
            else:
                await redis_client.incr(brute_key)
        except Exception:
            logger.debug("Redis join-attempt counter unavailable")
        logger.warning(f"Classroom join failed: Invalid code {code_str} by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=404, detail="Mã lớp học không hợp lệ")

    # Check if code has expired
    if classroom.code_expires_at:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        expires_at = classroom.code_expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if now > expires_at:
            logger.warning(f"Classroom join failed: Expired code {code_str} by {current_user.email} from IP {client_ip}")
            raise HTTPException(status_code=400, detail="Mã tham gia lớp học đã hết hạn")

    # Check if student already joined or previously joined
    from app.models.classroom import ClassroomStudent
    cs_query = select(ClassroomStudent).filter(
        ClassroomStudent.classroom_id == classroom.id,
        ClassroomStudent.student_id == current_user.id
    )
    cs_result = await db.execute(cs_query)
    cs = cs_result.scalars().first()

    if cs:
        if cs.is_active:
            raise HTTPException(status_code=400, detail="Bạn đã tham gia lớp học này rồi")
        else:
            cs.is_active = True
    else:
        classroom.students.append(current_user)
    await db.commit()
    await db.refresh(classroom)
    logger.info(f"Classroom joined: {classroom.id} ({classroom.name}) by {current_user.email} from IP {client_ip}")
    return classroom


@router.get("/students/all", summary="Lấy danh sách tất cả học sinh trong hệ thống")
async def get_all_students(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    res = await db.execute(select(User).filter(User.is_deleted == False))
    users = res.scalars().all()
    students = [u for u in users if str(u.role).upper() in ["STUDENT", "HỌC SINH"]]
    return students

@router.post("/students", summary="Tạo mới tài khoản học sinh")
async def create_student(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    email = payload.get("email", "").strip()
    if not email:
        raise HTTPException(status_code=400, detail="Vui lòng nhập email học sinh")

    user_query = select(User).filter(User.email == email)
    u_res = await db.execute(user_query)
    existing = u_res.scalars().first()
    if existing:
        if existing.is_deleted:
            existing.is_deleted = False
            existing.is_active = True
            await db.commit()
            return existing
        raise HTTPException(status_code=400, detail="Email này đã tồn tại trong hệ thống")

    full_name = payload.get("full_name", "").strip() or email.split("@")[0]
    password = payload.get("password") or "Password@123!"
    from app.core.security import get_password_hash
    new_student = User(
        email=email,
        full_name=full_name,
        hashed_password=get_password_hash(password),
        role="STUDENT",
        is_active=True
    )
    db.add(new_student)
    await db.commit()
    await db.refresh(new_student)
    return new_student

@router.delete("/students/{student_id}", summary="Xóa học sinh khỏi hệ thống")
async def delete_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    student = await db.get(User, student_id)
    if not student or student.is_deleted:
        raise HTTPException(status_code=404, detail="Học sinh không tồn tại")

    student.is_deleted = True
    student.is_active = False
    await db.commit()
    return {"message": "Đã xóa học sinh thành công"}

@router.get("/{classroom_id}/students", summary="Lấy danh sách học sinh thuộc lớp học")
async def get_classroom_students(
    classroom_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Classroom).filter(Classroom.id == classroom_id).options(selectinload(Classroom.students))
    result = await db.execute(query)
    classroom = result.scalars().first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Lớp học không tồn tại")
    return classroom.students

@router.post("/{classroom_id}/students", summary="Thêm học sinh vào lớp học bằng email")
async def add_student_to_classroom(
    classroom_id: int,
    request: Request,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp email học sinh")

    classroom = await db.get(Classroom, classroom_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Lớp học không tồn tại")

    user_query = select(User).filter(User.email == email)
    u_res = await db.execute(user_query)
    student = u_res.scalars().first()
    if not student:
        full_name = payload.get("full_name") or email.split("@")[0]
        password = payload.get("password") or "Password@123!"
        from app.core.security import get_password_hash
        student = User(
            email=email,
            full_name=full_name,
            hashed_password=get_password_hash(password),
            role="STUDENT",
            is_active=True
        )
        db.add(student)
        await db.commit()
        await db.refresh(student)

    from app.models.classroom import ClassroomStudent
    cs_query = select(ClassroomStudent).filter(
        ClassroomStudent.classroom_id == classroom_id,
        ClassroomStudent.student_id == student.id
    )
    cs_res = await db.execute(cs_query)
    cs = cs_res.scalars().first()

    if cs:
        if cs.is_active:
            raise HTTPException(status_code=400, detail="Học sinh đã có trong lớp học này")
        else:
            cs.is_active = True
    else:
        cs_new = ClassroomStudent(classroom_id=classroom_id, student_id=student.id, is_active=True)
        db.add(cs_new)

    await db.commit()
    await invalidate_classroom_cache()
    return {"message": "Đã thêm học sinh vào lớp thành công"}


@router.get("/{classroom_id}")
async def get_classroom(
    classroom_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Classroom).filter(Classroom.id == classroom_id, Classroom.is_deleted == False).options(
        selectinload(Classroom.instructor),
        selectinload(Classroom.students),
        selectinload(Classroom.exams),
    )
    result = await db.execute(query)
    classroom = result.scalars().first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if False:
        raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == "STUDENT" and current_user not in classroom.students:
        raise HTTPException(status_code=403, detail="Not a member of this classroom")

    active_q = select(Assignment).filter(Assignment.classroom_id == classroom_id, Assignment.is_active == True).options(selectinload(Assignment.exam))
    active_res = await db.execute(active_q)
    assignments = active_res.scalars().all()

    from app.schemas.classroom import ClassroomResponse
    resp = ClassroomResponse.model_validate(classroom)
    resp.assignments = [AssignmentResponse.model_validate(a) for a in assignments]
    return resp.model_dump(mode="json")

@router.put("/{classroom_id}", response_model=ClassroomResponse)
async def update_classroom(
    request: Request,
    classroom_id: int,
    class_in: ClassroomUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    client_ip = request.client.host if request.client else "unknown"
    query = select(Classroom).filter(Classroom.id == classroom_id).options(
        selectinload(Classroom.instructor),
        selectinload(Classroom.students),
        selectinload(Classroom.exams),
        selectinload(Classroom.assignments).selectinload(Assignment.exam)
    )
    result = await db.execute(query)
    classroom = result.scalars().first()
    if not classroom:
        logger.warning(f"Classroom update failed: Not found {classroom_id} by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=404, detail="Classroom not found")

    if current_user.role != "TEACHER" and classroom.instructor_id != current_user.id:
        logger.warning(f"Classroom update failed: Unauthorized {classroom_id} by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = class_in.model_dump(exclude_unset=True)
    if "instructor_id" in update_data and update_data["instructor_id"] is not None:
        instructor = await db.get(User, update_data["instructor_id"])
        if not instructor:
            logger.warning(f"Classroom update failed: Instructor not found {update_data['instructor_id']} by {current_user.email} from IP {client_ip}")
            raise HTTPException(status_code=404, detail="Instructor not found")
        if instructor.role != "TEACHER":
            logger.warning(f"Classroom update failed: Invalid role {update_data['instructor_id']} by {current_user.email} from IP {client_ip}")
            raise HTTPException(status_code=400, detail="Instructor must have role TEACHER")

    for field, value in update_data.items():
        setattr(classroom, field, value)

    await db.commit()
    await db.refresh(classroom)
    logger.info(f"Classroom updated: {classroom.id} by {current_user.email} from IP {client_ip}")
    return classroom

@router.delete("/{classroom_id}")
async def delete_classroom(
    request: Request,
    classroom_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    client_ip = request.client.host if request.client else "unknown"
    query = select(Classroom).filter(Classroom.id == classroom_id)
    result = await db.execute(query)
    classroom = result.scalars().first()
    if not classroom:
        logger.warning(f"Classroom delete failed: Not found {classroom_id} by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=404, detail="Classroom not found")

    if current_user.role != "TEACHER" and classroom.instructor_id != current_user.id:
        logger.warning(f"Classroom delete failed: Unauthorized {classroom_id} by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=403, detail="Not authorized")

    classroom.is_deleted = True
    await db.commit()
    await invalidate_classroom_cache()
    logger.info(f"Classroom soft-deleted: {classroom_id} by {current_user.email} from IP {client_ip}")
    return {"message": "Classroom deleted successfully"}

@router.delete("/{classroom_id}/students/{student_id}")
async def remove_student_from_classroom(
    classroom_id: int,
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Classroom).filter(Classroom.id == classroom_id).options(selectinload(Classroom.students))
    result = await db.execute(query)
    classroom = result.scalars().first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if current_user.role == "STUDENT" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == "TEACHER" and classroom.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role not in ["STUDENT", "TEACHER"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    student = await db.get(User, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Check classroom_students table directly to support soft delete / update is_active = False
    from app.models.classroom import ClassroomStudent
    cs_query = select(ClassroomStudent).filter(
        ClassroomStudent.classroom_id == classroom_id,
        ClassroomStudent.student_id == student_id,
        ClassroomStudent.is_active == True
    )
    cs_result = await db.execute(cs_query)
    cs = cs_result.scalars().first()
    if not cs:
        raise HTTPException(status_code=404, detail="Student not found in classroom")

    cs.is_active = False
    await db.commit()
    await invalidate_classroom_cache()
    return {"message": "Student removed successfully"}

@router.delete("/{classroom_id}/leave")
async def leave_classroom(
    classroom_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "STUDENT":
        raise HTTPException(status_code=403, detail="Only students can leave classrooms")

    classroom = await db.get(Classroom, classroom_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    from app.models.classroom import ClassroomStudent
    cs_query = select(ClassroomStudent).filter(
        ClassroomStudent.classroom_id == classroom_id,
        ClassroomStudent.student_id == current_user.id,
        ClassroomStudent.is_active == True
    )
    cs_result = await db.execute(cs_query)
    cs = cs_result.scalars().first()
    if not cs:
        raise HTTPException(status_code=404, detail="You are not a member of this classroom")

    cs.is_active = False
    await db.commit()
    await invalidate_classroom_cache()
    return {"message": "Successfully left the classroom"}

@router.get("/{classroom_id}/gradebook", response_model=GradebookResponse)
async def get_classroom_gradebook(
    classroom_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    classroom_query = select(Classroom).filter(Classroom.id == classroom_id).options(
        selectinload(Classroom.assignments).selectinload(Assignment.exam)
    )
    result = await db.execute(classroom_query)
    classroom = result.scalars().first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if current_user.role != "TEACHER" and classroom.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get active students count and pagination
    from sqlalchemy import func, desc
    count_query = select(func.count(ClassroomStudent.student_id)).filter(
        ClassroomStudent.classroom_id == classroom_id,
        ClassroomStudent.is_active == True
    )
    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    # Get paginated active student IDs and student objects
    students_query = select(User).join(ClassroomStudent).filter(
        ClassroomStudent.classroom_id == classroom_id,
        ClassroomStudent.is_active == True
    ).offset((page - 1) * limit).limit(limit)
    students_res = await db.execute(students_query)
    paginated_students = students_res.scalars().all()

    active_assignments = [a for a in classroom.assignments if getattr(a, 'is_active', True)]
    exam_ids = [a.exam_id for a in active_assignments]
    student_ids = [s.id for s in paginated_students]

    if not student_ids or not exam_ids:
        return {
            "students": paginated_students,
            "assignments": active_assignments,
            "gradebook": [],
            "total": total,
            "page": page,
            "limit": limit
        }

    # Fetch best submission per (user_id, exam_id) using window function or distinct on
    # In PostgreSQL, we can use DISTINCT ON or ROW_NUMBER()
    # Let's use SQLAlchemy subquery with row_number
    from sqlalchemy import and_, or_

    subq = select(
        ExamSubmission.id,
        ExamSubmission.user_id,
        ExamSubmission.exam_id,
        ExamSubmission.score,
        ExamSubmission.grading_status,
        ExamSubmission.submitted_at,
        func.row_number().over(
            partition_by=(ExamSubmission.user_id, ExamSubmission.exam_id),
            order_by=(desc(ExamSubmission.score), desc(ExamSubmission.submitted_at))
        ).label("rn")
    ).filter(
        ExamSubmission.exam_id.in_(exam_ids),
        ExamSubmission.user_id.in_(student_ids)
    ).subquery()

    best_subs_query = select(subq).filter(subq.c.rn == 1)
    sub_result = await db.execute(best_subs_query)
    submissions = sub_result.all()

    grades_map = {}
    for sub in submissions:
        grades_map[(sub.user_id, sub.exam_id)] = {
            "score": sub.score,
            "status": sub.grading_status,
            "submitted_at": sub.submitted_at
        }

    gradebook = []
    for student in paginated_students:
        row = {
            "student_id": student.id,
            "student_name": student.full_name,
            "student_email": student.email,
            "scores": {}
        }
        for assignment in active_assignments:
            row["scores"][assignment.exam_id] = grades_map.get((student.id, assignment.exam_id), None)
        gradebook.append(row)

    return {
        "students": paginated_students,
        "assignments": active_assignments,
        "gradebook": gradebook,
        "total": total,
        "page": page,
        "limit": limit
    }


@router.get("/{classroom_id}/exams", summary="Lấy danh sách đề thi được giao cho lớp")
async def get_classroom_exams(
    classroom_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    classroom = await db.get(Classroom, classroom_id)
    if not classroom or classroom.is_deleted:
        raise HTTPException(status_code=404, detail="Lớp học không tồn tại")
    q = (
        select(Assignment)
        .filter(Assignment.classroom_id == classroom_id, Assignment.is_active == True)
        .options(selectinload(Assignment.exam))
        .order_by(Assignment.assigned_at.desc())
    )
    res = await db.execute(q)
    assignments = res.scalars().all()
    return [AssignmentResponse.model_validate(a).model_dump(mode="json") for a in assignments]


@router.post("/{classroom_id}/exams", response_model=AssignmentResponse, summary="Giao đề thi cho lớp học")
async def assign_exam_to_classroom(
    classroom_id: int,
    payload: AssignmentCreateBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher),
):
    classroom = await db.get(Classroom, classroom_id)
    if not classroom or classroom.is_deleted:
        raise HTTPException(status_code=404, detail="Lớp học không tồn tại")
    if classroom.instructor_id and classroom.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền giao bài cho lớp này")

    exam_res = await db.execute(select(Exam).filter(Exam.id == payload.exam_id, Exam.is_deleted == False))
    exam = exam_res.scalars().first()
    if not exam:
        raise HTTPException(status_code=404, detail="Đề thi không tồn tại")

    exist_res = await db.execute(
        select(Assignment).filter(
            Assignment.classroom_id == classroom_id,
            Assignment.exam_id == payload.exam_id,
            Assignment.is_active == True,
        )
    )
    existing = exist_res.scalars().first()
    if existing:
        existing.due_date = payload.due_date
        existing.open_date = payload.open_date
        existing.max_attempts = payload.max_attempts
        existing.show_answers_after_submit = payload.show_answers_after_submit
        existing.duration_minutes_override = payload.duration_minutes_override
        await db.commit()
        await db.refresh(existing)
        res = await db.execute(
            select(Assignment).filter(Assignment.id == existing.id).options(selectinload(Assignment.exam))
        )
        return res.scalars().first()

    assignment = Assignment(
        classroom_id=classroom_id,
        exam_id=payload.exam_id,
        due_date=payload.due_date,
        open_date=payload.open_date,
        max_attempts=payload.max_attempts,
        show_answers_after_submit=payload.show_answers_after_submit,
        duration_minutes_override=payload.duration_minutes_override,
        is_active=True,
    )
    db.add(assignment)
    ce_res = await db.execute(
        select(ClassroomExam).filter(
            ClassroomExam.classroom_id == classroom_id,
            ClassroomExam.exam_id == payload.exam_id,
        )
    )
    if not ce_res.scalars().first():
        db.add(ClassroomExam(classroom_id=classroom_id, exam_id=payload.exam_id, due_date=payload.due_date))
    await db.commit()
    await db.refresh(assignment)
    res = await db.execute(
        select(Assignment).filter(Assignment.id == assignment.id).options(selectinload(Assignment.exam))
    )
    return res.scalars().first()


@router.delete("/{classroom_id}/exams/{exam_id}", summary="Hủy giao đề thi cho lớp học")
async def unassign_exam_from_classroom(
    classroom_id: int,
    exam_id: int,
    student_ids: Optional[list[int]] = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher),
):
    classroom = await db.get(Classroom, classroom_id)
    if not classroom or classroom.is_deleted:
        raise HTTPException(status_code=404, detail="Lớp học không tồn tại")
    if classroom.instructor_id and classroom.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền hủy giao bài của lớp này")

    res = await db.execute(
        select(Assignment).filter(
            Assignment.classroom_id == classroom_id,
            Assignment.exam_id == exam_id,
            Assignment.is_active == True,
        )
    )
    assignments = res.scalars().all()
    if not assignments:
        ce_res = await db.execute(
            select(ClassroomExam).filter(
                ClassroomExam.classroom_id == classroom_id,
                ClassroomExam.exam_id == exam_id,
            )
        )
        for ce in ce_res.scalars().all():
            await db.delete(ce)
        await db.commit()
        return {"message": "Đề thi đã được hủy giao thành công"}

    # Handle cancellation per student or whole classroom
    cs_q = select(ClassroomStudent.student_id).filter(
        ClassroomStudent.classroom_id == classroom_id,
        ClassroomStudent.is_active == True
    )
    cs_res = await db.execute(cs_q)
    class_student_ids = set(cs_res.scalars().all())

    is_all = not student_ids or (class_student_ids and class_student_ids.issubset(set(student_ids)))

    if student_ids:
        sub_q = select(ExamSubmission).filter(
            ExamSubmission.exam_id == exam_id,
            ExamSubmission.user_id.in_(student_ids)
        )
        sub_res = await db.execute(sub_q)
        subs = sub_res.scalars().all()
        for sub in subs:
            await db.delete(sub)

    if is_all:
        for a in assignments:
            a.is_active = False

        ce_res = await db.execute(
            select(ClassroomExam).filter(
                ClassroomExam.classroom_id == classroom_id,
                ClassroomExam.exam_id == exam_id,
            )
        )
        for ce in ce_res.scalars().all():
            await db.delete(ce)

    await db.commit()
    try:
        keys = await redis_client.keys("exams:*")
        if keys:
            await redis_client.delete(*keys)
    except Exception:
        pass
    return {"message": "Đã hủy giao đề thi thành công"}


@router.get("/assignments/all", summary="Lấy danh sách tất cả bài tập đã giao của giáo viên")
async def get_all_teacher_assignments(
    classroom_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher),
):
    query = (
        select(Assignment)
        .join(Classroom, Assignment.classroom_id == Classroom.id)
        .filter(
            Classroom.is_deleted == False,
            Assignment.is_active == True,
        )
        .options(
            selectinload(Assignment.exam),
            selectinload(Assignment.classroom),
        )
        .order_by(Assignment.assigned_at.desc())
    )
    if current_user.role == "TEACHER":
        query = query.filter(Classroom.instructor_id == current_user.id)
    if classroom_id:
        query = query.filter(Assignment.classroom_id == classroom_id)

    res = await db.execute(query)
    assignments = res.scalars().all()
    results = []
    for a in assignments:
        item = AssignmentResponse.model_validate(a).model_dump(mode="json")
        item["classroom_name"] = a.classroom.name if a.classroom else None
        item["classroom_code"] = a.classroom.code if a.classroom else None
        results.append(item)
    return results


@router.put("/{classroom_id}/exams/{exam_id}", response_model=AssignmentResponse, summary="Chỉnh sửa bài tập đã giao")
async def update_classroom_assignment(
    classroom_id: int,
    exam_id: int,
    payload: AssignmentUpdateBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher),
):
    classroom = await db.get(Classroom, classroom_id)
    if not classroom or classroom.is_deleted:
        raise HTTPException(status_code=404, detail="Lớp học không tồn tại")
    if classroom.instructor_id and classroom.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền chỉnh sửa bài tập của lớp này")

    res = await db.execute(
        select(Assignment).filter(
            Assignment.classroom_id == classroom_id,
            Assignment.exam_id == exam_id,
            Assignment.is_active == True,
        )
    )
    assignment = res.scalars().first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Bài tập không tồn tại hoặc đã bị hủy")

    update_dict = payload.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(assignment, k, v)

    if "due_date" in update_dict:
        ce_res = await db.execute(
            select(ClassroomExam).filter(
                ClassroomExam.classroom_id == classroom_id,
                ClassroomExam.exam_id == exam_id,
            )
        )
        ce = ce_res.scalars().first()
        if ce:
            ce.due_date = payload.due_date

    await db.commit()
    await db.refresh(assignment)
    res_full = await db.execute(
        select(Assignment).filter(Assignment.id == assignment.id).options(selectinload(Assignment.exam))
    )
    return res_full.scalars().first()


@router.post("/{classroom_id}/assign-by-lesson", response_model=AssignmentResponse, summary="Giao bài tập theo bài học trên lớp")
async def assign_by_lesson(
    classroom_id: int,
    payload: AssignByLessonRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher),
):
    classroom = await db.get(Classroom, classroom_id)
    if not classroom or classroom.is_deleted:
        raise HTTPException(status_code=404, detail="Lớp học không tồn tại")
    if classroom.instructor_id and classroom.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền giao bài cho lớp này")

    # 1. Tìm danh sách câu hỏi theo bài học
    if payload.question_ids:
        q_res = await db.execute(select(Question).filter(Question.id.in_(payload.question_ids)))
        questions = q_res.scalars().all()
    else:
        q_query = select(Question).filter(
            Question.subject == payload.subject,
            Question.grade_level == payload.grade_level,
            Question.chapter == payload.chapter,
            Question.lesson == payload.lesson,
        )
        q_res = await db.execute(q_query)
        all_matching = q_res.scalars().all()
        if payload.question_count and len(all_matching) > payload.question_count:
            questions = random.sample(all_matching, payload.question_count)
        else:
            questions = all_matching

    if not questions:
        raise HTTPException(
            status_code=400,
            detail=f"Không tìm thấy câu hỏi nào cho bài học '{payload.lesson}' ({payload.chapter}) môn {payload.subject} lớp {payload.grade_level}"
        )

    # 2. Tạo đề thi tự động từ các câu hỏi của bài học này
    exam_title = payload.title.strip() or f"Bài tập: {payload.lesson} - {classroom.name}"
    exam = Exam(
        title=exam_title,
        description=payload.description or f"Bài tập theo bài học: {payload.lesson} (Chương: {payload.chapter} - Khối {payload.grade_level})",
        duration_minutes=payload.duration_minutes,
        pass_score=payload.pass_score,
        is_published=True,
        max_attempts=payload.max_attempts,
        show_answers_after_submit=payload.show_answers_after_submit,
        exam_type="ASSIGNMENT",
        created_by_id=current_user.id,
    )
    exam.questions = questions
    db.add(exam)
    await db.commit()
    await db.refresh(exam)

    # 3. Giao đề thi mới này cho lớp học
    assignment = Assignment(
        classroom_id=classroom_id,
        exam_id=exam.id,
        due_date=payload.due_date,
        open_date=payload.open_date,
        max_attempts=payload.max_attempts,
        show_answers_after_submit=payload.show_answers_after_submit,
        duration_minutes_override=None,
        is_active=True,
    )
    db.add(assignment)
    db.add(ClassroomExam(classroom_id=classroom_id, exam_id=exam.id, due_date=payload.due_date))
    await db.commit()
    await db.refresh(assignment)

    res = await db.execute(
        select(Assignment).filter(Assignment.id == assignment.id).options(selectinload(Assignment.exam))
    )
    return res.scalars().first()

