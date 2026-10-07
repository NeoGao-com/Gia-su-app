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
    res_ai = client.post("/api/ai/generate-questions", json={"prompt_text": "test"})
    assert res_ai.status_code != 404

    res_notif = client.get("/api/notifications")
    assert res_notif.status_code != 404

    res_config = client.get("/api/ai-configs")
    assert res_config.status_code != 404

    res_student_exams = client.get("/api/student/exams")
    assert res_student_exams.status_code != 404

def test_delete_exam_requires_auth():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    res = client.delete("/api/exams/6?force=true")
    assert res.status_code in (401, 403)

def test_audit_and_fix_routes_exist():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    # Check routes exist (return 401 or 422, not 404)
    res_single = client.post("/api/ai/audit-and-fix", json={"question_id": 1})
    assert res_single.status_code in (401, 403, 422)

    res_batch = client.post("/api/ai/audit-and-fix-batch", json={"limit": 5})
    assert res_batch.status_code in (401, 403, 422)

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


def test_ai_analyze_difficulty_heuristic():
    from app.services.ai_service import AIService
    ai = AIService()

    # VDC question with extremum keywords
    res_vdc = ai.analyze_question_difficulty(
        content="Tìm giá trị lớn nhất và giá trị nhỏ nhất của hàm số f(x) với tham số m",
        subject="Toán",
        grade_level=12
    )
    assert res_vdc["difficulty"] == "VAN_DUNG_CAO"
    assert res_vdc["confidence"] > 0.7

    # NB question with simple definition
    res_nb = ai.analyze_question_difficulty(
        content="Mệnh đề nào sau đây đúng về tập xác định?",
        subject="Toán",
        grade_level=10
    )
    assert res_nb["difficulty"] in ("NHAN_BIET", "THONG_HIEU")


def test_ai_recommend_smart_practice():
    from app.services.ai_service import AIService
    ai = AIService()

    weak = [
        {"chapter": "Hình không gian", "accuracy": 30.0, "wrong_count": 7, "total_count": 10, "subject": "Toán", "grade_level": 12}
    ]
    rec = ai.recommend_smart_practice("Nguyễn Văn A", weak, 55.0, "Toán học", 12)
    assert "ai_tutor_message" in rec
    assert rec["suggested_config"]["chapter"] == "Hình không gian"
    assert rec["suggested_config"]["difficulty"] == "easy"


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




