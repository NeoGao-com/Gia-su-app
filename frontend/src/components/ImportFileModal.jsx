import React, { useState, useRef } from 'react';
import { 
  Upload, Sparkles, CheckCircle2, 
  Trash2, Edit3, ChevronRight, Check, ArrowLeft, Loader2,
  FileCheck, Layers
} from 'lucide-react';
import api from '../api/axios';
import { Modal } from './Modal';
import { MathRenderer } from './MathRenderer';
import { useToast } from '../context/ToastContext';

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

export function ImportFileModal({ isOpen, onClose, onSuccess }) {
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  // Steps: 'upload' | 'review'
  const [step, setStep] = useState('upload');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Settings
  const [subject, setSubject] = useState('Toán');
  const [gradeLevel, setGradeLevel] = useState(10);
  const [chapter, setChapter] = useState('');
  const [useAI, setUseAI] = useState(true);

  // Extracted data
  const [extractedQuestions, setExtractedQuestions] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [editingIndex, setEditingIndex] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);

  const resetState = () => {
    setStep('upload');
    setSelectedFile(null);
    setIsExtracting(false);
    setIsImporting(false);
    setExtractedQuestions([]);
    setSelectedIndices(new Set());
    setEditingIndex(null);
    setEditFormData(null);
    setFileMeta(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const validateAndSetFile = (file) => {
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
  };

  const handleExtract = async () => {
    if (!selectedFile) {
      toast.warning('Vui lòng chọn một tệp đề thi');
      return;
    }

    try {
      setIsExtracting(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('subject', subject);
      formData.append('grade_level', gradeLevel.toString());
      if (chapter) formData.append('chapter', chapter);
      formData.append('use_ai', useAI.toString());

      const res = await api.post('/ai/extract-from-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const questions = res.data?.questions || [];
      if (questions.length === 0) {
        toast.warning('Không tìm thấy câu hỏi nào trong tệp. Hãy kiểm tra định dạng hoặc thử tắt/bật AI.');
        return;
      }

      setExtractedQuestions(questions);
      // Select all by default
      setSelectedIndices(new Set(questions.map((_, i) => i)));
      setFileMeta({
        filename: res.data?.filename || selectedFile.name,
        totalChars: res.data?.total_chars || 0,
        totalQuestions: questions.length,
        preview: res.data?.text_preview || ''
      });
      setStep('review');
      toast.success(`Đã trích xuất thành công ${questions.length} câu hỏi!`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Lỗi khi trích xuất câu hỏi từ tệp');
    } finally {
      setIsExtracting(false);
    }
  };

  // Toggle selection
  const toggleSelectAll = () => {
    if (selectedIndices.size === extractedQuestions.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(extractedQuestions.map((_, i) => i)));
    }
  };

  const toggleSelectIndex = (idx) => {
    const next = new Set(selectedIndices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelectedIndices(next);
  };

  const handleDeleteQuestion = (idx) => {
    const updated = extractedQuestions.filter((_, i) => i !== idx);
    setExtractedQuestions(updated);
    const nextIndices = new Set();
    selectedIndices.forEach(i => {
      if (i < idx) nextIndices.add(i);
      else if (i > idx) nextIndices.add(i - 1);
    });
    setSelectedIndices(nextIndices);
    if (editingIndex === idx) setEditingIndex(null);
  };

  const handleStartEdit = (idx) => {
    setEditingIndex(idx);
    setEditFormData({ ...extractedQuestions[idx] });
  };

  const handleSaveEdit = () => {
    if (!editFormData) return;
    const updated = [...extractedQuestions];
    updated[editingIndex] = editFormData;
    setExtractedQuestions(updated);
    setEditingIndex(null);
    setEditFormData(null);
    toast.success('Đã cập nhật câu hỏi');
  };

  const handleImportToBank = async () => {
    const questionsToImport = extractedQuestions.filter((_, i) => selectedIndices.has(i));
    if (questionsToImport.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một câu hỏi để nhập');
      return;
    }

    try {
      setIsImporting(true);
      const res = await api.post('/questions/import-json', {
        questions: questionsToImport
      });

      toast.success(res.data?.message || `Đã nhập ${questionsToImport.length} câu hỏi vào Ngân hàng!`);
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể lưu câu hỏi vào hệ thống');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Tự động nhập câu hỏi từ File (Word, PDF, Markdown)"
      size="xl"
    >
      <div className="space-y-5">
        {/* Step Indicator */}
        <div className="flex items-center justify-between px-3 py-2 bg-indigo-50/60 rounded-xl border border-indigo-100/80 text-xs font-semibold text-slate-700">
          <div className="flex items-center space-x-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'upload' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}>
              {step === 'upload' ? '1' : <Check className="w-3.5 h-3.5" />}
            </span>
            <span className={step === 'upload' ? 'text-indigo-700 font-bold' : 'text-slate-700'}>
              Tải lên tài liệu
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
          <div className="flex items-center space-x-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'review' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
              2
            </span>
            <span className={step === 'review' ? 'text-indigo-700 font-bold' : 'text-slate-400'}>
              Kiểm tra &amp; Phê duyệt ({extractedQuestions.length})
            </span>
          </div>
        </div>

        {/* STEP 1: UPLOAD */}
        {step === 'upload' && (
          <div className="space-y-5">
            {/* File Drop Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                isDragging 
                  ? 'border-indigo-600 bg-indigo-50/50 scale-[1.01]' 
                  : selectedFile 
                    ? 'border-emerald-300 bg-emerald-50/30' 
                    : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.doc,.pdf,.md,.markdown,.txt"
                onChange={handleFileChange}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
                    <FileCheck className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB • Nhấn để đổi tệp khác</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800">
                      Kéo thả hoặc <span className="text-indigo-600 underline">chọn tệp từ máy tính</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Hỗ trợ: Word (.docx, .doc), PDF (.pdf), Markdown (.md), Text (.txt)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Target Taxonomy Settings */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Thiết lập thông tin phân loại câu hỏi</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Môn học</label>
                  <select
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800"
                  >
                    <option value="Toán">Toán</option>
                    <option value="Vật lý">Vật lý</option>
                    <option value="Hóa học">Hóa học</option>
                    <option value="Sinh học">Sinh học</option>
                    <option value="Tiếng Anh">Tiếng Anh</option>
                    <option value="Ngữ văn">Ngữ văn</option>
                    <option value="Lịch sử">Lịch sử</option>
                    <option value="Địa lý">Địa lý</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Khối lớp</label>
                  <select
                    value={gradeLevel}
                    onChange={e => setGradeLevel(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800"
                  >
                    {[6, 7, 8, 9, 10, 11, 12].map(g => (
                      <option key={g} value={g}>Khối {g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Chương / Chuyên đề (Tùy chọn)</label>
                  <input
                    type="text"
                    value={chapter}
                    onChange={e => setChapter(e.target.value)}
                    placeholder="VD: Hàm số bậc hai"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-slate-800"
                  />
                </div>
              </div>

              {/* AI toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">Sử dụng AI phân tích thông minh</div>
                    <div className="text-[11px] text-slate-500">
                      Tự động chuyển đổi công thức Toán LaTeX, giải đề nếu thiếu đáp án, xử lý đúng/sai &amp; tự luận.
                    </div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAI}
                    onChange={e => setUseAI(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleExtract}
                disabled={!selectedFile || isExtracting}
                className="flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang đọc &amp; phân tích đề thi...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Bắt đầu trích xuất câu hỏi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: REVIEW & EDIT */}
        {step === 'review' && (
          <div className="space-y-4">
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl">
              <div>
                <span className="text-xs font-bold text-slate-800">
                  Tìm thấy <strong className="text-indigo-700 tabular-nums">{extractedQuestions.length} câu hỏi</strong> từ tệp{' '}
                  <code className="bg-white px-1.5 py-0.5 rounded text-slate-700 font-mono text-[11px] border border-slate-200">{fileMeta?.filename}</code>
                </span>
                <span className="text-xs text-slate-500 ml-2 tabular-nums">
                  (Đã chọn {selectedIndices.size} / {extractedQuestions.length})
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  {selectedIndices.size === extractedQuestions.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Chọn tệp khác</span>
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="max-h-[55vh] overflow-y-auto space-y-3 pr-1">
              {extractedQuestions.map((q, idx) => {
                const isSelected = selectedIndices.has(idx);
                const isEditing = editingIndex === idx;
                const typeInfo = QUESTION_TYPE_LABELS[q.question_type] || QUESTION_TYPE_LABELS.MULTIPLE_CHOICE;
                const diffInfo = DIFFICULTY_LABELS[q.difficulty] || DIFFICULTY_LABELS.THONG_HIEU;

                if (isEditing && editFormData) {
                  return (
                    <div key={idx} className="p-4 bg-indigo-50/30 border-2 border-indigo-600 rounded-xl space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-indigo-700 tabular-nums">Chỉnh sửa Câu #{idx + 1}</span>
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={() => setEditingIndex(null)}
                            className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg hover:bg-white text-slate-700 cursor-pointer"
                          >
                            Hủy
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="px-3 py-1 text-xs bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 cursor-pointer"
                          >
                            Lưu
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Nội dung câu hỏi</label>
                        <textarea
                          rows="3"
                          value={editFormData.content}
                          onChange={e => setEditFormData({ ...editFormData, content: e.target.value })}
                          className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-white text-slate-800"
                        />
                      </div>

                      {editFormData.question_type === 'MULTIPLE_CHOICE' && editFormData.options && (
                        <div className="space-y-2">
                          <label className="block text-[11px] font-bold text-slate-700">4 Phương án (Chọn đáp án đúng)</label>
                          {editFormData.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center space-x-2">
                              <input
                                type="radio"
                                name={`edit-correct-${idx}`}
                                checked={editFormData.correct_option === optIdx}
                                onChange={() => setEditFormData({ ...editFormData, correct_option: optIdx })}
                                className="text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <span className="text-xs font-bold w-5 text-slate-700">{String.fromCharCode(65 + optIdx)}.</span>
                              <input
                                type="text"
                                value={opt}
                                onChange={e => {
                                  const newOpts = [...editFormData.options];
                                  newOpts[optIdx] = e.target.value;
                                  setEditFormData({ ...editFormData, options: newOpts });
                                }}
                                className="flex-1 px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {editFormData.question_type === 'SHORT_ANSWER' && (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">Đáp án đúng</label>
                          <input
                            type="text"
                            value={editFormData.correct_answer || ''}
                            onChange={e => setEditFormData({ ...editFormData, correct_answer: e.target.value })}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Lời giải / Giải thích chi tiết</label>
                        <input
                          type="text"
                          value={editFormData.explanation || ''}
                          onChange={e => setEditFormData({ ...editFormData, explanation: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border transition ${
                      isSelected
                        ? 'bg-white border-indigo-200 shadow-2xs'
                        : 'bg-slate-50/50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectIndex(idx)}
                          className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                        />

                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-xs text-slate-800 tabular-nums">Câu {idx + 1}</span>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${typeInfo.bg}`}>
                              {typeInfo.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${diffInfo.bg}`}>
                              {diffInfo.label}
                            </span>
                          </div>

                          <div className="text-xs text-gray-800 leading-relaxed font-medium">
                            <MathRenderer content={q.content} />
                          </div>

                          {/* Options if MULTIPLE_CHOICE */}
                          {q.question_type === 'MULTIPLE_CHOICE' && q.options && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {q.options.map((opt, optIdx) => {
                                const isCorrect = q.correct_option === optIdx;
                                return (
                                  <div
                                    key={optIdx}
                                    className={`px-3 py-1.5 rounded-xl border text-xs flex items-center space-x-2 ${
                                      isCorrect
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                                        : 'bg-gray-50/70 border-gray-200 text-gray-700'
                                    }`}
                                  >
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                                      isCorrect ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'
                                    }`}>
                                      {String.fromCharCode(65 + optIdx)}
                                    </span>
                                    <div className="truncate flex-1">
                                      <MathRenderer content={opt} />
                                    </div>
                                    {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Sub-questions if TRUE_FALSE */}
                          {q.question_type === 'TRUE_FALSE' && q.sub_questions && (
                            <div className="space-y-1.5 pt-1">
                              {q.sub_questions.map((sub, sIdx) => (
                                <div key={sIdx} className="flex items-center justify-between text-xs px-3 py-1 rounded-xl bg-gray-50 border border-gray-200">
                                  <span className="font-medium text-gray-700">{sub.statement}</span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sub.answer ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                    {sub.answer ? 'Đúng' : 'Sai'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Short Answer / Essay */}
                          {q.question_type === 'SHORT_ANSWER' && q.correct_answer && (
                            <div className="text-xs bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-amber-900">
                              Đáp án đúng: <strong>{q.correct_answer}</strong>
                            </div>
                          )}

                          {/* Explanation */}
                          {q.explanation && (
                            <div className="text-[11px] text-gray-500 italic bg-gray-50/70 p-2 rounded-xl border border-gray-100">
                              <strong>Lời giải:</strong> <MathRenderer content={q.explanation} />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(idx)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                          title="Sửa câu hỏi"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Xóa câu hỏi này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <span className="text-xs text-slate-500">
                Sẽ nhập <strong className="text-indigo-600 font-bold tabular-nums">{selectedIndices.size}</strong> câu hỏi vào ngân hàng.
              </span>
              <div className="flex space-x-2.5">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleImportToBank}
                  disabled={selectedIndices.size === 0 || isImporting}
                  className="flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang lưu câu hỏi...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span className="tabular-nums">Lưu {selectedIndices.size} câu vào Ngân hàng</span>
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
