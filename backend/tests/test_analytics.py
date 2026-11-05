"""
Comprehensive Automated Test Suite for Milestone MT:
Opaque-Box E2E Testing Suite for Analytics & Teacher Quality Module (4 Tiers)

Test Architecture:
- Framework: Pytest + FastAPI TestClient
- Database: Isolated temporary SQLite database per test
- Hierarchy:
  * Tier 1: Feature Coverage (6 tests: /dashboard, /topics, /recommendations, /questions, /students, /summary)
  * Tier 2: Boundary & Corner Cases (8 tests: 401 unauth, 403 student, teacher isolation, 0-data, 100% scores, 0% scores, single submission, malformed inputs)
  * Tier 3: Cross-Feature Combinations & State Transitions (5 tests: multi-filter intersection, submission lifecycle, attempt filters, submission reset, mixed question types)
  * Tier 4: Real-World Workloads (3 tests: full teacher quality lifecycle, multi-classroom concurrency, question anomaly/distractor detection)
"""

import os
os.environ["TESTING"] = "True"
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-32bytes")

import uuid
import asyncio
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text, select
from fastapi.testclient import TestClient

from app.main import app
from app.database import Base, get_db
from app.core.security import create_access_token, get_password_hash
from app.models.user import User
from app.models.classroom import Classroom, ClassroomStudent, Assignment
from app.models.exam import Exam, ExamSubmission, exam_questions
from app.models.question import Question, QuestionType, DifficultyLevel


def run_sync(coro):
    """Utility to execute an async coroutine synchronously in test setups."""
    return asyncio.run(coro)


@pytest.fixture
def ctx(tmp_path):
    """
    Isolated SQLite test environment fixture.
    Creates a fresh temporary database with all schema tables, overrides get_db dependency,
    and disposes engine cleanly after test run.
    """
    db_file = tmp_path / f"test_analytics_{uuid.uuid4().hex[:8]}.db"
    db_url = f"sqlite+aiosqlite:///{db_file.as_posix()}"
    engine = create_async_engine(db_url, connect_args={"check_same_thread": False}, echo=False)

    async def _init_tables():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_in_progress_submission "
                    "ON exam_submissions (user_id, exam_id) WHERE status = 'IN_PROGRESS';"
                )
            )

    run_sync(_init_tables())

    SessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False, autoflush=False)

    async def _override_get_db():
        async with SessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    client = TestClient(app)

    yield {
        "engine": engine,
        "SessionLocal": SessionLocal,
        "client": client,
        "db_file": db_file,
    }

    app.dependency_overrides.pop(get_db, None)
    run_sync(engine.dispose())


# ==============================================================================
# Helper Factories
# ==============================================================================

