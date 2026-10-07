import logging
from fastapi import APIRouter, Depends, HTTPException, status, Body, Request, Query
from sqlalchemy import func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional, Any, Dict
import json
import random
from app.database import get_db, Base, redis_client
from app.models.exam import Exam, ExamSubmission, exam_questions
from app.models.question import Question
from app.models.classroom import Assignment, Classroom, ClassroomExam
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
    try:
        from app.routers.analytics import invalidate_analytics_cache
        await invalidate_analytics_cache()
    except Exception:
        pass

async def check_grading_authorization(db: AsyncSession, submission: ExamSubmission, current_user: User):
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
    search: Optional[str] = None,
    exam_type: Optional[str] = None,
    subject: Optional[str] = None,
    grade_level: Optional[int] = None,
    is_published: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    offset = (page - 1) * limit
    cache_key = f"exams:list:user={current_user.id}:role={current_user.role}:page={page}:limit={limit}:search={search}:type={exam_type}:sub={subject}:grd={grade_level}:pub={is_published}"
    try:
        cached_data = await redis_client.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
    except Exception as e:
        logger.error(f"Redis get error: {str(e)}")

    query = select(Exam).filter(Exam.is_deleted == False)

    if exam_type:
        query = query.filter(Exam.exam_type == exam_type)

    if is_published is not None:
        query = query.filter(Exam.is_published == is_published)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Exam.title.ilike(term),
                Exam.description.ilike(term)
            )
        )

    if subject or grade_level:
        q_subfilter = (
            select(exam_questions.c.exam_id)
            .join(Question, Question.id == exam_questions.c.question_id)
        )
        if subject:
            q_subfilter = q_subfilter.filter(Question.subject.ilike(f"%{subject}%"))
        if grade_level:
            q_subfilter = q_subfilter.filter(Question.grade_level == grade_level)
        query = query.filter(Exam.id.in_(q_subfilter))

    # Order by newest first
    query = query.order_by(Exam.created_at.desc())

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    exams = result.scalars().all()
    exams_response = []
    if exams:
        exam_ids = [e.id for e in exams]
        # Batch question counts in 1 single query (replaces N queries)
        q_cnt_res = await db.execute(
            select(exam_questions.c.exam_id, func.count())
            .where(exam_questions.c.exam_id.in_(exam_ids))
            .group_by(exam_questions.c.exam_id)
        )
        q_counts = {row[0]: row[1] for row in q_cnt_res.all()}

        # Batch submission counts in 1 single query (replaces N queries)
        sub_cnt_res = await db.execute(
            select(ExamSubmission.exam_id, func.count(ExamSubmission.id))
            .where(ExamSubmission.exam_id.in_(exam_ids))
            .group_by(ExamSubmission.exam_id)
        )
        sub_counts = {row[0]: row[1] for row in sub_cnt_res.all()}

        # Batch load question subjects and grade levels
        q_meta_res = await db.execute(
            select(exam_questions.c.exam_id, Question.subject, Question.grade_level)
            .join(Question, Question.id == exam_questions.c.question_id)
            .where(exam_questions.c.exam_id.in_(exam_ids))
        )
        q_meta_map = {}
        for eid, q_sub, q_grd in q_meta_res.all():
            if eid not in q_meta_map:
                q_meta_map[eid] = {"subjects": set(), "grades": set()}
            if q_sub:
                q_meta_map[eid]["subjects"].add(q_sub)
            if q_grd:
                q_meta_map[eid]["grades"].add(q_grd)

        for e in exams:
            ex = ExamResponse.model_validate(e).model_dump(mode="json")
            ex["question_count"] = q_counts.get(e.id, 0)
            ex["submissions_count"] = sub_counts.get(e.id, 0)
            meta = q_meta_map.get(e.id, {"subjects": set(), "grades": set()})
            ex["subject"] = ", ".join(sorted(meta["subjects"])) if meta["subjects"] else None
            ex["grade_level"] = list(meta["grades"])[0] if meta["grades"] else None
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
        exam_type=exam_in.exam_type or "EXAM",
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
    if current_user.role != "TEACHER":
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
    if current_user.role != "TEACHER":
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa ma trận này")
    matrix.is_active = False
    await db.commit()
    await invalidate_matrices_cache()
    logger.info(f"ExamMatrix soft-deleted: {matrix_id} by {current_user.email} from IP {client_ip}")
    return {"message": "Xóa ma trận thành công"}

