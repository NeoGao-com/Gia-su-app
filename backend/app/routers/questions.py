import logging
import io
import json
import random
import unicodedata
import re
from typing import List, Optional, Dict, Any, Tuple, Set
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, union, or_, and_
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
    try:
        from app.routers.analytics import invalidate_analytics_cache
        await invalidate_analytics_cache()
    except Exception:
        pass

@router.post("", response_model=QuestionResponse, summary="Tạo câu hỏi mới")
@router.post("/", response_model=QuestionResponse, include_in_schema=False)
async def create_question(
    request: Request,
    question_in: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    try:
        q_data = question_in.model_dump()
        subj = q_data.get("subject", "Toán")
        gr = q_data.get("grade_level", 10)
        c_maps, l_maps, _, _ = await load_taxonomy_lookup_maps(db, {(subj, gr)})
        c_map = c_maps.get((subj, gr), {})
        l_map = l_maps.get((subj, gr), {})

        if q_data.get("chapter"):
            c_k = get_canonical_key(q_data["chapter"])
            if c_k in c_map:
                q_data["chapter"] = c_map[c_k]
            c_res_ch = get_canonical_key(q_data["chapter"])
            if q_data.get("lesson"):
                l_k = get_canonical_key(q_data["lesson"])
                if (c_res_ch, l_k) in l_map:
                    q_data["lesson"] = l_map[(c_res_ch, l_k)]

        code = await generate_question_code(
            db,
            q_data.get("subject", "Toán"),
            q_data.get("grade_level", 10),
            q_data.get("question_type")
        )
        question = Question(
            **q_data,
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
        cache_key = "questions:tree_structure"
        cached_tree = await redis_client.get(cache_key)
        if cached_tree:
            try:
                return json.loads(cached_tree)
            except Exception:
                pass

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
        
        q_query = select(
            Question.subject,
            Question.grade_level,
            Question.chapter,
            Question.lesson,
            Question.topic,
            func.count(Question.id).label("count")
        ).filter(
            (Question.status != "EXAM_CLONE") | (Question.status.is_(None))
        ).group_by(
            Question.subject,
            Question.grade_level,
            Question.chapter,
            Question.lesson,
            Question.topic
        )
        q_res = await db.execute(q_query)
        for r in q_res.all():
            subj, grade, chap, less, top, cnt = r
            subj_str = (subj or "Toán").strip()
            grade_str = f"Khối {grade}" if grade else "Khối 10"
            chap_str = (chap or "Chương chung").strip()
            less_str = (less or "Bài chung").strip()
            top_str = (top or "Dạng chung").strip()

            if chap_str.lower() in ("null", "none", ""): chap_str = "Chương chung"
            if less_str.lower() in ("null", "none", ""): less_str = "Bài chung"
            if top_str.lower() in ("null", "none", ""): top_str = "Dạng chung"

            if subj_str not in tree: tree[subj_str] = {}
            if grade_str not in tree[subj_str]: tree[subj_str][grade_str] = {}
            if chap_str not in tree[subj_str][grade_str]: tree[subj_str][grade_str][chap_str] = {}
            if less_str not in tree[subj_str][grade_str][chap_str]: tree[subj_str][grade_str][chap_str][less_str] = {}
            tree[subj_str][grade_str][chap_str][less_str][top_str] = cnt
        
        await redis_client.set(cache_key, json.dumps(tree), ex=1800)
        return tree
    except Exception as e:
        logger.error(f"Error fetching tree structure: {str(e)}")
        return {}

@router.get("/stats", summary="Thống kê số lượng câu hỏi chi tiết theo Môn, Khối, Chương, Bài, Dạng bài và Độ khó từ DB")
async def get_question_stats(
    subject: Optional[str] = None,
    grade_level: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # Lấy danh sách môn và khối có trong DB
        subjects_res = await db.execute(select(Question.subject).distinct())
        subjects = [s for s in subjects_res.scalars().all() if s]

        grades_res = await db.execute(select(Question.grade_level).distinct())
        grades = [g for g in grades_res.scalars().all() if g is not None]

        query = select(
            Question.subject,
            Question.grade_level,
            Question.chapter,
            Question.lesson,
            Question.topic,
            Question.difficulty,
            func.count(Question.id).label("count")
        ).filter(
            (Question.status != "EXAM_CLONE") | (Question.status.is_(None))
        ).group_by(
            Question.subject,
            Question.grade_level,
            Question.chapter,
            Question.lesson,
            Question.topic,
            Question.difficulty
        )

        if subject:
            query = query.filter(Question.subject == subject)
        if grade_level is not None:
            query = query.filter(Question.grade_level == grade_level)

        res = await db.execute(query)
        rows = res.all()

        total_questions = 0
        # Cấu trúc: { subject: { grade: { chapter: { lesson: { topic: { difficulty: count } } } } } }
        hierarchy: Dict[str, Any] = {}

        for subj, grade, chap, less, top, diff, cnt in rows:
            if not subj:
                subj = "Khác"
            if grade is None:
                grade = 10
            if not chap:
                chap = "Chưa phân loại"
            if not less:
                less = "Chưa phân loại"
            if not top:
                top = "Chưa phân loại"
            if not diff:
                diff = "THONG_HIEU"

            total_questions += cnt

            if subj not in hierarchy:
                hierarchy[subj] = {}
            grade_key = str(grade)
            if grade_key not in hierarchy[subj]:
                hierarchy[subj][grade_key] = {}
            if chap not in hierarchy[subj][grade_key]:
                hierarchy[subj][grade_key][chap] = {}
            if less not in hierarchy[subj][grade_key][chap]:
                hierarchy[subj][grade_key][chap][less] = {}
            if top not in hierarchy[subj][grade_key][chap][less]:
                hierarchy[subj][grade_key][chap][less][top] = {}

            hierarchy[subj][grade_key][chap][less][top][diff] = cnt

        return {
            "subjects": subjects,
            "grades": grades,
            "total_questions": total_questions,
            "hierarchy": hierarchy
        }
    except Exception as e:
        logger.error(f"Error fetching question stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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

class CategoryMoveRequest(BaseModel):
    source: CategoryDeleteRequest
    target: CategoryDeleteRequest

@router.put("/categories/move", summary="Di chuyển danh mục và các câu hỏi sang vị trí mới")
async def move_category(
    payload: CategoryMoveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    try:
        cat_query = select(QuestionCategory).filter(QuestionCategory.is_deleted == False)
        if payload.source.subject: cat_query = cat_query.filter(QuestionCategory.subject == payload.source.subject)
        if payload.source.grade_level is not None: cat_query = cat_query.filter(QuestionCategory.grade_level == payload.source.grade_level)
        if payload.source.chapter: cat_query = cat_query.filter(QuestionCategory.chapter == payload.source.chapter)
        if payload.source.lesson: cat_query = cat_query.filter(QuestionCategory.lesson == payload.source.lesson)
        if payload.source.topic: cat_query = cat_query.filter(QuestionCategory.topic == payload.source.topic)
        cats = (await db.execute(cat_query)).scalars().all()

        source_cat_ids = {cat.id for cat in cats}

        # Query other non-deleted categories to avoid duplicate taxonomy rows after move/merge
        other_cats_query = select(QuestionCategory).filter(QuestionCategory.is_deleted == False)
        if source_cat_ids:
            other_cats_query = other_cats_query.filter(~QuestionCategory.id.in_(source_cat_ids))
        other_cats = (await db.execute(other_cats_query)).scalars().all()
        seen_taxonomy = {
            (c.subject, c.grade_level, c.chapter, c.lesson, c.topic)
            for c in other_cats
        }

        # Build existing lesson canonical map for target chapter if merging at chapter level
        existing_target_lessons: Dict[str, str] = {}
        if payload.target.chapter is not None and payload.target.lesson is None:
            target_ch_name = payload.target.chapter
            target_s = payload.target.subject if payload.target.subject is not None else payload.source.subject
            target_g = payload.target.grade_level if payload.target.grade_level is not None else payload.source.grade_level

            for c in other_cats:
                if c.chapter == target_ch_name and c.lesson:
                    c_k = get_canonical_key(c.lesson)
                    if c_k and c_k not in existing_target_lessons:
                        existing_target_lessons[c_k] = c.lesson

            q_less_stmt = select(Question.lesson).filter(
                Question.chapter == target_ch_name,
                (Question.status != "EXAM_CLONE") | (Question.status.is_(None))
            )
            if target_s: q_less_stmt = q_less_stmt.filter(Question.subject == target_s)
            if target_g is not None: q_less_stmt = q_less_stmt.filter(Question.grade_level == target_g)
            q_less_res = await db.execute(q_less_stmt)
            for (l_val,) in q_less_res.all():
                if l_val:
                    c_k = get_canonical_key(l_val)
                    if c_k and c_k not in existing_target_lessons:
                        existing_target_lessons[c_k] = l_val

        for cat in cats:
            target_subject = payload.target.subject if payload.target.subject is not None else cat.subject
            target_grade = payload.target.grade_level if payload.target.grade_level is not None else cat.grade_level
            target_chapter = payload.target.chapter if payload.target.chapter is not None else cat.chapter
            target_lesson = payload.target.lesson if payload.target.lesson is not None else cat.lesson
            target_topic = payload.target.topic if payload.target.topic is not None else cat.topic

            if payload.target.chapter is not None and payload.target.lesson is None and target_lesson:
                c_k = get_canonical_key(target_lesson)
                if c_k in existing_target_lessons:
                    target_lesson = existing_target_lessons[c_k]
                else:
                    existing_target_lessons[c_k] = target_lesson

            target_key = (target_subject, target_grade, target_chapter, target_lesson, target_topic)

            if target_key in seen_taxonomy:
                # Deduplicate: soft-delete redundant category row
                cat.is_deleted = True
                audit = CategoryAuditLog(
                    category_id=cat.id,
                    action="MOVE_DEDUPLICATE",
                    user_id=current_user.id,
                    details={"source": payload.source.model_dump(), "target": payload.target.model_dump(), "deduplicated_into": list(target_key)}
                )
                db.add(audit)
            else:
                cat.subject = target_subject
                cat.grade_level = target_grade
                cat.chapter = target_chapter
                cat.lesson = target_lesson
                cat.topic = target_topic
                seen_taxonomy.add(target_key)

                audit = CategoryAuditLog(
                    category_id=cat.id,
                    action="MOVE",
                    user_id=current_user.id,
                    details=payload.model_dump()
                )
                db.add(audit)

        q_query = select(Question)
        if payload.source.subject: q_query = q_query.filter(Question.subject == payload.source.subject)
        if payload.source.grade_level is not None: q_query = q_query.filter(Question.grade_level == payload.source.grade_level)
        if payload.source.chapter: q_query = q_query.filter(Question.chapter == payload.source.chapter)
        if payload.source.lesson: q_query = q_query.filter(Question.lesson == payload.source.lesson)
        if payload.source.topic: q_query = q_query.filter(Question.topic == payload.source.topic)
        questions = (await db.execute(q_query)).scalars().all()
        for q in questions:
            if payload.target.subject is not None: q.subject = payload.target.subject
            if payload.target.grade_level is not None: q.grade_level = payload.target.grade_level
            if payload.target.chapter is not None: q.chapter = payload.target.chapter
            if payload.target.lesson is not None:
                q.lesson = payload.target.lesson
            elif q.lesson and payload.target.chapter is not None and existing_target_lessons:
                c_k = get_canonical_key(q.lesson)
                if c_k in existing_target_lessons:
                    q.lesson = existing_target_lessons[c_k]
            if payload.target.topic is not None: q.topic = payload.target.topic

        await db.commit()
        await invalidate_questions_cache()
        return {"message": f"Đã di chuyển danh mục và {len(questions)} câu hỏi thành công"}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error moving category: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi di chuyển danh mục: {str(e)}")

@router.get("", response_model=dict, summary="Lấy danh sách câu hỏi")
@router.get("/", response_model=dict, include_in_schema=False)
async def get_questions(
    subject: Optional[str] = None, grade_level: Optional[int] = None, chapter: Optional[str] = None,
    lesson: Optional[str] = None, topic: Optional[str] = None, difficulty: Optional[str] = None,
    question_type: Optional[str] = None, search: Optional[str] = None, page: int = 1, limit: int = 20,
    ai_status: Optional[str] = None,
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    offset = (page - 1) * limit
    try:
        query = select(Question).filter((Question.status != "EXAM_CLONE") | (Question.status.is_(None)))
        if subject: query = query.filter(Question.subject == subject)
        if grade_level is not None: query = query.filter(Question.grade_level == grade_level)
        if chapter:
            if chapter in ("Chương chung", "null", "None"):
                query = query.filter((Question.chapter == chapter) | (Question.chapter.is_(None)) | (Question.chapter == "") | (Question.chapter == "null"))
            else:
                query = query.filter(Question.chapter == chapter)
        if lesson:
            if lesson in ("Bài chung", "null", "None"):
                query = query.filter((Question.lesson == lesson) | (Question.lesson.is_(None)) | (Question.lesson == "") | (Question.lesson == "null"))
            else:
                query = query.filter(Question.lesson == lesson)
        if topic:
            if topic in ("Dạng chung", "null", "None"):
                query = query.filter((Question.topic == topic) | (Question.topic.is_(None)) | (Question.topic == "") | (Question.topic == "null"))
            else:
                query = query.filter(Question.topic == topic)
        if difficulty: query = query.filter(Question.difficulty == difficulty)
        if question_type: query = query.filter(Question.question_type == question_type)
        if search: query = query.filter(Question.content.ilike(f"%{search}%"))
        if ai_status == "unverified": query = query.filter(Question.ai_verified == False)
        elif ai_status == "correct": query = query.filter(Question.ai_verified == True, Question.ai_feedback["is_correct"].as_boolean() == True)
        elif ai_status == "incorrect": query = query.filter(Question.ai_verified == True, (Question.ai_feedback["is_correct"].as_boolean() == False) | (Question.ai_feedback.is_(None)))
        count_query = select(func.count()).select_from(query.subquery())
        total = (await db.execute(count_query)).scalar() or 0
        res = await db.execute(query.order_by(Question.id.desc()).offset(offset).limit(limit))
        questions = res.scalars().all()
        items = [QuestionResponse.model_validate(q).model_dump(mode="json") for q in questions]
        return {"total": total, "items": items, "page": page, "limit": limit}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def get_canonical_key(name: str) -> str:
    r"""
    Chuẩn hóa thông minh tên Chương / Bài học thành canonical key:
    - Unicode NFC normalize (unicodedata.normalize('NFC', name)) và strip().lower().
    - Collapse whitespace: re.sub(r'\s+', ' ', s).
    - Strip leading prefix using safe regex: r'^(?:chương|phần|chuyên đề|chủ đề|bài)\s*(?:[0-9]+|[ivxlcdm]+)?\s*[:.\-–—]\s*'
    - Strip leading/trailing punctuation ' :.-–—,;'.
    - If core is empty, return s. Do NOT strip numbers from "Ôn tập chương 1" or "Bài tập cuối chương 2".
    """
    if not name or not str(name).strip():
        return ""
    s = unicodedata.normalize('NFC', str(name)).strip().lower()
    s = re.sub(r'\s+', ' ', s)
    prefix_pattern = r'^(?:chương|phần|chuyên đề|chủ đề|bài)\s*(?:[0-9]+|[ivxlcdm]+)?\s*[:.\-–—]\s*'
    core = re.sub(prefix_pattern, '', s)
    core = core.strip(" :.-–—,;")
    return core if core else s

async def load_taxonomy_lookup_maps(
    db: AsyncSession,
    pairs: Set[Tuple[str, int]]
) -> Tuple[Dict[Tuple[str, int], Dict[str, str]], Dict[Tuple[str, int], Dict[Tuple[str, str], str]], Set[Tuple[str, int, str]], Set[Tuple[str, int, str, str]]]:
    """
    Pre-load existing (chapter, lesson) taxonomy from Question and QuestionCategory
    for (subject, grade_level) in one query.
    Build lookup maps: chapter_map (canonical_key -> db_original_name), lesson_map ((chapter_canonical, lesson_canonical) -> db_original_name).
    """
    chapter_maps: Dict[Tuple[str, int], Dict[str, str]] = {}
    lesson_maps: Dict[Tuple[str, int], Dict[Tuple[str, str], str]] = {}
    db_chapter_keys: Set[Tuple[str, int, str]] = set()
    db_lesson_keys: Set[Tuple[str, int, str, str]] = set()

    for subj, grade in pairs:
        chapter_maps[(subj, grade)] = {}
        lesson_maps[(subj, grade)] = {}

    cat_stmt = select(
        QuestionCategory.subject,
        QuestionCategory.grade_level,
        QuestionCategory.chapter,
        QuestionCategory.lesson
    ).filter(QuestionCategory.is_deleted == False)

    q_stmt = select(
        Question.subject,
        Question.grade_level,
        Question.chapter,
        Question.lesson
    ).filter((Question.status != "EXAM_CLONE") | (Question.status.is_(None)))

    if pairs:
        cat_conds = [
            and_(QuestionCategory.subject == s, QuestionCategory.grade_level == g)
            for s, g in pairs
        ]
        cat_stmt = cat_stmt.filter(or_(*cat_conds))

        q_conds = [
            and_(Question.subject == s, Question.grade_level == g)
            for s, g in pairs
        ]
        q_stmt = q_stmt.filter(or_(*q_conds))

    combined_stmt = union(cat_stmt, q_stmt)
    res = await db.execute(combined_stmt)
    rows = res.all()

    for subj, grade, chap, less in rows:
        subj_val = (subj or "Toán").strip()
        grade_val = grade if grade is not None else 10
        pair_key = (subj_val, grade_val)
        c_map = chapter_maps.setdefault(pair_key, {})
        l_map = lesson_maps.setdefault(pair_key, {})

        if chap and chap.strip() and chap.strip().lower() not in ("null", "none"):
            chap_clean = chap.strip()
            c_chap = get_canonical_key(chap_clean)
            if c_chap:
                if c_chap not in c_map:
                    c_map[c_chap] = chap_clean
                db_chapter_keys.add((subj_val, grade_val, c_chap))

                if less and less.strip() and less.strip().lower() not in ("null", "none"):
                    less_clean = less.strip()
                    c_less = get_canonical_key(less_clean)
                    if c_less:
                        if (c_chap, c_less) not in l_map:
                            l_map[(c_chap, c_less)] = less_clean
                        db_lesson_keys.add((subj_val, grade_val, c_chap, c_less))
                else:
                    db_lesson_keys.add((subj_val, grade_val, c_chap, get_canonical_key("Bài chung")))
                    db_lesson_keys.add((subj_val, grade_val, c_chap, ""))

    return chapter_maps, lesson_maps, db_chapter_keys, db_lesson_keys

def normalize_question_payload(raw: Dict[str, Any]) -> Dict[str, Any]:
    data = dict(raw)
    
    # 1. Alias mapping
    if "type" in data and "question_type" not in data:
        data["question_type"] = data.pop("type")
    if "answers" in data and "options" not in data:
        data["options"] = data.pop("answers")
    if "level" in data and "difficulty" not in data:
        data["difficulty"] = data.pop("level")

    # Chapter, Lesson, Topic aliases
    if "chuong" in data and not data.get("chapter"):
        data["chapter"] = data.pop("chuong")
    if "bai" in data and not data.get("lesson"):
        data["lesson"] = data.pop("bai")
    elif "bai_hoc" in data and not data.get("lesson"):
        data["lesson"] = data.pop("bai_hoc")
    if "dang" in data and not data.get("topic"):
        data["topic"] = data.pop("dang")
    elif "dang_bai" in data and not data.get("topic"):
        data["topic"] = data.pop("dang_bai")
    elif "chuyen_de" in data and not data.get("topic"):
        data["topic"] = data.pop("chuyen_de")

    # Sanitize and default chapter, lesson, topic
    chap = str(data.get("chapter") or "").strip()
    data["chapter"] = "Chương chung" if chap.lower() in ("null", "none", "") else chap

    less = str(data.get("lesson") or "").strip()
    data["lesson"] = "Bài chung" if less.lower() in ("null", "none", "") else less

    top = str(data.get("topic") or "").strip()
    data["topic"] = "Dạng chung" if top.lower() in ("null", "none", "") else top
        
    # 2. Normalize question_type
    q_type = str(data.get("question_type", "")).strip().upper()
    if q_type in ["TRAC_NGHIEM", "TRẮC NGHIỆM", "MCQ", "MULTIPLE-CHOICE", "CHOICE"]:
        q_type = "MULTIPLE_CHOICE"
    elif q_type in ["DUNG_SAI", "ĐÚNG SAI", "ĐÚNG/SAI", "TRUE-FALSE", "TF"]:
        q_type = "TRUE_FALSE"
    elif q_type in ["DIEN_TU", "ĐIỀN TỪ", "TRA_LOI_NGAN", "TRẢ LỜI NGẮN", "SHORT-ANSWER", "SHORT"]:
        q_type = "SHORT_ANSWER"
    elif q_type in ["TU_LUAN", "TỰ LUẬN", "ESSAY"]:
        q_type = "ESSAY"
    if not q_type:
        if isinstance(data.get("sub_questions"), list) and len(data["sub_questions"]) > 0:
            q_type = "TRUE_FALSE"
        elif isinstance(data.get("options"), list) and len(data["options"]) > 0:
            q_type = "MULTIPLE_CHOICE"
        else:
            q_type = "MULTIPLE_CHOICE"
    data["question_type"] = q_type
    
    # 3. Normalize grade_level
    gl = data.get("grade_level", 10)
    if isinstance(gl, str):
        digits = "".join(ch for ch in gl if ch.isdigit())
        data["grade_level"] = int(digits) if digits else 10
    elif isinstance(gl, (int, float)):
        data["grade_level"] = int(gl)
    else:
        data["grade_level"] = 10
        
    # 4. Normalize difficulty
    diff = str(data.get("difficulty", "THONG_HIEU")).strip().upper()
    diff_map = {
        "NHẬN BIẾT": "NHAN_BIET", "NHAN BIET": "NHAN_BIET", "EASY": "NHAN_BIET",
        "THÔNG HIỂU": "THONG_HIEU", "THONG HIEU": "THONG_HIEU", "MEDIUM": "THONG_HIEU",
        "VẬN DỤNG": "VAN_DUNG", "VAN DUNG": "VAN_DUNG", "HARD": "VAN_DUNG",
        "VẬN DỤNG CAO": "VAN_DUNG_CAO", "VAN DUNG CAO": "VAN_DUNG_CAO", "VERY_HARD": "VAN_DUNG_CAO"
    }
    data["difficulty"] = diff_map.get(diff, diff if diff in ["NHAN_BIET", "THONG_HIEU", "VAN_DUNG", "VAN_DUNG_CAO"] else "THONG_HIEU")

    # 5. Normalize MULTIPLE_CHOICE
    if q_type == "MULTIPLE_CHOICE":
        options = data.get("options")
        if isinstance(options, list):
            data["options"] = [str(opt).strip() for opt in options]
        else:
            data["options"] = []
            
        c_opt = data.get("correct_option")
        opt_map = {"A": 0, "B": 1, "C": 2, "D": 3}
        if isinstance(c_opt, str):
            c_upper = c_opt.strip().upper()
            if c_upper in opt_map:
                data["correct_option"] = opt_map[c_upper]
            elif c_upper.isdigit():
                data["correct_option"] = int(c_upper)
            else:
                data["correct_option"] = None
        elif isinstance(c_opt, (int, float)):
            data["correct_option"] = int(c_opt)
            
        # Fallback if correct_option is still None but correct_answer is provided
        if data.get("correct_option") is None and data.get("correct_answer"):
            ca = str(data["correct_answer"]).strip().upper()
            if ca in opt_map:
                data["correct_option"] = opt_map[ca]
            elif ca.isdigit() and int(ca) < len(data["options"]):
                data["correct_option"] = int(ca)
            elif data.get("options"):
                raw_ca = str(data["correct_answer"]).strip()
                for o_idx, opt_text in enumerate(data["options"]):
                    if raw_ca.lower() == opt_text.lower():
                        data["correct_option"] = o_idx
                        break

    # 6. Normalize TRUE_FALSE
    elif q_type == "TRUE_FALSE":
        sub_qs = data.get("sub_questions")
        if isinstance(sub_qs, list):
            norm_sub = []
            for sub in sub_qs:
                if isinstance(sub, str):
                    norm_sub.append({"statement": sub, "answer": True})
                elif isinstance(sub, dict):
                    stmt = sub.get("statement") or sub.get("content") or sub.get("text") or ""
                    raw_ans = sub.get("answer") if "answer" in sub else (sub.get("is_correct") if "is_correct" in sub else sub.get("correct", True))
                    if isinstance(raw_ans, bool):
                        bool_ans = raw_ans
                    elif isinstance(raw_ans, str):
                        bool_ans = raw_ans.strip().lower() in ["true", "đúng", "dung", "1", "yes", "t"]
                    elif isinstance(raw_ans, (int, float)):
                        bool_ans = (raw_ans == 1)
                    else:
                        bool_ans = True
                    norm_sub.append({"statement": str(stmt).strip(), "answer": bool_ans})
            data["sub_questions"] = norm_sub

    # 7. Normalize SHORT_ANSWER
    elif q_type == "SHORT_ANSWER":
        if "correct_answer" in data and data["correct_answer"] is not None:
            data["correct_answer"] = str(data["correct_answer"]).strip()

    # 8. Ensure subject default
    if not data.get("subject"):
        data["subject"] = "Toán"

    return data

class QuestionImportRequest(BaseModel):
    questions: List[Dict[str, Any]]

@router.post("/batch", summary="Lưu hàng loạt câu hỏi vào ngân hàng (alias)")
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

    normalized_list = []
    pairs = set()
    for raw in payload.questions:
        norm = normalize_question_payload(raw)
        normalized_list.append(norm)
        pairs.add((norm.get("subject", "Toán"), norm.get("grade_level", 10)))

    chapter_maps, lesson_maps, _, _ = await load_taxonomy_lookup_maps(db, pairs)

    created = 0
    errors: List[str] = []
    for idx, norm_data in enumerate(normalized_list):
        try:
            subj = norm_data.get("subject", "Toán")
            grade = norm_data.get("grade_level", 10)
            c_map = chapter_maps.setdefault((subj, grade), {})
            l_map = lesson_maps.setdefault((subj, grade), {})

            orig_chap = norm_data.get("chapter", "Chương chung")
            orig_less = norm_data.get("lesson", "Bài chung")

            # 1. Resolve chapter FIRST (supports partial override + canonical match)
            c_chap = get_canonical_key(orig_chap)
            if c_chap in c_map:
                mapped_chap = c_map[c_chap]
            else:
                c_map[c_chap] = orig_chap
                mapped_chap = orig_chap
            norm_data["chapter"] = mapped_chap

            # 2. Use RESOLVED chapter's canonical key to lookup lesson
            c_resolved_chap = get_canonical_key(mapped_chap)
            c_less = get_canonical_key(orig_less)

            if (c_resolved_chap, c_less) in l_map:
                norm_data["lesson"] = l_map[(c_resolved_chap, c_less)]
            else:
                l_map[(c_resolved_chap, c_less)] = orig_less
                norm_data["lesson"] = orig_less

            q_in = QuestionCreate(**norm_data)
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

@router.post("/import-json/preview", summary="Xem trước ánh xạ danh mục khi nhập JSON")
async def preview_import_questions_json(
    payload: QuestionImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    if not payload.questions:
        return []

    normalized_list = []
    pairs = set()
    for raw in payload.questions:
        norm = normalize_question_payload(raw)
        normalized_list.append(norm)
        pairs.add((norm.get("subject", "Toán"), norm.get("grade_level", 10)))

    chapter_maps, lesson_maps, db_chapter_keys, db_lesson_keys = await load_taxonomy_lookup_maps(db, pairs)

    preview_items = []
    for norm_data in normalized_list:
        subj = norm_data.get("subject", "Toán")
        grade = norm_data.get("grade_level", 10)
        c_map = chapter_maps.setdefault((subj, grade), {})
        l_map = lesson_maps.setdefault((subj, grade), {})

        orig_chap = norm_data.get("chapter", "Chương chung")
        orig_less = norm_data.get("lesson", "Bài chung")

        # 1. Resolve chapter FIRST (supports partial override + canonical match)
        c_chap = get_canonical_key(orig_chap)
        chap_in_db = (subj, grade, c_chap) in db_chapter_keys
        if c_chap in c_map:
            mapped_chap = c_map[c_chap]
        else:
            c_map[c_chap] = orig_chap
            mapped_chap = orig_chap

        # 2. Use RESOLVED chapter's canonical key to lookup lesson
        c_resolved_chap = get_canonical_key(mapped_chap)
        c_less = get_canonical_key(orig_less)

        less_in_db = (subj, grade, c_resolved_chap, c_less) in db_lesson_keys
        if (c_resolved_chap, c_less) in l_map:
            mapped_less = l_map[(c_resolved_chap, c_less)]
        else:
            l_map[(c_resolved_chap, c_less)] = orig_less
            mapped_less = orig_less

        is_matched = chap_in_db and less_in_db
        status_val = "MATCHED" if is_matched else "NEW"

        preview_items.append({
            "original_chapter": orig_chap,
            "mapped_chapter": mapped_chap,
            "original_lesson": orig_less,
            "mapped_lesson": mapped_less,
            "status": status_val
        })

    return preview_items

@router.put("/{question_id}", response_model=QuestionResponse)
async def update_question(question_id: int, q_in: QuestionUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_teacher)):
    q = await db.get(Question, question_id)
    if not q: raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")
    update_data = q_in.model_dump(exclude_unset=True)

    subj = update_data.get("subject", q.subject) or "Toán"
    gr = update_data.get("grade_level", q.grade_level) or 10
    if "chapter" in update_data or "lesson" in update_data:
        c_maps, l_maps, _, _ = await load_taxonomy_lookup_maps(db, {(subj, gr)})
        c_map = c_maps.get((subj, gr), {})
        l_map = l_maps.get((subj, gr), {})
        chap_val = update_data.get("chapter", q.chapter)
        if chap_val:
            c_k = get_canonical_key(chap_val)
            if c_k in c_map:
                update_data["chapter"] = c_map[c_k]
            c_res_ch = get_canonical_key(update_data.get("chapter", chap_val))
            less_val = update_data.get("lesson", q.lesson)
            if less_val:
                l_k = get_canonical_key(less_val)
                if (c_res_ch, l_k) in l_map:
                    update_data["lesson"] = l_map[(c_res_ch, l_k)]

    for k, v in update_data.items(): setattr(q, k, v)
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
# Standardized upload route: redirecting to secure upload module
from fastapi import UploadFile, File
from app.routers.upload import upload_image as secure_upload_image

@router.post("/upload-image")
async def upload_image(request: Request, file: UploadFile = File(...), current_user: User = Depends(get_current_teacher)):
    return await secure_upload_image(request=request, file=file, current_user=current_user)
