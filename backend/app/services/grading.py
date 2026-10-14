import re
from typing import List, Dict, Any, Tuple, Optional

def normalize_text(text: str) -> str:
    if text is None:
        return ""
    s = str(text).lower()
    # Remove all whitespace
    s = re.sub(r'\s+', '', s)
    return s

def compare_values(student_val: str, correct_val: str) -> bool:
    if student_val is None or correct_val is None:
        return str(student_val).strip().lower() == str(correct_val).strip().lower()

    s_norm = normalize_text(student_val)
    c_norm = normalize_text(correct_val)

    if s_norm == c_norm:
        return True

    # Try numeric comparison if applicable
    try:
        s_num = float(student_val)
        c_num = float(correct_val)
        return abs(s_num - c_num) < 1e-5
    except (ValueError, TypeError):
        pass

    return False


def calculate_total_score(n_obj: int, auto_score: float, n_essay: int, essay_scores: List[float]) -> float:
    """
    Chuẩn hóa điểm tổng của toàn bộ bài thi về thang 10.0 chuẩn.
    - n_obj: Tổng số câu hỏi trắc nghiệm/khách quan
    - auto_score: Điểm trắc nghiệm (thang 10.0)
    - n_essay: Tổng số câu tự luận
    - essay_scores: Danh sách điểm các câu tự luận đã chấm (mỗi câu tối đa 10.0)
    """
    if n_obj <= 0 and n_essay <= 0:
        return 0.0

    if n_essay <= 0:
        return round(min(10.0, max(0.0, float(auto_score or 0.0))), 2)

    total_essay = sum(float(s or 0.0) for s in essay_scores) if essay_scores else 0.0
    avg_essay = total_essay / n_essay if n_essay > 0 else 0.0

    if n_obj <= 0:
        return round(min(10.0, max(0.0, avg_essay)), 2)

    # Đề thi kết hợp: Trọng số phân bổ theo tỷ lệ số lượng câu hỏi
    combined = ((float(auto_score or 0.0) * n_obj) + (avg_essay * n_essay)) / (n_obj + n_essay)
    return round(min(10.0, max(0.0, combined)), 2)


class GradingService:
    def grade(self, questions, student_answers) -> Tuple[float, int, Dict[str, Any]]:
        """
        questions: List of Question model objects
        student_answers: Dict[question_id, answer_data]
        Trả về: (score_thang_10, correct_count, graded_answers)
        """
        correct_count = 0
        total_earned_points = 0.0
        total = len(questions)
        graded_answers = {}

        for q in questions:
            if q.question_type == "ESSAY":
                total -= 1
                graded_answers[str(q.id)] = {
                    "question_id": q.id,
                    "question_type": q.question_type,
                    "student_answer": student_answers.get(str(q.id)) or student_answers.get(q.id),
                    "correct_answer": None,
                    "is_correct": None,
                    "points_awarded": 0.0,
                    "max_points": 10.0
                }
                continue

            key_str = str(q.id)
            ans = student_answers.get(key_str, student_answers.get(q.id, None))
            is_correct = False
            correct_val = None
            points_awarded = 0.0

            if q.question_type == "MULTIPLE_CHOICE":
                correct_val = q.correct_option
                try:
                    if ans is not None and q.correct_option is not None:
                        ans_int = int(ans)
                        corr_int = int(q.correct_option)
                        if ans_int == corr_int:
                            is_correct = True
                            points_awarded = 1.0
                except (ValueError, TypeError):
                    pass

            elif q.question_type == "TRUE_FALSE":
                correct_val = q.sub_questions
                sub_correct_count = 0
                total_subs = len(q.sub_questions) if q.sub_questions else 4
                if q.sub_questions:
                    for sq_idx, sq in enumerate(q.sub_questions):
                        sq_id = str(sq.get("id", sq_idx))
                        if isinstance(ans, dict):
                            student_val = ans.get(sq_id)
                            if student_val is None and str(sq_idx) in ans:
                                student_val = ans.get(str(sq_idx))
                        elif isinstance(ans, list):
                            try:
                                idx = int(sq_id) - 1 if sq_id.isdigit() and int(sq_id) >= 1 else sq_idx
                                student_val = ans[idx] if 0 <= idx < len(ans) else None
                            except (ValueError, IndexError):
                                student_val = None
                        else:
                            student_val = None

                        expected = sq.get("correct") if "correct" in sq else sq.get("answer")
                        if student_val is not None:
                            s_bool = student_val is True or str(student_val).lower() in ("true", "đúng", "dung", "1", "t")
                            e_bool = expected is True or str(expected).lower() in ("true", "đúng", "dung", "1", "t")
                            if s_bool == e_bool:
                                sub_correct_count += 1

                    # Thang điểm chuẩn của Bộ GD&ĐT cho câu hỏi Đúng / Sai 4 ý:
                    # - Đúng 1 ý: 0.1 điểm (10%)
                    # - Đúng 2 ý: 0.25 điểm (25%)
                    # - Đúng 3 ý: 0.5 điểm (50%)
                    # - Đúng 4 ý: 1.0 điểm (100%)
                    moet_scale = {1: 0.1, 2: 0.25, 3: 0.5, 4: 1.0}
                    if total_subs == 4:
                        points_awarded = moet_scale.get(sub_correct_count, 0.0)
                    else:
                        points_awarded = round(sub_correct_count / total_subs, 2) if total_subs > 0 else 0.0

                    is_correct = (sub_correct_count == total_subs) and total_subs > 0

            elif q.question_type == "SHORT_ANSWER":
                possible_answers = []
                if q.correct_answers and isinstance(q.correct_answers, list):
                    possible_answers.extend(q.correct_answers)
                if q.correct_answer:
                    possible_answers.append(q.correct_answer)
                correct_val = possible_answers if len(possible_answers) > 1 else (possible_answers[0] if possible_answers else None)

                if ans is not None:
                    for pa in possible_answers:
                        if compare_values(str(ans), str(pa)):
                            is_correct = True
                            points_awarded = 1.0
                            break

            elif q.question_type == "FILL_IN_BLANK":
                correct_val = q.blanks
                if isinstance(ans, dict) and q.blanks:
                    all_blanks_correct = True
                    for b in q.blanks:
                        key = b.get("key")
                        student_val = ans.get(key, "")

                        # Collect all correct answers for this blank
                        b_possible = []
                        if b.get("correct_answers") and isinstance(b.get("correct_answers"), list):
                            b_possible.extend(b.get("correct_answers"))
                        if b.get("correct_answer") is not None:
                            b_possible.append(b.get("correct_answer"))

                        blank_matched = False
                        for bp in b_possible:
                            if compare_values(str(student_val), str(bp)):
                                blank_matched = True
                                break
                        if not blank_matched:
                            all_blanks_correct = False
                            break
                    if all_blanks_correct:
                        is_correct = True
                        points_awarded = 1.0

            if is_correct:
                correct_count += 1
            total_earned_points += points_awarded

            graded_answers[str(q.id)] = {
                "question_id": q.id,
                "question_type": q.question_type,
                "student_answer": ans,
                "correct_answer": correct_val,
                "is_correct": is_correct,
                "points_awarded": points_awarded,
                "max_points": 1.0
            }

        score = (total_earned_points / total * 10.0) if total > 0 else 0.0
        return round(score, 2), correct_count, graded_answers
