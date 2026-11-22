import React, { useState, useMemo, useEffect } from 'react';
import { 
  Sparkles, Copy, Check, AlertCircle, CheckCircle2, Trash2, 
  ArrowLeft, RefreshCw, Eye, FileCode2, Info, ArrowRight, 
  ChevronDown, ChevronUp, Zap, Clipboard, Wand2, BookOpen, Layers,
  FolderTree, FolderPlus, FolderCheck, Sliders
} from 'lucide-react';
import { Modal } from './Modal';
import { MathRenderer } from './MathRenderer';
import { useToast } from '../context/ToastContext';
import api from '../api/axios';

const QUESTION_TYPE_LABELS = {
  MULTIPLE_CHOICE: { label: 'Trắc nghiệm', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  TRUE_FALSE: { label: 'Đúng / Sai', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  SHORT_ANSWER: { label: 'Điền từ / Ngắn', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  ESSAY: { label: 'Tự luận', bg: 'bg-sky-50 text-sky-700 border-sky-200' },
};

const DIFFICULTY_LABELS = {
  NHAN_BIET: { label: 'Nhận biết', bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  THONG_HIEU: { label: 'Thông hiểu', bg: 'bg-blue-50 text-blue-600 border-blue-100' },
  VAN_DUNG: { label: 'Vận dụng', bg: 'bg-orange-50 text-orange-600 border-orange-100' },
  VAN_DUNG_CAO: { label: 'Vận dụng cao', bg: 'bg-rose-50 text-rose-600 border-rose-100' },
};

const DEFAULT_SUBJECTS = [
  'Toán', 'Vật lí', 'Hóa học', 'Sinh học', 'Tiếng Anh', 
  'Ngữ văn', 'Lịch sử', 'Địa lí', 'Tin học', 'GDCD', 'Công nghệ'
];

const DEFAULT_GRADES = [6, 7, 8, 9, 10, 11, 12];

/**
 * Unicode NFC normalize and canonicalize category/chapter/lesson name.
 * Keeps raw numbers from "Ôn tập chương 1", strips leading prefixes like "Chương 1:".
 */
export function getCanonicalKey(name) {
  if (!name || typeof name !== 'string') return '';
  let s = name.normalize('NFC').trim().toLowerCase();
  s = s.replace(/\s+/g, ' ');
  const prefixRegex = /^(?:chương|phần|chuyên đề|chủ đề|bài)\s*(?:[0-9]+|[ivxlcdm]+)?\s*[:.\-–—]\s*/i;
  const stripped = s.replace(prefixRegex, '');
  const cleaned = stripped.replace(/^[:.\-–—,;\s]+|[:.\-–—,;\s]+$/g, '');
  return cleaned.length > 0 ? cleaned : s;
}

/**
 * Extract grade node from taxonomy treeData.
 * Supports keys like "Khối 10", "Lớp 10", "10", etc.
 */
export function getGradeNodeFromTree(taxonomyTree, subject, grade) {
  if (!taxonomyTree || typeof taxonomyTree !== 'object') return null;
  const subjNode = taxonomyTree[subject];
  if (!subjNode || typeof subjNode !== 'object') return null;

  if (grade === 'AUTO') {
    return null;
  }

  const targetGradeNum = Number(grade);
  if (subjNode[`Khối ${grade}`]) return subjNode[`Khối ${grade}`];
  if (subjNode[`Lớp ${grade}`]) return subjNode[`Lớp ${grade}`];
  if (subjNode[String(grade)]) return subjNode[String(grade)];

  for (const [key, val] of Object.entries(subjNode)) {
    const num = parseInt(key.replace(/[^0-9]/g, ''), 10);
    if (num === targetGradeNum) {
      return val;
    }
  }

  return null;
}

/**
 * MASTER PROMPT DYNAMICALLY GENERATED FROM CHOSEN SUBJECT, GRADE & TAXONOMY TREE
 */
export function generateMasterFilePrompt(subject = 'Toán', grade = 10, taxonomyTree = null) {
  const isAutoSubj = subject === 'AUTO';
  const isAutoGrade = grade === 'AUTO';

  const subjLine = isAutoSubj 
    ? '- Môn học: Tự nhận diện môn học theo nội dung tệp đính kèm'
    : `- Môn học mục tiêu: "${subject}" (Gán "subject": "${subject}" cho toàn bộ các câu hỏi)`;

  const gradeLine = isAutoGrade
    ? '- Khối lớp: Tự nhận diện khối lớp theo nội dung tệp đính kèm'
    : `- Khối lớp mục tiêu: Lớp ${grade} (Gán "grade_level": ${grade} cho toàn bộ các câu hỏi)`;

  // Extract 2-level structure: Chương -> [Danh sách Bài]
  let taxonomySection = '';
  if (!isAutoSubj && !isAutoGrade) {
    const gradeNode = getGradeNodeFromTree(taxonomyTree, subject, grade);
    if (gradeNode && typeof gradeNode === 'object') {
      const chapters = Object.keys(gradeNode).filter(ch => ch && ch !== 'null' && ch !== 'none');
      if (chapters.length > 0) {
        const lines = [];
        chapters.forEach((ch, idx) => {
          const lessons = Object.keys(gradeNode[ch] || {}).filter(l => l && l !== 'null' && l !== 'none');
          lines.push(`- Chương ${idx + 1}: "${ch}"`);
          if (lessons.length > 0) {
            lessons.forEach(l => {
              lines.push(`    + Bài học: "${l}"`);
            });
          }
        });
        taxonomySection = `\nDANH SÁCH CẤU TRÚC THƯ MỤC HIỆN CÓ CỦA ${subject.toUpperCase()} - LỚP ${grade}:\n${lines.join('\n')}\n`;
      }
    }
  }

  const taxonomyInstructions = taxonomySection
    ? `${taxonomySection}
QUY TẮC ĐẶT TÊN CHƯƠNG & BÀI HỌC (BẮT BUỘC):
- Ưu tiên sử dụng chính xác tên Chương ('chapter') và Bài học ('lesson') trong danh sách trên nếu nội dung câu hỏi thuộc mục đó.
- CHỈ tạo tên mới (theo đúng quy chuẩn đặt tên tương tự danh sách trên) nếu nội dung câu hỏi hoàn toàn chưa có trong danh sách.
- Không tự ý cắt bỏ tiền tố ('Chương 1:', 'Bài 1:').`
    : `QUY TẮC ĐẶT TÊN CHƯƠNG & BÀI HỌC (BẮT BUỘC):
- Ưu tiên sử dụng chính xác tên Chương ('chapter') và Bài học ('lesson') theo sách giáo khoa nếu nội dung câu hỏi thuộc mục đó.
- CHỈ tạo tên mới (theo đúng quy chuẩn đặt tên tương tự danh sách trên) nếu nội dung câu hỏi hoàn toàn chưa có trong danh sách.
- Không tự ý cắt bỏ tiền tố ('Chương 1:', 'Bài 1:').`;

  return `Bạn là một trợ lý chuyên nghiệp về khảo thí và trích xuất dữ liệu đề thi.
Tôi đã đính kèm / tải lên một tệp tài liệu (Word, PDF, Hình ảnh, Text hoặc Đề cương câu hỏi).

THÔNG TIN CẤU HÌNH YÊU CẦU:
${subjLine}
${gradeLine}

NHIỆM VỤ CỦA BẠN:
1. Đọc và trích xuất TOÀN BỘ các câu hỏi có trong tài liệu đính kèm. Không được bỏ sót bất kỳ câu hỏi nào.
2. Nếu câu hỏi trong tệp chưa có đáp án đúng được đánh dấu hoặc thiếu lời giải, bạn hãy tự giải chính xác câu hỏi đó và điền đáp án đúng cùng lời giải thích từng bước.
3. Chuyển đổi toàn bộ danh sách câu hỏi thành duy nhất MỘT MẢNG JSON HỢP LỆ theo cấu trúc chuẩn bên dưới để nhập trực tiếp vào hệ thống cơ sở dữ liệu.

QUY TẮC CÚ PHÁP & TOÁN HỌC (BẮT BUỘC ĐỂ TRÁNH LỖI JSON):
1. CÔNG THỨC TOÁN / LÝ / HÓA: BẮT BUỘC viết dưới dạng LaTeX chuẩn và nằm trong cặp dấu $...$ (nội dòng) hoặc $$...$$ (khối). Ví dụ: $\\frac{a}{b}$, $\\sqrt{x^2 + 1}$, $\\vec{u}$, $\\alpha$, $\\Delta$, $x \\in \\mathbb{R}$.
2. QUY TẮC ESCAPE TRONG CHUỖI JSON: Mọi dấu gạch chéo ngược "\\" của LaTeX BẮT BUỘC phải viết thành "\\\\" (double backslash), ví dụ: "\\\\frac{1}{2}", "\\\\sqrt{x}", "\\\\pm", "\\\\ne", "\\\\alpha".
3. TUYỆT ĐỐI KHÔNG để dấu phẩy thừa ở cuối danh sách (no trailing commas), ví dụ ["A", "B", "C", "D"] thay vì ["A", "B", "C", "D",].
4. MỌI dấu ngoặc kép bên trong nội dung phải được escape bằng \\" (ví dụ: \\"hình vuông\\").

CẤU TRÚC 4 DẠNG CÂU HỎI HỖ TRỢ TRONG HỆ THỐNG:
1. Dạng 1: TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN (question_type: "MULTIPLE_CHOICE")
   - "options": Mảng chứa các phương án lựa chọn (thường là 4 phương án [A, B, C, D]).
   - "correct_option": BẮT BUỘC là số nguyên từ 0 đến 3 (0 = đáp án A, 1 = B, 2 = C, 3 = D).

2. Dạng 2: ĐÚNG / SAI 4 Ý (question_type: "TRUE_FALSE" - Chuẩn đề thi mới)
   - "sub_questions": Mảng gồm các mệnh đề con (thường là 4 ý a, b, c, d).
   - Mỗi phần tử gồm:
     + "statement": Nội dung khẳng định / mệnh đề.
     + "answer": Giá trị boolean true nếu mệnh đề ĐÚNG, false nếu mệnh đề SAI.

3. Dạng 3: TRẢ LỜI NGẮN / ĐIỀN SỐ (question_type: "SHORT_ANSWER")
   - "content": Nội dung câu hỏi (chứa ký hiệu "/key" tại vị trí cần điền số hoặc từ).
   - "correct_answer": Chuỗi đáp án chính xác (ví dụ: "5" hoặc "-1/2" hoặc "Hà Nội").

4. Dạng 4: TỰ LUẬN (question_type: "ESSAY")
   - "sample_solution": Hướng dẫn chấm, biểu điểm và các bước giải chi tiết.

CÁC TRƯỜNG THUỘC TÍNH DÙNG CHUNG CHO MỖI CÂU HỎI:
- "content": Nội dung câu hỏi (chứa công thức LaTeX nếu có).
- "question_type": Một trong 4 giá trị: "MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY".
- "difficulty": Mức độ nhận thức: "NHAN_BIET", "THONG_HIEU", "VAN_DUNG", hoặc "VAN_DUNG_CAO".
- "subject": "${isAutoSubj ? 'Tên môn học nhận diện từ đề' : subject}".
- "grade_level": ${isAutoGrade ? 10 : grade}.
- "chapter": "Tên chương hoặc chủ đề kiến thức lớn (tuân thủ quy tắc bên dưới)".
- "lesson": "Tên bài học cụ thể (tuân thủ quy tắc bên dưới)".
- "topic": "Dạng bài học hoặc chuyên đề nhỏ (ví dụ: 'Dạng 1: Tọa độ đỉnh parabol', nếu không có ghi 'Dạng chung')".
- "explanation": Lời giải thích chi tiết từng bước bằng công thức LaTeX.

${taxonomyInstructions}

ĐỊNH DẠNG ĐẦU RA (CỰC KỲ QUAN TRỌNG):
- CHỈ TRẢ VỀ DUY NHẤT MỘT MẢNG JSON HỢP LỆ: Bắt đầu bằng [ và kết thúc bằng ].
- TUYỆT ĐỐI KHÔNG kèm theo bất kỳ văn bản chào hỏi, giải thích bên ngoài hay code block markdown.

VÍ DỤ MẪU JSON CHUẨN:
[
  {
    "content": "Cho hàm số $y = x^2 - 4x + 3$. Tọa độ đỉnh của parabol là:",
    "question_type": "MULTIPLE_CHOICE",
    "subject": "${isAutoSubj ? 'Toán' : subject}",
    "grade_level": ${isAutoGrade ? 10 : grade},
    "chapter": "Hàm số bậc hai",
    "lesson": "Bài 1: Khái niệm hàm số",
    "topic": "Dạng 1: Tọa độ đỉnh parabol",
    "difficulty": "THONG_HIEU",
    "options": [
      "$(2; -1)$",
      "$(-2; -1)$",
      "$(2; 1)$",
      "$(1; 0)$"
    ],
    "correct_option": 0,
    "explanation": "Tọa độ đỉnh $I(x_0; y_0)$ có $x_0 = -\\\\frac{b}{2a} = 2$, thay vào ta được $y_0 = -1$."
  }
]`;
}

const SAMPLE_DEMO_QUESTIONS = [
  {
    content: "Cho hàm số $y = x^2 - 4x + 3$. Tọa độ đỉnh của parabol là:",
    question_type: "MULTIPLE_CHOICE",
    subject: "Toán",
    grade_level: 10,
    chapter: "Hàm số bậc hai",
    lesson: "Bài 1: Khái niệm hàm số",
    topic: "Dạng 1: Tọa độ đỉnh parabol",
    difficulty: "THONG_HIEU",
    options: ["$(2; -1)$", "$(-2; -1)$", "$(2; 1)$", "$(1; 0)$"],
    correct_option: 0,
    explanation: "Tọa độ đỉnh $I(x_0; y_0)$ có $x_0 = -\\frac{b}{2a} = 2$, thay vào ta được $y_0 = -1$."
  },
  {
    content: "Xét các mệnh đề sau về vectơ trong mặt phẳng:",
    question_type: "TRUE_FALSE",
    subject: "Toán",
    grade_level: 10,
    chapter: "Vectơ",
    lesson: "Bài 1: Khái niệm vectơ",
    topic: "Dạng 1: Các định nghĩa cơ bản",
    difficulty: "THONG_HIEU",
    sub_questions: [
      { statement: "Hai vectơ cùng phương thì cùng hướng.", answer: false },
      { statement: "Vectơ-không cùng hướng với mọi vectơ.", answer: true },
      { statement: "Hai vectơ bằng nhau thì có cùng độ dài.", answer: true },
      { statement: "Độ dài vectơ luôn là số dương.", answer: false }
    ],
    explanation: "Vectơ-không có độ dài bằng 0 (không âm chứ không phải luôn dương)."
  },
  {
    content: "Nghiệm của phương trình $\\sqrt{2x - 1} = 3$ là $x = $ /key.",
    question_type: "SHORT_ANSWER",
    subject: "Toán",
    grade_level: 10,
    difficulty: "NHAN_BIET",
    correct_answer: "5",
    explanation: "Bình phương hai vế: $2x - 1 = 9 \\Rightarrow 2x = 10 \\Rightarrow x = 5$."
  },
  {
    content: "Nêu điều kiện cần và đủ để tam giác $ABC$ đều.",
    question_type: "ESSAY",
    subject: "Toán",
    grade_level: 10,
    difficulty: "VAN_DUNG",
    sample_solution: "Tam giác có 3 cạnh bằng nhau hoặc có 3 góc bằng nhau ($60^\\circ$).",
    explanation: "Theo định nghĩa và tính chất của tam giác đều."
  }
];

export function robustJsonRepair(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let str = raw.trim();

  // 1. Strip markdown code fences anywhere in text
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match;
  let codeBlocks = [];
  while ((match = codeBlockRegex.exec(str)) !== null) {
    if (match[1] && match[1].trim()) {
      codeBlocks.push(match[1].trim());
    }
  }
  if (codeBlocks.length > 0) {
    str = codeBlocks.reduce((a, b) => (b.length > a.length ? b : a), codeBlocks[0]);
  }

  // 2. Find outermost JSON boundary [ ... ] or { ... }
  const firstBracket = str.indexOf('[');
  const firstBrace = str.indexOf('{');
  let startIdx = -1;
  let isArray = true;

  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    startIdx = firstBracket;
    isArray = true;
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
    isArray = false;
  }

  if (startIdx !== -1) {
    const endChar = isArray ? ']' : '}';
    const lastIdx = str.lastIndexOf(endChar);
    if (lastIdx > startIdx) {
      str = str.substring(startIdx, lastIdx + 1);
    } else {
      str = str.substring(startIdx) + (isArray ? '\n]' : '\n}');
    }
  }

  // 3. Normalize typographic smart quotes and invisible spaces
  str = str
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ');

  // 4. Token-aware string repair
  let inString = false;
  let isEscaped = false;
  let result = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (!inString) {
      if (ch === '"') {
        inString = true;
        isEscaped = false;
        result += ch;
      } else {
        result += ch;
      }
    } else {
      if (isEscaped) {
        isEscaped = false;
        result += ch;
      } else if (ch === '\\') {
        const next = str[i + 1] || '';
        const lookahead4 = str.substring(i + 1, i + 5);

        if (next === '"' || next === '\\' || next === '/') {
          result += ch;
          isEscaped = true;
        } else if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(lookahead4.substring(1))) {
          result += ch;
          isEscaped = true;
        } else if (
          (next === 'f' && /^[a-zA-Z]/.test(str[i + 2] || '')) ||
          (next === 't' && /^[a-zA-Z]/.test(str[i + 2] || '')) ||
          (next === 'b' && /^[a-zA-Z]/.test(str[i + 2] || '')) ||
          (next === 'r' && /^[a-zA-Z]/.test(str[i + 2] || '')) ||
          (next === 'n' && /^[a-zA-Z]/.test(str[i + 2] || '')) ||
          (next === 'u' && !/^[0-9a-fA-F]{4}$/.test(lookahead4.substring(1)))
        ) {
          result += '\\\\';
        } else if (next === 'b' || next === 'f' || next === 'n' || next === 'r' || next === 't') {
          result += ch;
          isEscaped = true;
        } else {
          result += '\\\\';
        }
      } else if (ch === '"') {
        const remaining = str.substring(i + 1).trim();
        const isFollowedByJsonDelimiter = /^[,\}\]\:]/.test(remaining) || remaining.length === 0;

        if (isFollowedByJsonDelimiter) {
          inString = false;
          result += ch;
        } else {
          result += '\\"';
        }
      } else if (ch === '\n') {
        result += '\\n';
      } else if (ch === '\r') {
        // Skip
      } else if (ch === '\t') {
        result += '\\t';
      } else {
        result += ch;
      }
    }
  }

  // 5. Remove trailing commas before } or ]
  result = result.replace(/,\s*([}\]])/g, '$1');

  return result;
}

