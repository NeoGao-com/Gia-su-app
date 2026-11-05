"""
Comprehensive Automated Test Suite for Milestone M3:
Student Assignment Progress & Submission Reset API (4 Tiers)

Test Architecture:
- Framework: Pytest + FastAPI TestClient
- Database: Isolated temporary SQLite database per test
- Coverage:
  * Tier 1: Feature Coverage (≥5 tests: completed, unstarted, in-progress, deletion, progress reset)
  * Tier 2: Boundary & Corner Cases (≥5 tests: 401 unauth, 403 student, 403 foreign teacher, 404 missing entities, 404 idempotency, 404/400 mismatch)
  * Tier 3: Cross-Feature Combinations (multi-attempt rollback, in-progress index lock clearance)
  * Tier 4: Real-World Workload Scenarios (complete retake lifecycle, mixed classroom multi-student workload)
"""

import os
import asyncio
import tempfile
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
    """Utility to execute an async coroutine synchronously in test setups."""
    return asyncio.run(coro)


@pytest.fixture
def ctx(tmp_path):
    """
    Isolated SQLite test environment fixture.
    Creates a fresh temporary database with all schema tables and partial unique indexes,
    overrides get_db dependency, and tears down cleanly.
    """
    db_file = tmp_path / "test_quiz.db"
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


def make_exam(SessionLocal, title: str, creator_id: int, duration_minutes: int = 45, max_attempts: int = 1) -> Exam:
    """Creates an exam."""
    async def _create():
        async with SessionLocal() as session:
            exam = Exam(
                title=title,
                duration_minutes=duration_minutes,
                max_attempts=max_attempts,
                created_by_id=creator_id,
                is_published=True,
                is_deleted=False,
                exam_type="ASSIGNMENT",
            )
            session.add(exam)
            await session.commit()
            await session.refresh(exam)
            return exam

    return run_sync(_create())


def assign_exam(
    SessionLocal,
    classroom_id: int,
    exam_id: int,
    max_attempts: int | None = None,
    duration_override: int | None = None,
) -> Assignment:
    """Assigns an exam to a classroom."""
    async def _assign():
        async with SessionLocal() as session:
            a = Assignment(
                classroom_id=classroom_id,
                exam_id=exam_id,
                is_active=True,
                max_attempts=max_attempts,
                duration_minutes_override=duration_override,
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
    status: str,
    score: float | None = None,
    attempt_number: int = 1,
    submitted_at: datetime | None = None,
    started_at: datetime | None = None,
) -> ExamSubmission:
    """Creates an exam submission attempt."""
    async def _submit():
        async with SessionLocal() as session:
            sub = ExamSubmission(
                exam_id=exam_id,
                user_id=user_id,
                status=status,
                score=score,
                auto_score=score,
                attempt_number=attempt_number,
                submitted_at=submitted_at,
                started_at=started_at or datetime.now(timezone.utc),
                grading_status="GRADED" if status in ("GRADED", "SUBMITTED") else None,
                time_spent=600 if submitted_at else 0,
                tab_switches=0,
            )
            session.add(sub)
            await session.commit()
            await session.refresh(sub)
            return sub

    return run_sync(_submit())


# ==============================================================================
# Tier 1: Feature Coverage (≥5 Tests)
# ==============================================================================

