import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Optional
from app.database import get_db
from app.models.classroom import Classroom, Assignment, ClassroomStudent
from app.schemas.classroom import (
    ClassroomCreate, ClassroomUpdate, ClassroomResponse,
    AssignmentCreate, JoinClassroomRequest, GradebookResponse
)
from app.schemas.assignment import AssignmentResponse, AssignmentCreateBody
from app.core.security import get_current_teacher, get_current_user
from app.core.rate_limiter import parse_rate_limit
from app.core.config import settings
from app.models.user import User
from app.models.exam import Exam, ExamSubmission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/classrooms", tags=["classroom"])

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

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if limit > 0 else 0,
        "items": classrooms_response
    }

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
    res = await db.execute(select(User))
    users = res.scalars().all()
    students = [u for u in users if str(u.role).upper() in ["STUDENT", "HỌC SINH"]]
    return students

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
    return {"message": "Đã thêm học sinh vào lớp thành công"}


@router.get("/{classroom_id}", response_model=ClassroomResponse)
async def get_classroom(
    classroom_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Classroom).filter(Classroom.id == classroom_id, Classroom.is_deleted == False).options(
        selectinload(Classroom.instructor),
        selectinload(Classroom.students),
        selectinload(Classroom.exams),
        selectinload(Classroom.assignments).selectinload(Assignment.exam)
    )
    result = await db.execute(query)
    classroom = result.scalars().first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if False:
        raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == "STUDENT" and current_user not in classroom.students:
        raise HTTPException(status_code=403, detail="Not a member of this classroom")

    return classroom

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

    if current_user.role not in ("ADMIN", "TEACHER") and classroom.instructor_id != current_user.id:
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

    if current_user.role not in ("ADMIN", "TEACHER") and classroom.instructor_id != current_user.id:
        logger.warning(f"Classroom delete failed: Unauthorized {classroom_id} by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=403, detail="Not authorized")

    classroom.is_deleted = True
    await db.commit()
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
    elif current_user.role not in ["STUDENT", "TEACHER", "ADMIN"]:
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
    return {"message": "Successfully left the classroom"}

def _with_exam(assignment):
    """Gắn thông tin exam vào assignment response để frontend hiển thị tiêu đề đề thi."""
    from app.schemas.exam import ExamResponse as ExamResp
    if assignment is None:
        return assignment
    resp = AssignmentResponse.model_validate(assignment).model_dump(mode="json")
    try:
        resp["exam"] = ExamResp.model_validate(assignment.exam).model_dump(mode="json")
    except Exception:
        resp["exam"] = None
    return resp


@router.post("/{classroom_id}/exams", response_model=AssignmentResponse)
async def assign_exam_to_classroom(
    classroom_id: int,
    assign_in: AssignmentCreateBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    # Classroom_id lấy từ URL là nguồn chính, nếu thiếu body thì fallback từ URL
    effective_classroom_id = assign_in.classroom_id or classroom_id

    classroom = await db.get(Classroom, effective_classroom_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if current_user.role not in ("ADMIN", "TEACHER") and classroom.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    exam = await db.get(Exam, assign_in.exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    if current_user.role not in ("ADMIN", "TEACHER") and exam.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only assign exams that you created")

    # Check for existing assignment
    query = select(Assignment).filter(
        Assignment.classroom_id == effective_classroom_id,
        Assignment.exam_id == assign_in.exam_id
    )
    result = await db.execute(query)
    existing_assignment = result.scalars().first()

    if existing_assignment:
        if existing_assignment.is_active:
            raise HTTPException(status_code=400, detail="Assignment already exists for this classroom and exam")
        else:
            # Reactivate
            existing_assignment.is_active = True
            existing_assignment.due_date = assign_in.due_date
            await db.commit()
            await db.refresh(existing_assignment)
            return _with_exam(existing_assignment)

    assignment = Assignment(
        exam_id=assign_in.exam_id,
        classroom_id=effective_classroom_id,
        due_date=assign_in.due_date,
        open_date=assign_in.open_date,
        max_attempts=assign_in.max_attempts,
        show_answers_after_submit=assign_in.show_answers_after_submit,
        duration_minutes_override=assign_in.duration_minutes_override
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return _with_exam(assignment)

@router.delete("/{classroom_id}/exams/{exam_id}")
async def unassign_exam_from_classroom(
    classroom_id: int,
    exam_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    classroom = await db.get(Classroom, classroom_id)
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if current_user.role not in ("ADMIN", "TEACHER") and classroom.instructor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    query = select(Assignment).filter(Assignment.classroom_id == classroom_id, Assignment.exam_id == exam_id, Assignment.is_active == True)
    result = await db.execute(query)
    assignment = result.scalars().first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    assignment.is_active = False
    await db.commit()
    return {"message": "Exam removed from classroom successfully"}

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

    if current_user.role not in ("ADMIN", "TEACHER") and classroom.instructor_id != current_user.id:
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
