from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_
from typing import Optional
import json
from app.database import get_db, redis_client
from app.models.exam import Exam, ExamSubmission
from app.models.question import Question
from app.models.classroom import Classroom, ClassroomStudent, Assignment
from app.core.security import get_current_teacher
from app.models.user import User

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

async def invalidate_analytics_cache(user_id: Optional[int] = None):
    """Xóa cache thống kê tổng quan của giáo viên khi có thay đổi dữ liệu"""
    try:
        if user_id:
            await redis_client.delete(f"analytics:summary:{user_id}")
        else:
            keys = await redis_client.keys("analytics:summary:*")
            if keys:
                await redis_client.delete(*keys)
    except Exception:
        pass

@router.get("/summary", summary="Thống kê tổng quan cho giáo viên")
async def get_teacher_summary(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    cache_key = f"analytics:summary:{current_user.id}"
    cached = await redis_client.get(cache_key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass

    # 1. Tổng số lớp học đang hoạt động (không tính lớp đã xóa is_deleted=True)
    classrooms_query = select(func.count(Classroom.id)).filter(Classroom.is_deleted == False)
    if current_user.role == "TEACHER":
        classrooms_query = classrooms_query.filter(Classroom.instructor_id == current_user.id)
    classrooms_count_res = await db.execute(classrooms_query)
    classrooms_count = classrooms_count_res.scalar() or 0

    # 2. Tổng số học sinh đang hoạt động trong các lớp của giáo viên
    students_query = (
        select(func.count(func.distinct(ClassroomStudent.student_id)))
        .join(Classroom, ClassroomStudent.classroom_id == Classroom.id)
        .join(User, ClassroomStudent.student_id == User.id)
        .filter(
            Classroom.is_deleted == False,
            ClassroomStudent.is_active == True,
            User.is_deleted == False
        )
    )
    if current_user.role == "TEACHER":
        students_query = students_query.filter(Classroom.instructor_id == current_user.id)
    students_count_res = await db.execute(students_query)
    students_count = students_count_res.scalar() or 0

    # 3. Tổng số đề thi khả dụng (không tính đề đã xóa is_deleted=True)
    exams_query = select(func.count(Exam.id)).filter(Exam.is_deleted == False)
    if current_user.role == "TEACHER":
        exams_query = exams_query.filter(
            or_(
                Exam.created_by_id == current_user.id,
                Exam.created_by_id.is_(None)
            )
        )
    exams_count_res = await db.execute(exams_query)
    exams_count = exams_count_res.scalar() or 0

    # 4. Tổng số câu hỏi trong ngân hàng câu hỏi
    questions_count_res = await db.execute(select(func.count(Question.id)))
    questions_count = questions_count_res.scalar() or 0

    # 5. Thống kê bài nộp trên các đề thi chưa bị xóa thuộc phạm vi của giáo viên
    sub_query = (
        select(ExamSubmission.score, Exam.title)
        .join(Exam, ExamSubmission.exam_id == Exam.id)
        .filter(Exam.is_deleted == False)
    )
    if current_user.role == "TEACHER":
        sub_query = sub_query.filter(
            or_(
                Exam.created_by_id == current_user.id,
                Exam.id.in_(
                    select(Assignment.exam_id)
                    .join(Classroom, Assignment.classroom_id == Classroom.id)
                    .filter(
                        Classroom.instructor_id == current_user.id,
                        Classroom.is_deleted == False,
                        Assignment.is_active == True
                    )
                )
            )
        )
    submissions_res = await db.execute(sub_query)
    submissions = submissions_res.all()

    score_ranges = {
        "Yếu (< 5)": 0,
        "Trung bình (5 - 6.5)": 0,
        "Khá (6.5 - 8)": 0,
        "Giỏi (>= 8)": 0
    }

    total_score = 0
    submissions_count = len(submissions)

    for score, _ in submissions:
        if score is not None:
            total_score += score
            if score < 5:
                score_ranges["Yếu (< 5)"] += 1
            elif score < 6.5:
                score_ranges["Trung bình (5 - 6.5)"] += 1
            elif score < 8:
                score_ranges["Khá (6.5 - 8)"] += 1
            else:
                score_ranges["Giỏi (>= 8)"] += 1

    avg_score = round(total_score / submissions_count, 2) if submissions_count > 0 else 0

    distribution_data = [
        {"name": name, "count": count} for name, count in score_ranges.items()
    ]

    res_data = {
        "exams_count": int(exams_count),
        "questions_count": int(questions_count),
        "classrooms_count": int(classrooms_count),
        "students_count": int(students_count),
        "submissions_count": int(submissions_count),
        "average_score": float(avg_score),
        "score_distribution": distribution_data
    }
    try:
        await redis_client.set(cache_key, json.dumps(res_data), ex=60)
    except Exception:
        pass

    return res_data