import React, { useEffect, useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api from '../../api/axios';
import { 
  BookOpen, CheckCircle, ArrowRight, KeyRound, Users, Clock, 
  Sparkles, Trophy, TrendingUp, FileText, Send, AlertTriangle, 
  Eye, GraduationCap, Flame, Award
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { SubmissionReviewModal } from '../../components/SubmissionReviewModal';

export function StudentDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [recentExams, setRecentExams] = useState([]);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [myClassrooms, setMyClassrooms] = useState([]);
  
  // Join classroom
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  // Review modal
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);

  const userStr = localStorage.getItem('user');
  let studentName = 'Học sinh';
  try {
    const user = userStr ? JSON.parse(userStr) : null;
    if (user?.full_name) studentName = user.full_name;
  } catch {}

  const loadData = async () => {
    try {
      setLoading(true);
      const [sumRes, examsRes, subRes, classRes] = await Promise.all([
        api.get('/student/dashboard-summary').catch(() => ({ data: null })),
        api.get('/student/exams').catch(() => ({ data: [] })),
        api.get('/student/history?limit=6').catch(() => ({ data: { items: [] } })),
        api.get('/student/classrooms').catch(() => ({ data: [] })),
      ]);

      const exams = Array.isArray(examsRes.data) ? examsRes.data : (examsRes.data?.items || []);
      const subs = Array.isArray(subRes.data?.items) ? subRes.data.items : (Array.isArray(subRes.data) ? subRes.data : []);
      const classes = Array.isArray(classRes.data) ? classRes.data : (classRes.data?.items || []);

      setSummary(sumRes.data);
      setRecentExams(exams.slice(0, 6));
      setRecentSubmissions(subs.slice(0, 5));
      setMyClassrooms(classes.slice(0, 4));
    } catch {
      toast.error('Không thể tải dữ liệu trang tổng quan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleJoinClass = async (e) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;

    setJoinLoading(true);
    try {
      const res = await api.post('/classrooms/join', { code });
      toast.success(`Chúc mừng bạn đã vào lớp "${res.data?.name || code}"!`);
      setJoinCode('');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Mã lớp không hợp lệ hoặc đã hết hạn');
    } finally {
      setJoinLoading(false);
    }
  };

  // Urgent pending count
  const pendingAssignmentsCount = summary?.pending_assignments_count ?? 0;
  const urgentCount = summary?.urgent_assignments_count ?? 0;
  const gpa = summary?.average_gpa ?? 0;
  const totalCompleted = summary?.total_completed ?? recentSubmissions.length;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex">
        <Sidebar role="student" />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 text-white p-5 sm:p-7 rounded-2xl shadow-xs mb-5 sm:mb-6 relative overflow-hidden">
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center space-x-2 bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold mb-3 border border-white/20">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Không gian Học tập & Rèn luyện TutorQuiz</span>
              </div>
              <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">
                Xin chào, {studentName}! 👋
              </h1>
              <p className="mt-2 text-indigo-100 text-xs sm:text-sm leading-relaxed">
                {pendingAssignmentsCount > 0 
                  ? `Bạn có ${pendingAssignmentsCount} bài tập cần hoàn thành. Hãy sắp xếp làm bài trước thời hạn nhé!`
                  : 'Tuyệt vời! Bạn đã hoàn thành tất cả bài tập được giao. Bạn có thể luyện tập tự do để nâng cao kỹ năng!'}
              </p>
            </div>
            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-8 translate-y-8">
              <GraduationCap className="w-64 h-64" />
            </div>
          </div>

          {/* Urgent Homework Callout (if any urgent) */}
          {urgentCount > 0 && (
            <div className="bg-rose-50 border border-rose-200 p-4 sm:p-5 rounded-xl shadow-2xs mb-5 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in">
              <div className="flex items-center space-x-3.5">
                <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-xs shrink-0">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-rose-900 text-xs sm:text-sm">
                    Cảnh báo: Có {urgentCount} bài tập sắp hết hạn (dưới 24h)!
                  </h3>
                  <p className="text-[11px] text-rose-700 mt-0.5">
                    Hãy nộp bài đúng hạn để đảm bảo kết quả đánh giá của thầy cô.
                  </p>
                </div>
              </div>
              <Link
                to="/student/assignments"
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold text-xs rounded-xl transition shadow-2xs whitespace-nowrap flex items-center justify-center space-x-1.5"
              >
                <span>Làm ngay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* KPI Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-5 sm:mb-6">
            {/* Card 1: Pending Assignments */}
            <Link
              to="/student/assignments"
              className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-indigo-300 transition group interactive-card"
            >
              <div className="flex items-center space-x-3 mb-2.5">
                <div className="bg-blue-50 text-blue-600 p-2 sm:p-2.5 rounded-xl group-hover:scale-105 transition">
                  <Send className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm text-slate-500 font-medium">Bài cần nộp</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">{pendingAssignmentsCount}</h3>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center space-x-1">
                <span>Chưa hoàn thành</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
              </p>
            </Link>

            {/* Card 2: Completed Exams */}
            <Link
              to="/student/history"
              className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-emerald-300 transition group interactive-card"
            >
              <div className="flex items-center space-x-3 mb-2.5">
                <div className="bg-emerald-50 text-emerald-600 p-2 sm:p-2.5 rounded-xl group-hover:scale-105 transition">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm text-slate-500 font-medium">Đã hoàn thành</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">{totalCompleted}</h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">Bài đã nộp</p>
            </Link>

            {/* Card 3: GPA */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs interactive-card">
              <div className="flex items-center space-x-3 mb-2.5">
                <div className="bg-amber-50 text-amber-600 p-2 sm:p-2.5 rounded-xl">
                  <Trophy className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm text-slate-500 font-medium">Điểm trung bình</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                {gpa > 0 ? gpa.toFixed(1) : '—'}
                <span className="text-xs font-normal text-slate-400 ml-1">/ 10</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">
                {gpa >= 8.0 ? 'Học lực Tốt' : gpa >= 6.5 ? 'Học lực Khá' : gpa > 0 ? 'Cần cố gắng thêm' : 'Chưa có điểm'}
              </p>
            </div>

            {/* Card 4: Classrooms */}
            <Link
              to="/student/classrooms"
              className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-blue-300 transition group interactive-card"
            >
              <div className="flex items-center space-x-3 mb-2.5">
                <div className="bg-indigo-50 text-indigo-600 p-2 sm:p-2.5 rounded-xl group-hover:scale-105 transition">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-xs sm:text-sm text-slate-500 font-medium">Lớp theo học</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">{summary?.classrooms_count ?? myClassrooms.length}</h3>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center space-x-1">
                <span>Nhóm & Lớp học</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
              </p>
            </Link>
          </div>

          {/* Quick Actions Bar */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs mb-5 sm:mb-6">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base mb-4 flex items-center space-x-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Lối tắt học tập</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
              <Link
                to="/student/assignments"
                className="p-3.5 sm:p-4 rounded-xl bg-slate-50 hover:bg-white hover:border-blue-300 border border-slate-200/80 transition group flex flex-col justify-between min-h-[96px]"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-105 transition">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-slate-800">Bài tập cần nộp</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Thời hạn & đề bài</div>
                </div>
              </Link>

              <Link
                to="/student/exams"
                className="p-3.5 sm:p-4 rounded-xl bg-slate-50 hover:bg-white hover:border-indigo-300 border border-slate-200/80 transition group flex flex-col justify-between min-h-[96px]"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-105 transition">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-slate-800">Đề thi & Kiểm tra</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Phòng thi trực tuyến</div>
                </div>
              </Link>

              <Link
                to="/student/history"
                className="p-3.5 sm:p-4 rounded-xl bg-slate-50 hover:bg-white hover:border-amber-300 border border-slate-200/80 transition group flex flex-col justify-between min-h-[96px]"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-105 transition">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-slate-800">Sổ điểm & Lịch sử</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Tiến độ & kết quả</div>
                </div>
              </Link>

              <Link
                to="/student/classrooms"
                className="p-3.5 sm:p-4 rounded-xl bg-slate-50 hover:bg-white hover:border-emerald-300 border border-slate-200/80 transition group flex flex-col justify-between min-h-[96px]"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-105 transition">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-slate-800">Lớp học của tôi</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Danh sách lớp học</div>
                </div>
              </Link>
            </div>
          </div>

          {/* Quick Join Classroom Form Box */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs mb-5 sm:mb-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">Tham gia lớp học bằng mã</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Nhập mã 6 ký tự do thầy cô cung cấp để nhận đề bài ngay</p>
                </div>
              </div>

              <form onSubmit={handleJoinClass} className="flex items-stretch sm:items-center space-x-2 w-full md:w-auto">
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="MÃ LỚP (VD: TOAN9A)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="px-4 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono uppercase font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center tracking-wider flex-1 md:w-48"
                />
                <button
                  type="submit"
                  disabled={joinLoading || !joinCode.trim()}
                  className="px-4 py-2.5 min-h-[44px] bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-xl transition shadow-2xs disabled:opacity-50 whitespace-nowrap flex items-center justify-center cursor-pointer"
                >
                  {joinLoading ? 'Đang vào…' : 'Gia nhập'}
                </button>
              </form>
            </div>
          </div>

          {/* Two-Column Grid: Assigned Exams & Recent Submissions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
            {/* Left: Assigned Exams / Homework */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    <span>Bài tập & Đề thi cần làm</span>
                  </h3>
                  <Link to="/student/assignments" className="min-h-[44px] px-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1">
                    <span>Xem tất cả</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {recentExams.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-600 font-medium">Hiện không có bài tập nào cần làm</p>
                    <p className="text-xs text-slate-400 mt-1">Khi thầy cô giao bài, danh sách sẽ hiển thị ở đây.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {recentExams.map(exam => {
                      const isAssignment = exam.exam_type === 'ASSIGNMENT';
                      return (
                        <div key={exam.id} className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/70 border border-slate-200/70 transition flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                                isAssignment ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}>
                                {isAssignment ? 'Bài tập' : 'Đề thi'}
                              </span>
                              {exam.classroom_name && (
                                <span className="text-[11px] text-slate-500 truncate max-w-[140px]">
                                  {exam.classroom_name}
                                </span>
                              )}
                            </div>
                            <h4 className="font-semibold text-xs sm:text-sm text-slate-800 truncate">{exam.title}</h4>
                            <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-1">
                              <span className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{exam.duration_minutes ? `${exam.duration_minutes} phút` : 'Tự do'}</span>
                              </span>
                              <span>• {exam.question_count || 0} câu</span>
                              {exam.subject && <span>• {exam.subject}</span>}
                            </div>
                          </div>

                          <Link
                            to={`/take-exam/${exam.id}`}
                            className="min-h-[44px] px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition shadow-2xs whitespace-nowrap flex items-center justify-center shrink-0"
                          >
                            Làm bài
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Recent Submissions with Review Modal */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center space-x-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span>Kết quả bài nộp gần đây</span>
                  </h3>
                  <Link to="/student/history" className="min-h-[44px] px-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1">
                    <span>Lịch sử thi</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {recentSubmissions.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <Trophy className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-600 font-medium">Bạn chưa nộp bài thi nào</p>
                    <p className="text-xs text-slate-400 mt-1">Làm bài tập hoặc đề kiểm tra đầu tiên để xem kết quả.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {recentSubmissions.map(sub => {
                      const scoreNum = Number(sub.score ?? 0);
                      const isPassed = scoreNum >= 5.0;

                      return (
                        <div key={sub.id} className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/70 border border-slate-200/70 transition flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-xs sm:text-sm text-slate-800 truncate">{sub.exam_title || 'Bài thi'}</h4>
                            <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-1">
                              <span>Nộp: {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString('vi-VN') : '—'}</span>
                              {sub.attempt_number && <span>• Lần {sub.attempt_number}</span>}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
                            <div className="text-right">
                              <span className={`text-base font-extrabold ${isPassed ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {sub.score ?? 0}
                              </span>
                              <span className="text-[10px] text-slate-400">/10</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedSubmissionId(sub.id)}
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 active:bg-slate-100 transition shadow-2xs cursor-pointer"
                              title="Xem chi tiết & bài làm"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Review Modal for Submission Details */}
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
