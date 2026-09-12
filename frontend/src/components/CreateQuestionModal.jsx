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
    <Modal isOpen={isOpen} onClose={onClose} title={initialData?.id ? "Chỉnh sửa câu hỏi" : "Tạo câu hỏi mới"}>
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5 p-2 max-h-[80vh] overflow-y-auto pr-2">
        {/* Section 1: Phân loại */}
        <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-100 space-y-3">
          <h4 className="text-xs font-bold text-pastel-purpleDark uppercase tracking-wider flex items-center space-x-1.5">
            <BookOpen className="w-4 h-4" />
            <span>1. Thông tin phân loại</span>
         </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Môn học</label>
              <input type="text" value={formData.subject} onChange={e => setField('subject', e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-pastel-purple" required />
           </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Khối lớp</label>
              <input type="number" value={formData.grade_level} onChange={e => setField('grade_level', Number(e.target.value))} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-pastel-purple" required />
           </div>
         </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Chương</label>
              <input type="text" value={formData.chapter || ''} onChange={e => setField('chapter', e.target.value)} placeholder="VD: Chương I" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium" />
           </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Bài</label>
              <input type="text" value={formData.lesson || ''} onChange={e => setField('lesson', e.target.value)} placeholder="VD: Bài 1" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium" />
           </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Dạng bài</label>
              <input type="text" value={formData.topic || ''} onChange={e => setField('topic', e.target.value)} placeholder="VD: Dạng 1" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium" />
           </div>
         </div>
       </div>

        {/* Section 2: Nội dung + Ảnh */}
        <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-100 space-y-3">
          <h4 className="text-xs font-bold text-pastel-purpleDark uppercase tracking-wider flex items-center space-x-1.5">
            <HelpCircle className="w-4 h-4" />
            <span>2. Nội dung & Hình ảnh</span>
         </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Dạng câu hỏi</label>
              <select value={formData.question_type} onChange={e => setField('question_type', e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-pastel-purple">
                <option value="MULTIPLE_CHOICE">Trắc nghiệm (A, B, C, D…</option>
                <option value="TRUE_FALSE">Đúng / Sai (Nhiều ý</option>
                <option value="SHORT_ANSWER">Điền khuyết (/key</option>
                <option value="ESSAY">Tự luận</option>
             </select>
           </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Mức độ</label>
              <select value={formData.difficulty} onChange={e => setField('difficulty', e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-pastel-purple">
                <option value="NHAN_BIET">Nhận biết</option>
                <option value="THONG_HIEU">Thông hiểu</option>
                <option value="VAN_DUNG">Vận dụng</option>
                <option value="VAN_DUNG_CAO">Vận dụng cao</option>
             </select>
           </div>
         </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-[11px] font-semibold text-gray-500">Nội dung câu hỏi (hỗ trợ LaTeX</label>
              <button type="button" onClick={() => setShowPreview(p => !p)} className="text-[10px] text-pastel-purpleDark font-bold flex items-center space-x-1 hover:underline">
                {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showPreview ? 'Ẩn xem trước' : 'Hiện xem trước'}</span>
             </button>
           </div>
            <textarea value={formData.content} onChange={e => setField('content', e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-pastel-purple" rows="3" placeholder={formData.question_type === 'SHORT_ANSWER' ? "Ví dụ: Thủ đô của /key là Hà Nội." : "Nhập nội dung câu hỏi..."} required />
            {showPreview && formData.content && (
              <div className="mt-2 p-3 bg-white border border-gray-100 rounded-xl">
                <MathRenderer content={formData.content} />
             </div>
            )}
         </div>

          <div className="space-y-2 pt-2 border-t border-gray-200">
            <label className="block text-[11px] font-semibold text-gray-500 flex items-center space-x-1">
              <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
              <span>Hình ảnh minh họa (tùy chọn</span>
           </label>
            <div className="flex space-x-2 bg-white p-1 rounded-xl border">
              <button type="button" onClick={() => setActiveImgTab('file')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${activeImgTab === 'file' ? 'bg-pastel-purple text-white shadow-xs' : 'text-gray-600 hover:bg-gray-50'}`}>Tải ảnh từ máy</button>
              <button type="button" onClick={() => setActiveImgTab('python')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${activeImgTab === 'python' ? 'bg-pastel-purple text-white shadow-xs' : 'text-gray-600 hover:bg-gray-50'}`}>Vẽ hình bằng Python</button>
           </div>
            {activeImgTab === 'python' && (
              <div className="space-y-2">
                <textarea
                  value={pyCode}
                  onChange={e => setPyCode(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 text-green-300 font-mono text-xs rounded-xl focus:outline-none border border-gray-700"
                  rows="8"
                  spellCheck="false"
                />
                <button
                  type="button"
                  onClick={handleRenderPython}
                  disabled={rendering || !pyCode.trim()}
                  className="w-full py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition disabled:opacity-50"
                >
                  {rendering ? 'Đang biên dịch...' : 'Biên dịch & Vẽ hình'}
                </button>
              </div>
            )}
            {activeImgTab === 'file' && (
              <div className="flex items-center space-x-3">
                <input type="file" accept="image/png, image/jpeg, image/gif, image/webp" onChange={handleFileUpload} className="text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-50 file:text-pastel-purpleDark hover:file:bg-purple-100" />
                {uploading && <span className="text-xs text-pastel-purpleDark font-bold">Đang tải lên</span>}
             </div>
            )}
            {formData.image_url && (
              <div className="mt-2 p-2 bg-white rounded-xl border inline-block">
                <img src={resolveImageUrl(formData.image_url)} alt="Xem trước" className="max-h-32 rounded-lg object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
             </div>
            )}
         </div>
       </div>

        {/* Section 3: Đáp án */}
        <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-100 space-y-3">
          <h4 className="text-xs font-bold text-pastel-purpleDark uppercase tracking-wider flex items-center space-x-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>3. Đáp án</span>
         </h4>

          {formData.question_type === 'MULTIPLE_CHOICE' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="block text-[11px] font-semibold text-gray-500">Các lựa chọn (nhập đáp án đúng rồi đánh dấu ở dưới</label>
                <button type="button" onClick={addOption} className="px-3 py-1 bg-purple-50 text-pastel-purpleDark rounded-xl text-xs font-bold flex items-center space-x-1">
                  <Plus className="w-3.5 h-3.5" /><span>Thêm lựa chọn</span>
               </button>
             </div>
              <div className="space-y-2">
                {(formData.options || []).map((opt, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <span className="w-8 h-8 flex items-center justify-center bg-purple-50 text-pastel-purpleDark font-bold text-xs rounded-lg border border-purple-100">{String.fromCharCode(65 + idx)}</span>
                    <input type="text" value={opt} onChange={e => {
                      const newOpts = [...formData.options];
                      newOpts[idx] = e.target.value;
                      setField('options', newOpts);
                    }} className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium" placeholder={`Nội dung đáp án ${String.fromCharCode(65 + idx)}`} required />
                    <label className={`flex items-center justify-center px-2 py-1.5 rounded-lg cursor-pointer text-xs font-bold ${formData.correct_option === idx ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'}`}>
                      <input type="radio" name="correct_option" checked={formData.correct_option === idx} onChange={() => {
                        setField('correct_option', idx);
                        setField('correct_answer', formData.options[idx] || '');
                      }} className="hidden" />
                      Đúng
                   </label>
                    {(formData.options || []).length > 2 && (
                      <button type="button" onClick={() => removeOption(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
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
                <label className="block text-[11px] font-semibold text-gray-500">Các ý phát biểu (mặc định 4 ý</label>
                <button type="button" onClick={addSubQuestion} className="px-3 py-1 bg-purple-50 text-pastel-purpleDark rounded-xl text-xs font-bold flex items-center space-x-1">
                  <Plus className="w-3.5 h-3.5" /><span>Thêm ý</span>
               </button>
             </div>
              <div className="space-y-2">
                {(formData.sub_questions || []).map((sub, idx) => (
                  <div key={idx} className="flex items-center space-x-2 bg-white p-2.5 rounded-xl border">
                    <span className="font-bold text-xs text-gray-500 w-6">{String.fromCharCode(97 + idx)})</span>
                    <input type="text" value={sub.statement} onChange={e => updateSubQuestion(idx, 'statement', e.target.value)} className="flex-1 px-3 py-1.5 border rounded-lg text-sm" placeholder="Nội dung phát biểu..." required />
                    <select value={sub.answer ? "true" : "false"} onChange={e => updateSubQuestion(idx, 'answer', e.target.value === "true")} className="px-3 py-1.5 border rounded-lg text-sm font-semibold bg-gray-50">
                      <option value="true">Đúng</option>
                      <option value="false">Sai</option>
                   </select>
                    {(formData.sub_questions || []).length > 1 && (
                      <button type="button" onClick={() => removeSubQuestion(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
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
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Đáp án cho ô trống (/key</label>
                <input type="text" value={formData.correct_answer || ''} onChange={e => setField('correct_answer', e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium" placeholder="Nhập đáp án cho /key..." required />
             </div>
           </div>
          )}

          {formData.question_type === 'ESSAY' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Hướng dẫn chấm / Gợi ý lời giải</label>
                <textarea value={formData.sample_solution || ''} onChange={e => setField('sample_solution', e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium" rows="3" placeholder="Nhập dàn ý hoặc hướng dẫn chấm điểm tự luận..." />
             </div>
           </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Giải thích chi tiết (tùy chọn</label>
            <textarea value={formData.explanation || ''} onChange={e => setField('explanation', e.target.value)} className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium" rows="2" placeholder="Giải thích đáp án..." />
         </div>
       </div>

        <div className="flex justify-between items-center pt-2">
          <span className="text-[10px] text-gray-400">Mẹo: nhấn Ctrl+Enter để lưu nhanh</span>
          <div className="flex space-x-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-200 rounded-2xl text-sm font-semibold hover:bg-gray-50 transition">Hủy</button>
            <button type="submit" disabled={busy} className="px-6 py-2.5 bg-pastel-purple text-white rounded-2xl text-sm font-bold shadow-sm hover:bg-pastel-purpleDark transition disabled:opacity-50">
              {busy ? 'Đang lưu...' : (initialData?.id ? "Cập nhật" : "Lưu câu hỏi")}
           </button>
         </div>
       </div>
     </form>
   </Modal>
  );
}
