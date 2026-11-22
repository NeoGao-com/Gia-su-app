import pytest
from app.models.classroom import Classroom  # Ensure models registry is loaded
from app.models.exam import ExamSubmission
from app.schemas.exam import ExamSubmissionResponse, ExamSubmissionSaveRequest
from app.routers.questions import CategoryDeleteRequest, CategoryMoveRequest

def test_submission_tab_switches_schema():
    req = ExamSubmissionSaveRequest(answers={"1": 0}, version=2, tab_switches=3)
    assert req.tab_switches == 3
    assert req.version == 2

def test_exam_submission_model_tab_switches():
    sub = ExamSubmission(exam_id=1, user_id=1, status="IN_PROGRESS", tab_switches=5)
    assert sub.tab_switches == 5
    assert sub.status == "IN_PROGRESS"

def test_category_move_request_schema():
    req = CategoryMoveRequest(
        source=CategoryDeleteRequest(subject="Toán", grade_level=10, chapter="Chương 1"),
        target=CategoryDeleteRequest(subject="Toán", grade_level=10, chapter="Chương 2")
    )
    assert req.source.chapter == "Chương 1"
    assert req.target.chapter == "Chương 2"

def test_api_routes_prefixes():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)

    # Test routes exist under /api/ and do NOT return 404
    res_q = client.get("/api/questions")
    assert res_q.status_code != 404

    res_notif = client.get("/api/notifications")
    assert res_notif.status_code != 404

    res_student_exams = client.get("/api/student/exams")
    assert res_student_exams.status_code != 404

def test_delete_exam_requires_auth():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    res = client.delete("/api/exams/6?force=true")
    assert res.status_code in (401, 403)

def test_normalize_question_payload():
    from app.routers.questions import normalize_question_payload
    # Test letter correct_option
    raw1 = {
        "content": "Test 1",
        "question_type": "MULTIPLE_CHOICE",
        "options": ["A", "B", "C", "D"],
        "correct_option": "B",
        "grade_level": "Khối 11",
        "difficulty": "Thông hiểu"
    }
    norm1 = normalize_question_payload(raw1)
    assert norm1["correct_option"] == 1
    assert norm1["grade_level"] == 11
    assert norm1["difficulty"] == "THONG_HIEU"

    # Test fallback from correct_answer to correct_option
    raw2 = {
        "content": "Test 2",
        "type": "mcq",
        "answers": ["Apple", "Banana", "Cherry", "Date"],
        "correct_answer": "Banana"
    }
    norm2 = normalize_question_payload(raw2)
    assert norm2["question_type"] == "MULTIPLE_CHOICE"
    assert norm2["correct_option"] == 1


def test_export_exam_routes_exist():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    # Check routes exist and are registered
    res_docx = client.get("/api/export/exam/9999/docx")
    assert res_docx.status_code in (401, 403, 404)

    res_pdf = client.get("/api/export/exam/9999/pdf")
    assert res_pdf.status_code in (401, 403, 404)


def test_exporter_exam_docx_and_pdf():
    from app.services.exporter import Exporter
    from unittest.mock import MagicMock

    exporter = Exporter()
    dummy_exam = MagicMock()
    dummy_exam.id = 101
    dummy_exam.title = "Đề Khảo Sát Toán 12"
    dummy_exam.subject = "Toán học"
    dummy_exam.grade_level = 12
    dummy_exam.duration_minutes = 45
    dummy_exam.description = "Đề thi thử tốt nghiệp THPT"

    dummy_q1 = MagicMock()
    dummy_q1.id = 1
    dummy_q1.content = "Cho hàm số f(x). Giá trị của đạo hàm f'(1) bằng bao nhiêu?"
    dummy_q1.question_type = "MULTIPLE_CHOICE"
    dummy_q1.options = ["1", "2", "3", "4"]
    dummy_q1.correct_option = 0
    dummy_q1.explanation = "Áp dụng công thức tính đạo hàm cơ bản."
    dummy_q1.image_url = None
    dummy_q1.media = None
    dummy_q1.sub_questions = None
    dummy_q1.correct_answer = None

    # Test DOCX export
    docx_path = exporter.export_exam_to_docx(dummy_exam, [dummy_q1], include_answers=True)
    import os
    assert os.path.exists(docx_path)
    assert os.path.getsize(docx_path) > 1000
    os.unlink(docx_path)

    # Test PDF export
    pdf_buffer = exporter.export_exam_to_pdf(dummy_exam, [dummy_q1], include_answers=True)
    pdf_bytes = pdf_buffer.getvalue()
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF")


