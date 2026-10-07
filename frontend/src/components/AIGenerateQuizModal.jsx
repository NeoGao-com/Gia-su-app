import React, { useState, useRef } from 'react';
import { 
  Sparkles, FileText, Upload, Check, Trash2, Edit3, 
  ChevronRight, ArrowLeft, Loader2, Wand2, BookOpen, 
  Layers, CheckCircle2, AlertCircle, RefreshCw, Eye
} from 'lucide-react';
import api from '../api/axios';
import { Modal } from './Modal';
import { MathRenderer } from './MathRenderer';
import { useToast } from '../context/ToastContext';

const QUESTION_TYPES = [
  { id: 'MULTIPLE_CHOICE', label: 'Trắc nghiệm (4 phương án)' },
  { id: 'TRUE_FALSE', label: 'Đúng / Sai (4 ý chuẩn mới)' },
  { id: 'SHORT_ANSWER', label: 'Trả lời ngắn / Điền số' },
  { id: 'ESSAY', label: 'Tự luận (Kèm đáp án mẫu)' },
];

const QUESTION_TYPE_LABELS = {
  MULTIPLE_CHOICE: { label: 'Trắc nghiệm', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  TRUE_FALSE: { label: 'Đúng / Sai', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  SHORT_ANSWER: { label: 'Điền từ / Ngắn', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  ESSAY: { label: 'Tự luận', bg: 'bg-sky-50 text-sky-700 border-sky-200' },
};

const DIFFICULTY_LABELS = {
  NHAN_BIET: { label: 'Nhận biết', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  THONG_HIEU: { label: 'Thông hiểu', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  VAN_DUNG: { label: 'Vận dụng', bg: 'bg-orange-50 text-orange-700 border-orange-200' },
  VAN_DUNG_CAO: { label: 'Vận dụng cao', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const SAMPLE_PROMPTS = [
  {
    title: 'Toán 10 - Vectơ và phép toán',
    subject: 'Toán',
    grade: 10,
    text: `Chương: Vectơ và các phép toán trên vectơ.
Định nghĩa: Vectơ là một đoạn thẳng có hướng. Hai vectơ cùng phương nếu giá của chúng song song hoặc trùng nhau.
Các phép toán: Quy tắc 3 điểm (AB + BC = AC), quy tắc hình bình hành. Tích của vectơ với một số: k*a cùng hướng khi k > 0, ngược hướng khi k < 0.
Tích vô hướng: a . b = |a| * |b| * cos(a, b). Hai vectơ vuông góc khi tích vô hướng bằng 0.`
  },
  {
    title: 'Vật lý 11 - Khúc xạ ánh sáng',
    subject: 'Vật lí',
    grade: 11,
    text: `Định luật khúc xạ ánh sáng:
1. Tia khúc xạ nằm trong mặt phẳng tới và ở phía bên kia pháp tuyến so với tia tới.
2. Với hai môi trường trong suốt nhất định, tỉ số giữa sin góc tới (sin i) và sin góc khúc xạ (sin r) luôn không đổi: sin i / sin r = n21 = n2 / n1.
Hiện tượng phản xạ toàn phần xảy ra khi ánh sáng truyền từ môi trường chiết quang hơn sang môi trường chiết quang kém và góc tới i >= igh (với sin igh = n2 / n1).`
  },
  {
    title: 'Hóa học 12 - Este & Lipit',
    subject: 'Hóa học',
    grade: 12,
    text: `Khái niệm Este: Khi thay nhóm OH ở nhóm cacboxyl của axit cacboxylic bằng nhóm OR thì được este.
Công thức phân tử este no đơn chức, mạch hở: CnH2nO2 (n >= 2).
Tính chất hóa học: Phản ứng thủy phân trong môi trường axit (thuận nghịch) và thủy phân trong môi trường kiềm (phản ứng xà phòng hóa, một chiều sinh muối và ancol).
Chất béo (trigixerit) là trieste của glixerol với các axit béo: axit panmitic (C15H31COOH), axit stearic (C17H35COOH), axit oleic (C17H33COOH).`
  },
  {
    title: 'Tiếng Anh 10 - Thì & Câu điều kiện',
    subject: 'Tiếng Anh',
    grade: 10,
    text: `Grammar Focus:
1. Present Perfect vs Past Simple: Present perfect expresses experiences or actions occurring at an unspecified time with present results (have/has + V3/ed). Past simple describes finished actions in the past with specific time words (yesterday, in 2020).
2. Conditional Sentences:
- Type 1: Real in the present/future: If + S + V(present simple), S + will + V(bare).
- Type 2: Unreal in the present: If + S + V(past simple/were), S + would + V(bare).`
  }
];

export function AIGenerateQuizModal({ isOpen, onClose, onSuccess, defaultSubject = 'Toán', defaultGrade = 10 }) {
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  // Steps: 'input' | 'review'
  const [step, setStep] = useState('input');
  const [inputMode, setInputMode] = useState('text'); // 'text' | 'file'

  // Input data
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isFileReading, setIsFileReading] = useState(false);

  // Generation options
  const [subject, setSubject] = useState(defaultSubject);
  const [gradeLevel, setGradeLevel] = useState(defaultGrade);
  const [chapter, setChapter] = useState('');
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState('MIXED');
  const [selectedTypes, setSelectedTypes] = useState(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER']);

  // Loading & Generation State
  const [isGenerating, setIsGenerating] = useState(false);

  // Review & Save State
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingForm, setEditingForm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const resetState = () => {
    setStep('input');
    setInputMode('text');
    setInputText('');
    setSelectedFile(null);
    setIsGenerating(false);
    setIsSaving(false);
    setGeneratedQuestions([]);
    setSelectedIndices(new Set());
    setEditingIndex(null);
    setEditingForm(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const toggleQuestionType = (typeId) => {
    setSelectedTypes(prev => {
      if (prev.includes(typeId)) {
        if (prev.length === 1) {
          toast.warning('Phải chọn ít nhất 1 dạng câu hỏi');
          return prev;
        }
        return prev.filter(t => t !== typeId);
      }
      return [...prev, typeId];
    });
  };

  const handleApplyPreset = (preset) => {
    setSubject(preset.subject);
    setGradeLevel(preset.grade);
    setInputText(preset.text);
    setInputMode('text');
    toast.info(`Đã áp dụng mẫu: ${preset.title}`);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.docx', '.doc', '.pdf', '.md', '.markdown', '.txt'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      toast.error('Chỉ hỗ trợ tệp Word (.docx, .doc), PDF (.pdf), Markdown (.md), hoặc Text (.txt)');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('Dung lượng tệp không được vượt quá 25MB');
      return;
    }

    setSelectedFile(file);

    // Extract text from file using backend endpoint
    try {
      setIsFileReading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('subject', subject);
      formData.append('grade_level', String(gradeLevel));
      formData.append('use_ai', 'false'); // extract raw text only

      const res = await api.post('/ai/extract-from-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.text_preview) {
        toast.success(`Đã đọc tệp: ${file.name} (${res.data.total_chars || 0} ký tự)`);
      }
    } catch (err) {
      console.warn('File quick preview error:', err);
    } finally {
      setIsFileReading(false);
    }
  };

  const handleStartGenerate = async () => {
    let rawContent = inputText.trim();

    if (inputMode === 'file') {
      if (!selectedFile) {
        toast.warning('Vui lòng chọn hoặc tải lên tệp tài liệu');
        return;
      }
    } else {
      if (!rawContent) {
        toast.warning('Vui lòng dán nội dung bài học hoặc chọn một chủ đề mẫu');
        return;
      }
    }

    try {
      setIsGenerating(true);

      let questions = [];

      if (inputMode === 'file' && selectedFile) {
        // Use file extraction endpoint
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('subject', subject);
        formData.append('grade_level', String(gradeLevel));
        if (chapter) formData.append('chapter', chapter);
        formData.append('use_ai', 'true');

        const res = await api.post('/ai/extract-from-file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        questions = res.data?.questions || [];
      } else {
        // Use generate-from-text endpoint
        const res = await api.post('/ai/generate-from-text', {
          text: rawContent,
          subject,
          grade_level: Number(gradeLevel),
          chapter: chapter.trim() || undefined,
          count: Number(count),
          question_types: selectedTypes,
          difficulty: difficulty === 'MIXED' ? undefined : difficulty
        });
        questions = res.data?.questions || [];
      }

      if (!questions || questions.length === 0) {
        toast.error('AI không thể tạo câu hỏi từ tài liệu này. Vui lòng thử lại với nội dung chi tiết hơn.');
        return;
      }

      setGeneratedQuestions(questions);
      setSelectedIndices(new Set(questions.map((_, i) => i)));
      setStep('review');
      toast.success(`AI đã soạn thành công ${questions.length} câu hỏi chất lượng!`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Lỗi khi gọi AI soạn câu hỏi. Vui lòng kiểm tra lại cấu hình AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedIndices.size === generatedQuestions.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(generatedQuestions.map((_, i) => i)));
    }
  };

  const handleToggleIndex = (idx) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleDeleteQuestion = (idx) => {
    const nextList = generatedQuestions.filter((_, i) => i !== idx);
    setGeneratedQuestions(nextList);
    setSelectedIndices(prev => {
      const next = new Set();
      nextList.forEach((_, newIdx) => {
        if (newIdx < idx && prev.has(newIdx)) next.add(newIdx);
        else if (newIdx >= idx && prev.has(newIdx + 1)) next.add(newIdx);
      });
      return next;
    });
    if (editingIndex === idx) {
      setEditingIndex(null);
      setEditingForm(null);
    }
  };

  const handleStartEdit = (idx) => {
    setEditingIndex(idx);
    setEditingForm(JSON.parse(JSON.stringify(generatedQuestions[idx])));
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !editingForm) return;
    setGeneratedQuestions(prev => prev.map((q, i) => i === editingIndex ? editingForm : q));
    setEditingIndex(null);
    setEditingForm(null);
    toast.success('Đã cập nhật câu hỏi!');
  };

  const handleSaveToBank = async () => {
    const toImport = generatedQuestions.filter((_, idx) => selectedIndices.has(idx));
    if (toImport.length === 0) {
      toast.warning('Vui lòng chọn ít nhất 1 câu hỏi để lưu vào Ngân hàng');
      return;
    }

    try {
      setIsSaving(true);
      const normalized = toImport.map(q => ({
        content: q.content,
        question_type: q.question_type || 'MULTIPLE_CHOICE',
        options: q.options || (q.question_type === 'MULTIPLE_CHOICE' ? ['A', 'B', 'C', 'D'] : null),
        correct_option: q.correct_option !== undefined ? q.correct_option : null,
        correct_answer: q.correct_answer || null,
        sub_questions: q.sub_questions || null,
        sample_solution: q.sample_solution || null,
        explanation: q.explanation || '',
        subject: q.subject || subject,
        grade_level: q.grade_level ? Number(q.grade_level) : Number(gradeLevel),
        chapter: q.chapter || chapter || 'Kiến thức chung',
        difficulty: q.difficulty || 'THONG_HIEU'
      }));

      const res = await api.post('/questions/batch', { questions: normalized });
      toast.success(res.data?.message || `Đã lưu ${normalized.length} câu hỏi vào Ngân hàng!`);
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể lưu câu hỏi vào hệ thống');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="🤖 AI Soạn Đề & Ngân Hàng Câu Hỏi Thông Minh"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-5">
        {/* Step Indicator */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-indigo-50/80 rounded-xl border border-indigo-100/90 text-xs font-semibold text-slate-700">
          <div className="flex items-center space-x-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step === 'input' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'
            }`}>
              {step === 'input' ? '1' : <Check className="w-3.5 h-3.5" />}
            </span>
            <span className={step === 'input' ? 'text-indigo-700 font-bold' : 'text-slate-700'}>
              Cấu hình &amp; Tài liệu đầu vào
            </span>
          </div>

          <ChevronRight className="w-4 h-4 text-slate-400" />

          <div className="flex items-center space-x-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step === 'review' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              2
            </span>
            <span className={step === 'review' ? 'text-indigo-700 font-bold' : 'text-slate-400'}>
              Duyệt &amp; Lưu câu hỏi ({generatedQuestions.length})
            </span>
          </div>
        </div>

        {/* STEP 1: INPUT & CONFIG */}
        {step === 'input' && (
          <div className="space-y-5">
            {/* Subject, Grade & Count Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Môn học</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  {['Toán', 'Vật lí', 'Hóa học', 'Sinh học', 'Ngữ văn', 'Tiếng Anh', 'Lịch sử', 'Địa lí', 'Tin học', 'GDCD'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Khối lớp</label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  {[6, 7, 8, 9, 10, 11, 12].map(g => (
                    <option key={g} value={g}>Khối {g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số lượng câu</label>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  <option value={3}>3 câu (Xem thử)</option>
                  <option value={5}>5 câu (Cơ bản)</option>
                  <option value={10}>10 câu (Tiêu chuẩn)</option>
                  <option value={15}>15 câu (Đề 30 phút)</option>
                  <option value={20}>20 câu (Đề 45 phút)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Độ khó mong muốn</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="MIXED">Hỗn hợp cân đối (Ma trận)</option>
                  <option value="NHAN_BIET">Nhận biết (Cơ bản)</option>
                  <option value="THONG_HIEU">Thông hiểu</option>
                  <option value="VAN_DUNG">Vận dụng</option>
                  <option value="VAN_DUNG_CAO">Vận dụng cao (Điểm 9-10)</option>
                </select>
              </div>
            </div>

            {/* Question Types Checkboxes */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
              <label className="block text-xs font-bold text-slate-700">Dạng câu hỏi muốn tạo:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {QUESTION_TYPES.map(t => {
                  const isChecked = selectedTypes.includes(t.id);
                  return (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => toggleQuestionType(t.id)}
                      className={`flex items-center space-x-2 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        isChecked 
                          ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 font-bold' 
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                        isChecked ? 'bg-indigo-600 text-white' : 'border border-slate-300 bg-white'
                      }`}>
                        {isChecked && <Check className="w-3 h-3" />}
                      </div>
                      <span className="text-xs truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Input Mode Toggle: Text vs File */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setInputMode('text')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                      inputMode === 'text'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Dán văn bản / Bài giảng</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputMode('file')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                      inputMode === 'file'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Tải tệp tài liệu (Word/PDF)</span>
                  </button>
                </div>

                {inputMode === 'text' && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    {inputText.length} ký tự
                  </span>
                )}
              </div>

              {/* Mode: TEXT */}
              {inputMode === 'text' && (
                <div className="space-y-3">
                  <textarea
                    rows={8}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Dán tóm tắt lý thuyết, nội dung bài giảng, đoạn văn đọc hiểu, hoặc các dạng bài tập cần AI phân tích và tự động tạo đề thi (Hỗ trợ công thức Toán/Lý/Hóa $...$)..."
                    className="w-full p-3.5 bg-white border border-slate-300 rounded-2xl text-xs font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 leading-relaxed font-sans shadow-inner"
                  />

                  {/* Quick sample prompt chips */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-500 flex items-center space-x-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Chủ đề gợi ý sẵn:</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {SAMPLE_PROMPTS.map((p, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleApplyPreset(p)}
                          className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 rounded-lg text-[11px] font-medium transition cursor-pointer"
                        >
                          {p.title}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Mode: FILE */}
              {inputMode === 'file' && (
                <div className="space-y-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".docx,.doc,.pdf,.md,.markdown,.txt"
                    className="hidden"
                  />

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-8 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl bg-indigo-50/30 hover:bg-indigo-50/60 transition text-center cursor-pointer space-y-3"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto shadow-2xs">
                      {isFileReading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        {selectedFile ? selectedFile.name : 'Nhấn để chọn tệp tài liệu bài học'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Hỗ trợ Microsoft Word (.docx, .doc), PDF (.pdf), Markdown (.md), Text (.txt) tối đa 25MB
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end items-center space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleStartGenerate}
                className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                <span>{isGenerating ? 'AI đang đọc & sinh câu hỏi...' : '🤖 Bắt đầu AI Soạn Đề'}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: REVIEW & EDIT */}
        {step === 'review' && (
          <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  {selectedIndices.size === generatedQuestions.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
                <span className="text-xs text-slate-500">
                  Đã chọn <strong className="text-indigo-600 font-bold">{selectedIndices.size}</strong> / {generatedQuestions.length} câu hỏi
                </span>
              </div>

              <button
                type="button"
                onClick={() => setStep('input')}
                className="flex items-center space-x-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Soạn thêm nội dung khác</span>
              </button>
            </div>

            {/* Questions List */}
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {generatedQuestions.map((q, idx) => {
                const isSelected = selectedIndices.has(idx);
                const typeInfo = QUESTION_TYPE_LABELS[q.question_type] || QUESTION_TYPE_LABELS.MULTIPLE_CHOICE;
                const diffInfo = DIFFICULTY_LABELS[q.difficulty] || DIFFICULTY_LABELS.THONG_HIEU;

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition-all ${
                      isSelected 
                        ? 'bg-white border-indigo-200 shadow-2xs' 
                        : 'bg-slate-50/60 border-slate-200 opacity-60'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-center space-x-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleIndex(idx)}
                          className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                        />
                        <span className="text-xs font-extrabold text-slate-900">
                          Câu {idx + 1}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${typeInfo.bg}`}>
                          {typeInfo.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${diffInfo.bg}`}>
                          {diffInfo.label}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(idx)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                          title="Chỉnh sửa câu hỏi này"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Xóa câu hỏi này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="text-xs text-slate-800 leading-relaxed mb-3">
                      <MathRenderer content={q.content} />
                    </div>

                    {/* Options for MULTIPLE_CHOICE */}
                    {q.question_type === 'MULTIPLE_CHOICE' && Array.isArray(q.options) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                        {q.options.map((opt, optIdx) => {
                          const isCorrect = q.correct_option === optIdx;
                          return (
                            <div
                              key={optIdx}
                              className={`p-2.5 rounded-xl border text-xs flex items-center space-x-2 ${
                                isCorrect 
                                  ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-semibold' 
                                  : 'bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <div className="flex-1 truncate">
                                <MathRenderer content={opt} />
                              </div>
                              {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Sub-questions for TRUE_FALSE */}
                    {q.question_type === 'TRUE_FALSE' && Array.isArray(q.sub_questions) && (
                      <div className="space-y-1.5 mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                        {q.sub_questions.map((sub, sIdx) => (
                          <div key={sIdx} className="flex items-center justify-between gap-2 py-1 border-b last:border-0 border-slate-200/60">
                            <span className="text-slate-800 flex-1">
                              <strong>{String.fromCharCode(97 + sIdx)})</strong> <MathRenderer content={sub.statement} />
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                              sub.answer ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {sub.answer ? 'ĐÚNG' : 'SAI'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* SHORT_ANSWER */}
                    {q.question_type === 'SHORT_ANSWER' && (
                      <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-xl mb-3 text-xs flex items-center space-x-2 text-amber-900">
                        <span className="font-bold">Đáp án chính xác:</span>
                        <code className="px-2 py-0.5 bg-amber-100 rounded font-mono font-bold">
                          {q.correct_answer || '(Chưa có)'}
                        </code>
                      </div>
                    )}

                    {/* ESSAY */}
                    {q.question_type === 'ESSAY' && q.sample_solution && (
                      <div className="p-2.5 bg-sky-50/60 border border-sky-200 rounded-xl mb-3 text-xs text-sky-950 space-y-1">
                        <span className="font-bold block text-sky-800">Hướng dẫn chấm &amp; Lời giải mẫu:</span>
                        <div className="whitespace-pre-wrap leading-relaxed">
                          <MathRenderer content={q.sample_solution} />
                        </div>
                      </div>
                    )}

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="p-2.5 bg-indigo-50/40 border border-indigo-100 rounded-xl text-xs text-slate-700 space-y-1">
                        <span className="font-bold text-indigo-700 block">Lời giải chi tiết:</span>
                        <MathRenderer content={q.explanation} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Save Action */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('input')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Quay lại
              </button>

              <button
                type="button"
                disabled={isSaving || selectedIndices.size === 0}
                onClick={handleSaveToBank}
                className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{isSaving ? 'Đang lưu vào Ngân hàng...' : `💾 Lưu ${selectedIndices.size} câu hỏi vào Ngân hàng`}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* INLINE EDIT QUESTION MODAL */}
      {editingIndex !== null && editingForm && (
        <Modal
          isOpen={true}
          onClose={() => { setEditingIndex(null); setEditingForm(null); }}
          title={`Chỉnh sửa Câu ${editingIndex + 1}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nội dung câu hỏi</label>
              <textarea
                rows={3}
                value={editingForm.content || ''}
                onChange={(e) => setEditingForm(prev => ({ ...prev, content: e.target.value }))}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-sans"
              />
            </div>

            {editingForm.question_type === 'MULTIPLE_CHOICE' && Array.isArray(editingForm.options) && (
              <div className="space-y-2">
                <label className="block font-bold text-slate-700">Các phương án &amp; Đáp án đúng</label>
                {editingForm.options.map((opt, i) => (
                  <div key={i} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="correct_option"
                      checked={editingForm.correct_option === i}
                      onChange={() => setEditingForm(prev => ({ ...prev, correct_option: i }))}
                      className="cursor-pointer"
                    />
                    <span className="font-bold w-4">{String.fromCharCode(65 + i)}</span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...editingForm.options];
                        newOpts[i] = e.target.value;
                        setEditingForm(prev => ({ ...prev, options: newOpts }));
                      }}
                      className="flex-1 p-2 border border-slate-300 rounded-xl"
                    />
                  </div>
                ))}
              </div>
            )}

            {editingForm.question_type === 'SHORT_ANSWER' && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Đáp án chính xác</label>
                <input
                  type="text"
                  value={editingForm.correct_answer || ''}
                  onChange={(e) => setEditingForm(prev => ({ ...prev, correct_answer: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">Lời giải chi tiết</label>
              <textarea
                rows={3}
                value={editingForm.explanation || ''}
                onChange={(e) => setEditingForm(prev => ({ ...prev, explanation: e.target.value }))}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-sans"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => { setEditingIndex(null); setEditingForm(null); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer"
              >
                Cập nhật
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
