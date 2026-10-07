import asyncio
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.ai_config import AIConfig
from app.models.user import User
from app.core.security import get_current_user
import logging
from pydantic import BaseModel
from typing import Optional, List, Any
from app.services.ai_service import AIService
from app.services.document_parser import extract_text_from_file, parse_questions_with_rules

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["AI Integration"])

async def get_ai_service(db: AsyncSession = Depends(get_db)) -> AIService:
    result = await db.execute(select(AIConfig).filter(AIConfig.is_active == True))
    config = result.scalars().first()
    if config:
        return AIService(db_config={
            "provider": config.provider,
            "api_key": config.api_key,
            "base_url": config.base_url,
            "model_name": config.model_name
        })
    return AIService()

class GenerateQuestionsRequest(BaseModel):
    prompt_text: str
    num_questions: int = 3

class GradeEssayRequest(BaseModel):
    question_content: str
    student_answer: str
    sample_solution: str


class VerifyQuestionRequest(BaseModel):
    question_id: Optional[int] = None
    content: str
    question_type: str = "MULTIPLE_CHOICE"  # MULTIPLE_CHOICE | SHORT_ANSWER | ESSAY | TRUE_FALSE
    options: Optional[List[str]] = None
    correct_option: Optional[int] = None
    correct_answer: Optional[str] = None
    sample_solution: Optional[str] = None

@router.post("/generate-questions")
async def generate_questions(payload: GenerateQuestionsRequest, current_user: User = Depends(get_current_user), ai_service: AIService = Depends(get_ai_service)):
    if current_user.role != "TEACHER":
        raise HTTPException(status_code=403, detail="Chỉ giáo viên mới có quyền sử dụng tính năng AI sinh câu hỏi.")
    try:
        questions = await asyncio.to_thread(ai_service.generate_questions, payload.prompt_text, payload.num_questions)
        return {"success": True, "questions": questions}
    except Exception as e:
        logger.error(f"Error in generate-questions: {str(e)}")
        return {"success": False, "questions": [], "error": str(e)}

@router.post("/grade-essay")
async def grade_essay(payload: GradeEssayRequest, current_user: User = Depends(get_current_user), ai_service: AIService = Depends(get_ai_service)):
    if current_user.role != "TEACHER":
        raise HTTPException(status_code=403, detail="Chỉ giáo viên mới có quyền sử dụng tính năng AI chấm bài.")
    try:
        result = await asyncio.to_thread(ai_service.grade_essay, payload.question_content, payload.student_answer, payload.sample_solution)
        return {"success": True, **result}
    except Exception as e:
        logger.error(f"Error in grade-essay: {str(e)}")
        return {"success": False, "score": 5.0, "feedback": f"Lỗi chấm bài: {str(e)}"}


class VerifyBatchRequest(BaseModel):
    subject: Optional[str] = None
    chapter: Optional[str] = None
    grade_level: Optional[int] = None
    limit: int = 10

@router.post("/verify-batch")
async def verify_batch(payload: VerifyBatchRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ai_service: AIService = Depends(get_ai_service)):
    if current_user.role != "TEACHER":
        raise HTTPException(status_code=403, detail="Không có quyền thực hiện.")
    
    from app.models.question import Question
    query = select(Question).filter(Question.ai_verified == False)
    if payload.subject:
        query = query.filter(Question.subject == payload.subject)
    if payload.chapter:
        query = query.filter(Question.chapter == payload.chapter)
    if payload.grade_level:
        query = query.filter(Question.grade_level == payload.grade_level)
    
    safe_limit = min(payload.limit or 10, 10)
    query = query.limit(safe_limit)
    res = await db.execute(query)
    questions = res.scalars().all()

    if not questions:
        return {"success": True, "total_checked": 0, "results": []}

    sem = asyncio.Semaphore(3)

    async def verify_single(q):
        async with sem:
            try:
                res_ai = await asyncio.to_thread(
                    ai_service.verify_question,
                    content=q.content,
                    question_type=q.question_type,
                    options=q.options,
                    correct_option=q.correct_option,
                    correct_answer=q.correct_answer,
                    sample_solution=q.sample_solution
                )
                return q, res_ai, None
            except Exception as e:
                return q, None, str(e)

    verified_items = await asyncio.gather(*(verify_single(q) for q in questions))

    results = []
    for q, res_ai, err in verified_items:
        if err is None and res_ai:
            q.ai_verified = True
            q.ai_feedback = res_ai
            results.append({"question_id": q.id, "success": True, **res_ai})
        else:
            results.append({"question_id": q.id, "success": False, "error": err or "Unknown error"})

    await db.commit()
    return {"success": True, "total_checked": len(questions), "results": results}


