import json
import logging
import statistics
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple, Set

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, or_, and_, desc

from app.models.user import User
from app.models.classroom import Classroom, ClassroomStudent, Assignment, ClassroomExam
from app.models.exam import Exam, ExamSubmission
from app.models.question import Question
from app.schemas.analytics import (
    AnalyticsFilters,
    AnalyticsSummaryStats,
    ScoreBin,
    ScoreTier,
    ScoreDistribution,
    TopWeakTopic,
    RecommendationsSummary,
    DashboardAnalyticsResponse,
    DifficultyStats,
    TopicPerformance,
    DifficultySummaryItem,
    QuestionTypeSummaryItem,
    TopicAnalyticsResponse,
    RecommendationItem,
    RecommendationsPrioritySummary,
    RecommendationsResponse,
    DistractorOption,
    QuestionItemAnalytics,
    QuestionAnalyticsResponse,
    StudentPerformanceItem,
    StudentAnalyticsResponse,
    LegacyScoreDistributionItem,
    EnhancedTeacherSummaryResponse,
)

logger = logging.getLogger(__name__)


def parse_iso_datetime(date_str: Optional[str], is_end_of_day: bool = False) -> Optional[datetime]:
    """Parse ISO date or datetime string into a normalized naive UTC datetime for comparison."""
    if not date_str:
        return None
    try:
        cleaned = date_str.strip()
        if len(cleaned) == 10 and cleaned.count("-") == 2:
            dt = datetime.fromisoformat(cleaned)
            if is_end_of_day:
                dt = dt.replace(hour=23, minute=59, second=59, microsecond=999999)
            else:
                dt = dt.replace(hour=0, minute=0, second=0, microsecond=0)
            return dt

        cleaned = cleaned.replace("Z", "+00:00")
        dt = datetime.fromisoformat(cleaned)
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except Exception as e:
        logger.warning(f"Error parsing date string '{date_str}': {e}")
        return None


def extract_option_index(ans: Any, options_count: int = 4) -> Optional[int]:
    """Extract zero-based option index (0 for A, 1 for B, ...) from raw student answer."""
    if ans is None:
        return None
    if isinstance(ans, int):
        if 0 <= ans < options_count:
            return ans
        return None
    s = str(ans).strip().upper()
    if s.isdigit():
        idx = int(s)
        if 0 <= idx < options_count:
            return idx
        return None
    if len(s) == 1 and "A" <= s <= "Z":
        idx = ord(s) - ord("A")
        if 0 <= idx < options_count:
            return idx
    return None


