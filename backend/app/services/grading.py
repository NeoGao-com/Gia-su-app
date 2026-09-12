import re

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


class GradingService:
    def grade(self, questions, student_answers):
        """
        questions: List of Question model objects
        student_answers: Dict[question_id, answer_data]
        """
        correct_count = 0
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
                    "max_points": 1.0
                }
                continue

            key_str = str(q.id)
            ans = student_answers.get(key_str, student_answers.get(q.id, None))
            is_correct = False
            correct_val = None

            if q.question_type == "MULTIPLE_CHOICE":
                correct_val = q.correct_option
                try:
                    if ans is not None and q.correct_option is not None:
                        ans_int = int(ans)
                        corr_int = int(q.correct_option)
                        if ans_int == corr_int or ans_int + 1 == corr_int or ans_int == corr_int + 1:
                            is_correct = True
                except (ValueError, TypeError):
                    continue  # non-numeric answer cannot match numeric correct_option

            elif q.question_type == "TRUE_FALSE":
                correct_val = q.sub_questions
                if q.sub_questions:
                    # Support both dict keyed by sub-id (frontend format) and list format
                    all_sub_correct = True
                    for sq in q.sub_questions:
                        sq_id = str(sq.get("id"))
                        if isinstance(ans, dict):
                            student_val = ans.get(sq_id)
                        elif isinstance(ans, list):
                            try:
                                idx = int(sq_id) - 1 if sq_id.isdigit() else q.sub_questions.index(sq)
                                student_val = ans[idx] if 0 <= idx < len(ans) else None
                            except (ValueError, IndexError):
                                student_val = None
                        else:
                            student_val = None
                        expected = sq.get("correct") if "correct" in sq else sq.get("answer")
                        if student_val != expected:
                            all_sub_correct = False
                            break
                    if all_sub_correct:
                        is_correct = True

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

            if is_correct:
                correct_count += 1

            graded_answers[str(q.id)] = {
                "question_id": q.id,
                "question_type": q.question_type,
                "student_answer": ans,
                "correct_answer": correct_val,
                "is_correct": is_correct,
                "points_awarded": 1.0 if is_correct else 0.0,
                "max_points": 1.0
            }

        score = (correct_count / total * 10) if total > 0 else 0
        return round(score, 2), correct_count, graded_answers