@router.post("/verify-question")
async def verify_question(payload: VerifyQuestionRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user), ai_service: AIService = Depends(get_ai_service)):
    if current_user.role != "TEACHER":
        raise HTTPException(status_code=403, detail="Chỉ giáo viên mới được kiểm tra câu hỏi bằng AI.")
    try:
        result = await asyncio.to_thread(
            ai_service.verify_question,
            content=payload.content,
            question_type=payload.question_type,
            options=payload.options,
            correct_option=payload.correct_option,
            correct_answer=payload.correct_answer,
            sample_solution=payload.sample_solution,
        )
        
        # Lưu vào DB nếu có question_id
        if payload.question_id:
            from app.models.question import Question
            q = await db.get(Question, payload.question_id)
            if q:
                q.ai_verified = True
                q.ai_feedback = result
                await db.commit()
                
        return {"success": True, **result}
    except Exception as e:
        logger.error(f"Error in verify-question: {str(e)}")
        return {
            "success": False,
            "is_correct": False,
            "confidence": 0.0,
            "ai_answer": "Lỗi",
            "feedback": f"Lỗi kiểm tra AI: {str(e)}"
        }


class AuditAndFixRequest(BaseModel):
    question_id: Optional[int] = None
    content: Optional[str] = None
    question_type: Optional[str] = "MULTIPLE_CHOICE"
    options: Optional[List[str]] = None
    correct_option: Optional[int] = None
    correct_answer: Optional[str] = None
    sub_questions: Optional[List[Any]] = None
    sample_solution: Optional[str] = None
    explanation: Optional[str] = None
    subject: Optional[str] = "Toán"
    grade_level: Optional[int] = 10
    auto_apply: bool = True

