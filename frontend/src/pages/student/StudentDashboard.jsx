import React, { useEffect, useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api from '../../api/axios';
import { 
  BookOpen, CheckCircle, ArrowRight, KeyRound, Users, Clock, 
  Sparkles, Trophy, TrendingUp, FileText, Send, AlertTriangle, 
  Eye, GraduationCap, Flame
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
    <div className="min-h-screen bg-pastel-bg">
      <Navbar />
      <div className="flex">
        <Sidebar role="student" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-pastel-purple via-pastel-purpleDark to-indigo-700 text-white p-6 sm:p-8 rounded-3xl shadow-sm mb-8 relative overflow-hidden">
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                <span>Không gian học tập & Ôn luyện thông minh</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Xin chào, {studentName}! 👋
              </h1>
              <p className="mt-2 text-white/90 text-xs sm:text-sm leading-relaxed">
                {pendingAssignmentsCount > 0 
                  ? `Bạn có ${pendingAssignmentsCount} bài tập cần hoàn thành. Hãy sắp xếp thời gian làm bài trước hạn chót nhé!`
                  : 'Tuyệt vời! Bạn đã hoàn thành tất cả bài tập được giao. Hãy tự luyện thêm hoặc thư giãn nhé!'}
              </p>
            </div>
            <div className="absolute right-0 bottom-0 opacity-15 pointer-events-none transform translate-x-8 translate-y-8">
              <GraduationCap className="w-64 h-64" />
            </div>
          </div>

          {/* Urgent Homework Callout (if any urgent) */}
          {urgentCount > 0 && (
            <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 p-5 rounded-3xl border border-rose-200 shadow-sm mb-8 flex items-center justify-between gap-4 animate-in fade-in">
              <div className="flex items-center space-x-3.5">
                <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-sm animate-pulse">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-rose-900 text-sm sm:text-base flex items-center space-x-2">
                    <span>Cảnh báo: Có {urgentCount} bài tập sắp đến hạn chót (dưới 24h)!</span>
                  </h3>
                  <p className="text-xs text-rose-700 mt-0.5">
                    Nộp bài trước hạn để tránh bị khóa lượt nộp hoặc trừ điểm chuyên cần.
                  </p>
                </div>
              </div>
              <Link
                to="/student/assignments"
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-2xl transition shadow-sm whitespace-nowrap flex items-center space-x-1.5"
              >
                <span>Xem & Làm ngay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* KPI Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            {/* Card 1: Pending Assignments */}
            <Link
              to="/student/assignments"
              className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 transition group"
            >
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-blue-50 text-blue-600 p-2.5 rounded-2xl group-hover:scale-105 transition">
                  <Send className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-medium">Bài tập về nhà</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-800">{pendingAssignmentsCount}</h3>
              <p className="text-[11px] text-gray-400 mt-1 flex items-center space-x-1">
                <span>Cần nộp</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
              </p>
            </Link>

            {/* Card 2: Completed Exmas */}
            <Link
              to="/student/history"
              className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 transition group"
            >
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-2xl group-hover:scale-105 transition">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-medium">Đã hoàn thành</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-800">{totalCompleted}</h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">Bài đã nộp</p>
            </Link>

            {/* Card 3: GPA */}
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-amber-50 text-amber-600 p-2.5 rounded-2xl">
                  <Trophy className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-medium">Điểm trung bình</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-800">
                {gpa > 0 ? gpa.toFixed(1) : '—'}
                <span className="text-xs font-normal text-gray-400 ml-1">/ 10</span>
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">
                {gpa >= 8.0 ? 'Học lực Xuất sắc' : gpa >= 6.5 ? 'Học lực Khá' : gpa > 0 ? 'Đang cải thiện' : 'Chưa có điểm'}
              </p>
            </div>

            {/* Card 4: Classrooms */}
            <Link
              to="/student/classrooms"
              className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 transition group"
            >
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-purple-50 text-pastel-purpleDark p-2.5 rounded-2xl group-hover:scale-105 transition">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-medium">Lớp đang theo học</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-800">{summary?.classrooms_count ?? myClassrooms.length}</h3>
              <p className="text-[11px] text-gray-400 mt-1 flex items-center space-x-1">
                <span>Nhóm học & Lớp kèm</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
              </p>
            </Link>
          </div>

          {/* Quick Actions Bar */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-8">
            <h3 className="font-bold text-gray-800 text-sm sm:text-base mb-4 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-pastel-purpleDark" />
              <span>Lối tắt học tập</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <Link
                to="/student/assignments"
                className="p-4 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-sm border border-gray-100 hover:border-pastel-purple/20 transition group flex flex-col justify-between"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm text-gray-800">Bài tập về nhà</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Thời hạn & nộp bài</div>
                </div>
              </Link>

              <Link
                to="/student/exams"
                className="p-4 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-sm border border-gray-100 hover:border-pastel-purple/20 transition group flex flex-col justify-between"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-pastel-purpleDark flex items-center justify-center mb-2 group-hover:scale-110 transition">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm text-gray-800">Phòng thi online</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Kiểm tra chính thức</div>
                </div>
              </Link>

              <Link
                to="/student/practice"
                className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50/50 hover:bg-white hover:shadow-sm border border-purple-100 transition group flex flex-col justify-between"
              >
                <div className="w-9 h-9 rounded-xl bg-pastel-purple text-white flex items-center justify-center mb-2 group-hover:scale-110 transition shadow-2xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm text-pastel-purpleDark">Tự luyện & Ôn tập</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Tạo đề giải chi tiết</div>
                </div>
              </Link>

              <Link
                to="/student/classrooms"
                className="p-4 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-sm border border-gray-100 hover:border-pastel-purple/20 transition group flex flex-col justify-between"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm text-gray-800">Lớp học của tôi</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Thông tin giáo viên</div>
                </div>
              </Link>
            </div>
          </div>

          {/* Quick Join Classroom Form Box */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="p-3 bg-purple-50 text-pastel-purpleDark rounded-2xl">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-base">Vào lớp học bằng mã</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Nhập mã tham gia 6 ký tự để nhận ngay đề bài từ thầy cô</p>
                </div>
              </div>

              <form onSubmit={handleJoinClass} className="flex items-center space-x-2 w-full md:w-auto">
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="MÃ LỚP (VD: TOAN9A)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs sm:text-sm font-mono uppercase font-bold focus:outline-none focus:border-pastel-purple text-center tracking-wider w-full md:w-48"
                />
                <button
                  type="submit"
                  disabled={joinLoading || !joinCode.trim()}
                  className="px-5 py-2.5 bg-pastel-purple text-white text-xs font-bold rounded-2xl hover:bg-pastel-purpleDark transition shadow-sm disabled:opacity-50 whitespace-nowrap"
                >
                  {joinLoading ? 'Đang vào...' : 'Gia nhập'}
                </button>
              </form>
            </div>
          </div>

          {/* Two-Column Grid: Assigned Exams & Recent Submissions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Assigned Exams / Homework */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800 text-base flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-pastel-purpleDark" />
                    <span>Bài tập & Đề thi cần làm</span>
                  </h3>
                  <Link to="/student/assignments" className="text-xs font-semibold text-pastel-purpleDark hover:underline flex items-center space-x-1">
                    <span>Xem tất cả</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {recentExams.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 font-medium">Hiện không có bài tập nào cần làm</p>
                    <p className="text-xs text-gray-400 mt-1">Khi thầy cô giao bài, danh sách sẽ hiển thị ở đây.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentExams.map(exam => {
                      const isAssignment = exam.exam_type === 'ASSIGNMENT';
                      return (
                        <div key={exam.id} className="p-4 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-sm border border-gray-100 transition flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isAssignment ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-pastel-purpleDark'
                              }`}>
                                {isAssignment ? 'Bài tập' : 'Đề thi'}
                              </span>
                              {exam.classroom_name && (
                                <span className="text-[10px] text-gray-500 truncate max-w-[120px]">
                                  {exam.classroom_name}
                                </span>
                              )}
                            </div>
                            <h4 className="font-bold text-sm text-gray-800 truncate">{exam.title}</h4>
                            <div className="flex items-center space-x-3 text-xs text-gray-400 mt-1">
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
                            className="px-4 py-2 bg-pastel-purple text-white text-xs font-bold rounded-xl hover:bg-pastel-purpleDark transition shadow-sm whitespace-nowrap"
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
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800 text-base flex items-center space-x-2">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    <span>Kết quả bài nộp gần đây</span>
                  </h3>
                  <Link to="/student/history" className="text-xs font-semibold text-pastel-purpleDark hover:underline flex items-center space-x-1">
                    <span>Xem sổ điểm</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {recentSubmissions.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <Trophy className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 font-medium">Bạn chưa nộp bài thi nào</p>
                    <p className="text-xs text-gray-400 mt-1">Làm bài tập hoặc đề kiểm tra đầu tiên để xem kết quả.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentSubmissions.map(sub => {
                      const scoreNum = Number(sub.score ?? 0);
                      const isPassed = scoreNum >= 5.0;

                      return (
                        <div key={sub.id} className="p-4 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-sm border border-gray-100 transition flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-sm text-gray-800 truncate">{sub.exam_title || 'Bài thi'}</h4>
                            <div className="flex items-center space-x-2 text-xs text-gray-400 mt-1">
                              <span>Nộp: {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString('vi-VN') : '—'}</span>
                              {sub.attempt_number && <span>• Lần {sub.attempt_number}</span>}
                            </div>
                          </div>

                          <div className="flex items-center space-x-3 shrink-0">
                            <div className="text-right">
                              <span className={`text-base font-black ${isPassed ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {sub.score ?? 0}
                              </span>
                              <span className="text-[10px] text-gray-400">/10</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedSubmissionId(sub.id)}
                              className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:text-pastel-purpleDark hover:border-purple-200 transition shadow-2xs"
                              title="Xem chi tiết & lời giải"
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
          submissionId={selectedSubmissionId}
          onClose={() => setSelectedSubmissionId(null)}
        />
      )}
    </div>
  );
}
