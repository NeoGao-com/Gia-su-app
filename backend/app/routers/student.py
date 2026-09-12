from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_
from typing import List, Any
from datetime import datetime, timezone
from app.database import get_db
from app.models.exam import Exam, ExamSubmission, exam_questions
from app.models.question import Question
from app.models.user import User
from app.models.classroom import Assignment, ClassroomStudent
from app.core.security import get_current_user
from app.schemas.exam import ExamSubmissionRequest, ExamSubmissionResponse, ExamResponse, ExamSubmissionSaveRequest, StudentExamResponse
from app.services.grading import GradingService

router = APIRouter(prefix="/api/student", tags=["student"])


@router.post("/exams/{exam_id}/start", response_model=ExamSubmissionResponse, summary="Bắt đầu bài thi")
async def start_exam(
    exam_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Exam).filter(Exam.id == exam_id))
    exam = result.scalars().first()
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")

    if not exam.is_published:
        assign_res = await db.execute(select(Assignment).filter(Assignment.exam_id == exam_id))
        is_assigned = assign_res.scalars().first()
        if not is_assigned:
            raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")

    # 1) Nếu đã có phiên IN_PROGRESS (chưa nộp) thì trả về để tiếp tục làm bài.
    sub_res = await db.execute(
        select(ExamSubmission)
        .filter(ExamSubmission.exam_id == exam_id, ExamSubmission.user_id == current_user.id, ExamSubmission.status == "IN_PROGRESS")
    )
    existing_sub = sub_res.scalars().first()
    if existing_sub:
        return existing_sub

    # 2) Đếm số lần đã làm trước đó (các submission đã kết thúc)
    count_res = await db.execute(
        select(ExamSubmission)
        .filter(ExamSubmission.exam_id == exam_id, ExamSubmission.user_id == current_user.id, ExamSubmission.status != "IN_PROGRESS")
    )
    past_attempts = count_res.scalars().all()
    attempts = len(past_attempts)

    # 3) Nếu đã vượt quá số lần cho phép → Thông báo không được làm tiếp
    if attempts >= exam.max_attempts:
        raise HTTPException(
            status_code=400,
            detail=f"Bạn đã làm bài thi này {attempts}/{exam.max_attempts} lần. Không được phép làm tiếp."
        )

    # 4) Tạo submission mới
    try:
        new_sub = ExamSubmission(
            exam_id=exam_id,
            user_id=current_user.id,
            status="IN_PROGRESS",
            started_at=datetime.now(timezone.utc),
            answers={},
            attempt_number=attempts + 1
        )
        db.add(new_sub)
        await db.commit()
        await db.refresh(new_sub)
        return new_sub
    except Exception as e:
        await db.rollback()
        # Handle unique constraint violation (race condition on concurrent start)
        sub_res = await db.execute(
            select(ExamSubmission)
            .filter(ExamSubmission.exam_id == exam_id, ExamSubmission.user_id == current_user.id, ExamSubmission.status == "IN_PROGRESS")
        )
        existing_sub = sub_res.scalars().first()
        if existing_sub:
            return existing_sub
        raise HTTPException(status_code=409, detail="Phiên làm bài đã tồn tại hoặc xảy ra xung đột")


