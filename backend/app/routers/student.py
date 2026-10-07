import asyncio
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_
from typing import List, Any, Optional, Dict
from pydantic import BaseModel
from datetime import datetime, timezone
import json
from app.database import get_db, redis_client
from app.models.exam import Exam, ExamSubmission, exam_questions
from app.models.question import Question
from app.models.user import User
from app.models.classroom import Classroom, Assignment, ClassroomStudent, ClassroomExam
from app.core.security import get_current_user
from app.schemas.exam import ExamSubmissionRequest, ExamSubmissionResponse, ExamResponse, ExamSubmissionSaveRequest, StudentExamResponse
from app.services.grading import GradingService

router = APIRouter(prefix="/api/student", tags=["student"])

async def invalidate_student_exams_cache(user_id: Optional[int] = None):
    try:
        pattern = f"student:exams:{user_id}:*" if user_id else "student:exams:*"
        keys = await redis_client.keys(pattern)
        if keys:
            await redis_client.delete(*keys)
    except Exception:
        pass


@router.post("/exams/{exam_id}/start", response_model=ExamSubmissionResponse, summary="Bắt đầu bài thi")
async def start_exam(
    exam_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Exam).filter(Exam.id == exam_id))
    exam = result.scalars().first()
    if not exam or exam.is_deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")

    if not exam.is_published:
        allowed = exam.created_by_id == current_user.id
        if not allowed:
            assign_res = await db.execute(
                select(Assignment)
                .join(ClassroomStudent, ClassroomStudent.classroom_id == Assignment.classroom_id)
                .filter(
                    Assignment.exam_id == exam_id,
                    ClassroomStudent.student_id == current_user.id,
                    or_(ClassroomStudent.is_active == True, ClassroomStudent.is_active == None),
                    or_(Assignment.is_active == True, Assignment.is_active == None)
                )
            )
            if not assign_res.scalars().first():
                ce_res = await db.execute(
                    select(ClassroomExam)
                    .join(ClassroomStudent, ClassroomStudent.classroom_id == ClassroomExam.classroom_id)
                    .filter(
                        ClassroomExam.exam_id == exam_id,
                        ClassroomStudent.student_id == current_user.id,
                        or_(ClassroomStudent.is_active == True, ClassroomStudent.is_active == None)
                    )
                )
                if not ce_res.scalars().first():
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
        await invalidate_student_exams_cache(current_user.id)
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
    limit: int = 50,
    subject: Optional[str] = Query(None),
    grade_level: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Lấy exam_id được giao cho lớp của học sinh (từ Assignment hoặc ClassroomExam)
    assigned_subq_1 = (
        select(Assignment.exam_id.label("exam_id"))
        .join(ClassroomStudent, ClassroomStudent.classroom_id == Assignment.classroom_id)
        .filter(
            ClassroomStudent.student_id == current_user.id,
            or_(ClassroomStudent.is_active == True, ClassroomStudent.is_active == None),
            or_(Assignment.is_active == True, Assignment.is_active == None),
        )
    )
    assigned_subq_2 = (
        select(ClassroomExam.exam_id.label("exam_id"))
        .join(ClassroomStudent, ClassroomStudent.classroom_id == ClassroomExam.classroom_id)
        .filter(
            ClassroomStudent.student_id == current_user.id,
            or_(ClassroomStudent.is_active == True, ClassroomStudent.is_active == None),
        )
    )
    assigned_union = assigned_subq_1.union(assigned_subq_2).subquery()

    cache_key = f"student:exams:{current_user.id}:{page}:{limit}:{subject}:{grade_level}:{search}"
    try:
        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    offset = (page - 1) * limit
    base_query = (
        select(Exam)
        .options(selectinload(Exam.questions))
        .filter(
            Exam.is_deleted == False,
            or_(
                Exam.is_published == True,
                Exam.id.in_(select(assigned_union.c.exam_id)),
            )
        )
    )

    if search:
        s_term = f"%{search.strip()}%"
        base_query = base_query.filter(or_(Exam.title.ilike(s_term), Exam.description.ilike(s_term)))

    if subject or grade_level:
        q_filter = (
            select(exam_questions.c.exam_id)
            .join(Question, Question.id == exam_questions.c.question_id)
        )
        if subject:
            q_filter = q_filter.filter(Question.subject.ilike(f"%{subject.strip()}%"))
        if grade_level:
            q_filter = q_filter.filter(Question.grade_level == grade_level)
        base_query = base_query.filter(Exam.id.in_(q_filter))

    result = await db.execute(
        base_query
        .distinct()
        .offset(offset)
        .limit(limit)
    )
    exams = result.scalars().unique().all()
    if not exams:
        return []

    exam_ids = [exam.id for exam in exams]

    # 1. Batch load attempts taken in 1 query (replaces N queries)
    att_res = await db.execute(
        select(ExamSubmission.exam_id, func.count(ExamSubmission.id))
        .filter(
            ExamSubmission.exam_id.in_(exam_ids),
            ExamSubmission.user_id == current_user.id,
            ExamSubmission.status != "IN_PROGRESS"
        )
        .group_by(ExamSubmission.exam_id)
    )
    attempts_map = {row[0]: row[1] for row in att_res.all()}

    # 2. Batch load assignment overrides & classroom name in 1 query (replaces 2N queries)
    asgn_res = await db.execute(
        select(Assignment, Classroom.name)
        .join(ClassroomStudent, ClassroomStudent.classroom_id == Assignment.classroom_id)
        .outerjoin(Classroom, Classroom.id == Assignment.classroom_id)
        .filter(
            Assignment.exam_id.in_(exam_ids),
            ClassroomStudent.student_id == current_user.id,
            or_(ClassroomStudent.is_active == True, ClassroomStudent.is_active == None),
            or_(Assignment.is_active == True, Assignment.is_active == None)
        )
    )
    asgn_map = {}
    for asgn_obj, cr_name in asgn_res.all():
        if asgn_obj.exam_id not in asgn_map:
            asgn_map[asgn_obj.exam_id] = (asgn_obj, cr_name)

    # 3. Batch load all student submissions for these exams in 1 query (replaces N queries)
    subs_res = await db.execute(
        select(ExamSubmission)
        .filter(
            ExamSubmission.exam_id.in_(exam_ids),
            ExamSubmission.user_id == current_user.id
        )
        .order_by(ExamSubmission.id.desc())
    )
    subs_by_exam = {}
    for sub in subs_res.scalars().all():
        if sub.exam_id not in subs_by_exam:
            subs_by_exam[sub.exam_id] = []
        subs_by_exam[sub.exam_id].append(sub)

    response_items = []
    for exam in exams:
        attempts_taken = attempts_map.get(exam.id, 0)
        q_count = len(exam.questions) if exam.questions else 0
        asgn, classroom_name = asgn_map.get(exam.id, (None, None))

        effective_max_attempts = (asgn.max_attempts if asgn and asgn.max_attempts else None) or exam.max_attempts or 1
        effective_duration = (asgn.duration_minutes_override if asgn and asgn.duration_minutes_override else None) or exam.duration_minutes or 45

        subjects = {q.subject for q in exam.questions if getattr(q, 'subject', None)}
        grade_levels = {q.grade_level for q in exam.questions if getattr(q, 'grade_level', None)}
        primary_subject = list(subjects)[0] if len(subjects) == 1 else (", ".join(sorted(subjects)) if subjects else None)
        primary_grade = list(grade_levels)[0] if grade_levels else None

        all_subs = subs_by_exam.get(exam.id, [])
        latest_sub = all_subs[0] if all_subs else None
        latest_status = latest_sub.status if latest_sub else "NOT_STARTED"
        latest_submission_id = latest_sub.id if latest_sub else None
        valid_scores = [s.score for s in all_subs if s.score is not None]
        highest_score = max(valid_scores) if valid_scores else None
        classroom_id = asgn.classroom_id if asgn else None

        created_at_val = exam.created_at.isoformat() if hasattr(exam.created_at, 'isoformat') and exam.created_at else str(exam.created_at) if exam.created_at else None
        due_date_val = asgn.due_date.isoformat() if asgn and hasattr(asgn.due_date, 'isoformat') and asgn.due_date else (asgn.due_date if asgn else None)

        response_items.append({
            "id": exam.id,
            "title": exam.title,
            "description": exam.description,
            "duration_minutes": effective_duration,
            "pass_score": exam.pass_score,
            "max_attempts": effective_max_attempts,
            "show_answers_after_submit": exam.show_answers_after_submit,
            "is_published": exam.is_published,
            "created_at": created_at_val,
            "created_by_id": exam.created_by_id,
            "attempts_taken": attempts_taken,
            "question_count": q_count,
            "subject": primary_subject,
            "grade_level": primary_grade,
            "exam_type": getattr(exam, 'exam_type', 'EXAM') or 'EXAM',
            "due_date": due_date_val,
            "classroom_id": classroom_id,
            "classroom_name": classroom_name,
            "latest_status": latest_status,
            "latest_submission_id": latest_submission_id,
            "highest_score": highest_score
        })

    try:
        await redis_client.set(cache_key, json.dumps(response_items), ex=45)
    except Exception:
        pass

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

    # Unpublished exams: only allow the creator or an assigned classroom member
    if not exam.is_published:
        allowed = exam.created_by_id == current_user.id
        if not allowed:
            assign_res = await db.execute(
                select(Assignment)
                .join(ClassroomStudent, ClassroomStudent.classroom_id == Assignment.classroom_id)
                .filter(
                    Assignment.exam_id == exam_id,
                    ClassroomStudent.student_id == current_user.id,
                    or_(ClassroomStudent.is_active == True, ClassroomStudent.is_active == None),
                    or_(Assignment.is_active == True, Assignment.is_active == None)
                )
            )
            if not assign_res.scalars().first():
                ce_res = await db.execute(
                    select(ClassroomExam)
                    .join(ClassroomStudent, ClassroomStudent.classroom_id == ClassroomExam.classroom_id)
                    .filter(
                        ClassroomExam.exam_id == exam_id,
                        ClassroomStudent.student_id == current_user.id,
                        or_(ClassroomStudent.is_active == True, ClassroomStudent.is_active == None)
                    )
                )
                if not ce_res.scalars().first():
                    raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")

    q_result = await db.execute(
        select(Question).join(exam_questions, Question.id == exam_questions.c.question_id).filter(exam_questions.c.exam_id == exam_id)
    )
    questions = q_result.scalars().all()

    subjects = {q.subject for q in questions if getattr(q, 'subject', None)}
    grade_levels = {q.grade_level for q in questions if getattr(q, 'grade_level', None)}
    primary_subject = list(subjects)[0] if len(subjects) == 1 else (", ".join(sorted(subjects)) if subjects else None)
    primary_grade = list(grade_levels)[0] if grade_levels else None

    # CRITICAL: Strip correct answers, solutions, and explanations for students
    return {
        "id": exam.id,
        "title": exam.title,
        "description": exam.description,
        "duration_minutes": exam.duration_minutes,
        "pass_score": exam.pass_score,
        "max_attempts": exam.max_attempts or 1,
        "show_answers_after_submit": exam.show_answers_after_submit,
        "is_published": exam.is_published,
        "exam_type": getattr(exam, 'exam_type', 'EXAM') or 'EXAM',
        "subject": primary_subject,
        "grade_level": primary_grade,
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
    if request.tab_switches is not None and request.tab_switches > (submission.tab_switches or 0):
        submission.tab_switches = request.tab_switches
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
            "explanation": getattr(q, 'explanation', None),
            "correct_answer": getattr(q, 'correct_answer', None),
            "correct_answers": getattr(q, 'correct_answers', None),
            "correct_option": getattr(q, 'correct_option', None)
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
    await invalidate_student_exams_cache(current_user.id)

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
    count_query = (
        select(func.count(ExamSubmission.id))
        .join(Exam, ExamSubmission.exam_id == Exam.id)
        .filter(ExamSubmission.user_id == current_user.id)
    )
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
    if not submission or submission.user_id != current_user.id:
         raise HTTPException(status_code=404, detail="Không tìm thấy bài nộp")

    exam_result = await db.execute(select(Exam).filter(Exam.id == submission.exam_id))
    exam = exam_result.scalars().first()

    if submission.question_snapshot:
        raw_questions = submission.question_snapshot
        # Check if snapshot is missing correct_answer / correct_option
        needs_enrich = False
        if raw_questions and isinstance(raw_questions, list) and len(raw_questions) > 0 and isinstance(raw_questions[0], dict):
            if "correct_answer" not in raw_questions[0] and "correct_option" not in raw_questions[0]:
                needs_enrich = True

        if needs_enrich:
            q_ids = [q.get("id") for q in raw_questions if isinstance(q, dict) and "id" in q]
            if q_ids:
                db_q_res = await db.execute(select(Question).filter(Question.id.in_(q_ids)))
                db_q_map = {db_q.id: db_q for db_q in db_q_res.scalars().all()}
                enriched = []
                for sq in raw_questions:
                    if isinstance(sq, dict) and sq.get("id") in db_q_map:
                        db_q = db_q_map[sq["id"]]
                        eq = dict(sq)
                        eq["correct_answer"] = db_q.correct_answer
                        eq["correct_answers"] = db_q.correct_answers
                        eq["correct_option"] = db_q.correct_option
                        eq["sample_solution"] = db_q.sample_solution or eq.get("sample_solution")
                        eq["explanation"] = getattr(db_q, "explanation", None) or eq.get("explanation")
                        enriched.append(eq)
                    else:
                        enriched.append(sq)
                questions = enriched
            else:
                questions = raw_questions
        else:
            questions = raw_questions
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
        "exam_title": exam.title if exam else "Bài kiểm tra",
        "show_answers": show_answers,
        "questions": processed_questions
    }


