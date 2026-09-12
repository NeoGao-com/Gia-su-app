from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import Dict, Any, List
from app.database import get_db
from app.models.exam import Exam, ExamSubmission
from app.models.question import Question
from app.models.classroom import Classroom
from app.core.security import get_current_teacher
from app.models.user import User

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/summary", summary="Thống kê tổng quan cho giáo viên")
async def get_teacher_summary(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    # Total exams
    exams_count_res = await db.execute(select(func.count(Exam.id)))
    exams_count = exams_count_res.scalar() or 0

    # Total questions
    questions_count_res = await db.execute(select(func.count(Question.id)))
    questions_count = questions_count_res.scalar() or 0

    # Total classrooms
    classrooms_count_res = await db.execute(select(func.count(Classroom.id)))
    classrooms_count = classrooms_count_res.scalar() or 0

    # Recent exam submissions statistics
    submissions_res = await db.execute(
        select(ExamSubmission.score, Exam.title)
        .join(Exam, ExamSubmission.exam_id == Exam.id)
    )
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

    return {
        "exams_count": int(exams_count),
        "questions_count": int(questions_count),
        "classrooms_count": int(classrooms_count),
        "submissions_count": int(submissions_count),
        "average_score": float(avg_score),
        "score_distribution": distribution_data
    }