def test_format_exam_id_and_correct_option():
    from app.services.exporter import format_exam_id, format_correct_option
    assert format_exam_id(5) == "005"
    assert format_exam_id("12") == "012"
    assert format_exam_id("EX-999") == "EX-999"
    assert format_exam_id(None) == "001"

    assert format_correct_option(0) == "A"
    assert format_correct_option(3) == "D"
    assert format_correct_option("B") == "B"
    assert format_correct_option("1") == "B"
    assert format_correct_option(None) is None


def test_exporter_exam_docx_and_pdf_all_question_types_and_xml():
    from app.services.exporter import Exporter
    from unittest.mock import MagicMock
    import io

    exporter = Exporter()
    dummy_exam = MagicMock()
    dummy_exam.id = "EXAM-UUID-2026"
    dummy_exam.title = "Đề Thi Toán & Khoa Học <Lớp 12>"
    dummy_exam.subject = "Toán & Khoa học"
    dummy_exam.grade_level = 12
    dummy_exam.duration_minutes = 60
    dummy_exam.description = "Khảo sát chất lượng cho học sinh <khối 12> & đội tuyển"

    # 1. Multiple Choice with special XML characters and letter correct_option
    q_mcq = MagicMock()
    q_mcq.id = 1
    q_mcq.content = "Hàm số f(x) thỏa mãn 0 < x < 1 & f'(x) > 0"
    q_mcq.question_type = "MULTIPLE_CHOICE"
    q_mcq.options = ["x < 0 & y > 0", "x > 1 & y < 0", "0 < x < 1", "x = 0"]
    q_mcq.correct_option = "B"
    q_mcq.explanation = "Xem xét đạo hàm trên khoảng (0; 1) với điều kiện & quy tắc dấu."
    q_mcq.image_url = None
    q_mcq.media = None
    q_mcq.sub_questions = None
    q_mcq.correct_answer = None

    # 2. True / False question
    q_tf = MagicMock()
    q_tf.id = 2
    q_tf.content = "Xét tính đúng sai của các mệnh đề sau:"
    q_tf.question_type = "TRUE_FALSE"
    q_tf.options = None
    q_tf.correct_option = None
    q_tf.sub_questions = [
        {"id": 1, "statement": "Hàm số đồng biến trên R", "correct": True},
        {"id": 2, "statement": "Đồ thị có tiệm cận đứng x = 0", "correct": False}
    ]
    q_tf.explanation = "Ý 1 đúng do đạo hàm luôn dương. Ý 2 sai do hàm xác định trên R."
    q_tf.image_url = None
    q_tf.media = None
    q_tf.correct_answer = None

    # 3. Essay question
    q_essay = MagicMock()
    q_essay.id = 3
    q_essay.content = "Chứng minh bất đẳng thức Cauchy-Schwarz trong không gian R^3."
    q_essay.question_type = "ESSAY"
    q_essay.options = None
    q_essay.correct_option = None
    q_essay.sub_questions = None
    q_essay.explanation = "Sử dụng tích vô hướng hai vectơ u và v."
    q_essay.image_url = None
    q_essay.media = None
    q_essay.correct_answer = None

    # 4. Fill in blank question
    q_fib = MagicMock()
    q_fib.id = 4
    q_fib.content = "Nghiệm của phương trình 2^x = 8 là x = /key."
    q_fib.question_type = "FILL_IN_BLANK"
    q_fib.options = None
    q_fib.correct_option = None
    q_fib.sub_questions = None
    q_fib.blanks = ["3"]
    q_fib.correct_answer = "3"
    q_fib.explanation = "2^3 = 8 nên x = 3."
    q_fib.image_url = None
    q_fib.media = None

    questions = [q_mcq, q_tf, q_essay, q_fib]

    # Test DOCX buffer export
    docx_buf = exporter.export_exam_to_docx(dummy_exam, questions, include_answers=True, as_buffer=True)
    assert isinstance(docx_buf, io.BytesIO)
    assert docx_buf.getbuffer().nbytes > 1000

    # Test PDF export with XML characters in content & titles
    pdf_buf = exporter.export_exam_to_pdf(dummy_exam, questions, include_answers=True)
    assert isinstance(pdf_buf, io.BytesIO)
    pdf_data = pdf_buf.getvalue()
    assert pdf_data.startswith(b"%PDF")
    assert len(pdf_data) > 1000


