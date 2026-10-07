import io
import logging
import os
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional

from app.core.security import get_current_user
from app.database import get_db
from app.models.exam import Exam, exam_questions
from app.models.question import Question
from app.services.exporter import Exporter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/export", tags=["export"])


@router.post("/docx", summary="Xuất danh sách câu hỏi ra tệp Word (.docx)")
async def export_docx(
    request: Request,
    question_ids: List[int],
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    client_ip = request.client.host if request.client else "unknown"
    result = await db.execute(select(Question).filter(Question.id.in_(question_ids)))
    questions = result.scalars().all()

    if not questions:
        logger.warning(f"DOCX export failed: No questions found for IDs {question_ids} by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi nào để xuất")

    exporter = Exporter()
    file_path = exporter.export_to_docx(questions)

    logger.info(f"DOCX export successful: {len(questions)} questions by {current_user.email} from IP {client_ip}")
    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename="questions.docx"
    )


@router.post("/pdf", summary="Xuất danh sách câu hỏi ra tệp PDF (.pdf)")
async def export_pdf(
    request: Request,
    question_ids: List[int],
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    client_ip = request.client.host if request.client else "unknown"
    result = await db.execute(select(Question).filter(Question.id.in_(question_ids)))
    questions = result.scalars().all()

    if not questions:
        logger.warning(f"PDF export failed: No questions found for IDs {question_ids} by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=404, detail="No questions found")

    exporter = Exporter()
    dummy_exam = type("DummyExam", (), {"title": "DANH SÁCH CÂU HỎI ĐỀ THI", "id": 1, "duration_minutes": 45, "subject": "Tổng hợp", "description": None})()
    pdf_buffer = exporter.export_exam_to_pdf(dummy_exam, questions, include_answers=False)

    logger.info(f"PDF export successful: {len(questions)} questions by {current_user.email} from IP {client_ip}")
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=questions.pdf"}
    )


@router.get("/exam/{exam_id}/docx", summary="Xuất đề thi hoàn chỉnh ra file Word (.docx)")
async def export_exam_docx(
    exam_id: int,
    include_answers: bool = Query(True, description="Kèm bảng đáp án và hướng dẫn giải chi tiết"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    res = await db.execute(select(Exam).filter(Exam.id == exam_id, Exam.is_deleted == False))
    exam = res.scalars().first()
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề thi")

    q_res = await db.execute(
        select(Question)
        .join(exam_questions, Question.id == exam_questions.c.question_id)
        .filter(exam_questions.c.exam_id == exam_id)
        .order_by(exam_questions.c.question_id.asc())
    )
    questions = q_res.scalars().all()
    if not questions:
        raise HTTPException(status_code=400, detail="Đề thi chưa có câu hỏi nào để xuất")

    exporter = Exporter()
    docx_buffer = exporter.export_exam_to_docx(exam, questions, include_answers=include_answers, as_buffer=True)

    # Safe ASCII filename + UTF-8 content-disposition
    safe_title = "".join(c for c in exam.title if c.isalnum() or c in (' ', '_', '-')).strip()[:40] or f"De_thi_{exam.id}"
    encoded_filename = urllib.parse.quote(f"{safe_title}.docx")

    return Response(
        content=docx_buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f"attachment; filename=\"de_thi_{exam.id}.docx\"; filename*=UTF-8''{encoded_filename}"
        }
    )


@router.get("/exam/{exam_id}/pdf", summary="Xuất đề thi hoàn chỉnh ra file PDF (.pdf)")
async def export_exam_pdf(
    exam_id: int,
    include_answers: bool = Query(True, description="Kèm bảng đáp án và hướng dẫn giải chi tiết"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    res = await db.execute(select(Exam).filter(Exam.id == exam_id, Exam.is_deleted == False))
    exam = res.scalars().first()
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề thi")

    q_res = await db.execute(
        select(Question)
        .join(exam_questions, Question.id == exam_questions.c.question_id)
        .filter(exam_questions.c.exam_id == exam_id)
        .order_by(exam_questions.c.question_id.asc())
    )
    questions = q_res.scalars().all()
    if not questions:
        raise HTTPException(status_code=400, detail="Đề thi chưa có câu hỏi nào để xuất")

    exporter = Exporter()
    pdf_buffer = exporter.export_exam_to_pdf(exam, questions, include_answers=include_answers)

    safe_title = "".join(c for c in exam.title if c.isalnum() or c in (' ', '_', '-')).strip()[:40] or f"De_thi_{exam.id}"
    encoded_filename = urllib.parse.quote(f"{safe_title}.pdf")

    return Response(
        content=pdf_buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=\"de_thi_{exam.id}.pdf\"; filename*=UTF-8''{encoded_filename}"
        }
    )
