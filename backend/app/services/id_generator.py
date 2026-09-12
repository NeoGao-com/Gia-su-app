from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.question import Question

SUBJECT_MAP = {
    "Toán": "TOAN",
    "Vật lý": "LY",
    "Hóa học": "HOA",
    "Tiếng Anh": "ANH",
    "Ngữ văn": "VAN",
    "Sinh học": "SINH",
    "Lịch sử": "SU",
    "Địa lý": "DIA",
    "Tin học": "TIN",
    "GDCD": "GDCD"
}

TYPE_MAP = {
    "MULTIPLE_CHOICE": "MC",
    "TRUE_FALSE": "TF",
    "FILL_IN_BLANK": "FB",
    "SHORT_ANSWER": "SA",
    "ESSAY": "ES"
}

async def generate_question_code(
    db: AsyncSession,
    subject: str,
    grade_level: int,
    question_type: str
) -> str:
    subj_code = SUBJECT_MAP.get(subject, "KHAC")
    type_code = TYPE_MAP.get(question_type, "CH")
    date_str = datetime.now().strftime("%Y%m%d")
    prefix = f"{subj_code}{grade_level}-{type_code}-{date_str}-"

    for _attempt in range(1000):
        query = select(Question.code).where(Question.code.like(f"{prefix}%")).order_by(Question.code.desc()).limit(1)
        result = await db.execute(query)
        last_code = result.scalar_one_or_none()
        if last_code:
            try:
                seq = int(last_code.split("-")[-1]) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1
        candidate = f"{prefix}{seq:04d}"
        exists_q = select(Question.id).where(Question.code == candidate)
        exists = (await db.execute(exists_q)).scalar_one_or_none()
        if not exists:
            return candidate
    raise RuntimeError(f"Không thể sinh mã câu hỏi mới sau 1000 lần thử (prefix={prefix})")