def test_practice_recommendations_route_registered():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    res = client.get("/api/student/practice/recommendations")
    assert res.status_code in (401, 403)


def test_user_response_null_safe():
    from app.schemas.auth import UserResponse
    class MockUser:
        id = 99
        email = "test@example.com"
        full_name = "Test Student"
        phone_number = None
        parent_phone = None
        parent_name = None
        date_of_birth = None
        gender = None
        school = None
        student_code = None
        notes = None
        role = None
        is_active = None
        grade_level = None

    validated = UserResponse.model_validate(MockUser())
    assert validated.id == 99
    assert validated.role is None or validated.role == "STUDENT"
    assert validated.is_active is None or validated.is_active is True


@pytest.mark.asyncio
async def test_safe_redis_expire_normalization():
    from app.database import SafeRedis
    redis_instance = SafeRedis("redis://localhost:6379/0")
    # Should not raise TypeError when expire is passed
    # It will safely normalize kwargs and return None if disconnected
    res = await redis_instance.set("test_key", "val", expire=60)
    assert res is None or res is True


def test_profile_update_request_grade_level_coercion():
    from app.schemas.auth import ProfileUpdateRequest
    req1 = ProfileUpdateRequest(grade_level="")
    assert req1.grade_level is None

    req2 = ProfileUpdateRequest(grade_level="12")
    assert req2.grade_level == 12

    req3 = ProfileUpdateRequest(grade_level=None)
    assert req3.grade_level is None


def test_questions_batch_route_exists():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    # /api/questions/batch exists and requires auth (returns 401/403, not 404)
    res = client.post("/api/questions/batch", json={"questions": []})
    assert res.status_code in (401, 403, 400)


def test_schedule_event_update_fields_set():
    from app.schemas.schedule import ScheduleEventUpdate
    req = ScheduleEventUpdate(classroom_id=None, description=None)
    assert "classroom_id" in req.model_fields_set
    assert "description" in req.model_fields_set
    assert req.classroom_id is None


def test_profile_update_request_fields_clearing():
    from app.schemas.auth import ProfileUpdateRequest
    req = ProfileUpdateRequest(phone_number=None, notes=None, grade_level="")
    assert "phone_number" in req.model_fields_set
    assert "notes" in req.model_fields_set
    assert "grade_level" in req.model_fields_set
    assert req.phone_number is None
    assert req.notes is None
    assert req.grade_level is None


def test_extract_from_file_route_exists():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    # /api/upload/extract-from-file exists and requires teacher auth (returns 401/403, not 404)
    res = client.post("/api/upload/extract-from-file")
    assert res.status_code in (401, 403, 422)


