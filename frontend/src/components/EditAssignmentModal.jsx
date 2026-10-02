import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Modal } from './Modal';
import { Calendar, Clock, RotateCcw, Eye, AlertCircle, Save } from 'lucide-react';

export function EditAssignmentModal({ assignment, isOpen, onClose, onSaved }) {
  const [dueDate, setDueDate] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [showAnswers, setShowAnswers] = useState(true);
  const [durationOverride, setDurationOverride] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !assignment) return;
    setError(null);

    // Format ISO string to datetime-local input: YYYY-MM-DDTHH:mm
    const toLocalInput = (isoStr) => {
      if (!isoStr) return '';
      try {
        const d = new Date(isoStr);
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } catch {
        return '';
      }
    };

    setDueDate(toLocalInput(assignment.due_date));
    setOpenDate(toLocalInput(assignment.open_date));
    setMaxAttempts(assignment.max_attempts ?? 1);
    setShowAnswers(assignment.show_answers_after_submit ?? true);
    setDurationOverride(assignment.duration_minutes_override ? String(assignment.duration_minutes_override) : '');
  }, [isOpen, assignment]);

  if (!isOpen || !assignment) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (openDate && dueDate && new Date(openDate) > new Date(dueDate)) {
      setError('Thời gian mở đề phải trước hạn nộp.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const payload = {
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        open_date: openDate ? new Date(openDate).toISOString() : null,
        max_attempts: maxAttempts ? parseInt(maxAttempts) : null,
        show_answers_after_submit: showAnswers,
        duration_minutes_override: durationOverride ? parseInt(durationOverride) : null
      };

      await api.put(`/classrooms/${assignment.classroom_id}/exams/${assignment.exam_id}`, payload);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Lỗi khi cập nhật bài tập');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chỉnh sửa Bài tập đã giao" size="md">
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-xs sm:text-sm flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Info card */}
      <div className="mb-5 p-3.5 bg-purple-50/70 border border-purple-100 rounded-2xl">
        <div className="text-xs text-purple-600 font-semibold uppercase tracking-wider">Đề thi / Bài tập</div>
        <div className="font-bold text-gray-800 text-sm mt-0.5">{assignment.exam?.title || `Đề thi #${assignment.exam_id}`}</div>
        {assignment.classroom_name && (
          <div className="text-xs text-gray-500 mt-1">
            Lớp học: <span className="font-semibold text-gray-700">{assignment.classroom_name}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-pastel-purpleDark" />
              <span>Thời gian mở đề</span>
            </label>
            <input
              type="datetime-local"
              value={openDate}
              onChange={(e) => setOpenDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pastel-purple bg-white"
            />
            <span className="text-[11px] text-gray-400 mt-0.5 block">Để trống nếu mở ngay</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-pastel-purpleDark" />
              <span>Hạn nộp bài</span>
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pastel-purple bg-white"
            />
            <span className="text-[11px] text-gray-400 mt-0.5 block">Để trống nếu không giới hạn</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center space-x-1">
              <RotateCcw className="w-3.5 h-3.5 text-pastel-purpleDark" />
              <span>Số lần làm bài tối đa</span>
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pastel-purple bg-white"
              placeholder="1"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-pastel-purpleDark" />
              <span>Thời gian làm bài riêng (phút)</span>
            </label>
            <input
              type="number"
              min={1}
              max={600}
              value={durationOverride}
              onChange={(e) => setDurationOverride(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pastel-purple bg-white"
              placeholder="Dùng thời gian gốc của đề"
            />
          </div>
        </div>

        <div className="pt-2">
          <label className="flex items-center space-x-2 text-xs sm:text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showAnswers}
              onChange={(e) => setShowAnswers(e.target.checked)}
              className="w-4 h-4 text-pastel-purple rounded border-gray-300 focus:ring-pastel-purple"
            />
            <span className="flex items-center space-x-1">
              <Eye className="w-3.5 h-3.5 text-gray-500" />
              <span>Cho phép học sinh xem đáp án và lời giải sau khi nộp bài</span>
            </span>
          </label>
        </div>

        <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center space-x-1.5 px-5 py-2 bg-pastel-purple text-white rounded-xl text-xs font-bold hover:bg-pastel-purpleDark transition shadow-sm disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
