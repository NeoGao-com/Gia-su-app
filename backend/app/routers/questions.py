import logging
import io
import json
import random
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from pydantic import BaseModel

from app.database import get_db, redis_client
from app.models.question import Question, QuestionCategory, CategoryAuditLog
from app.models.user import User
from app.schemas.question import QuestionCreate, QuestionResponse, QuestionUpdate
from app.core.security import get_current_user, get_current_teacher
from app.services.id_generator import generate_question_code

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/questions", tags=["questions"])

async def invalidate_questions_cache():
    try:
        keys = await redis_client.keys("questions:*")
        if keys:
            await redis_client.delete(*keys)
    except Exception as e:
        logger.error(f"Redis cache invalidate error: {str(e)}")

@router.post("", response_model=QuestionResponse, summary="Tạo câu hỏi mới")
@router.post("/", response_model=QuestionResponse, include_in_schema=False)
async def create_question(
    request: Request,
    question_in: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    try:
        code = await generate_question_code(
            db,
            question_in.subject,
            question_in.grade_level,
            question_in.question_type
        )
        question = Question(
            **question_in.model_dump(),
            code=code,
            created_by_id=current_user.id
        )
        db.add(question)
        await db.commit()
        await db.refresh(question)
        await invalidate_questions_cache()
        
        res = QuestionResponse.model_validate(question).model_dump(mode="json")
        res["creator_name"] = current_user.full_name or current_user.email
        return res
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating question: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi tạo câu hỏi: {str(e)}"
        )