def test_exam_and_classroom_schemas_null_safe():
    from app.schemas.exam import ExamResponse, ExamSubmissionResponse
    from app.schemas.classroom import ClassroomResponse

    class MockExam:
        id = 10
        title = "Đề thi kiểm tra"
        duration_minutes = 45
        pass_score = 5.0
        is_published = True
        show_answers_after_submit = True
        max_attempts = 1
        exam_type = "EXAM"
        created_at = None
        created_by_id = None
        subject = None
        grade_level = None
        question_count = None
        submissions_count = None

    e = ExamResponse.model_validate(MockExam())
    assert e.id == 10
    assert e.created_by_id is None
    assert e.created_at is None

    class MockSubmission:
        id = 20
        exam_id = 10
        user_id = 99
        score = None
        auto_score = None
        essay_score = None
        submitted_at = None
        grading_status = None
        status = "IN_PROGRESS"
        started_at = None
        last_saved_at = None
        attempt_number = 1
        version = 1
        tab_switches = 0

    s = ExamSubmissionResponse.model_validate(MockSubmission())
    assert s.id == 20
    assert s.submitted_at is None
    assert s.score is None

    class MockClassroom:
        id = 30
        name = "Lớp 10A1"
        description = None
        code = None
        code_expires_at = None
        instructor_id = None
        created_at = None
        instructor = None
        students = []
        exams = []
        assignments = []

    c = ClassroomResponse.model_validate(MockClassroom())
    assert c.id == 30
    assert c.code == "" or c.code is None


def test_manual_essay_grading_normalized_and_bounded():
    from app.services.grading import calculate_total_score
    # 9 objective questions, auto_score = 9.0 (out of 10)
    # 1 essay question, graded as 8.0 (out of 10)
    # Total score must be normalized to scale of 10.0: ((9.0 * 9) + (8.0 * 1)) / 10 = 8.90
    total = calculate_total_score(n_obj=9, auto_score=9.0, n_essay=1, essay_scores=[8.0])
    assert total == 8.90
    assert 0.0 <= total <= 10.0

    # 100% essay exam (n_obj=0, n_essay=2, essay_scores=[7.0, 9.0] -> avg = 8.0)
    total_essay_only = calculate_total_score(n_obj=0, auto_score=0.0, n_essay=2, essay_scores=[7.0, 9.0])
    assert total_essay_only == 8.0


def test_document_parser_safe_fallback():
    from app.services.document_parser import parse_questions_with_rules
    sample_text = """
    Câu 1. [NB] Hàm số nào sau đây là hàm số bậc hai?
    A. y = 2x + 1
    B. y = x^2 - 3x + 2
    C. y = 1/x
    D. y = x^3
    Lời giải: Chọn B vì có bậc 2.
    """
    res = parse_questions_with_rules(sample_text, default_subject="Toán", default_grade_level=10)
    assert len(res) == 1
    assert res[0]["question_type"] == "MULTIPLE_CHOICE"
    assert res[0]["correct_option"] == 1


