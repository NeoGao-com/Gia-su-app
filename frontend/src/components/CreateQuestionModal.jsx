import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { BookOpen, Image as ImageIcon, CheckCircle2, HelpCircle, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import api, { resolveImageUrl } from '../api/axios';
import { MathRenderer } from './MathRenderer';

const mergeFormData = (initialData) => {
  const base = {
    subject: "Toán",
    grade_level: 10,
    question_type: "MULTIPLE_CHOICE",
    content: "",
    image_url: "",
    options: ["", "", "", ""],
    sub_questions: [{ statement: "", answer: true }, { statement: "", answer: true }, { statement: "", answer: true }, { statement: "", answer: true }],
    correct_answer: "",
    correct_option: null,
    blanks: [],
    sample_solution: "",
    explanation: "",
    chapter: "",
    lesson: "",
    topic: "",
    difficulty: "THONG_HIEU",
  };
  if (initialData && (initialData.id || initialData._id)) {
    return {
      ...base,
      ...initialData,
      options: Array.isArray(initialData.options) && initialData.options.length > 0
        ? initialData.options
        : ["", "", "", ""],
      sub_questions: Array.isArray(initialData.sub_questions) && initialData.sub_questions.length > 0
        ? initialData.sub_questions
        : base.sub_questions,
    };
  }
  return base;
};

export function CreateQuestionModal({ isOpen, onClose, onSubmit, initialData }) {
  // ponytail: key remount trên Modal thay cho useEffect reset; nâng cấp khi cần giữ draft khi đóng/mở.
  const [formData, setFormData] = useState(() => mergeFormData(initialData));
  const [activeImgTab, setActiveImgTab] = useState('file'); // 'file' | 'python'
  const [uploading, setUploading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [pyCode, setPyCode] = useState(
    "import numpy as np\nx = np.linspace(-3, 3, 200)\ny = x**2 - 4\nplt.plot(x, y, 'b-', label='y = x^2 - 4')\nplt.axhline(0, color='black', linewidth=0.8)\nplt.axvline(0, color='black', linewidth=0.8)\nplt.grid(True)\nplt.legend()\nplt.title('Đồ thị hàm số')"
  );

  const handleRenderPython = async () => {
    if (!pyCode.strip ? !pyCode.trim() : !pyCode) return;
    try {
      setRendering(true);
      const res = await api.post('/render/code', { code: pyCode, type: 'python' });
      setFormData(prev => ({ ...prev, image_url: res.data.url, latex_code: pyCode }));
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể biên dịch mã Python');
    } finally {
      setRendering(false);
    }
  };
  const [showPreview, setShowPreview] = useState(true);
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);

  // Submit bằng Ctrl+Enter
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setUploading(true);
      const data = new FormData();
      data.append('file', file);
      const res = await api.post('/upload/image', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData({ ...formData, image_url: res.data.url });
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể tải ảnh lên');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await onSubmit(formData);
    } finally {
      setBusy(false);
    }
  };

  const setField = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  const addOption = () => setField('options', [...(formData.options || []), ""]);
  const removeOption = (idx) => {
    const newOpts = (formData.options || []).filter((_, i) => i !== idx);
    setField('options', newOpts);
    // Nếu đáp án đúng trỏ vào option bị xoá, reset
    if (formData.correct_option === idx) setField('correct_option', null);
  };

  const addSubQuestion = () => setField('sub_questions', [...(formData.sub_questions || []), { statement: "", answer: true }]);
  const removeSubQuestion = (idx) => {
    const subs = (formData.sub_questions || []).filter((_, i) => i !== idx);
    setField('sub_questions', subs);
  };
  const updateSubQuestion = (idx, key, value) => {
    const subs = [...(formData.sub_questions || [])];
    subs[idx] = { ...subs[idx], [key]: value };
    setField('sub_questions', subs);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData?.id ? "Chỉnh sửa câu hỏi" : "Tạo câu hỏi mới"} size="lg">
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5 p-1 max-h-[80vh] overflow-y-auto pr-2">
        {/* Section 1: Phân loại */}
        <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-3">
          <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center space-x-1.5">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>1. Thông tin phân loại</span>
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Môn học</label>
              <input type="text" value={formData.subject} onChange={e => setField('subject', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 text-slate-800" required />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Khối lớp</label>
              <input type="number" value={formData.grade_level} onChange={e => setField('grade_level', Number(e.target.value))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 text-slate-800" required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Chương</label>
              <input type="text" value={formData.chapter || ''} onChange={e => setField('chapter', e.target.value)} placeholder="VD: Chương I" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-600" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Bài học</label>
              <input type="text" value={formData.lesson || ''} onChange={e => setField('lesson', e.target.value)} placeholder="VD: Bài 1" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-600" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Dạng bài</label>
              <input type="text" value={formData.topic || ''} onChange={e => setField('topic', e.target.value)} placeholder="VD: Dạng 1" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-600" />
            </div>
          </div>
        </div>

        {/* Section 2: Nội dung + Ảnh */}
        <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-3">
          <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center space-x-1.5">
            <HelpCircle className="w-4 h-4 text-indigo-600" />
            <span>2. Nội dung &amp; Hình ảnh</span>
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Dạng câu hỏi</label>
              <select value={formData.question_type} onChange={e => setField('question_type', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-600 text-slate-800">
                <option value="MULTIPLE_CHOICE">Trắc nghiệm nhiều lựa chọn (A, B, C, D)</option>
                <option value="TRUE_FALSE">Đúng / Sai 4 ý</option>
                <option value="SHORT_ANSWER">Trả lời ngắn / Điền số (/key)</option>
                <option value="ESSAY">Tự luận</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Mức độ nhận thức</label>
              <select value={formData.difficulty} onChange={e => setField('difficulty', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-indigo-600 text-slate-800">
                <option value="NHAN_BIET">Nhận biết</option>
                <option value="THONG_HIEU">Thông hiểu</option>
                <option value="VAN_DUNG">Vận dụng</option>
                <option value="VAN_DUNG_CAO">Vận dụng cao</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[11px] font-bold text-slate-700">Nội dung câu hỏi (hỗ trợ công thức LaTeX)</label>
              <button type="button" onClick={() => setShowPreview(p => !p)} className="text-xs text-indigo-600 font-bold flex items-center space-x-1 hover:underline cursor-pointer">
                {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPreview ? 'Ẩn xem trước' : 'Xem trước'}</span>
              </button>
            </div>
            <textarea value={formData.content} onChange={e => setField('content', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 text-slate-800" rows="3" placeholder={formData.question_type === 'SHORT_ANSWER' ? "Ví dụ: Thủ đô của /key là Hà Nội." : "Nhập nội dung câu hỏi..."} required />
            {showPreview && formData.content && (
              <div className="mt-2 p-3 bg-white border border-slate-200 rounded-xl">
                <MathRenderer content={formData.content} />
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="block text-[11px] font-bold text-slate-700 flex items-center space-x-1">
              <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>Hình ảnh minh họa (tùy chọn)</span>
            </label>
            <div className="flex space-x-2 bg-white p-1 rounded-xl border border-slate-200">
              <button type="button" onClick={() => setActiveImgTab('file')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${activeImgTab === 'file' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'}`}>Tải ảnh từ máy</button>
              <button type="button" onClick={() => setActiveImgTab('python')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${activeImgTab === 'python' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'}`}>Vẽ hình bằng Python</button>
            </div>
            {activeImgTab === 'python' && (
              <div className="space-y-2">
                <textarea
                  value={pyCode}
                  onChange={e => setPyCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 text-emerald-300 font-mono text-xs rounded-xl focus:outline-none border border-slate-800"
                  rows="8"
                  spellCheck="false"
                />
                <button
                  type="button"
                  onClick={handleRenderPython}
                  disabled={rendering || !pyCode.trim()}
                  className="w-full py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {rendering ? 'Đang biên dịch...' : 'Biên dịch &amp; Vẽ hình'}
                </button>
              </div>
            )}
            {activeImgTab === 'file' && (
              <div className="flex items-center space-x-3">
                <input type="file" accept="image/png, image/jpeg, image/gif, image/webp" onChange={handleFileUpload} className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" />
                {uploading && <span className="text-xs text-indigo-600 font-bold">Đang tải lên...</span>}
              </div>
            )}
            {formData.image_url && (
              <div className="mt-2 p-2 bg-white rounded-xl border border-slate-200 inline-block">
                <img src={resolveImageUrl(formData.image_url)} alt="Xem trước" className="max-h-32 rounded-lg object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Đáp án */}
        <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-3">
          <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>3. Đáp án &amp; Lời giải</span>
          </h4>

          {formData.question_type === 'MULTIPLE_CHOICE' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="block text-[11px] font-bold text-slate-700">Các lựa chọn (nhập nội dung và đánh dấu đáp án đúng)</label>
                <button type="button" onClick={addOption} className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer transition">
                  <Plus className="w-3.5 h-3.5" /><span>Thêm lựa chọn</span>
                </button>
              </div>
              <div className="space-y-2">
                {(formData.options || []).map((opt, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <span className="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-100">{String.fromCharCode(65 + idx)}</span>
                    <input type="text" value={opt} onChange={e => {
                      const newOpts = [...formData.options];
                      newOpts[idx] = e.target.value;
                      setField('options', newOpts);
                    }} className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-600" placeholder={`Nội dung đáp án ${String.fromCharCode(65 + idx)}`} required />
                    <label className={`flex items-center justify-center px-3 py-2 rounded-xl cursor-pointer text-xs font-bold transition border ${formData.correct_option === idx ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'}`}>
                      <input type="radio" name="correct_option" checked={formData.correct_option === idx} onChange={() => {
                        setField('correct_option', idx);
                        setField('correct_answer', formData.options[idx] || '');
                      }} className="hidden" />
                      Đúng
                    </label>
                    {(formData.options || []).length > 2 && (
                      <button type="button" onClick={() => removeOption(idx)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {formData.question_type === 'TRUE_FALSE' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="block text-[11px] font-bold text-slate-700">Các mệnh đề con (4 ý)</label>
                <button type="button" onClick={addSubQuestion} className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer transition">
                  <Plus className="w-3.5 h-3.5" /><span>Thêm ý</span>
                </button>
              </div>
              <div className="space-y-2">
                {(formData.sub_questions || []).map((sub, idx) => (
                  <div key={idx} className="flex items-center space-x-2 bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="font-bold text-xs text-slate-500 w-6">{String.fromCharCode(97 + idx)})</span>
                    <input type="text" value={sub.statement} onChange={e => updateSubQuestion(idx, 'statement', e.target.value)} className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-indigo-600" placeholder="Nội dung khẳng định..." required />
                    <select value={sub.answer ? "true" : "false"} onChange={e => updateSubQuestion(idx, 'answer', e.target.value === "true")} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-semibold bg-slate-50 text-slate-800">
                      <option value="true">Đúng</option>
                      <option value="false">Sai</option>
                    </select>
                    {(formData.sub_questions || []).length > 1 && (
                      <button type="button" onClick={() => removeSubQuestion(idx)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {formData.question_type === 'SHORT_ANSWER' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Đáp án cho ô trống (/key)</label>
                <input type="text" value={formData.correct_answer || ''} onChange={e => setField('correct_answer', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-600" placeholder="Nhập đáp án cho /key..." required />
              </div>
            </div>
          )}

          {formData.question_type === 'ESSAY' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Hướng dẫn chấm / Biểu điểm chi tiết</label>
                <textarea value={formData.sample_solution || ''} onChange={e => setField('sample_solution', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-600" rows="3" placeholder="Nhập dàn ý hoặc thang điểm từng bước..." />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Giải thích chi tiết (tùy chọn)</label>
            <textarea value={formData.explanation || ''} onChange={e => setField('explanation', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-600" rows="2" placeholder="Giải thích các bước giải hoặc lưu ý..." />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <span className="text-xs text-slate-400">Mẹo: nhấn <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">Ctrl+Enter</kbd> để lưu nhanh</span>
          <div className="flex space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer">Hủy</button>
            <button type="submit" disabled={busy} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer">
              {busy ? 'Đang lưu...' : (initialData?.id ? "Cập nhật câu hỏi" : "Lưu câu hỏi")}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
