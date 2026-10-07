from __future__ import annotations
import os
import re
import json
import logging
from typing import Optional, List, Dict, Any
from openai import OpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)


def _parse_json_response(raw: str):
    """Parse cứng output của LLM: strip markdown fence, fallback heuristic."""
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass
    # Heuristic fallback: response không phải JSON (model local)
    low = text.lower()
    if "đúng" in low and "không đúng" not in low and "sai" not in low:
        return {"is_correct": True, "confidence": 0.6, "ai_answer": text[:500], "feedback": text[:2000]}
    if "sai" in low or "không đúng" in low or "incorrect" in low:
        return {"is_correct": False, "confidence": 0.6, "ai_answer": text[:500], "feedback": text[:2000]}
    # Không parse được -> trả fallback thay vì ném ValueError ra 503
    logger.warning(f"AI output không phải JSON, dùng fallback: {text[:200]}")
    return {"is_correct": True, "confidence": 0.4, "ai_answer": text[:500] or "(AI không trả về nội dung)", "feedback": text[:2000] or "AI không trả về JSON. Hãy kiểm tra model/base_url hoặc thử lại."}


PROVIDER_DEFAULTS = {
    "OpenAI": {"base_url": "https://api.openai.com/v1", "model_name": "gpt-4o-mini"},
    "Gemini": {"base_url": "https://generativelanguage.googleapis.com/v1beta/openai/", "model_name": "gemini-2.0-flash"},
    "DeepSeek": {"base_url": "https://api.deepseek.com/v1", "model_name": "deepseek-chat"},
    "Groq": {"base_url": "https://api.groq.com/openai/v1", "model_name": "llama-3.3-70b-versatile"},
    "OpenRouter": {"base_url": "https://openrouter.ai/api/v1", "model_name": "google/gemini-2.0-flash-001"},
    "Anthropic": {"base_url": "https://openrouter.ai/api/v1", "model_name": "anthropic/claude-3.5-sonnet"},
    "Ollama": {"base_url": "http://localhost:11434/v1", "model_name": "llama3"},
}