def test_get_canonical_key():
    from app.routers.questions import get_canonical_key

    # 1. Basic prefix stripping
    assert get_canonical_key("Chương 1: Mệnh đề và tập hợp") == "mệnh đề và tập hợp"
    assert get_canonical_key("Chương 01: Mệnh đề và tập hợp") == "mệnh đề và tập hợp"
    assert get_canonical_key("Chương I: Mệnh đề và tập hợp") == "mệnh đề và tập hợp"
    assert get_canonical_key("Chương I - Mệnh đề và tập hợp") == "mệnh đề và tập hợp"
    assert get_canonical_key("Chương 1 – Mệnh đề và tập hợp") == "mệnh đề và tập hợp"
    assert get_canonical_key("Chương 1 — Mệnh đề và tập hợp") == "mệnh đề và tập hợp"
    assert get_canonical_key("Phần 2: Hình học không gian") == "hình học không gian"
    assert get_canonical_key("Chuyên đề 3. Giải tích") == "giải tích"
    assert get_canonical_key("Bài 1: Mệnh đề") == "mệnh đề"
    assert get_canonical_key("Bài 01. Mệnh đề") == "mệnh đề"

    # 1b. Support 'chủ đề' (GDPT 2018) & trailing punctuation stripping
    assert get_canonical_key("Chủ đề 1: Đạo hàm") == "đạo hàm"
    assert get_canonical_key("Chủ đề 02 - Tích phân") == "tích phân"
    assert get_canonical_key("Chủ đề: Nguyên hàm.") == "nguyên hàm"
    assert get_canonical_key("Chương 1: Mệnh đề và tập hợp.") == "mệnh đề và tập hợp"
    assert get_canonical_key("Bài 1: Mệnh đề -") == "mệnh đề"
    assert get_canonical_key("Chủ đề 1: Hàm số;") == "hàm số"
    assert get_canonical_key("Chuyên đề 2: Tọa độ,") == "tọa độ"

    # 2. Bare names match prefixed names
    assert get_canonical_key("Mệnh đề và tập hợp") == "mệnh đề và tập hợp"
    assert get_canonical_key("mệnh đề và tập hợp") == get_canonical_key("Chương 1: Mệnh đề và tập hợp")

    # 3. Empty core fallback
    assert get_canonical_key("Chương 1:") == "chương 1:"
    assert get_canonical_key("Chương 1") == "chương 1"

    # 4. Do NOT strip numbers from "Ôn tập chương 1" or "Bài tập cuối chương 2"
    assert get_canonical_key("Ôn tập chương 1") == "ôn tập chương 1"
    assert get_canonical_key("Bài tập cuối chương 2") == "bài tập cuối chương 2"

    # 5. Empty inputs
    assert get_canonical_key("") == ""
    assert get_canonical_key("   ") == ""
    assert get_canonical_key(None) == ""


def test_normalize_question_payload_preserves_display_names():
    from app.routers.questions import normalize_question_payload

    raw = {
        "content": "Một câu hỏi trắc nghiệm",
        "chapter": "Chương 1: Mệnh đề và tập hợp",
        "lesson": "Bài 1: Mệnh đề",
        "options": ["A", "B", "C", "D"],
        "correct_option": 0
    }
    norm = normalize_question_payload(raw)
    assert norm["chapter"] == "Chương 1: Mệnh đề và tập hợp"
    assert norm["lesson"] == "Bài 1: Mệnh đề"