export function cleanAndParseJson(rawText) {
  if (!rawText || !rawText.trim()) {
    throw new Error('Vui lòng dán chuỗi JSON danh sách câu hỏi.');
  }

  const trimmed = rawText.trim();

  if (!trimmed.includes('{') && !trimmed.includes('[')) {
    throw new Error('Văn bản bạn vừa dán không phải là mã JSON! Hãy nhập danh sách câu hỏi theo định dạng JSON chuẩn để dán vào đây.');
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const repaired = robustJsonRepair(trimmed);
    try {
      return JSON.parse(repaired);
    } catch (parseErr) {
      let errorDetail = parseErr.message;
      const posMatch = /position\s+(\d+)/i.exec(parseErr.message);
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const upToErr = repaired.substring(0, pos);
        const lines = upToErr.split('\n');
        const lineNum = lines.length;
        const colNum = lines[lines.length - 1].length + 1;
        const startSnippet = Math.max(0, pos - 40);
        const endSnippet = Math.min(repaired.length, pos + 40);
        const snippet = repaired.substring(startSnippet, endSnippet);
        errorDetail = `Lỗi tại Dòng ${lineNum}, Cột ${colNum}: "${snippet.replace(/\n/g, ' ')}" (${parseErr.message})`;
      }
      throw new Error(errorDetail);
    }
  }
}