@router.get("/exams", response_model=List[StudentExamResponse], summary="Lấy danh sách bài thi của học sinh")
async def get_student_exams(
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Lấy exam_id được giao cho lớp của học sinh (assignment còn active)
    assigned_subq = (
        select(Assignment.exam_id)
        .join(ClassroomStudent, ClassroomStudent.classroom_id == Assignment.classroom_id)
        .filter(
            ClassroomStudent.student_id == current_user.id,
            ClassroomStudent.is_active == True,
            Assignment.is_active == True,
        )
        .subquery()
    )
    offset = (page - 1) * limit
    result = await db.execute(
        select(Exam)
        .filter(
            or_(
                Exam.is_published == True,
                Exam.id.in_(select(assigned_subq.c.exam_id)),
            )
        )
        .distinct()
        .offset(offset)
        .limit(limit)
    )
    exams = result.scalars().unique().all()

    response_items = []
    for exam in exams:
        att_res = await db.execute(
            select(func.count(ExamSubmission.id))
            .filter(ExamSubmission.exam_id == exam.id, ExamSubmission.user_id == current_user.id, ExamSubmission.status != "IN_PROGRESS")
        )
        attempts_taken = att_res.scalar() or 0
        q_count = len(exam.questions) if exam.questions else 0

        response_items.append({
            "id": exam.id,
            "title": exam.title,
            "description": exam.description,
            "duration_minutes": exam.duration_minutes,
            "pass_score": exam.pass_score,
            "max_attempts": exam.max_attempts or 1,
            "show_answers_after_submit": exam.show_answers_after_submit,
            "created_at": exam.created_at,
            "created_by_id": exam.created_by_id,
            "attempts_taken": attempts_taken,
            "question_count": q_count
        })

    return response_items

@router.get("/exams/{exam_id}", summary="Lấy chi tiết đề thi cho học sinh làm bài")
async def get_student_exam_details(
    exam_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Exam).filter(Exam.id == exam_id))
    exam = result.scalars().first()
    if not exam or exam.is_deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")

    # Unpublished exams: only allow the creator/admin or an assigned classroom member
    if not exam.is_published:
        allowed = current_user.role == "ADMIN" or exam.created_by_id == current_user.id
        if not allowed:
            assign_res = await db.execute(select(Assignment).filter(Assignment.exam_id == exam_id))
            is_assigned = assign_res.scalars().first()
            if not is_assigned:
                raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")

    q_result = await db.execute(
        select(Question).join(exam_questions, Question.id == exam_questions.c.question_id).filter(exam_questions.c.exam_id == exam_id)
    )
    questions = q_result.scalars().all()

    # CRITICAL: Strip correct answers, solutions, and explanations for students
    return {
        "id": exam.id,
        "title": exam.title,
        "questions": [
            {
                "id": q.id,
                "content": q.content,
                "question_type": q.question_type,
                "options": q.options,
                "blanks": q.blanks,
                "sub_questions": q.sub_questions,
                "subject": q.subject,
                "difficulty": q.difficulty,
                "image_url": q.image_url,
                "latex_code": q.latex_code
            } for q in questions
        ]
    }

@router.post("/submissions/{submission_id}/save", summary="Lưu tạm câu trả lời bài thi")
async def save_submission(
    submission_id: int,
    request: ExamSubmissionSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(ExamSubmission).filter(ExamSubmission.id == submission_id))
    submission = result.scalars().first()

    if not submission or submission.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài nộp")

    if submission.status != "IN_PROGRESS":
        # Trả về thành công luôn nếu bài đã nộp thay vì báo lỗi 400
        return {"message": "Bài thi đã nộp", "version": submission.version}

    if submission.version != request.version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Xung đột: Bài làm đã được cập nhật từ thiết bị khác",
                "server_version": submission.version,
                "current_answers": submission.answers
            }
        )

    submission.answers = request.answers
    submission.version += 1
    submission.last_saved_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(submission)
    return {"message": "Lưu bài thành công", "version": submission.version}

@router.post("/submissions/{submission_id}/submit", summary="Nộp bài thi")
async def submit_student_exam(
    submission_id: int,
    request: ExamSubmissionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(ExamSubmission).filter(ExamSubmission.id == submission_id))
    submission = result.scalars().first()

    if not submission or submission.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài nộp")

    if submission.status != "IN_PROGRESS":
        # Bài đã được nộp trước đó, trả về luôn thay vì báo lỗi 400
        return submission

    # Enforce exam time limit server-side (cho phép nộp dù quá giờ để chốt điểm)
    exam_res = await db.execute(select(Exam).filter(Exam.id == submission.exam_id))
    exam_obj = exam_res.scalars().first()

    # Fetch questions for grading
    q_result = await db.execute(
        select(Question).join(exam_questions, Question.id == exam_questions.c.question_id).filter(exam_questions.c.exam_id == submission.exam_id)
    )
    questions = q_result.scalars().all()

    # Snapshot questions
    snapshot = []
    for q in questions:
        snapshot.append({
            "id": q.id,
            "content": q.content,
            "question_type": q.question_type,
            "options": q.options,
            "blanks": q.blanks,
            "sub_questions": q.sub_questions,
            "subject": q.subject,
            "difficulty": q.difficulty,
            "image_url": q.image_url,
            "latex_code": q.latex_code,
            "sample_solution": q.sample_solution,
            "explanation": getattr(q, 'explanation', None)
        })
    submission.question_snapshot = snapshot

    grader = GradingService()
    score, correct_count, graded_answers = grader.grade(questions, request.answers)

    # Check for essay questions to set status
    has_essay = any(q.question_type == "ESSAY" for q in questions)
    grading_status = "PENDING_ESSAY" if has_essay else "GRADED"
    status = "SUBMITTED" if has_essay else "GRADED"

    submission.auto_score = score
    submission.score = (score or 0) + (submission.essay_score or 0)
    submission.answers = request.answers
    submission.graded_answers = graded_answers
    submission.time_spent = request.time_spent
    submission.grading_status = grading_status
    submission.status = status
    submission.submitted_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(submission)

    return submission

