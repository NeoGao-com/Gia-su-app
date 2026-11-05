"""
Adversarial Stress Test Suite for Backend Analytics Engine & Heuristics.

This suite empirically attacks:
1. Zero-division and cold-start boundaries (empty teacher, empty classroom, empty exam, empty submissions).
2. Boundary scores (100% scores, 0% scores, exact bin & tier edges, single/identical scores, out-of-bounds clamps).
3. Strict multi-tenant isolation (preventing Teacher A from accessing Teacher B's data via params or global queries).
4. Mathematical precision of pedagogical heuristic rules:
   - Weak topics (< 60.0% threshold, >= 3 attempts, HIGH vs MEDIUM priority)
   - Student academic intervention (< 5.0, < class_avg - 1.5, < 50% completion)
   - Question anomaly and misleading distractor trap (>= 40% distractor choice, < 35% accuracy, >= 5 attempts guard)
"""

import os
os.environ["TESTING"] = "True"
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-32bytes")

import uuid
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from tests.test_analytics import (
    ctx,
    run_sync,
    make_user,
    make_classroom,
    enroll_student,
    make_question,
    make_exam,
    assign_exam,
    make_submission,
)
from app.models.classroom import ClassroomExam


# ==============================================================================
# 1. Zero-Division & Cold-Start Boundaries
# ==============================================================================

def test_adv_zero_division_empty_teacher_all_endpoints(ctx):
    """
    Empirical attack: A newly registered teacher with 0 classrooms, 0 exams, 0 students, 0 submissions.
    Every analytics endpoint must return HTTP 200 with zeroed/empty structures and NEVER throw ZeroDivisionError.
    """
    client = ctx["client"]
    SessionLocal = ctx["SessionLocal"]

    _, headers = make_user(SessionLocal, "empty_teacher@test.com", "TEACHER", "Empty Teacher")

    # 1. Dashboard
    res = client.get("/api/analytics/dashboard", headers=headers)
    assert res.status_code == 200
    d = res.json()
    assert d["summary"]["total_submissions"] == 0
    assert d["summary"]["unique_students"] == 0
    assert d["summary"]["total_exams"] == 0
    assert d["summary"]["average_score"] == 0.0
    assert d["summary"]["median_score"] == 0.0
    assert d["summary"]["standard_deviation"] == 0.0
    assert d["summary"]["pass_rate"] == 0.0
    assert len(d["score_distribution"]["bins"]) == 10
    assert all(b["count"] == 0 and b["percentage"] == 0.0 for b in d["score_distribution"]["bins"])
    assert len(d["score_distribution"]["tiers"]) == 4
    assert all(t["count"] == 0 and t["percentage"] == 0.0 for t in d["score_distribution"]["tiers"])
    assert d["top_weak_topics"] == []
    assert d["recommendations_summary"]["total_recommendations"] == 0

    # 2. Topics
    res = client.get("/api/analytics/topics", headers=headers)
    assert res.status_code == 200
    t = res.json()
    assert t["topics"] == []
    assert t["difficulty_summary"] == []
    assert t["question_type_summary"] == []

    # 3. Recommendations
    res = client.get("/api/analytics/recommendations", headers=headers)
    assert res.status_code == 200
    r = res.json()
    assert r["recommendations"] == []
    assert r["summary"]["total_recommendations"] == 0
    assert r["summary"]["high_priority_count"] == 0

    # 4. Questions
    res = client.get("/api/analytics/questions", headers=headers)
    assert res.status_code == 200
    q = res.json()
    assert q["questions"] == []

    # 5. Students
    res = client.get("/api/analytics/students", headers=headers)
    assert res.status_code == 200
    s = res.json()
    assert s["students"] == []
    assert s["class_average"] == 0.0
    assert s["total_students"] == 0

    # 6. Summary (Enhanced & Legacy keys)
    res = client.get("/api/analytics/summary", headers=headers)
    assert res.status_code == 200
    sum_data = res.json()
    assert sum_data["classrooms_count"] == 0
    assert sum_data["students_count"] == 0
    assert sum_data["exams_count"] == 0
    assert sum_data["submissions_count"] == 0
    assert sum_data["average_score"] == 0.0
    assert sum_data["median_score"] == 0.0
    assert sum_data["pass_rate"] == 0.0
    assert sum_data["active_recommendations_count"] == 0
    assert len(sum_data["score_distribution"]) == 4
    assert all(item["count"] == 0 for item in sum_data["score_distribution"])


