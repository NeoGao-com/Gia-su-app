import React from 'react';
import { TextToolbar } from './TextToolbar';

export function CreateQuestionForm({ _formData, _setFormData, _onSubmit }) {
  const insertLatex = () => {
    const textarea = document.querySelector('textarea');
    if (textarea) {
      textarea.value += ' $...$ ';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.focus();
    }
  };

  return (
    <div className="bg-white p-8 rounded-[22px] border border-gray-100 shadow-sm space-y-6">
      <h2 className="text-xl font-bold text-gray-800 border-b border-gray-100 pb-4">Tạo câu hỏi mới</h2>
      
      {/* Taxonomy */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['Môn học', 'Khối lớp', 'Chương', 'Bài'].map((label) => (
          <select key={label} className="px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500 font-medium">
            <option>{label}</option>
          </select>
        ))}
      </div>

      {/* Content */}
      <TextToolbar onInsertLatex={insertLatex} />
      <textarea 
        placeholder="Nhập nội dung câu hỏi..."
        className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 min-h-[120px] focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500" 
      />

      {/* Image URL */}
      <input 
        type="text" 
        placeholder="URL hình ảnh (nếu có)..."
        className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500" 
      />

      {/* Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {['A', 'B', 'C', 'D'].map((label) => (
          <input 
            key={label}
            placeholder={`Đáp án ${label}`}
            className="p-4 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500 font-medium" 
          />
        ))}
      </div>

      {/* Correct Answer */}
      <select className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500 font-medium">
        <option>Chọn đáp án đúng</option>
        {['A', 'B', 'C', 'D'].map(l => <option key={l}>{l}</option>)}
      </select>

      <button className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition cursor-pointer shadow-xs">
        Lưu câu hỏi
      </button>
    </div>
  );
}
