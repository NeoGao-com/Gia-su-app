import io
import re
import logging
from typing import List, Dict, Any, Tuple, Optional
import docx

try:
    import pymupdf
except ImportError:
    try:
        import fitz as pymupdf
    except ImportError:
        pymupdf = None

try:
    import pypdf
except ImportError:
    pypdf = None

logger = logging.getLogger(__name__)

DIFFICULTY_KEYWORDS = {
    "NB": "NHAN_BIET",
    "NHAN BIET": "NHAN_BIET",
    "NHẬN BIẾT": "NHAN_BIET",
    "TH": "THONG_HIEU",
    "THONG HIEU": "THONG_HIEU",
    "THÔNG HIỂU": "THONG_HIEU",
    "VD": "VAN_DUNG",
    "VAN DUNG": "VAN_DUNG",
    "VẬN DỤNG": "VAN_DUNG",
    "VDC": "VAN_DUNG_CAO",
    "VAN DUNG CAO": "VAN_DUNG_CAO",
    "VẬN DỤNG CAO": "VAN_DUNG_CAO",
}

def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """
    Trích xuất toàn bộ văn bản thô từ file .docx, .doc, .pdf, .md, .txt
    """
    name_lower = filename.lower()
    
    if name_lower.endswith('.docx'):
        doc = docx.Document(io.BytesIO(file_bytes))
        paragraphs = []
        for p in doc.paragraphs:
            t = p.text.strip()
            if t:
                paragraphs.append(t)
        # Quét các bảng nếu có
        for table in doc.tables:
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if cells:
                    paragraphs.append(" | ".join(cells))
        return "\n".join(paragraphs)

    elif name_lower.endswith('.pdf'):
        if pymupdf:
            doc = pymupdf.open(stream=file_bytes, filetype="pdf")
            pages_text = []
            for i in range(len(doc)):
                page_text = doc[i].get_text("text")
                if page_text.strip():
                    pages_text.append(page_text.strip())
            doc.close()
            return "\n\n".join(pages_text)
        elif pypdf:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            return "\n\n".join(page.extract_text() or "" for page in reader.pages)
        else:
            return ""

    elif name_lower.endswith(('.md', '.markdown', '.txt')):
        for enc in ['utf-8', 'utf-8-sig', 'cp1258', 'latin-1']:
            try:
                return file_bytes.decode(enc)
            except UnicodeDecodeError:
                continue
        return file_bytes.decode('utf-8', errors='ignore')

    elif name_lower.endswith('.doc'):
        # Cố gắng đọc dưới dạng docx hoặc trích text thô
        try:
            doc = docx.Document(io.BytesIO(file_bytes))
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except Exception:
            # Fallback lấy ASCII/UTF-8 strings
            text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', file_bytes.decode('utf-8', errors='ignore'))
            return text
            
    else:
        # Thử decode text mặc định
        return file_bytes.decode('utf-8', errors='ignore')


def extract_answer_key_map(text: str) -> Dict[int, str]:
    """
    Tìm bảng đáp án ở cuối văn bản nếu có.
    Ví dụ: 
    1.A  2.B  3.C
    1-A  2-B  3-C
    1. A | 2. B | 3. C
    Câu 1: A, Câu 2: B
    """
    key_map = {}
    # Tìm vùng đáp án
    match = re.search(r'(BẢNG ĐÁP ÁN|ĐÁP ÁN CÁC CÂU|HƯỚNG DẪN CHẤM|KEY|ANSWER KEY)[\s\S]*$', text, re.IGNORECASE)
    search_zone = match.group(0) if match else text
    
    # Mẫu 1.A, 1-A, 1: A, Câu 1: A
    pairs = re.findall(r'(?:Câu\s*)?(\d+)[\.\s\:\-\)]+\s*([A-D])\b', search_zone, re.IGNORECASE)
    for q_num_str, opt_char in pairs:
        try:
            q_num = int(q_num_str)
            key_map[q_num] = opt_char.upper()
        except ValueError:
            pass
            
    return key_map


