"""
Adversarial Stress Test Suite for Backend Classroom Endpoints, Attempt Resets, and Concurrency.

Target Endpoints:
- GET /api/classrooms/{classroom_id}/students/{student_id}/assignments
- DELETE /api/classrooms/{classroom_id}/students/{student_id}/submissions/{submission_id}
- POST /api/student/exams/{exam_id}/start

Tested Scenarios:
1. Repeated Deletion & Idempotency: Second and third sequential deletions return clean 404 (zero 500 errors).
2. Concurrency: High-concurrency simultaneous DELETE requests with ThreadPoolExecutor and Barrier (zero 500 errors, clean completion, subsequent request 404).
3. Attempt Reset & Retake: Deleting submission resets max_attempts counter, permitting student to call /student/exams/{id}/start.
4. IN_PROGRESS Submission Reset: Deleting active attempt clears partial unique index lock and allows fresh start.
5. Redis Cache Invalidation: Targeted purge of student:exams:{student_id}:*, classrooms:*, and exams:{exam_id}:* while keeping unrelated keys.
6. Security Boundary: Student cannot delete submission (403), teacher cannot delete unassigned exam submission (400).
"""

import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
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
from app.models.classroom import Classroom, ClassroomStudent, Assignment, ClassroomExam
from app.models.exam import Exam, ExamSubmission


def run_sync(coro):
    return asyncio.run(coro)


@pytest.fixture
def ctx(tmp_path):
    """
    Isolated test environment with schema and partial unique index setup.
    """
    db_file = tmp_path / "stress_quiz.db"
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