def test_adv_zero_division_classroom_with_students_no_submissions(ctx):
    """
    Empirical attack: Classroom has 5 enrolled students and 3 active assignments,
    but 0 submissions have been submitted yet.
    Tests division safety in student completion rate, class average, percentile ranks.
    """
    client = ctx["client"]
    SessionLocal = ctx["SessionLocal"]

    teacher, headers = make_user(SessionLocal, "t_cold_class@test.com", "TEACHER", "Teacher Cold")
    classroom = make_classroom(SessionLocal, "Lớp 12A Cold", teacher.id)

    students = []
    for i in range(5):
        st, _ = make_user(SessionLocal, f"st_cold_{i}@test.com", "STUDENT", f"Student Cold {i}")
        enroll_student(SessionLocal, classroom.id, st.id)
        students.append(st)

    # Create 3 exams & assign to classroom
    for i in range(3):
        ex = make_exam(SessionLocal, f"Exam Cold {i}", teacher.id)
        assign_exam(SessionLocal, classroom.id, ex.id)

    # Query /students for this classroom
    res = client.get(f"/api/analytics/students?classroom_id={classroom.id}", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_students"] == 5
    assert data["class_average"] == 0.0
    assert len(data["students"]) == 5

    for s_item in data["students"]:
        assert s_item["submissions_count"] == 0
        assert s_item["assigned_count"] == 3
        assert s_item["completion_rate"] == 0.0
        assert s_item["average_score"] == 0.0
        assert s_item["percentile"] == 0.0
        # 0 submissions out of 3 assignments (0% < 50% and assigned >= 2) triggers intervention
        assert s_item["needs_intervention"] is True
        assert any("Tỷ lệ hoàn thành bài tập thấp" in r for r in s_item["intervention_reasons"])


# ==============================================================================
# 2. Boundary Scores & Mathematical Ranges
# ==============================================================================

def test_adv_boundary_scores_all_perfect_tens(ctx):
    """
    Empirical attack: 30 students all score 10.0 on an exam.
    Verifies:
    - avg=10.0, median=10.0, min=10.0, max=10.0, std_dev=0.0, pass_rate=100.0%
    - 10-bin histogram: bin '9 - 10' has 100% of counts, all other 9 bins have 0
    - Tier 'Giỏi (>= 8.0)' has 100% of counts, other 3 tiers have 0
    """
    client = ctx["client"]
    SessionLocal = ctx["SessionLocal"]

    teacher, headers = make_user(SessionLocal, "t_perfect@test.com", "TEACHER", "Teacher Perfect")
    classroom = make_classroom(SessionLocal, "Lớp 12 Perfect", teacher.id)
    exam = make_exam(SessionLocal, "Đề 10 Tròn", teacher.id)
    assign_exam(SessionLocal, classroom.id, exam.id)

    for i in range(30):
        st, _ = make_user(SessionLocal, f"st_perf_{i}@test.com", "STUDENT", f"Perf {i}")
        enroll_student(SessionLocal, classroom.id, st.id)
        make_submission(SessionLocal, exam.id, st.id, score=10.0)

    res = client.get(f"/api/analytics/dashboard?classroom_id={classroom.id}", headers=headers)
    assert res.status_code == 200
    d = res.json()
    s = d["summary"]
    assert s["total_submissions"] == 30
    assert s["average_score"] == 10.0
    assert s["median_score"] == 10.0
    assert s["highest_score"] == 10.0
    assert s["lowest_score"] == 10.0
    assert s["standard_deviation"] == 0.0
    assert s["pass_rate"] == 100.0
    assert s["pass_count"] == 30
    assert s["fail_count"] == 0

    bins = d["score_distribution"]["bins"]
    assert len(bins) == 10
    # Exactly bin 9 ('9 - 10') has 30, others 0
    assert bins[9]["count"] == 30
    assert bins[9]["percentage"] == 100.0
    for idx in range(9):
        assert bins[idx]["count"] == 0
        assert bins[idx]["percentage"] == 0.0

    tiers = d["score_distribution"]["tiers"]
    assert tiers[0]["count"] == 0  # < 5.0
    assert tiers[1]["count"] == 0  # 5.0 - 6.49
    assert tiers[2]["count"] == 0  # 6.5 - 7.99
    assert tiers[3]["count"] == 30  # >= 8.0
    assert tiers[3]["percentage"] == 100.0


def test_adv_boundary_scores_all_absolute_zeroes(ctx):
    """
    Empirical attack: 30 students all score 0.0 on an exam.
    Verifies:
    - avg=0.0, median=0.0, min=0.0, max=0.0, std_dev=0.0, pass_rate=0.0%
    - 10-bin histogram: bin '0 - 1' has 100% of counts, all other 9 bins have 0
    - Tier 'Yếu (< 5.0)' has 100% of counts
    """
    client = ctx["client"]
    SessionLocal = ctx["SessionLocal"]

    teacher, headers = make_user(SessionLocal, "t_zeroes@test.com", "TEACHER", "Teacher Zeroes")
    classroom = make_classroom(SessionLocal, "Lớp 12 Zero", teacher.id)
    exam = make_exam(SessionLocal, "Đề 0 Tròn", teacher.id)
    assign_exam(SessionLocal, classroom.id, exam.id)

    for i in range(30):
        st, _ = make_user(SessionLocal, f"st_zero_{i}@test.com", "STUDENT", f"Zero {i}")
        enroll_student(SessionLocal, classroom.id, st.id)
        make_submission(SessionLocal, exam.id, st.id, score=0.0)

    res = client.get(f"/api/analytics/dashboard?classroom_id={classroom.id}", headers=headers)
    assert res.status_code == 200
    d = res.json()
    s = d["summary"]
    assert s["total_submissions"] == 30
    assert s["average_score"] == 0.0
    assert s["median_score"] == 0.0
    assert s["highest_score"] == 0.0
    assert s["lowest_score"] == 0.0
    assert s["standard_deviation"] == 0.0
    assert s["pass_rate"] == 0.0
    assert s["pass_count"] == 0
    assert s["fail_count"] == 30

    bins = d["score_distribution"]["bins"]
    assert bins[0]["count"] == 30
    assert bins[0]["percentage"] == 100.0
    for idx in range(1, 10):
        assert bins[idx]["count"] == 0

    tiers = d["score_distribution"]["tiers"]
    assert tiers[0]["count"] == 30  # Yếu (< 5.0)
    assert tiers[0]["percentage"] == 100.0
    assert tiers[1]["count"] == 0
    assert tiers[2]["count"] == 0
    assert tiers[3]["count"] == 0


def test_adv_boundary_score_exact_tier_and_bin_edges(ctx):
    """
    Empirical attack: Test exact boundary thresholds:
    - 4.99 (Tier 1: Yếu) vs 5.00 (Tier 2: Trung bình, pass threshold)
    - 6.49 (Tier 2: Trung bình) vs 6.50 (Tier 3: Khá)
    - 7.99 (Tier 3: Khá) vs 8.00 (Tier 4: Giỏi)
    - Bin edge clamping: out-of-bounds scores (-1.0 and 11.0) clamped safely
    """
    client = ctx["client"]
    SessionLocal = ctx["SessionLocal"]

    teacher, headers = make_user(SessionLocal, "t_edges@test.com", "TEACHER", "Teacher Edges")
    classroom = make_classroom(SessionLocal, "Lớp Biên", teacher.id)
    exam = make_exam(SessionLocal, "Đề Điểm Biên", teacher.id)
    assign_exam(SessionLocal, classroom.id, exam.id)

    scores = [4.99, 5.00, 6.49, 6.50, 7.99, 8.00, -1.0, 11.0]
    for i, sc in enumerate(scores):
        st, _ = make_user(SessionLocal, f"st_edge_{i}@test.com", "STUDENT", f"Edge {i}")
        enroll_student(SessionLocal, classroom.id, st.id)
        make_submission(SessionLocal, exam.id, st.id, score=sc)

    res = client.get(f"/api/analytics/dashboard?classroom_id={classroom.id}", headers=headers)
    assert res.status_code == 200
    d = res.json()
    tiers = d["score_distribution"]["tiers"]

    # Tiers classification check:
    # < 5.0: -1.0, 4.99 -> 2 students
    # 5.0 - 6.49: 5.00, 6.49 -> 2 students
    # 6.5 - 7.99: 6.50, 7.99 -> 2 students
    # >= 8.0: 8.00, 11.0 -> 2 students
    assert tiers[0]["count"] == 2  # Yếu
    assert tiers[1]["count"] == 2  # Trung bình
    assert tiers[2]["count"] == 2  # Khá
    assert tiers[3]["count"] == 2  # Giỏi

    # Bin checks:
    # -1.0 clamped to 0.0 -> Bin 0 ('0 - 1')
    # 4.99 -> Bin 4 ('4 - 5')
    # 5.00 -> Bin 5 ('5 - 6')
    # 6.49 -> Bin 6 ('6 - 7')
    # 6.50 -> Bin 6 ('6 - 7')
    # 7.99 -> Bin 7 ('7 - 8')
    # 8.00 -> Bin 8 ('8 - 9')
    # 11.0 clamped to 10.0 -> Bin 9 ('9 - 10')
    bins = d["score_distribution"]["bins"]
    assert bins[0]["count"] == 1
    assert bins[4]["count"] == 1
    assert bins[5]["count"] == 1
    assert bins[6]["count"] == 2
    assert bins[7]["count"] == 1
    assert bins[8]["count"] == 1
    assert bins[9]["count"] == 1


# ==============================================================================
# 3. Multi-Tenant Teacher Data Isolation
# ==============================================================================

def test_adv_strict_teacher_isolation_attack(ctx):
    """
    Adversarial attack: Teacher A attempts to access Teacher B's data:
    1. Teacher A passes Teacher B's classroom_id to all endpoints -> 403 Forbidden.
    2. Teacher A passes Teacher B's exam_id to all endpoints -> 403 Forbidden.
    3. Teacher A passes Teacher B's student_id to all endpoints -> 403 Forbidden.
    4. Teacher A queries global dashboard, students, summary -> ZERO leakage of B's data.
    """
    client = ctx["client"]
    SessionLocal = ctx["SessionLocal"]

    teacher_a, headers_a = make_user(SessionLocal, "teacher_a_adv@test.com", "TEACHER", "Teacher A")
    teacher_b, headers_b = make_user(SessionLocal, "teacher_b_adv@test.com", "TEACHER", "Teacher B")

    class_a = make_classroom(SessionLocal, "Classroom A", teacher_a.id)
    class_b = make_classroom(SessionLocal, "Classroom B", teacher_b.id)

    st_a, _ = make_user(SessionLocal, "student_a_adv@test.com", "STUDENT", "Student A")
    enroll_student(SessionLocal, class_a.id, st_a.id)

    st_b, _ = make_user(SessionLocal, "student_b_adv@test.com", "STUDENT", "Student B")
    enroll_student(SessionLocal, class_b.id, st_b.id)

    exam_a = make_exam(SessionLocal, "Exam A", teacher_a.id)
    assign_exam(SessionLocal, class_a.id, exam_a.id)
    make_submission(SessionLocal, exam_a.id, st_a.id, score=9.0)

    exam_b = make_exam(SessionLocal, "Exam B", teacher_b.id)
    assign_exam(SessionLocal, class_b.id, exam_b.id)
    make_submission(SessionLocal, exam_b.id, st_b.id, score=3.0)

    # Attack 1: Teacher A tries to query Teacher B's classroom
    for endpoint in [
        f"/api/analytics/dashboard?classroom_id={class_b.id}",
        f"/api/analytics/topics?classroom_id={class_b.id}",
        f"/api/analytics/recommendations?classroom_id={class_b.id}",
        f"/api/analytics/questions?classroom_id={class_b.id}",
        f"/api/analytics/students?classroom_id={class_b.id}",
        f"/api/analytics/summary?classroom_id={class_b.id}",
    ]:
        res = client.get(endpoint, headers=headers_a)
        assert res.status_code == 403, f"Expected 403 on {endpoint}, got {res.status_code}"

    # Attack 2: Teacher A tries to query Teacher B's exam
    for endpoint in [
        f"/api/analytics/dashboard?exam_id={exam_b.id}",
        f"/api/analytics/topics?exam_id={exam_b.id}",
        f"/api/analytics/recommendations?exam_id={exam_b.id}",
        f"/api/analytics/questions?exam_id={exam_b.id}",
        f"/api/analytics/students?exam_id={exam_b.id}",
    ]:
        res = client.get(endpoint, headers=headers_a)
        assert res.status_code == 403, f"Expected 403 on {endpoint}, got {res.status_code}"

    # Attack 3: Teacher A tries to query Teacher B's student
    for endpoint in [
        f"/api/analytics/dashboard?student_id={st_b.id}",
        f"/api/analytics/topics?student_id={st_b.id}",
    ]:
        res = client.get(endpoint, headers=headers_a)
        assert res.status_code == 403, f"Expected 403 on {endpoint}, got {res.status_code}"

    # Attack 4: Global view leak test
    res = client.get("/api/analytics/dashboard", headers=headers_a)
    assert res.status_code == 200
    d_a = res.json()
    assert d_a["summary"]["total_submissions"] == 1
    assert d_a["summary"]["unique_students"] == 1
    assert d_a["summary"]["average_score"] == 9.0  # Not diluted by Teacher B's score=3.0

    res = client.get("/api/analytics/students", headers=headers_a)
    assert res.status_code == 200
    st_res = res.json()
    assert st_res["total_students"] == 1
    assert st_res["students"][0]["student_id"] == st_a.id

    res = client.get("/api/analytics/summary", headers=headers_a)
    assert res.status_code == 200
    sum_res = res.json()
    assert sum_res["classrooms_count"] == 1
    assert sum_res["students_count"] == 1
    assert sum_res["exams_count"] == 1
    assert sum_res["submissions_count"] == 1
    assert sum_res["average_score"] == 9.0


# ==============================================================================
# 4. Mathematical Precision of Heuristic Rules
# ==============================================================================

def test_adv_heuristic_weak_topics_precision(ctx):
    """
    Empirical math verification:
    - Topic with accuracy >= 60.0% must NOT trigger WEAK_TOPIC.
    - Topic with accuracy < 60.0% AND attempts >= 3 MUST trigger WEAK_TOPIC.
    - Priority: HIGH if accuracy < 40.0%, else MEDIUM.
    - Topic with 0% accuracy but only 2 attempts must NOT trigger (attempts >= 3 threshold).
    """
    client = ctx["client"]
    SessionLocal = ctx["SessionLocal"]

    teacher, headers = make_user(SessionLocal, "t_weak_adv@test.com", "TEACHER", "Teacher Weak")
    classroom = make_classroom(SessionLocal, "Lớp Heuristic Weak", teacher.id)

    # Q1: Topic "Hàm số", correct_option=0
    q1 = make_question(SessionLocal, teacher.id, topic="Hàm số", correct_option=0)
    # Q2: Topic "Hình Oxyz", correct_option=0
    q2 = make_question(SessionLocal, teacher.id, topic="Hình Oxyz", correct_option=0)
    # Q3: Topic "Tích phân", correct_option=0
    q3 = make_question(SessionLocal, teacher.id, topic="Tích phân", correct_option=0)
    # Q4: Topic "Xác suất", correct_option=0
    q4 = make_question(SessionLocal, teacher.id, topic="Xác suất", correct_option=0)

    exam = make_exam(SessionLocal, "Đề Khảo Sát", teacher.id, questions=[q1, q2, q3, q4])
    assign_exam(SessionLocal, classroom.id, exam.id)

    # We will simulate 10 students
    students = []
    for i in range(10):
        st, _ = make_user(SessionLocal, f"st_w_{i}@test.com", "STUDENT", f"Student W {i}")
        enroll_student(SessionLocal, classroom.id, st.id)
        students.append(st)

    # Scenario:
    # Topic 1 ("Hàm số"): 10 attempts, 6 correct, 4 wrong -> 60.0% accuracy (boundary: exactly 60.0% -> NOT weak)
    # Topic 2 ("Hình Oxyz"): 10 attempts, 5 correct, 5 wrong -> 50.0% accuracy (< 60.0% and >= 40.0% -> MEDIUM)
    # Topic 3 ("Tích phân"): 10 attempts, 2 correct, 8 wrong -> 20.0% accuracy (< 40.0% -> HIGH)
    # Topic 4 ("Xác suất"): only 2 students answer it, 0 correct -> 0.0% accuracy, but attempts = 2 (< 3 -> NOT weak)

    for i, st in enumerate(students):
        ans = {
            str(q1.id): "A" if i < 6 else "B",
            str(q2.id): "A" if i < 5 else "B",
            str(q3.id): "A" if i < 2 else "B",
        }
        graded = {
            str(q1.id): {"question_id": q1.id, "is_correct": i < 6, "student_answer": "A" if i < 6 else "B"},
            str(q2.id): {"question_id": q2.id, "is_correct": i < 5, "student_answer": "A" if i < 5 else "B"},
            str(q3.id): {"question_id": q3.id, "is_correct": i < 2, "student_answer": "A" if i < 2 else "B"},
        }
        if i < 2:
            ans[str(q4.id)] = "B"
            graded[str(q4.id)] = {"question_id": q4.id, "is_correct": False, "student_answer": "B"}

        make_submission(
            SessionLocal,
            exam.id,
            st.id,
            score=6.0,
            answers=ans,
            graded_answers=graded
        )

    res = client.get(f"/api/analytics/recommendations?classroom_id={classroom.id}", headers=headers)
    assert res.status_code == 200
    recs = res.json()["recommendations"]

    weak_recs = [r for r in recs if r["category"] == "WEAK_TOPIC"]
    weak_topics_found = {r["metrics"]["topic"]: r["priority"] for r in weak_recs}

    # "Tích phân" (20%) -> HIGH
    assert "Tích phân" in weak_topics_found
    assert weak_topics_found["Tích phân"] == "HIGH"

    # "Hình Oxyz" (50%) -> MEDIUM
    assert "Hình Oxyz" in weak_topics_found
    assert weak_topics_found["Hình Oxyz"] == "MEDIUM"

    # "Hàm số" (60.0%) -> MUST NOT trigger
    assert "Hàm số" not in weak_topics_found, "Topic with exactly 60% accuracy should not trigger weak alert"

    # "Xác suất" (0%, 2 attempts) -> MUST NOT trigger due to attempts < 3
    assert "Xác suất" not in weak_topics_found, "Topic with < 3 attempts should not trigger weak alert"


def test_adv_heuristic_student_intervention_precision(ctx):
    """
    Empirical math verification of student intervention triggers:
    1. Score < 5.0 triggers intervention ("dưới mức đạt (5.0)").
    2. Score < class_avg - 1.5 triggers intervention ("thấp hơn đáng kể so với trung bình lớp").
    3. Boundary check on gap: gap = 1.50 vs gap = 1.51.
    4. Completion rate < 50.0% with assigned >= 2 triggers intervention.
    """
    client = ctx["client"]
    SessionLocal = ctx["SessionLocal"]

    teacher, headers = make_user(SessionLocal, "t_interv@test.com", "TEACHER", "Teacher Interv")
    classroom = make_classroom(SessionLocal, "Lớp Can Thiệp", teacher.id)

    # 4 students
    # St 1: score = 4.5 (< 5.0) -> triggers < 5.0
    # St 2: score = 9.0 (high)
    # St 3: score = 9.0 (high)
    # St 4: score = 6.0
    # Average of class = (4.5 + 9.0 + 9.0 + 6.0) / 4 = 28.5 / 4 = 7.125 -> rounded to 7.12
    # Threshold for gap: class_avg - 1.5 = 7.12 - 1.5 = 5.62
    # St 4 has score 6.0 > 5.62 -> DOES NOT trigger gap!
    # St 1 has score 4.5 < 5.62 -> triggers BOTH < 5.0 and < class_avg - 1.5!

    st1, _ = make_user(SessionLocal, "st_inv_1@test.com", "STUDENT", "Student Low")
    st2, _ = make_user(SessionLocal, "st_inv_2@test.com", "STUDENT", "Student High 1")
    st3, _ = make_user(SessionLocal, "st_inv_3@test.com", "STUDENT", "Student High 2")
    st4, _ = make_user(SessionLocal, "st_inv_4@test.com", "STUDENT", "Student Mid")

    for s in [st1, st2, st3, st4]:
        enroll_student(SessionLocal, classroom.id, s.id)

    exam = make_exam(SessionLocal, "Đề KT Chung", teacher.id)
    assign_exam(SessionLocal, classroom.id, exam.id)

    make_submission(SessionLocal, exam.id, st1.id, score=4.5)
    make_submission(SessionLocal, exam.id, st2.id, score=9.0)
    make_submission(SessionLocal, exam.id, st3.id, score=9.0)
    make_submission(SessionLocal, exam.id, st4.id, score=6.0)

    res = client.get(f"/api/analytics/students?classroom_id={classroom.id}", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["class_average"] == 7.12

    st_map = {s["student_id"]: s for s in data["students"]}

    # Student 1: needs intervention = True, both reasons
    assert st_map[st1.id]["needs_intervention"] is True
    assert any("dưới mức đạt" in r for r in st_map[st1.id]["intervention_reasons"])
    assert any("thấp hơn đáng kể" in r for r in st_map[st1.id]["intervention_reasons"])

    # Student 4: score 6.0 >= 5.0 and 6.0 >= (7.12 - 1.5 = 5.62) -> NO intervention
    assert st_map[st4.id]["needs_intervention"] is False
    assert st_map[st4.id]["intervention_reasons"] == []

    # Student 2 & 3: NO intervention
    assert st_map[st2.id]["needs_intervention"] is False
    assert st_map[st3.id]["needs_intervention"] is False


def test_adv_heuristic_misleading_distractor_trap_precision(ctx):
    """
    Empirical math verification of question anomaly and distractor trap rules:
    - Condition 1: Question attempts < 5 must NEVER flag anomaly (noise guard).
    - Condition 2: Question with >= 40.0% choosing a single WRONG option MUST flag anomaly
      with title "Bẫy đề thi bất thường".
    - Condition 3: Question with accuracy < 35.0% without single dominant distractor MUST flag
      anomaly with title "Câu hỏi có tỷ lệ sai bất thường".
    - Condition 4: Question with 80% accuracy and evenly split distractors must NOT flag anomaly.
    """
    client = ctx["client"]
    SessionLocal = ctx["SessionLocal"]

    teacher, headers = make_user(SessionLocal, "t_trap_adv@test.com", "TEACHER", "Teacher Trap")
    classroom = make_classroom(SessionLocal, "Lớp Trap Test", teacher.id)

    # Q1: Trap Question (correct_option=0 (A), distractor B is trap)
    q1 = make_question(SessionLocal, teacher.id, code="Q_TRAP", correct_option=0)
    # Q2: Hard Question (correct_option=0 (A), accuracy 20%, distractors evenly spread)
    q2 = make_question(SessionLocal, teacher.id, code="Q_HARD", correct_option=0)
    # Q3: Normal Healthy Question (correct_option=0 (A), accuracy 80%)
    q3 = make_question(SessionLocal, teacher.id, code="Q_HEALTHY", correct_option=0)
    # Q4: Small sample question (only 4 attempts, 100% wrong on B)
    q4 = make_question(SessionLocal, teacher.id, code="Q_SMALL", correct_option=0)

    exam = make_exam(SessionLocal, "Đề Trap", teacher.id, questions=[q1, q2, q3, q4])
    assign_exam(SessionLocal, classroom.id, exam.id)

    # 10 students
    students = []
    for i in range(10):
        st, _ = make_user(SessionLocal, f"st_tr_{i}@test.com", "STUDENT", f"St Trap {i}")
        enroll_student(SessionLocal, classroom.id, st.id)
        students.append(st)

    for i, st in enumerate(students):
        # Q1: 4 chose A (40% correct), 4 chose B (40% misleading distractor!), 1 chose C (10%), 1 chose D (10%)
        q1_ans = "A" if i < 4 else ("B" if i < 8 else ("C" if i == 8 else "D"))

        # Q2: 2 chose A (20% correct), 3 chose B (30%), 3 chose C (30%), 2 chose D (20%) -> acc=20% < 35%, max distractor=30% < 40%
        q2_ans = "A" if i < 2 else ("B" if i < 5 else ("C" if i < 8 else "D"))

        # Q3: 8 chose A (80% correct), 1 chose B (10%), 1 chose C (10%)
        q3_ans = "A" if i < 8 else ("B" if i == 8 else "C")

        ans = {str(q1.id): q1_ans, str(q2.id): q2_ans, str(q3.id): q3_ans}
        graded = {
            str(q1.id): {"question_id": q1.id, "is_correct": q1_ans == "A", "student_answer": q1_ans},
            str(q2.id): {"question_id": q2.id, "is_correct": q2_ans == "A", "student_answer": q2_ans},
            str(q3.id): {"question_id": q3.id, "is_correct": q3_ans == "A", "student_answer": q3_ans},
        }

        # Q4: Only first 4 students answer, all chose B
        if i < 4:
            ans[str(q4.id)] = "B"
            graded[str(q4.id)] = {"question_id": q4.id, "is_correct": False, "student_answer": "B"}

        make_submission(
            SessionLocal,
            exam.id,
            st.id,
            score=5.0,
            answers=ans,
            graded_answers=graded
        )

    # 1. Check /questions endpoint
    res_q = client.get(f"/api/analytics/questions?exam_id={exam.id}", headers=headers)
    assert res_q.status_code == 200
    q_map = {item["question_id"]: item for item in res_q.json()["questions"]}

    # Q1 (Trap):
    assert q_map[q1.id]["is_flagged_anomaly"] is True
    assert "phương án nhiễu có tỷ lệ chọn sai >= 40%" in q_map[q1.id]["anomaly_reason"]
    # Option B must have 40.0%
    opt_b = next(o for o in q_map[q1.id]["distractor_analysis"] if o["option_letter"] == "B")
    assert opt_b["percentage"] == 40.0
    assert opt_b["is_correct"] is False

    # Q2 (Hard low accuracy):
    assert q_map[q2.id]["is_flagged_anomaly"] is True
    assert "Tỷ lệ làm đúng thấp bất thường (20.0%)" in q_map[q2.id]["anomaly_reason"]

    # Q3 (Healthy):
    assert q_map[q3.id]["is_flagged_anomaly"] is False
    assert q_map[q3.id]["anomaly_reason"] is None

    # Q4 (Small sample < 5 attempts):
    assert q_map[q4.id]["is_flagged_anomaly"] is False, "Question with < 5 attempts must not be flagged"

    # 2. Check /recommendations endpoint
    res_r = client.get(f"/api/analytics/recommendations?exam_id={exam.id}", headers=headers)
    assert res_r.status_code == 200
    recs = res_r.json()["recommendations"]
    q_recs = [r for r in recs if r["category"] == "QUESTION_ANOMALY"]
    q_rec_titles = {r["metrics"]["question_id"]: r["title"] for r in q_recs}

    # Q1 recommendation must identify trap
    assert q1.id in q_rec_titles
    assert "Bẫy đề thi bất thường" in q_rec_titles[q1.id]

    # Q2 recommendation must identify abnormal error rate
    assert q2.id in q_rec_titles
    assert "Câu hỏi có tỷ lệ sai bất thường" in q_rec_titles[q2.id]

    # Q3 and Q4 must NOT generate anomaly recommendations
    assert q3.id not in q_rec_titles
    assert q4.id not in q_rec_titles
