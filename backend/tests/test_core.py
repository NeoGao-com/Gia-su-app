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
