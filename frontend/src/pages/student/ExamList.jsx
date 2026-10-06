import React, { useEffect, useState, useMemo } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api from '../../api/axios';
import { Link } from 'react-router-dom';
import { 
  Clock, Search, BookOpen, FileText, Sparkles, ArrowRight, 
  Award, Filter, CheckCircle2, RotateCcw, Eye, AlertCircle, ShieldAlert
} from 'lucide-react';
import { SubmissionReviewModal } from '../../components/SubmissionReviewModal';

export function ExamList() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'COMPLETED'
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);

  useEffect(() => {
    api.get('/student/exams')
      .then(res => setExams(Array.isArray(res.data) ? res.data : (res.data?.items || [])))
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  }, []);

  const subjects = useMemo(() => {
    const s = [...new Set(exams.map(e => e.subject).filter(Boolean))];
    return s;
  }, [exams]);

  // Formal exams: exams where exam_type === 'EXAM' or not set to 'ASSIGNMENT'
  const formalExams = useMemo(() => {
    return exams.filter(e => e.exam_type !== 'ASSIGNMENT');
  }, [exams]);

  const filtered = useMemo(() => {
    return formalExams.filter(e => {
      if (search && !(e.title || '').toLowerCase().includes(search.toLowerCase()) && !(e.description || '').toLowerCase().includes(search.toLowerCase())) return false;
      if (subjectFilter && e.subject !== subjectFilter) return false;

      const attemptsTaken = e.attempts_taken || 0;
      if (statusFilter === 'PENDING' && attemptsTaken > 0) return false;
      if (statusFilter === 'COMPLETED' && attemptsTaken === 0) return false;

      return true;
    });
  }, [formalExams, search, subjectFilter, statusFilter]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex">
        <Sidebar role="student" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span>Kỳ thi & Kiểm tra trực tuyến</span>
                </h1>
                <p className="text-xs text-slate-500 mt-1">Phòng thi chính thức cho các bài khảo sát định kỳ, kiểm tra 1 tiết và thi học kỳ</p>
              </div>

              <div className="flex items-center space-x-2">
                <Link
                  to="/student/assignments"
                  className="text-xs font-semibold bg-white border border-slate-200 px-3.5 py-2 rounded-xl hover:bg-slate-50 transition shadow-2xs text-slate-700 flex items-center space-x-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Xem bài tập về nhà</span>
                </Link>
                <Link
                  to="/student/history"
                  className="text-xs font-semibold bg-indigo-600 text-white px-3.5 py-2 rounded-xl hover:bg-indigo-700 transition shadow-xs flex items-center space-x-1.5"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Sổ điểm & Bài nộp</span>
                </Link>
              </div>
            </div>

            {/* Quick Notice Banner */}
            <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-2xl mb-6 flex items-start space-x-3 text-xs text-indigo-950">
              <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Lưu ý khi làm bài thi:</span> Thời gian thi sẽ bắt đầu đếm ngược ngay khi bạn bấm nút "Vào phòng thi". Đề thi sẽ tự động nộp khi hết giờ. Hãy đảm bảo đường truyền mạng ổn định trước khi bắt đầu.
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Tìm theo tên đề thi hoặc môn học..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800 transition"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Subject filter */}
                <select
                  value={subjectFilter}
                  onChange={e => setSubjectFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="">Tất cả môn học</option>
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="PENDING">Chưa thi</option>
                  <option value="COMPLETED">Đã thi</option>
                </select>

                {(search || subjectFilter || statusFilter !== 'ALL') && (
                  <button
                    onClick={() => { setSearch(''); setSubjectFilter(''); setStatusFilter('ALL'); }}
                    className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Xóa lọc
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Exam Grid */}
          {loading ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/90 shadow-xs">
              <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
              <div className="text-slate-600 font-medium text-sm animate-pulse">Đang tải danh sách bài thi...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/90 shadow-xs">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">Chưa tìm thấy bài thi phù hợp</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Hiện tại không có đề thi nào khả dụng theo bộ lọc của bạn. Bạn có thể kiểm tra mục "Bài tập cần nộp" hoặc xóa bộ lọc để tìm lại.
              </p>
              <div className="mt-4 flex items-center justify-center space-x-3">
                <Link
                  to="/student/assignments"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition shadow-xs"
                >
                  Xem bài tập cần nộp
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(exam => {
                const maxAttempts = exam.max_attempts || 1;
                const attemptsTaken = exam.attempts_taken || 0;
                const attemptsLeft = Math.max(0, maxAttempts - attemptsTaken);
                const isExhausted = attemptsLeft === 0;
                const hasTaken = attemptsTaken > 0;

                return (
                  <div
                    key={exam.id}
                    className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {exam.classroom_name || 'Kỳ thi chung'}
                        </span>
                        <div className="flex items-center space-x-1 text-xs text-slate-600 font-semibold bg-slate-50 px-2.5 py-1 rounded-xl tabular-nums">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{exam.duration_minutes || 45} phút</span>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <h3 className="font-bold text-base text-slate-900 group-hover:text-indigo-600 transition line-clamp-2 mb-1.5">
                        {exam.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 min-h-[2.5em] mb-4">
                        {exam.description || 'Bài thi trắc nghiệm trực tuyến tính giờ tự động.'}
                      </p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        <span className="text-[11px] px-2.5 py-1 bg-blue-50 text-blue-700 rounded-xl font-bold border border-blue-100 tabular-nums">
                          {exam.question_count || 0} câu hỏi
                        </span>
                        {exam.subject && (
                          <span className="text-[11px] px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-xl font-bold border border-indigo-100">
                            {exam.subject}
                          </span>
                        )}
                        {exam.grade_level && (
                          <span className="text-[11px] px-2.5 py-1 bg-slate-100 text-slate-700 rounded-xl font-medium border border-slate-200">
                            Khối {exam.grade_level}
                          </span>
                        )}
                      </div>

                      {/* Score or Attempt Info */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs mb-4">
                        <div className="flex items-center justify-between mb-1 tabular-nums">
                          <span className="text-slate-500 font-medium">Lượt làm bài:</span>
                          <span className={`font-bold ${isExhausted ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {isExhausted ? `Hết lượt (${attemptsTaken}/${maxAttempts})` : `Còn ${attemptsLeft}/${maxAttempts} lượt`}
                          </span>
                        </div>
                        {hasTaken && exam.highest_score !== undefined && exam.highest_score !== null && (
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 tabular-nums">
                            <span className="text-slate-500 font-medium">Điểm cao nhất:</span>
                            <span className="font-extrabold text-indigo-700">
                              {exam.highest_score} / 10
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2 flex items-center gap-2">
                      {/* If user took exam and has latest submission, provide review button */}
                      {hasTaken && exam.latest_submission_id && (
                        <button
                          type="button"
                          onClick={() => setSelectedSubmissionId(exam.latest_submission_id)}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center justify-center space-x-1 cursor-pointer"
                          title="Xem lại bài làm & lời giải"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem giải</span>
                        </button>
                      )}

                      {/* Main Action Button */}
                      {isExhausted ? (
                        <Link
                          to="/student/history"
                          className="flex-1 py-2 bg-slate-100 text-slate-700 text-center text-xs font-semibold rounded-xl hover:bg-slate-200 transition shadow-2xs flex items-center justify-center space-x-1"
                        >
                          <span>Xem lịch sử thi</span>
                        </Link>
                      ) : (
                        <Link
                          to={`/take-exam/${exam.id}`}
                          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-center text-xs font-semibold rounded-xl transition shadow-xs flex items-center justify-center space-x-1.5"
                        >
                          <span>{hasTaken ? `Thi lại (${attemptsTaken}/${maxAttempts})` : 'Vào phòng thi'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Review Modal for Instant Solutions */}
      {selectedSubmissionId && (
        <SubmissionReviewModal
          isOpen={Boolean(selectedSubmissionId)}
          submissionId={selectedSubmissionId}
          onClose={() => setSelectedSubmissionId(null)}
        />
      )}
    </div>
  );
}