class AnalyticsService:

    @staticmethod
    async def validate_teacher_classroom_access(
        db: AsyncSession,
        current_user: User,
        classroom_id: int
    ) -> Classroom:
        """Validate that classroom exists and is owned by teacher (or user is admin)."""
        classroom = await db.get(Classroom, classroom_id)
        if not classroom or classroom.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lớp học không tồn tại"
            )
        if current_user.role == "TEACHER" and classroom.instructor_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền truy cập dữ liệu của lớp học này"
            )
        return classroom

    @staticmethod
    async def validate_teacher_exam_access(
        db: AsyncSession,
        current_user: User,
        exam_id: int
    ) -> Exam:
        """Validate that exam exists and is accessible by teacher (or user is admin)."""
        exam = await db.get(Exam, exam_id)
        if not exam or exam.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Đề thi không tồn tại"
            )
        if current_user.role == "TEACHER":
            if exam.created_by_id == current_user.id:
                return exam
            # Check if assigned to any class instructed by this teacher
            assign_check = await db.execute(
                select(Assignment.id)
                .join(Classroom, Assignment.classroom_id == Classroom.id)
                .filter(
                    Assignment.exam_id == exam_id,
                    Assignment.is_active == True,
                    Classroom.instructor_id == current_user.id,
                    Classroom.is_deleted == False
                )
            )
            if assign_check.scalars().first():
                return exam

            # Check ClassroomExam association
            ce_check = await db.execute(
                select(ClassroomExam.classroom_id)
                .join(Classroom, ClassroomExam.classroom_id == Classroom.id)
                .filter(
                    ClassroomExam.exam_id == exam_id,
                    Classroom.instructor_id == current_user.id,
                    Classroom.is_deleted == False
                )
            )
            if ce_check.scalars().first():
                return exam

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền truy cập đề thi này"
            )
        return exam

    @staticmethod
    async def validate_student_access(
        db: AsyncSession,
        current_user: User,
        student_id: int,
        classroom_id: Optional[int] = None
    ) -> User:
        """Validate student exists and teacher has permission to view their analytics."""
        student = await db.get(User, student_id)
        if not student or student.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Học sinh không tồn tại"
            )

        if classroom_id:
            cs = await db.execute(
                select(ClassroomStudent).filter(
                    ClassroomStudent.classroom_id == classroom_id,
                    ClassroomStudent.student_id == student_id,
                    ClassroomStudent.is_active == True
                )
            )
            if not cs.scalars().first():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Học sinh không thuộc lớp học này"
                )
        elif current_user.role == "TEACHER":
            # Check if student is in any classroom of this teacher
            cs = await db.execute(
                select(ClassroomStudent.classroom_id)
                .join(Classroom, ClassroomStudent.classroom_id == Classroom.id)
                .filter(
                    ClassroomStudent.student_id == student_id,
                    ClassroomStudent.is_active == True,
                    Classroom.instructor_id == current_user.id,
                    Classroom.is_deleted == False
                )
            )
            if not cs.scalars().first():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Bạn không có quyền truy cập dữ liệu của học sinh này"
                )
        return student

    @classmethod
    async def get_filtered_submissions(
        cls,
        db: AsyncSession,
        current_user: User,
        classroom_id: Optional[int] = None,
        exam_id: Optional[int] = None,
        student_id: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        attempt_filter: Optional[str] = "best"
    ) -> List[ExamSubmission]:
        """
        Query and filter completed exam submissions according to multi-dimensional criteria
        and attempt filter ("best", "latest", "all").
        """
        if classroom_id:
            await cls.validate_teacher_classroom_access(db, current_user, classroom_id)
        if exam_id:
            await cls.validate_teacher_exam_access(db, current_user, exam_id)
        if student_id:
            await cls.validate_student_access(db, current_user, student_id, classroom_id)

        # Base query: non-deleted exams, submitted or graded submissions
        query = (
            select(ExamSubmission)
            .join(Exam, ExamSubmission.exam_id == Exam.id)
            .filter(
                Exam.is_deleted == False,
                ExamSubmission.status.in_(["GRADED", "SUBMITTED"]),
                ExamSubmission.score.isnot(None)
            )
        )

        if classroom_id:
            # Must be a student enrolled in the classroom
            enrolled_student_ids = select(ClassroomStudent.student_id).filter(
                ClassroomStudent.classroom_id == classroom_id,
                ClassroomStudent.is_active == True
            )
            # Must be an exam assigned to the classroom
            assigned_exam_ids = select(Assignment.exam_id).filter(
                Assignment.classroom_id == classroom_id,
                Assignment.is_active == True
            ).union(
                select(ClassroomExam.exam_id).filter(ClassroomExam.classroom_id == classroom_id)
            )
            query = query.filter(
                ExamSubmission.user_id.in_(enrolled_student_ids),
                ExamSubmission.exam_id.in_(assigned_exam_ids)
            )
        elif current_user.role == "TEACHER":
            # Scoped to teacher's exams or assignments in teacher's classrooms
            teacher_class_exam_ids = (
                select(Assignment.exam_id)
                .join(Classroom, Assignment.classroom_id == Classroom.id)
                .filter(
                    Classroom.instructor_id == current_user.id,
                    Classroom.is_deleted == False,
                    Assignment.is_active == True
                )
            )
            query = query.filter(
                or_(
                    Exam.created_by_id == current_user.id,
                    Exam.id.in_(teacher_class_exam_ids)
                )
            )

        if exam_id:
            query = query.filter(ExamSubmission.exam_id == exam_id)

        if student_id:
            query = query.filter(ExamSubmission.user_id == student_id)

        start_dt = parse_iso_datetime(start_date, is_end_of_day=False)
        if start_dt:
            query = query.filter(ExamSubmission.submitted_at >= start_dt)

        end_dt = parse_iso_datetime(end_date, is_end_of_day=True)
        if end_dt:
            query = query.filter(ExamSubmission.submitted_at <= end_dt)

        # Order by student, exam, score descending, submitted_at descending
        query = query.order_by(
            ExamSubmission.user_id,
            ExamSubmission.exam_id,
            desc(ExamSubmission.score),
            desc(ExamSubmission.submitted_at)
        )

        result = await db.execute(query)
        all_subs = result.scalars().all()

        attempt_mode = (attempt_filter or "best").lower()

        if attempt_mode == "all":
            return all_subs

        # Group by (user_id, exam_id)
        grouped: Dict[Tuple[int, int], List[ExamSubmission]] = {}
        for sub in all_subs:
            key = (sub.user_id, sub.exam_id)
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(sub)

        filtered: List[ExamSubmission] = []
        for (u_id, e_id), sub_list in grouped.items():
            if attempt_mode == "latest":
                # Pick submission with latest submitted_at
                latest_sub = max(
                    sub_list,
                    key=lambda s: s.submitted_at or datetime.min
                )
                filtered.append(latest_sub)
            else:
                # Default "best": highest score, tiebreak latest submitted_at
                best_sub = max(
                    sub_list,
                    key=lambda s: (
                        float(s.score if s.score is not None else -1.0),
                        s.submitted_at or datetime.min
                    )
                )
                filtered.append(best_sub)

        return filtered

    @staticmethod
    def calculate_summary_statistics(
        submissions: List[ExamSubmission],
        pass_threshold: float = 5.0
    ) -> AnalyticsSummaryStats:
        """Calculate primary descriptive statistics from submissions list."""
        total = len(submissions)
        if total == 0:
            return AnalyticsSummaryStats(
                total_submissions=0,
                unique_students=0,
                total_exams=0,
                average_score=0.0,
                median_score=0.0,
                highest_score=0.0,
                lowest_score=0.0,
                standard_deviation=0.0,
                pass_count=0,
                fail_count=0,
                pass_rate=0.0
            )

        unique_students = len(set(s.user_id for s in submissions))
        total_exams = len(set(s.exam_id for s in submissions))
        scores = [float(s.score) for s in submissions if s.score is not None]

        if not scores:
            return AnalyticsSummaryStats(
                total_submissions=total,
                unique_students=unique_students,
                total_exams=total_exams,
                average_score=0.0,
                median_score=0.0,
                highest_score=0.0,
                lowest_score=0.0,
                standard_deviation=0.0,
                pass_count=0,
                fail_count=0,
                pass_rate=0.0
            )

        avg = round(sum(scores) / len(scores), 2)
        med = round(float(statistics.median(scores)), 2)
        highest = round(max(scores), 2)
        lowest = round(min(scores), 2)
        std_dev = round(float(statistics.pstdev(scores)), 2) if len(scores) > 1 else 0.0

        pass_count = sum(1 for sc in scores if sc >= pass_threshold)
        fail_count = len(scores) - pass_count
        pass_rate = round((pass_count / len(scores)) * 100.0, 2)

        return AnalyticsSummaryStats(
            total_submissions=total,
            unique_students=unique_students,
            total_exams=total_exams,
            average_score=avg,
            median_score=med,
            highest_score=highest,
            lowest_score=lowest,
            standard_deviation=std_dev,
            pass_count=pass_count,
            fail_count=fail_count,
            pass_rate=pass_rate
        )

    @staticmethod
    def calculate_score_distribution(submissions: List[ExamSubmission]) -> ScoreDistribution:
        """Calculate 10-bin score histogram and 4 academic tiers."""
        scores = [float(s.score) for s in submissions if s.score is not None]
        total = len(scores)

        # 10 bins: [0, 1), [1, 2), ..., [9, 10]
        bin_counts = [0] * 10
        for sc in scores:
            clamped = min(10.0, max(0.0, sc))
            if clamped == 10.0:
                bin_idx = 9
            else:
                bin_idx = int(clamped)
                if bin_idx > 9:
                    bin_idx = 9
            bin_counts[bin_idx] += 1

        bins: List[ScoreBin] = []
        for i in range(10):
            cnt = bin_counts[i]
            pct = round((cnt / total * 100.0), 2) if total > 0 else 0.0
            bins.append(
                ScoreBin(
                    bin=f"{i} - {i + 1}",
                    min=float(i),
                    max=float(i + 1),
                    count=cnt,
                    percentage=pct
                )
            )

        # 4 academic tiers
        tier_counts = {
            "tier1": 0,  # < 5.0
            "tier2": 0,  # 5.0 - 6.49
            "tier3": 0,  # 6.5 - 7.99
            "tier4": 0,  # >= 8.0
        }

        for sc in scores:
            if sc < 5.0:
                tier_counts["tier1"] += 1
            elif sc < 6.5:
                tier_counts["tier2"] += 1
            elif sc < 8.0:
                tier_counts["tier3"] += 1
            else:
                tier_counts["tier4"] += 1

        tiers: List[ScoreTier] = [
            ScoreTier(
                tier="Yếu (< 5.0)",
                range="< 5.0",
                count=tier_counts["tier1"],
                percentage=round((tier_counts["tier1"] / total * 100.0), 2) if total > 0 else 0.0,
                color="#ef4444"
            ),
            ScoreTier(
                tier="Trung bình (5.0 - 6.49)",
                range="5.0 - 6.49",
                count=tier_counts["tier2"],
                percentage=round((tier_counts["tier2"] / total * 100.0), 2) if total > 0 else 0.0,
                color="#f59e0b"
            ),
            ScoreTier(
                tier="Khá (6.5 - 7.99)",
                range="6.5 - 7.99",
                count=tier_counts["tier3"],
                percentage=round((tier_counts["tier3"] / total * 100.0), 2) if total > 0 else 0.0,
                color="#3b82f6"
            ),
            ScoreTier(
                tier="Giỏi (>= 8.0)",
                range=">= 8.0",
                count=tier_counts["tier4"],
                percentage=round((tier_counts["tier4"] / total * 100.0), 2) if total > 0 else 0.0,
                color="#10b981"
            ),
        ]

        return ScoreDistribution(bins=bins, tiers=tiers)

    @classmethod
    async def get_questions_map(cls, db: AsyncSession, question_ids: Set[int]) -> Dict[int, Question]:
        """Batch load Question objects by question_ids."""
        if not question_ids:
            return {}
        result = await db.execute(
            select(Question).filter(Question.id.in_(question_ids))
        )
        questions = result.scalars().all()
        return {q.id: q for q in questions}

    @classmethod
    async def calculate_topic_performance(
        cls,
        db: AsyncSession,
        submissions: List[ExamSubmission]
    ) -> TopicAnalyticsResponse:
        """
        Aggregate accuracy and attempt counts grouped by topic, chapter,
        cognitive difficulty level, and question type.
        """
        if not submissions:
            return TopicAnalyticsResponse(
                topics=[],
                difficulty_summary=[],
                question_type_summary=[]
            )

        # Collect all question IDs from graded answers
        qids: Set[int] = set()
        sub_graded_list: List[Dict[str, Any]] = []

        for sub in submissions:
            g_ans = sub.graded_answers
            if isinstance(g_ans, str):
                try:
                    g_ans = json.loads(g_ans)
                except Exception:
                    g_ans = {}
            if not isinstance(g_ans, dict):
                g_ans = {}

            sub_graded_list.append(g_ans)
            for k, val in g_ans.items():
                try:
                    qid = int(val.get("question_id") or k)
                    qids.add(qid)
                except (ValueError, TypeError):
                    pass

        questions_map = await cls.get_questions_map(db, qids)

        # Data structures for aggregation
        # topic_data[topic_key] = {chapter, subject, question_ids, total_attempts, correct_attempts, difficulty_breakdown}
        topic_data: Dict[str, Dict[str, Any]] = {}

        diff_summary: Dict[str, Dict[str, int]] = {
            "NHAN_BIET": {"total": 0, "correct": 0},
            "THONG_HIEU": {"total": 0, "correct": 0},
            "VAN_DUNG": {"total": 0, "correct": 0},
            "VAN_DUNG_CAO": {"total": 0, "correct": 0},
        }

        qtype_summary: Dict[str, Dict[str, int]] = {}

        for g_ans in sub_graded_list:
            for k, val in g_ans.items():
                try:
                    qid = int(val.get("question_id") or k)
                except (ValueError, TypeError):
                    continue

                q = questions_map.get(qid)
                topic_name = (q.topic.strip() if q and q.topic else None) or "Chủ đề chung"
                chapter_name = q.chapter if q else None
                subject_name = q.subject if q else None
                diff = (q.difficulty if q and q.difficulty else "THONG_HIEU")
                qtype = (q.question_type if q and q.question_type else "MULTIPLE_CHOICE")

                is_correct = bool(val.get("is_correct") is True)

                # Initialize topic
                if topic_name not in topic_data:
                    topic_data[topic_name] = {
                        "topic": topic_name,
                        "chapter": chapter_name,
                        "subject": subject_name,
                        "question_ids": set(),
                        "total_attempts": 0,
                        "correct_attempts": 0,
                        "difficulty_breakdown": {}
                    }

                t_entry = topic_data[topic_name]
                t_entry["question_ids"].add(qid)
                t_entry["total_attempts"] += 1
                if is_correct:
                    t_entry["correct_attempts"] += 1

                # Update difficulty breakdown inside topic
                diff_dict = t_entry["difficulty_breakdown"]
                if diff not in diff_dict:
                    diff_dict[diff] = {"total": 0, "correct": 0}
                diff_dict[diff]["total"] += 1
                if is_correct:
                    diff_dict[diff]["correct"] += 1

                # Update global difficulty summary
                if diff not in diff_summary:
                    diff_summary[diff] = {"total": 0, "correct": 0}
                diff_summary[diff]["total"] += 1
                if is_correct:
                    diff_summary[diff]["correct"] += 1

                # Update global question type summary
                if qtype not in qtype_summary:
                    qtype_summary[qtype] = {"total": 0, "correct": 0}
                qtype_summary[qtype]["total"] += 1
                if is_correct:
                    qtype_summary[qtype]["correct"] += 1

        # Format TopicPerformance models
        topics: List[TopicPerformance] = []
        for t_name, t_val in topic_data.items():
            tot = t_val["total_attempts"]
            corr = t_val["correct_attempts"]
            acc = round((corr / tot * 100.0), 2) if tot > 0 else 0.0

            # Determine mastery level
            if acc < 60.0:
                mastery = "NEEDS_IMPROVEMENT"
            elif acc < 75.0:
                mastery = "SATISFACTORY"
            elif acc < 90.0:
                mastery = "GOOD"
            else:
                mastery = "MASTERED"

            # Format difficulty breakdown
            formatted_diff_bd: Dict[str, DifficultyStats] = {}
            for d_name, d_counts in t_val["difficulty_breakdown"].items():
                d_tot = d_counts["total"]
                d_corr = d_counts["correct"]
                d_acc = round((d_corr / d_tot * 100.0), 2) if d_tot > 0 else 0.0
                formatted_diff_bd[d_name] = DifficultyStats(
                    total=d_tot,
                    correct=d_corr,
                    accuracy=d_acc
                )

            topics.append(
                TopicPerformance(
                    topic=t_val["topic"],
                    chapter=t_val["chapter"],
                    subject=t_val["subject"],
                    question_count=len(t_val["question_ids"]),
                    total_attempts=tot,
                    correct_attempts=corr,
                    accuracy_rate=acc,
                    mastery_level=mastery,
                    difficulty_breakdown=formatted_diff_bd
                )
            )

        # Sort topics: lowest accuracy first
        topics.sort(key=lambda t: (t.accuracy_rate, -t.total_attempts))

        # Format difficulty summary
        diff_summary_list: List[DifficultySummaryItem] = []
        for d_name, d_vals in diff_summary.items():
            if d_vals["total"] > 0:
                d_acc = round((d_vals["correct"] / d_vals["total"] * 100.0), 2)
                diff_summary_list.append(
                    DifficultySummaryItem(
                        difficulty=d_name,
                        total=d_vals["total"],
                        correct=d_vals["correct"],
                        accuracy_rate=d_acc
                    )
                )

        # Format question type summary
        qtype_summary_list: List[QuestionTypeSummaryItem] = []
        for q_type, q_vals in qtype_summary.items():
            if q_vals["total"] > 0:
                q_acc = round((q_vals["correct"] / q_vals["total"] * 100.0), 2)
                qtype_summary_list.append(
                    QuestionTypeSummaryItem(
                        question_type=q_type,
                        total=q_vals["total"],
                        correct=q_vals["correct"],
                        accuracy_rate=q_acc
                    )
                )

        return TopicAnalyticsResponse(
            topics=topics,
            difficulty_summary=diff_summary_list,
            question_type_summary=qtype_summary_list
        )

    @classmethod
    async def generate_recommendations(
        cls,
        db: AsyncSession,
        current_user: User,
        classroom_id: Optional[int] = None,
        exam_id: Optional[int] = None
    ) -> RecommendationsResponse:
        """
        Evaluate heuristic rules to produce actionable pedagogical recommendations:
        1. WEAK_TOPIC: Topics with class accuracy < 60%
        2. STUDENT_INTERVENTION: Students with score < 5.0, < avg - 1.5, or completion < 50%
        3. QUESTION_ANOMALY: High error rate (> 65%) or misleading distractor (> 40%)
        """
        if classroom_id:
            await cls.validate_teacher_classroom_access(db, current_user, classroom_id)
        if exam_id:
            await cls.validate_teacher_exam_access(db, current_user, exam_id)

        recommendations: List[RecommendationItem] = []

        # 1. Fetch relevant submissions
        subs = await cls.get_filtered_submissions(
            db=db,
            current_user=current_user,
            classroom_id=classroom_id,
            exam_id=exam_id,
            attempt_filter="best"
        )

        # --------------------------------------------------------------------
        # Heuristic 1: Weak Topics (< 60% accuracy, attempts >= 3)
        # --------------------------------------------------------------------
        topic_resp = await cls.calculate_topic_performance(db, subs)
        for t in topic_resp.topics:
            if t.total_attempts >= 3 and t.accuracy_rate < 60.0:
                # Count affected students who answered wrong in this topic
                affected_students_set: Set[int] = set()
                for sub in subs:
                    g_ans = sub.graded_answers
                    if isinstance(g_ans, str):
                        try:
                            g_ans = json.loads(g_ans)
                        except Exception:
                            g_ans = {}
                    if isinstance(g_ans, dict):
                        for k, v in g_ans.items():
                            if v.get("is_correct") is False:
                                affected_students_set.add(sub.user_id)

                affected_count = len(affected_students_set)
                priority = "HIGH" if t.accuracy_rate < 40.0 else "MEDIUM"
                rec_id = f"rec_weak_topic_{abs(hash(t.topic)) % 100000}"

                recommendations.append(
                    RecommendationItem(
                        id=rec_id,
                        priority=priority,
                        category="WEAK_TOPIC",
                        title=f"Chủ đề cần củng cố: {t.topic}",
                        description=(
                            f"Độ chính xác của học sinh ở chủ đề này chỉ đạt {t.accuracy_rate}% "
                            f"(dưới ngưỡng đạt 60.0%). Có {affected_count} học sinh trả lời sai câu hỏi ở chủ đề này."
                        ),
                        metrics={
                            "topic": t.topic,
                            "chapter": t.chapter,
                            "accuracy_rate": t.accuracy_rate,
                            "affected_students_count": affected_count,
                            "question_count": t.question_count,
                            "total_attempts": t.total_attempts
                        },
                        suggested_actions=[
                            f"Tổ chức buổi ôn tập lại các dạng bài tập thuộc chuyên đề '{t.topic}'.",
                            "Tạo bài tập bổ trợ mức độ Nhận biết và Thông hiểu cho học sinh chưa đạt."
                        ],
                        action_type="CREATE_ASSIGNMENT",
                        action_payload={
                            "topic": t.topic,
                            "classroom_id": classroom_id,
                            "suggested_difficulty": "THONG_HIEU"
                        }
                    )
                )

        # --------------------------------------------------------------------
        # Heuristic 2: Student Academic Intervention
        # --------------------------------------------------------------------
        if classroom_id:
            students_res = await cls.analyze_students(
                db=db,
                current_user=current_user,
                classroom_id=classroom_id,
                exam_id=exam_id
            )
            for s in students_res.students:
                if s.needs_intervention:
                    priority = "HIGH" if (s.average_score < 4.0 or s.completion_rate < 40.0) else "MEDIUM"
                    reasons_str = "; ".join(s.intervention_reasons)
                    rec_id = f"rec_student_{s.student_id}"

                    recommendations.append(
                        RecommendationItem(
                            id=rec_id,
                            priority=priority,
                            category="STUDENT_INTERVENTION",
                            title=f"Học sinh cần can thiệp: {s.student_name}",
                            description=(
                                f"Học sinh {s.student_name} có kết quả học tập đáng chú ý: {reasons_str}. "
                                f"Điểm trung bình hiện tại: {s.average_score} (trung bình lớp: {students_res.class_average})."
                            ),
                            metrics={
                                "student_id": s.student_id,
                                "student_name": s.student_name,
                                "student_average": s.average_score,
                                "class_average": students_res.class_average,
                                "completion_rate": s.completion_rate,
                                "submissions_count": s.submissions_count,
                                "assigned_count": s.assigned_count,
                                "reasons": s.intervention_reasons
                            },
                            suggested_actions=[
                                "Nhắc nhở học sinh nộp bù các bài tập hoặc bài kiểm tra còn thiếu.",
                                "Hẹn gặp trao đổi trực tiếp hoặc liên hệ phụ huynh để phối hợp kèm cặp.",
                                "Giao bài tập bổ trợ cá nhân hóa để cải thiện kiến thức hổng."
                            ],
                            action_type="STUDENT_PROFILE",
                            action_payload={
                                "student_id": s.student_id,
                                "classroom_id": classroom_id
                            }
                        )
                    )

        # --------------------------------------------------------------------
        # Heuristic 3: Question Anomaly & Distractor Detection
        # --------------------------------------------------------------------
        q_analytics = await cls.analyze_questions(
            db=db,
            current_user=current_user,
            exam_id=exam_id,
            classroom_id=classroom_id
        )

        for q in q_analytics.questions:
            if q.is_flagged_anomaly and q.total_attempts >= 5:
                # Find misleading distractor if any
                misleading_opt = next(
                    (opt for opt in q.distractor_analysis if not opt.is_correct and opt.percentage >= 40.0),
                    None
                )

                priority = "HIGH" if (q.accuracy_rate < 25.0 or (misleading_opt and misleading_opt.percentage >= 50.0)) else "MEDIUM"
                rec_id = f"rec_anomaly_q_{q.question_id}"

                if misleading_opt:
                    title = f"Bẫy đề thi bất thường: Câu hỏi #{q.code or q.question_id}"
                    desc = (
                        f"Có {misleading_opt.percentage}% học sinh chọn đáp án sai {misleading_opt.option_letter}, "
                        f"trong khi chỉ có {q.accuracy_rate}% chọn đáp án đúng. Cần kiểm tra lại nội dung câu hỏi hoặc đáp án."
                    )
                else:
                    title = f"Câu hỏi có tỷ lệ sai bất thường: Câu hỏi #{q.code or q.question_id}"
                    desc = (
                        f"Tỷ lệ làm đúng câu hỏi này chỉ đạt {q.accuracy_rate}% trên tổng số {q.total_attempts} lượt làm bài. "
                        f"Độ khó có thể vượt quá chương trình hoặc câu hỏi có lỗi diễn đạt."
                    )

                recommendations.append(
                    RecommendationItem(
                        id=rec_id,
                        priority=priority,
                        category="QUESTION_ANOMALY",
                        title=title,
                        description=desc,
                        metrics={
                            "question_id": q.question_id,
                            "question_code": q.code,
                            "accuracy_rate": q.accuracy_rate,
                            "total_attempts": q.total_attempts,
                            "misleading_option_letter": misleading_opt.option_letter if misleading_opt else None,
                            "misleading_percentage": misleading_opt.percentage if misleading_opt else None
                        },
                        suggested_actions=[
                            f"Kiểm tra lại nội dung đề bài, đáp án và lời giải của câu hỏi #{q.code or q.question_id}.",
                            "Giải thích bẫy này cho học sinh trong tiết sửa bài kiểm tra."
                        ],
                        action_type="EDIT_QUESTION",
                        action_payload={"question_id": q.question_id}
                    )
                )

        # Count priorities
        high_cnt = sum(1 for r in recommendations if r.priority == "HIGH")
        med_cnt = sum(1 for r in recommendations if r.priority == "MEDIUM")
        low_cnt = sum(1 for r in recommendations if r.priority == "LOW")

        return RecommendationsResponse(
            recommendations=recommendations,
            summary=RecommendationsPrioritySummary(
                high_priority_count=high_cnt,
                medium_priority_count=med_cnt,
                low_priority_count=low_cnt,
                total_recommendations=len(recommendations)
            )
        )

    @classmethod
    async def analyze_questions(
        cls,
        db: AsyncSession,
        current_user: User,
        exam_id: Optional[int] = None,
        classroom_id: Optional[int] = None
    ) -> QuestionAnalyticsResponse:
        """
        Analyze questions item-by-item: attempts, accuracy, distractor choices,
        and anomaly flags.
        """
        # Fetch all completed submissions for maximum item statistics
        subs = await cls.get_filtered_submissions(
            db=db,
            current_user=current_user,
            classroom_id=classroom_id,
            exam_id=exam_id,
            attempt_filter="all"
        )

        if not subs:
            return QuestionAnalyticsResponse(questions=[])

        # Map qid -> Question
        qids: Set[int] = set()
        for s in subs:
            g_ans = s.graded_answers
            if isinstance(g_ans, str):
                try:
                    g_ans = json.loads(g_ans)
                except Exception:
                    g_ans = {}
            if isinstance(g_ans, dict):
                for k, v in g_ans.items():
                    try:
                        qid = int(v.get("question_id") or k)
                        qids.add(qid)
                    except (ValueError, TypeError):
                        pass

        questions_map = await cls.get_questions_map(db, qids)

        # Question aggregation structure:
        # q_stats[qid] = {attempts: int, correct: int, option_counts: Dict[int, int]}
        q_stats: Dict[int, Dict[str, Any]] = {}
        for qid in qids:
            q_stats[qid] = {
                "attempts": 0,
                "correct": 0,
                "option_counts": {}
            }

        for s in subs:
            g_ans = s.graded_answers
            if isinstance(g_ans, str):
                try:
                    g_ans = json.loads(g_ans)
                except Exception:
                    g_ans = {}
            if not isinstance(g_ans, dict):
                g_ans = {}

            raw_ans = s.answers
            if isinstance(raw_ans, str):
                try:
                    raw_ans = json.loads(raw_ans)
                except Exception:
                    raw_ans = {}
            if not isinstance(raw_ans, dict):
                raw_ans = {}

            for k, val in g_ans.items():
                try:
                    qid = int(val.get("question_id") or k)
                except (ValueError, TypeError):
                    continue

                if qid not in q_stats:
                    continue

                st = q_stats[qid]
                st["attempts"] += 1
                if val.get("is_correct") is True:
                    st["correct"] += 1

                # Extract selected option
                student_choice = val.get("student_answer")
                if student_choice is None:
                    student_choice = raw_ans.get(str(qid), raw_ans.get(qid))

                q_obj = questions_map.get(qid)
                options_len = 4
                if q_obj and q_obj.options and isinstance(q_obj.options, list) and len(q_obj.options) >= 2:
                    options_len = len(q_obj.options)

                opt_idx = extract_option_index(student_choice, options_len)
                if opt_idx is not None:
                    st["option_counts"][opt_idx] = st["option_counts"].get(opt_idx, 0) + 1

        items: List[QuestionItemAnalytics] = []
        for qid, st in q_stats.items():
            q_obj = questions_map.get(qid)
            attempts = st["attempts"]
            correct = st["correct"]
            acc = round((correct / attempts * 100.0), 2) if attempts > 0 else 0.0

            # Determine number of options
            options_count = 4
            if q_obj and q_obj.options and isinstance(q_obj.options, list) and len(q_obj.options) >= 2:
                options_count = len(q_obj.options)

            correct_opt = getattr(q_obj, "correct_option", None) if q_obj else None

            distractors: List[DistractorOption] = []
            has_misleading_distractor = False
            for opt_idx in range(options_count):
                cnt = st["option_counts"].get(opt_idx, 0)
                pct = round((cnt / attempts * 100.0), 2) if attempts > 0 else 0.0
                is_corr = (opt_idx == correct_opt)
                if not is_corr and pct >= 40.0:
                    has_misleading_distractor = True

                distractors.append(
                    DistractorOption(
                        option_index=opt_idx,
                        option_letter=chr(65 + opt_idx),
                        count=cnt,
                        percentage=pct,
                        is_correct=is_corr
                    )
                )

            # Anomaly criteria: (accuracy < 35% with >= 5 attempts) OR (misleading distractor >= 40%)
            is_anomaly = False
            anomaly_reason = None
            if attempts >= 5:
                if acc < 35.0:
                    is_anomaly = True
                    anomaly_reason = f"Tỷ lệ làm đúng thấp bất thường ({acc}%)"
                elif has_misleading_distractor:
                    is_anomaly = True
                    anomaly_reason = "Tồn tại phương án nhiễu có tỷ lệ chọn sai >= 40%"

            items.append(
                QuestionItemAnalytics(
                    question_id=qid,
                    code=q_obj.code if q_obj else None,
                    content=q_obj.content if q_obj else None,
                    question_type=q_obj.question_type if q_obj else None,
                    difficulty=q_obj.difficulty if q_obj else None,
                    topic=q_obj.topic if q_obj else None,
                    total_attempts=attempts,
                    correct_count=correct,
                    accuracy_rate=acc,
                    distractor_analysis=distractors,
                    is_flagged_anomaly=is_anomaly,
                    anomaly_reason=anomaly_reason
                )
            )

        # Sort items: anomalies first, then lowest accuracy first
        items.sort(key=lambda it: (not it.is_flagged_anomaly, it.accuracy_rate))

        return QuestionAnalyticsResponse(questions=items)

    @classmethod
    async def analyze_students(
        cls,
        db: AsyncSession,
        current_user: User,
        classroom_id: Optional[int] = None,
        exam_id: Optional[int] = None
    ) -> StudentAnalyticsResponse:
        """
        Analyze students: submissions count, completion rate, average score,
        percentile rank, and intervention flags.
        """
        if classroom_id:
            await cls.validate_teacher_classroom_access(db, current_user, classroom_id)
        if exam_id:
            await cls.validate_teacher_exam_access(db, current_user, exam_id)

        # 1. Get student pool
        if classroom_id:
            st_query = (
                select(User)
                .join(ClassroomStudent, ClassroomStudent.student_id == User.id)
                .filter(
                    ClassroomStudent.classroom_id == classroom_id,
                    ClassroomStudent.is_active == True,
                    User.is_deleted == False
                )
            )
            # Active assignments count
            assign_count_res = await db.execute(
                select(func.count(Assignment.id)).filter(
                    Assignment.classroom_id == classroom_id,
                    Assignment.is_active == True
                )
            )
            total_assigned = assign_count_res.scalar() or 0
        else:
            # Teacher's all active students
            st_query = (
                select(User)
                .join(ClassroomStudent, ClassroomStudent.student_id == User.id)
                .join(Classroom, ClassroomStudent.classroom_id == Classroom.id)
                .filter(
                    Classroom.instructor_id == current_user.id,
                    Classroom.is_deleted == False,
                    ClassroomStudent.is_active == True,
                    User.is_deleted == False
                )
                .distinct()
            )
            total_assigned = 0

        st_res = await db.execute(st_query)
        students = st_res.scalars().all()

        if not students:
            return StudentAnalyticsResponse(
                students=[],
                class_average=0.0,
                total_students=0
            )

        # Fetch best submissions for all students in scope
        subs = await cls.get_filtered_submissions(
            db=db,
            current_user=current_user,
            classroom_id=classroom_id,
            exam_id=exam_id,
            attempt_filter="best"
        )

        # Map student_id -> list of scores
        student_scores: Dict[int, List[float]] = {s.id: [] for s in students}
        for sub in subs:
            if sub.user_id in student_scores and sub.score is not None:
                student_scores[sub.user_id].append(float(sub.score))

        # Calculate student stats
        all_averages: List[float] = []
        raw_student_stats: List[Dict[str, Any]] = []

        for st in students:
            scores = student_scores[st.id]
            sub_cnt = len(scores)
            avg = round(sum(scores) / sub_cnt, 2) if sub_cnt > 0 else 0.0
            hi = round(max(scores), 2) if sub_cnt > 0 else None
            lo = round(min(scores), 2) if sub_cnt > 0 else None

            # Calculate assigned count & completion rate
            assigned_cnt = total_assigned if total_assigned > 0 else max(sub_cnt, 1)
            comp_rate = round(min(100.0, (sub_cnt / assigned_cnt) * 100.0), 2)

            if sub_cnt > 0:
                all_averages.append(avg)

            raw_student_stats.append({
                "student": st,
                "submissions_count": sub_cnt,
                "assigned_count": assigned_cnt,
                "completion_rate": comp_rate,
                "average_score": avg,
                "highest_score": hi,
                "lowest_score": lo,
            })

        class_avg = round(sum(all_averages) / len(all_averages), 2) if all_averages else 0.0

        # Percentile ranking and intervention checks
        items: List[StudentPerformanceItem] = []
        for r in raw_student_stats:
            st = r["student"]
            avg = r["average_score"]
            sub_cnt = r["submissions_count"]
            comp_rate = r["completion_rate"]

            # Percentile: % of students with average <= this student's average
            if all_averages:
                lte_count = sum(1 for a in all_averages if a <= avg)
                percentile = round((lte_count / len(all_averages)) * 100.0, 2)
            else:
                percentile = 0.0

            reasons: List[str] = []
            if sub_cnt > 0:
                if avg < 5.0:
                    reasons.append(f"Điểm trung bình ({avg}) dưới mức đạt (5.0)")
                if class_avg > 0 and avg < class_avg - 1.5:
                    reasons.append(f"Điểm trung bình thấp hơn đáng kể so với trung bình lớp ({class_avg})")
            if comp_rate < 50.0 and r["assigned_count"] >= 2:
                reasons.append(f"Tỷ lệ hoàn thành bài tập thấp ({comp_rate}%)")

            needs_intervention = len(reasons) > 0

            items.append(
                StudentPerformanceItem(
                    student_id=st.id,
                    student_name=st.full_name or "Học sinh",
                    student_email=st.email,
                    submissions_count=sub_cnt,
                    assigned_count=r["assigned_count"],
                    completion_rate=comp_rate,
                    average_score=avg,
                    percentile=percentile,
                    highest_score=r["highest_score"],
                    lowest_score=r["lowest_score"],
                    needs_intervention=needs_intervention,
                    intervention_reasons=reasons
                )
            )

        # Sort students: needs intervention first, then by average score ascending
        items.sort(key=lambda s: (not s.needs_intervention, s.average_score))

        return StudentAnalyticsResponse(
            students=items,
            class_average=class_avg,
            total_students=len(students)
        )

    @classmethod
    async def get_dashboard_analytics(
        cls,
        db: AsyncSession,
        current_user: User,
        classroom_id: Optional[int] = None,
        exam_id: Optional[int] = None,
        student_id: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        attempt_filter: Optional[str] = "best"
    ) -> DashboardAnalyticsResponse:
        """
        Aggregate full dashboard payload: filters, summary stats, score distribution,
        top weak topics, and recommendation counters.
        """
        subs = await cls.get_filtered_submissions(
            db=db,
            current_user=current_user,
            classroom_id=classroom_id,
            exam_id=exam_id,
            student_id=student_id,
            start_date=start_date,
            end_date=end_date,
            attempt_filter=attempt_filter
        )

        summary_stats = cls.calculate_summary_statistics(subs)
        dist = cls.calculate_score_distribution(subs)

        # Topic performance and top weak topics
        topic_resp = await cls.calculate_topic_performance(db, subs)
        top_weak: List[TopWeakTopic] = []
        for t in topic_resp.topics:
            if t.accuracy_rate < 60.0:
                top_weak.append(
                    TopWeakTopic(
                        topic=t.topic,
                        chapter=t.chapter,
                        accuracy_rate=t.accuracy_rate,
                        question_count=t.question_count,
                        total_attempts=t.total_attempts,
                        correct_attempts=t.correct_attempts,
                        status="WEAK"
                    )
                )
        top_weak = top_weak[:5]  # Top 5 weakest topics

        # Recommendations summary
        recs_resp = await cls.generate_recommendations(
            db=db,
            current_user=current_user,
            classroom_id=classroom_id,
            exam_id=exam_id
        )

        return DashboardAnalyticsResponse(
            filters_applied=AnalyticsFilters(
                classroom_id=classroom_id,
                exam_id=exam_id,
                student_id=student_id,
                start_date=start_date,
                end_date=end_date,
                attempt_filter=attempt_filter or "best"
            ),
            summary=summary_stats,
            score_distribution=dist,
            top_weak_topics=top_weak,
            recommendations_summary=RecommendationsSummary(
                high_priority_count=recs_resp.summary.high_priority_count,
                total_recommendations=recs_resp.summary.total_recommendations
            )
        )

    @classmethod
    async def get_enhanced_summary(
        cls,
        db: AsyncSession,
        current_user: User,
        classroom_id: Optional[int] = None
    ) -> EnhancedTeacherSummaryResponse:
        """
        Backward-compatible enhanced summary preserving all 7 legacy keys
        plus enhanced statistical metrics.
        """
        # 1. Active classrooms count
        classrooms_query = select(func.count(Classroom.id)).filter(Classroom.is_deleted == False)
        if current_user.role == "TEACHER":
            classrooms_query = classrooms_query.filter(Classroom.instructor_id == current_user.id)
        classrooms_count_res = await db.execute(classrooms_query)
        classrooms_count = classrooms_count_res.scalar() or 0

        # 2. Active students count
        students_query = (
            select(func.count(func.distinct(ClassroomStudent.student_id)))
            .join(Classroom, ClassroomStudent.classroom_id == Classroom.id)
            .join(User, ClassroomStudent.student_id == User.id)
            .filter(
                Classroom.is_deleted == False,
                ClassroomStudent.is_active == True,
                User.is_deleted == False
            )
        )
        if classroom_id:
            students_query = students_query.filter(ClassroomStudent.classroom_id == classroom_id)
        elif current_user.role == "TEACHER":
            students_query = students_query.filter(Classroom.instructor_id == current_user.id)
        students_count_res = await db.execute(students_query)
        students_count = students_count_res.scalar() or 0

        # 3. Available exams count
        exams_query = select(func.count(Exam.id)).filter(Exam.is_deleted == False)
        if current_user.role == "TEACHER":
            exams_query = exams_query.filter(
                or_(
                    Exam.created_by_id == current_user.id,
                    Exam.created_by_id.is_(None)
                )
            )
        exams_count_res = await db.execute(exams_query)
        exams_count = exams_count_res.scalar() or 0

        # 4. Total questions count
        questions_count_res = await db.execute(select(func.count(Question.id)))
        questions_count = questions_count_res.scalar() or 0

        # 5. Fetch completed submissions for summary metrics
        subs = await cls.get_filtered_submissions(
            db=db,
            current_user=current_user,
            classroom_id=classroom_id,
            attempt_filter="all"
        )

        stats = cls.calculate_summary_statistics(subs)
        dist = cls.calculate_score_distribution(subs)

        # Legacy score ranges format
        legacy_distribution: List[LegacyScoreDistributionItem] = [
            LegacyScoreDistributionItem(name=t.tier.split(" (")[0] + f" ({t.range.replace('< 5.0', '< 5').replace('>= 8.0', '>= 8').replace('5.0 - 6.49', '5 - 6.5').replace('6.5 - 7.99', '6.5 - 8')})", count=t.count)
            for t in dist.tiers
        ]
        # Ensure exact legacy naming matching existing frontend expectations:
        legacy_names = ["Yếu (< 5)", "Trung bình (5 - 6.5)", "Khá (6.5 - 8)", "Giỏi (>= 8)"]
        legacy_counts = [dist.tiers[0].count, dist.tiers[1].count, dist.tiers[2].count, dist.tiers[3].count]
        legacy_distribution = [
            LegacyScoreDistributionItem(name=n, count=c)
            for n, c in zip(legacy_names, legacy_counts)
        ]

        # Active recommendations count
        recs_resp = await cls.generate_recommendations(
            db=db,
            current_user=current_user,
            classroom_id=classroom_id
        )

        return EnhancedTeacherSummaryResponse(
            exams_count=int(exams_count),
            questions_count=int(questions_count),
            classrooms_count=int(classrooms_count),
            students_count=int(students_count),
            submissions_count=int(stats.total_submissions),
            average_score=float(stats.average_score),
            score_distribution=legacy_distribution,
            median_score=float(stats.median_score),
            highest_score=float(stats.highest_score),
            lowest_score=float(stats.lowest_score),
            pass_rate=float(stats.pass_rate),
            active_recommendations_count=int(recs_resp.summary.total_recommendations)
        )