def test_t1_1_student_progress_completed_assignment(ctx):
    """
    Tier 1.1: Fetch student assignment progress when student has completed assignments.
    Verifies status="COMPLETED", is_completed=True, score, submitted_at, and submission ID list.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "teacher1@test.com", "TEACHER", "Teacher One")
    student, _ = make_user(SessionLocal, "student1@test.com", "STUDENT", "Student One")
    classroom = make_classroom(SessionLocal, "12A1 Math", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Quiz 1 - Algebra", teacher.id)
    assignment = assign_exam(SessionLocal, classroom.id, exam.id)

    submit_time = datetime.now(timezone.utc) - timedelta(hours=1)
    sub = make_submission(
        SessionLocal,
        exam_id=exam.id,
        user_id=student.id,
        status="GRADED",
        score=8.5,
        attempt_number=1,
        submitted_at=submit_time,
    )

    res = client.get(
        f"/api/classrooms/{classroom.id}/students/{student.id}/assignments",
        headers=t_headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["classroom_id"] == classroom.id
    assert data["student"]["id"] == student.id
    assert len(data["assignments"]) == 1

    item = data["assignments"][0]
    assert item["exam_id"] == exam.id
    assert item["title"] == "Quiz 1 - Algebra"
    assert item["status"] == "COMPLETED"
    assert item["is_completed"] is True
    assert item["score"] == 8.5
    assert item["attempts_taken"] == 1
    assert item["latest_submission_id"] == sub.id
    assert item["submitted_at"] is not None
    assert len(item["submissions"]) == 1

    sub_item = item["submissions"][0]
    assert sub_item["id"] == sub.id
    assert sub_item["score"] == 8.5
    assert sub_item["status"] == "GRADED"


def test_t1_2_student_progress_unstarted_assignment(ctx):
    """
    Tier 1.2: Fetch student assignment progress when student has NOT started the assignment.
    Verifies status="NOT_STARTED", is_completed=False, score=None, attempts_taken=0, submissions=[].
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "teacher2@test.com", "TEACHER", "Teacher Two")
    student, _ = make_user(SessionLocal, "student2@test.com", "STUDENT", "Student Two")
    classroom = make_classroom(SessionLocal, "11B1 Physics", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Physics Homework 1", teacher.id)
    assign_exam(SessionLocal, classroom.id, exam.id)

    res = client.get(
        f"/api/classrooms/{classroom.id}/students/{student.id}/assignments",
        headers=t_headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert len(data["assignments"]) == 1
    item = data["assignments"][0]
    assert item["exam_id"] == exam.id
    assert item["status"] == "NOT_STARTED"
    assert item["is_completed"] is False
    assert item["score"] is None
    assert item["submitted_at"] is None
    assert item["attempts_taken"] == 0
    assert item["latest_submission_id"] is None
    assert item["submissions"] == []


def test_t1_3_student_progress_in_progress_assignment(ctx):
    """
    Tier 1.3: Fetch student assignment progress when student has an IN_PROGRESS quiz.
    Verifies status="IN_PROGRESS", is_completed=False, score=None, latest_submission_id is set.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "teacher3@test.com", "TEACHER", "Teacher Three")
    student, _ = make_user(SessionLocal, "student3@test.com", "STUDENT", "Student Three")
    classroom = make_classroom(SessionLocal, "10C1 Chemistry", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Periodic Table Quiz", teacher.id)
    assign_exam(SessionLocal, classroom.id, exam.id)

    sub = make_submission(
        SessionLocal,
        exam_id=exam.id,
        user_id=student.id,
        status="IN_PROGRESS",
        score=None,
        attempt_number=1,
    )

    res = client.get(
        f"/api/classrooms/{classroom.id}/students/{student.id}/assignments",
        headers=t_headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()

    item = data["assignments"][0]
    assert item["status"] == "IN_PROGRESS"
    assert item["is_completed"] is False
    assert item["score"] is None
    assert item["latest_submission_id"] == sub.id
    assert len(item["submissions"]) == 1
    assert item["submissions"][0]["status"] == "IN_PROGRESS"


def test_t1_4_teacher_deletes_submission_attempt(ctx):
    """
    Tier 1.4: Teacher deletes a submission attempt -> DB record is deleted.
    Verifies response success=True and direct DB verification confirms row removal.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "teacher4@test.com", "TEACHER", "Teacher Four")
    student, _ = make_user(SessionLocal, "student4@test.com", "STUDENT", "Student Four")
    classroom = make_classroom(SessionLocal, "12A2 Literature", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Essay Test 1", teacher.id)
    assign_exam(SessionLocal, classroom.id, exam.id)

    sub = make_submission(
        SessionLocal,
        exam_id=exam.id,
        user_id=student.id,
        status="GRADED",
        score=7.0,
        attempt_number=1,
        submitted_at=datetime.now(timezone.utc),
    )

    del_res = client.delete(
        f"/api/classrooms/{classroom.id}/students/{student.id}/submissions/{sub.id}",
        headers=t_headers,
    )
    assert del_res.status_code == 200, del_res.text
    del_data = del_res.json()
    assert del_data["success"] is True
    assert del_data["deleted_submission_id"] == sub.id
    assert del_data["student_id"] == student.id
    assert del_data["exam_id"] == exam.id

    # Direct database verification
    async def _check_db():
        async with SessionLocal() as session:
            check = await session.get(ExamSubmission, sub.id)
            return check

    assert run_sync(_check_db()) is None


def test_t1_5_progress_resets_after_submission_deletion(ctx):
    """
    Tier 1.5: Querying progress after deleting the only submission shows reset to NOT_STARTED.
    Verifies status="NOT_STARTED", is_completed=False, score=None, attempts_taken=0.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "teacher5@test.com", "TEACHER", "Teacher Five")
    student, _ = make_user(SessionLocal, "student5@test.com", "STUDENT", "Student Five")
    classroom = make_classroom(SessionLocal, "9A1 Biology", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Biology Quiz 1", teacher.id)
    assign_exam(SessionLocal, classroom.id, exam.id)

    sub = make_submission(
        SessionLocal,
        exam_id=exam.id,
        user_id=student.id,
        status="GRADED",
        score=9.0,
        attempt_number=1,
        submitted_at=datetime.now(timezone.utc),
    )

    # 1. First verify progress is COMPLETED
    res1 = client.get(
        f"/api/classrooms/{classroom.id}/students/{student.id}/assignments",
        headers=t_headers,
    )
    assert res1.json()["assignments"][0]["status"] == "COMPLETED"

    # 2. Delete submission
    del_res = client.delete(
        f"/api/classrooms/{classroom.id}/students/{student.id}/submissions/{sub.id}",
        headers=t_headers,
    )
    assert del_res.status_code == 200

    # 3. Query progress again -> must be reset to NOT_STARTED
    res2 = client.get(
        f"/api/classrooms/{classroom.id}/students/{student.id}/assignments",
        headers=t_headers,
    )
    assert res2.status_code == 200
    item = res2.json()["assignments"][0]
    assert item["status"] == "NOT_STARTED"
    assert item["is_completed"] is False
    assert item["score"] is None
    assert item["attempts_taken"] == 0
    assert item["submissions"] == []


# ==============================================================================
# Tier 2: Boundary & Corner Cases (≥5 Tests)
# ==============================================================================

def test_t2_1_unauthenticated_request_returns_401(ctx):
    """
    Tier 2.1: Authentication guard — Unauthenticated request to progress or deletion returns 401.
    """
    client = ctx["client"]
    res_get = client.get("/api/classrooms/1/students/1/assignments")
    assert res_get.status_code == 401

    res_del = client.delete("/api/classrooms/1/students/1/submissions/1")
    assert res_del.status_code == 401


def test_t2_2_student_role_forbidden_403(ctx):
    """
    Tier 2.2: Authorization guard — Student role accessing teacher endpoints returns 403.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    student, s_headers = make_user(SessionLocal, "student_guard@test.com", "STUDENT", "Student Guard")

    res_get = client.get("/api/classrooms/1/students/1/assignments", headers=s_headers)
    assert res_get.status_code == 403

    res_del = client.delete("/api/classrooms/1/students/1/submissions/1", headers=s_headers)
    assert res_del.status_code == 403


def test_t2_3_non_instructor_teacher_forbidden_403(ctx):
    """
    Tier 2.3: Authorization guard — Teacher attempting to access or delete submissions
    for another teacher's class returns 403 Forbidden.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher_owner, _ = make_user(SessionLocal, "owner_teacher@test.com", "TEACHER", "Owner Teacher")
    teacher_intruder, intruder_headers = make_user(SessionLocal, "intruder_teacher@test.com", "TEACHER", "Intruder Teacher")
    student, _ = make_user(SessionLocal, "student_class@test.com", "STUDENT", "Class Student")

    classroom = make_classroom(SessionLocal, "Exclusive Class", teacher_owner.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Class Exam", teacher_owner.id)
    assign_exam(SessionLocal, classroom.id, exam.id)
    sub = make_submission(SessionLocal, exam.id, student.id, status="GRADED", score=10.0, submitted_at=datetime.now(timezone.utc))

    # Intruder teacher attempts GET
    res_get = client.get(
        f"/api/classrooms/{classroom.id}/students/{student.id}/assignments",
        headers=intruder_headers,
    )
    assert res_get.status_code == 403

    # Intruder teacher attempts DELETE
    res_del = client.delete(
        f"/api/classrooms/{classroom.id}/students/{student.id}/submissions/{sub.id}",
        headers=intruder_headers,
    )
    assert res_del.status_code == 403


def test_t2_4_non_existent_classroom_or_student_returns_404(ctx):
    """
    Tier 2.4: Non-existent entities — Fetching or deleting for non-existent classroom or student returns 404.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "teacher_404@test.com", "TEACHER", "Teacher 404")
    student, _ = make_user(SessionLocal, "student_404@test.com", "STUDENT", "Student 404")
    classroom = make_classroom(SessionLocal, "Valid Class", teacher.id)

    # 1. Non-existent classroom
    res1 = client.get(f"/api/classrooms/999999/students/{student.id}/assignments", headers=t_headers)
    assert res1.status_code == 404

    # 2. Non-existent student
    res2 = client.get(f"/api/classrooms/{classroom.id}/students/999999/assignments", headers=t_headers)
    assert res2.status_code == 404

    # 3. Student exists but is not enrolled in this classroom
    res3 = client.get(f"/api/classrooms/{classroom.id}/students/{student.id}/assignments", headers=t_headers)
    assert res3.status_code == 404


def test_t2_5_delete_non_existent_or_already_deleted_submission_returns_404(ctx):
    """
    Tier 2.5: Idempotency & non-existent submission — Deleting non-existent or already-deleted submission returns 404.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "teacher_idemp@test.com", "TEACHER", "Teacher Idempotent")
    student, _ = make_user(SessionLocal, "student_idemp@test.com", "STUDENT", "Student Idempotent")
    classroom = make_classroom(SessionLocal, "Idempotent Class", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Idempotent Exam", teacher.id)
    assign_exam(SessionLocal, classroom.id, exam.id)
    sub = make_submission(SessionLocal, exam.id, student.id, status="GRADED", score=8.0, submitted_at=datetime.now(timezone.utc))

    # 1. Delete arbitrary non-existent ID
    res_fake = client.delete(
        f"/api/classrooms/{classroom.id}/students/{student.id}/submissions/987654",
        headers=t_headers,
    )
    assert res_fake.status_code == 404

    # 2. Delete valid submission (returns 200)
    res_first = client.delete(
        f"/api/classrooms/{classroom.id}/students/{student.id}/submissions/{sub.id}",
        headers=t_headers,
    )
    assert res_first.status_code == 200

    # 3. Delete again (idempotency failure -> 404)
    res_second = client.delete(
        f"/api/classrooms/{classroom.id}/students/{student.id}/submissions/{sub.id}",
        headers=t_headers,
    )
    assert res_second.status_code == 404


def test_t2_6_delete_mismatched_student_or_unassigned_exam(ctx):
    """
    Tier 2.6: Mismatched ownership — Attempting to delete a submission that belongs to a different student
    returns 404, or an exam not assigned to classroom returns 400.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "teacher_mismatch@test.com", "TEACHER", "Teacher Mismatch")
    student_a, _ = make_user(SessionLocal, "student_a@test.com", "STUDENT", "Student A")
    student_b, _ = make_user(SessionLocal, "student_b@test.com", "STUDENT", "Student B")

    classroom = make_classroom(SessionLocal, "Mismatch Class", teacher.id)
    enroll_student(SessionLocal, classroom.id, student_a.id)
    enroll_student(SessionLocal, classroom.id, student_b.id)

    exam1 = make_exam(SessionLocal, "Assigned Exam", teacher.id)
    assign_exam(SessionLocal, classroom.id, exam1.id)

    # Sub of student B
    sub_b = make_submission(SessionLocal, exam1.id, student_b.id, status="GRADED", score=6.0, submitted_at=datetime.now(timezone.utc))

    # Teacher attempts to delete sub_b under student_a's path -> 404 Mismatched user_id
    res_mismatch_user = client.delete(
        f"/api/classrooms/{classroom.id}/students/{student_a.id}/submissions/{sub_b.id}",
        headers=t_headers,
    )
    assert res_mismatch_user.status_code == 404

    # Exam 2 is NOT assigned to classroom
    exam2_unassigned = make_exam(SessionLocal, "Unassigned Exam", teacher.id)
    sub_unassigned = make_submission(SessionLocal, exam2_unassigned.id, student_a.id, status="GRADED", score=5.0, submitted_at=datetime.now(timezone.utc))

    res_unassigned = client.delete(
        f"/api/classrooms/{classroom.id}/students/{student_a.id}/submissions/{sub_unassigned.id}",
        headers=t_headers,
    )
    assert res_unassigned.status_code in (400, 404)