@router.post("/audit-and-fix")
async def audit_and_fix(
    payload: AuditAndFixRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    ai_service: AIService = Depends(get_ai_service)
):
    if current_user.role != "TEACHER":
        raise HTTPException(status_code=403, detail="Chỉ giáo viên mới có quyền sử dụng tính năng này.")

    from app.models.question import Question, QuestionAuditLog
    from app.schemas.question import QuestionResponse

    target_q = None
    if payload.question_id:
        target_q = await db.get(Question, payload.question_id)
        if not target_q:
            raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi.")

    content = target_q.content if target_q else payload.content
    q_type = target_q.question_type if target_q else payload.question_type
    options = target_q.options if target_q else payload.options
    corr_opt = target_q.correct_option if target_q else payload.correct_option
    corr_ans = target_q.correct_answer if target_q else payload.correct_answer
    sub_qs = target_q.sub_questions if target_q else payload.sub_questions
    sample_sol = target_q.sample_solution if target_q else payload.sample_solution
    expl = target_q.explanation if target_q else payload.explanation
    subj = target_q.subject if target_q else payload.subject
    grd = target_q.grade_level if target_q else payload.grade_level

    try:
        res = await asyncio.to_thread(
            ai_service.audit_and_fix_question,
            content=content,
            question_type=q_type,
            options=options,
            correct_option=corr_opt,
            correct_answer=corr_ans,
            sub_questions=sub_qs,
            sample_solution=sample_sol,
            explanation=expl,
            subject=subj or "Toán",
            grade_level=grd or 10
        )

        old_display = None
        new_display = None
        if q_type == "MULTIPLE_CHOICE":
            if corr_opt is not None and options and 0 <= corr_opt < len(options):
                old_display = f"{chr(65 + corr_opt)}: {options[corr_opt]}"
            elif corr_opt is not None:
                old_display = f"Phương án {chr(65 + corr_opt)}"
            else:
                old_display = "Chưa có đáp án"

            s_opt = res.get("suggested_correct_option")
            if s_opt is not None and options and 0 <= s_opt < len(options):
                new_display = f"{chr(65 + s_opt)}: {options[s_opt]}"
            elif s_opt is not None:
                new_display = f"Phương án {chr(65 + s_opt)}"

        elif q_type == "SHORT_ANSWER":
            old_display = corr_ans or "Chưa có đáp án"
            new_display = res.get("suggested_correct_answer")

        res["old_display"] = old_display
        res["new_display"] = new_display

        updated_question_data = None
        if target_q and payload.auto_apply and res.get("changed"):
            old_data = {
                "correct_option": target_q.correct_option,
                "correct_answer": target_q.correct_answer,
                "explanation": target_q.explanation
            }

            if q_type == "MULTIPLE_CHOICE" and res.get("suggested_correct_option") is not None:
                target_q.correct_option = res["suggested_correct_option"]
            if q_type == "SHORT_ANSWER" and res.get("suggested_correct_answer") is not None:
                target_q.correct_answer = res["suggested_correct_answer"]
            if q_type == "TRUE_FALSE" and res.get("suggested_sub_questions"):
                target_q.sub_questions = res["suggested_sub_questions"]
            if res.get("suggested_explanation"):
                target_q.explanation = res["suggested_explanation"]

            target_q.ai_verified = True
            target_q.ai_feedback = res

            audit = QuestionAuditLog(
                question_id=target_q.id,
                action="AI_AUTO_FIX",
                modified_by_id=current_user.id,
                old_data=old_data,
                new_data={
                    "correct_option": target_q.correct_option,
                    "correct_answer": target_q.correct_answer,
                    "explanation": target_q.explanation,
                    "reason": res.get("reason"),
                    "action": res.get("action")
                }
            )
            db.add(audit)
            await db.commit()
            await db.refresh(target_q)
            updated_question_data = QuestionResponse.model_validate(target_q).model_dump(mode="json")
        elif target_q and payload.auto_apply:
            target_q.ai_verified = True
            target_q.ai_feedback = res
            await db.commit()
            await db.refresh(target_q)
            updated_question_data = QuestionResponse.model_validate(target_q).model_dump(mode="json")

        return {
            "success": True,
            "changed": res.get("changed", False),
            "audit_result": res,
            "question": updated_question_data
        }
    except Exception as e:
        logger.error(f"Error in audit-and-fix: {str(e)}")
        return {
            "success": False,
            "changed": False,
            "error": str(e),
            "audit_result": {
                "action": "KEEP",
                "reason": f"Lỗi xử lý AI: {str(e)}"
            }
        }


class AuditAndFixBatchRequest(BaseModel):
    subject: Optional[str] = None
    grade_level: Optional[int] = None
    chapter: Optional[str] = None
    lesson: Optional[str] = None
    topic: Optional[str] = None
    filter_type: str = "missing_or_incorrect"  # "missing_or_incorrect" | "missing_only" | "incorrect_only" | "all"
    limit: int = 15
    auto_apply: bool = True

