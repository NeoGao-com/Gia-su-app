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