# ==============================================================================
# Tier 3: Cross-Feature Combinations & State Transitions (2 Tests)
# ==============================================================================

def test_t3_1_multi_attempt_assignment_deletion_retains_earlier_attempt(ctx):
    """
    Tier 3.1: Multiple attempts handling:
    Student has 2 attempts on max_attempts=2 exam.
    Teacher deletes attempt 2 -> attempt count drops to 1, score reverts to attempt 1's score.
    Status remains COMPLETED because attempt 1 is intact.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "teacher_multi@test.com", "TEACHER", "Teacher Multi")
    student, _ = make_user(SessionLocal, "student_multi@test.com", "STUDENT", "Student Multi")
    classroom = make_classroom(SessionLocal, "Multi-Attempt Class", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Midterm Exam", teacher.id, max_attempts=2)
    assign_exam(SessionLocal, classroom.id, exam.id, max_attempts=2)

    # Attempt 1: score = 7.0
    sub1 = make_submission(
        SessionLocal,
        exam.id,
        student.id,
        status="GRADED",
        score=7.0,
        attempt_number=1,
        submitted_at=datetime.now(timezone.utc) - timedelta(hours=2),
    )
    # Attempt 2: score = 9.5
    sub2 = make_submission(
        SessionLocal,
        exam.id,
        student.id,
        status="GRADED",
        score=9.5,
        attempt_number=2,
        submitted_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )

    # Initial check: attempts_taken=2, score=9.5, 2 submissions
    res_init = client.get(
        f"/api/classrooms/{classroom.id}/students/{student.id}/assignments",
        headers=t_headers,
    )
    assert res_init.status_code == 200
    item_init = res_init.json()["assignments"][0]
    assert item_init["status"] == "COMPLETED"
    assert item_init["attempts_taken"] == 2
    assert item_init["score"] == 9.5
    assert len(item_init["submissions"]) == 2

    # Teacher deletes attempt 2
    del_res = client.delete(
        f"/api/classrooms/{classroom.id}/students/{student.id}/submissions/{sub2.id}",
        headers=t_headers,
    )
    assert del_res.status_code == 200

    # Query again: attempts_taken=1, score reverts to attempt 1 (7.0)
    res_after = client.get(
        f"/api/classrooms/{classroom.id}/students/{student.id}/assignments",
        headers=t_headers,
    )
    assert res_after.status_code == 200
    item_after = res_after.json()["assignments"][0]
    assert item_after["status"] == "COMPLETED"
    assert item_after["is_completed"] is True
    assert item_after["attempts_taken"] == 1
    assert item_after["score"] == 7.0
    assert len(item_after["submissions"]) == 1
    assert item_after["submissions"][0]["id"] == sub1.id


def test_t3_2_deletion_clears_in_progress_unique_index_lock(ctx):
    """
    Tier 3.2: Deletion clears stuck IN_PROGRESS lock:
    Enforces that deleting a stuck IN_PROGRESS submission frees the unique partial index constraint
    idx_unique_in_progress_submission and permits immediate retake.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "teacher_lock@test.com", "TEACHER", "Teacher Lock")
    student, _ = make_user(SessionLocal, "student_lock@test.com", "STUDENT", "Student Lock")
    classroom = make_classroom(SessionLocal, "Lock Class", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Timed Quiz", teacher.id)
    assign_exam(SessionLocal, classroom.id, exam.id)

    # Create stuck IN_PROGRESS submission
    stuck_sub = make_submission(SessionLocal, exam.id, student.id, status="IN_PROGRESS", score=None, attempt_number=1)

    # Verifying unique partial index: creating another IN_PROGRESS submission for same user/exam must fail
    async def _try_duplicate_in_progress():
        async with SessionLocal() as session:
            dup = ExamSubmission(exam_id=exam.id, user_id=student.id, status="IN_PROGRESS", attempt_number=2)
            session.add(dup)
            await session.commit()

    with pytest.raises(Exception):
        run_sync(_try_duplicate_in_progress())

    # Teacher deletes stuck submission
    del_res = client.delete(
        f"/api/classrooms/{classroom.id}/students/{student.id}/submissions/{stuck_sub.id}",
        headers=t_headers,
    )
    assert del_res.status_code == 200

    # Query progress -> reset to NOT_STARTED
    res_progress = client.get(
        f"/api/classrooms/{classroom.id}/students/{student.id}/assignments",
        headers=t_headers,
    )
    assert res_progress.json()["assignments"][0]["status"] == "NOT_STARTED"

    # Now creating a new IN_PROGRESS submission succeeds cleanly without unique index violation
    new_sub = make_submission(SessionLocal, exam.id, student.id, status="IN_PROGRESS", attempt_number=1)
    assert new_sub.id is not None
    assert new_sub.status == "IN_PROGRESS"

    # Query progress -> reflects new IN_PROGRESS state
    res_progress2 = client.get(
        f"/api/classrooms/{classroom.id}/students/{student.id}/assignments",
        headers=t_headers,
    )
    assert res_progress2.json()["assignments"][0]["status"] == "IN_PROGRESS"
    assert res_progress2.json()["assignments"][0]["latest_submission_id"] == new_sub.id



# ==============================================================================
# Tier 4: Real-World Workload Scenarios (2 Tests)
# ==============================================================================

def test_t4_1_complete_student_lifecycle_take_review_delete_retake(ctx):
    """
    Tier 4.1: Complete student lifecycle:
    Student takes quiz -> Teacher reviews progress in class -> Teacher identifies mistaken attempt
    -> Teacher deletes submission -> Student successfully restarts and resubmits quiz with new score.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "teacher_life@test.com", "TEACHER", "Teacher Lifecycle")
    student, s_headers = make_user(SessionLocal, "student_life@test.com", "STUDENT", "Student Lifecycle")
    classroom = make_classroom(SessionLocal, "12A3 English", teacher.id)
    enroll_student(SessionLocal, classroom.id, student.id)
    exam = make_exam(SessionLocal, "Unit 1 Vocabulary", teacher.id, max_attempts=1)
    assign_exam(SessionLocal, classroom.id, exam.id, max_attempts=1)

    # Step 1: Student takes quiz and submits with low score (e.g. 3.0)
    sub_1 = make_submission(
        SessionLocal,
        exam.id,
        student.id,
        status="GRADED",
        score=3.0,
        attempt_number=1,
        submitted_at=datetime.now(timezone.utc) - timedelta(minutes=30),
    )

    # Step 2: Teacher reviews progress via API
    res_t1 = client.get(
        f"/api/classrooms/{classroom.id}/students/{student.id}/assignments",
        headers=t_headers,
    )
    assert res_t1.status_code == 200
    assign_t1 = res_t1.json()["assignments"][0]
    assert assign_t1["status"] == "COMPLETED"
    assert assign_t1["score"] == 3.0
    assert assign_t1["attempts_taken"] == 1

    # Step 3: Teacher grants retake by deleting the submission attempt
    del_res = client.delete(
        f"/api/classrooms/{classroom.id}/students/{student.id}/submissions/{sub_1.id}",
        headers=t_headers,
    )
    assert del_res.status_code == 200

    # Step 4: Teacher confirms reset state
    res_t2 = client.get(
        f"/api/classrooms/{classroom.id}/students/{student.id}/assignments",
        headers=t_headers,
    )
    assign_t2 = res_t2.json()["assignments"][0]
    assert assign_t2["status"] == "NOT_STARTED"
    assert assign_t2["attempts_taken"] == 0
    assert assign_t2["score"] is None

    # Step 5: Student takes the quiz again and submits with improved score (9.8)
    sub_2 = make_submission(
        SessionLocal,
        exam.id,
        student.id,
        status="GRADED",
        score=9.8,
        attempt_number=1,
        submitted_at=datetime.now(timezone.utc),
    )

    # Step 6: Teacher views updated progress -> COMPLETED with score 9.8
    res_t3 = client.get(
        f"/api/classrooms/{classroom.id}/students/{student.id}/assignments",
        headers=t_headers,
    )
    assign_t3 = res_t3.json()["assignments"][0]
    assert assign_t3["status"] == "COMPLETED"
    assert assign_t3["is_completed"] is True
    assert assign_t3["score"] == 9.8
    assert assign_t3["latest_submission_id"] == sub_2.id
    assert len(assign_t3["submissions"]) == 1
    assert assign_t3["submissions"][0]["id"] == sub_2.id


def test_t4_2_mixed_classroom_workload_multiple_students(ctx):
    """
    Tier 4.2: Mixed classroom workload:
    Multiple students with varying completion statuses (completed, in-progress, unstarted)
    inspected consecutively without cross-contamination.
    """
    client, SessionLocal = ctx["client"], ctx["SessionLocal"]
    teacher, t_headers = make_user(SessionLocal, "teacher_mix@test.com", "TEACHER", "Teacher Mix")
    classroom = make_classroom(SessionLocal, "10A1 Math", teacher.id)
    exam = make_exam(SessionLocal, "Chapter 1 Test", teacher.id)
    assign_exam(SessionLocal, classroom.id, exam.id)

    # Student 1: Completed (score 8.0)
    student1, _ = make_user(SessionLocal, "s1_mix@test.com", "STUDENT", "Alice")
    enroll_student(SessionLocal, classroom.id, student1.id)
    make_submission(SessionLocal, exam.id, student1.id, status="GRADED", score=8.0, submitted_at=datetime.now(timezone.utc))

    # Student 2: In-Progress
    student2, _ = make_user(SessionLocal, "s2_mix@test.com", "STUDENT", "Bob")
    enroll_student(SessionLocal, classroom.id, student2.id)
    make_submission(SessionLocal, exam.id, student2.id, status="IN_PROGRESS", score=None)

    # Student 3: Not Started
    student3, _ = make_user(SessionLocal, "s3_mix@test.com", "STUDENT", "Charlie")
    enroll_student(SessionLocal, classroom.id, student3.id)

    # Consecutive queries by teacher
    res_s1 = client.get(f"/api/classrooms/{classroom.id}/students/{student1.id}/assignments", headers=t_headers)
    res_s2 = client.get(f"/api/classrooms/{classroom.id}/students/{student2.id}/assignments", headers=t_headers)
    res_s3 = client.get(f"/api/classrooms/{classroom.id}/students/{student3.id}/assignments", headers=t_headers)

    assert res_s1.status_code == 200
    assert res_s2.status_code == 200
    assert res_s3.status_code == 200

    data_s1 = res_s1.json()
    data_s2 = res_s2.json()
    data_s3 = res_s3.json()

    assert data_s1["student"]["id"] == student1.id
    assert data_s1["assignments"][0]["status"] == "COMPLETED"
    assert data_s1["assignments"][0]["score"] == 8.0

    assert data_s2["student"]["id"] == student2.id
    assert data_s2["assignments"][0]["status"] == "IN_PROGRESS"
    assert data_s2["assignments"][0]["score"] is None

    assert data_s3["student"]["id"] == student3.id
    assert data_s3["assignments"][0]["status"] == "NOT_STARTED"
    assert data_s3["assignments"][0]["score"] is None