class AIService:
    def __init__(self, db_config: dict = None):
        """
        db_config: dict chứa {api_key, base_url, model_name, provider} nếu được cấu hình riêng từ DB.
        """
        self.provider = (db_config.get("provider") if db_config else None) or "OpenAI"
        defaults = PROVIDER_DEFAULTS.get(self.provider, {"base_url": "https://api.openai.com/v1", "model_name": "gpt-4o-mini"})

        if db_config and db_config.get("api_key"):
            self.api_key = db_config["api_key"]
            self.base_url = db_config.get("base_url") or defaults["base_url"]
            self.model_name = db_config.get("model_name") or defaults["model_name"]
            logger.info(f"Initializing OpenAI client for {self.provider} with base_url={self.base_url}, model={self.model_name}")
            self.client = OpenAI(api_key=self.api_key, base_url=self.base_url, timeout=45.0)
        else:
            self.api_key = settings.OPENAI_API_KEY
            self.base_url = defaults["base_url"]
            self.model_name = defaults["model_name"]
            if self.api_key:
                self.client = OpenAI(api_key=self.api_key, base_url=self.base_url, timeout=45.0)
            else:
                self.client = None

    def generate_questions(self, prompt_text: str, num_questions: int = 3) -> list:
        """
        Generate questions from text prompt using OpenAI (or mockup if no API key is found).
        """
        if not self.client:
            # Return mockup questions matching the question schema
            return [
                {
                    "content": f"Câu hỏi mẫu 1 dựa trên chủ đề: {prompt_text[:30]}...?",
                    "question_type": "MULTIPLE_CHOICE",
                    "options": ["Đáp án A (Đúng)", "Đáp án B", "Đáp án C", "Đáp án D"],
                    "correct_option": 0,
                    "subject": "Toán",
                    "grade_level": 10,
                    "difficulty": "THONG_HIEU",
                    "explanation": "Giải thích chi tiết cho câu hỏi mẫu số 1."
                },
                {
                    "content": f"Câu hỏi mẫu 2 dựa trên chủ đề: {prompt_text[:30]}...?",
                    "question_type": "SHORT_ANSWER",
                    "correct_answer": "10",
                    "subject": "Toán",
                    "grade_level": 10,
                    "difficulty": "NHAN_BIET",
                    "explanation": "Giải thích chi tiết cho câu hỏi mẫu số 2."
                }
            ][:num_questions]

        system_prompt = (
            "Bạn là một chuyên gia tạo đề thi trắc nghiệm. Hãy tạo ra các câu hỏi chất lượng cao dưới dạng JSON "
            "phù hợp hoàn toàn với cấu trúc sau: "
            "Một mảng gồm các đối tượng có dạng: "
            "{\n"
            "  \"content\": \"Nội dung câu hỏi, hỗ trợ công thức toán học dùng $...$ cho inline và $$...$$ cho block.\",\n"
            "  \"question_type\": \"MULTIPLE_CHOICE\" hoặc \"SHORT_ANSWER\" hoặc \"ESSAY\",\n"
            "  \"options\": [\"A\", \"B\", \"C\", \"D\"] (Chỉ dùng cho MULTIPLE_CHOICE, nếu không thì null),\n"
            "  \"correct_option\": 0 (chỉ số đáp án đúng từ 0-3, dùng cho MULTIPLE_CHOICE, nếu không thì null),\n"
            "  \"correct_answer\": \"đáp án đúng\" (dùng cho SHORT_ANSWER, nếu không thì null),\n"
            "  \"sample_solution\": \"bài giải mẫu\" (dùng cho ESSAY, nếu không thì null),\n"
            "  \"subject\": \"Tên môn học\",\n"
            "  \"grade_level\": 10,\n"
            "  \"difficulty\": \"NHAN_BIET\" hoặc \"THONG_HIEU\" hoặc \"VAN_DUNG\" hoặc \"VAN_DUNG_CAO\",\n"
            "  \"explanation\": \"Giải thích chi tiết cho đáp án\"\n"
            "}"
        )

        user_prompt = f"Hãy tạo {num_questions} câu hỏi dựa trên nội dung/tài liệu sau:\n\n{prompt_text}"

        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"}
            )
            raw_content = response.choices[0].message.content or ""
            data = _parse_json_response(raw_content)
            # Try to get the list from the JSON object
            if "questions" in data:
                return data["questions"]
            elif isinstance(data, list):
                return data
            else:
                return list(data.values())[0] if isinstance(data, dict) else []
        except Exception as e:
            logger.error(f"Error calling OpenAI API: {str(e)}")
            return []

    def generate_questions_from_text(
        self,
        raw_text: str,
        subject: str = "Toán",
        grade_level: int = 10,
        count: int = 5,
        question_types: list = None,
        difficulty: str = None,
        chapter: str = None
    ) -> list:
        """
        Tạo danh sách câu hỏi dựa trên văn bản/tài liệu bài học được giáo viên nhập vào.
        Hỗ trợ các dạng: MULTIPLE_CHOICE, TRUE_FALSE, SHORT_ANSWER, ESSAY với công thức toán KaTeX.
        """
        valid_types = question_types or ["MULTIPLE_CHOICE"]
        types_str = ", ".join(valid_types)
        diff_str = difficulty if (difficulty and difficulty != "MIXED") else "phân bổ cân đối từ Nhận biết đến Vận dụng cao"

        if not self.client:
            # Fallback mockup questions matching structure
            mock_list = []
            for i in range(1, min(count + 1, 6)):
                q_type = valid_types[(i - 1) % len(valid_types)]
                if q_type == "MULTIPLE_CHOICE":
                    mock_list.append({
                        "content": f"Câu hỏi {i} (Môn {subject} - Lớp {grade_level}): Dựa vào nội dung tài liệu, khẳng định nào sau đây là đúng?",
                        "question_type": "MULTIPLE_CHOICE",
                        "options": [
                            f"Phương án A: Giá trị đại lượng $x = {i * 2}$ thỏa mãn phương trình",
                            f"Phương án B: Đồ thị hàm số đi qua gốc tọa độ $O(0;0)$",
                            f"Phương án C: Phương trình vô nghiệm trên tập số thực $\\mathbb{{R}}$",
                            f"Phương án D: Giá trị nhỏ nhất đạt được tại $x = {i}$"
                        ],
                        "correct_option": 0,
                        "subject": subject,
                        "grade_level": grade_level,
                        "chapter": chapter or "Kiến thức trọng tâm",
                        "difficulty": "THONG_HIEU",
                        "explanation": f"Lời giải chi tiết: Thay $x = {i * 2}$ vào biểu thức ta có đẳng thức đúng. Do đó phương án A chính xác."
                    })
                elif q_type == "TRUE_FALSE":
                    mock_list.append({
                        "content": f"Câu hỏi {i} (Đúng / Sai): Xét các mệnh đề sau về nội dung tài liệu đã cho:",
                        "question_type": "TRUE_FALSE",
                        "sub_questions": [
                            {"statement": f"Mệnh đề a: Điều kiện xác định là $x > {i}$", "answer": True},
                            {"statement": f"Mệnh đề b: Hàm số luôn đồng biến trên $\\mathbb{{R}}$", "answer": False},
                            {"statement": f"Mệnh đề c: Giá trị cực đại bằng ${i * 5}$", "answer": True},
                            {"statement": f"Mệnh đề d: Đồ thị có tiệm cận ngang $y = 0$", "answer": False}
                        ],
                        "subject": subject,
                        "grade_level": grade_level,
                        "chapter": chapter or "Kiến thức trọng tâm",
                        "difficulty": "VAN_DUNG",
                        "explanation": "Lời giải: Mệnh đề a đúng theo định nghĩa TXĐ; b sai vì đạo hàm đổi dấu; c đúng; d sai vì giới hạn vô cực."
                    })
                elif q_type == "SHORT_ANSWER":
                    mock_list.append({
                        "content": f"Câu hỏi {i} (Trả lời ngắn): Tính giá trị biểu thức $P = f({i}) + {i * 3}$ theo dữ liệu tài liệu.",
                        "question_type": "SHORT_ANSWER",
                        "correct_answer": str(i * 10),
                        "subject": subject,
                        "grade_level": grade_level,
                        "chapter": chapter or "Kiến thức trọng tâm",
                        "difficulty": "VAN_DUNG",
                        "explanation": f"Lời giải: Thay số vào ta tìm được kết quả là {i * 10}."
                    })
                else: # ESSAY
                    mock_list.append({
                        "content": f"Câu hỏi {i} (Tự luận): Hãy trình bày giải pháp và phân tích hiện tượng/bài toán được nêu trong tài liệu.",
                        "question_type": "ESSAY",
                        "sample_solution": f"Hướng dẫn chấm:\n- Bước 1: Nêu đúng giả thiết và công thức cần áp dụng (1.0 điểm)\n- Bước 2: Biến đổi biểu thức và tính toán chính xác (2.0 điểm)\n- Bước 3: Biện luận và kết luận đáp số (1.0 điểm)",
                        "subject": subject,
                        "grade_level": grade_level,
                        "chapter": chapter or "Kiến thức trọng tâm",
                        "difficulty": "VAN_DUNG_CAO",
                        "explanation": "Tiêu chí chấm điểm chi tiết theo thang điểm bài thi."
                    })
            return mock_list

        system_prompt = (
            "Bạn là chuyên gia sư phạm và khảo thí giàu kinh nghiệm biên soạn đề thi. "
            "Nhiệm vụ: Đọc kỹ tài liệu/văn bản người dùng cung cấp và tự động tạo ra bộ câu hỏi chuẩn xác, có tính phân loại cao.\n"
            f"Yêu cầu:\n"
            f"- Số lượng: đúng {count} câu hỏi.\n"
            f"- Môn học: {subject}, Khối lớp: {grade_level}, Chương: {chapter or 'Chung'}.\n"
            f"- Các dạng câu hỏi được dùng: {types_str}.\n"
            f"- Mức độ khó: {diff_str}.\n"
            f"- Công thức Toán học, Vật lý, Hóa học phải được định dạng KaTeX chuẩn ($...$ cho inline và $$...$$ cho block).\n"
            "Cấu trúc JSON đầu ra:\n"
            "{\n"
            "  \"questions\": [\n"
            "    {\n"
            "      \"content\": \"Nội dung câu hỏi (có LaTeX nếu là môn tự nhiên)\",\n"
            "      \"question_type\": \"MULTIPLE_CHOICE\" | \"TRUE_FALSE\" | \"SHORT_ANSWER\" | \"ESSAY\",\n"
            "      \"options\": [\"Phương án A\", \"Phương án B\", \"Phương án C\", \"Phương án D\"] (chỉ cho MULTIPLE_CHOICE),\n"
            "      \"correct_option\": 0 (chỉ số đáp án đúng 0-3 cho MULTIPLE_CHOICE),\n"
            "      \"sub_questions\": [{\"statement\": \"...\", \"answer\": true/false}] (4 ý cho TRUE_FALSE),\n"
            "      \"correct_answer\": \"đáp án dạng chuỗi/số\" (cho SHORT_ANSWER),\n"
            "      \"sample_solution\": \"hướng dẫn chấm và lời giải mẫu\" (cho ESSAY),\n"
            "      \"explanation\": \"Lời giải chi tiết từng bước có giải thích rõ ràng\",\n"
            "      \"subject\": \"Tên môn\",\n"
            "      \"grade_level\": 10,\n"
            "      \"chapter\": \"Tên chương\",\n"
            "      \"difficulty\": \"NHAN_BIET\" | \"THONG_HIEU\" | \"VAN_DUNG\" | \"VAN_DUNG_CAO\"\n"
            "    }\n"
            "  ]\n"
            "}"
        )

        user_prompt = f"Nội dung văn bản / tài liệu tham khảo:\n\n{raw_text[:14000]}"

        try:
            try:
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format={"type": "json_object"}
                )
            except Exception:
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": system_prompt + ' Chỉ trả về JSON thuần { "questions": [...] }.'},
                        {"role": "user", "content": user_prompt}
                    ]
                )
            data = _parse_json_response(response.choices[0].message.content)
            questions = []
            if isinstance(data, dict):
                if "questions" in data and isinstance(data["questions"], list):
                    questions = data["questions"]
                else:
                    for v in data.values():
                        if isinstance(v, list):
                            questions = v
                            break
            elif isinstance(data, list):
                questions = data

            # Normalization
            for q in questions:
                if "subject" not in q or not q["subject"]:
                    q["subject"] = subject
                if "grade_level" not in q or not q["grade_level"]:
                    q["grade_level"] = grade_level
                if "chapter" not in q or not q["chapter"]:
                    q["chapter"] = chapter or "Kiến thức chung"
                if "difficulty" not in q or not q["difficulty"]:
                    q["difficulty"] = "THONG_HIEU"

            return questions
        except Exception as e:
            logger.error(f"Error in generate_questions_from_text: {str(e)}")
            raise e

    def grade_essay(
        self,
        question_content: str,
        student_answer: str,
        sample_solution: str = "",
        max_score: float = 10.0
    ) -> dict:
        """
        Chấm điểm bài thi tự luận bằng AI với nhận xét chi tiết sư phạm,
        chỉ ra ưu điểm, nhược điểm và đề xuất cải thiện.
        """
        if not self.client:
            return {
                "score": round(max_score * 0.85, 2),
                "max_score": max_score,
                "feedback": "Bài làm tương đối chính xác, bám sát các ý chính trong hướng dẫn chấm. Cần trình bày chi tiết và rõ ràng hơn một số bước lập luận.",
                "strengths": [
                    "Nêu đúng các công thức và kiến thức trọng tâm",
                    "Các bước biến đổi toán học/lập luận mạch lạc"
                ],
                "weaknesses": [
                    "Chưa lập luận đầy đủ điều kiện bài toán",
                    "Cần thêm kết luận rõ ràng cho đáp số"
                ],
                "suggested_improvements": "Nên ghi rõ giả thiết, lập bảng biến thiên hoặc giải thích chi tiết hơn ở bước cuối cùng."
            }

        system_prompt = (
            "Bạn là giám khảo chấm thi tự luận chuyên nghiệp và giàu kinh nghiệm sư phạm. "
            "Nhiệm vụ: Đánh giá bài làm của học sinh dựa trên câu hỏi và đáp án mẫu/hướng dẫn chấm. "
            f"Thang điểm tối đa: {max_score}.\n"
            "Hãy trả về kết quả dưới dạng JSON có cấu trúc chính xác:\n"
            "{\n"
            f"  \"score\": float (từ 0.0 đến {max_score}, làm tròn đến 0.25),\n"
            f"  \"max_score\": {max_score},\n"
            "  \"feedback\": \"Nhận xét sư phạm tổng thể khách quan, chân thực và khích lệ\",\n"
            "  \"strengths\": [\"Ưu điểm 1 của bài làm\", \"Ưu điểm 2...\"],\n"
            "  \"weaknesses\": [\"Lỗi sai hoặc ý còn thiếu 1\", \"Ý còn thiếu 2...\"],\n"
            "  \"suggested_improvements\": \"Hướng dẫn học sinh cách khắc phục để đạt điểm tối đa\"\n"
            "}"
        )

        user_prompt = (
            f"Câu hỏi: {question_content}\n\n"
            f"Đáp án mẫu / Hướng dẫn chấm:\n{sample_solution or '(Không có đáp án mẫu, hãy tự giải và đánh giá bài làm)'}\n\n"
            f"Bài làm của học sinh:\n{student_answer or '(Học sinh để trống bài làm)'}"
        )

        try:
            try:
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format={"type": "json_object"}
                )
            except Exception:
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": system_prompt + ' Chỉ trả về JSON thuần, không kèm markdown.'},
                        {"role": "user", "content": user_prompt}
                    ],
                )
            parsed = _parse_json_response(response.choices[0].message.content)
            if "score" in parsed:
                try:
                    parsed["score"] = min(float(parsed["score"]), max_score)
                except Exception:
                    parsed["score"] = round(max_score * 0.7, 2)
            parsed["max_score"] = max_score
            return parsed
        except Exception as e:
            logger.error(f"Error calling AI in grade_essay: {str(e)}")
            return {
                "score": round(max_score * 0.7, 2),
                "max_score": max_score,
                "feedback": f"Không thể nhận phản hồi từ AI ({self.provider}): {str(e)}. Vui lòng chấm điểm thủ công hoặc kiểm tra cấu hình AI.",
                "strengths": [],
                "weaknesses": ["Lỗi kết nối AI khi chấm điểm"],
                "suggested_improvements": "Vui lòng xem lại bài làm thủ công."
            }

    def verify_question(self, content: str, question_type: str, options: list = None,
                        correct_option: int = None, correct_answer: str = None,
                        sample_solution: str = None) -> dict:
        """
        AI kiểm tra tính đúng/sai của một câu hỏi: đáp án đã cho có chính xác không,
        phát hiện đáp án gây nhiễu trùng đúng, phát hiện lỗi logic.
        Trả về: {"is_correct": bool, "confidence": 0-1, "ai_answer": str, "feedback": str}
        """
        if not self.client:
            return {
                "is_correct": True,
                "confidence": 0.95,
                "ai_answer": "Đáp án hợp lệ",
                "feedback": "AI kiểm tra nhanh (chế độ demo): Câu hỏi có cấu trúc rõ ràng, dữ kiện đầy đủ và đáp án được đánh dấu chính xác."
            }

        system_prompt = (
            "Bạn là chuyên gia kiểm định đề thi trắc nghiệm Toán học THPT. "
            "Nhiệm vụ: giải độc lập câu hỏi, so sánh với đáp án của giáo viên, "
            "kết luận đáp án đó ĐÚNG hay SAI, và chỉ ra lỗi nếu có "
            "(sai tính toán, đáp án nhiễu trùng đúng, thiếu dữ kiện, đáp án đúng không có trong options). "
            "Trả về JSON: {\"is_correct\": true/false, \"confidence\": 0.0-1.0, "
            "\"ai_answer\": \"đáp án AI tính được\", "
            "\"feedback\": \"giải thích ngắn gọn bằng tiếng Việt\"}"
        )

        desc = f"Nội dung: {content}\nLoại: {question_type}\n"
        if options:
            desc += "Các phương án:\n" + "\n".join(
                f"  [{i}] {opt}" for i, opt in enumerate(options)) + "\n"
        if correct_option is not None:
            desc += f"Đáp án giáo viên chọn: index {correct_option}"
            if options and 0 <= correct_option < len(options):
                desc += f" ({options[correct_option]})"
            desc += "\n"
        if correct_answer:
            desc += f"Đáp án đúng (tự luận/trả lời ngắn): {correct_answer}\n"
        if sample_solution:
            desc += f"Bài giải mẫu: {sample_solution}\n"

        try:
            try:
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": desc}
                    ],
                    response_format={"type": "json_object"}
                )
            except Exception:
                # model local không hỗ trợ response_format
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": system_prompt + ' Chỉ trả về JSON thuần, không kèm markdown.'},
                        {"role": "user", "content": desc}
                    ],
                )
            return _parse_json_response(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Error calling AI in verify_question: {str(e)}")
            return {
                "is_correct": True,
                "confidence": 0.5,
                "ai_answer": "(Chưa xác thực)",
                "feedback": f"Không thể kết nối tới nhà cung cấp AI ({self.provider}): {str(e)}. Hãy kiểm tra endpoint hoặc cấu hình AI."
            }

    def audit_and_fix_question(
        self,
        content: str,
        question_type: str,
        options: list = None,
        correct_option: int = None,
        correct_answer: str = None,
        sub_questions: list = None,
        sample_solution: str = None,
        explanation: str = None,
        subject: str = "Toán",
        grade_level: int = 10
    ) -> dict:
        """
        AI rà soát và tự động sửa câu hỏi:
        - Nếu câu hỏi chưa có đáp án -> AI giải và chọn đáp án chính xác.
        - Nếu câu hỏi có đáp án sai -> AI sửa sang đáp án đúng và giải thích lý do.
        - Nếu câu hỏi đã đúng -> giữ nguyên.
        - Cập nhật/bổ sung lời giải chi tiết (explanation).
        """
        if not self.client:
            fallback_opt = 0 if options and len(options) > 0 else None
            return {
                "action": "SET_MISSING_ANSWER" if correct_option is None and not correct_answer else "KEEP",
                "is_correct": True,
                "confidence": 0.85,
                "suggested_correct_option": correct_option if correct_option is not None else fallback_opt,
                "suggested_correct_answer": correct_answer or "Đáp án mẫu",
                "suggested_sub_questions": sub_questions,
                "suggested_explanation": explanation or "Lời giải được AI bổ sung tự động.",
                "reason": "Chế độ ngoại tuyến (demo): Đã kiểm tra cấu trúc câu hỏi.",
                "changed": correct_option is None and fallback_opt is not None
            }

        system_prompt = (
            "Bạn là chuyên gia thẩm định và chuẩn hóa đề thi sư phạm hàng đầu. "
            "Nhiệm vụ: Phân tích, giải độc lập câu hỏi, rà soát đáp án hiện tại và sửa lỗi nếu có.\n"
            "Các trường hợp:\n"
            "1. Nếu câu hỏi CHƯA CÓ ĐÁP ÁN (đáp án hiện tại là null hoặc rỗng): "
            "   - Hãy giải và chọn phương án đúng nhất (chỉ số 0, 1, 2 hoặc 3 cho trắc nghiệm).\n"
            "   - Đặt \"action\": \"SET_MISSING_ANSWER\".\n"
            "2. Nếu câu hỏi ĐÃ CÓ ĐÁP ÁN NHƯNG BỊ SAI (sai tính toán, sai bản chất kiến thức, nhầm lẫn phương án): "
            "   - Hãy sửa lại chỉ số phương án đúng chính xác (0-3).\n"
            "   - Đặt \"action\": \"FIX_ANSWER\".\n"
            "3. Nếu câu hỏi ĐÃ CÓ ĐÁP ÁN VÀ ĐÃ HOÀN TOÀN CHÍNH XÁC: "
            "   - Giữ nguyên đáp án đó.\n"
            "   - Đặt \"action\": \"KEEP\".\n\n"
            "Quy tắc bổ sung:\n"
            "- Luôn tạo lời giải chi tiết (\"suggested_explanation\") từng bước rõ ràng, khoa học, có công thức LaTeX ($...$ hoặc $$...$$).\n"
            "- Nêu rõ \"reason\": giải thích ngắn gọn tại sao đáp án cũ sai hoặc cơ sở toán/khoa học chọn đáp án mới.\n\n"
            "Trả về JSON duy nhất có cấu trúc:\n"
            "{\n"
            "  \"action\": \"SET_MISSING_ANSWER\" | \"FIX_ANSWER\" | \"KEEP\",\n"
            "  \"is_correct\": true/false,\n"
            "  \"confidence\": 0.0 - 1.0,\n"
            "  \"suggested_correct_option\": 0 (chỉ số 0-3 cho MULTIPLE_CHOICE, nếu không thì null),\n"
            "  \"suggested_correct_answer\": \"đáp số ngắn\" (cho SHORT_ANSWER, nếu không thì null),\n"
            "  \"suggested_sub_questions\": [{\"statement\": \"...\", \"answer\": true/false}] (cho TRUE_FALSE, nếu không thì null),\n"
            "  \"suggested_explanation\": \"Lời giải chi tiết có công thức LaTeX...\",\n"
            "  \"reason\": \"Giải thích ngắn gọn...\"\n"
            "}"
        )

        user_desc = (
            f"Môn học: {subject}, Khối lớp: {grade_level}\n"
            f"Nội dung câu hỏi: {content}\n"
            f"Loại câu hỏi: {question_type}\n"
        )
        if options:
            user_desc += "Các phương án lựa chọn:\n" + "\n".join(
                f"  [{i}] {opt}" for i, opt in enumerate(options)) + "\n"
        if correct_option is not None:
            user_desc += f"Đáp án hiện tại của giáo viên: index {correct_option}"
            if options and 0 <= correct_option < len(options):
                user_desc += f" ({options[correct_option]})"
            user_desc += "\n"
        else:
            user_desc += "Đáp án hiện tại: NULL (chưa được chọn)\n"

        if correct_answer:
            user_desc += f"Đáp số hiện tại (ngắn): {correct_answer}\n"
        if sub_questions:
            user_desc += f"Các ý Đúng/Sai hiện tại: {json.dumps(sub_questions, ensure_ascii=False)}\n"
        if explanation:
            user_desc += f"Lời giải hiện tại: {explanation}\n"
        if sample_solution:
            user_desc += f"Bài giải mẫu hiện tại: {sample_solution}\n"

        try:
            try:
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_desc}
                    ],
                    response_format={"type": "json_object"}
                )
            except Exception:
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": system_prompt + ' Chỉ trả về duy nhất chuỗi JSON thuần, không kèm markdown.'},
                        {"role": "user", "content": user_desc}
                    ]
                )
            parsed = _parse_json_response(response.choices[0].message.content)
            if not isinstance(parsed, dict):
                parsed = {}

            suggested_opt = parsed.get("suggested_correct_option")
            if suggested_opt is not None:
                if isinstance(suggested_opt, str):
                    cleaned = suggested_opt.strip().upper().replace("[", "").replace("]", "")
                    if cleaned in ("A", "0"):
                        suggested_opt = 0
                    elif cleaned in ("B", "1"):
                        suggested_opt = 1
                    elif cleaned in ("C", "2"):
                        suggested_opt = 2
                    elif cleaned in ("D", "3"):
                        suggested_opt = 3
                    else:
                        try:
                            suggested_opt = int(cleaned)
                        except Exception:
                            suggested_opt = None
            elif options and question_type == "MULTIPLE_CHOICE":
                combined_text = (parsed.get("reason", "") + " " + parsed.get("suggested_explanation", "")).lower()
                for i, opt in enumerate(options):
                    if opt.lower().strip() in combined_text:
                        suggested_opt = i
                        break
                if suggested_opt is None:
                    for i, tag in enumerate(["phương án a", "phương án b", "phương án c", "phương án d", "đáp án a", "đáp án b", "đáp án c", "đáp án d", "[0]", "[1]", "[2]", "[3]"]):
                        if tag in combined_text:
                            suggested_opt = i % 4
                            break

            suggested_ans = parsed.get("suggested_correct_answer")
            action = parsed.get("action", "KEEP")

            changed = False
            if question_type == "MULTIPLE_CHOICE":
                if correct_option is None and suggested_opt is not None:
                    action = "SET_MISSING_ANSWER"
                    changed = True
                elif suggested_opt is not None and suggested_opt != correct_option:
                    action = "FIX_ANSWER"
                    changed = True
                else:
                    action = "KEEP"
            elif question_type == "SHORT_ANSWER":
                if not correct_answer and suggested_ans:
                    action = "SET_MISSING_ANSWER"
                    changed = True
                elif suggested_ans and suggested_ans.strip() != (correct_answer or "").strip():
                    action = "FIX_ANSWER"
                    changed = True
                else:
                    action = "KEEP"

            return {
                "action": action,
                "is_correct": parsed.get("is_correct", not changed),
                "confidence": parsed.get("confidence", 0.95),
                "suggested_correct_option": suggested_opt,
                "suggested_correct_answer": suggested_ans,
                "suggested_sub_questions": parsed.get("suggested_sub_questions"),
                "suggested_explanation": parsed.get("suggested_explanation") or explanation,
                "reason": parsed.get("reason") or "AI đã rà soát và đối chiếu đáp án chuẩn.",
                "changed": changed
            }
        except Exception as e:
            logger.error(f"Error calling AI in audit_and_fix_question: {str(e)}")
            return {
                "action": "KEEP",
                "is_correct": True,
                "confidence": 0.5,
                "suggested_correct_option": correct_option,
                "suggested_correct_answer": correct_answer,
                "suggested_sub_questions": sub_questions,
                "suggested_explanation": explanation,
                "reason": f"Không thể kết nối AI ({self.provider}): {str(e)}",
                "changed": False
            }

    def extract_questions_from_document(
        self,
        raw_text: str,
        default_subject: str = "Toán",
        default_grade_level: int = 10,
        default_chapter: Optional[str] = None
    ) -> list:
        """
        Trích xuất danh sách câu hỏi từ văn bản tài liệu thô bằng AI.
        Nếu không có client AI hoặc AI thất bại, tự động fallback sang bộ phân tích regex quy tắc.
        """
        from app.services.document_parser import parse_questions_with_rules

        if not raw_text or not raw_text.strip():
            return []

        if not self.client:
            logger.info("AI client chưa cấu hình, dùng fallback rule-based parser.")
            return parse_questions_with_rules(raw_text, default_subject, default_grade_level, default_chapter)

        system_prompt = (
            "Bạn là chuyên gia phân tích và chuẩn hóa đề thi sư phạm hàng đầu. "
            "Nhiệm vụ: Trích xuất toàn bộ câu hỏi từ tài liệu (Word/PDF/Markdown) đã cho thành danh sách JSON chuẩn.\n"
            "Mỗi câu hỏi phải là một đối tượng JSON có các trường:\n"
            "- \"content\": string (Nội dung câu hỏi, công thức toán phải chuyển thành LaTeX $...$ hoặc $$...$$)\n"
            "- \"question_type\": \"MULTIPLE_CHOICE\" | \"TRUE_FALSE\" | \"SHORT_ANSWER\" | \"ESSAY\"\n"
            "- \"options\": array of 4 strings (chỉ cho MULTIPLE_CHOICE, nếu không thì null)\n"
            "- \"correct_option\": int 0-3 (chỉ cho MULTIPLE_CHOICE: 0=A, 1=B, 2=C, 3=D, dựa theo đáp án trong đề/bảng đáp án hoặc tự giải nếu thiếu)\n"
            "- \"sub_questions\": array of { \"statement\": string, \"answer\": bool } (chỉ cho dạng Đúng/Sai TRUE_FALSE)\n"
            "- \"correct_answer\": string (chỉ cho SHORT_ANSWER)\n"
            "- \"sample_solution\": string (cho ESSAY)\n"
            "- \"explanation\": string (lời giải/hướng dẫn giải chi tiết có LaTeX nếu có)\n"
            "- \"difficulty\": \"NHAN_BIET\" | \"THONG_HIEU\" | \"VAN_DUNG\" | \"VAN_DUNG_CAO\"\n"
            "- \"subject\": string\n"
            "- \"grade_level\": int\n"
            "- \"chapter\": string\n\n"
            "Chỉ trả về JSON có dạng: { \"questions\": [ ... ] }."
        )

        user_prompt = (
            f"Môn học mặc định: {default_subject}, Lớp: {default_grade_level}, Chương: {default_chapter or 'Kiến thức chung'}\n\n"
            f"Văn bản tài liệu:\n{raw_text[:12000]}"
        )

        try:
            try:
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format={"type": "json_object"}
                )
            except Exception:
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": system_prompt + ' Chỉ trả về JSON thuần { "questions": [...] }.'},
                        {"role": "user", "content": user_prompt}
                    ]
                )

            data = _parse_json_response(response.choices[0].message.content)
            questions = []
            if isinstance(data, dict):
                if "questions" in data and isinstance(data["questions"], list):
                    questions = data["questions"]
                else:
                    for v in data.values():
                        if isinstance(v, list):
                            questions = v
                            break
            elif isinstance(data, list):
                questions = data

            if questions and len(questions) > 0:
                # Chuẩn hóa các trường cần thiết
                for q in questions:
                    if "subject" not in q or not q["subject"]:
                        q["subject"] = default_subject
                    if "grade_level" not in q or not q["grade_level"]:
                        q["grade_level"] = default_grade_level
                    if "chapter" not in q or not q["chapter"]:
                        q["chapter"] = default_chapter or "Kiến thức chung"
                return questions

            logger.warning("AI không trích xuất được câu hỏi nào, chuyển sang rule-based parser.")
            return parse_questions_with_rules(raw_text, default_subject, default_grade_level, default_chapter)

        except Exception as e:
            logger.error(f"Lỗi khi trích xuất câu hỏi bằng AI: {str(e)}, chuyển sang rule-based fallback.")
            return parse_questions_with_rules(raw_text, default_subject, default_grade_level, default_chapter)

    def analyze_question_difficulty(
        self,
        content: str,
        question_type: str = "MULTIPLE_CHOICE",
        options: list = None,
        subject: str = "Toán",
        grade_level: int = 10,
        chapter: Optional[str] = None
    ) -> dict:
        """
        Tự động phân tích độ khó câu hỏi theo chuẩn ma trận đề 4 mức độ của Bộ Giáo dục & Đào tạo:
        - NHAN_BIET (Nhận biết): Nhận dạng định nghĩa, công thức trực tiếp, đọc đồ thị cơ bản (1 bước).
        - THONG_HIEU (Thông hiểu): Hiểu bản chất định lý, giải thích, tính toán 1-2 bước quen thuộc.
        - VAN_DUNG (Vận dụng): Kết hợp kiến thức, bài toán định lượng biến đổi tổng hợp (3-4 bước).
        - VAN_DUNG_CAO (Vận dụng cao): Phân loại học sinh giỏi (điểm 9-10), bài toán cực trị phức tạp, thực tế.
        """
        text_lower = (content or "").lower()

        # Multi-subject heuristic evaluator fallback (for offline or demo mode)
        def heuristic_analysis():
            # 1. Math keywords
            math_vdc = [
                "giá trị lớn nhất", "giá trị nhỏ nhất", "cực trị", "tham số m", "nghiệm nguyên",
                "bất đẳng thức", "thực tế", "tối ưu", "min", "max", "tiếp xúc", "đồng biến trên r",
                "nghịch biến trên r", "chứa đúng", "mọi giá trị", "biện luận"
            ]
            math_vd = [
                "thể tích", "diện tích", "khoảng cách", "góc giữa", "xác suất", "tích phân",
                "nguyên hàm", "phương trình mặt phẳng", "tiếp tuyến", "tọa độ", "số phức",
                "hệ phương trình", "phương trình", "bất phương trình"
            ]
            math_nb = [
                "công thức nào", "định nghĩa", "khẳng định nào đúng", "tập xác định", "đạo hàm của",
                "nguyên hàm của hàm số", "vectơ", "tọa độ điểm", "tiệm cận đứng", "tiệm cận ngang",
                "mệnh đề nào sau đây đúng", "nghiệm của phương trình"
            ]

            # 2. Physics & Chemistry keywords
            sci_vdc = [
                "dao động tắt dần", "cộng hưởng", "mạch rlc", "công suất cực đại", "độ lệch pha",
                "quang điện", "hỗn hợp x", "nung m gam", "este đa chức", "peptit", "điện phân", "đồ thị biểu diễn"
            ]
            sci_vd = [
                "chu kỳ", "tần số", "bước sóng", "vận tốc", "gia tốc", "động năng", "thế năng",
                "hiệu điện thế", "cường độ", "khối lượng mol", "nồng độ", "số mol", "đồng phân", "hiệu suất"
            ]
            sci_nb = [
                "đơn vị của", "hệ thức nào", "định luật nào", "hiện tượng nào", "sóng điện từ là",
                "công thức phân tử", "chất nào sau đây", "kim loại nào", "tính chất hóa học", "quỳ tím", "polime nào"
            ]

            # 3. English, Biology & Humanities keywords
            hum_vdc = [
                "reading comprehension", "inferred from", "tone of the passage", "phả hệ", "quần thể ngẫu phối",
                "đột biến cấu trúc", "liên hệ thực tiễn", "bài học kinh nghiệm", "nguyên nhân sâu xa"
            ]
            hum_vd = [
                "conditional sentence", "relative clause", "reported speech", "passive voice",
                "nguyên phân", "giảm phân", "mã di truyền", "phiên mã", "phân tích", "so sánh", "chứng minh"
            ]
            hum_nb = [
                "pronounced", "stress", "synonym", "antonym", "opposite in meaning", "closest in meaning",
                "bào quan nào", "đơn phân của", "quang hợp diễn ra", "tác giả của", "năm nào", "chiến dịch nào", "thủ đô"
            ]

            vdc_hits = sum(1 for kw in (math_vdc + sci_vdc + hum_vdc) if kw in text_lower)
            vd_hits = sum(1 for kw in (math_vd + sci_vd + hum_vd) if kw in text_lower)
            nb_hits = sum(1 for kw in (math_nb + sci_nb + hum_nb) if kw in text_lower)

            math_symbols = len(re.findall(r'[\$\^\_\{\}\\\+\-\*\/\=]', content or ""))
            is_essay = (question_type or "").upper() == "ESSAY"

            if is_essay and len(text_lower) > 150:
                return {
                    "difficulty": "VAN_DUNG_CAO" if vdc_hits >= 1 or len(text_lower) > 300 else "VAN_DUNG",
                    "confidence": 0.86,
                    "reasoning": "Câu hỏi tự luận yêu cầu trình bày tổng hợp, lập luận logic và vận dụng kiến thức sâu sắc.",
                    "cognitive_skills": ["Tư duy phản biện", "Kỹ năng lập luận", "Tổng hợp kiến thức"],
                    "estimated_time_minutes": 8 if vdc_hits >= 1 else 5
                }

            if vdc_hits >= 2 or (vdc_hits >= 1 and math_symbols > 20):
                return {
                    "difficulty": "VAN_DUNG_CAO",
                    "confidence": 0.88,
                    "reasoning": "Câu hỏi chứa bài toán cực trị, tham số hoặc phân loại sâu, đòi hỏi kỹ năng tư duy độc lập và kết hợp nhiều công thức.",
                    "cognitive_skills": ["Tư duy trừu tượng", "Biến đổi đại số nâng cao", "Phân tích điều kiện tham số"],
                    "estimated_time_minutes": 4
                }
            elif vd_hits >= 1 or math_symbols > 15:
                return {
                    "difficulty": "VAN_DUNG",
                    "confidence": 0.85,
                    "reasoning": "Câu hỏi đòi hỏi vận dụng liên hoàn các công thức và giải thuật từ 2 đến 3 bước trung gian.",
                    "cognitive_skills": ["Vận dụng công thức", "Tính toán định lượng", "Tổng hợp kiến thức"],
                    "estimated_time_minutes": 3
                }
            elif nb_hits >= 1 and math_symbols <= 8:
                return {
                    "difficulty": "NHAN_BIET",
                    "confidence": 0.90,
                    "reasoning": "Câu hỏi kiểm tra nhận diện trực tiếp định nghĩa, công thức hoặc hình học cơ bản mà không đòi hỏi biến đổi phức tạp.",
                    "cognitive_skills": ["Ghi nhớ công thức", "Nhận dạng khái niệm"],
                    "estimated_time_minutes": 1
                }
            else:
                return {
                    "difficulty": "THONG_HIEU",
                    "confidence": 0.82,
                    "reasoning": "Câu hỏi đòi hỏi hiểu bản chất và thực hiện 1-2 bước suy luận hoặc biến đổi thông thường.",
                    "cognitive_skills": ["Thông hiểu kiến thức", "Áp dụng định lý"],
                    "estimated_time_minutes": 2
                }

        if not self.client:
            return heuristic_analysis()

        system_prompt = (
            "Bạn là chuyên gia thẩm định và xây dựng ma trận đề thi chuẩn của Bộ Giáo dục & Đào tạo Việt Nam. "
            "Nhiệm vụ: Phân tích nội dung câu hỏi và phân loại chính xác độ khó thành một trong 4 mức độ nhận thức:\n"
            "1. \"NHAN_BIET\": Nhận biết (học sinh chỉ cần nhớ công thức, nhận dạng định nghĩa, đồ thị/khái niệm cơ bản 1 bước).\n"
            "2. \"THONG_HIEU\": Thông hiểu (học sinh hiểu bản chất, giải thích được hiện tượng, giải qua 1-2 bước tính toán cơ bản).\n"
            "3. \"VAN_DUNG\": Vận dụng (kết hợp các kiến thức, bài toán định lượng ở mức độ trung bình-khá, 2-3 bước lập luận).\n"
            "4. \"VAN_DUNG_CAO\": Vận dụng cao (bài toán phân loại học sinh khá-giỏi, câu hỏi điểm 9-10, cực trị phức tạp, thực tế).\n\n"
            "Trả về JSON duy nhất với cấu trúc:\n"
            "{\n"
            "  \"difficulty\": \"NHAN_BIET\" | \"THONG_HIEU\" | \"VAN_DUNG\" | \"VAN_DUNG_CAO\",\n"
            "  \"confidence\": 0.0 - 1.0,\n"
            "  \"reasoning\": \"Giải thích ngắn gọn lý do phân loại dựa trên bản chất kiến thức và số bước tư duy\",\n"
            "  \"cognitive_skills\": [\"Kỹ năng 1\", \"Kỹ năng 2\"],\n"
            "  \"estimated_time_minutes\": 2\n"
            "}"
        )

        user_prompt = (
            f"Môn học: {subject}, Khối lớp: {grade_level}, Chuyên đề: {chapter or 'Tổng hợp'}\n"
            f"Loại câu hỏi: {question_type}\n"
            f"Nội dung câu hỏi: {content}\n"
        )
        if options:
            user_prompt += "Các lựa chọn: " + ", ".join(f"{chr(65+i)}: {opt}" for i, opt in enumerate(options))

        try:
            try:
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format={"type": "json_object"}
                )
            except Exception:
                response = self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": system_prompt + ' Chỉ trả về duy nhất chuỗi JSON thuần.'},
                        {"role": "user", "content": user_prompt}
                    ]
                )
            parsed = _parse_json_response(response.choices[0].message.content)
            if isinstance(parsed, dict) and parsed.get("difficulty") in ("NHAN_BIET", "THONG_HIEU", "VAN_DUNG", "VAN_DUNG_CAO"):
                return {
                    "difficulty": parsed.get("difficulty"),
                    "confidence": float(parsed.get("confidence", 0.9)),
                    "reasoning": parsed.get("reasoning", "Phân loại dựa trên độ sâu tư duy và cấu trúc đề."),
                    "cognitive_skills": parsed.get("cognitive_skills", ["Tư duy logic"]),
                    "estimated_time_minutes": int(parsed.get("estimated_time_minutes", 2))
                }
            return heuristic_analysis()
        except Exception as e:
            logger.error(f"Error calling AI in analyze_question_difficulty: {e}")
            return heuristic_analysis()

    def recommend_smart_practice(
        self,
        student_name: str,
        weak_topics: list,
        overall_accuracy: float,
        preferred_subject: str = "Toán học",
        preferred_grade: int = 12,
        has_history: bool = True
    ) -> dict:
        """
        Tạo lời khuyên gia sư AI và cấu hình bài luyện tập thông minh dựa trên dữ liệu học sinh.
        Hỗ trợ phân biệt học sinh mới chưa có bài nộp và học sinh đã có lịch sử làm bài.
        """
        # Case A: Học sinh mới, chưa có dữ liệu nộp bài
        if not has_history:
            return {
                "ai_tutor_message": f"Chào {student_name}! Hệ thống chưa ghi nhận lịch sử bài làm nào của em để phân tích điểm mạnh - điểm yếu. Thầy/cô AI khuyên em nên bắt đầu với một bài tự luyện cơ bản (Nhận biết - Thông hiểu) 10 câu môn {preferred_subject} để AI có cơ sở xây dựng lộ trình cá nhân hóa tốt nhất cho em nhé!",
                "suggested_config": {
                    "subject": preferred_subject,
                    "grade_level": preferred_grade,
                    "chapter": "",
                    "difficulty": "medium",
                    "count": 10
                },
                "focus_points": [
                    f"Khởi động với bài luyện chẩn đoán năng lực môn {preferred_subject}",
                    "Làm quen với các dạng câu hỏi trắc nghiệm chuẩn ma trận",
                    "Tạo dữ liệu ban đầu để AI trợ giảng phân tích chuyên sâu"
                ]
            }

        # Case B: Học sinh đã làm bài và không có chuyên đề nào yếu (< 70%)
        if not weak_topics:
            return {
                "ai_tutor_message": f"Chào {student_name}! Kết quả học tập các bài thi gần đây của em rất ấn tượng (độ chính xác {overall_accuracy:.0f}%). Để duy trì phong độ xuất sắc và bứt phá điểm 9-10, thầy/cô gợi ý em thử thách với các câu hỏi Vận dụng cao phân loại học sinh giỏi nhé!",
                "suggested_config": {
                    "subject": preferred_subject,
                    "grade_level": preferred_grade,
                    "chapter": "",
                    "difficulty": "hard",
                    "count": 10
                },
                "focus_points": [
                    "Rèn luyện tốc độ làm bài và xử lý bẫy đề thi",
                    "Luyện phản xạ các câu hỏi phân loại 9+ và cực trị thực tế",
                    "Tối ưu chiến thuật phân bổ thời gian phòng thi"
                ]
            }

        # Case C: Học sinh có chuyên đề yếu cần củng cố
        top_weak = weak_topics[0]
        chapter_name = top_weak.get("chapter") or "Chuyên đề trọng tâm"
        acc = top_weak.get("accuracy", 0.0)

        recommended_diff = "easy" if acc < 40 else "medium"
        advice = f"Chào {student_name}! Qua các bài thi gần đây, AI phát hiện em còn hay nhầm lẫn ở '{chapter_name}' (độ chính xác {acc:.0f}%). Em nên củng cố lại phần lý thuyết và làm ngay bài tự luyện 10 câu mức độ {('Cơ bản' if recommended_diff == 'easy' else 'Thông hiểu')} để lấy lại tự tin nhé!"

        if not self.client:
            return {
                "ai_tutor_message": advice,
                "suggested_config": {
                    "subject": top_weak.get("subject") or preferred_subject,
                    "grade_level": top_weak.get("grade_level") or preferred_grade,
                    "chapter": chapter_name,
                    "difficulty": recommended_diff,
                    "count": 10
                },
                "focus_points": [
                    f"Ôn tập kiến thức nền tảng '{chapter_name}'",
                    "Đọc kỹ lời giải chi tiết cho các câu làm sai",
                    "Tập trung làm chắc các câu nhận biết và thông hiểu"
                ]
            }

        system_prompt = (
            "Bạn là AI Trợ giảng cá nhân hóa (AI Tutor) tận tâm và am hiểu sư phạm. "
            "Nhiệm vụ: Dựa trên điểm yếu của học sinh, hãy đưa ra nhận xét động viên mang tính sư phạm và "
            "gợi ý kế hoạch luyện tập ngắn gọn, thiết thực nhất dưới dạng JSON:\n"
            "{\n"
            "  \"ai_tutor_message\": \"Lời khuyên ngắn gọn, ân cần, chỉ rõ điểm cần khắc phục và khích lệ học sinh\",\n"
            "  \"suggested_config\": {\n"
            "    \"subject\": \"Môn học\",\n"
            "    \"grade_level\": 12,\n"
            "    \"chapter\": \"Tên chuyên đề\",\n"
            "    \"difficulty\": \"easy\" | \"medium\" | \"hard\",\n"
            "    \"count\": 10\n"
            "  },\n"
            "  \"focus_points\": [\"Trọng tâm 1\", \"Trọng tâm 2\"]\n"
            "}"
        )

        user_prompt = (
            f"Học sinh: {student_name}\n"
            f"Môn học quan tâm: {preferred_subject}, Khối {preferred_grade}\n"
            f"Độ chính xác trung bình: {overall_accuracy:.1f}%\n"
            f"Các chuyên đề yếu nhất:\n"
        )
        for wt in weak_topics[:3]:
            user_prompt += f"- {wt.get('chapter', 'Chưa rõ')}: độ chính xác {wt.get('accuracy', 0):.1f}% (sai {wt.get('wrong_count', 0)}/{wt.get('total_count', 0)} câu)\n"

        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"}
            )
            parsed = _parse_json_response(response.choices[0].message.content)
            if isinstance(parsed, dict) and "ai_tutor_message" in parsed:
                return parsed
            return {
                "ai_tutor_message": advice,
                "suggested_config": {
                    "subject": top_weak.get("subject") or preferred_subject,
                    "grade_level": top_weak.get("grade_level") or preferred_grade,
                    "chapter": chapter_name,
                    "difficulty": recommended_diff,
                    "count": 10
                },
                "focus_points": [f"Tập trung cải thiện '{chapter_name}'"]
            }
        except Exception:
            return {
                "ai_tutor_message": advice,
                "suggested_config": {
                    "subject": top_weak.get("subject") or preferred_subject,
                    "grade_level": top_weak.get("grade_level") or preferred_grade,
                    "chapter": chapter_name,
                    "difficulty": recommended_diff,
                    "count": 10
                },
                "focus_points": [f"Tập trung cải thiện '{chapter_name}'"]
            }