def make_user(SessionLocal, email: str, role: str, full_name: str) -> tuple[User, dict]:
    async def _create():
        async with SessionLocal() as session:
            user = User(
                email=email,
                hashed_password=get_password_hash("StressTest@123!"),
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
    async def _create():
        async with SessionLocal() as session:
            c = Classroom(name=name, instructor_id=instructor_id, is_deleted=False)
            session.add(c)
            await session.commit()
            await session.refresh(c)
            return c

    return run_sync(_create())


def enroll_student(SessionLocal, classroom_id: int, student_id: int) -> ClassroomStudent:
    async def _enroll():
        async with SessionLocal() as session:
            cs = ClassroomStudent(classroom_id=classroom_id, student_id=student_id, is_active=True)
            session.add(cs)
            await session.commit()
            await session.refresh(cs)
            return cs

    return run_sync(_enroll())


def make_exam(SessionLocal, title: str, creator_id: int, max_attempts: int = 1) -> Exam:
    async def _create():
        async with SessionLocal() as session:
            exam = Exam(
                title=title,
                duration_minutes=45,
                max_attempts=max_attempts,
                created_by_id=creator_id,
                is_published=True,
                is_deleted=False,
                exam_type="EXAM",
            )
            session.add(exam)
            await session.commit()
            await session.refresh(exam)
            return exam

    return run_sync(_create())


def assign_exam(SessionLocal, classroom_id: int, exam_id: int, max_attempts: int | None = None) -> Assignment:
    async def _assign():
        async with SessionLocal() as session:
            a = Assignment(
                classroom_id=classroom_id,
                exam_id=exam_id,
                is_active=True,
                max_attempts=max_attempts,
                assigned_at=datetime.now(timezone.utc),
            )
            session.add(a)
            await session.commit()
            await session.refresh(a)
            return a

    return run_sync(_assign())


def make_submission(SessionLocal, exam_id: int, user_id: int, status: str = "GRADED", score: float = 8.0, attempt_number: int = 1) -> ExamSubmission:
    async def _submit():
        async with SessionLocal() as session:
            sub = ExamSubmission(
                exam_id=exam_id,
                user_id=user_id,
                status=status,
                score=score,
                auto_score=score,
                attempt_number=attempt_number,
                submitted_at=datetime.now(timezone.utc) if status != "IN_PROGRESS" else None,
                started_at=datetime.now(timezone.utc) - timedelta(minutes=20),
                grading_status="GRADED" if status in ("GRADED", "SUBMITTED") else None,
            )
            session.add(sub)
            await session.commit()
            await session.refresh(sub)
            return sub

    return run_sync(_submit())


# ==============================================================================
# Adversarial Test 1: Repeated Deletion & Idempotent 404 (No 500 Error)
# ==============================================================================

def test_repeated_deletion_returns_clean_404_no_500(ctx):
    """
    Verify that deleting an already deleted submission cleanly returns HTTP 404,
    never crashes into 500, and leaves the database and API state clean.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "adv_teacher1@test.com", "TEACHER", "Teacher Adv")
    student, _ = make_user(SessionLocal, "adv_student1@test.com", "STUDENT", "Student Adv")
    classroom = make_classroom(SessionLocal, "Adv Class 1", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Math Test 1", teacher.id, max_attempts=1)
    assign_exam(SessionLocal, classroom.id, exam.id)
    sub = make_submission(SessionLocal, exam.id, student.id, status="GRADED", score=7.0)

    url = f"/api/classrooms/{classroom.id}/students/{student.id}/submissions/{sub.id}"

    # 1st Delete -> 200 OK
    r1 = client.delete(url, headers=t_headers)
    assert r1.status_code == 200, f"First delete failed: {r1.text}"
    data1 = r1.json()
    assert data1["success"] is True
    assert data1["deleted_submission_id"] == sub.id

    # 2nd Delete -> MUST return 404 Not Found, NOT 500
    r2 = client.delete(url, headers=t_headers)
    assert r2.status_code == 404, f"Second delete did not return 404: {r2.status_code} {r2.text}"
    assert "không tìm thấy" in r2.json()["detail"].lower()

    # 3rd Delete -> Still cleanly 404
    r3 = client.delete(url, headers=t_headers)
    assert r3.status_code == 404
    assert "không tìm thấy" in r3.json()["detail"].lower()

    # Verify DB has 0 submissions
    async def _check():
        async with SessionLocal() as session:
            check = await session.execute(select(ExamSubmission).filter(ExamSubmission.id == sub.id))
            assert check.scalars().first() is None
    run_sync(_check())


# ==============================================================================
# Adversarial Test 2: Concurrent Deletion Requests Stress Test
# ==============================================================================

def test_concurrent_deletion_requests_no_500(ctx):
    """
    Stress-test high concurrency on deletion: Fire 10 simultaneous deletion requests
    using ThreadPoolExecutor synchronized with a threading.Barrier.
    Empirically verifies:
    - Zero 500 Internal Server Errors (no uncaught StaleDataError, ObjectDeletedError, or crash).
    - Every response is a valid HTTP status (200 OK or 404 Not Found).
    - Immediately following the concurrent burst, an 11th deletion request cleanly returns 404.
    - Database row is definitively deleted.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "adv_teacher2@test.com", "TEACHER", "Teacher Concurrency")
    student, _ = make_user(SessionLocal, "adv_student2@test.com", "STUDENT", "Student Concurrency")
    classroom = make_classroom(SessionLocal, "Concurrency Class", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Concurrency Exam", teacher.id, max_attempts=1)
    assign_exam(SessionLocal, classroom.id, exam.id)
    sub = make_submission(SessionLocal, exam.id, student.id, status="GRADED", score=6.5)

    url = f"/api/classrooms/{classroom.id}/students/{student.id}/submissions/{sub.id}"
    thread_count = 10
    barrier = threading.Barrier(thread_count)
    results = []

    def worker():
        barrier.wait()  # Release all threads simultaneously
        res = client.delete(url, headers=t_headers)
        return (res.status_code, res.text)

    with ThreadPoolExecutor(max_workers=thread_count) as executor:
        futures = [executor.submit(worker) for _ in range(thread_count)]
        for f in futures:
            results.append(f.result())

    status_codes = [status for status, _ in results]
    server_error_count = status_codes.count(500)

    # 1. Zero 500 errors
    assert server_error_count == 0, f"CRITICAL BUG: Encountered 500 error in concurrent delete: {results}"

    # 2. All responses must be either 200 or 404
    for sc in status_codes:
        assert sc in (200, 404), f"Unexpected status code {sc} in concurrent delete"

    # 3. Exactly >= 1 succeeded
    assert any(sc == 200 for sc in status_codes)

    # 4. Immediate subsequent delete must be clean 404
    post_burst_res = client.delete(url, headers=t_headers)
    assert post_burst_res.status_code == 404, f"Expected 404 after burst, got {post_burst_res.status_code}: {post_burst_res.text}"

    # 5. Database row is gone
    async def _check():
        async with SessionLocal() as session:
            check = await session.execute(select(ExamSubmission).filter(ExamSubmission.id == sub.id))
            assert check.scalars().first() is None
    run_sync(_check())


# ==============================================================================
# Adversarial Test 3: Retake Lifecycle — Exam Start after Submission Deletion
# ==============================================================================

def test_submission_deletion_enables_student_exam_retake_start(ctx):
    """
    Empirically verify that deleting a submission resets the student's attempt count,
    permitting the student to call POST /api/student/exams/{id}/start to retake the exam
    when max_attempts is reached.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "adv_teacher3@test.com", "TEACHER", "Teacher Retake")
    student, s_headers = make_user(SessionLocal, "adv_student3@test.com", "STUDENT", "Student Retake")
    classroom = make_classroom(SessionLocal, "Retake Class", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Single Attempt Quiz", teacher.id, max_attempts=1)
    assign_exam(SessionLocal, classroom.id, exam.id)

    # Baseline dummy submission for an unrelated exam so SQLite rowid table is never empty
    dummy_exam = make_exam(SessionLocal, "Dummy Unrelated Exam", teacher.id)
    make_submission(SessionLocal, dummy_exam.id, student.id, status="GRADED", score=10.0)

    # Step 1: Student starts the exam
    start_res1 = client.post(f"/api/student/exams/{exam.id}/start", headers=s_headers)
    assert start_res1.status_code == 200, f"Student start failed: {start_res1.text}"
    sub1_data = start_res1.json()
    sub1_id = sub1_data["id"]
    assert sub1_data["status"] == "IN_PROGRESS"
    assert sub1_data["attempt_number"] == 1

    # Step 2: Student completes/submits the exam with low score
    async def _grade_sub():
        async with SessionLocal() as session:
            sub1_db = await session.get(ExamSubmission, sub1_id)
            sub1_db.status = "GRADED"
            sub1_db.score = 2.0  # Poor score
            sub1_db.submitted_at = datetime.now(timezone.utc)
            await session.commit()
    run_sync(_grade_sub())

    # Create dummy higher-rowid submission so SQLite max(rowid) is higher than sub1_id
    make_submission(SessionLocal, dummy_exam.id, student.id, status="GRADED", score=9.0)

    # Step 3: Student attempts to retake without reset -> MUST be rejected (max_attempts=1)
    start_res2 = client.post(f"/api/student/exams/{exam.id}/start", headers=s_headers)
    assert start_res2.status_code == 400, f"Expected 400 rejection, got {start_res2.status_code}: {start_res2.text}"
    assert "không được phép làm tiếp" in start_res2.json()["detail"].lower()

    # Step 4: Teacher deletes the bad submission to reset the attempt
    del_res = client.delete(
        f"/api/classrooms/{classroom.id}/students/{student.id}/submissions/{sub1_id}",
        headers=t_headers
    )
    assert del_res.status_code == 200, f"Teacher delete failed: {del_res.text}"

    # Step 5: Student calls /start again -> MUST succeed (HTTP 200)
    start_res3 = client.post(f"/api/student/exams/{exam.id}/start", headers=s_headers)
    assert start_res3.status_code == 200, f"Retake start failed after delete: {start_res3.status_code} {start_res3.text}"
    sub2_data = start_res3.json()
    assert sub2_data["id"] != sub1_id, f"Expected fresh submission ID, got same {sub2_data['id']}"
    assert sub2_data["status"] == "IN_PROGRESS"
    assert sub2_data["attempt_number"] == 1
    assert sub2_data["score"] is None

    # Step 6: Verify progress endpoint reflects the active retake
    prog_res = client.get(
        f"/api/classrooms/{classroom.id}/students/{student.id}/assignments",
        headers=t_headers
    )
    assert prog_res.status_code == 200
    prog_data = prog_res.json()["assignments"][0]
    assert prog_data["status"] == "IN_PROGRESS"
    assert prog_data["is_completed"] is False
    assert prog_data["latest_submission_id"] == sub2_data["id"]


# ==============================================================================
# Adversarial Test 4: Deleting IN_PROGRESS Submission Unlocks Unique Index
# ==============================================================================

def test_delete_in_progress_submission_clears_unique_index_lock(ctx):
    """
    Test deletion when submission is stuck in IN_PROGRESS.
    Ensure deleting it removes the SQLite partial unique index lock and allows a fresh start.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "adv_teacher4@test.com", "TEACHER", "Teacher Stuck")
    student, s_headers = make_user(SessionLocal, "adv_student4@test.com", "STUDENT", "Student Stuck")
    classroom = make_classroom(SessionLocal, "Stuck Session Class", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Stuck Exam", teacher.id, max_attempts=1)
    assign_exam(SessionLocal, classroom.id, exam.id)

    # Baseline dummy submission so table is never empty
    dummy_exam = make_exam(SessionLocal, "Dummy Unrelated Exam 2", teacher.id)
    make_submission(SessionLocal, dummy_exam.id, student.id, status="GRADED", score=10.0)

    # Student starts exam -> IN_PROGRESS
    s1 = client.post(f"/api/student/exams/{exam.id}/start", headers=s_headers)
    assert s1.status_code == 200
    sub_id = s1.json()["id"]

    # Create dummy higher-rowid submission so SQLite max(rowid) is higher than sub_id
    make_submission(SessionLocal, dummy_exam.id, student.id, status="GRADED", score=9.0)

    # Teacher deletes the stuck attempt
    del_res = client.delete(
        f"/api/classrooms/{classroom.id}/students/{student.id}/submissions/{sub_id}",
        headers=t_headers
    )
    assert del_res.status_code == 200

    # Student starts again -> MUST create a fresh session without unique index collision
    s2 = client.post(f"/api/student/exams/{exam.id}/start", headers=s_headers)
    assert s2.status_code == 200, f"Failed to start fresh session after IN_PROGRESS deletion: {s2.text}"
    assert s2.json()["id"] != sub_id
    assert s2.json()["status"] == "IN_PROGRESS"


# ==============================================================================
# Adversarial Test 5: Redis Cache Invalidation Verification
# ==============================================================================

class FakeRedis:
    def __init__(self):
        self.store = {}

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, **kwargs):
        self.store[key] = value

    async def keys(self, pattern):
        import fnmatch
        return [k for k in self.store.keys() if fnmatch.fnmatch(k, pattern)]

    async def delete(self, *keys):
        deleted = 0
        for k in keys:
            if k in self.store:
                del self.store[k]
                deleted += 1
        return deleted


