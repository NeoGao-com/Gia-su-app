import React, { useEffect, useState, useMemo } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api from '../../api/axios';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Send, Search, Clock, Award, AlertCircle, CheckCircle2, 
  Layers, ArrowRight, Play, BookOpen, Filter, Calendar, RefreshCw
} from 'lucide-react';
import { SubmissionReviewModal } from '../../components/SubmissionReviewModal';

export function StudentAssignments() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'urgent' | 'pending' | 'completed'
  const [classroomFilter, setClassroomFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [reviewSubmissionId, setReviewSubmissionId] = useState(null);

  const loadAssignments = () => {
    setLoading(true);
    api.get('/student/exams')
      .then(res => {
        const raw = Array.isArray(res.data) ? res.data : (res.data?.items || []);
        // Filter out items that are assignments (or have classroom_id/due_date or exam_type == 'ASSIGNMENT')
        // Also keep published exams that are treated as homework
        const asgns = raw.filter(e => e.exam_type === 'ASSIGNMENT' || e.classroom_id || e.due_date);
        // If no explicit assignments found, show all exams as assignments fallback
        setAssignments(asgns.length > 0 ? asgns : raw);
      })
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  const STANDARD_SUBJECTS = ['Toán học', 'Vật lý', 'Hóa học', 'Sinh học', 'Tiếng Anh', 'Ngữ văn', 'Lịch sử', 'Địa lý', 'Tin học', 'GDCD'];
  const STANDARD_GRADES = [6, 7, 8, 9, 10, 11, 12];

  const classrooms = useMemo(() => {
    return [...new Set(assignments.map(a => a.classroom_name).filter(Boolean))];
  }, [assignments]);

  const subjects = useMemo(() => {
    const fromAssignments = assignments.map(a => a.subject).filter(Boolean);
    return [...new Set([...STANDARD_SUBJECTS, ...fromAssignments])];
  }, [assignments]);

  const gradeLevels = useMemo(() => {
    const fromAssignments = assignments.map(a => a.grade_level).filter(Boolean).map(Number);
    return [...new Set([...STANDARD_GRADES, ...fromAssignments])].sort((a, b) => a - b);
  }, [assignments]);

  const now = new Date();

  // Filtered list
  const filtered = useMemo(() => {
    return assignments.filter(item => {
      // Search
      if (search) {
        const matchTitle = (item.title || '').toLowerCase().includes(search.toLowerCase());
        const matchDesc = (item.description || '').toLowerCase().includes(search.toLowerCase());
        const matchClass = (item.classroom_name || '').toLowerCase().includes(search.toLowerCase());
        if (!matchTitle && !matchDesc && !matchClass) return false;
      }

      // Classroom filter
      if (classroomFilter && item.classroom_name !== classroomFilter) return false;

      // Subject filter
      if (subjectFilter && item.subject !== subjectFilter) return false;

      // Grade level filter
      if (gradeFilter && String(item.grade_level) !== String(gradeFilter)) return false;

      const isCompleted = item.latest_status && item.latest_status !== 'IN_PROGRESS' && item.latest_status !== 'NOT_STARTED';
      const isOverdue = item.due_date && new Date(item.due_date) < now;
      const isUrgent = item.due_date && !isCompleted && (new Date(item.due_date) - now < 24 * 3600 * 1000);

      // Tabs
      if (activeTab === 'urgent' && !isOverdue && !isUrgent) return false;
      if (activeTab === 'pending' && isCompleted) return false;
      if (activeTab === 'completed' && !isCompleted) return false;

      return true;
    });
  }, [assignments, search, classroomFilter, subjectFilter, gradeFilter, activeTab, now]);

  const pendingCount = assignments.filter(a => a.latest_status === 'NOT_STARTED' || a.latest_status === 'IN_PROGRESS').length;
  const completedCount = assignments.filter(a => a.latest_status && a.latest_status !== 'IN_PROGRESS' && a.latest_status !== 'NOT_STARTED').length;
  const urgentCount = assignments.filter(a => {
    const isCompleted = a.latest_status && a.latest_status !== 'IN_PROGRESS' && a.latest_status !== 'NOT_STARTED';
    return !isCompleted && a.due_date && (new Date(a.due_date) < now || (new Date(a.due_date) - now < 24 * 3600 * 1000));
  }).length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Navbar />
      <div className="flex">
        <Sidebar role="student" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2.5">
                <Send className="w-7 h-7 text-indigo-600" />
                <span>Bài tập về nhà &amp; Nhiệm vụ học tập</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Theo dõi các bài tập được thầy cô giao cho lớp, thời hạn nộp và tiến độ hoàn thành.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-xs font-bold bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-xs text-slate-700 tabular-nums">
                Tổng: {assignments.length} bài
              </span>
              <button
                type="button"
                onClick={loadAssignments}
                className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs text-slate-600 transition cursor-pointer"
                title="Tải lại danh sách"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Bar & Tabs */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm space-y-3 mb-6">
            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả ({assignments.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('urgent')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1 ${
                  activeTab === 'urgent'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Cần làm gấp / Quá hạn ({urgentCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pending')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                Chưa hoàn thành ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('completed')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1 ${
                  activeTab === 'completed'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Đã nộp ({completedCount})</span>
              </button>
            </div>

            {/* Inputs & Dropdowns */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Tìm theo tên bài tập, nội dung hoặc lớp học..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {classrooms.length > 0 && (
                  <select
                    value={classroomFilter}
                    onChange={e => setClassroomFilter(e.target.value)}
                    className="p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="">Tất cả lớp học</option>
                    {classrooms.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}

                <select
                  value={subjectFilter}
                  onChange={e => setSubjectFilter(e.target.value)}
                  className="p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600"
                >
                  <option value="">Tất cả môn</option>
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                <select
                  value={gradeFilter}
                  onChange={e => setGradeFilter(e.target.value)}
                  className="p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-600"
                >
                  <option value="">Tất cả khối lớp</option>
                  {gradeLevels.map(g => <option key={g} value={g}>Khối {g}</option>)}
                </select>

                {(search || classroomFilter || subjectFilter || gradeFilter) && (
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setClassroomFilter(''); setSubjectFilter(''); setGradeFilter(''); }}
                    className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Xóa lọc
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Assignments Grid */}
          {loading ? (
            <div className="bg-white rounded-2xl p-16 text-center border border-slate-200/90 shadow-sm space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-sm font-semibold text-slate-600">Đang tải danh sách bài tập...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl p-16 text-center border border-slate-200/90 shadow-sm space-y-3">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                <Send className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Không có bài tập nào phù hợp</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {activeTab === 'urgent' 
                  ? 'Tuyệt vời! Bạn không có bài tập nào bị quá hạn hoặc cần nộp gấp.' 
                  : 'Chưa có bài tập nào được giao trong mục này. Hãy kiểm tra lại sau nhé!'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((item) => {
                const isCompleted = item.latest_status && item.latest_status !== 'IN_PROGRESS' && item.latest_status !== 'NOT_STARTED';
                const isInProgress = item.latest_status === 'IN_PROGRESS';
                const isOverdue = item.due_date && new Date(item.due_date) < now && !isCompleted;

                // Format due date
                let dueBadge = null;
                if (item.due_date) {
                  const dueDateObj = new Date(item.due_date);
                  const diffHours = (dueDateObj - now) / (1000 * 3600);

                  if (isOverdue) {
                    dueBadge = (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        <span>Quá hạn nộp</span>
                      </span>
                    );
                  } else if (diffHours < 24 && !isCompleted) {
                    dueBadge = (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold animate-pulse">
                        <Clock className="w-3 h-3 text-amber-600" />
                        <span>Còn {Math.max(1, Math.round(diffHours))}h</span>
                      </span>
                    );
                  } else {
                    dueBadge = (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-[11px] font-medium">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Hạn: {dueDateObj.toLocaleDateString('vi-VN')}</span>
                      </span>
                    );
                  }
                }

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-300 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Top tags */}
                      <div className="flex flex-wrap justify-between items-center gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {item.classroom_name && (
                            <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-md text-[10px] font-bold">
                              {item.classroom_name}
                            </span>
                          )}
                          {item.subject && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold">
                              {item.subject} {item.grade_level ? `Lớp ${item.grade_level}` : ''}
                            </span>
                          )}
                        </div>

                        {dueBadge}
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3 className="text-base font-bold text-slate-900 line-clamp-2 leading-snug">
                          {item.title}
                        </h3>
                        {item.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Meta badges */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                        <span className="flex items-center space-x-1 tabular-nums">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.duration_minutes} phút</span>
                        </span>
                        <span className="flex items-center space-x-1 tabular-nums">
                          <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.question_count} câu hỏi</span>
                        </span>
                        <span className="tabular-nums">• Lần làm: {item.attempts_taken || 0}/{item.max_attempts || 1}</span>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      {isCompleted ? (
                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-lg text-xs font-bold flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="tabular-nums">Đã nộp: {item.highest_score !== null ? `${item.highest_score}đ` : 'Đã chấm'}</span>
                          </span>
                        </div>
                      ) : isInProgress ? (
                        <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                          <span>Đang làm dở</span>
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">
                          Chưa bắt đầu
                        </span>
                      )}

                      <div className="flex items-center space-x-2">
                        {isCompleted && item.latest_submission_id && (
                          <button
                            type="button"
                            onClick={() => setReviewSubmissionId(item.latest_submission_id)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            Xem bài làm
                          </button>
                        )}

                        {(!isCompleted || (item.attempts_taken < (item.max_attempts || 1))) && (
                          <Link
                            to={`/take-exam/${item.id}`}
                            className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-xl text-xs font-bold shadow-xs transition ${
                              isInProgress 
                                ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
                            }`}
                          >
                            <span>{isInProgress ? 'Làm tiếp' : isCompleted ? 'Làm lại' : 'Bắt đầu làm'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Submission Review Modal */}
          <SubmissionReviewModal
            isOpen={Boolean(reviewSubmissionId)}
            submissionId={reviewSubmissionId}
            onClose={() => setReviewSubmissionId(null)}
          />
        </main>
      </div>
    </div>
  );
}
