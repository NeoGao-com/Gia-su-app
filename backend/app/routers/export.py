import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from app.database import get_db
from app.models.question import Question
from app.core.security import get_current_user
from app.services.exporter import Exporter
from fastapi.responses import FileResponse, StreamingResponse
import io
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/export", tags=["export"])

@router.post("/docx", summary="Xuất đề thi ra tệp Word (.docx)")
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

@router.post("/pdf", summary="Xuất đề thi ra tệp PDF (.pdf)")
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

    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet

    pdf_buffer = io.BytesIO()
    doc = SimpleDocTemplate(pdf_buffer, pagesize=letter, rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)
    styles = getSampleStyleSheet()
    title_style = styles["Heading1"]
    normal_style = styles["Normal"]

    story = []
    story.append(Paragraph("DANH SÁCH CÂU HỎI ĐỀ THI", title_style))
    story.append(Spacer(1, 14))

    for idx, q in enumerate(questions, 1):
        clean_content = (q.content or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        story.append(Paragraph(f"<b>Câu {idx}:</b> {clean_content}", normal_style))
        story.append(Spacer(1, 4))

        if q.options and isinstance(q.options, list):
            for o_idx, opt in enumerate(q.options):
                opt_str = opt if isinstance(opt, str) else str(opt)
                clean_opt = opt_str.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                letter_choice = chr(65 + o_idx)
                story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;<b>{letter_choice}.</b> {clean_opt}", normal_style))
                story.append(Spacer(1, 2))

        story.append(Spacer(1, 8))

    doc.build(story)
    pdf_buffer.seek(0)

    logger.info(f"PDF export successful: {len(questions)} questions by {current_user.email} from IP {client_ip}")
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=exam.pdf"}
    )
