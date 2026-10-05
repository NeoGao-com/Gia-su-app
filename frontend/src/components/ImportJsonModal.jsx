import React, { useState, useMemo, useEffect } from 'react';
import { 
  Sparkles, Copy, Check, AlertCircle, CheckCircle2, Trash2, 
  ArrowLeft, RefreshCw, Eye, FileCode2, Info, ArrowRight, 
  ChevronDown, ChevronUp, Zap, Clipboard, Wand2, BookOpen, Layers
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

// MASTER PROMPT DYNAMICALLY GENERATED FROM CHOSEN SUBJECT & GRADE
export function generateMasterFilePrompt(subject = 'Toán', grade = 10) {
  const isAutoSubj = subject === 'AUTO';
  const isAutoGrade = grade === 'AUTO';

  const subjLine = isAutoSubj 
    ? '- Môn học: Tự nhận diện môn học theo nội dung tệp đính kèm'
    : `- Môn học mục tiêu: "${subject}" (Gán "subject": "${subject}" cho toàn bộ các câu hỏi)`;

  const gradeLine = isAutoGrade
    ? '- Khối lớp: Tự nhận diện khối lớp theo nội dung tệp đính kèm'
    : `- Khối lớp mục tiêu: Lớp ${grade} (Gán "grade_level": ${grade} cho toàn bộ các câu hỏi)`;

  return `Bạn là một trợ lý AI chuyên nghiệp về khảo thí và trích xuất dữ liệu đề thi.
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
- "chapter": "Tên chương hoặc chủ đề kiến thức lớn (ví dụ: 'Mệnh đề và tập hợp')".
- "lesson": "Tên bài học cụ thể (ví dụ: 'Bài 1: Mệnh đề', nếu không có ghi 'Bài chung')".
- "topic": "Dạng bài học hoặc chuyên đề nhỏ (ví dụ: 'Dạng 1: Nhận biết mệnh đề', nếu không có ghi 'Dạng chung')".
- "explanation": Lời giải thích chi tiết từng bước bằng công thức LaTeX.

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
    throw new Error('Vui lòng dán chuỗi JSON kết quả từ AI.');
  }

  const trimmed = rawText.trim();

  if (!trimmed.includes('{') && !trimmed.includes('[')) {
    throw new Error('Văn bản bạn vừa dán không phải là mã JSON! Hãy gửi đề thi của bạn cho AI kèm Prompt mẫu, sau đó sao chép kết quả JSON do AI tạo ra để dán vào đây.');
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

  useEffect(() => {
    if (selectedCategory?.subject) setSelectedSubject(selectedCategory.subject);
    if (selectedCategory?.grade_level) setSelectedGrade(Number(selectedCategory.grade_level));
  }, [selectedCategory]);

  // Master Prompt text generated dynamically
  const currentMasterPrompt = useMemo(() => {
    return generateMasterFilePrompt(selectedSubject, selectedGrade);
  }, [selectedSubject, selectedGrade]);

  // Raw JSON input
  const [jsonInput, setJsonInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parseErrorAlert, setParseErrorAlert] = useState(null);

  // Parsed questions
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [parseWarnings, setParseWarnings] = useState([]);

  if (!isOpen) return null;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(currentMasterPrompt);
      setCopiedPrompt(true);
      toast.success(`Đã sao chép Prompt cho [${selectedSubject === 'AUTO' ? 'Tự nhận diện' : selectedSubject} - ${selectedGrade === 'AUTO' ? 'Tự nhận diện' : 'Lớp ' + selectedGrade}]! Hãy dán vào AI cùng tệp.`);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = currentMasterPrompt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedPrompt(true);
      toast.success('Đã sao chép Prompt AI thành công!');
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

  // FAST DIRECT BULK IMPORT (1-Click)
  const handleFastDirectImport = async () => {
    if (!jsonInput.trim()) {
      toast.error('Vui lòng dán chuỗi JSON kết quả từ AI vào ô bên dưới.');
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
      
      const res = await api.post('/questions/import-json', { questions: normalized });
      toast.success(res.data?.message || `Đã nhập hàng loạt ${normalized.length} câu hỏi vào ngân hàng thành công!`);
      
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
  const handleProceedToPreview = () => {
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

  const handleFinalImport = async () => {
    if (!parsedQuestions.length) {
      toast.error('Không có câu hỏi nào để nhập.');
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await api.post('/questions/import-json', { questions: parsedQuestions });
      toast.success(res.data?.message || `Đã nhập ${parsedQuestions.length} câu hỏi thành công!`);
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
      title="Nhập câu hỏi hàng loạt bằng JSON (Chuẩn hóa cho AI đọc tệp)"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-2xl">
          <div className="flex items-center space-x-3 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setStep('input')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl transition ${
                step === 'input' 
                  ? 'bg-pastel-purple text-white shadow-xs font-bold' 
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Bước 1: Chọn Môn / Khối &amp; Lấy Prompt</span>
            </button>
            <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
            <button
              type="button"
              disabled={!parsedQuestions.length && step !== 'preview'}
              onClick={() => parsedQuestions.length && setStep('preview')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl transition ${
                step === 'preview' 
                  ? 'bg-pastel-purple text-white shadow-xs font-bold' 
                  : 'bg-white text-gray-400 hover:text-gray-600 disabled:opacity-50 border border-gray-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Bước 2: Xem trước &amp; Xác nhận ({parsedQuestions.length || 0} câu)</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center space-x-1.5 text-xs text-pastel-purpleDark bg-purple-50 px-3 py-1 rounded-xl border border-purple-100 font-bold">
            <BookOpen className="w-3.5 h-3.5" />
            <span>{selectedSubject === 'AUTO' ? 'Tự nhận diện' : selectedSubject} • {selectedGrade === 'AUTO' ? 'Mọi khối' : `Khối ${selectedGrade}`}</span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* STEP 1: PROMPT AI & JSON INPUT */}
        {/* ======================================================== */}
        {step === 'input' && (
          <div className="space-y-4">
            {/* MASTER FILE AI PROMPT BANNER */}
            <div className="p-4 sm:p-5 bg-gradient-to-br from-purple-50/95 via-indigo-50/60 to-white border border-purple-200/90 rounded-3xl space-y-3.5 shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="space-y-1">
                  <div className="text-xs sm:text-sm font-extrabold text-pastel-purpleDark flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-pastel-purple" />
                    <span>Prompt AI Master: Dùng khi tải file đề lên ChatGPT / Claude / Gemini / DeepSeek</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    AI sẽ đọc file tài liệu, giải bài và trích xuất thành mảng JSON đúng chuẩn môn học và khối lớp bạn chỉ định.
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowPromptDetails(!showPromptDetails)}
                    className="flex-1 sm:flex-none flex items-center justify-center space-x-1 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-xs font-semibold transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-gray-500" />
                    <span>{showPromptDetails ? 'Thu gọn' : 'Xem nội dung'}</span>
                    {showPromptDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-pastel-purple to-pastel-purpleDark hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-sm transition"
                    title="Bấm để sao chép Prompt dán cùng file lên AI"
                  >
                    {copiedPrompt ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedPrompt ? 'Đã sao chép Prompt!' : 'Sao chép Prompt gửi AI'}</span>
                  </button>
                </div>
              </div>

              {/* DYNAMIC SELECTORS: MÔN HỌC & KHỐI LỚP (Theo ngân hàng câu hỏi) */}
              <div className="p-3 bg-white/90 rounded-2xl border border-purple-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center space-x-2 shrink-0 text-xs font-extrabold text-gray-700">
                  <Layers className="w-4 h-4 text-pastel-purpleDark" />
                  <span>Chọn Môn &amp; Khối:</span>
                </div>

                {/* Subject Selector */}
                <div className="flex-1 flex items-center space-x-2">
                  <span className="text-xs text-gray-500 font-medium shrink-0">Môn học:</span>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-pastel-purple"
                  >
                    <option value="AUTO">-- Tự nhận diện từ tệp đề --</option>
                    {availableSubjects.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Grade Level Selector */}
                <div className="flex-1 flex items-center space-x-2">
                  <span className="text-xs text-gray-500 font-medium shrink-0">Khối lớp:</span>
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value === 'AUTO' ? 'AUTO' : Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-pastel-purple"
                  >
                    <option value="AUTO">-- Tự nhận diện từ tệp đề --</option>
                    {availableGrades.map((g) => (
                      <option key={g} value={g}>Khối {g}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3-Step Guide */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-purple-100 text-xs text-gray-700 font-medium">
                <div className="flex items-center space-x-2 bg-white/80 p-2.5 rounded-xl border border-purple-100">
                  <span className="w-5 h-5 rounded-full bg-pastel-purple text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
                  <span>Chọn môn/khối rồi bấm <strong>Sao chép Prompt</strong></span>
                </div>
                <div className="flex items-center space-x-2 bg-white/80 p-2.5 rounded-xl border border-purple-100">
                  <span className="w-5 h-5 rounded-full bg-pastel-purple text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
                  <span>Tải file lên AI &amp; dán Prompt gửi đi</span>
                </div>
                <div className="flex items-center space-x-2 bg-white/80 p-2.5 rounded-xl border border-purple-100">
                  <span className="w-5 h-5 rounded-full bg-pastel-purple text-white text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
                  <span>Copy JSON dán vào ô dưới &amp; bấm Nhập</span>
                </div>
              </div>

              {/* Collapsible Prompt Preview */}
              {showPromptDetails && (
                <div className="pt-2">
                  <div className="text-[11px] font-bold text-gray-600 mb-1 flex items-center justify-between">
                    <span>Nội dung Prompt gửi cho AI (Đã gắn Môn: {selectedSubject}, Khối: {selectedGrade}):</span>
                    <button 
                      type="button" 
                      onClick={handleCopyPrompt} 
                      className="text-pastel-purpleDark hover:underline flex items-center space-x-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Sao chép</span>
                    </button>
                  </div>
                  <pre className="p-3.5 bg-gray-900 text-gray-100 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-56 leading-relaxed whitespace-pre-wrap select-all">
                    {currentMasterPrompt}
                  </pre>
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
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition"
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
                  Dán chuỗi JSON kết quả từ AI vào đây:
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 rounded-lg transition flex items-center space-x-1"
                    title="Dán nhanh dữ liệu từ Clipboard"
                  >
                    <Clipboard className="w-3 h-3" />
                    <span>Dán từ Clipboard</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoFixBackslash}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-lg transition flex items-center space-x-1"
                    title="Tự động sửa lỗi dấu gạch chéo ngược LaTeX \frac và escape JSON"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>Sửa lỗi tự động</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleFillSample}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-lg transition"
                    title="Nạp dữ liệu mẫu cả 4 dạng câu hỏi để thử nghiệm"
                  >
                    Nạp JSON mẫu
                  </button>
                  <button
                    type="button"
                    onClick={() => { setJsonInput(''); setParseErrorAlert(null); }}
                    className="px-2 py-1 text-[11px] text-gray-400 hover:text-rose-600 transition"
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
                  placeholder='[\n  {\n    "content": "Cho hàm số $y = x^2 - 4x + 3$...",\n    "question_type": "MULTIPLE_CHOICE",\n    "options": ["$(2; -1)$", "$(-2; -1)$", "$(2; 1)$", "$(1; 0)$"],\n    "correct_option": 0,\n    "subject": "Toán",\n    "grade_level": 10\n  }\n]'
                  className="w-full p-3 font-mono text-xs text-gray-800 bg-gray-50/80 border border-gray-200 rounded-2xl focus:outline-none focus:border-pastel-purple focus:bg-white transition"
                />
                {jsonInput && (
                  <div className="absolute right-3 bottom-3 text-[10px] text-gray-400 bg-white/90 px-2 py-0.5 rounded-md border border-gray-200">
                    {jsonInput.length} ký tự
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition"
                >
                  Hủy bỏ
                </button>

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleProceedToPreview}
                    disabled={!jsonInput.trim()}
                    className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-bold transition disabled:opacity-50"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem trước &amp; Kiểm tra</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFastDirectImport}
                    disabled={!jsonInput.trim() || isSubmitting}
                    className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-sm transition"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang lưu vào ngân hàng...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-yellow-300" />
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
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {parsedQuestions.map((q, qIndex) => {
                const typeInfo = QUESTION_TYPE_LABELS[q.question_type] || QUESTION_TYPE_LABELS.MULTIPLE_CHOICE;
                const diffInfo = DIFFICULTY_LABELS[q.difficulty] || DIFFICULTY_LABELS.THONG_HIEU;

                return (
                  <div 
                    key={qIndex} 
                    className="p-4 bg-white border border-gray-200 hover:border-purple-200 rounded-2xl space-y-3 transition shadow-2xs"
                  >
                    {/* Header info */}
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-lg bg-pastel-purple/10 text-pastel-purpleDark text-xs font-bold flex items-center justify-center">
                          {qIndex + 1}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${typeInfo.bg}`}>
                          {typeInfo.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${diffInfo.bg}`}>
                          {diffInfo.label}
                        </span>
                        {q.subject && (
                          <span className="text-[11px] text-gray-500 font-medium bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                            {q.subject} {q.grade_level ? `- Lớp ${q.grade_level}` : ''}
                          </span>
                        )}
                        {q.chapter && (
                          <span className="text-[11px] text-gray-400">
                            • {q.chapter}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveQuestionFromPreview(qIndex)}
                        className="text-gray-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition"
                        title="Bỏ qua câu này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Question Content */}
                    <div className="text-xs text-gray-800 leading-relaxed font-medium">
                      <MathRenderer content={q.content} />
                    </div>

                    {/* Choices for MULTIPLE_CHOICE */}
                    {q.question_type === 'MULTIPLE_CHOICE' && Array.isArray(q.options) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {q.options.map((opt, optIndex) => {
                          const isCorrect = q.correct_option === optIndex;
                          const letter = String.fromCharCode(65 + optIndex);
                          return (
                            <button
                              type="button"
                              key={optIndex}
                              onClick={() => handleUpdateCorrectOption(qIndex, optIndex)}
                              className={`flex items-start space-x-2 p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                                isCorrect 
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold' 
                                  : 'bg-gray-50/70 border-gray-200 text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                isCorrect ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'
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
                    {q.question_type === 'TRUE_FALSE' && Array.isArray(q.sub_questions) && (
                      <div className="space-y-1.5 pt-1">
                        {q.sub_questions.map((sub, sIdx) => {
                          const letter = String.fromCharCode(97 + sIdx); // a, b, c, d
                          return (
                            <div 
                              key={sIdx} 
                              className="flex items-center justify-between p-2 rounded-xl bg-gray-50 border border-gray-100 text-xs"
                            >
                              <div className="flex items-start space-x-2 flex-1 pr-2">
                                <span className="font-bold text-gray-500 shrink-0">{letter})</span>
                                <div className="text-gray-800">
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
                    {q.question_type === 'SHORT_ANSWER' && (
                      <div className="p-2.5 bg-amber-50/60 border border-amber-200/60 rounded-xl text-xs flex items-center space-x-2">
                        <span className="font-semibold text-amber-800">Đáp án chính xác:</span>
                        <code className="bg-amber-100 px-2 py-0.5 rounded text-amber-900 font-bold font-mono">
                          {q.correct_answer || '(Chưa có)'}
                        </code>
                      </div>
                    )}

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="p-2.5 bg-purple-50/50 border border-purple-100 rounded-xl text-[11px] text-gray-600">
                        <span className="font-semibold text-pastel-purpleDark mr-1">Lời giải:</span>
                        <MathRenderer content={q.explanation} />
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
                className="flex items-center space-x-1.5 px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
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
                  className="flex items-center space-x-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition"
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