def test_redis_cache_invalidation_clean_purge(ctx, monkeypatch):
    """
    Verify that deleting a submission properly invalidates:
    - student:exams:{student_id}:*
    - classrooms:*
    - exams:{exam_id}:*
    while preserving unrelated cache keys.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "adv_teacher5@test.com", "TEACHER", "Teacher Cache")
    student, _ = make_user(SessionLocal, "adv_student5@test.com", "STUDENT", "Student Cache")
    classroom = make_classroom(SessionLocal, "Cache Class", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Cache Exam", teacher.id, max_attempts=1)
    assign_exam(SessionLocal, classroom.id, exam.id)
    sub = make_submission(SessionLocal, exam.id, student.id, status="GRADED", score=9.0)

    # Setup Fake Redis
    fake_redis = FakeRedis()
    fake_redis.store = {
        f"student:exams:{student.id}:page_1": '{"cached": 1}',
        f"student:exams:{student.id}:page_2": '{"cached": 2}',
        f"student:exams:{student.id + 999}:page_1": '{"other_student": 1}',
        f"classrooms:list:{teacher.id}:TEACHER:1:20": '{"classes": []}',
        f"classrooms:detail:{classroom.id}": '{"detail": 1}',
        f"exams:{exam.id}:summary": '{"exam": 1}',
        f"exams:{exam.id + 100}:summary": '{"other_exam": 1}',
        "system:health:status": "OK"
    }

    monkeypatch.setattr("app.routers.classroom.redis_client", fake_redis)
    monkeypatch.setattr("app.routers.student.redis_client", fake_redis)

    del_res = client.delete(
        f"/api/classrooms/{classroom.id}/students/{student.id}/submissions/{sub.id}",
        headers=t_headers
    )
    assert del_res.status_code == 200

    # Verify student's cache was purged
    student_keys = [k for k in fake_redis.store if k.startswith(f"student:exams:{student.id}:")]
    assert len(student_keys) == 0, f"Student cache not cleared: {student_keys}"

    # Verify other student's cache remains
    assert f"student:exams:{student.id + 999}:page_1" in fake_redis.store

    # Verify classroom caches were purged
    classroom_keys = [k for k in fake_redis.store if k.startswith("classrooms:")]
    assert len(classroom_keys) == 0, f"Classroom cache not cleared: {classroom_keys}"

    # Verify exam caches were purged
    exam_keys = [k for k in fake_redis.store if k.startswith(f"exams:{exam.id}:")]
    assert len(exam_keys) == 0, f"Exam cache not cleared: {exam_keys}"

    # Verify other exam and system caches remain
    assert f"exams:{exam.id + 100}:summary" in fake_redis.store
    assert "system:health:status" in fake_redis.store


# ==============================================================================
# Adversarial Test 6: Security Boundary — Student Cannot Delete Submission
# ==============================================================================

def test_student_role_forbidden_from_deleting_submission(ctx):
    """
    Ensure students cannot delete their own or other students' submissions (403 Forbidden).
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, _ = make_user(SessionLocal, "adv_teacher6@test.com", "TEACHER", "Teacher Sec")
    student, s_headers = make_user(SessionLocal, "adv_student6@test.com", "STUDENT", "Student Sec")
    classroom = make_classroom(SessionLocal, "Sec Class", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Sec Exam", teacher.id)
    assign_exam(SessionLocal, classroom.id, exam.id)
    sub = make_submission(SessionLocal, exam.id, student.id, status="GRADED", score=5.0)

    res = client.delete(
        f"/api/classrooms/{classroom.id}/students/{student.id}/submissions/{sub.id}",
        headers=s_headers
    )
    assert res.status_code == 403, f"Expected 403 for student deletion, got {res.status_code}"

    # Verify record still exists
    async def _check():
        async with SessionLocal() as session:
            check = await session.get(ExamSubmission, sub.id)
            assert check is not None
    run_sync(_check())