export function normalizeQuestionList(rawList, defaultCategory = null, fallbackSubject = 'Toán', fallbackGrade = 10) {
  const warnings = [];
  const normalized = rawList.map((item, idx) => {
    const q = { ...item };
    const qNum = idx + 1;

    // Preserve original chapter & lesson from raw input for mapping preview
    q._originalChapter = item.chapter || '';
    q._originalLesson = item.lesson || '';

    // Type
    const qType = (q.question_type || (Array.isArray(q.sub_questions) ? 'TRUE_FALSE' : 'MULTIPLE_CHOICE')).toUpperCase();
    q.question_type = qType;

    // Subject & Grade defaults
    if (!q.subject) {
      q.subject = (fallbackSubject && fallbackSubject !== 'AUTO') 
        ? fallbackSubject 
        : (defaultCategory?.subject || 'Toán');
    }
    if (!q.grade_level) {
      q.grade_level = (fallbackGrade && fallbackGrade !== 'AUTO') 
        ? Number(fallbackGrade) 
        : (defaultCategory?.grade_level ? Number(defaultCategory.grade_level) : 10);
    }
    if (!q.difficulty) q.difficulty = 'THONG_HIEU';

    // Check specifics
    if (qType === 'MULTIPLE_CHOICE') {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        warnings.push(`Câu ${qNum}: Thiếu phương án lựa chọn.`);
      }
      if (typeof q.correct_option === 'string') {
        const k = q.correct_option.trim().toUpperCase();
        const map = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
        if (map[k] !== undefined) q.correct_option = map[k];
        else if (!isNaN(parseInt(k, 10))) q.correct_option = parseInt(k, 10);
      } else if (q.correct_option === undefined || q.correct_option === null) {
        if (q.correct_answer && ['A', 'B', 'C', 'D'].includes(q.correct_answer.trim().toUpperCase())) {
          q.correct_option = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }[q.correct_answer.trim().toUpperCase()];
        } else {
          warnings.push(`Câu ${qNum}: Chưa đánh dấu đáp án đúng (correct_option).`);
        }
      }
    } else if (qType === 'TRUE_FALSE') {
      if (!Array.isArray(q.sub_questions) || q.sub_questions.length === 0) {
        warnings.push(`Câu ${qNum}: Thiếu danh sách mệnh đề sub_questions.`);
      } else {
        q.sub_questions = q.sub_questions.map(sub => {
          if (typeof sub === 'string') return { statement: sub, answer: true };
          const rawAns = sub.answer !== undefined ? sub.answer : sub.is_correct;
          let boolAns = true;
          if (typeof rawAns === 'boolean') boolAns = rawAns;
          else if (typeof rawAns === 'string') boolAns = ['true', 'đúng', 'dung', '1'].includes(rawAns.trim().toLowerCase());
          return {
            statement: sub.statement || sub.content || '',
            answer: boolAns
          };
        });
      }
    } else if (qType === 'SHORT_ANSWER') {
      if (!q.correct_answer) {
        warnings.push(`Câu ${qNum}: Chưa có chuỗi đáp án chính xác (correct_answer).`);
      }
    }

    return q;
  });

  return { normalized, warnings };
}