def parse_questions_with_rules(
    text: str,
    default_subject: str = "Toán",
    default_grade_level: int = 10,
    default_chapter: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Bộ phân tích dựa trên mẫu regex thông minh cho đề thi tiếng Việt chuẩn.
    Hỗ trợ:
    - Trắc nghiệm 4 đáp án A, B, C, D (hoặc A., B., C., D.)
    - Đúng / Sai nhiều ý (a, b, c, d)
    - Trả lời ngắn / Điền đáp số
    - Tự luận
    """
    if not text or not text.strip():
        return []

    answer_keys = extract_answer_key_map(text)

    # Chia văn bản thành các block câu hỏi
    # Nhận diện: "Câu 1:", "Câu 1.", "Bài 1:", "Question 1:", "CÂU 1", "[Câu 1]"
    question_split_pattern = r'(?=(?:^|\n)\s*(?:Câu|Bài|Question)\s*(\d+)[\.\:\-\s\]\)])'
    raw_blocks = re.split(question_split_pattern, text, flags=re.IGNORECASE)
    
    questions = []
    
    if len(raw_blocks) > 1:
        # raw_blocks có dạng: [preamble, q1_num, q1_text, q2_num, q2_text, ...]
        i = 1
        while i < len(raw_blocks) - 1:
            q_num_str = raw_blocks[i]
            block_content = raw_blocks[i + 1]
            try:
                q_num = int(q_num_str)
            except ValueError:
                q_num = len(questions) + 1

            parsed_q = _parse_single_question_block(
                q_num=q_num,
                block_text=block_content,
                default_subject=default_subject,
                default_grade_level=default_grade_level,
                default_chapter=default_chapter,
                answer_key=answer_keys.get(q_num)
            )
            if parsed_q:
                questions.append(parsed_q)
            i += 2
    else:
        # Nếu không có từ khóa "Câu X:", thử chia theo số đầu dòng: "1.", "2."
        numbered_split_pattern = r'(?=(?:^|\n)\s*(\d+)[\.\)]\s+)'
        numbered_blocks = re.split(numbered_split_pattern, text)
        if len(numbered_blocks) > 1:
            i = 1
            while i < len(numbered_blocks) - 1:
                q_num_str = numbered_blocks[i]
                block_content = numbered_blocks[i + 1]
                try:
                    q_num = int(q_num_str)
                except ValueError:
                    q_num = len(questions) + 1

                parsed_q = _parse_single_question_block(
                    q_num=q_num,
                    block_text=block_content,
                    default_subject=default_subject,
                    default_grade_level=default_grade_level,
                    default_chapter=default_chapter,
                    answer_key=answer_keys.get(q_num)
                )
                if parsed_q:
                    questions.append(parsed_q)
                i += 2

    return questions


def _parse_single_question_block(
    q_num: int,
    block_text: str,
    default_subject: str,
    default_grade_level: int,
    default_chapter: Optional[str],
    answer_key: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    clean_block = block_text.strip()
    if not clean_block:
        return None

    # Xóa prefix "Câu X:", "Bài X:", "Question X:" ở đầu câu nếu còn sót
    clean_block = re.sub(r'^(?:Câu|Bài|Question)\s*\d+[\.\:\-\s\]\)]*', '', clean_block, flags=re.IGNORECASE).strip()

    # Tách mức độ nếu có: [NB], [TH], [VD], [VDC]
    difficulty = "THONG_HIEU"
    diff_match = re.search(r'\[(NB|TH|VD|VDC|Nhận biết|Thông hiểu|Vận dụng|Vận dụng cao)\]', clean_block, re.IGNORECASE)
    if diff_match:
        diff_key = diff_match.group(1).upper()
        difficulty = DIFFICULTY_KEYWORDS.get(diff_key, "THONG_HIEU")
        clean_block = clean_block.replace(diff_match.group(0), '').strip()

    # Tách phần Lời giải / Hướng dẫn giải nếu có
    explanation = ""
    sol_match = re.search(r'(?:Lời giải|Hướng dẫn giải|Giải thích|HDG|HƯỚNG DẪN GIẢI)\s*[:\-]\s*([\s\S]+)$', clean_block, re.IGNORECASE)
    if sol_match:
        explanation = sol_match.group(1).strip()
        clean_block = clean_block[:sol_match.start()].strip()

    # Tách đáp án đúng nếu ghi trong block: "Đáp án: A", "Đ/A: B", "Chọn C", "Đáp số: 6"
    inline_ans_match = re.search(r'(?:Đáp án|Đ\/A|Chọn|Đáp số|Key)\s*[:\-]\s*([A-D]|[\w\.\,\-]+)', clean_block, re.IGNORECASE)
    found_answer = answer_key
    if inline_ans_match:
        cand = inline_ans_match.group(1).strip()
        if cand.upper() in ["A", "B", "C", "D"]:
            found_answer = cand.upper()
        elif not found_answer:
            found_answer = cand
        clean_block = clean_block[:inline_ans_match.start()].strip()

    # 1. Kiểm tra xem có 4 phương án trắc nghiệm A., B., C., D. hay không
    # Pattern tìm A., B., C., D. (hỗ trợ cả dấu *A., #B., (A), A.)
    opt_pattern = r'(?:^|\s)([\*\#]?\s*[A-D])[\.\)]\s+'
    parts = re.split(opt_pattern, clean_block)
    
    if len(parts) >= 9:  # [content, opt_label1, opt_val1, opt_label2, opt_val2, ...]
        question_content = parts[0].strip()
        question_content = re.sub(r'^(?:[:\.\-\s]+)', '', question_content).strip()
        
        options_dict = {}
        for j in range(1, len(parts) - 1, 2):
            raw_label = parts[j]
            char = re.sub(r'[\*\#\s]', '', raw_label).upper()
            val = parts[j + 1].strip()
            # Kiểm tra xem có đánh dấu đúng ở phương án (vd: *A. hoặc A.* hoặc A. Đúng)
            if '*' in raw_label or '#' in raw_label or val.endswith('*') or val.endswith('#'):
                found_answer = char
            val = val.rstrip('*#').strip()
            options_dict[char] = val

        clean_opt = lambda s: re.sub(r'\s*(?:Đáp án|Đ\/A|Chọn|Key)\s*[:\-].*$', '', s, flags=re.IGNORECASE).strip()
        options = [
            clean_opt(options_dict.get("A", "")),
            clean_opt(options_dict.get("B", "")),
            clean_opt(options_dict.get("C", "")),
            clean_opt(options_dict.get("D", ""))
        ]

        # Xác định correct_option
        correct_opt_idx = 0
        if found_answer and found_answer.upper() in ["A", "B", "C", "D"]:
            char_map = {"A": 0, "B": 1, "C": 2, "D": 3}
            correct_opt_idx = char_map[found_answer.upper()]
        elif not found_answer and explanation:
            # Tìm trong lời giải xem có "chọn A", "đáp án B" không
            exp_match = re.search(r'(?:chọn|đáp án|phương án)\s+([A-D])\b', explanation, re.IGNORECASE)
            if exp_match:
                char_map = {"A": 0, "B": 1, "C": 2, "D": 3}
                correct_opt_idx = char_map[exp_match.group(1).upper()]

        return {
            "content": question_content,
            "question_type": "MULTIPLE_CHOICE",
            "options": options,
            "correct_option": correct_opt_idx,
            "correct_answer": None,
            "sub_questions": None,
            "explanation": explanation,
            "difficulty": difficulty,
            "subject": default_subject,
            "grade_level": default_grade_level,
            "chapter": default_chapter or "Kiến thức chung",
            "lesson": f"Bài trích xuất #{q_num}"
        }

    # 2. Kiểm tra xem có định dạng Đúng/Sai (các ý a), b), c), d))
    tf_pattern = r'(?:^|\n)\s*([a-d])[\.\)]\s+'
    tf_parts = re.split(tf_pattern, clean_block, flags=re.IGNORECASE)
    if len(tf_parts) >= 5:
        stem = tf_parts[0].strip()
        sub_questions = []
        for j in range(1, len(tf_parts) - 1, 2):
            letter = tf_parts[j].lower()
            stmt_text = tf_parts[j + 1].strip()
            # Kiểm tra xem có ghi (Đúng) hoặc (Sai) trong ý
            is_true = True
            if re.search(r'\b(?:Sai|False|S)\b', stmt_text, re.IGNORECASE):
                is_true = False
            sub_questions.append({
                "statement": f"{letter}) {stmt_text}",
                "answer": is_true
            })
            
        return {
            "content": stem,
            "question_type": "TRUE_FALSE",
            "options": None,
            "correct_option": None,
            "correct_answer": None,
            "sub_questions": sub_questions,
            "explanation": explanation,
            "difficulty": difficulty,
            "subject": default_subject,
            "grade_level": default_grade_level,
            "chapter": default_chapter or "Kiến thức chung",
            "lesson": f"Bài trích xuất #{q_num}"
        }

    # 3. Nếu là dạng điền từ / trả lời ngắn hoặc tự luận
    # Nếu có found_answer ngắn (< 30 ký tự) thì coi là SHORT_ANSWER
    content_clean = re.sub(r'^(?:[:\.\-\s]+)', '', clean_block).strip()
    if not content_clean:
        return None

    if found_answer and len(str(found_answer).strip()) < 40:
        return {
            "content": content_clean,
            "question_type": "SHORT_ANSWER",
            "options": None,
            "correct_option": None,
            "correct_answer": str(found_answer).strip(),
            "sub_questions": None,
            "explanation": explanation,
            "difficulty": difficulty,
            "subject": default_subject,
            "grade_level": default_grade_level,
            "chapter": default_chapter or "Kiến thức chung",
            "lesson": f"Bài trích xuất #{q_num}"
        }

    # Mặc định là Tự luận (ESSAY)
    return {
        "content": content_clean,
        "question_type": "ESSAY",
        "options": None,
        "correct_option": None,
        "correct_answer": None,
        "sample_solution": explanation or (str(found_answer) if found_answer else ""),
        "explanation": explanation,
        "difficulty": difficulty,
        "subject": default_subject,
        "grade_level": default_grade_level,
        "chapter": default_chapter or "Kiến thức chung",
        "lesson": f"Bài trích xuất #{q_num}"
    }
