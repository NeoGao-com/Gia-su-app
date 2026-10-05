import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';

export function CreateCategoryModal({ isOpen, onClose, onSubmit, parentCategory }) {
  const defaults = {
    subject: "Toán",
    grade_level: 10,
    chapter: "",
    lesson: "",
    topic: ""
  };
  const parentDefaults = parentCategory ? {
    subject: parentCategory.subject || "Toán",
    grade_level: parentCategory.grade_level || 10,
    chapter: parentCategory.chapter || "",
    lesson: parentCategory.lesson || "",
    topic: ""
  } : defaults;
  const [formData, setFormData] = useState({ ...(isOpen ? parentDefaults : defaults) });

  const [subName, setSubName] = useState("");

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...parentDefaults });
      setSubName("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalData = { ...formData };
    // If parent is set, use subName for the deepest level
    if (parentCategory) {
        if (!finalData.topic) finalData.topic = subName;
        else if (!finalData.lesson) finalData.lesson = subName;
        else if (!finalData.chapter) finalData.chapter = subName;
    }
    onSubmit({ ...finalData, grade_level: parseInt(finalData.grade_level) });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={parentCategory ? "Tạo thư mục con" : "Tạo danh mục mới"}>
      <form onSubmit={handleSubmit} className="space-y-4 p-2">
        {parentCategory ? (
            <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tên thư mục con mới</label>
                <input type="text" value={subName} onChange={e => setSubName(e.target.value)} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 text-slate-800" required />
            </div>
        ) : (
            <>
                {/* Full form */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Môn học</label>
                    <input type="text" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 text-slate-800" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Khối lớp</label>
                    <input type="number" value={formData.grade_level} onChange={e => setFormData({...formData, grade_level: e.target.value})} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 text-slate-800" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Chương</label>
                  <input type="text" value={formData.chapter} onChange={e => setFormData({...formData, chapter: e.target.value})} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 text-slate-800" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bài học</label>
                  <input type="text" value={formData.lesson} onChange={e => setFormData({...formData, lesson: e.target.value})} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 text-slate-800" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dạng bài</label>
                  <input type="text" value={formData.topic} onChange={e => setFormData({...formData, topic: e.target.value})} className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 text-slate-800" />
                </div>
            </>
        )}
        <div className="flex justify-end space-x-3 pt-3">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-semibold transition cursor-pointer">Hủy</button>
          <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-xs transition cursor-pointer">Lưu danh mục</button>
        </div>
      </form>
    </Modal>
  );
}