@router.post("/audit-and-fix-batch")
async def audit_and_fix_batch(
    payload: AuditAndFixBatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    ai_service: AIService = Depends(get_ai_service)
):
    if current_user.role != "TEACHER":
        raise HTTPException(status_code=403, detail="Chỉ giáo viên mới có quyền sử dụng tính năng này.")

    from app.models.question import Question, QuestionAuditLog

    query = select(Question).filter((Question.status != "EXAM_CLONE") | (Question.status.is_(None)))
    if payload.subject:
        query = query.filter(Question.subject == payload.subject)
    if payload.grade_level:
        query = query.filter(Question.grade_level == payload.grade_level)
    if payload.chapter:
        query = query.filter(Question.chapter == payload.chapter)
    if payload.lesson:
        query = query.filter(Question.lesson == payload.lesson)
    if payload.topic:
        query = query.filter(Question.topic == payload.topic)

    if payload.filter_type == "missing_only":
        query = query.filter(
            ((Question.question_type == "MULTIPLE_CHOICE") & Question.correct_option.is_(None)) |
            ((Question.question_type == "SHORT_ANSWER") & ((Question.correct_answer.is_(None)) | (Question.correct_answer == ""))) |
            (Question.correct_option.is_(None))
        )
    elif payload.filter_type == "incorrect_only":
        query = query.filter(
            Question.ai_verified == True,
            (Question.ai_feedback["is_correct"].as_boolean() == False) | (Question.ai_feedback.is_(None))
        )
    elif payload.filter_type == "missing_or_incorrect":
        query = query.filter(
            ((Question.question_type == "MULTIPLE_CHOICE") & Question.correct_option.is_(None)) |
            ((Question.question_type == "SHORT_ANSWER") & ((Question.correct_answer.is_(None)) | (Question.correct_answer == ""))) |
            (Question.correct_option.is_(None)) |
            (Question.ai_verified == False) |
            ((Question.ai_verified == True) & (Question.ai_feedback["is_correct"].as_boolean() == False))
        )

    safe_limit = min(payload.limit or 15, 30)
    query = query.order_by(Question.id.asc()).limit(safe_limit)
    res = await db.execute(query)
    questions = res.scalars().all()

    if not questions:
        return {
            "success": True,
            "total_scanned": 0,
            "fixed_count": 0,
            "filled_missing_count": 0,
            "kept_count": 0,
            "details": []
        }

    sem = asyncio.Semaphore(3)

    async def process_one(q):
        async with sem:
            try:
                res_ai = await asyncio.to_thread(
                    ai_service.audit_and_fix_question,
                    content=q.content,
                    question_type=q.question_type,
                    options=q.options,
                    correct_option=q.correct_option,
                    correct_answer=q.correct_answer,
                    sub_questions=q.sub_questions,
                    sample_solution=q.sample_solution,
                    explanation=q.explanation,
                    subject=q.subject or "Toán",
                    grade_level=q.grade_level or 10
                )
                return q, res_ai, None
            except Exception as e:
                return q, None, str(e)

    items = await asyncio.gather(*(process_one(q) for q in questions))

    fixed_count = 0
    filled_missing_count = 0
    kept_count = 0
    failed_count = 0
    details = []

    for q, res_ai, err in items:
        if err or not res_ai:
            failed_count += 1
            details.append({
                "question_id": q.id,
                "code": q.code or f"ID-{q.id}",
                "content": q.content[:120] if q.content else "",
                "action": "ERROR",
                "reason": err or "Lỗi không xác định"
            })
            continue

        act = res_ai.get("action", "KEEP")
        changed = res_ai.get("changed", False)

        old_display = None
        new_display = None
        if q.question_type == "MULTIPLE_CHOICE":
            if q.correct_option is not None and q.options and 0 <= q.correct_option < len(q.options):
                old_display = f"{chr(65 + q.correct_option)}: {q.options[q.correct_option]}"
            elif q.correct_option is not None:
                old_display = f"Phương án {chr(65 + q.correct_option)}"
            else:
                old_display = "Chưa có đáp án"

            s_opt = res_ai.get("suggested_correct_option")
            if s_opt is not None and q.options and 0 <= s_opt < len(q.options):
                new_display = f"{chr(65 + s_opt)}: {q.options[s_opt]}"
            elif s_opt is not None:
                new_display = f"Phương án {chr(65 + s_opt)}"
        elif q.question_type == "SHORT_ANSWER":
            old_display = q.correct_answer or "Chưa có đáp án"
            new_display = res_ai.get("suggested_correct_answer")

        if act == "SET_MISSING_ANSWER":
            filled_missing_count += 1
        elif act == "FIX_ANSWER":
            fixed_count += 1
        else:
            kept_count += 1

        details.append({
            "question_id": q.id,
            "code": q.code or f"ID-{q.id}",
            "content": q.content[:120] if q.content else "",
            "action": act,
            "old_display": old_display,
            "new_display": new_display,
            "reason": res_ai.get("reason"),
            "suggested_explanation": res_ai.get("suggested_explanation")
        })

        if payload.auto_apply and changed:
            old_data = {
                "correct_option": q.correct_option,
                "correct_answer": q.correct_answer,
                "explanation": q.explanation
            }
            if q.question_type == "MULTIPLE_CHOICE" and res_ai.get("suggested_correct_option") is not None:
                q.correct_option = res_ai["suggested_correct_option"]
            if q.question_type == "SHORT_ANSWER" and res_ai.get("suggested_correct_answer") is not None:
                q.correct_answer = res_ai["suggested_correct_answer"]
            if q.question_type == "TRUE_FALSE" and res_ai.get("suggested_sub_questions"):
                q.sub_questions = res_ai["suggested_sub_questions"]
            if res_ai.get("suggested_explanation"):
                q.explanation = res_ai["suggested_explanation"]

            q.ai_verified = True
            q.ai_feedback = res_ai

            audit = QuestionAuditLog(
                question_id=q.id,
                action="AI_AUTO_FIX",
                modified_by_id=current_user.id,
                old_data=old_data,
                new_data={
                    "correct_option": q.correct_option,
                    "correct_answer": q.correct_answer,
                    "explanation": q.explanation,
                    "reason": res_ai.get("reason"),
                    "action": act
                }
            )
            db.add(audit)
        elif payload.auto_apply:
            q.ai_verified = True
            q.ai_feedback = res_ai

    if payload.auto_apply:
        await db.commit()

    return {
        "success": True,
        "total_scanned": len(questions),
        "fixed_count": fixed_count,
        "filled_missing_count": filled_missing_count,
        "kept_count": kept_count,
        "failed_count": failed_count,
        "details": details
    }