/**
 * Apply override rules to questions based on storageMode & overrideLevel.
 */
export function applyOverridesToQuestion(q, storageMode, overrideLevel, overrideChapter, overrideLesson) {
  const updated = { ...q };
  const baseChap = q._originalChapter !== undefined ? q._originalChapter : (q.chapter || '');
  const baseLess = q._originalLesson !== undefined ? q._originalLesson : (q.lesson || '');

  if (storageMode === 'override') {
    if (overrideChapter && overrideChapter.trim()) {
      updated.chapter = overrideChapter.trim();
    } else {
      updated.chapter = baseChap || 'Chương chung';
    }

    if (overrideLevel === 'all' && overrideLesson && overrideLesson.trim()) {
      updated.lesson = overrideLesson.trim();
    } else {
      updated.lesson = baseLess || 'Bài chung';
    }
  } else {
    updated.chapter = baseChap || 'Chương chung';
    updated.lesson = baseLess || 'Bài chung';
  }
  return updated;
}

export function ImportJsonModal({ 
  isOpen, 
  onClose, 
  selectedCategory, 
  treeData,
  onSuccess 
}) {
  const { toast } = useToast();

  // Navigation steps: 'input' | 'preview'
  const [step, setStep] = useState('input');
  const [showPromptDetails, setShowPromptDetails] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Dynamic Subject & Grade selectors from Question Bank
  const availableSubjects = useMemo(() => {
    const fromTree = Object.keys(treeData || {});
    return Array.from(new Set([...fromTree, ...DEFAULT_SUBJECTS])).filter(Boolean);
  }, [treeData]);

  const availableGrades = useMemo(() => {
    const gradesSet = new Set(DEFAULT_GRADES);
    if (treeData && typeof treeData === 'object') {
      Object.values(treeData).forEach(subTree => {
        if (subTree && typeof subTree === 'object') {
          Object.keys(subTree).forEach(gradeKey => {
            const num = parseInt(gradeKey.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(num) && num > 0) gradesSet.add(num);
          });
        }
      });
    }
    return Array.from(gradesSet).sort((a, b) => a - b);
  }, [treeData]);

  const [selectedSubject, setSelectedSubject] = useState(selectedCategory?.subject || 'Toán');
  const [selectedGrade, setSelectedGrade] = useState(selectedCategory?.grade_level ? Number(selectedCategory.grade_level) : 10);

  // Storage override states
  const [storageMode, setStorageMode] = useState('auto'); // 'auto' | 'override'
  const [overrideLevel, setOverrideLevel] = useState('chapter'); // 'chapter' | 'all'
  const [overrideChapter, setOverrideChapter] = useState(selectedCategory?.chapter || '');
  const [overrideLesson, setOverrideLesson] = useState(selectedCategory?.lesson || '');

  useEffect(() => {
    if (selectedCategory?.subject) setSelectedSubject(selectedCategory.subject);
    if (selectedCategory?.grade_level) setSelectedGrade(Number(selectedCategory.grade_level));
    if (selectedCategory?.chapter) setOverrideChapter(selectedCategory.chapter);
    if (selectedCategory?.lesson) setOverrideLesson(selectedCategory.lesson);
  }, [selectedCategory]);

  // Available chapters & lessons for the currently selected subject and grade
  const currentGradeNode = useMemo(() => {
    return getGradeNodeFromTree(treeData, selectedSubject, selectedGrade);
  }, [treeData, selectedSubject, selectedGrade]);

  const availableChapters = useMemo(() => {
    if (!currentGradeNode || typeof currentGradeNode !== 'object') return [];
    return Object.keys(currentGradeNode).filter(ch => ch && ch !== 'null' && ch !== 'none');
  }, [currentGradeNode]);

  const availableLessons = useMemo(() => {
    if (!currentGradeNode || !overrideChapter) return [];
    const lessonsObj = currentGradeNode[overrideChapter];
    if (!lessonsObj || typeof lessonsObj !== 'object') return [];
    return Object.keys(lessonsObj).filter(l => l && l !== 'null' && l !== 'none');
  }, [currentGradeNode, overrideChapter]);

  // Master Prompt text generated dynamically with 2-level structure included
  const currentMasterPrompt = useMemo(() => {
    return generateMasterFilePrompt(selectedSubject, selectedGrade, treeData);
  }, [selectedSubject, selectedGrade, treeData]);

  // Raw JSON input
  const [jsonInput, setJsonInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parseErrorAlert, setParseErrorAlert] = useState(null);

  // Parsed questions
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [parseWarnings, setParseWarnings] = useState([]);

  // Compute Preview Mapping table (Unique JSON (Chương, Bài) -> Target (Chương, Bài))
  const previewMapping = useMemo(() => {
    if (!parsedQuestions || parsedQuestions.length === 0) return [];

    const existingChapters = currentGradeNode ? Object.keys(currentGradeNode) : [];
    const chapterCanonMap = new Map();
    const lessonCanonMap = new Map();

    existingChapters.forEach(chap => {
      chapterCanonMap.set(getCanonicalKey(chap), chap);
      const lessons = Object.keys(currentGradeNode[chap] || {});
      lessons.forEach(les => {
        lessonCanonMap.set(`${getCanonicalKey(chap)}||${getCanonicalKey(les)}`, les);
      });
    });

    const map = new Map();

    parsedQuestions.forEach(q => {
      const rawChap = (q._originalChapter !== undefined ? q._originalChapter : (q.chapter || '')).trim();
      const rawLess = (q._originalLesson !== undefined ? q._originalLesson : (q.lesson || '')).trim();
      const origChapDisplay = rawChap || '(Trống trong JSON)';
      const origLessDisplay = rawLess || '(Trống trong JSON)';

      const pairKey = `${rawChap}||${rawLess}`;

      if (!map.has(pairKey)) {
        let targetChap = rawChap || 'Chương chung';
        let targetLess = rawLess || 'Bài chung';
        let status = 'NEW'; // 'MATCHED' | 'NEW' | 'OVERRIDE'

        if (storageMode === 'override') {
          const hasChapOverride = Boolean(overrideChapter && overrideChapter.trim());
          const hasLessOverride = overrideLevel === 'all' && Boolean(overrideLesson && overrideLesson.trim());
          if (hasChapOverride || hasLessOverride) {
            status = 'OVERRIDE';
            if (hasChapOverride) {
              const cOverKey = getCanonicalKey(overrideChapter.trim());
              targetChap = chapterCanonMap.has(cOverKey) ? chapterCanonMap.get(cOverKey) : overrideChapter.trim();
            }
            if (hasLessOverride) {
              targetLess = overrideLesson.trim();
            } else {
              // Partial override (Chỉ ghi đè Chương): lookup lesson in resolved chapter!
              const cResolvedChap = getCanonicalKey(targetChap);
              const lKey = `${cResolvedChap}||${getCanonicalKey(rawLess)}`;
              if (lessonCanonMap.has(lKey)) {
                targetLess = lessonCanonMap.get(lKey);
              }
            }
          }
        } else {
          // Auto mode: Canonical check against existing tree
          const cKey = getCanonicalKey(rawChap);
          const lKey = `${cKey}||${getCanonicalKey(rawLess)}`;

          if (chapterCanonMap.has(cKey)) {
            targetChap = chapterCanonMap.get(cKey);
            if (lessonCanonMap.has(lKey)) {
              targetLess = lessonCanonMap.get(lKey);
              status = 'MATCHED';
            } else {
              status = 'NEW';
            }
          } else {
            status = 'NEW';
          }
        }

        map.set(pairKey, {
          originalChapter: origChapDisplay,
          originalLesson: origLessDisplay,
          targetChapter: targetChap,
          targetLesson: targetLess,
          status,
          count: 0
        });
      }

      map.get(pairKey).count += 1;
    });

    return Array.from(map.values());
  }, [parsedQuestions, currentGradeNode, storageMode, overrideLevel, overrideChapter, overrideLesson]);

  // Counts for mapping summary badges
  const summaryCounts = useMemo(() => {
    let matched = 0;
    let newCount = 0;
    let overrideCount = 0;
    previewMapping.forEach(item => {
      if (item.status === 'MATCHED') matched += 1;
      else if (item.status === 'NEW') newCount += 1;
      else if (item.status === 'OVERRIDE') overrideCount += 1;
    });
    return { matched, new: newCount, override: overrideCount };
  }, [previewMapping]);

  if (!isOpen) return null;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(currentMasterPrompt);
      setCopiedPrompt(true);
      toast.success(`Đã sao chép cấu trúc mẫu cho [${selectedSubject === 'AUTO' ? 'Tự nhận diện' : selectedSubject} - ${selectedGrade === 'AUTO' ? 'Tự nhận diện' : 'Lớp ' + selectedGrade}]!`);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = currentMasterPrompt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedPrompt(true);
      toast.success('Đã sao chép cấu trúc mẫu thành công!');
      setTimeout(() => setCopiedPrompt(false), 2500);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setJsonInput(text);
        setParseErrorAlert(null);
        toast.info('Đã dán dữ liệu từ Clipboard!');
      } else {
        toast.warning('Clipboard rỗng hoặc không có dữ liệu văn bản.');
      }
    } catch {
      toast.info('Vui lòng bấm Ctrl + V (hoặc Command + V) để dán vào ô bên dưới.');
    }
  };

  const handleFillSample = () => {
    const customized = SAMPLE_DEMO_QUESTIONS.map(q => ({
      ...q,
      subject: selectedSubject !== 'AUTO' ? selectedSubject : q.subject,
      grade_level: selectedGrade !== 'AUTO' ? Number(selectedGrade) : q.grade_level
    }));
    setJsonInput(JSON.stringify(customized, null, 2));
    setParseErrorAlert(null);
    toast.info('Đã nạp mẫu JSON 4 dạng câu hỏi chuẩn.');
  };

  const handleAutoFixBackslash = () => {
    try {
      const parsed = cleanAndParseJson(jsonInput);
      setJsonInput(JSON.stringify(parsed, null, 2));
      setParseErrorAlert(null);
      toast.success('Đã tự động sửa lỗi cú pháp & chuẩn hóa JSON!');
    } catch (err) {
      setParseErrorAlert(err.message);
      toast.error('Lỗi cú pháp: ' + err.message);
    }
  };

  // FAST DIRECT BULK IMPORT (1-Click) with override rules applied
  const handleFastDirectImport = async () => {
    if (!jsonInput.trim()) {
      toast.error('Vui lòng dán chuỗi JSON vào ô bên dưới.');
      return;
    }

    try {
      setIsSubmitting(true);
      setParseErrorAlert(null);
      const parsed = cleanAndParseJson(jsonInput);
      const rawList = Array.isArray(parsed) 
        ? parsed 
        : (parsed.questions || parsed.data || parsed.items || [parsed]);

      if (!rawList || !rawList.length) {
        throw new Error('Dữ liệu JSON không chứa danh sách câu hỏi hợp lệ.');
      }

      const { normalized } = normalizeQuestionList(rawList, selectedCategory, selectedSubject, selectedGrade);
      
      // Apply storage overrides and strip temporary mapping properties
      const questionsToSubmit = normalized.map(q => {
        const overridden = applyOverridesToQuestion(q, storageMode, overrideLevel, overrideChapter, overrideLesson);
        const { _originalChapter, _originalLesson, ...cleanQ } = overridden;
        return cleanQ;
      });

      const res = await api.post('/questions/import-json', { questions: questionsToSubmit });
      toast.success(res.data?.message || `Đã nhập hàng loạt ${questionsToSubmit.length} câu hỏi vào ngân hàng thành công!`);
      
      onClose();
      if (onSuccess) {
        try {
          onSuccess();
        } catch (cbErr) {
          console.error("onSuccess error:", cbErr);
        }
      }
    } catch (err) {
      setParseErrorAlert(err.message);
      toast.error('Không thể nhập câu hỏi: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  // PROCEED TO PREVIEW
  const handleProceedToPreview = async () => {
    try {
      setParseErrorAlert(null);
      const parsed = cleanAndParseJson(jsonInput);
      const rawList = Array.isArray(parsed) 
        ? parsed 
        : (parsed.questions || parsed.data || parsed.items || [parsed]);

      if (!rawList || !rawList.length) {
        throw new Error('Dữ liệu JSON không chứa danh sách câu hỏi hợp lệ.');
      }

      const { normalized, warnings } = normalizeQuestionList(rawList, selectedCategory, selectedSubject, selectedGrade);
      
      // Optional call to dry-run preview endpoint if available
      try {
        const cleanPayload = normalized.map(q => {
          const overridden = applyOverridesToQuestion(q, storageMode, overrideLevel, overrideChapter, overrideLesson);
          const { _originalChapter, _originalLesson, ...cleanQ } = overridden;
          return cleanQ;
        });
        await api.post('/questions/import-json/preview', { questions: cleanPayload });
      } catch {
        // Handled seamlessly via local taxonomy canonical matching
      }

      setParsedQuestions(normalized);
      setParseWarnings(warnings);
      setStep('preview');
      toast.success(`Đã phân tích thành công ${normalized.length} câu hỏi!`);
    } catch (err) {
      setParseErrorAlert(err.message);
      toast.error('Lỗi phân tích JSON: ' + err.message);
    }
  };

  const handleRemoveQuestionFromPreview = (index) => {
    setParsedQuestions(prev => prev.filter((_, i) => i !== index));
    toast.info('Đã xóa câu hỏi khỏi danh sách xem trước.');
  };

  const handleUpdateCorrectOption = (qIndex, optIndex) => {
    setParsedQuestions(prev => {
      const next = [...prev];
      next[qIndex] = { ...next[qIndex], correct_option: optIndex };
      return next;
    });
  };

  // FINAL IMPORT with override rules applied
  const handleFinalImport = async () => {
    if (!parsedQuestions.length) {
      toast.error('Không có câu hỏi nào để nhập.');
      return;
    }
    try {
      setIsSubmitting(true);
      const questionsToSubmit = parsedQuestions.map(q => {
        const overridden = applyOverridesToQuestion(q, storageMode, overrideLevel, overrideChapter, overrideLesson);
        const { _originalChapter, _originalLesson, ...cleanQ } = overridden;
        return cleanQ;
      });

      const res = await api.post('/questions/import-json', { questions: questionsToSubmit });
      toast.success(res.data?.message || `Đã nhập ${questionsToSubmit.length} câu hỏi thành công!`);
      onClose();
      if (onSuccess) {
        try {
          onSuccess();
        } catch (cbErr) {
          console.error("onSuccess error:", cbErr);
        }
      }
    } catch (err) {
      toast.error('Lỗi khi lưu câu hỏi: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Nhập câu hỏi hàng loạt bằng JSON chuẩn hóa"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <div className="flex items-center space-x-3 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setStep('input')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                step === 'input' 
                  ? 'bg-indigo-600 text-white shadow-xs font-bold' 
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Bước 1: Chọn Môn, Cấu hình Thư mục &amp; Lấy Prompt</span>
            </button>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <button
              type="button"
              disabled={!parsedQuestions.length && step !== 'preview'}
              onClick={() => parsedQuestions.length && setStep('preview')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                step === 'preview' 
                  ? 'bg-indigo-600 text-white shadow-xs font-bold' 
                  : 'bg-white text-slate-400 hover:text-slate-600 disabled:opacity-50 border border-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Bước 2: Xem trước &amp; Xác nhận ({parsedQuestions.length || 0} câu)</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center space-x-1.5 text-xs text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100 font-bold">
            <BookOpen className="w-3.5 h-3.5" />
            <span>{selectedSubject === 'AUTO' ? 'Tự nhận diện' : selectedSubject} • {selectedGrade === 'AUTO' ? 'Mọi khối' : `Khối ${selectedGrade}`}</span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* STEP 1: FORMAT & JSON INPUT */}
        {/* ======================================================== */}
        {step === 'input' && (
          <div className="space-y-4">
            {/* MASTER FILE FORMAT BANNER */}
            <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-50/90 via-slate-50/50 to-white border border-indigo-200/80 rounded-2xl space-y-3.5 shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-1">
                  <div className="text-xs sm:text-sm font-extrabold text-indigo-950 flex items-center space-x-2">
                    <FileCode2 className="w-4 h-4 text-indigo-600" />
                    <span>Cấu trúc JSON Chuẩn: Hướng dẫn định dạng tệp câu hỏi hợp lệ</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Hệ thống sẽ đối chiếu với danh mục Chương &amp; Bài học có sẵn trong ngân hàng, tự động chuẩn hóa hoặc ghi đè theo chỉ định của bạn.
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowPromptDetails(!showPromptDetails)}
                    className="flex-1 sm:flex-none flex items-center justify-center space-x-1 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>{showPromptDetails ? 'Thu gọn' : 'Xem nội dung'}</span>
                    {showPromptDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                    title="Bấm để sao chép cấu trúc JSON mẫu kèm danh mục thư mục hiện có"
                  >
                    {copiedPrompt ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedPrompt ? 'Đã sao chép prompt!' : 'Sao chép cấu trúc mẫu'}</span>
                  </button>
                </div>
              </div>

              {/* DYNAMIC SELECTORS: MÔN HỌC & KHỐI LỚP (Theo ngân hàng câu hỏi) */}
              <div className="p-3 bg-white/90 rounded-xl border border-indigo-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center space-x-2 shrink-0 text-xs font-extrabold text-slate-700">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Chọn Môn &amp; Khối:</span>
                </div>

                {/* Subject Selector */}
                <div className="flex-1 flex items-center space-x-2">
                  <span className="text-xs text-slate-500 font-medium shrink-0">Môn học:</span>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="AUTO">-- Tự nhận diện từ tệp đề --</option>
                    {availableSubjects.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Grade Level Selector */}
                <div className="flex-1 flex items-center space-x-2">
                  <span className="text-xs text-slate-500 font-medium shrink-0">Khối lớp:</span>
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value === 'AUTO' ? 'AUTO' : Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="AUTO">-- Tự nhận diện từ tệp đề --</option>
                    {availableGrades.map((g) => (
                      <option key={g} value={g}>Khối {g}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3-Step Guide */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-indigo-100 text-xs text-slate-700 font-medium">
                <div className="flex items-center space-x-2 bg-white/80 p-2.5 rounded-xl border border-indigo-100">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                  <span>Chọn môn/khối rồi bấm <strong>Sao chép Prompt</strong></span>
                </div>
                <div className="flex items-center space-x-2 bg-white/80 p-2.5 rounded-xl border border-indigo-100">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                  <span>Định dạng tệp theo mẫu chuẩn</span>
                </div>
                <div className="flex items-center space-x-2 bg-white/80 p-2.5 rounded-xl border border-indigo-100">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
                  <span>Dán JSON &amp; chọn thư mục lưu trữ</span>
                </div>
              </div>

              {/* Collapsible Prompt Preview */}
              {showPromptDetails && (
                <div className="pt-2">
                  <div className="text-[11px] font-bold text-slate-600 mb-1 flex items-center justify-between">
                    <span>Nội dung prompt kèm danh mục Chương &amp; Bài ({selectedSubject} - Khối {selectedGrade}):</span>
                    <button 
                      type="button" 
                      onClick={handleCopyPrompt} 
                      className="text-indigo-600 hover:underline flex items-center space-x-1 cursor-pointer font-semibold"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Sao chép</span>
                    </button>
                  </div>
                  <pre className="p-3.5 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-56 leading-relaxed whitespace-pre-wrap select-all">
                    {currentMasterPrompt}
                  </pre>
                </div>
              )}
            </div>

            {/* CẤU HÌNH THƯ MỤC LƯU TRỮ */}
            <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
                  <FolderTree className="w-4 h-4 text-indigo-600" />
                  <span>Cấu hình thư mục lưu trữ câu hỏi</span>
                </div>

                {/* Switch between Auto and Override */}
                <div className="inline-flex rounded-xl p-0.5 bg-slate-200/70 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setStorageMode('auto')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      storageMode === 'auto'
                        ? 'bg-white text-indigo-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tự động theo JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => setStorageMode('override')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      storageMode === 'override'
                        ? 'bg-purple-600 text-white shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Ghi đè thư mục chỉ định
                  </button>
                </div>
              </div>

              {storageMode === 'auto' ? (
                <div className="text-[11px] text-slate-500 flex items-center space-x-1.5 bg-white/80 p-2.5 rounded-xl border border-slate-200/60">
                  <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>Hệ thống sẽ tự động đối chiếu tên Chương &amp; Bài học trong JSON với cây thư mục hiện có để ánh xạ thông minh, giữ nguyên tiền tố chuẩn.</span>
                </div>
              ) : (
                <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200/80 space-y-3 animate-in fade-in">
                  {/* Choose level */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <span className="text-xs font-bold text-purple-950 shrink-0">Cấp độ ghi đè:</span>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-700">
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="overrideLevel"
                          value="chapter"
                          checked={overrideLevel === 'chapter'}
                          onChange={() => setOverrideLevel('chapter')}
                          className="text-purple-600 focus:ring-purple-500"
                        />
                        <span>Chỉ ghi đè Chương (Giữ nguyên Bài từ JSON)</span>
                      </label>
                      <label className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="overrideLevel"
                          value="all"
                          checked={overrideLevel === 'all'}
                          onChange={() => setOverrideLevel('all')}
                          className="text-purple-600 focus:ring-purple-500"
                        />
                        <span>Ghi đè cả Chương &amp; Bài</span>
                      </label>
                    </div>
                  </div>

                  {/* Dropdowns & Custom Typing */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Chapter Target */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-purple-950 flex items-center justify-between">
                        <span>Chương mục tiêu:</span>
                        {availableChapters.length > 0 && (
                          <span className="text-[10px] text-purple-600 font-normal">
                            {availableChapters.length} chương trong danh mục
                          </span>
                        )}
                      </label>
                      <div className="space-y-1.5">
                        {availableChapters.length > 0 && (
                          <select
                            value={availableChapters.includes(overrideChapter) ? overrideChapter : ''}
                            onChange={(e) => {
                              if (e.target.value) setOverrideChapter(e.target.value);
                            }}
                            className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-600"
                          >
                            <option value="">-- Chọn Chương có sẵn trong cây thư mục --</option>
                            {availableChapters.map(ch => (
                              <option key={ch} value={ch}>{ch}</option>
                            ))}
                          </select>
                        )}
                        <input
                          type="text"
                          value={overrideChapter}
                          onChange={(e) => setOverrideChapter(e.target.value)}
                          placeholder="Nhập tên Chương (hoặc chọn từ danh sách trên)..."
                          className="w-full px-3 py-1.5 bg-white border border-purple-200 rounded-xl text-xs text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:border-purple-600"
                        />
                      </div>
                    </div>

                    {/* Lesson Target - only if overrideLevel === 'all' */}
                    {overrideLevel === 'all' && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-purple-950 flex items-center justify-between">
                          <span>Bài học mục tiêu:</span>
                          {availableLessons.length > 0 && (
                            <span className="text-[10px] text-purple-600 font-normal">
                              {availableLessons.length} bài trong chương này
                            </span>
                          )}
                        </label>
                        <div className="space-y-1.5">
                          {availableLessons.length > 0 && (
                            <select
                              value={availableLessons.includes(overrideLesson) ? overrideLesson : ''}
                              onChange={(e) => {
                                if (e.target.value) setOverrideLesson(e.target.value);
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-600"
                            >
                              <option value="">-- Chọn Bài học có sẵn trong chương --</option>
                              {availableLessons.map(les => (
                                <option key={les} value={les}>{les}</option>
                              ))}
                            </select>
                          )}
                          <input
                            type="text"
                            value={overrideLesson}
                            onChange={(e) => setOverrideLesson(e.target.value)}
                            placeholder="Nhập tên Bài học (hoặc chọn từ danh sách trên)..."
                            className="w-full px-3 py-1.5 bg-white border border-purple-200 rounded-xl text-xs text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:border-purple-600"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Error banner if JSON has syntax error */}
            {parseErrorAlert && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-2 animate-in fade-in">
                <div className="font-bold flex items-center space-x-1.5 text-rose-700">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Phát hiện lỗi cú pháp trong chuỗi JSON:</span>
                </div>
                <p className="text-[11px] text-rose-800 font-mono bg-white p-2 rounded-xl border border-rose-100 overflow-x-auto">
                  {parseErrorAlert}
                </p>
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-gray-500">Mẹo: Bấm nút "Sửa lỗi tự động" để hệ thống tự vá các dấu gạch chéo ngược LaTeX hoặc dấu phẩy thừa.</span>
                  <button
                    type="button"
                    onClick={handleAutoFixBackslash}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition cursor-pointer"
                  >
                    Tự động sửa lỗi ngay
                  </button>
                </div>
              </div>
            )}

            {/* JSON TEXTAREA INPUT */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <label className="block text-xs font-bold text-gray-800">
                  Dán chuỗi JSON danh sách câu hỏi vào đây:
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 rounded-lg transition flex items-center space-x-1 cursor-pointer"
                    title="Dán nhanh dữ liệu từ Clipboard"
                  >
                    <Clipboard className="w-3 h-3" />
                    <span>Dán từ Clipboard</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoFixBackslash}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-lg transition flex items-center space-x-1 cursor-pointer"
                    title="Tự động sửa lỗi dấu gạch chéo ngược LaTeX \frac và escape JSON"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>Sửa lỗi tự động</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleFillSample}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-lg transition cursor-pointer"
                    title="Nạp dữ liệu mẫu cả 4 dạng câu hỏi để thử nghiệm"
                  >
                    Nạp JSON mẫu
                  </button>
                  <button
                    type="button"
                    onClick={() => { setJsonInput(''); setParseErrorAlert(null); }}
                    className="px-2 py-1 text-[11px] text-gray-400 hover:text-rose-600 transition cursor-pointer"
                  >
                    Xóa trắng
                  </button>
                </div>
              </div>

              <div className="relative">
                <textarea
                  rows={9}
                  value={jsonInput}
                  onChange={(e) => { setJsonInput(e.target.value); setParseErrorAlert(null); }}
                  placeholder='[\n  {\n    "content": "Cho hàm số $y = x^2 - 4x + 3$...",\n    "question_type": "MULTIPLE_CHOICE",\n    "options": ["$(2; -1)$", "$(-2; -1)$", "$(2; 1)$", "$(1; 0)$"],\n    "correct_option": 0,\n    "subject": "Toán",\n    "grade_level": 10,\n    "chapter": "Hàm số bậc hai",\n    "lesson": "Bài 1: Khái niệm hàm số"\n  }\n]'
                  className="w-full p-3 font-mono text-xs text-slate-800 bg-slate-50/80 border border-slate-200 rounded-2xl focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition"
                />
                {jsonInput && (
                  <div className="absolute right-3 bottom-3 text-[10px] text-slate-500 bg-white/90 px-2 py-0.5 rounded-md border border-slate-200 tabular-nums">
                    {jsonInput.length} ký tự
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleProceedToPreview}
                    disabled={!jsonInput.trim()}
                    className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem trước &amp; Kiểm tra</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFastDirectImport}
                    disabled={!jsonInput.trim() || isSubmitting}
                    className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-xs transition cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang lưu vào ngân hàng...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-amber-200" />
                        <span>Nhập hàng loạt ngay</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 2: PREVIEW & CONFIRM */}
        {/* ======================================================== */}
        {step === 'preview' && (
          <div className="space-y-4">
            {/* Quick Storage Configuration & Switcher in Preview Step */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center space-x-2 text-xs">
                <FolderTree className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-bold text-slate-700">Chế độ lưu trữ:</span>
                <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${
                  storageMode === 'override' 
                    ? 'bg-purple-50 text-purple-700 border-purple-200' 
                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                }`}>
                  {storageMode === 'override' 
                    ? `Ghi đè: ${overrideChapter || '(Chương mặc định)'}${overrideLevel === 'all' ? ' ↳ ' + (overrideLesson || '(Bài mặc định)') : ''}` 
                    : 'Tự động theo JSON (Chuẩn hóa tên Chương/Bài)'}
                </span>
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <button
                  type="button"
                  onClick={() => setStorageMode(storageMode === 'auto' ? 'override' : 'auto')}
                  className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-700 font-semibold transition cursor-pointer flex items-center space-x-1"
                >
                  <Sliders className="w-3 h-3 text-slate-500" />
                  <span>{storageMode === 'auto' ? 'Đổi sang Ghi đè' : 'Đổi sang Tự động'}</span>
                </button>
              </div>
            </div>

            {/* BẢNG XEM TRƯỚC ÁNH XẠ (PREVIEW MAPPING TABLE) */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex items-center space-x-2">
                  <FolderTree className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800">
                      Bảng Xem trước Ánh xạ Thư mục (Preview Mapping)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Chi tiết cách hệ thống phân loại {parsedQuestions.length} câu hỏi theo {previewMapping.length} nhóm Chương &amp; Bài
                    </p>
                  </div>
                </div>

                {/* Badges Counter Summary */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                  {summaryCounts.matched > 0 && (
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {summaryCounts.matched} Khớp thư mục cũ
                    </span>
                  )}
                  {summaryCounts.new > 0 && (
                    <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                      {summaryCounts.new} Tạo thư mục mới
                    </span>
                  )}
                  {summaryCounts.override > 0 && (
                    <span className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
                      {summaryCounts.override} Ghi đè chỉ định
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto max-h-56 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50/70 text-[11px] font-bold text-slate-600 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Thư mục nguồn trong JSON</th>
                      <th className="py-2 px-2 text-center w-8"></th>
                      <th className="py-2 px-3">Thư mục đích hệ thống</th>
                      <th className="py-2 px-3 text-center">Trạng thái ánh xạ</th>
                      <th className="py-2 px-3 text-right">Số lượng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewMapping.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-700">{item.originalChapter}</div>
                          <div className="text-[11px] text-slate-500 font-normal">↳ {item.originalLesson}</div>
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-400">
                          <ArrowRight className="w-3.5 h-3.5 inline-block text-slate-400" />
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-indigo-950">{item.targetChapter}</div>
                          <div className="text-[11px] text-indigo-700 font-medium">↳ {item.targetLesson}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {item.status === 'MATCHED' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Khớp thư mục cũ</span>
                            </span>
                          )}
                          {item.status === 'NEW' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <FolderPlus className="w-3 h-3 text-blue-600" />
                              <span>Tạo thư mục mới</span>
                            </span>
                          )}
                          {item.status === 'OVERRIDE' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              <FolderCheck className="w-3 h-3 text-purple-600" />
                              <span>Ghi đè chỉ định</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="font-bold text-slate-800 tabular-nums">{item.count}</span>
                          <span className="text-[11px] text-slate-400 ml-1">câu</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Warning summary if any */}
            {parseWarnings.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center space-x-1.5 text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Phát hiện {parseWarnings.length} lưu ý định dạng:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800 max-h-24 overflow-y-auto">
                  {parseWarnings.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Questions List */}
            <div className="space-y-3 max-h-[48vh] overflow-y-auto pr-1">
              {parsedQuestions.map((q, qIndex) => {
                const effectiveQ = applyOverridesToQuestion(q, storageMode, overrideLevel, overrideChapter, overrideLesson);
                const typeInfo = QUESTION_TYPE_LABELS[effectiveQ.question_type] || QUESTION_TYPE_LABELS.MULTIPLE_CHOICE;
                const diffInfo = DIFFICULTY_LABELS[effectiveQ.difficulty] || DIFFICULTY_LABELS.THONG_HIEU;

                return (
                  <div 
                    key={qIndex} 
                    className="p-4 bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl space-y-3 transition shadow-2xs"
                  >
                    {/* Header info */}
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center tabular-nums">
                          {qIndex + 1}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${typeInfo.bg}`}>
                          {typeInfo.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${diffInfo.bg}`}>
                          {diffInfo.label}
                        </span>
                        {effectiveQ.subject && (
                          <span className="text-[11px] text-slate-600 font-medium bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                            {effectiveQ.subject} {effectiveQ.grade_level ? `- Lớp ${effectiveQ.grade_level}` : ''}
                          </span>
                        )}
                        <span className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${
                          storageMode === 'override'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {effectiveQ.chapter} {effectiveQ.lesson ? `↳ ${effectiveQ.lesson}` : ''}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveQuestionFromPreview(qIndex)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                        title="Bỏ qua câu này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Question Content */}
                    <div className="text-xs text-slate-800 leading-relaxed font-medium">
                      <MathRenderer content={effectiveQ.content} />
                    </div>

                    {/* Choices for MULTIPLE_CHOICE */}
                    {effectiveQ.question_type === 'MULTIPLE_CHOICE' && Array.isArray(effectiveQ.options) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {effectiveQ.options.map((opt, optIndex) => {
                          const isCorrect = effectiveQ.correct_option === optIndex;
                          const letter = String.fromCharCode(65 + optIndex);
                          return (
                            <button
                              type="button"
                              key={optIndex}
                              onClick={() => handleUpdateCorrectOption(qIndex, optIndex)}
                              className={`flex items-start space-x-2 p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                                isCorrect 
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold' 
                                  : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {letter}
                              </span>
                              <div className="flex-1 overflow-hidden">
                                <MathRenderer content={opt} />
                              </div>
                              {isCorrect && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Sub-questions for TRUE_FALSE */}
                    {effectiveQ.question_type === 'TRUE_FALSE' && Array.isArray(effectiveQ.sub_questions) && (
                      <div className="space-y-1.5 pt-1">
                        {effectiveQ.sub_questions.map((sub, sIdx) => {
                          const letter = String.fromCharCode(97 + sIdx); // a, b, c, d
                          return (
                            <div 
                              key={sIdx} 
                              className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-xs"
                            >
                              <div className="flex items-start space-x-2 flex-1 pr-2">
                                <span className="font-bold text-slate-500 shrink-0">{letter})</span>
                                <div className="text-slate-800">
                                  <MathRenderer content={sub.statement} />
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 ${
                                sub.answer 
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}>
                                {sub.answer ? 'ĐÚNG' : 'SAI'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* SHORT_ANSWER info */}
                    {effectiveQ.question_type === 'SHORT_ANSWER' && (
                      <div className="p-2.5 bg-amber-50/60 border border-amber-200/60 rounded-xl text-xs flex items-center space-x-2">
                        <span className="font-semibold text-amber-800">Đáp án chính xác:</span>
                        <code className="bg-amber-100 px-2 py-0.5 rounded text-amber-900 font-bold font-mono">
                          {effectiveQ.correct_answer || '(Chưa có)'}
                        </code>
                      </div>
                    )}

                    {/* Explanation */}
                    {effectiveQ.explanation && (
                      <div className="p-2.5 bg-indigo-50/40 border border-indigo-100 rounded-xl text-[11px] text-slate-600">
                        <span className="font-semibold text-indigo-700 mr-1">Lời giải:</span>
                        <MathRenderer content={effectiveQ.explanation} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Step 2 Actions */}
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setStep('input')}
                className="flex items-center space-x-1.5 px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại dán JSON</span>
              </button>

              <div className="flex items-center space-x-3">
                <span className="text-xs text-gray-500">
                  Sẵn sàng nhập <strong>{parsedQuestions.length}</strong> câu hỏi
                </span>
                <button
                  type="button"
                  disabled={isSubmitting || !parsedQuestions.length}
                  onClick={handleFinalImport}
                  className="flex items-center space-x-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu vào ngân hàng...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Xác nhận Nhập vào Ngân hàng</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