def test_preview_endpoint_registered():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    # Without auth, it should require teacher credentials (401 or 403), NOT 404
    res = client.post("/api/questions/import-json/preview", json={"questions": []})
    assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_smart_taxonomy_normalization_and_preview_logic(tmp_path):
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from app.database import Base
    from app.models.question import Question, QuestionCategory, CategoryAuditLog
    from app.models.user import User
    from app.routers.questions import (
        load_taxonomy_lookup_maps,
        preview_import_questions_json,
        import_questions_json,
        QuestionImportRequest,
        move_category,
        CategoryMoveRequest,
        CategoryDeleteRequest
    )

    db_file = tmp_path / "test_taxonomy.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file.as_posix()}", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Pre-seed teacher user
        teacher = User(id=99, email="teacher@test.com", hashed_password="pw", role="TEACHER")
        session.add(teacher)

        # Pre-seed category in DB
        cat1 = QuestionCategory(
            subject="Toán",
            grade_level=10,
            chapter="Chương 1: Mệnh đề và tập hợp",
            lesson="Bài 1: Mệnh đề",
            topic="Dạng 1: Nhận biết"
        )
        session.add(cat1)
        await session.commit()

        # Test pre-loading lookup maps
        pairs = {("Toán", 10)}
        c_maps, l_maps, db_chaps, db_less = await load_taxonomy_lookup_maps(session, pairs)
        assert ("mệnh đề và tập hợp") in c_maps[("Toán", 10)]
        assert c_maps[("Toán", 10)]["mệnh đề và tập hợp"] == "Chương 1: Mệnh đề và tập hợp"
        assert ("mệnh đề và tập hợp", "mệnh đề") in l_maps[("Toán", 10)]
        assert l_maps[("Toán", 10)][("mệnh đề và tập hợp", "mệnh đề")] == "Bài 1: Mệnh đề"

        # Test preview endpoint logic:
        # 1 question matching existing chapter & lesson
        # 1 question matching existing chapter but with new lesson
        # 1 question in a completely new chapter
        preview_payload = QuestionImportRequest(questions=[
            {
                "content": "Câu 1",
                "subject": "Toán",
                "grade_level": 10,
                "chapter": "Mệnh đề và tập hợp",
                "lesson": "Bài 1. Mệnh đề",
                "options": ["A", "B"],
                "correct_option": 0
            },
            {
                "content": "Câu 2",
                "subject": "Toán",
                "grade_level": 10,
                "chapter": "Chương I: Mệnh đề và tập hợp",
                "lesson": "Bài 2: Tập hợp các số",
                "options": ["A", "B"],
                "correct_option": 0
            },
            {
                "content": "Câu 3",
                "subject": "Toán",
                "grade_level": 10,
                "chapter": "Chương 5: Phương pháp tọa độ",
                "lesson": "Bài 1: Hệ tọa độ",
                "options": ["A", "B"],
                "correct_option": 0
            }
        ])

        preview_result = await preview_import_questions_json(preview_payload, session, teacher)
        assert len(preview_result) == 3

        # Item 1: Chapter and Lesson match existing DB record
        assert preview_result[0]["original_chapter"] == "Mệnh đề và tập hợp"
        assert preview_result[0]["mapped_chapter"] == "Chương 1: Mệnh đề và tập hợp"
        assert preview_result[0]["original_lesson"] == "Bài 1. Mệnh đề"
        assert preview_result[0]["mapped_lesson"] == "Bài 1: Mệnh đề"
        assert preview_result[0]["status"] == "MATCHED"

        # Item 2: Chapter matches existing DB, lesson is NEW
        assert preview_result[1]["original_chapter"] == "Chương I: Mệnh đề và tập hợp"
        assert preview_result[1]["mapped_chapter"] == "Chương 1: Mệnh đề và tập hợp"
        assert preview_result[1]["original_lesson"] == "Bài 2: Tập hợp các số"
        assert preview_result[1]["status"] == "NEW"

        # Item 3: Brand new chapter and lesson
        assert preview_result[2]["mapped_chapter"] == "Chương 5: Phương pháp tọa độ"
        assert preview_result[2]["status"] == "NEW"

        # Test actual import
        import_result = await import_questions_json(preview_payload, session, teacher)
        assert import_result["created"] == 3

        # Verify saved questions in DB have canonical mapped names
        q_res = await session.execute(Question.__table__.select().where(Question.content == "Câu 1"))
        q1 = q_res.first()
        assert q1.chapter == "Chương 1: Mệnh đề và tập hợp"
        assert q1.lesson == "Bài 1: Mệnh đề"

        # Test move_category with deduplication & audit log
        cat2 = QuestionCategory(
            subject="Toán",
            grade_level=10,
            chapter="Chương Cũ",
            lesson="Bài Cũ",
            topic="Dạng Cũ"
        )
        session.add(cat2)
        await session.commit()

        # Move cat2 to a brand new target
        move_req1 = CategoryMoveRequest(
            source=CategoryDeleteRequest(subject="Toán", grade_level=10, chapter="Chương Cũ"),
            target=CategoryDeleteRequest(subject="Toán", grade_level=10, chapter="Chương Mới")
        )
        await move_category(move_req1, session, teacher)

        # Verify cat2 moved
        await session.refresh(cat2)
        assert cat2.chapter == "Chương Mới"
        assert cat2.is_deleted is False

        # Now merge cat2 into cat1 (same subject, grade, chapter, lesson, topic)
        move_req2 = CategoryMoveRequest(
            source=CategoryDeleteRequest(subject="Toán", grade_level=10, chapter="Chương Mới"),
            target=CategoryDeleteRequest(
                subject="Toán",
                grade_level=10,
                chapter="Chương 1: Mệnh đề và tập hợp",
                lesson="Bài 1: Mệnh đề",
                topic="Dạng 1: Nhận biết"
            )
        )
        await move_category(move_req2, session, teacher)

        # Verify cat2 was deduplicated (marked is_deleted=True)
        await session.refresh(cat2)
        assert cat2.is_deleted is True

        # Verify CategoryAuditLog was written
        audit_res = await session.execute(CategoryAuditLog.__table__.select().where(CategoryAuditLog.category_id == cat2.id))
        audits = audit_res.fetchall()
        assert len(audits) >= 2
        actions = [a.action for a in audits]
        assert "MOVE" in actions
        assert "MOVE_DEDUPLICATE" in actions