@router.post("/extract-from-file")
async def extract_questions_from_file_endpoint(
    file: UploadFile = File(...),
    subject: Optional[str] = Form("Toán"),
    grade_level: Optional[int] = Form(10),
    chapter: Optional[str] = Form(None),
    use_ai: Optional[bool] = Form(True),
    current_user: User = Depends(get_current_user),
    ai_service: AIService = Depends(get_ai_service)
):
    """
    Tự động trích xuất danh sách câu hỏi từ tài liệu Word (.docx, .doc), PDF (.pdf), Markdown (.md), hoặc Text (.txt).
    Có thể dùng AI phân tích sâu hoặc phân tích nhanh theo quy tắc regex.
    """
    if current_user.role != "TEACHER":
        raise HTTPException(status_code=403, detail="Chỉ giáo viên mới có quyền sử dụng tính năng trích xuất câu hỏi.")

    filename = file.filename or "unknown.txt"
    valid_exts = ('.docx', '.doc', '.pdf', '.md', '.markdown', '.txt')
    if not filename.lower().endswith(valid_exts):
        raise HTTPException(
            status_code=400,
            detail=f"Định dạng tệp không được hỗ trợ. Vui lòng tải lên tệp: {', '.join(valid_exts)}"
        )

    try:
        content_bytes = await file.read()
        if len(content_bytes) == 0:
            raise HTTPException(status_code=400, detail="Tệp tin tải lên bị rỗng.")

        if len(content_bytes) > 25 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Dung lượng tệp vượt quá giới hạn 25MB.")

        # Trích xuất văn bản thô
        raw_text = extract_text_from_file(content_bytes, filename)
        if not raw_text or not raw_text.strip():
            raise HTTPException(status_code=400, detail="Không thể đọc được nội dung văn bản từ tệp. Vui lòng kiểm tra lại tệp.")

        # Phân tích câu hỏi
        if use_ai:
            questions = await asyncio.to_thread(
                ai_service.extract_questions_from_document,
                raw_text=raw_text,
                default_subject=subject or "Toán",
                default_grade_level=grade_level or 10,
                default_chapter=chapter
            )
        else:
            questions = parse_questions_with_rules(
                text=raw_text,
                default_subject=subject or "Toán",
                default_grade_level=grade_level or 10,
                default_chapter=chapter
            )

        return {
            "success": True,
            "filename": filename,
            "total_chars": len(raw_text),
            "text_preview": raw_text[:300].strip(),
            "total_questions": len(questions),
            "questions": questions
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi xử lý tệp: {str(e)}")


class AnalyzeDifficultyRequest(BaseModel):
    question_id: Optional[int] = None
    content: Optional[str] = None
    question_type: Optional[str] = "MULTIPLE_CHOICE"
    options: Optional[List[Any]] = None
    subject: Optional[str] = "Toán"
    grade_level: Optional[int] = 10
    chapter: Optional[str] = None
    auto_apply: bool = False

@router.post("/analyze-difficulty", summary="Tự động phân tích độ khó câu hỏi bằng AI")
async def analyze_difficulty_endpoint(
    payload: AnalyzeDifficultyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    ai_service: AIService = Depends(get_ai_service)
):
    from app.models.question import Question

    target_q = None
    if payload.question_id:
        target_q = await db.get(Question, payload.question_id)
        if not target_q:
            raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")

    content = target_q.content if target_q else payload.content
    if not content:
        raise HTTPException(status_code=400, detail="Thiếu nội dung câu hỏi")

    q_type = target_q.question_type if target_q else payload.question_type
    options = target_q.options if target_q else payload.options
    subject = (target_q.subject if target_q else payload.subject) or "Toán"
    grade_level = (target_q.grade_level if target_q else payload.grade_level) or 10
    chapter = (target_q.chapter if target_q else payload.chapter)

    try:
        res = await asyncio.to_thread(
            ai_service.analyze_question_difficulty,
            content=content,
            question_type=q_type or "MULTIPLE_CHOICE",
            options=options,
            subject=subject,
            grade_level=grade_level,
            chapter=chapter
        )

        old_difficulty = target_q.difficulty if target_q else None
        new_difficulty = res.get("difficulty", "THONG_HIEU")

        if target_q and payload.auto_apply:
            if current_user.role != "TEACHER":
                raise HTTPException(status_code=403, detail="Chỉ giáo viên mới có quyền tự động lưu độ khó vào ngân hàng câu hỏi.")
            target_q.difficulty = new_difficulty
            await db.commit()
            await db.refresh(target_q)

        return {
            "success": True,
            "question_id": target_q.id if target_q else None,
            "old_difficulty": old_difficulty,
            "difficulty": new_difficulty,
            "confidence": res.get("confidence", 0.85),
            "reasoning": res.get("reasoning", ""),
            "cognitive_skills": res.get("cognitive_skills", []),
            "estimated_time_minutes": res.get("estimated_time_minutes", 2),
            "applied": bool(target_q and payload.auto_apply)
        }
    except Exception as e:
        logger.error(f"Error in analyze-difficulty endpoint: {e}")
        return {
            "success": False,
            "difficulty": "THONG_HIEU",
            "error": str(e)
        }


class AnalyzeDifficultyBatchRequest(BaseModel):
    subject: Optional[str] = None
    grade_level: Optional[int] = None
    chapter: Optional[str] = None
    limit: int = 15
    auto_apply: bool = True

@router.post("/analyze-difficulty-batch", summary="Phân tích và gán độ khó hàng loạt câu hỏi")
async def analyze_difficulty_batch_endpoint(
    payload: AnalyzeDifficultyBatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    ai_service: AIService = Depends(get_ai_service)
):
    if current_user.role != "TEACHER":
        raise HTTPException(status_code=403, detail="Chỉ giáo viên mới có quyền thực hiện thao tác này.")

    from app.models.question import Question

    query = select(Question).filter((Question.status != "EXAM_CLONE") | (Question.status.is_(None)))
    if payload.subject:
        query = query.filter(Question.subject == payload.subject)
    if payload.grade_level:
        query = query.filter(Question.grade_level == payload.grade_level)
    if payload.chapter:
        query = query.filter(Question.chapter == payload.chapter)

    safe_limit = min(payload.limit or 15, 30)
    query = query.order_by(Question.id.asc()).limit(safe_limit)
    res = await db.execute(query)
    questions = res.scalars().all()

    if not questions:
        return {"success": True, "total": 0, "results": []}

    sem = asyncio.Semaphore(3)

    async def analyze_one(q):
        async with sem:
            try:
                r = await asyncio.to_thread(
                    ai_service.analyze_question_difficulty,
                    content=q.content,
                    question_type=q.question_type or "MULTIPLE_CHOICE",
                    options=q.options,
                    subject=q.subject or "Toán",
                    grade_level=q.grade_level or 10,
                    chapter=q.chapter
                )
                return q, r, None
            except Exception as e:
                return q, None, str(e)

    items = await asyncio.gather(*(analyze_one(q) for q in questions))
    results = []

    for q, res_ai, err in items:
        if err or not res_ai:
            results.append({
                "question_id": q.id,
                "code": q.code,
                "success": False,
                "error": err
            })
            continue

        pred_diff = res_ai.get("difficulty", "THONG_HIEU")
        old_diff = q.difficulty

        if payload.auto_apply:
            q.difficulty = pred_diff

        results.append({
            "question_id": q.id,
            "code": q.code,
            "old_difficulty": old_diff,
            "difficulty": pred_diff,
            "confidence": res_ai.get("confidence", 0.85),
            "reasoning": res_ai.get("reasoning", ""),
            "success": True
        })

    if payload.auto_apply:
        await db.commit()

    return {
        "success": True,
        "total": len(questions),
        "applied": payload.auto_apply,
        "results": results
    }

