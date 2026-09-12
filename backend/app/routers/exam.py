import logging
from fastapi import APIRouter, Depends, HTTPException, status, Body, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import Table, Column, Integer, ForeignKey, func
from typing import List, Optional
import json
from app.database import get_db, Base, redis_client
from app.models.exam import Exam, ExamSubmission, exam_questions
from app.models.question import Question
from app.models.classroom import Assignment, Classroom
from app.schemas.exam import ExamCreate, ExamUpdate, ExamResponse, ExamSubmissionRequest, ExamSubmissionResponse, EssayGradeRequest, ExamMatrixCreate, ExamMatrixUpdate, ExamMatrixResponse, ExamMatrixGenerateRequest
from app.core.security import get_current_user, get_current_teacher
from app.models.user import User
from app.models.exam import ExamMatrix
from app.services.grading import GradingService
from app.services.ai_service import AIService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exams", tags=["exam"])
ai_service = AIService()

async def invalidate_exams_cache():
    try:
        keys = await redis_client.keys("exams:*")
        if keys:
            await redis_client.delete(*keys)
    except Exception as e:
        logger.error(f"Redis cache invalidate error: {str(e)}")

async def check_grading_authorization(db: AsyncSession, submission: ExamSubmission, current_user: User):
    if current_user.role == "ADMIN":
        return

    exam = await db.get(Exam, submission.exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")

    if exam.created_by_id == current_user.id:
        return

    assignment_res = await db.execute(
        select(Assignment).filter(Assignment.exam_id == submission.exam_id)
    )
    assignments = assignment_res.scalars().all()
    classroom_ids = [a.classroom_id for a in assignments]

    if classroom_ids:
        classroom_res = await db.execute(
            select(Classroom).filter(Classroom.id.in_(classroom_ids), Classroom.instructor_id == current_user.id)
        )
        if classroom_res.scalars().first():
            return

    raise HTTPException(status_code=403, detail="Bạn không có quyền chấm bài nộp này")

@router.post("/submissions/{submission_id}/grade-ai", summary="Chấm điểm câu hỏi tự luận bằng AI")
async def grade_essay_submission_ai(
    request: Request,
    submission_id: int,
    payload: Optional[EssayGradeRequest] = Body(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    client_ip = request.client.host if request.client else "unknown"
    result = await db.execute(select(ExamSubmission).filter(ExamSubmission.id == submission_id))
    submission = result.scalars().first()
    if not submission:
        logger.warning(f"AI grading failed: Submission not found {submission_id} by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=404, detail="Không tìm thấy bài nộp")

    await check_grading_authorization(db, submission, current_user)

    q_result = await db.execute(
        select(Question).join(exam_questions, Question.id == exam_questions.c.question_id).filter(exam_questions.c.exam_id == submission.exam_id)
    )
    questions = q_result.scalars().all()

    target_question_ids = payload.question_ids if payload and payload.question_ids else None

    # Initialize graded_answers if not present
    if not submission.graded_answers:
        submission.graded_answers = {}

    feedback_notes = []
    has_graded_any = False

    for q in questions:
        if q.question_type == "ESSAY":
            q_id_str = str(q.id)
            if target_question_ids and q.id not in target_question_ids:
                continue

            student_ans = submission.answers.get(q_id_str) or submission.answers.get(q.id) or ""

            try:
                res = ai_service.grade_essay(q.content, student_ans, q.sample_solution or "")
            except Exception as e:
                logger.error(f"AI grading failed for {submission_id} by {current_user.email} from IP {client_ip}: {str(e)}")
                raise HTTPException(
                    status_code=503,
                    detail=f"Chức năng chấm điểm bằng AI hiện không khả dụng hoặc bị lỗi: {str(e)}. Vui lòng cấu hình OPENAI_API_KEY hoặc chấm thủ công."
                )

            score = res.get("score", 0.0)
            feedback = res.get("feedback", "")

            # Update graded_answers dictionary
            submission.graded_answers[q_id_str] = {
                "question_id": q.id,
                "question_type": q.question_type,
                "student_answer": student_ans,
                "correct_answer": q.sample_solution,
                "is_correct": None,
                "points_awarded": score,
                "max_points": 10.0, # or whatever max points, usually essay is graded out of 10 or scaled
                "feedback": feedback
            }
            feedback_notes.append(f"Câu hỏi {q.id}: {feedback}")
            has_graded_any = True

    if not has_graded_any and target_question_ids:
        logger.warning(f"AI grading failed: No matching ESSAY questions found {submission_id} by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=400, detail="Không tìm thấy câu hỏi TỰ LUẬN phù hợp để chấm điểm")

    # Recalculate total essay score from graded_answers
    total_essay_score = 0.0
    for q_id_str, g_ans in submission.graded_answers.items():
        if g_ans.get("question_type") == "ESSAY":
            total_essay_score += g_ans.get("points_awarded", 0.0)

    submission.essay_score = total_essay_score
    submission.score = (submission.auto_score or 0) + (submission.essay_score or 0)

    # Check if all essay questions are graded (or if we graded all)
    all_essay_ids = [str(q.id) for q in questions if q.question_type == "ESSAY"]
    graded_essay_ids = [qid for qid in all_essay_ids if qid in submission.graded_answers]

    if len(graded_essay_ids) >= len(all_essay_ids):
        submission.grading_status = "GRADED"
        submission.status = "GRADED"

    await db.commit()
    logger.info(f"AI grading successful: Submission {submission_id} graded by {current_user.email} from IP {client_ip}")
    return {
        "message": "AI Graded successfully",
        "new_score": submission.score,
        "essay_score": submission.essay_score,
        "graded_answers": submission.graded_answers,
        "feedback": "\n".join(feedback_notes)
    }


@router.get("", response_model=dict, summary="Lấy danh sách đề thi")
@router.get("/", response_model=dict, include_in_schema=False)
async def get_exams(
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    offset = (page - 1) * limit
    cache_key = f"exams:list:user={current_user.id}:role={current_user.role}:page={page}:limit={limit}"
    try:
        cached_data = await redis_client.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
    except Exception as e:
        logger.error(f"Redis get error: {str(e)}")

    query = select(Exam).filter(Exam.is_deleted == False)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    exams = result.scalars().all()
    exams_response = []
    for e in exams:
        ex = ExamResponse.model_validate(e).model_dump(mode="json")
        cnt_res = await db.execute(
            select(func.count()).select_from(exam_questions).where(exam_questions.c.exam_id == e.id)
        )
        ex["question_count"] = cnt_res.scalar() or 0
        sub_cnt_res = await db.execute(
            select(func.count(ExamSubmission.id)).where(ExamSubmission.exam_id == e.id)
        )
        ex["submissions_count"] = sub_cnt_res.scalar() or 0
        exams_response.append(ex)

    response_data = {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if limit > 0 else 0,
        "items": exams_response
    }

    try:
        await redis_client.set(cache_key, json.dumps(response_data), ex=300)
    except Exception as e:
        logger.error(f"Redis set error: {str(e)}")

    return response_data

@router.post("", response_model=ExamResponse, summary="Tạo đề thi mới")
@router.post("/", response_model=ExamResponse, include_in_schema=False)
async def create_exam(
    request: Request,
    exam_in: ExamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    client_ip = request.client.host if request.client else "unknown"
    if not exam_in.question_ids:
        logger.warning(f"Exam creation failed: Empty questions list by {current_user.email} from IP {client_ip}")
        raise HTTPException(
            status_code=400,
            detail="Đề thi phải có ít nhất một câu hỏi."
        )

    exam = Exam(
        title=exam_in.title,
        duration_minutes=exam_in.duration_minutes,
        pass_score=exam_in.pass_score,
        max_attempts=exam_in.max_attempts or 1,
        show_answers_after_submit=exam_in.show_answers_after_submit or False,
        created_by_id=current_user.id
    )
    db.add(exam)
    await db.flush()

    # Validate question_ids exist before linking
    q_check = await db.execute(select(Question.id).filter(Question.id.in_(exam_in.question_ids)))
    found_ids = set(q_check.scalars().all())
    missing = set(exam_in.question_ids) - found_ids
    if missing:
        await db.rollback()
        logger.warning(f"Exam creation failed: Unknown question ids {sorted(missing)} by {current_user.email} from IP {client_ip}")
        raise HTTPException(
            status_code=400,
            detail=f"Câu hỏi không tồn tại: {sorted(missing)}"
        )

    for q_id in exam_in.question_ids:
        await db.execute(exam_questions.insert().values(exam_id=exam.id, question_id=q_id))

    await db.commit()
    await db.refresh(exam)
    await invalidate_exams_cache()
    logger.info(f"Exam created: {exam.id} by {current_user.email} from IP {client_ip}")
    return exam

# ===== EXAM MATRIX ENDPOINTS (ĐẶT TRƯỚC /{exam_id} ĐỂ TRÁNH MATCHING CONFLICT) =====

def count_matrix_questions(config: dict) -> int:
    """Đếm tổng số câu từ cấu hình ma trận 3 tầng (chapter > lesson > topic > difficulties)"""
    total = 0
    for chapter in config.get("chapters", []):
        for les in chapter.get("topics", []):
            for top in les.get("topics", []):
                for _d, c in (top.get("difficulties", {}) or {}).items():
                    total += int(c or 0)
    return total

async def invalidate_matrices_cache():
    try:
        keys = await redis_client.keys("exam_matrices:*")
        if keys:
            await redis_client.delete(*keys)
    except Exception as e:
        logger.error(f"Redis cache invalidate error: {str(e)}")

@router.get("/matrices", response_model=dict, summary="Danh sách ma trận đề thi")
async def list_exam_matrices(
    page: int = 1, limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    offset = (page - 1) * limit
    cache_key = f"exam_matrices:list:user={current_user.id}:page={page}:limit={limit}"
    try:
        cached_data = await redis_client.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
    except Exception as e:
        logger.error(f"Redis get error: {str(e)}")
    query = select(ExamMatrix).filter(ExamMatrix.is_active == True).order_by(ExamMatrix.created_at.desc())
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0
    items = (await db.execute(query.offset(offset).limit(limit))).scalars().all()
    resp = {"total": total, "items": [ExamMatrixResponse.model_validate(m).model_dump(mode="json") for m in items], "page": page, "limit": limit}
    try:
        await redis_client.set(cache_key, json.dumps(resp), ex=300)
    except Exception as e:
        logger.error(f"Redis set error: {str(e)}")
    return resp

@router.post("/matrices", response_model=ExamMatrixResponse, summary="Tạo ma trận đề thi mới")
async def create_exam_matrix(
    request: Request,
    matrix_in: ExamMatrixCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    client_ip = request.client.host if request.client else "unknown"
    try:
        total_q = count_matrix_questions(config := (matrix_in.matrix_config or {}))
        matrix = ExamMatrix(
            name=matrix_in.name,
            description=matrix_in.description,
            subject=matrix_in.subject,
            grade_level=matrix_in.grade_level,
            matrix_config=matrix_in.matrix_config,
            total_questions=total_q,
            created_by_id=current_user.id
        )
        db.add(matrix)
        await db.commit()
        await db.refresh(matrix)
        await invalidate_matrices_cache()
        logger.info(f"ExamMatrix created: {matrix.id} by {current_user.email} from IP {client_ip}")
        return matrix
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/matrices/{matrix_id}", response_model=ExamMatrixResponse, summary="Chi tiết ma trận đề thi")
async def get_exam_matrix(
    matrix_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(ExamMatrix).filter(ExamMatrix.id == matrix_id, ExamMatrix.is_active == True))
    matrix = result.scalars().first()
    if not matrix:
        raise HTTPException(status_code=404, detail="Không tìm thấy ma trận")
    return matrix

@router.put("/matrices/{matrix_id}", response_model=ExamMatrixResponse, summary="Cập nhật ma trận đề thi")
async def update_exam_matrix(
    request: Request,
    matrix_id: int,
    matrix_in: ExamMatrixUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    client_ip = request.client.host if request.client else "unknown"
    result = await db.execute(select(ExamMatrix).filter(ExamMatrix.id == matrix_id))
    matrix = result.scalars().first()
    if not matrix:
        raise HTTPException(status_code=404, detail="Không tìm thấy ma trận")
    if current_user.role not in ("ADMIN", "TEACHER"):
        raise HTTPException(status_code=403, detail="Bạn không có quyền sửa ma trận này")
    update_data = matrix_in.model_dump(exclude_unset=True)
    if "matrix_config" in update_data:
        matrix.total_questions = count_matrix_questions(update_data["matrix_config"] or {})
    for field, value in update_data.items():
        setattr(matrix, field, value)
    await db.commit()
    await db.refresh(matrix)
    await invalidate_matrices_cache()
    logger.info(f"ExamMatrix updated: {matrix_id} by {current_user.email} from IP {client_ip}")
    return matrix

@router.delete("/matrices/{matrix_id}", summary="Xóa ma trận đề thi")
async def delete_exam_matrix(
    request: Request,
    matrix_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    client_ip = request.client.host if request.client else "unknown"
    result = await db.execute(select(ExamMatrix).filter(ExamMatrix.id == matrix_id))
    matrix = result.scalars().first()
    if not matrix:
        raise HTTPException(status_code=404, detail="Không tìm thấy ma trận")
    if current_user.role not in ("ADMIN", "TEACHER"):
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa ma trận này")
    matrix.is_active = False
    await db.commit()
    await invalidate_matrices_cache()
    logger.info(f"ExamMatrix soft-deleted: {matrix_id} by {current_user.email} from IP {client_ip}")
    return {"message": "Xóa ma trận thành công"}

@router.post("/matrices/generate", response_model=ExamResponse, summary="Sinh đề thi tự động từ ma trận")
async def generate_exam_from_matrix(
    request: Request,
    payload: ExamMatrixGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    client_ip = request.client.host if request.client else "unknown"
    result = await db.execute(select(ExamMatrix).filter(ExamMatrix.id == payload.matrix_id, ExamMatrix.is_active == True))
    matrix = result.scalars().first()
    if not matrix:
        raise HTTPException(status_code=404, detail="Không tìm thấy ma trận hoặc đã bị xóa")

    config = matrix.matrix_config or {}
    question_ids = []
    missing = []

    for chapter_cfg in config.get("chapters", []):
        chap_name = chapter_cfg.get("chapter")
        for les_cfg in chapter_cfg.get("topics", []):
            for topic_cfg in les_cfg.get("topics", []):
                topic_name = topic_cfg.get("topic")
                for diff_key, count in topic_cfg.get("difficulties", {}).items():
                    cnt = int(count or 0)
                    if cnt <= 0:
                        continue
                    
                    questions = []
                    seen_ids = set()

                    # 1. Strict match: chapter + topic + difficulty
                    q_res = await db.execute(select(Question).filter(
                        Question.subject == matrix.subject,
                        Question.grade_level == matrix.grade_level,
                        Question.chapter == chap_name,
                        Question.topic == topic_name,
                        Question.difficulty == diff_key
                    ))
                    for q in q_res.scalars().all():
                        if q.id not in seen_ids:
                            questions.append(q)
                            seen_ids.add(q.id)

                    # 2. Fallback 1: chapter + difficulty
                    if len(questions) < cnt:
                        q_res2 = await db.execute(select(Question).filter(
                            Question.subject == matrix.subject,
                            Question.grade_level == matrix.grade_level,
                            Question.chapter == chap_name,
                            Question.difficulty == diff_key
                        ))
                        for q in q_res2.scalars().all():
                            if q.id not in seen_ids:
                                questions.append(q)
                                seen_ids.add(q.id)

                    # 3. Fallback 2: difficulty only
                    if len(questions) < cnt:
                        q_res3 = await db.execute(select(Question).filter(
                            Question.subject == matrix.subject,
                            Question.grade_level == matrix.grade_level,
                            Question.difficulty == diff_key
                        ))
                        for q in q_res3.scalars().all():
                            if q.id not in seen_ids:
                                questions.append(q)
                                seen_ids.add(q.id)

                    # 4. Fallback 3: subject & grade
                    if len(questions) < cnt:
                        q_res4 = await db.execute(select(Question).filter(
                            Question.subject == matrix.subject,
                            Question.grade_level == matrix.grade_level
                        ))
                        for q in q_res4.scalars().all():
                            if q.id not in seen_ids:
                                questions.append(q)
                                seen_ids.add(q.id)

                    # 5. Fallback 4: any questions in DB
                    if len(questions) < cnt:
                        q_res5 = await db.execute(select(Question))
                        for q in q_res5.scalars().all():
                            if q.id not in seen_ids:
                                questions.append(q)
                                seen_ids.add(q.id)

                    if len(questions) < cnt:
                        missing.append(f"{chap_name}/{topic_name}/{diff_key}: cần {cnt}, có {len(questions)}")
                        picked = list(questions)
                    else:
                        import random
                        available_qs = [q for q in questions if q.id not in question_ids]
                        if len(available_qs) < cnt:
                            picked = list(questions)
                        else:
                            picked = random.sample(available_qs, cnt)

                    for q in picked:
                        if q.id not in question_ids:
                            question_ids.append(q.id)

    if not question_ids:
        # Absolute fallback: grab any questions from DB
        q_res_all = await db.execute(select(Question).limit(10))
        all_q = q_res_all.scalars().all()
        if all_q:
            question_ids = [q.id for q in all_q]
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Ngân hàng câu hỏi trống. Không thể sinh đề thi. Chi tiết: {'; '.join(missing)}"
            )

    if missing:
        logger.warning(
            f"Matrix {matrix.id} ({matrix.name}) generated with partial coverage: {'; '.join(missing)}"
        )

    exam = Exam(
        title=payload.title,
        duration_minutes=payload.duration_minutes,
        pass_score=payload.pass_score,
        max_attempts=payload.max_attempts or 1,
        show_answers_after_submit=payload.show_answers_after_submit,
        is_published=payload.is_published,
        created_by_id=current_user.id
    )
    db.add(exam)
    await db.flush()
    for q_id in question_ids:
        await db.execute(exam_questions.insert().values(exam_id=exam.id, question_id=q_id))
    await db.commit()
    await db.refresh(exam)
    await invalidate_exams_cache()
    logger.info(f"Exam generated from matrix {matrix.id}: {exam.id} by {current_user.email} from IP {client_ip}")
    return exam

@router.get("/{exam_id}", response_model=dict, summary="Lấy chi tiết đề thi")
async def get_exam(
    exam_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cache_key = f"exams:{exam_id}:user={current_user.id}:role={current_user.role}"
    try:
        cached_data = await redis_client.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
    except Exception as e:
        logger.error(f"Redis get error: {str(e)}")

    result = await db.execute(select(Exam).filter(Exam.id == exam_id, Exam.is_deleted == False))
    exam = result.scalars().first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    q_result = await db.execute(
        select(Question).join(exam_questions, Question.id == exam_questions.c.question_id).filter(exam_questions.c.exam_id == exam_id)
    )
    questions = q_result.scalars().all()

    # If student, strip correct answers or solutions if applicable, but here exam_detail contains public question info.
    # Note: /api/exams/{exam_id} is typically used by teachers/admins or general exam management. Student uses /api/student/exams/{exam_id}.
    # Still, including user/role in cache_key ensures strict isolation.
    can_view_answers = current_user.role in ("TEACHER", "ADMIN") or exam.show_answers_after_submit
    exam_detail = {
        "id": exam.id,
        "title": exam.title,
        "created_at": exam.created_at.isoformat() if hasattr(exam.created_at, "isoformat") else str(exam.created_at),
        "created_by_id": exam.created_by_id,
        "questions": [
            {
                "id": q.id,
                "content": q.content,
                "options": q.options,
                "question_type": q.question_type,
                "sub_questions": q.sub_questions,
                "blanks": q.blanks,
                "subject": q.subject,
                "difficulty": q.difficulty,
                "image_url": q.image_url,
                "latex_code": q.latex_code,
                **({
                    "correct_option": q.correct_option,
                    "correct_answer": q.correct_answer,
                    "correct_answers": q.correct_answers,
                    "sample_solution": q.sample_solution,
                    "explanation": getattr(q, "explanation", None),
                } if can_view_answers else {}),
            } for q in questions
        ]
    }

    try:
        await redis_client.set(cache_key, json.dumps(exam_detail), ex=300)
    except Exception as e:
        logger.error(f"Redis set error: {str(e)}")

    return exam_detail


@router.put("/submissions/{submission_id}/grade", summary="Chấm điểm câu hỏi tự luận thủ công")
async def grade_essay_submission(
    request: Request,
    submission_id: int,
    essay_score: float,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    client_ip = request.client.host if request.client else "unknown"
    result = await db.execute(select(ExamSubmission).filter(ExamSubmission.id == submission_id))
    submission = result.scalars().first()
    if not submission:
        logger.warning(f"Grading failed: Submission not found {submission_id} by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=404, detail="Submission not found")

    await check_grading_authorization(db, submission, current_user)

    submission.essay_score = essay_score
    submission.score = (submission.auto_score or 0) + (submission.essay_score or 0)

    submission.grading_status = "GRADED"
    await db.commit()
    logger.info(f"Grading successful: Submission {submission_id} graded by {current_user.email} from IP {client_ip}")
    return {"message": "Submission graded successfully", "new_score": submission.score}

@router.put("/{exam_id}", response_model=ExamResponse, summary="Cập nhật đề thi")
async def update_exam(
    request: Request,
    exam_id: int,
    exam_in: ExamUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    client_ip = request.client.host if request.client else "unknown"
    result = await db.execute(select(Exam).filter(Exam.id == exam_id))
    exam = result.scalars().first()
    if not exam:
        logger.warning(f"Exam update failed: Not found ID {exam_id} by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")

    if current_user.role not in ("ADMIN", "TEACHER"):
        logger.warning(f"Exam update failed: Unauthorized update {exam_id} by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=403, detail="Bạn không có quyền cập nhật bài thi này")

    update_data = exam_in.model_dump(exclude_unset=True)
    question_ids = update_data.pop("question_ids", None)

    for field, value in update_data.items():
        setattr(exam, field, value)

    if question_ids is not None:
        if not question_ids:
            logger.warning(f"Exam update failed: Empty questions list {exam_id} by {current_user.email} from IP {client_ip}")
            raise HTTPException(status_code=400, detail="Đề thi phải có ít nhất một câu hỏi")

        await db.execute(exam_questions.delete().where(exam_questions.c.exam_id == exam_id))
        for q_id in question_ids:
            await db.execute(exam_questions.insert().values(exam_id=exam.id, question_id=q_id))

    await db.commit()
    await db.refresh(exam)
    await invalidate_exams_cache()
    try:
        keys = await redis_client.keys(f"exams:{exam_id}:*")
        if keys:
            await redis_client.delete(*keys)
    except Exception as e:
        logger.error(f"Redis cache delete error for {exam_id} by {current_user.email} from IP {client_ip}: {str(e)}")

    logger.info(f"Exam updated: {exam_id} by {current_user.email} from IP {client_ip}")
    return exam


@router.delete("/{exam_id}", summary="Xóa đề thi")
async def delete_exam(
    request: Request,
    exam_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    client_ip = request.client.host if request.client else "unknown"
    result = await db.execute(select(Exam).filter(Exam.id == exam_id))
    exam = result.scalars().first()
    if not exam:
        logger.warning(f"Exam delete failed: Not found ID {exam_id} by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")

    if current_user.role not in ("ADMIN", "TEACHER"):
        logger.warning(f"Exam delete failed: Unauthorized delete {exam_id} by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa bài thi này")

    assignment_res = await db.execute(select(Assignment).filter(Assignment.exam_id == exam_id))
    if assignment_res.scalars().first():
        logger.warning(f"Exam delete failed: Assigned to classroom {exam_id} by {current_user.email} from IP {client_ip}")
        raise HTTPException(
            status_code=400,
            detail="Không thể xóa bài thi đang được giao cho lớp học. Vui lòng hủy giao trước."
        )

    sub_res = await db.execute(select(ExamSubmission).filter(ExamSubmission.exam_id == exam_id))
    if sub_res.scalars().first():
        logger.warning(f"Exam delete failed: Has submissions {exam_id} by {current_user.email} from IP {client_ip}")
        raise HTTPException(
            status_code=400,
            detail="Không thể xóa bài thi đã có học sinh làm và nộp bài."
        )

    exam.is_deleted = True
    await db.commit()
    await invalidate_exams_cache()
    try:
        await redis_client.delete(f"exams:{exam_id}")
    except Exception as e:
        logger.error(f"Redis cache delete error for {exam_id} by {current_user.email} from IP {client_ip}: {str(e)}")

    logger.info(f"Exam soft-deleted: {exam_id} by {current_user.email} from IP {client_ip}")
    return {"message": "Xóa bài thi thành công"}

@router.get("/{exam_id}/submissions", summary="Xem danh sách bài nộp của đề thi")
async def get_exam_submissions(
    exam_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    result = await db.execute(select(Exam).filter(Exam.id == exam_id, Exam.is_deleted == False))
    exam = result.scalars().first()
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")

    if current_user.role != "ADMIN" and exam.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem bài nộp của đề thi này")

    subs_query = (
        select(ExamSubmission, User.full_name, User.email)
        .join(User, ExamSubmission.user_id == User.id)
        .filter(ExamSubmission.exam_id == exam_id)
        .order_by(ExamSubmission.submitted_at.desc())
    )
    subs_result = await db.execute(subs_query)
    rows = subs_result.all()

    submissions_list = []
    for sub, student_name, student_email in rows:
        submissions_list.append({
            "id": sub.id,
            "exam_id": sub.exam_id,
            "user_id": sub.user_id,
            "student_name": student_name,
            "student_email": student_email,
            "score": sub.score,
            "auto_score": sub.auto_score,
            "essay_score": sub.essay_score,
            "status": sub.status,
            "grading_status": sub.grading_status,
            "time_spent": sub.time_spent,
            "attempt_number": sub.attempt_number,
            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
            "started_at": sub.started_at.isoformat() if sub.started_at else None,
        })

    return submissions_list