class PracticeGradeRequest(BaseModel):
    answers: Dict[Any, Any]
    question_ids: List[int]
    time_spent: Optional[int] = 0


@router.get("/dashboard-summary", summary="Lấy thống kê tổng quan của học sinh")
async def get_student_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Danh sách bài nộp của học sinh
    subs_res = await db.execute(
        select(ExamSubmission, Exam.title, Exam.pass_score, Exam.duration_minutes)
        .join(Exam, ExamSubmission.exam_id == Exam.id)
        .filter(ExamSubmission.user_id == current_user.id)
        .order_by(ExamSubmission.submitted_at.desc())
    )
    all_subs = subs_res.all()
    completed_subs = [s[0] for s in all_subs if s[0].status != "IN_PROGRESS"]
    scores = [s.score for s in completed_subs if s.score is not None]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
    highest_score = round(max(scores), 1) if scores else 0.0

    # 2. Lớp học đang tham gia
    cr_res = await db.execute(
        select(Classroom)
        .join(ClassroomStudent, ClassroomStudent.classroom_id == Classroom.id)
        .filter(
            ClassroomStudent.student_id == current_user.id,
            ClassroomStudent.is_active == True,
            Classroom.is_deleted == False
        )
    )
    classrooms = cr_res.scalars().all()

    # 3. Danh sách bài được giao
    assign_res = await db.execute(
        select(Assignment, Exam, Classroom.name.label("classroom_name"))
        .join(Classroom, Assignment.classroom_id == Classroom.id)
        .join(Exam, Assignment.exam_id == Exam.id)
        .join(ClassroomStudent, ClassroomStudent.classroom_id == Classroom.id)
        .filter(
            ClassroomStudent.student_id == current_user.id,
            ClassroomStudent.is_active == True,
            Classroom.is_deleted == False,
            Exam.is_deleted == False,
            or_(Assignment.is_active == True, Assignment.is_active == None)
        )
    )
    assigned_items = assign_res.all()

    # Phân loại bài tập cần làm
    completed_exam_ids = {s.exam_id for s in completed_subs}
    in_progress_exam_ids = {s[0].exam_id for s in all_subs if s[0].status == "IN_PROGRESS"}
    
    urgent_assignments = []
    pending_count = 0
    now = datetime.now(timezone.utc)

    for asgn, exam, class_name in assigned_items:
        is_done = asgn.exam_id in completed_exam_ids
        is_in_prog = asgn.exam_id in in_progress_exam_ids
        if not is_done:
            pending_count += 1
            due_aware = asgn.due_date.replace(tzinfo=timezone.utc) if (asgn.due_date and asgn.due_date.tzinfo is None) else asgn.due_date
            is_overdue = bool(due_aware and due_aware < now)
            urgent_assignments.append({
                "assignment_id": asgn.id,
                "exam_id": exam.id,
                "title": exam.title,
                "classroom_name": class_name,
                "due_date": asgn.due_date,
                "duration_minutes": asgn.duration_minutes_override or exam.duration_minutes or 45,
                "is_in_progress": is_in_prog,
                "is_overdue": is_overdue,
                "exam_type": getattr(exam, 'exam_type', 'ASSIGNMENT') or 'ASSIGNMENT'
            })

    urgent_assignments.sort(key=lambda x: (
        not x["is_in_progress"],
        x["due_date"] is None,
        x["due_date"].replace(tzinfo=timezone.utc) if (x["due_date"] and x["due_date"].tzinfo is None) else (x["due_date"] or datetime.max.replace(tzinfo=timezone.utc))
    ))

    # Recent 5 submissions
    recent_submissions = []
    for sub, title, pass_score, duration in all_subs[:5]:
        recent_submissions.append({
            "id": sub.id,
            "exam_id": sub.exam_id,
            "exam_title": title,
            "score": sub.score,
            "grading_status": sub.grading_status,
            "status": sub.status,
            "submitted_at": sub.submitted_at,
            "time_spent": sub.time_spent,
            "is_passed": (sub.score or 0) >= (pass_score or 5.0)
        })

    return {
        "student_name": current_user.full_name or current_user.username,
        "total_assigned": len(assigned_items),
        "pending_count": pending_count,
        "completed_count": len(completed_subs),
        "avg_score": avg_score,
        "highest_score": highest_score,
        "classrooms_count": len(classrooms),
        "urgent_assignments": urgent_assignments[:8],
        "recent_submissions": recent_submissions
    }