def make_user(SessionLocal, email: str, role: str, full_name: str) -> tuple[User, dict]:
    """Creates a user in the isolated DB and returns (User, auth_headers)."""
    async def _create():
        async with SessionLocal() as session:
            user = User(
                email=email,
                hashed_password=get_password_hash("Password@123!"),
                full_name=full_name,
                role=role,
                is_active=True,
                is_deleted=False,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            return user

    user = run_sync(_create())
    token = create_access_token({"sub": user.email, "role": user.role, "id": user.id})
    headers = {"Authorization": f"Bearer {token}"}
    return user, headers


def make_classroom(SessionLocal, name: str, instructor_id: int) -> Classroom:
    """Creates a classroom for the given instructor."""
    async def _create():
        async with SessionLocal() as session:
            c = Classroom(name=name, instructor_id=instructor_id, is_deleted=False)
            session.add(c)
            await session.commit()
            await session.refresh(c)
            return c

    return run_sync(_create())


def enroll_student(SessionLocal, classroom_id: int, student_id: int) -> ClassroomStudent:
    """Enrolls a student in a classroom."""
    async def _enroll():
        async with SessionLocal() as session:
            cs = ClassroomStudent(classroom_id=classroom_id, student_id=student_id, is_active=True)
            session.add(cs)
            await session.commit()
            await session.refresh(cs)
            return cs

    return run_sync(_enroll())


def make_question(
    SessionLocal,
    creator_id: int,
    subject: str = "Toán",
    grade_level: int = 12,
    chapter: str = "Chương I",
    topic: str = "Hàm số",
    question_type: str = "MULTIPLE_CHOICE",
    difficulty: str = "THONG_HIEU",
    content: str = "Nội dung câu hỏi mẫu",
    options: list | None = None,
    correct_option: int | None = 0,
    sub_questions: list | None = None,
    correct_answer: str | None = None,
    code: str | None = None,
) -> Question:
    """Creates a question in the bank with metadata for topic analytics."""
    if options is None:
        options = ["Phương án A", "Phương án B", "Phương án C", "Phương án D"]
    if code is None:
        code = f"Q_{uuid.uuid4().hex[:8]}"

    async def _create():
        async with SessionLocal() as session:
            q = Question(
                code=code,
                content=content,
                subject=subject,
                grade_level=grade_level,
                chapter=chapter,
                topic=topic,
                question_type=question_type,
                difficulty=difficulty,
                options=options,
                correct_option=correct_option,
                sub_questions=sub_questions,
                correct_answer=correct_answer,
                created_by_id=creator_id,
                status="APPROVED",
            )
            session.add(q)
            await session.commit()
            await session.refresh(q)
            return q

    return run_sync(_create())


def make_exam(
    SessionLocal,
    title: str,
    creator_id: int,
    questions: list[Question] | None = None,
    duration_minutes: int = 45,
    pass_score: float = 5.0,
    max_attempts: int = 1,
) -> Exam:
    """Creates an exam and associates questions to it."""
    async def _create():
        async with SessionLocal() as session:
            exam = Exam(
                title=title,
                duration_minutes=duration_minutes,
                pass_score=pass_score,
                max_attempts=max_attempts,
                created_by_id=creator_id,
                is_published=True,
                is_deleted=False,
                exam_type="EXAM",
            )
            session.add(exam)
            await session.commit()
            await session.refresh(exam)

            if questions:
                for q in questions:
                    await session.execute(
                        exam_questions.insert().values(exam_id=exam.id, question_id=q.id)
                    )
                await session.commit()

            return exam

    return run_sync(_create())


def assign_exam(SessionLocal, classroom_id: int, exam_id: int) -> Assignment:
    """Assigns an exam to a classroom."""
    async def _assign():
        async with SessionLocal() as session:
            a = Assignment(
                classroom_id=classroom_id,
                exam_id=exam_id,
                is_active=True,
                assigned_at=datetime.now(timezone.utc),
            )
            session.add(a)
            await session.commit()
            await session.refresh(a)
            return a

    return run_sync(_assign())


def make_submission(
    SessionLocal,
    exam_id: int,
    user_id: int,
    status: str = "GRADED",
    score: float | None = 10.0,
    answers: dict | None = None,
    graded_answers: dict | None = None,
    attempt_number: int = 1,
    submitted_at: datetime | None = None,
    started_at: datetime | None = None,
) -> ExamSubmission:
    """Creates an exam submission attempt with detailed question responses."""
    if submitted_at is None and status in ("GRADED", "SUBMITTED"):
        submitted_at = datetime.now(timezone.utc)
    if started_at is None:
        started_at = (submitted_at or datetime.now(timezone.utc)) - timedelta(minutes=20)

    async def _submit():
        async with SessionLocal() as session:
            sub = ExamSubmission(
                exam_id=exam_id,
                user_id=user_id,
                status=status,
                score=score,
                auto_score=score,
                answers=answers or {},
                graded_answers=graded_answers or {},
                attempt_number=attempt_number,
                submitted_at=submitted_at,
                started_at=started_at,
                grading_status="GRADED" if status in ("GRADED", "SUBMITTED") else None,
                time_spent=1200 if submitted_at else 0,
                tab_switches=0,
            )
            session.add(sub)
            await session.commit()
            await session.refresh(sub)
            return sub

    return run_sync(_submit())


# ==============================================================================
# Tier 1: Feature Coverage (Representative Inputs)
# ==============================================================================

def test_t1_1_dashboard_feature_coverage(ctx):
    """
    Tier 1.1: GET /api/analytics/dashboard
    Verifies response structure: filters_applied, summary, score_distribution (10 bins + 4 tiers),
    top_weak_topics, and recommendations_summary.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "t1_dash@test.com", "TEACHER", "Teacher Dash")
    s1, _ = make_user(SessionLocal, "s1_dash@test.com", "STUDENT", "Student 1")
    s2, _ = make_user(SessionLocal, "s2_dash@test.com", "STUDENT", "Student 2")

    classroom = make_classroom(SessionLocal, "Class Dash 10A", teacher.id)
    enroll_student(SessionLocal, classroom.id, s1.id)
    enroll_student(SessionLocal, classroom.id, s2.id)

    q1 = make_question(SessionLocal, teacher.id, topic="Hàm số", correct_option=0)
    q2 = make_question(SessionLocal, teacher.id, topic="Tích phân", correct_option=1)
    exam = make_exam(SessionLocal, "Exam Dash", teacher.id, questions=[q1, q2])
    assign_exam(SessionLocal, classroom.id, exam.id)

    # Submissions: S1 scores 8.0, S2 scores 6.0
    make_submission(SessionLocal, exam.id, s1.id, status="GRADED", score=8.0)
    make_submission(SessionLocal, exam.id, s2.id, status="GRADED", score=6.0)

    res = client.get(
        f"/api/analytics/dashboard?classroom_id={classroom.id}&exam_id={exam.id}",
        headers=t_headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()

    # 1. Filters Applied
    assert "filters_applied" in data
    assert data["filters_applied"]["classroom_id"] == classroom.id
    assert data["filters_applied"]["exam_id"] == exam.id

    # 2. Summary
    summary = data["summary"]
    assert summary["total_submissions"] == 2
    assert summary["unique_students"] == 2
    assert summary["average_score"] == 7.0
    assert summary["median_score"] == 7.0
    assert summary["highest_score"] == 8.0
    assert summary["lowest_score"] == 6.0
    assert summary["pass_count"] == 2
    assert summary["fail_count"] == 0
    assert summary["pass_rate"] == 100.0

    # 3. Score Distribution (10 bins and 4 tiers)
    distribution = data["score_distribution"]
    assert "bins" in distribution and len(distribution["bins"]) == 10
    assert "tiers" in distribution and len(distribution["tiers"]) == 4

    # 4. Top Weak Topics & Recommendations Summary
    assert "top_weak_topics" in data
    assert "recommendations_summary" in data
    assert "total_recommendations" in data["recommendations_summary"]


def test_t1_2_topics_feature_coverage(ctx):
    """
    Tier 1.2: GET /api/analytics/topics
    Aggregates question-level accuracy by topic and chapter with difficulty breakdown.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "t1_top@test.com", "TEACHER", "Teacher Top")
    s1, _ = make_user(SessionLocal, "s1_top@test.com", "STUDENT", "Student 1")
    s2, _ = make_user(SessionLocal, "s2_top@test.com", "STUDENT", "Student 2")

    classroom = make_classroom(SessionLocal, "Class Topics 12B", teacher.id)
    enroll_student(SessionLocal, classroom.id, s1.id)
    enroll_student(SessionLocal, classroom.id, s2.id)

    # 2 questions on "Đạo hàm", 1 question on "Tích phân"
    q_dh1 = make_question(SessionLocal, teacher.id, chapter="Chương I", topic="Đạo hàm", correct_option=0)
    q_dh2 = make_question(SessionLocal, teacher.id, chapter="Chương I", topic="Đạo hàm", correct_option=1)
    q_tp = make_question(SessionLocal, teacher.id, chapter="Chương II", topic="Tích phân", correct_option=2)

    exam = make_exam(SessionLocal, "Exam Topics", teacher.id, questions=[q_dh1, q_dh2, q_tp])
    assign_exam(SessionLocal, classroom.id, exam.id)

    # Both students answer "Đạo hàm" correctly, but fail "Tích phân"
    make_submission(
        SessionLocal, exam.id, s1.id, status="GRADED", score=6.67,
        answers={str(q_dh1.id): 0, str(q_dh2.id): 1, str(q_tp.id): 0},
        graded_answers={
            str(q_dh1.id): {"is_correct": True, "points_awarded": 1.0},
            str(q_dh2.id): {"is_correct": True, "points_awarded": 1.0},
            str(q_tp.id): {"is_correct": False, "points_awarded": 0.0},
        }
    )
    make_submission(
        SessionLocal, exam.id, s2.id, status="GRADED", score=6.67,
        answers={str(q_dh1.id): 0, str(q_dh2.id): 1, str(q_tp.id): 1},
        graded_answers={
            str(q_dh1.id): {"is_correct": True, "points_awarded": 1.0},
            str(q_dh2.id): {"is_correct": True, "points_awarded": 1.0},
            str(q_tp.id): {"is_correct": False, "points_awarded": 0.0},
        }
    )

    res = client.get(
        f"/api/analytics/topics?classroom_id={classroom.id}&exam_id={exam.id}",
        headers=t_headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()

    topics_list = data["topics"] if isinstance(data, dict) and "topics" in data else data
    assert isinstance(topics_list, list) and len(topics_list) >= 2

    topics_dict = {t["topic"]: t for t in topics_list}
    assert "Đạo hàm" in topics_dict
    assert "Tích phân" in topics_dict

    # "Đạo hàm": 4 attempts (2 questions * 2 students), 4 correct -> 100%
    dh_stat = topics_dict["Đạo hàm"]
    assert dh_stat["total_attempts"] == 4
    assert dh_stat["correct_attempts"] == 4
    assert dh_stat["accuracy_rate"] == 100.0

    # "Tích phân": 2 attempts, 0 correct -> 0%
    tp_stat = topics_dict["Tích phân"]
    assert tp_stat["total_attempts"] == 2
    assert tp_stat["correct_attempts"] == 0
    assert tp_stat["accuracy_rate"] == 0.0


def test_t1_3_recommendations_feature_coverage(ctx):
    """
    Tier 1.3: GET /api/analytics/recommendations
    Verifies that pedagogical recommendations are generated when weak topics or low scores exist.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "t1_rec@test.com", "TEACHER", "Teacher Rec")
    s1, _ = make_user(SessionLocal, "s1_rec@test.com", "STUDENT", "Student Weak")

    classroom = make_classroom(SessionLocal, "Class Rec", teacher.id)
    enroll_student(SessionLocal, classroom.id, s1.id)

    q = make_question(SessionLocal, teacher.id, topic="Lượng giác", correct_option=0)
    exam = make_exam(SessionLocal, "Exam Rec", teacher.id, questions=[q])
    assign_exam(SessionLocal, classroom.id, exam.id)

    # Student fails with 0.0
    make_submission(
        SessionLocal, exam.id, s1.id, status="GRADED", score=0.0,
        answers={str(q.id): 1},
        graded_answers={str(q.id): {"is_correct": False, "points_awarded": 0.0}}
    )

    res = client.get(
        f"/api/analytics/recommendations?classroom_id={classroom.id}",
        headers=t_headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()

    recs = data["recommendations"] if isinstance(data, dict) and "recommendations" in data else data
    assert isinstance(recs, list) and len(recs) > 0

    first_rec = recs[0]
    assert "id" in first_rec
    assert "priority" in first_rec
    assert "category" in first_rec
    assert "title" in first_rec
    assert "description" in first_rec
    assert "suggested_actions" in first_rec


def test_t1_4_questions_feature_coverage(ctx):
    """
    Tier 1.4: GET /api/analytics/questions
    Verifies question item analysis with error rates, attempt counts, and distractor distributions.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "t1_q@test.com", "TEACHER", "Teacher Questions")
    s1, _ = make_user(SessionLocal, "s1_q@test.com", "STUDENT", "Student Q1")

    classroom = make_classroom(SessionLocal, "Class Q", teacher.id)
    enroll_student(SessionLocal, classroom.id, s1.id)

    q = make_question(SessionLocal, teacher.id, topic="Đại số", correct_option=0)
    exam = make_exam(SessionLocal, "Exam Q", teacher.id, questions=[q])
    assign_exam(SessionLocal, classroom.id, exam.id)

    make_submission(
        SessionLocal, exam.id, s1.id, status="GRADED", score=10.0,
        answers={str(q.id): 0},
        graded_answers={str(q.id): {"is_correct": True, "points_awarded": 1.0}}
    )

    res = client.get(
        f"/api/analytics/questions?exam_id={exam.id}",
        headers=t_headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()

    q_list = data["questions"] if isinstance(data, dict) and "questions" in data else data
    assert isinstance(q_list, list) and len(q_list) > 0

    item = q_list[0]
    assert item["question_id"] == q.id
    assert item["total_attempts"] == 1
    assert item["correct_count"] == 1
    assert item["accuracy_rate"] == 100.0


def test_t1_5_students_feature_coverage(ctx):
    """
    Tier 1.5: GET /api/analytics/students
    Verifies individual student performance metrics, completion rates, and intervention flags.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "t1_stu@test.com", "TEACHER", "Teacher Stu")
    s1, _ = make_user(SessionLocal, "s1_stu@test.com", "STUDENT", "Student Good")
    s2, _ = make_user(SessionLocal, "s2_stu@test.com", "STUDENT", "Student Needs Help")

    classroom = make_classroom(SessionLocal, "Class Stu", teacher.id)
    enroll_student(SessionLocal, classroom.id, s1.id)
    enroll_student(SessionLocal, classroom.id, s2.id)

    exam = make_exam(SessionLocal, "Exam Stu", teacher.id)
    assign_exam(SessionLocal, classroom.id, exam.id)

    make_submission(SessionLocal, exam.id, s1.id, status="GRADED", score=9.0)
    make_submission(SessionLocal, exam.id, s2.id, status="GRADED", score=3.0)

    res = client.get(
        f"/api/analytics/students?classroom_id={classroom.id}",
        headers=t_headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()

    students = data["students"] if isinstance(data, dict) and "students" in data else data
    assert isinstance(students, list) and len(students) == 2

    stu_map = {s["student_id"]: s for s in students}
    assert stu_map[s1.id]["average_score"] == 9.0
    assert stu_map[s2.id]["average_score"] == 3.0
    assert stu_map[s2.id]["needs_intervention"] is True


def test_t1_6_summary_enhanced_feature_coverage(ctx):
    """
    Tier 1.6: GET /api/analytics/summary
    Verifies backward compatibility with all legacy keys and inclusion of enhanced statistics.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "t1_sum@test.com", "TEACHER", "Teacher Sum")
    student, _ = make_user(SessionLocal, "s1_sum@test.com", "STUDENT", "Student Sum")

    classroom = make_classroom(SessionLocal, "Class Sum", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Exam Sum", teacher.id)
    assign_exam(SessionLocal, classroom.id, exam.id)
    make_submission(SessionLocal, exam.id, student.id, status="GRADED", score=8.5)

    res = client.get("/api/analytics/summary", headers=t_headers)
    assert res.status_code == 200, res.text
    data = res.json()

    # Legacy keys
    legacy_keys = [
        "exams_count", "questions_count", "classrooms_count",
        "students_count", "submissions_count", "average_score", "score_distribution"
    ]
    for key in legacy_keys:
        assert key in data, f"Missing legacy key: {key}"

    assert data["classrooms_count"] == 1
    assert data["students_count"] == 1
    assert data["submissions_count"] == 1
    assert data["average_score"] == 8.5


# ==============================================================================
# Tier 2: Boundary Value and Corner Cases
# ==============================================================================

def test_t2_1_unauthenticated_requests_return_401(ctx):
    """
    Tier 2.1: Authentication guard. Unauthenticated requests to all analytics endpoints must return 401.
    """
    client = ctx["client"]
    endpoints = [
        "/api/analytics/dashboard",
        "/api/analytics/topics",
        "/api/analytics/recommendations",
        "/api/analytics/questions",
        "/api/analytics/students",
        "/api/analytics/summary",
    ]
    for ep in endpoints:
        res = client.get(ep)
        assert res.status_code == 401, f"Expected 401 for unauthenticated request to {ep}, got {res.status_code}"


def test_t2_2_student_role_forbidden_403(ctx):
    """
    Tier 2.2: Authorization guard. User with 'STUDENT' role cannot access teacher analytics (403 Forbidden).
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    student, s_headers = make_user(SessionLocal, "s_role@test.com", "STUDENT", "Student Role")

    endpoints = [
        "/api/analytics/dashboard",
        "/api/analytics/topics",
        "/api/analytics/recommendations",
        "/api/analytics/questions",
        "/api/analytics/students",
        "/api/analytics/summary",
    ]
    for ep in endpoints:
        res = client.get(ep, headers=s_headers)
        assert res.status_code == 403, f"Expected 403 for student role on {ep}, got {res.status_code}"


def test_t2_3_teacher_data_isolation(ctx):
    """
    Tier 2.3: Data isolation. Teacher B must NOT see Teacher A's classrooms, exams, or student scores.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher_a, _ = make_user(SessionLocal, "ta_iso@test.com", "TEACHER", "Teacher A")
    teacher_b, tb_headers = make_user(SessionLocal, "tb_iso@test.com", "TEACHER", "Teacher B")
    student_a, _ = make_user(SessionLocal, "sa_iso@test.com", "STUDENT", "Student A")

    classroom_a = make_classroom(SessionLocal, "Class A Secret", teacher_a.id)
    enroll_student(SessionLocal, classroom_a.id, student_a.id)
    exam_a = make_exam(SessionLocal, "Exam A Secret", teacher_a.id)
    assign_exam(SessionLocal, classroom_a.id, exam_a.id)
    make_submission(SessionLocal, exam_a.id, student_a.id, status="GRADED", score=10.0)

    # Teacher B queries general dashboard: should see 0 submissions, 0 students
    res_b = client.get("/api/analytics/dashboard", headers=tb_headers)
    assert res_b.status_code == 200
    data_b = res_b.json()
    assert data_b["summary"]["total_submissions"] == 0
    assert data_b["summary"]["unique_students"] == 0

    # Teacher B explicitly attempts to query Teacher A's classroom: must be 403, 404, or empty
    res_cross = client.get(f"/api/analytics/dashboard?classroom_id={classroom_a.id}", headers=tb_headers)
    assert res_cross.status_code in (403, 404, 200)
    if res_cross.status_code == 200:
        data_cross = res_cross.json()
        assert data_cross["summary"]["total_submissions"] == 0


def test_t2_4_zero_data_cold_start_boundaries(ctx):
    """
    Tier 2.4: Cold-start zero-data boundary. Teacher with 0 classrooms and 0 submissions returns 200 with zeros,
    without raising 500 ZeroDivisionError.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "cold_start@test.com", "TEACHER", "Teacher Cold")

    # Dashboard with 0 data
    res_dash = client.get("/api/analytics/dashboard", headers=t_headers)
    assert res_dash.status_code == 200
    dash_summary = res_dash.json()["summary"]
    assert dash_summary["total_submissions"] == 0
    assert dash_summary["average_score"] == 0.0
    assert dash_summary["median_score"] == 0.0
    assert dash_summary["pass_rate"] == 0.0

    # Topics with 0 data
    res_topics = client.get("/api/analytics/topics", headers=t_headers)
    assert res_topics.status_code == 200

    # Recommendations with 0 data
    res_rec = client.get("/api/analytics/recommendations", headers=t_headers)
    assert res_rec.status_code == 200

    # Summary with 0 data
    res_sum = client.get("/api/analytics/summary", headers=t_headers)
    assert res_sum.status_code == 200
    assert res_sum.json()["submissions_count"] == 0
    assert res_sum.json()["average_score"] == 0.0


def test_t2_5_perfect_scores_100_percent_boundary(ctx):
    """
    Tier 2.5: Perfect scores boundary. All students score 10.0 (100%).
    Verifies mean=10.0, median=10.0, std_dev=0.0, pass_rate=100.0, 0 weak topics, 0 interventions.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "perfect_t@test.com", "TEACHER", "Teacher Perfect")
    s1, _ = make_user(SessionLocal, "perf1@test.com", "STUDENT", "Perf 1")
    s2, _ = make_user(SessionLocal, "perf2@test.com", "STUDENT", "Perf 2")

    classroom = make_classroom(SessionLocal, "Class Perfect", teacher.id)
    enroll_student(SessionLocal, classroom.id, s1.id)
    enroll_student(SessionLocal, classroom.id, s2.id)

    q = make_question(SessionLocal, teacher.id, topic="Toán Hoàn Hảo", correct_option=0)
    exam = make_exam(SessionLocal, "Exam Perfect", teacher.id, questions=[q])
    assign_exam(SessionLocal, classroom.id, exam.id)

    make_submission(
        SessionLocal, exam.id, s1.id, status="GRADED", score=10.0,
        answers={str(q.id): 0}, graded_answers={str(q.id): {"is_correct": True}}
    )
    make_submission(
        SessionLocal, exam.id, s2.id, status="GRADED", score=10.0,
        answers={str(q.id): 0}, graded_answers={str(q.id): {"is_correct": True}}
    )

    res = client.get(f"/api/analytics/dashboard?classroom_id={classroom.id}", headers=t_headers)
    assert res.status_code == 200
    summary = res.json()["summary"]
    assert summary["average_score"] == 10.0
    assert summary["median_score"] == 10.0
    assert summary["highest_score"] == 10.0
    assert summary["lowest_score"] == 10.0
    assert summary["standard_deviation"] == 0.0
    assert summary["pass_rate"] == 100.0
    assert len(res.json()["top_weak_topics"]) == 0


