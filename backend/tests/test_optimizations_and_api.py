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



