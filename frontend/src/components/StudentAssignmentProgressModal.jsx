import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  X, Search, Award, Clock, CheckCircle2, AlertCircle, 
  RotateCcw, Eye, BookOpen, Users, RefreshCw, 
  Calendar, Mail, Phone, FileText
} from 'lucide-react';
import { Modal } from './Modal';
import { SubmissionReviewModal } from './SubmissionReviewModal';
import api, { clearApiCache } from '../api/axios';
import { useToast } from '../context/ToastContext';

/**
 * Format datetime ISO string to 'dd/MM/yyyy HH:mm'
 */
function formatDateTime(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Format seconds spent to readable duration string e.g. '15p 30s'
 */
function formatTimeSpent(seconds) {
  if (!seconds || seconds <= 0) return '0 giây';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} giây`;
  if (s === 0) return `${m} phút`;
  return `${m}p ${s}s`;
}

export function StudentAssignmentProgressModal({
  isOpen,
  onClose,
  student,
  classroom,
  onSubmissionDeleted
}) {
  const { toast, confirm } = useToast();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'completed' | 'uncompleted'

  // Submission review modal
  const [selectedReviewSubmissionId, setSelectedReviewSubmissionId] = useState(null);

  // Deleting submission id state for spinner
  const [deletingSubmissionId, setDeletingSubmissionId] = useState(null);

  // Data fetching
  const fetchProgress = useCallback(async () => {
    if (!classroom?.id || !student?.id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/classrooms/${classroom.id}/students/${student.id}/assignments`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load student assignment progress:', err);
      setError(err.response?.data?.detail || 'Không thể tải tiến độ bài tập của học sinh.');
    } finally {
      setLoading(false);
    }
  }, [classroom?.id, student?.id]);

  useEffect(() => {
    if (isOpen && classroom?.id && student?.id) {
      fetchProgress();
    } else {
      setData(null);
      setError(null);
      setSearchQuery('');
      setFilterTab('all');
    }
  }, [isOpen, classroom?.id, student?.id, fetchProgress]);

  // Handle delete submission & reset attempt
  const handleDeleteSubmission = async (submission, assignmentTitle) => {
    if (!classroom?.id || !student?.id || !submission?.id) return;

    const confirmed = await confirm({
      title: 'Xóa bài nộp & Đặt lại lượt làm',
      message: 'Bạn có chắc chắn muốn xóa bài nộp này không? Bản ghi bài nộp sẽ bị xóa khỏi cơ sở dữ liệu và lượt làm bài của học sinh sẽ được đặt lại để học sinh có thể làm lại bài.',
      confirmText: 'Xóa bài nộp',
      cancelText: 'Hủy'
    });

    if (!confirmed) return;

    try {
      setDeletingSubmissionId(submission.id);
      await api.delete(`/classrooms/${classroom.id}/students/${student.id}/submissions/${submission.id}`);
      
      // Invalidate client cache
      clearApiCache();

      toast.success('Đã xóa bài nộp và đặt lại lượt làm bài thành công');

      // Re-fetch current progress
      await fetchProgress();

      // Trigger optional callback for parent
      if (typeof onSubmissionDeleted === 'function') {
        onSubmissionDeleted({
          submissionId: submission.id,
          studentId: student.id,
          classroomId: classroom.id,
          assignmentTitle
        });
      }
    } catch (err) {
      console.error('Failed to delete submission:', err);
      toast.error(err.response?.data?.detail || 'Lỗi khi xóa bài nộp. Vui lòng thử lại.');
    } finally {
      setDeletingSubmissionId(null);
    }
  };

  const assignments = useMemo(() => {
    return Array.isArray(data?.assignments) ? data.assignments : [];
  }, [data]);

  // Summary KPI metrics
  const kpis = useMemo(() => {
    const total = assignments.length;
    const completed = assignments.filter(a => a.is_completed || a.status === 'COMPLETED').length;
    const uncompleted = total - completed;

    // Average score across completed assignments with scores
    const scoredList = assignments
      .map(a => a.score)
      .filter(s => s !== null && s !== undefined && !isNaN(Number(s)));
    
    const avgScore = scoredList.length > 0
      ? (scoredList.reduce((acc, curr) => acc + Number(curr), 0) / scoredList.length).toFixed(1)
      : null;

    return { total, completed, uncompleted, avgScore };
  }, [assignments]);

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => {
      const isCompleted = a.is_completed || a.status === 'COMPLETED';
      if (filterTab === 'completed' && !isCompleted) return false;
      if (filterTab === 'uncompleted' && isCompleted) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const titleMatch = (a.title || '').toLowerCase().includes(query);
        const descMatch = (a.description || '').toLowerCase().includes(query);
        return titleMatch || descMatch;
      }
      return true;
    });
  }, [assignments, filterTab, searchQuery]);

  // Compute status badge properties
  const getStatusBadge = (assignment) => {
    const isCompleted = assignment.is_completed || assignment.status === 'COMPLETED';
    if (isCompleted) {
      return {
        label: 'Đã hoàn thành',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };
    }
    if (assignment.status === 'IN_PROGRESS') {
      return {
        label: 'Đang làm',
        className: 'bg-amber-50 text-amber-700 border-amber-200'
      };
    }
    if (assignment.due_date && new Date(assignment.due_date) < new Date()) {
      return {
        label: 'Quá hạn',
        className: 'bg-rose-50 text-rose-700 border-rose-200'
      };
    }
    return {
      label: 'Chưa làm',
      className: 'bg-slate-50 text-slate-700 border-slate-200'
    };
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Tiến độ bài tập & Lịch sử làm bài của học sinh"
        size="xl"
      >
        <div className="space-y-6">
          {/* Header Card: Student Info & Classroom */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center space-x-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center text-lg font-black shrink-0 shadow-inner">
                  {(student?.full_name || student?.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-white truncate">
                      {student?.full_name || 'Học sinh'}
                    </h3>
                    {student?.student_code && (
                      <span className="text-[11px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-md font-mono font-bold">
                        Mã: {student.student_code}
                      </span>
                    )}
                    {student?.grade_level && (
                      <span className="text-[11px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-md font-semibold">
                        Khối {student.grade_level}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                    {student?.email && (
                      <span className="flex items-center space-x-1 font-mono">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span>{student.email}</span>
                      </span>
                    )}
                    {student?.phone_number && (
                      <span className="flex items-center space-x-1">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>{student.phone_number}</span>
                      </span>
                    )}
                    <span className="flex items-center space-x-1 text-indigo-300 font-medium">
                      <Users className="w-3.5 h-3.5" />
                      <span>Lớp: {classroom?.name || data?.classroom_name || 'Lớp học'}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action: Refresh Data */}
              <button
                type="button"
                onClick={fetchProgress}
                disabled={loading}
                className="shrink-0 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition border border-slate-800 hover:border-slate-700 flex items-center space-x-1.5 text-xs cursor-pointer"
                title="Tải lại dữ liệu tiến độ"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
                <span className="hidden sm:inline font-semibold">Làm mới</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* KPI 1: Total */}
            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight">Tổng bài tập</p>
                <p className="text-xl font-black text-slate-800 tabular-nums">{kpis.total}</p>
              </div>
            </div>

            {/* KPI 2: Completed */}
            <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200/80 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-tight">Đã hoàn thành</p>
                <p className="text-xl font-black text-emerald-900 tabular-nums">{kpis.completed}</p>
              </div>
            </div>

            {/* KPI 3: In Progress / Pending */}
            <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-tight">Chưa làm / Đang làm</p>
                <p className="text-xl font-black text-amber-900 tabular-nums">{kpis.uncompleted}</p>
              </div>
            </div>

            {/* KPI 4: Average Score */}
            <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-200/80 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-tight">Điểm trung bình</p>
                <div className="flex items-baseline space-x-1">
                  <span className="text-xl font-black text-indigo-950 tabular-nums">
                    {kpis.avgScore !== null ? kpis.avgScore : '-'}
                  </span>
                  {kpis.avgScore !== null && (
                    <span className="text-xs font-semibold text-slate-500">/ 10</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm bài tập theo tên đề thi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition bg-slate-50/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs shrink-0">
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer tabular-nums ${
                  filterTab === 'all'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({assignments.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('completed')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer tabular-nums ${
                  filterTab === 'completed'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đã nộp ({kpis.completed})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('uncompleted')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer tabular-nums ${
                  filterTab === 'uncompleted'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Chưa nộp ({kpis.uncompleted})
              </button>
            </div>
          </div>

          {/* Assignments & Submissions List */}
          <div className="space-y-4 max-h-[58vh] overflow-y-auto pr-1">
            {loading ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                <p className="text-sm font-semibold text-slate-600">Đang tải dữ liệu tiến độ bài tập của học sinh...</p>
              </div>
            ) : error ? (
              <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
                <p className="text-sm font-semibold text-rose-800">{error}</p>
                <button
                  type="button"
                  onClick={fetchProgress}
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition"
                >
                  Thử lại
                </button>
              </div>
            ) : assignments.length === 0 ? (
              <div className="py-16 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">Chưa có bài tập nào được giao cho lớp này</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Hãy vào mục "Quản lý bài tập" để giao đề thi hoặc bài tập cho lớp học.
                </p>
              </div>
            ) : filteredAssignments.length === 0 ? (
              <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">Không tìm thấy bài tập nào phù hợp với bộ lọc</p>
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setFilterTab('all'); }}
                  className="mt-2 text-xs text-indigo-600 font-bold hover:underline"
                >
                  Xóa bộ lọc
                </button>
              </div>
            ) : (
              filteredAssignments.map((assignment) => {
                const statusBadge = getStatusBadge(assignment);
                const hasSubmissions = Array.isArray(assignment.submissions) && assignment.submissions.length > 0;
                const scoreNum = assignment.score !== null && assignment.score !== undefined ? Number(assignment.score) : null;

                return (
                  <div
                    key={assignment.assignment_id || assignment.exam_id}
                    className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-slate-300 transition space-y-3.5"
                  >
                    {/* Top Row: Assignment Title, Meta, Status & Overall Score */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {assignment.exam_type === 'PRACTICE' ? 'Luyện tập' : 'Bài thi/Kiểm tra'}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-slate-900 leading-snug">
                          {assignment.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                          <span className="flex items-center space-x-1 tabular-nums">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{assignment.duration_minutes} phút</span>
                          </span>
                          <span className="flex items-center space-x-1 tabular-nums">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {assignment.due_date 
                                ? `Hạn: ${formatDateTime(assignment.due_date)}`
                                : 'Không có hạn nộp'}
                            </span>
                          </span>
                          <span className="tabular-nums font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                            Lượt làm: {assignment.attempts_taken} / {assignment.max_attempts || 1}
                          </span>
                        </div>
                      </div>

                      {/* Best / Latest Score & Submitted At */}
                      <div className="flex items-center space-x-3 shrink-0 self-end sm:self-center">
                        {scoreNum !== null ? (
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Điểm cao nhất</span>
                            <div className="flex items-baseline space-x-1 justify-end">
                              <span className={`text-xl font-black tabular-nums ${
                                scoreNum >= 8.0 
                                  ? 'text-emerald-600' 
                                  : scoreNum >= 5.0 
                                    ? 'text-indigo-600' 
                                    : 'text-rose-600'
                              }`}>
                                {scoreNum}
                              </span>
                              <span className="text-xs text-slate-400 font-semibold">/ 10</span>
                            </div>
                            {assignment.submitted_at && (
                              <span className="text-[10px] text-slate-400 tabular-nums block">
                                Nộp: {formatDateTime(assignment.submitted_at)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                            Chưa có điểm
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Submissions & Attempt History Section */}
                    {hasSubmissions ? (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5 uppercase tracking-wide">
                            <FileText className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Lịch sử nộp bài ({assignment.submissions.length} lần làm)</span>
                          </span>
                        </div>

                        <div className="space-y-2">
                          {assignment.submissions.map((sub, index) => {
                            const attemptNum = sub.attempt_number || (assignment.submissions.length - index);
                            const isDeleting = deletingSubmissionId === sub.id;
                            const subScore = sub.score !== null && sub.score !== undefined ? Number(sub.score) : null;
                            const isInProgress = sub.status === 'IN_PROGRESS';

                            return (
                              <div
                                key={sub.id}
                                className={`p-3 rounded-xl border flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-xs transition ${
                                  isInProgress
                                    ? 'bg-amber-50/40 border-amber-200'
                                    : 'bg-slate-50/70 border-slate-200/80 hover:bg-white hover:shadow-2xs'
                                }`}
                              >
                                {/* Attempt details */}
                                <div className="space-y-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-extrabold text-slate-800 bg-slate-200/80 px-2 py-0.5 rounded-md text-[11px]">
                                      Lần #{attemptNum}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${
                                      isInProgress
                                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                                        : sub.grading_status === 'GRADED'
                                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                          : 'bg-sky-100 text-sky-800 border-sky-300'
                                    }`}>
                                      {isInProgress 
                                        ? 'Đang làm bài' 
                                        : sub.grading_status === 'GRADED'
                                          ? 'Đã chấm điểm'
                                          : 'Đã nộp bài'}
                                    </span>

                                    {/* Attempt score pill */}
                                    {subScore !== null && (
                                      <span className={`font-black px-2 py-0.5 rounded-md text-[11px] tabular-nums border ${
                                        subScore >= 8.0 
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                          : subScore >= 5.0 
                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                                            : 'bg-rose-50 text-rose-700 border-rose-200'
                                      }`}>
                                        Điểm: {subScore} / 10
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                                    {sub.submitted_at ? (
                                      <span className="tabular-nums">
                                        Nộp lúc: <b>{formatDateTime(sub.submitted_at)}</b>
                                      </span>
                                    ) : sub.started_at ? (
                                      <span className="tabular-nums">
                                        Bắt đầu: <b>{formatDateTime(sub.started_at)}</b>
                                      </span>
                                    ) : null}

                                    {sub.time_spent !== undefined && sub.time_spent > 0 && (
                                      <span className="tabular-nums">
                                        Thời gian: <b>{formatTimeSpent(sub.time_spent)}</b>
                                      </span>
                                    )}

                                    {sub.tab_switches > 0 && (
                                      <span className="text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                        Chuyển tab: {sub.tab_switches}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Actions for this submission attempt */}
                                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                                  {/* View Review Modal Button */}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedReviewSubmissionId(sub.id)}
                                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold flex items-center space-x-1 transition cursor-pointer border border-indigo-200/60"
                                    title="Xem chi tiết câu hỏi & bài làm"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Xem bài làm</span>
                                  </button>

                                  {/* Delete Submission / Reset Attempt Button */}
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => handleDeleteSubmission(sub, assignment.title)}
                                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold flex items-center space-x-1 transition cursor-pointer border border-rose-200/60 disabled:opacity-50"
                                    title="Xóa bài nộp này khỏi hệ thống và đặt lại lượt làm cho học sinh"
                                  >
                                    {isDeleting ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    )}
                                    <span>{isDeleting ? 'Đang xóa...' : 'Xóa bài nộp'}</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 text-center">
                        Học sinh chưa thực hiện lượt làm bài nào cho đề thi này.
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </Modal>

      {/* Submission Review Modal (Detail view for a submission) */}
      <SubmissionReviewModal
        isOpen={Boolean(selectedReviewSubmissionId)}
        onClose={() => setSelectedReviewSubmissionId(null)}
        submissionId={selectedReviewSubmissionId}
      />
    </>
  );
}

export default StudentAssignmentProgressModal;