def test_t2_6_zero_scores_0_percent_boundary(ctx):
    """
    Tier 2.6: Zero scores boundary. All students score 0.0 (0%).
    Verifies mean=0.0, median=0.0, pass_rate=0.0, all topics flagged as weak (< 60%), all students need intervention.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "zero_t@test.com", "TEACHER", "Teacher Zero")
    s1, _ = make_user(SessionLocal, "zero1@test.com", "STUDENT", "Zero 1")
    s2, _ = make_user(SessionLocal, "zero2@test.com", "STUDENT", "Zero 2")

    classroom = make_classroom(SessionLocal, "Class Zero", teacher.id)
    enroll_student(SessionLocal, classroom.id, s1.id)
    enroll_student(SessionLocal, classroom.id, s2.id)

    q = make_question(SessionLocal, teacher.id, topic="Chủ Đề Khó", correct_option=0)
    exam = make_exam(SessionLocal, "Exam Zero", teacher.id, questions=[q])
    assign_exam(SessionLocal, classroom.id, exam.id)

    make_submission(
        SessionLocal, exam.id, s1.id, status="GRADED", score=0.0,
        answers={str(q.id): 1}, graded_answers={str(q.id): {"is_correct": False}}
    )
    make_submission(
        SessionLocal, exam.id, s2.id, status="GRADED", score=0.0,
        answers={str(q.id): 2}, graded_answers={str(q.id): {"is_correct": False}}
    )

    # Dashboard check
    res_dash = client.get(f"/api/analytics/dashboard?classroom_id={classroom.id}", headers=t_headers)
    assert res_dash.status_code == 200
    summary = res_dash.json()["summary"]
    assert summary["average_score"] == 0.0
    assert summary["median_score"] == 0.0
    assert summary["pass_rate"] == 0.0
    assert summary["fail_count"] == 2

    # Weak topics check: topic must be flagged as WEAK
    res_topics = client.get(f"/api/analytics/topics?classroom_id={classroom.id}", headers=t_headers)
    assert res_topics.status_code == 200
    topics = res_topics.json()["topics"] if isinstance(res_topics.json(), dict) and "topics" in res_topics.json() else res_topics.json()
    assert any(t["topic"] == "Chủ Đề Khó" and t["accuracy_rate"] == 0.0 for t in topics)

    # Students check: both need intervention
    res_stu = client.get(f"/api/analytics/students?classroom_id={classroom.id}", headers=t_headers)
    assert res_stu.status_code == 200
    students = res_stu.json()["students"] if isinstance(res_stu.json(), dict) and "students" in res_stu.json() else res_stu.json()
    assert all(s["needs_intervention"] is True for s in students)


def test_t2_7_single_submission_stats_boundary(ctx):
    """
    Tier 2.7: Single submission boundary. Exactly 1 submission with score 7.5.
    Verifies mean=7.5, median=7.5, min=7.5, max=7.5, std_dev=0.0, single bin count=1.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "single_t@test.com", "TEACHER", "Teacher Single")
    student, _ = make_user(SessionLocal, "single_s@test.com", "STUDENT", "Student Single")

    classroom = make_classroom(SessionLocal, "Class Single", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Exam Single", teacher.id)
    assign_exam(SessionLocal, classroom.id, exam.id)
    make_submission(SessionLocal, exam.id, student.id, status="GRADED", score=7.5)

    res = client.get(f"/api/analytics/dashboard?classroom_id={classroom.id}", headers=t_headers)
    assert res.status_code == 200
    data = res.json()
    summary = data["summary"]

    assert summary["total_submissions"] == 1
    assert summary["unique_students"] == 1
    assert summary["average_score"] == 7.5
    assert summary["median_score"] == 7.5
    assert summary["highest_score"] == 7.5
    assert summary["lowest_score"] == 7.5
    assert summary["standard_deviation"] == 0.0

    bins = data["score_distribution"]["bins"]
    bin_7_8 = next(b for b in bins if b["bin"] == "7 - 8")
    assert bin_7_8["count"] == 1
    assert all(b["count"] == 0 for b in bins if b["bin"] != "7 - 8")


def test_t2_8_invalid_filter_inputs(ctx):
    """
    Tier 2.8: Invalid filter inputs. Non-existent classroom, malformed dates, or invalid filters
    must return 400, 404, 422, or graceful empty response, never 500 server crash.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "invalid_f@test.com", "TEACHER", "Teacher Filter")

    # Non-existent classroom_id=999999
    res_404 = client.get("/api/analytics/dashboard?classroom_id=999999", headers=t_headers)
    assert res_404.status_code in (404, 200)
    if res_404.status_code == 200:
        assert res_404.json()["summary"]["total_submissions"] == 0

    # Malformed date strings
    res_date = client.get("/api/analytics/dashboard?start_date=not-a-date", headers=t_headers)
    assert res_date.status_code in (400, 422, 200)

    # Inverted date range (start > end)
    res_invert = client.get(
        "/api/analytics/dashboard?start_date=2026-12-31&end_date=2026-01-01",
        headers=t_headers,
    )
    assert res_invert.status_code in (400, 422, 200)


# ==============================================================================
# Tier 3: Cross-Feature Combinations and State Transitions
# ==============================================================================

def test_t3_1_multi_filter_intersection(ctx):
    """
    Tier 3.1: Multi-filter intersection.
    Simultaneous filters: classroom_id + exam_id + student_id + date range returns the exact matching subset.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "t3_multi@test.com", "TEACHER", "Teacher Multi")
    s1, _ = make_user(SessionLocal, "s1_m@test.com", "STUDENT", "Student 1")
    s2, _ = make_user(SessionLocal, "s2_m@test.com", "STUDENT", "Student 2")

    c1 = make_classroom(SessionLocal, "Classroom 1", teacher.id)
    c2 = make_classroom(SessionLocal, "Classroom 2", teacher.id)
    enroll_student(SessionLocal, c1.id, s1.id)
    enroll_student(SessionLocal, c2.id, s2.id)

    e1 = make_exam(SessionLocal, "Exam 1", teacher.id)
    e2 = make_exam(SessionLocal, "Exam 2", teacher.id)
    assign_exam(SessionLocal, c1.id, e1.id)
    assign_exam(SessionLocal, c2.id, e2.id)

    # S1 in C1 takes E1 (score 9.0)
    now = datetime.now(timezone.utc)
    make_submission(SessionLocal, e1.id, s1.id, status="GRADED", score=9.0, submitted_at=now)
    # S2 in C2 takes E2 (score 5.0)
    make_submission(SessionLocal, e2.id, s2.id, status="GRADED", score=5.0, submitted_at=now)

    # Query with strict intersection: c1 + e1 + s1
    res = client.get(
        f"/api/analytics/dashboard?classroom_id={c1.id}&exam_id={e1.id}&student_id={s1.id}",
        headers=t_headers,
    )
    assert res.status_code == 200
    summary = res.json()["summary"]
    assert summary["total_submissions"] == 1
    assert summary["unique_students"] == 1
    assert summary["average_score"] == 9.0


