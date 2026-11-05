import React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  School,
  FileText,
  User,
  Calendar,
  RotateCcw,
  SlidersHorizontal,
  CheckCircle2,
} from 'lucide-react';

export function AnalyticsFilterBar({
  classrooms = [],
  exams = [],
  students = [],
  filters = {
    classroom_id: '',
    exam_id: '',
    student_id: '',
    date_range: 'all',
    attempt_filter: 'best',
  },
  onFilterChange,
  onReset,
  loading = false,
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Helper to update a single filter and synchronize URL search params
  const handleParamChange = (key, value) => {
    const updated = {
      ...filters,
      [key]: value,
    };

    // If changing classroom, reset student if that student doesn't belong to the new classroom
    if (key === 'classroom_id' && value !== filters.classroom_id) {
      updated.student_id = '';
    }

    if (onFilterChange) {
      onFilterChange(updated);
    }

    // Sync to URL search params
    const nextParams = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      nextParams.set(key, String(value));
    } else {
      nextParams.delete(key);
    }

    // Also support alternative camelCase aliases for deep linking compatibility
    if (key === 'classroom_id') {
      nextParams.delete('classroomId');
      if (updated.student_id === '') nextParams.delete('studentId');
    }
    if (key === 'exam_id') nextParams.delete('examId');
    if (key === 'student_id') nextParams.delete('studentId');
    if (key === 'date_range') nextParams.delete('dateRange');

    setSearchParams(nextParams, { replace: true });
  };

  const handleResetClick = () => {
    if (onReset) {
      onReset();
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('classroom_id');
    nextParams.delete('classroomId');
    nextParams.delete('exam_id');
    nextParams.delete('examId');
    nextParams.delete('student_id');
    nextParams.delete('studentId');
    nextParams.delete('date_range');
    nextParams.delete('dateRange');
    nextParams.delete('start_date');
    nextParams.delete('end_date');
    nextParams.set('attempt_filter', 'best');
    setSearchParams(nextParams, { replace: true });
  };

  // Active filters count
  const activeFiltersCount = [
    Boolean(filters.classroom_id),
    Boolean(filters.exam_id),
    Boolean(filters.student_id),
    filters.date_range && filters.date_range !== 'all',
    filters.attempt_filter && filters.attempt_filter !== 'best',
  ].filter(Boolean).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center space-x-2">
              <span>Bộ lọc phân tích đa chiều</span>
              {activeFiltersCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-700">
                  {activeFiltersCount} đang bật
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500">
              Lọc số liệu theo lớp học, đề thi, học sinh cụ thể và khoảng thời gian nộp bài
            </p>
          </div>
        </div>

        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={handleResetClick}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 active:scale-95 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đặt lại bộ lọc</span>
          </button>
        )}
      </div>

      {/* Select Controls Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* 1. Classroom Filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
            <School className="w-3.5 h-3.5 text-indigo-500" />
            <span>Lớp học</span>
          </label>
          <div className="relative">
            <select
              value={filters.classroom_id || ''}
              onChange={(e) => handleParamChange('classroom_id', e.target.value)}
              disabled={loading}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-8 text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition disabled:opacity-50"
            >
              <option value="">Tất cả lớp học</option>
              {classrooms.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} {cls.code ? `(${cls.code})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 2. Exam Filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
            <FileText className="w-3.5 h-3.5 text-blue-500" />
            <span>Đề thi / Bài tập</span>
          </label>
          <div className="relative">
            <select
              value={filters.exam_id || ''}
              onChange={(e) => handleParamChange('exam_id', e.target.value)}
              disabled={loading}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-8 text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition disabled:opacity-50"
            >
              <option value="">Tất cả đề thi</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. Student Filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
            <User className="w-3.5 h-3.5 text-emerald-500" />
            <span>Học sinh</span>
          </label>
          <div className="relative">
            <select
              value={filters.student_id || ''}
              onChange={(e) => handleParamChange('student_id', e.target.value)}
              disabled={loading}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-8 text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition disabled:opacity-50"
            >
              <option value="">Tất cả học sinh</option>
              {students.map((st) => (
                <option key={st.id || st.student_id} value={st.id || st.student_id}>
                  {st.full_name || st.student_name || st.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4. Date Range Filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
            <span>Khoảng thời gian</span>
          </label>
          <div className="relative">
            <select
              value={filters.date_range || 'all'}
              onChange={(e) => handleParamChange('date_range', e.target.value)}
              disabled={loading}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-8 text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition disabled:opacity-50"
            >
              <option value="all">Toàn thời gian</option>
              <option value="7d">7 ngày qua</option>
              <option value="30d">30 ngày qua</option>
              <option value="90d">Học kỳ này (90 ngày)</option>
            </select>
          </div>
        </div>

        {/* 5. Attempt Mode Filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />
            <span>Lượt làm bài</span>
          </label>
          <div className="relative">
            <select
              value={filters.attempt_filter || 'best'}
              onChange={(e) => handleParamChange('attempt_filter', e.target.value)}
              disabled={loading}
              className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-8 text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition disabled:opacity-50"
            >
              <option value="best">Lượt điểm cao nhất (Best)</option>
              <option value="latest">Lượt nộp mới nhất (Latest)</option>
              <option value="all">Tất cả lượt nộp bài (All)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