@router.post("/matrices/generate", summary="Sinh đề thi tự động từ ma trận")
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
    num_versions = max(1, min(payload.number_of_versions or 1, 20))
    raw_prefix = str(payload.code_prefix or "10").strip()
    shuffle_q = bool(payload.shuffle_questions if payload.shuffle_questions is not None else True)
    shuffle_opt = bool(payload.shuffle_options if payload.shuffle_options is not None else True)
    independent = bool(payload.independent_draw if payload.independent_draw is not None else False)

    # Function to pick a full set of question objects matching the matrix config
    async def pick_matrix_questions():
        picked_q_list = []
        picked_ids = set()
        missing = []

        base_filter = [
            (Question.status != "EXAM_CLONE") | (Question.status.is_(None))
        ]

        for chapter_cfg in config.get("chapters", []):
            chap_name = chapter_cfg.get("chapter")
            for les_cfg in chapter_cfg.get("topics", []):
                for topic_cfg in les_cfg.get("topics", []):
                    topic_name = topic_cfg.get("topic")
                    for diff_key, count in topic_cfg.get("difficulties", {}).items():
                        cnt = int(count or 0)
                        if cnt <= 0:
                            continue

                        # 1. Strict match: subject + grade + chapter + topic + difficulty
                        q_res = await db.execute(select(Question).filter(
                            *base_filter,
                            Question.subject == matrix.subject,
                            Question.grade_level == matrix.grade_level,
                            Question.chapter == chap_name,
                            Question.topic == topic_name,
                            Question.difficulty == diff_key
                        ))
                        candidates = [q for q in q_res.scalars().all() if q.id not in picked_ids]

                        # 2. Fallback 1: chapter + difficulty
                        if len(candidates) < cnt:
                            q_res2 = await db.execute(select(Question).filter(
                                *base_filter,
                                Question.subject == matrix.subject,
                                Question.grade_level == matrix.grade_level,
                                Question.chapter == chap_name,
                                Question.difficulty == diff_key
                            ))
                            candidates = list({q.id: q for q in (candidates + q_res2.scalars().all()) if q.id not in picked_ids}.values())

                        # 3. Fallback 2: difficulty only
                        if len(candidates) < cnt:
                            q_res3 = await db.execute(select(Question).filter(
                                *base_filter,
                                Question.subject == matrix.subject,
                                Question.grade_level == matrix.grade_level,
                                Question.difficulty == diff_key
                            ))
                            candidates = list({q.id: q for q in (candidates + q_res3.scalars().all()) if q.id not in picked_ids}.values())

                        # 4. Fallback 3: subject & grade
                        if len(candidates) < cnt:
                            q_res4 = await db.execute(select(Question).filter(
                                *base_filter,
                                Question.subject == matrix.subject,
                                Question.grade_level == matrix.grade_level
                            ))
                            candidates = list({q.id: q for q in (candidates + q_res4.scalars().all()) if q.id not in picked_ids}.values())

                        # 5. Fallback 4: any question in DB
                        if len(candidates) < cnt:
                            q_res5 = await db.execute(select(Question).filter(*base_filter))
                            candidates = list({q.id: q for q in (candidates + q_res5.scalars().all()) if q.id not in picked_ids}.values())

                        if len(candidates) < cnt:
                            missing.append(f"{chap_name}/{topic_name}/{diff_key}: cần {cnt}, có {len(candidates)}")
                            selected = list(candidates)
                        else:
                            selected = random.sample(candidates, cnt)

                        for q in selected:
                            if q.id not in picked_ids:
                                picked_ids.add(q.id)
                                picked_q_list.append(q)

        if not picked_q_list:
            q_res_all = await db.execute(select(Question).filter(*base_filter).limit(10))
            all_q = q_res_all.scalars().all()
            if all_q:
                picked_q_list = list(all_q)
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Ngân hàng câu hỏi trống. Không thể sinh đề thi. Chi tiết: {'; '.join(missing)}"
                )

        return picked_q_list

    base_questions = []
    if not independent:
        base_questions = await pick_matrix_questions()

    created_exams = []

    for v_idx in range(1, num_versions + 1):
        if num_versions == 1:
            v_code = f"{raw_prefix}1" if raw_prefix else "101"
            exam_title = payload.title
        else:
            if raw_prefix.isdigit():
                v_code = f"{raw_prefix}{v_idx}"
            else:
                v_code = f"{raw_prefix}{v_idx:02d}"
            exam_title = f"{payload.title} - Mã {v_code}"

        # Get questions for this version
        if independent:
            v_questions = await pick_matrix_questions()
        else:
            v_questions = list(base_questions)

        # 1. Shuffle question order if enabled
        if shuffle_q:
            v_questions = list(v_questions)
            random.shuffle(v_questions)

        # 2. Process questions and shuffle options if enabled
        final_question_ids = []
        for q in v_questions:
            if shuffle_opt and q.question_type == "MULTIPLE_CHOICE" and q.options and len(q.options) > 1:
                orig_options = list(q.options)
                indexed_options = list(enumerate(orig_options))
                random.shuffle(indexed_options)
                shuffled_options = [opt for _, opt in indexed_options]

                new_correct_opt = None
                if q.correct_option is not None:
                    for new_i, (orig_i, _) in enumerate(indexed_options):
                        if orig_i == q.correct_option:
                            new_correct_opt = new_i
                            break

                cloned_q = Question(
                    code=f"{q.code or 'Q'}_{v_code}_{q.id}_{random.randint(1000, 9999)}",
                    content=q.content,
                    question_type=q.question_type,
                    subject=q.subject,
                    grade_level=q.grade_level,
                    chapter=q.chapter,
                    lesson=q.lesson,
                    topic=q.topic,
                    difficulty=q.difficulty,
                    media=q.media,
                    options=shuffled_options,
                    sub_questions=q.sub_questions,
                    correct_answers=q.correct_answers,
                    correct_option=new_correct_opt,
                    sample_solution=q.sample_solution,
                    correct_answer=q.correct_answer,
                    blanks=q.blanks,
                    image_url=q.image_url,
                    latex_code=q.latex_code,
                    explanation=q.explanation,
                    tags=["exam_clone", f"matrix_{matrix.id}", f"code_{v_code}"],
                    status="EXAM_CLONE",
                    created_by_id=current_user.id
                )
                db.add(cloned_q)
                await db.flush()
                final_question_ids.append(cloned_q.id)
            else:
                final_question_ids.append(q.id)

        # Create exam record
        exam = Exam(
            title=exam_title,
            description=f"Sinh từ ma trận '{matrix.name}' (Mã đề: {v_code})" if num_versions > 1 else f"Sinh từ ma trận '{matrix.name}'",
            duration_minutes=payload.duration_minutes,
            pass_score=payload.pass_score,
            max_attempts=payload.max_attempts or 1,
            show_answers_after_submit=payload.show_answers_after_submit,
            is_published=payload.is_published,
            exam_type="EXAM",
            created_by_id=current_user.id
        )
        db.add(exam)
        await db.flush()

        for q_id in final_question_ids:
            await db.execute(exam_questions.insert().values(exam_id=exam.id, question_id=q_id))

        created_exams.append(exam)

    await db.commit()
    for e in created_exams:
        await db.refresh(e)
    await invalidate_exams_cache()
    logger.info(f"{len(created_exams)} exams generated from matrix {matrix.id} by {current_user.email} from IP {client_ip}")

    first_exam = created_exams[0]
    return {
        "message": f"Sinh thành công {len(created_exams)} mã đề thi từ ma trận '{matrix.name}'!",
        "count": len(created_exams),
        "exams": [
            {
                "id": e.id,
                "title": e.title,
                "duration_minutes": e.duration_minutes,
                "pass_score": e.pass_score,
                "max_attempts": e.max_attempts,
                "is_published": e.is_published,
                "created_at": e.created_at.isoformat() if e.created_at else None
            } for e in created_exams
        ],
        "id": first_exam.id,
        "title": first_exam.title,
        "duration_minutes": first_exam.duration_minutes,
        "pass_score": first_exam.pass_score,
        "max_attempts": first_exam.max_attempts,
        "show_answers_after_submit": first_exam.show_answers_after_submit,
        "is_published": first_exam.is_published,
        "created_at": first_exam.created_at.isoformat() if first_exam.created_at else None,
        "created_by_id": first_exam.created_by_id
    }

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
    # Note: /api/exams/{exam_id} is typically used by teachers or general exam management. Student uses /api/student/exams/{exam_id}.
    # Still, including user/role in cache_key ensures strict isolation.
    can_view_answers = current_user.role == "TEACHER" or exam.show_answers_after_submit
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

    if current_user.role != "TEACHER":
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
    force: str = Query("false"),
    hard: str = Query("false"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    client_ip = request.client.host if request.client else "unknown"
    is_force = force.lower() in ("true", "1", "yes")
    is_hard = hard.lower() in ("true", "1", "yes")
    result = await db.execute(select(Exam).filter(Exam.id == exam_id))
    exam = result.scalars().first()
    if not exam:
        logger.warning(f"Exam delete failed: Not found ID {exam_id} by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")

    if current_user.role != "TEACHER":
        logger.warning(f"Exam delete failed: Unauthorized delete {exam_id} by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa bài thi này")

    assignment_res = await db.execute(
        select(Assignment)
        .options(selectinload(Assignment.classroom))
        .filter(Assignment.exam_id == exam_id)
    )
    assignments = assignment_res.scalars().all()
    if assignments and not is_force and not is_hard:
        classroom_names = [a.classroom.name for a in assignments if a.classroom]
        names_str = ", ".join(classroom_names) if classroom_names else "các lớp"
        logger.warning(f"Exam delete needs confirmation: Assigned to classrooms {exam_id} by {current_user.email} from IP {client_ip}")
        raise HTTPException(
            status_code=400,
            detail=f"Đề thi này đang được giao cho lớp: {names_str}. Bạn có muốn tiếp tục xóa không?"
        )

    if assignments and (is_force or is_hard):
        for assignment in assignments:
            await db.delete(assignment)

    classroom_exam_res = await db.execute(
        select(ClassroomExam).filter(ClassroomExam.exam_id == exam_id)
    )
    for ce in classroom_exam_res.scalars().all():
        await db.delete(ce)

    sub_res = await db.execute(select(ExamSubmission).filter(ExamSubmission.exam_id == exam_id))
    submissions = sub_res.scalars().all()
    if submissions and not is_force and not is_hard:
        logger.warning(f"Exam delete needs confirmation: Has submissions {exam_id} by {current_user.email} from IP {client_ip}")
        raise HTTPException(
            status_code=400,
            detail="Bài thi này đã có học sinh làm và nộp bài. Bạn có muốn tiếp tục xóa không?"
        )

    if submissions and (is_force or is_hard):
        for sub in submissions:
            await db.delete(sub)

    if is_hard:
        await db.execute(exam_questions.delete().where(exam_questions.c.exam_id == exam_id))
        await db.delete(exam)
    else:
        exam.is_deleted = True

    await db.commit()
    await invalidate_exams_cache()
    try:
        await redis_client.delete(f"exams:{exam_id}")
    except Exception as e:
        logger.error(f"Redis cache delete error for {exam_id} by {current_user.email} from IP {client_ip}: {str(e)}")

    logger.info(f"Exam {'hard' if is_hard else 'soft'}-deleted: {exam_id} by {current_user.email} from IP {client_ip}")
    return {"message": f"Xóa {'hoàn toàn' if is_hard else ''} bài thi thành công".strip()}

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

    if exam.created_by_id == current_user.id:
        pass
    else:
        assignment_res = await db.execute(
            select(Assignment).filter(Assignment.exam_id == exam_id)
        )
        assignments = assignment_res.scalars().all()
        if assignments:
            classroom_res = await db.execute(
                select(Classroom).filter(
                    Classroom.id.in_([a.classroom_id for a in assignments]),
                    Classroom.instructor_id == current_user.id
                )
            )
            if not classroom_res.scalars().first():
                raise HTTPException(status_code=403, detail="Bạn không có quyền xem bài nộp của đề thi này")
        else:
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