@router.get("/history", summary="Lịch sử làm bài của học sinh")
async def get_student_history(
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    offset = (page - 1) * limit
    base_query = (
        select(ExamSubmission, Exam.title)
        .join(Exam, ExamSubmission.exam_id == Exam.id)
        .filter(ExamSubmission.user_id == current_user.id)
    )

    # Count total
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    result = await db.execute(
        base_query
        .order_by(ExamSubmission.submitted_at.desc())
        .offset(offset)
        .limit(limit)
    )
    history = []
    for sub, title in result:
        item = {
            "id": sub.id,
            "exam_id": sub.exam_id,
            "exam_title": title,
            "score": sub.score,
            "grading_status": sub.grading_status,
            "submitted_at": sub.submitted_at
        }
        history.append(item)

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if limit > 0 else 0,
        "items": history
    }

@router.get("/submissions/{submission_id}", summary="Lấy chi tiết kết quả bài nộp")
async def get_submission_details(
    submission_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(ExamSubmission).filter(ExamSubmission.id == submission_id))
    submission = result.scalars().first()
    if not submission or (submission.user_id != current_user.id and current_user.role != "ADMIN"):
         raise HTTPException(status_code=404, detail="Không tìm thấy bài nộp")

    exam_result = await db.execute(select(Exam).filter(Exam.id == submission.exam_id))
    exam = exam_result.scalars().first()

    if submission.question_snapshot:
        questions = submission.question_snapshot
    else:
        q_result = await db.execute(
            select(Question).join(exam_questions, Question.id == exam_questions.c.question_id).filter(exam_questions.c.exam_id == submission.exam_id)
        )
        questions = q_result.scalars().all()

    # If user is STUDENT and exam.show_answers_after_submit is False, strip correct answers / explanations
    show_answers = True
    if current_user.role == "STUDENT":
        if exam and not exam.show_answers_after_submit:
            show_answers = False

    processed_questions = []
    for q in questions:
        # q might be a dict (from snapshot) or an ORM model object
        if isinstance(q, dict):
            q_dict = dict(q)
            if not show_answers:
                q_dict.pop("sample_solution", None)
                q_dict.pop("explanation", None)
                q_dict.pop("correct_answer", None)
                q_dict.pop("correct_answers", None)
                q_dict.pop("correct_option", None)
            processed_questions.append(q_dict)
        else:
            q_data = {
                "id": q.id,
                "content": q.content,
                "question_type": q.question_type,
                "options": q.options,
                "blanks": q.blanks,
                "sub_questions": q.sub_questions,
                "subject": q.subject,
                "difficulty": q.difficulty,
                "image_url": q.image_url,
                "latex_code": q.latex_code
            }
            if show_answers:
                q_data["sample_solution"] = q.sample_solution
                q_data["explanation"] = getattr(q, 'explanation', None)
                q_data["correct_answer"] = getattr(q, 'correct_answer', None)
                q_data["correct_answers"] = getattr(q, 'correct_answers', None)
                q_data["correct_option"] = getattr(q, 'correct_option', None)
            processed_questions.append(q_data)

    return {
        "submission": submission,
        "exam_title": exam.title,
        "show_answers": show_answers,
        "questions": processed_questions
    }