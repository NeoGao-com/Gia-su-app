import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { AlertCircle, BookOpen } from 'lucide-react';
import { Modal } from './Modal';
import { useToast } from '../context/ToastContext';

export function AssignmentModal({ exam, exams = [], examType, isOpen, onClose, onAssigned }) {
  const { toast } = useToast();
  const [availableExams, setAvailableExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [classrooms, setClassrooms] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [dueDate, setDueDate] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [showAnswers, setShowAnswers] = useState(true);
  const [durationOverride, setDurationOverride] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState(null);
  const [loadingClasses, setLoadingClasses] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds([]);
    setDueDate('');
    setOpenDate('');
    setError(null);

    let cancelled = false;

    // Load available exams if not passed directly
    if (exam) {
      setSelectedExamId(String(exam.id));
      setMaxAttempts(exam.max_attempts || 1);
      setShowAnswers(exam.show_answers_after_submit ?? true);
      setDurationOverride('');
    } else {
      if (exams && exams.length > 0) {
        setAvailableExams(exams);
        setSelectedExamId(String(exams[0].id));
      } else {
        const params = { limit: 100 };
        if (examType) params.exam_type = examType;
        api.get('/exams', { params }).then((res) => {
          if (cancelled) return;
          const items = res.data.items || res.data || [];
          setAvailableExams(items);
          if (items.length > 0) {
            setSelectedExamId(String(items[0].id));
          }
        }).catch(() => {});
      }
      setMaxAttempts(1);
      setShowAnswers(true);
      setDurationOverride('');
    }

    // Load classrooms
    const loadClasses = async () => {
      setLoadingClasses(true);
      try {
        const res = await api.get('/classrooms', { params: { limit: 100 } });
        if (cancelled) return;
        const items = Array.isArray(res.data?.items)
          ? res.data.items
          : Array.isArray(res.data)
            ? res.data
            : [];
        setClassrooms(items);
      } catch {
        if (!cancelled) setClassrooms([]);
      } finally {
        if (!cancelled) setLoadingClasses(false);
      }
    };
    loadClasses();

    return () => { cancelled = true; };
  }, [isOpen, exam, exams]);

  if (!isOpen) return null;

  const currentExam = exam || availableExams.find((e) => String(e.id) === String(selectedExamId));

  const toggleClass = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSelectAllClasses = () => {
    if (selectedIds.length === classrooms.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(classrooms.map((c) => c.id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const targetExamId = exam ? exam.id : selectedExamId;
    if (!targetExamId) {
      setError('Vui lòng chọn bài tập để giao.');
      toast.warning('Vui lòng chọn bài tập để giao.');
      return;
    }
    if (selectedIds.length === 0) {
      setError('Vui lòng chọn ít nhất một lớp học.');
      toast.warning('Vui lòng chọn ít nhất một lớp học.');
      return;
    }
    if (openDate && dueDate && new Date(openDate) > new Date(dueDate)) {
      setError('Thời gian mở phải trước hạn nộp.');
      toast.warning('Thời gian mở phải trước hạn nộp.');
      return;
    }

    try {
      setAssigning(true);
      setError(null);
      for (const classId of selectedIds) {
        await api.post(`/classrooms/${classId}/exams`, {
          exam_id: Number(targetExamId),
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          open_date: openDate ? new Date(openDate).toISOString() : null,
          max_attempts: maxAttempts ? parseInt(maxAttempts) : null,
          show_answers_after_submit: showAnswers,
          duration_minutes_override: durationOverride ? parseInt(durationOverride) : null
        });
      }
      toast.success('Giao bài tập thành công!');
      onClose();
      onAssigned?.();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Lỗi khi giao bài tập';
      setError(msg);
      toast.error(msg);
    } finally {
      setAssigning(false);
    }
  };

  const titleText = exam
    ? `Giao bài: ${exam.title}`
    : 'Giao bài tập từ kho cho lớp học';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titleText} size="md">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs sm:text-sm flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Choose Exam if not pre-selected */}
        {!exam && (
          <div>
            <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 flex items-center space-x-1.5">
              <BookOpen className="w-4 h-4 text-pastel-purpleDark" />
              <span>Chọn bài tập từ kho *</span>
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-800 focus:outline-none focus:border-pastel-purple"
            >
              {availableExams.length === 0 ? (
                <option value="">Không có bài tập nào trong kho</option>
              ) : (
                availableExams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title} ({ex.question_count ?? ex.questions?.length ?? 0} câu - {ex.duration_minutes} phút)
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        {/* Choose Classroom */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs sm:text-sm font-bold text-gray-700">Chọn lớp học *</label>
            {classrooms.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAllClasses}
                className="text-[11px] font-bold text-pastel-purpleDark hover:underline"
              >
                {selectedIds.length === classrooms.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
            )}
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-3 bg-gray-50">
            {loadingClasses ? (
              <p className="text-xs text-gray-400">Đang tải danh sách lớp học...</p>
            ) : classrooms.length === 0 ? (
              <p className="text-xs text-gray-400">Chưa có lớp học nào. Vui lòng tạo lớp học trước.</p>
            ) : (
              classrooms.map((cls) => (
                <label key={cls.id} className="flex items-center space-x-2 text-xs sm:text-sm cursor-pointer hover:bg-gray-100/70 p-1 rounded-lg transition">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(cls.id)}
                    onChange={() => toggleClass(cls.id)}
                    className="rounded border-gray-300 text-pastel-purple focus:ring-pastel-purple"
                  />
                  <span className="font-semibold text-gray-800">{cls.name}</span>
                  <span className="text-xs text-gray-400">({cls.students?.length ?? cls.student_count ?? 0} học sinh)</span>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Schedule */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">Thời gian mở</label>
            <input
              type="datetime-local"
              value={openDate}
              onChange={(e) => setOpenDate(e.target.value)}
              className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pastel-purple"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">Hạn nộp</label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pastel-purple"
            />
          </div>
        </div>

        {/* Attempt and Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">Số lần làm tối đa</label>
            <input
              type="number"
              min="1"
              max="10"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(e.target.value)}
              className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pastel-purple"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">Thời gian làm (phút)</label>
            <input
              type="number"
              min="1"
              max="600"
              value={durationOverride}
              onChange={(e) => setDurationOverride(e.target.value)}
              placeholder={`Mặc định: ${currentExam?.duration_minutes ?? 45}`}
              className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pastel-purple"
            />
          </div>
        </div>

        <label className="flex items-center space-x-2 text-xs sm:text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showAnswers}
            onChange={(e) => setShowAnswers(e.target.checked)}
            className="rounded border-gray-300 text-pastel-purple focus:ring-pastel-purple"
          />
          <span className="font-medium text-gray-700">Cho phép học sinh xem đáp án và lời giải sau khi nộp bài</span>
        </label>

        <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={assigning}
            className="px-5 py-2 bg-gradient-to-r from-pastel-purple to-pastel-purpleDark text-white rounded-xl text-xs sm:text-sm font-bold hover:opacity-95 disabled:opacity-50 transition shadow-sm"
          >
            {assigning ? 'Đang giao bài...' : 'Xác nhận giao bài'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
