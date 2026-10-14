import os
os.environ["TESTING"] = "True"
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-32bytes")

import pytest
import bcrypt
from app.core.security import create_access_token, get_password_hash, verify_password
from app.schemas.auth import validate_strong_password


def test_password_hash_and_verify():
    pw = "Password@123!"
    hashed = get_password_hash(pw)
    assert hashed != pw
    assert verify_password(pw, hashed)
    assert not verify_password("Wrong@123!", hashed)


def test_create_access_token_has_jti_and_sub():
    from jose import jwt
    from app.core.config import settings
    token = create_access_token(data={"sub": "student@example.com"})
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == "student@example.com"
    assert "jti" in payload and payload["jti"]
    assert "exp" in payload


def test_strong_password_validator():
    with pytest.raises(ValueError):
        validate_strong_password("short")
    with pytest.raises(ValueError):
        validate_strong_password("nouppercase@123")
    assert validate_strong_password("Password@123!") == "Password@123!"


def test_exam_schema_validation():
    from app.schemas.exam import ExamCreate
    with pytest.raises(Exception):
        ExamCreate(title="", duration_minutes=45, question_ids=[])
    exam = ExamCreate(title="Đề kiểm tra 15 phút", duration_minutes=45, question_ids=[1, 2])
    assert exam.title == "Đề kiểm tra 15 phút"
    assert exam.duration_minutes == 45


def test_grading_service_mc_and_tf():
    from app.services.grading import GradingService

    class Q:
        def __init__(self, id, qtype, **kwargs):
            self.id = id
            self.question_type = qtype
            for k, v in kwargs.items():
                setattr(self, k, v)

    grader = GradingService()
    qs = [
        Q(1, "MULTIPLE_CHOICE", correct_option=0, correct_answer=None, correct_answers=None, sub_questions=None, blanks=None),
        Q(2, "TRUE_FALSE", correct_option=None, correct_answer=None, correct_answers=None, sub_questions=[{"id": 1, "correct": True}, {"id": 2, "correct": False}], blanks=None),
    ]
    score, correct, graded = grader.grade(qs, {"1": 0, "2": {"1": True, "2": False}})
    assert score > 0
    assert correct == 2
    assert graded["1"]["is_correct"] is True


def test_secure_upload_endpoint_registered():
    from app.routers import questions
    routes = [getattr(r, "path", "") for r in questions.router.routes]
    assert "/upload-image" in "".join(routes) or any("/upload-image" in p for p in routes)
    # Dangerous RCE endpoint must be removed
    assert not any("generate-image-py" in p for p in routes)


def test_ast_sandbox_security():
    from app.services.rendering_service import SafeASTValidator, SecurityViolation

    dangerous_payloads = [
        "import os\nos.system('dir')",
        "__import__('subprocess').call(['calc.exe'])",
        "eval('1+1')",
        "exec('print(1)')",
        "open('test.txt', 'w').write('bad')",
        "().__class__.__base__.__subclasses__()",
        "import sys\nsys.exit(0)",
    ]

    for payload in dangerous_payloads:
        with pytest.raises(SecurityViolation):
            SafeASTValidator.validate(payload)

    # Safe payload without import (np and plt are pre-injected) should validate successfully
    safe_code = (
        "x = np.linspace(-3, 3, 100)\n"
        "y = x**2\n"
        "plt.plot(x, y)\n"
        "plt.grid(True)\n"
    )
    assert SafeASTValidator.validate(safe_code) is True


def test_moet_true_false_and_total_score_normalization():
    from app.services.grading import GradingService, calculate_total_score

    class Q:
        def __init__(self, id, qtype, **kwargs):
            self.id = id
            self.question_type = qtype
            for k, v in kwargs.items():
                setattr(self, k, v)

    grader = GradingService()

    # 4-statement True/False question
    sub_questions = [
        {"id": "0", "correct": True},
        {"id": "1", "correct": False},
        {"id": "2", "correct": True},
        {"id": "3", "correct": False},
    ]
    q_tf = Q(10, "TRUE_FALSE", correct_option=None, correct_answer=None, correct_answers=None, sub_questions=sub_questions, blanks=None)

    # Test 1 correct sub-answer: MOET ratio is 0.1
    score_1, _, graded_1 = grader.grade([q_tf], {"10": {"0": True, "1": True, "2": False, "3": True}})
    assert pytest.approx(graded_1["10"]["points_awarded"], 0.01) == 0.1

    # Test 2 correct sub-answers: MOET ratio is 0.25
    score_2, _, graded_2 = grader.grade([q_tf], {"10": {"0": True, "1": False, "2": False, "3": True}})
    assert pytest.approx(graded_2["10"]["points_awarded"], 0.01) == 0.25

    # Test 3 correct sub-answers: MOET ratio is 0.5
    score_3, _, graded_3 = grader.grade([q_tf], {"10": {"0": True, "1": False, "2": True, "3": True}})
    assert pytest.approx(graded_3["10"]["points_awarded"], 0.01) == 0.5

    # Test 4 correct sub-answers: MOET ratio is 1.0
    score_4, _, graded_4 = grader.grade([q_tf], {"10": {"0": True, "1": False, "2": True, "3": False}})
    assert pytest.approx(graded_4["10"]["points_awarded"], 0.01) == 1.0

    # Test calculate_total_score normalization to 10.0 scale:
    # 1. Pure objective exam: 10 questions, auto_score 5.0, 0 essay -> 5.0
    tot_obj = calculate_total_score(10, 5.0, 0, [])
    assert tot_obj == 5.0

    # 2. Pure essay exam: 0 objective, 2 essay questions scored 8.0 and 9.0 -> 8.5
    tot_essay = calculate_total_score(0, 0.0, 2, [8.0, 9.0])
    assert tot_essay == 8.5

    # 3. Mixed exam: 7 objective questions (10.0), 3 essay questions (avg 9.0)
    # Total = (7*10 + 3*9)/10 = 9.7
    tot_mixed = calculate_total_score(7, 10.0, 3, [8.0, 9.0, 10.0])
    assert tot_mixed == 9.7