@pytest.mark.asyncio
async def test_reverse_direction_and_soft_delete_and_merge_children(tmp_path):
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from app.database import Base
    from app.models.question import Question, QuestionCategory, CategoryAuditLog
    from app.models.user import User
    from app.routers.questions import (
        preview_import_questions_json,
        import_questions_json,
        QuestionImportRequest,
        move_category,
        CategoryMoveRequest,
        CategoryDeleteRequest
    )

    db_file = tmp_path / "test_reverse_and_merge.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_file.as_posix()}", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        teacher = User(id=101, email="teacher101@test.com", hashed_password="pw", role="TEACHER")
        session.add(teacher)

        # 1. DB has full prefixed name: "Chương 1: Mệnh đề và tập hợp" and "Bài 1: Mệnh đề"
        cat_db = QuestionCategory(
            subject="Toán",
            grade_level=10,
            chapter="Chương 1: Mệnh đề và tập hợp",
            lesson="Bài 1: Mệnh đề",
            topic="Dạng 1"
        )
        # Soft-deleted category that must NOT be mapped to
        cat_deleted = QuestionCategory(
            subject="Toán",
            grade_level=10,
            chapter="Chương Cũ Bị Xóa",
            lesson="Bài Cũ Bị Xóa",
            is_deleted=True
        )
        session.add_all([cat_db, cat_deleted])
        await session.commit()

        # 1a. Test reverse direction: JSON gives bare names or roman numeral variants
        # -> MUST preserve the full original DB name "Chương 1: Mệnh đề và tập hợp"
        rev_payload = QuestionImportRequest(questions=[
            {
                "content": "Câu trắc nghiệm đảo chiều 1",
                "subject": "Toán",
                "grade_level": 10,
                "chapter": "Mệnh đề và tập hợp",
                "lesson": "Bài 1. Mệnh đề",
                "options": ["A", "B"],
                "correct_option": 0
            },
            {
                "content": "Câu trắc nghiệm đảo chiều 2",
                "subject": "Toán",
                "grade_level": 10,
                "chapter": "Chương I - Mệnh đề và tập hợp",
                "lesson": "Mệnh đề",
                "options": ["A", "B"],
                "correct_option": 1
            },
            {
                "content": "Câu trắc nghiệm thử soft-delete",
                "subject": "Toán",
                "grade_level": 10,
                "chapter": "Chương Cũ Bị Xóa",
                "lesson": "Bài Cũ Bị Xóa",
                "options": ["A", "B"],
                "correct_option": 0
            }
        ])

        prev_res = await preview_import_questions_json(rev_payload, session, teacher)
        assert len(prev_res) == 3

        # Item 1: bare chapter "Mệnh đề và tập hợp" maps back to DB's "Chương 1: Mệnh đề và tập hợp"
        assert prev_res[0]["original_chapter"] == "Mệnh đề và tập hợp"
        assert prev_res[0]["mapped_chapter"] == "Chương 1: Mệnh đề và tập hợp"
        assert prev_res[0]["original_lesson"] == "Bài 1. Mệnh đề"
        assert prev_res[0]["mapped_lesson"] == "Bài 1: Mệnh đề"
        assert prev_res[0]["status"] == "MATCHED"

        # Item 2: roman variant "Chương I - Mệnh đề và tập hợp" also maps back to DB's "Chương 1: Mệnh đề và tập hợp"
        assert prev_res[1]["mapped_chapter"] == "Chương 1: Mệnh đề và tập hợp"
        assert prev_res[1]["mapped_lesson"] == "Bài 1: Mệnh đề"
        assert prev_res[1]["status"] == "MATCHED"

        # Item 3: Soft-deleted category is NOT mapped (status is NEW, not MATCHED)
        assert prev_res[2]["status"] == "NEW"

        # 2. Test Partial Override (Chỉ ghi đè Chương):
        # Question in JSON has chapter="Chương Lung Tung", lesson="Bài 1. Mệnh đề"
        # Overridden chapter is "Mệnh đề và tập hợp" (which canonically matches "Chương 1: Mệnh đề và tập hợp")
        partial_override_payload = QuestionImportRequest(questions=[
            {
                "content": "Câu partial override",
                "subject": "Toán",
                "grade_level": 10,
                "chapter": "Mệnh đề và tập hợp",  # Overridden chapter
                "lesson": "Bài 1. Mệnh đề",        # Original lesson from JSON
                "options": ["A", "B"],
                "correct_option": 0
            }
        ])
        partial_prev = await preview_import_questions_json(partial_override_payload, session, teacher)
        assert partial_prev[0]["mapped_chapter"] == "Chương 1: Mệnh đề và tập hợp"
        assert partial_prev[0]["mapped_lesson"] == "Bài 1: Mệnh đề"
        assert partial_prev[0]["status"] == "MATCHED"

        # 3. Test Chapter -> Chapter merge with child lesson canonical deduplication
        # Target Chapter B has lesson "Bài 1: Mệnh đề"
        # Source Chapter A has lesson "Bài 01. Mệnh đề"
        cat_ch_b = QuestionCategory(
            subject="Toán",
            grade_level=10,
            chapter="Chương B",
            lesson="Bài 1: Mệnh đề",
            topic="Dạng chung"
        )
        cat_ch_a = QuestionCategory(
            subject="Toán",
            grade_level=10,
            chapter="Chương A",
            lesson="Bài 01. Mệnh đề",
            topic="Dạng chung"
        )
        session.add_all([cat_ch_b, cat_ch_a])
        await session.commit()

        # Seed question in Chapter A
        q_in_a = Question(
            code="TEST_Q_IN_A",
            content="Nội dung câu ở Chương A",
            subject="Toán",
            grade_level=10,
            chapter="Chương A",
            lesson="Bài 01. Mệnh đề",
            topic="Dạng chung",
            options=["A", "B"],
            correct_option=0
        )
        session.add(q_in_a)
        await session.commit()

        # Merge Chapter A into Chapter B (chapter-level merge: source.lesson is None, target.lesson is None)
        merge_ch_req = CategoryMoveRequest(
            source=CategoryDeleteRequest(subject="Toán", grade_level=10, chapter="Chương A"),
            target=CategoryDeleteRequest(subject="Toán", grade_level=10, chapter="Chương B")
        )
        await move_category(merge_ch_req, session, teacher)

        # Verify child category in Chapter A was deduplicated into Chapter B's lesson
        await session.refresh(cat_ch_a)
        assert cat_ch_a.is_deleted is True

        # Verify question in Chapter A has its chapter changed to Chapter B AND lesson canonicalized to Chapter B's lesson
        await session.refresh(q_in_a)
        assert q_in_a.chapter == "Chương B"
        assert q_in_a.lesson == "Bài 1: Mệnh đề"