@router.get("/classrooms", summary="Lấy danh sách lớp học của học sinh kèm bài tập")
async def get_student_classrooms_detailed(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cr_res = await db.execute(
        select(Classroom)
        .options(
            selectinload(Classroom.instructor),
            selectinload(Classroom.students),
            selectinload(Classroom.assignments).selectinload(Assignment.exam)
        )
        .join(ClassroomStudent, ClassroomStudent.classroom_id == Classroom.id)
        .filter(
            ClassroomStudent.student_id == current_user.id,
            or_(ClassroomStudent.is_active == True, ClassroomStudent.is_active.is_(None)),
            or_(Classroom.is_deleted == False, Classroom.is_deleted.is_(None))
        )
    )
    classrooms = cr_res.scalars().all()
    
    subs_res = await db.execute(
        select(ExamSubmission.exam_id, ExamSubmission.score, ExamSubmission.status)
        .filter(ExamSubmission.user_id == current_user.id)
    )
    student_subs = {row[0]: {"score": row[1], "status": row[2]} for row in subs_res.all()}

    items = []
    for c in classrooms:
        active_assignments = []
        for a in c.assignments:
            if getattr(a, 'is_active', True) and a.exam and not a.exam.is_deleted:
                sub_info = student_subs.get(a.exam_id)
                active_assignments.append({
                    "id": a.id,
                    "exam_id": a.exam_id,
                    "title": a.exam.title,
                    "duration_minutes": a.duration_minutes_override or a.exam.duration_minutes,
                    "due_date": a.due_date,
                    "is_completed": sub_info is not None and sub_info.get("status") != "IN_PROGRESS",
                    "score": sub_info.get("score") if sub_info else None
                })

        teacher_name = c.instructor.full_name if c.instructor and c.instructor.full_name else (c.instructor.username if c.instructor and hasattr(c.instructor, 'username') else "Thầy/Cô phụ trách")
        teacher_email = c.instructor.email if c.instructor else ""
        teacher_phone = c.instructor.phone_number if c.instructor and c.instructor.phone_number else ""
        student_count = len([s for s in c.students if getattr(s, 'is_active', True)]) or 1

        items.append({
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "code": c.code,
            "instructor_name": teacher_name,
            "instructor_email": teacher_email,
            "instructor_phone": teacher_phone,
            "teacher_name": teacher_name,
            "teacher_email": teacher_email,
            "teacher_phone": teacher_phone,
            "students_count": student_count,
            "student_count": student_count,
            "assignments_count": len(active_assignments),
            "pending_assignments_count": len([a for a in active_assignments if not a["is_completed"]]),
            "active_assignments_count": len([a for a in active_assignments if not a["is_completed"]]),
            "assignments": active_assignments
        })

    return items


@router.get("/practice/questions", summary="Lấy câu hỏi tự luyện cho học sinh")
async def get_practice_questions(
    subject: Optional[str] = None,
    grade_level: Optional[int] = None,
    chapter: Optional[str] = None,
    difficulty: Optional[str] = None,
    count: Optional[int] = None,
    limit: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    safe_limit = count or limit or 10
    query = select(Question).filter((Question.status == "PUBLISHED") | (Question.status.is_(None)))
    if subject:
        query = query.filter(Question.subject.ilike(f"%{subject}%"))
    if grade_level:
        query = query.filter(Question.grade_level == grade_level)
    if chapter:
        query = query.filter(Question.chapter.ilike(f"%{chapter}%"))

    if difficulty and difficulty.upper() != "ALL":
        d_upper = difficulty.upper()
        if d_upper in ("EASY", "NHAN_BIET"):
            query = query.filter(Question.difficulty.in_(["NHAN_BIET", "easy", "EASY"]))
        elif d_upper in ("MEDIUM", "THONG_HIEU"):
            query = query.filter(Question.difficulty.in_(["THONG_HIEU", "medium", "MEDIUM"]))
        elif d_upper in ("HARD", "VAN_DUNG", "VAN_DUNG_CAO"):
            query = query.filter(Question.difficulty.in_(["VAN_DUNG", "VAN_DUNG_CAO", "hard", "HARD"]))
        else:
            query = query.filter(Question.difficulty == difficulty)
        
    query = query.order_by(func.random()).limit(min(safe_limit, 40))
    res = await db.execute(query)
    questions = res.scalars().all()

    # Fallback if specific difficulty had no questions
    if not questions and difficulty and difficulty.upper() != "ALL":
        fb_query = select(Question).filter((Question.status == "PUBLISHED") | (Question.status.is_(None)))
        if subject: fb_query = fb_query.filter(Question.subject.ilike(f"%{subject}%"))
        if grade_level: fb_query = fb_query.filter(Question.grade_level == grade_level)
        fb_query = fb_query.order_by(func.random()).limit(min(safe_limit, 40))
        fb_res = await db.execute(fb_query)
        questions = fb_res.scalars().all()

    q_list = [
        {
            "id": q.id,
            "content": q.content,
            "question_type": q.question_type or "MULTIPLE_CHOICE",
            "options": q.options,
            "sub_questions": [{"statement": s.get("statement", "")} if isinstance(s, dict) else {"statement": str(s)} for s in (q.sub_questions or [])],
            "blanks": q.blanks,
            "subject": q.subject,
            "grade_level": q.grade_level,
            "chapter": q.chapter,
            "difficulty": q.difficulty,
            "image_url": q.image_url,
            "latex_code": q.latex_code
        }
        for q in questions
    ]

    return {
        "questions": q_list,
        "count": len(q_list)
    }


@router.post("/practice/grade", summary="Chấm điểm bài tự luyện kèm lời giải chi tiết")
async def grade_practice_session(
    payload: PracticeGradeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not payload.question_ids:
        raise HTTPException(status_code=400, detail="Danh sách câu hỏi rỗng")

    res = await db.execute(select(Question).filter(Question.id.in_(payload.question_ids)))
    questions = res.scalars().all()

    grader = GradingService()
    score, correct_count, graded_answers = grader.grade(questions, payload.answers)

    detailed_questions = []
    graded_questions = []
    for q in questions:
        g_info = graded_answers.get(str(q.id), graded_answers.get(q.id, {}))
        std_ans = payload.answers.get(str(q.id), payload.answers.get(q.id))
        is_corr = bool(g_info.get("is_correct", False))

        item_data = {
            "id": q.id,
            "content": q.content,
            "question_type": q.question_type or "MULTIPLE_CHOICE",
            "options": q.options,
            "correct_option": q.correct_option,
            "correct_answer": q.correct_answer,
            "sub_questions": q.sub_questions,
            "explanation": q.explanation,
            "sample_solution": q.sample_solution,
            "difficulty": q.difficulty,
            "chapter": q.chapter,
            "subject": q.subject,
            "student_answer": std_ans,
            "is_correct": is_corr,
            "points_awarded": g_info.get("points_awarded", 1.0 if is_corr else 0.0)
        }
        detailed_questions.append(item_data)
        graded_questions.append(item_data)

    return {
        "score": score,
        "correct_count": correct_count,
        "total_questions": len(questions),
        "graded_answers": graded_answers,
        "questions": detailed_questions,
        "graded_questions": graded_questions,
        "time_spent": payload.time_spent
    }


@router.get("/practice/recommendations", summary="Gợi ý bài luyện tập thông minh dựa trên điểm yếu học sinh")
async def get_practice_recommendations(
    subject: Optional[str] = Query("Toán học"),
    grade_level: Optional[int] = Query(12),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.services.ai_service import AIService
    from app.models.ai_config import AIConfig

    ai_config_res = await db.execute(select(AIConfig).filter(AIConfig.is_active == True))
    ai_cfg = ai_config_res.scalars().first()
    ai_svc = AIService(db_config={
        "provider": ai_cfg.provider,
        "api_key": ai_cfg.api_key,
        "base_url": ai_cfg.base_url,
        "model_name": ai_cfg.model_name
    } if ai_cfg else None)

    # 1. Fetch student's recent submissions
    subs_res = await db.execute(
        select(ExamSubmission)
        .filter(ExamSubmission.user_id == current_user.id, ExamSubmission.status != "IN_PROGRESS")
        .order_by(ExamSubmission.submitted_at.desc())
        .limit(15)
    )
    submissions = subs_res.scalars().all()

    # 2. Extract accuracy grouped by chapter
    topic_stats = {}
    total_answers = 0
    total_correct = 0

    if submissions:
        sub_exam_ids = list({s.exam_id for s in submissions})
        q_res = await db.execute(
            select(Question)
            .join(exam_questions, Question.id == exam_questions.c.question_id)
            .filter(exam_questions.c.exam_id.in_(sub_exam_ids))
        )
        questions_by_id = {q.id: q for q in q_res.scalars().all()}

        for s in submissions:
            g_ans = s.graded_answers or {}
            for q_id_str, g_item in g_ans.items():
                try:
                    qid = int(q_id_str)
                except ValueError:
                    continue
                q = questions_by_id.get(qid)
                if not q and s.question_snapshot and isinstance(s.question_snapshot, list):
                    snap = next((it for it in s.question_snapshot if isinstance(it, dict) and it.get("id") == qid), None)
                    if snap:
                        q = type("SnapQ", (), snap)()
                if not q:
                    continue

                # Filter by requested subject if applicable
                if subject and getattr(q, 'subject', None):
                    sub_str = str(q.subject).strip().lower()
                    req_sub = str(subject).strip().lower()
                    if req_sub not in sub_str and sub_str not in req_sub:
                        continue

                chap = getattr(q, 'chapter', None) or "Kiến thức chung"
                if chap not in topic_stats:
                    topic_stats[chap] = {
                        "chapter": chap,
                        "subject": getattr(q, 'subject', None) or subject,
                        "grade_level": getattr(q, 'grade_level', None) or grade_level,
                        "total_count": 0,
                        "correct_count": 0,
                        "wrong_count": 0
                    }

                is_c = bool(g_item.get("is_correct"))
                topic_stats[chap]["total_count"] += 1
                total_answers += 1
                if is_c:
                    topic_stats[chap]["correct_count"] += 1
                    total_correct += 1
                else:
                    topic_stats[chap]["wrong_count"] += 1

    weak_topics = []
    for chap, data in topic_stats.items():
        if data["total_count"] > 0:
            data["accuracy"] = (data["correct_count"] / data["total_count"]) * 100
            if data["accuracy"] < 70 or data["wrong_count"] > 0:
                weak_topics.append(data)

    # Sort weak topics: lowest accuracy and highest wrong count first
    weak_topics.sort(key=lambda x: (x["accuracy"], -x["wrong_count"]))

    has_history = len(submissions) > 0 and total_answers > 0
    overall_accuracy = (total_correct / max(total_answers, 1)) * 100 if total_answers > 0 else 0.0
    student_name = current_user.full_name or "Học sinh"

    rec = await asyncio.to_thread(
        ai_svc.recommend_smart_practice,
        student_name=student_name,
        weak_topics=weak_topics,
        overall_accuracy=overall_accuracy,
        preferred_subject=subject or "Toán học",
        preferred_grade=grade_level or 12,
        has_history=has_history
    )

    return {
        "success": True,
        "has_history": has_history,
        "overall_accuracy": overall_accuracy,
        "total_scanned_submissions": len(submissions),
        "weak_topics": weak_topics[:5],
        "recommendation": rec
    }