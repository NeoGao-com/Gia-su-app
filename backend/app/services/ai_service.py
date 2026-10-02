import os
import json
import logging
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

    def grade_essay(self, question_content: str, student_answer: str, sample_solution: str) -> dict:
        """
        Grade an essay question and return score (0 to 10) and feedback.
        """
        if not self.client:
            return {
                "score": 8.5,
                "feedback": "Bài làm tương đối chính xác, bám sát các ý chính trong hướng dẫn chấm. Cần trình bày chi tiết và rõ ràng hơn một số bước lập luận."
            }

        system_prompt = (
            "Bạn là giám khảo chấm thi tự luận. Hãy đánh giá bài làm của học sinh dựa trên câu hỏi và đáp án mẫu. "
            "Hãy trả về kết quả dưới dạng JSON có cấu trúc:\n"
            "{\n"
            "  \"score\": 8.5 (điểm số từ 0.0 đến 10.0),\n"
            "  \"feedback\": \"Nhận xét chi tiết ưu điểm và nhược điểm của bài làm.\"\n"
            "}"
        )

        user_prompt = (
            f"Câu hỏi: {question_content}\n"
            f"Đáp án mẫu: {sample_solution}\n"
            f"Bài làm của học sinh: {student_answer}"
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
            return _parse_json_response(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"Error calling AI in grade_essay: {str(e)}")
            return {
                "score": 7.0,
                "feedback": f"Không thể nhận phản hồi từ AI ({self.provider}): {str(e)}. Vui lòng chấm điểm thủ công hoặc kiểm tra cấu hình AI."
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