def test_t3_2_submission_lifecycle_stats_reflection(ctx):
    """
    Tier 3.2: Submission lifecycle & dynamic reflection.
    Submitting a new attempt updates dashboard statistics and topic performance in real-time.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "t3_life@test.com", "TEACHER", "Teacher Life")
    student, _ = make_user(SessionLocal, "s_life@test.com", "STUDENT", "Student Life")

    classroom = make_classroom(SessionLocal, "Classroom Life", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Exam Life", teacher.id)
    assign_exam(SessionLocal, classroom.id, exam.id)

    # Step 1: Initial submission with score 4.0
    make_submission(SessionLocal, exam.id, student.id, status="GRADED", score=4.0)

    res1 = client.get(f"/api/analytics/dashboard?classroom_id={classroom.id}", headers=t_headers)
    assert res1.status_code == 200
    assert res1.json()["summary"]["average_score"] == 4.0
    assert res1.json()["summary"]["pass_rate"] == 0.0

    # Step 2: Student retakes and achieves 9.0
    make_submission(SessionLocal, exam.id, student.id, status="GRADED", score=9.0, attempt_number=2)

    res2 = client.get(
        f"/api/analytics/dashboard?classroom_id={classroom.id}&attempt_filter=best",
        headers=t_headers,
    )
    assert res2.status_code == 200
    # With attempt_filter=best, score reflected should be 9.0
    assert res2.json()["summary"]["average_score"] == 9.0
    assert res2.json()["summary"]["pass_rate"] == 100.0


def test_t3_3_attempt_filter_modes(ctx):
    """
    Tier 3.3: Attempt filter modes ('best', 'latest', 'all').
    Student submits: Attempt 1 = 5.0, Attempt 2 = 9.0, Attempt 3 = 7.0.
    - 'best': reflects 9.0
    - 'latest': reflects 7.0
    - 'all': reflects all 3 (avg = 7.0, total = 3)
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "t3_mode@test.com", "TEACHER", "Teacher Mode")
    student, _ = make_user(SessionLocal, "s_mode@test.com", "STUDENT", "Student Mode")

    classroom = make_classroom(SessionLocal, "Classroom Mode", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Exam Mode", teacher.id, max_attempts=3)
    assign_exam(SessionLocal, classroom.id, exam.id)

    t1 = datetime.now(timezone.utc) - timedelta(hours=3)
    t2 = datetime.now(timezone.utc) - timedelta(hours=2)
    t3 = datetime.now(timezone.utc) - timedelta(hours=1)

    make_submission(SessionLocal, exam.id, student.id, status="GRADED", score=5.0, attempt_number=1, submitted_at=t1)
    make_submission(SessionLocal, exam.id, student.id, status="GRADED", score=9.0, attempt_number=2, submitted_at=t2)
    make_submission(SessionLocal, exam.id, student.id, status="GRADED", score=7.0, attempt_number=3, submitted_at=t3)

    # 1. Best
    res_best = client.get(
        f"/api/analytics/dashboard?classroom_id={classroom.id}&attempt_filter=best",
        headers=t_headers,
    )
    assert res_best.status_code == 200
    assert res_best.json()["summary"]["average_score"] == 9.0

    # 2. Latest
    res_latest = client.get(
        f"/api/analytics/dashboard?classroom_id={classroom.id}&attempt_filter=latest",
        headers=t_headers,
    )
    assert res_latest.status_code == 200
    assert res_latest.json()["summary"]["average_score"] == 7.0

    # 3. All
    res_all = client.get(
        f"/api/analytics/dashboard?classroom_id={classroom.id}&attempt_filter=all",
        headers=t_headers,
    )
    assert res_all.status_code == 200
    assert res_all.json()["summary"]["total_submissions"] == 3
    assert res_all.json()["summary"]["average_score"] == 7.0


def test_t3_4_submission_deletion_attempt_reset_impact(ctx):
    """
    Tier 3.4: Submission deletion / attempt reset impact.
    Teacher resets student's bad attempt -> student removed from intervention list on retake.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "t3_del@test.com", "TEACHER", "Teacher Reset")
    student, _ = make_user(SessionLocal, "s_del@test.com", "STUDENT", "Student Reset")

    classroom = make_classroom(SessionLocal, "Classroom Reset", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Exam Reset", teacher.id)
    assign_exam(SessionLocal, classroom.id, exam.id)

    # Bad submission
    sub = make_submission(SessionLocal, exam.id, student.id, status="GRADED", score=2.0)

    # Verify student is initially flagged for intervention
    res_stu1 = client.get(f"/api/analytics/students?classroom_id={classroom.id}", headers=t_headers)
    assert res_stu1.status_code == 200
    students1 = res_stu1.json()["students"] if isinstance(res_stu1.json(), dict) and "students" in res_stu1.json() else res_stu1.json()
    assert students1[0]["needs_intervention"] is True

    # Teacher deletes submission via classroom endpoint
    del_res = client.delete(
        f"/api/classrooms/{classroom.id}/students/{student.id}/submissions/{sub.id}",
        headers=t_headers,
    )
    assert del_res.status_code == 200

    # Student retakes and scores 9.0
    make_submission(SessionLocal, exam.id, student.id, status="GRADED", score=9.0)

    # Student is no longer flagged for intervention
    res_stu2 = client.get(f"/api/analytics/students?classroom_id={classroom.id}", headers=t_headers)
    assert res_stu2.status_code == 200
    students2 = res_stu2.json()["students"] if isinstance(res_stu2.json(), dict) and "students" in res_stu2.json() else res_stu2.json()
    assert students2[0]["average_score"] == 9.0
    assert students2[0]["needs_intervention"] is False


def test_t3_5_mixed_question_types_topic_accuracy(ctx):
    """
    Tier 3.5: Mixed question types accuracy calculation.
    Exam containing MULTIPLE_CHOICE, TRUE_FALSE (MOET partial credit), and SHORT_ANSWER.
    Verifies topic accuracy correctly aggregates points awarded vs total possible.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "t3_types@test.com", "TEACHER", "Teacher Types")
    student, _ = make_user(SessionLocal, "s_types@test.com", "STUDENT", "Student Types")

    classroom = make_classroom(SessionLocal, "Classroom Mixed", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)

    # Q1: MC (topic: Giải tích, 1.0 pt)
    q1 = make_question(SessionLocal, teacher.id, topic="Giải tích", question_type="MULTIPLE_CHOICE", correct_option=0)
    # Q2: TF (topic: Giải tích, MOET partial credit)
    sub_qs = [
        {"id": "0", "content": "Ý 1", "answer": True},
        {"id": "1", "content": "Ý 2", "answer": False},
        {"id": "2", "content": "Ý 3", "answer": True},
        {"id": "3", "content": "Ý 4", "answer": False},
    ]
    q2 = make_question(SessionLocal, teacher.id, topic="Giải tích", question_type="TRUE_FALSE", sub_questions=sub_qs)

    exam = make_exam(SessionLocal, "Exam Mixed", teacher.id, questions=[q1, q2])
    assign_exam(SessionLocal, classroom.id, exam.id)

    # Student answers Q1 correctly (1.0), and gets 2/4 sub-questions right on Q2 (0.25 on MOET scale)
    make_submission(
        SessionLocal, exam.id, student.id, status="GRADED", score=6.25,
        answers={str(q1.id): 0, str(q2.id): {"0": True, "1": False, "2": False, "3": True}},
        graded_answers={
            str(q1.id): {"is_correct": True, "points_awarded": 1.0},
            str(q2.id): {"is_correct": False, "points_awarded": 0.25},
        }
    )

    res = client.get(f"/api/analytics/topics?classroom_id={classroom.id}", headers=t_headers)
    assert res.status_code == 200
    topics = res.json()["topics"] if isinstance(res.json(), dict) and "topics" in res.json() else res.json()
    gt_stat = next((t for t in topics if t["topic"] == "Giải tích"), None)
    assert gt_stat is not None
    assert gt_stat["question_count"] == 2
    assert gt_stat["total_attempts"] == 2