@router.get("/tree/structure", summary="Lấy cây thư mục Môn > Lớp > Chương > Bài > Dạng bài")
async def get_tree_structure(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        cat_query = select(QuestionCategory).filter(QuestionCategory.is_deleted == False)
        cat_res = await db.execute(cat_query)
        categories = cat_res.scalars().all()
        tree = {}
        for c in categories:
            subj = c.subject or "Toán"
            grade = f"Khối {c.grade_level}" if c.grade_level else "Khối 10"
            chap = c.chapter or "Chương I"
            less = c.lesson or "Bài 1"
            top = c.topic or "Dạng 1"
            if subj not in tree: tree[subj] = {}
            if grade not in tree[subj]: tree[subj][grade] = {}
            if chap not in tree[subj][grade]: tree[subj][grade][chap] = {}
            if less not in tree[subj][grade][chap]: tree[subj][grade][chap][less] = {}
            if top not in tree[subj][grade][chap][less]: tree[subj][grade][chap][less][top] = 0
        
        q_query = select(Question.subject, Question.grade_level, Question.chapter, Question.lesson, Question.topic, func.count(Question.id).label("count")).group_by(Question.subject, Question.grade_level, Question.chapter, Question.lesson, Question.topic)
        q_res = await db.execute(q_query)
        for r in q_res.all():
            subj, grade, chap, less, top, cnt = r
            grade_str = f"Khối {grade}"
            if subj not in tree: tree[subj] = {}
            if grade_str not in tree[subj]: tree[subj][grade_str] = {}
            if chap not in tree[subj][grade_str]: tree[subj][grade_str][chap] = {}
            if less not in tree[subj][grade_str][chap]: tree[subj][grade_str][chap][less] = {}
            tree[subj][grade_str][chap][less][top] = cnt
        return tree
    except Exception as e:
        logger.error(f"Error fetching tree structure: {str(e)}")
        return {}

@router.post("/categories", summary="Tạo thư mục con mới trên Cây kiến thức")
async def create_category(
    category_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    try:
        category = QuestionCategory(
            subject=category_data.get("subject", "Toán"),
            grade_level=int(category_data.get("grade_level", 10)),
            chapter=category_data.get("chapter"),
            lesson=category_data.get("lesson"),
            topic=category_data.get("topic"),
            created_by_id=current_user.id
        )
        db.add(category)
        await db.commit()
        await db.refresh(category)
        return {"message": "Tạo thư mục con thành công", "id": category.id}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi khi tạo thư mục: {str(e)}")

class CategoryDeleteRequest(BaseModel):
    subject: Optional[str] = None
    grade_level: Optional[int] = None
    chapter: Optional[str] = None
    lesson: Optional[str] = None
    topic: Optional[str] = None

@router.delete("/categories", summary="Xóa danh mục kiến thức kèm câu hỏi bên trong")
async def delete_category(
    payload: CategoryDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    try:
        # 1. Xóa mềm các danh mục khớp taxonomy (subject/grade/chapter/lesson/topic)
        query = select(QuestionCategory).filter(QuestionCategory.is_deleted == False)
        if payload.subject: query = query.filter(QuestionCategory.subject == payload.subject)
        if payload.grade_level is not None: query = query.filter(QuestionCategory.grade_level == payload.grade_level)
        if payload.chapter: query = query.filter(QuestionCategory.chapter == payload.chapter)
        if payload.lesson: query = query.filter(QuestionCategory.lesson == payload.lesson)
        if payload.topic: query = query.filter(QuestionCategory.topic == payload.topic)
        res = await db.execute(query)
        categories = res.scalars().all()
        # 2. Xóa cứng các câu hỏi thuộc cùng taxonomy (đồng bộ với nút xóa từng câu hỏi)
        q_query = select(Question)
        if payload.subject: q_query = q_query.filter(Question.subject == payload.subject)
        if payload.grade_level is not None: q_query = q_query.filter(Question.grade_level == payload.grade_level)
        if payload.chapter: q_query = q_query.filter(Question.chapter == payload.chapter)
        if payload.lesson: q_query = q_query.filter(Question.lesson == payload.lesson)
        if payload.topic: q_query = q_query.filter(Question.topic == payload.topic)
        q_res = await db.execute(q_query)
        questions = q_res.scalars().all()
        for q in questions:
            await db.delete(q)
        for cat in categories:
            cat.is_deleted = True
            audit = CategoryAuditLog(category_id=cat.id, action="DELETE", user_id=current_user.id, details=payload.model_dump())
            db.add(audit)
        await db.commit()
        await invalidate_questions_cache()
        return {"message": f"Đã xóa danh mục và {len(questions)} câu hỏi thành công"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi khi xóa danh mục: {str(e)}")

@router.get("", response_model=dict, summary="Lấy danh sách câu hỏi")
@router.get("/", response_model=dict, include_in_schema=False)
async def get_questions(
    subject: Optional[str] = None, grade_level: Optional[int] = None, chapter: Optional[str] = None,
    lesson: Optional[str] = None, topic: Optional[str] = None, difficulty: Optional[str] = None,
    question_type: Optional[str] = None, search: Optional[str] = None, page: int = 1, limit: int = 20,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    offset = (page - 1) * limit
    try:
        query = select(Question)
        if subject: query = query.filter(Question.subject == subject)
        if grade_level is not None: query = query.filter(Question.grade_level == grade_level)
        if chapter: query = query.filter(Question.chapter == chapter)
        if lesson: query = query.filter(Question.lesson == lesson)
        if topic: query = query.filter(Question.topic == topic)
        if search: query = query.filter(Question.content.ilike(f"%{search}%"))
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar() or 0
        res = await db.execute(query.order_by(Question.id.desc()).offset(offset).limit(limit))
        questions = res.scalars().all()
        items = [QuestionResponse.model_validate(q).model_dump(mode="json") for q in questions]
        return {"total": total, "items": items, "page": page, "limit": limit}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class QuestionImportRequest(BaseModel):
    questions: List[Dict[str, Any]]

@router.post("/import-json", summary="Nhập hàng loạt câu hỏi từ JSON")
async def import_questions_json(
    payload: QuestionImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    if not payload.questions:
        raise HTTPException(status_code=400, detail="Danh sách câu hỏi rỗng")
    if len(payload.questions) > 500:
        raise HTTPException(status_code=400, detail="Tối đa 500 câu hỏi mỗi lần nhập")
    created = 0
    errors: List[str] = []
    for idx, raw in enumerate(payload.questions):
        try:
            q_in = QuestionCreate(**raw)
            code = await generate_question_code(db, q_in.subject, q_in.grade_level, q_in.question_type)
            db.add(Question(**q_in.model_dump(), code=code, created_by_id=current_user.id))
            await db.flush()  # đảm bảo câu kế tiếp nhìn thấy code mới trong session
            created += 1
        except Exception as e:
            errors.append(f"Câu {idx + 1}: {str(e)}")
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu câu hỏi: {str(e)}")
    await invalidate_questions_cache()
    msg = f"Đã nhập {created}/{len(payload.questions)} câu hỏi thành công"
    if errors:
        msg += f" ({len(errors)} lỗi)"
    return {"message": msg, "created": created, "total": len(payload.questions), "errors": errors[:20]}

@router.put("/{question_id}", response_model=QuestionResponse)
async def update_question(question_id: int, q_in: QuestionUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_teacher)):
    q = await db.get(Question, question_id)
    if not q: raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")
    for k, v in q_in.model_dump(exclude_unset=True).items(): setattr(q, k, v)
    await db.commit()
    await db.refresh(q)
    await invalidate_questions_cache()
    return q

@router.delete("/{question_id}")
async def delete_question_item(question_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_teacher)):
    q = await db.get(Question, question_id)
    if not q: raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")
    await db.delete(q)
    await db.commit()
    await invalidate_questions_cache()
    return {"message": "Xóa câu hỏi thành công"}

import os, uuid, subprocess
from fastapi import UploadFile, File
UPLOAD_DIR = "backend/static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Standardized upload route: redirecting to secure upload module
from app.routers.upload import upload_image as secure_upload_image

@router.post("/upload-image")
async def upload_image(request: Request, file: UploadFile = File(...), current_user: User = Depends(get_current_teacher)):
    return await secure_upload_image(request=request, file=file, current_user=current_user)

# Unused RCE endpoint generate-image-py removed for security. Use upload-image endpoint.
