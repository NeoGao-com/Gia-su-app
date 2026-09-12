import os
import json
import logging
from openai import OpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        # Fallback to a mockup generator if API key is not present
        self.api_key = settings.OPENAI_API_KEY
        if self.api_key:
            self.client = OpenAI(api_key=self.api_key)
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
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"}
            )
            raw_content = response.choices[0].message.content.strip()
            if raw_content.startswith("```"):
                raw_content = raw_content.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            data = json.loads(raw_content)
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
        Raises ValueError or HTTPException if API key is missing or call fails, preventing mock scores.
        """
        if not self.client:
            raise ValueError("AI grading is not available. Please configure OPENAI_API_KEY or grade manually.")

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

        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