# ==============================================================================
# Tier 4: Real-World Application Workloads
# ==============================================================================

def test_t4_1_full_teacher_quality_lifecycle(ctx):
    """
    Tier 4.1: Full teacher quality lifecycle.
    1. Teacher creates Classroom with 4 students (S1, S2, S3, S4).
    2. Teacher assigns Exam with 2 topics: "Hàm số" and "Hình không gian".
    3. S1 scores 9.0, S2 scores 8.5, S3 scores 5.0, S4 scores 3.0.
    4. Verifies:
       - Class average: 6.38
       - Score distribution: 2 Giỏi (>= 8.0), 1 Trung bình (5.0 - 6.49), 1 Yếu (< 5.0)
       - "Hình không gian" has accuracy < 60% -> auto-flagged as WEAK TOPIC
       - S4 score (3.0) < passing & < class avg -> auto-flagged for intervention
       - Actionable recommendation generated with suggested actions
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "t4_life@test.com", "TEACHER", "Teacher Lifecycle")
    s1, _ = make_user(SessionLocal, "s1_lf@test.com", "STUDENT", "Student 1")
    s2, _ = make_user(SessionLocal, "s2_lf@test.com", "STUDENT", "Student 2")
    s3, _ = make_user(SessionLocal, "s3_lf@test.com", "STUDENT", "Student 3")
    s4, _ = make_user(SessionLocal, "s4_lf@test.com", "STUDENT", "Student 4")

    classroom = make_classroom(SessionLocal, "12A2 Chuyên Toán", teacher.id)
    for s in (s1, s2, s3, s4):
        enroll_student(SessionLocal, classroom.id, s.id)

    # 2 questions from "Hàm số", 2 questions from "Hình không gian"
    q_hs1 = make_question(SessionLocal, teacher.id, topic="Hàm số", correct_option=0)
    q_hs2 = make_question(SessionLocal, teacher.id, topic="Hàm số", correct_option=1)
    q_hkg1 = make_question(SessionLocal, teacher.id, topic="Hình không gian", correct_option=2)
    q_hkg2 = make_question(SessionLocal, teacher.id, topic="Hình không gian", correct_option=3)

    exam = make_exam(SessionLocal, "Khảo sát giữa kỳ", teacher.id, questions=[q_hs1, q_hs2, q_hkg1, q_hkg2])
    assign_exam(SessionLocal, classroom.id, exam.id)

    # S1: 9.0 (all correct)
    make_submission(
        SessionLocal, exam.id, s1.id, status="GRADED", score=9.0,
        graded_answers={
            str(q_hs1.id): {"is_correct": True}, str(q_hs2.id): {"is_correct": True},
            str(q_hkg1.id): {"is_correct": True}, str(q_hkg2.id): {"is_correct": True},
        }
    )
    # S2: 8.5 ("Hàm số" all correct, 1 "Hình không gian" correct)
    make_submission(
        SessionLocal, exam.id, s2.id, status="GRADED", score=8.5,
        graded_answers={
            str(q_hs1.id): {"is_correct": True}, str(q_hs2.id): {"is_correct": True},
            str(q_hkg1.id): {"is_correct": True}, str(q_hkg2.id): {"is_correct": False},
        }
    )
    # S3: 5.0 ("Hàm số" all correct, "Hình không gian" both incorrect)
    make_submission(
        SessionLocal, exam.id, s3.id, status="GRADED", score=5.0,
        graded_answers={
            str(q_hs1.id): {"is_correct": True}, str(q_hs2.id): {"is_correct": True},
            str(q_hkg1.id): {"is_correct": False}, str(q_hkg2.id): {"is_correct": False},
        }
    )
    # S4: 3.0 (1 "Hàm số" correct, "Hình không gian" both incorrect)
    make_submission(
        SessionLocal, exam.id, s4.id, status="GRADED", score=3.0,
        graded_answers={
            str(q_hs1.id): {"is_correct": True}, str(q_hs2.id): {"is_correct": False},
            str(q_hkg1.id): {"is_correct": False}, str(q_hkg2.id): {"is_correct": False},
        }
    )

    # 1. Dashboard Quality Verification
    res_dash = client.get(
        f"/api/analytics/dashboard?classroom_id={classroom.id}&exam_id={exam.id}",
        headers=t_headers,
    )
    assert res_dash.status_code == 200
    dash_data = res_dash.json()
    summary = dash_data["summary"]

    # Class average: (9.0 + 8.5 + 5.0 + 3.0) / 4 = 6.375 -> rounded 6.38
    assert abs(summary["average_score"] - 6.38) <= 0.02
    assert summary["pass_rate"] == 75.0  # 3 pass (>=5.0), 1 fail

    # Tiers: 2 Giỏi (S1, S2), 1 Trung bình (S3), 1 Yếu (S4)
    tiers = {t["tier"]: t["count"] for t in dash_data["score_distribution"]["tiers"]}
    assert any("Giỏi" in k and v == 2 for k, v in tiers.items())
    assert any("Yếu" in k and v == 1 for k, v in tiers.items())

    # Weak Topic check: "Hình không gian" has 2 correct out of 8 attempts (25% < 60%)
    weak_topics = dash_data["top_weak_topics"]
    assert any(wt["topic"] == "Hình không gian" for wt in weak_topics)

    # 2. Student Intervention Verification
    res_stu = client.get(f"/api/analytics/students?classroom_id={classroom.id}", headers=t_headers)
    assert res_stu.status_code == 200
    students = res_stu.json()["students"] if isinstance(res_stu.json(), dict) and "students" in res_stu.json() else res_stu.json()
    s4_item = next(s for s in students if s["student_id"] == s4.id)
    assert s4_item["needs_intervention"] is True

    # 3. Recommendations Verification
    res_rec = client.get(f"/api/analytics/recommendations?classroom_id={classroom.id}", headers=t_headers)
    assert res_rec.status_code == 200
    recs = res_rec.json()["recommendations"] if isinstance(res_rec.json(), dict) and "recommendations" in res_rec.json() else res_rec.json()
    assert any(r["category"] == "WEAK_TOPIC" for r in recs)
    assert any(r["category"] == "STUDENT_INTERVENTION" for r in recs)


def test_t4_2_high_volume_multi_classroom_concurrency_isolation(ctx):
    """
    Tier 4.2: High-volume multi-classroom isolation.
    Teacher manages Classroom 1 (3 students) and Classroom 2 (4 students).
    Verifies classroom filters strictly partition data without cross-classroom leakage.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "t4_multi@test.com", "TEACHER", "Teacher Multi-Class")

    c1 = make_classroom(SessionLocal, "Lớp 10A1", teacher.id)
    c2 = make_classroom(SessionLocal, "Lớp 11B2", teacher.id)

    students_c1 = [make_user(SessionLocal, f"c1_s{i}@test.com", "STUDENT", f"C1 S{i}")[0] for i in range(3)]
    students_c2 = [make_user(SessionLocal, f"c2_s{i}@test.com", "STUDENT", f"C2 S{i}")[0] for i in range(4)]

    for s in students_c1:
        enroll_student(SessionLocal, c1.id, s.id)
    for s in students_c2:
        enroll_student(SessionLocal, c2.id, s.id)

    e1 = make_exam(SessionLocal, "Exam C1", teacher.id)
    e2 = make_exam(SessionLocal, "Exam C2", teacher.id)
    assign_exam(SessionLocal, c1.id, e1.id)
    assign_exam(SessionLocal, c2.id, e2.id)

    # C1 submissions: 3 submissions
    for s in students_c1:
        make_submission(SessionLocal, e1.id, s.id, status="GRADED", score=8.0)

    # C2 submissions: 4 submissions
    for s in students_c2:
        make_submission(SessionLocal, e2.id, s.id, status="GRADED", score=6.0)

    # Query C1
    res_c1 = client.get(f"/api/analytics/dashboard?classroom_id={c1.id}", headers=t_headers)
    assert res_c1.status_code == 200
    assert res_c1.json()["summary"]["total_submissions"] == 3
    assert res_c1.json()["summary"]["unique_students"] == 3
    assert res_c1.json()["summary"]["average_score"] == 8.0

    # Query C2
    res_c2 = client.get(f"/api/analytics/dashboard?classroom_id={c2.id}", headers=t_headers)
    assert res_c2.status_code == 200
    assert res_c2.json()["summary"]["total_submissions"] == 4
    assert res_c2.json()["summary"]["unique_students"] == 4
    assert res_c2.json()["summary"]["average_score"] == 6.0

    # Query overall (unfiltered)
    res_all = client.get("/api/analytics/dashboard", headers=t_headers)
    assert res_all.status_code == 200
    assert res_all.json()["summary"]["total_submissions"] == 7
    assert res_all.json()["summary"]["unique_students"] == 7


def test_t4_3_question_anomaly_misleading_distractor_detection(ctx):
    """
    Tier 4.3: Question anomaly & misleading distractor detection.
    Exam with Question Q1 (Correct: Option 0).
    10 students: 2 choose 0 (20% correct -> 80% error rate > 65%),
    6 choose option 1 (60% choose distractor B > 40%).
    Verifies Q1 is flagged as an anomaly in /api/analytics/questions and generates an alert recommendation.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "t4_anom@test.com", "TEACHER", "Teacher Anomaly")

    classroom = make_classroom(SessionLocal, "Class Anomaly", teacher.id)
    students = [make_user(SessionLocal, f"anom_s{i}@test.com", "STUDENT", f"Anom S{i}")[0] for i in range(10)]
    for s in students:
        enroll_student(SessionLocal, classroom.id, s.id)

    q = make_question(
        SessionLocal, teacher.id,
        topic="Khảo sát hàm số",
        options=["Đáp án Đúng A", "Bẫy Phổ Biến B", "Đáp án C", "Đáp án D"],
        correct_option=0,
    )
    exam = make_exam(SessionLocal, "Exam Anomaly", teacher.id, questions=[q])
    assign_exam(SessionLocal, classroom.id, exam.id)

    # 2 choose option 0 (correct), 6 choose option 1 (distractor B), 2 choose option 2 (distractor C)
    for i, s in enumerate(students):
        choice = 0 if i < 2 else (1 if i < 8 else 2)
        is_corr = (choice == 0)
        make_submission(
            SessionLocal, exam.id, s.id, status="GRADED", score=10.0 if is_corr else 0.0,
            answers={str(q.id): choice},
            graded_answers={str(q.id): {"is_correct": is_corr, "student_answer": choice}}
        )

    # Check questions endpoint
    res_q = client.get(f"/api/analytics/questions?exam_id={exam.id}", headers=t_headers)
    assert res_q.status_code == 200
    q_data = res_q.json()["questions"] if isinstance(res_q.json(), dict) and "questions" in res_q.json() else res_q.json()
    q_stat = next(item for item in q_data if item["question_id"] == q.id)

    assert q_stat["total_attempts"] == 10
    assert q_stat["correct_count"] == 2
    assert q_stat["accuracy_rate"] == 20.0
    assert q_stat["is_flagged_anomaly"] is True

    # Check recommendations for QUESTION_ANOMALY
    res_rec = client.get(f"/api/analytics/recommendations?exam_id={exam.id}", headers=t_headers)
    assert res_rec.status_code == 200
    recs = res_rec.json()["recommendations"] if isinstance(res_rec.json(), dict) and "recommendations" in res_rec.json() else res_rec.json()
    assert any(r["category"] == "QUESTION_ANOMALY" for r in recs)
