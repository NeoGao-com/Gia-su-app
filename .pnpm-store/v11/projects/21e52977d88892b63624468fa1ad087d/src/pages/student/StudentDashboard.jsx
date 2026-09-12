import React, { useEffect, useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api from '../../api/axios';
import { BookOpen, CheckCircle, ArrowRight, KeyRound, Users, Clock, Sparkles, Trophy, TrendingUp, FileText, History } from 'lucide-react';
import { Link } from 'react-router-dom';

export function StudentDashboard() {
  const [stats, setStats] = useState({ total_exams: 0, completed_exams: 0, avg_score: 0 });
  const [recentExams, setRecentExams] = useState([]);
  const [myClassrooms, setMyClassrooms] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [joinStatus, setJoinStatus] = useState({ loading: false, error: null, success: null });

  const userStr = localStorage.getItem('user');
  let studentName = 'Học sinh';
  try {
    const user = userStr ? JSON.parse(userStr) : null;
    if (user?.full_name) studentName = user.full_name;
  } catch {}

  const loadData = () => {
    Promise.all([
      api.get('/student/exams').catch(() => ({ data: [] })),
      api.get('/student/history?limit=100').catch(() => ({ data: { items: [] } })),
      api.get('/classrooms/?limit=20').catch(() => ({ data: { items: [] } })),
    ]).then(([examsRes, historyRes, classRes]) => {
      const examsList = Array.isArray(examsRes.data) ? examsRes.data : (examsRes.data?.items || []);
      const historyItems = Array.isArray(historyRes.data?.items) ? historyRes.data.items : (Array.isArray(historyRes.data) ? historyRes.data : []);
      const classList = Array.isArray(classRes.data?.items) ? classRes.data.items : (Array.isArray(classRes.data) ? classRes.data : []);

      setRecentExams(examsList.slice(0, 6));
      setMyClassrooms(classList);
      setHistoryList(historyItems);

      const scores = historyItems.filter(h => h.score !== null && h.score !== undefined).map(h => Number(h.score));
      const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0;

      setStats({
        total_exams: examsList.length,
        completed_exams: historyItems.length,
        avg_score: avg,
      });
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleJoinClass = async (e) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;

    setJoinStatus({ loading: true, error: null, success: null });
    try {
      const res = await api.post('/classrooms/join', { code });
      setJoinStatus({ loading: false, error: null, success: `Chúc mừng bạn đã vào nhóm "${res.data?.name || code}"!` });
      setJoinCode('');
      loadData();
    } catch (err) {
      setJoinStatus({ 
        loading: false, 
        error: err.response?.data?.detail || 'Mã nhóm học không hợp lệ hoặc đã hết hạn', 
        success: null 
      });
    }
  };

  const completionRate = stats.total_exams > 0 ? Math.round((stats.completed_exams / Math.max(stats.total_exams, 1)) * 100) : 0;
  const bestScore = historyList.length > 0 ? Math.max(...historyList.map(h => Number(h.score || 0))).toFixed(1) : '—';

  return (
    <div className="min-h-screen bg-pastel-bg">
      <Navbar />
      <div className="flex">
        <Sidebar role="student" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl">
          {/* Welcome Banner — matches TeacherDashboard */}
          <div className="bg-gradient-to-r from-pastel-purple to-pastel-purpleDark text-white p-6 sm:p-8 rounded-3xl shadow-sm mb-8 relative overflow-hidden">
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Góc học tập & Luyện thi trực tuyến</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Chào {studentName}!
              </h1>
              <p className="mt-2 text-white/90 text-sm sm:text-base leading-relaxed">
                Hoàn thành các bài tập về nhà và đề kiểm tra do thầy cô giao để củng cố kiến thức mỗi ngày.
              </p>
            </div>
            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-8 translate-y-8">
              <BookOpen className="w-64 h-64" />
            </div>
          </div>

          {/* Join Tutoring Group Box */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="p-3 bg-purple-50 text-pastel-purpleDark rounded-2xl">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-base">Tham gia lớp / nhóm kèm mới</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Nhập mã 6 ký tự do giáo viên hoặc gia sư cấp để nhận bài tập</p>
                </div>
              </div>

              <form onSubmit={handleJoinClass} className="flex items-center space-x-2 w-full md:w-auto">
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="ABC123"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-mono uppercase font-bold focus:outline-none focus:border-pastel-purple text-center tracking-wider w-full md:w-48"
                />
                <button
                  type="submit"
                  disabled={joinStatus.loading || !joinCode.trim()}
                  className="px-5 py-2.5 bg-pastel-purple text-white text-xs font-bold rounded-2xl hover:bg-pastel-purpleDark transition shadow-sm disabled:opacity-50 whitespace-nowrap"
                >
                  {joinStatus.loading ? 'Đang vào...' : 'Tham gia'}
                </button>
              </form>
            </div>

            {joinStatus.error && (
              <div className="mt-3 text-xs text-red-600 bg-red-50 p-2.5 rounded-xl font-medium border border-red-100">
                {joinStatus.error}
              </div>
            )}
            {joinStatus.success && (
              <div className="mt-3 text-xs text-emerald-600 bg-emerald-50 p-2.5 rounded-xl font-medium border border-emerald-100">
                {joinStatus.success}
              </div>
            )}
          </div>

          {/* Quick Stats Grid — 4 cards like TeacherDashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition">
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-blue-50 text-blue-600 p-2.5 rounded-2xl">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-medium">Bài được giao</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-800">{stats.total_exams}</h3>
              <p className="text-[11px] text-gray-400 mt-1">Đề thi khả dụng</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition">
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-2xl">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-medium">Đã hoàn thành</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-800">{stats.completed_exams}</h3>
              <p className="text-[11px] text-gray-400 mt-1">{completionRate}% tiến độ</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition">
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-amber-50 text-amber-600 p-2.5 rounded-2xl">
                  <Trophy className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-medium">Điểm trung bình</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-800">{stats.avg_score}</h3>
              <p className="text-[11px] text-gray-400 mt-1">Cao nhất: {bestScore} điểm</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition">
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-purple-50 text-pastel-purpleDark p-2.5 rounded-2xl">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-medium">Nhóm đang học</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-800">{myClassrooms.length}</h3>
              <p className="text-[11px] text-gray-400 mt-1">Lớp & nhóm kèm</p>
            </div>
          </div>

          {/* Action Center — mirrors TeacherDashboard */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-8">
            <h3 className="font-bold text-gray-800 text-base mb-4 flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-pastel-purpleDark" />
              <span>Thao tác nhanh</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link 
                to="/student/exams" 
                className="p-4 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-md border border-gray-100 hover:border-pastel-purple/20 transition group flex items-start space-x-3"
              >
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-110 transition">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-800">Làm bài ngay</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Vào danh sách đề thi</div>
                </div>
              </Link>

              <Link 
                to="/student/history" 
                className="p-4 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-md border border-gray-100 hover:border-pastel-purple/20 transition group flex items-start space-x-3"
              >
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-800">Xem kết quả</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Lịch sử & điểm số</div>
                </div>
              </Link>

              <a 
                href="#join-group"
                onClick={(e) => { e.preventDefault(); document.querySelector('input[placeholder="ABC123"]')?.focus(); }}
                className="p-4 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-md border border-gray-100 hover:border-pastel-purple/20 transition group flex items-start space-x-3 cursor-pointer"
              >
                <div className="p-2.5 rounded-xl bg-purple-50 text-pastel-purpleDark group-hover:scale-110 transition">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-800">Nhập mã nhóm</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Tham gia lớp mới</div>
                </div>
              </a>

              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 flex items-start space-x-3">
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-800">{completionRate}% hoàn thành</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{stats.completed_exams}/{stats.total_exams} bài đã làm</div>
                </div>
              </div>
            </div>
          </div>

          {/* Two-Column Grid: My Classes & Assigned Exams — matches TeacherDashboard panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* My Tutoring Classes */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 text-base flex items-center space-x-2">
                  <Users className="w-5 h-5 text-pastel-purpleDark" />
                  <span>Nhóm học của bạn</span>
                </h3>
                <span className="text-xs font-bold bg-gray-50 text-gray-500 px-2.5 py-1 rounded-full border">{myClassrooms.length} nhóm</span>
              </div>

              {myClassrooms.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 font-medium">Chưa tham gia nhóm nào</p>
                  <p className="text-xs text-gray-400 mt-1">Nhập mã nhóm ở trên để bắt đầu nhận bài tập</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myClassrooms.map((c) => (
                    <div key={c.id} className="p-4 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-sm border border-gray-100 transition flex items-center justify-between">
                      <div className="flex items-center space-x-3 min-w-0 flex-1 pr-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-100 text-pastel-purpleDark font-extrabold flex items-center justify-center text-sm shrink-0">
                          {(c.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-gray-800 truncate">{c.name}</h4>
                          <p className="text-xs text-gray-400 truncate">{c.description || 'Lớp dạy kèm'}</p>
                        </div>
                      </div>
                      <span className="text-[11px] bg-emerald-50 text-emerald-600 font-bold px-3 py-1 rounded-full border border-emerald-100 whitespace-nowrap">
                        Đang học
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assigned Quizzes / Exams */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 text-base flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-pastel-purpleDark" />
                  <span>Bài tập cần làm</span>
                </h3>
                <Link to="/student/exams" className="text-xs font-semibold text-pastel-purpleDark hover:underline flex items-center space-x-1">
                  <span>Xem tất cả</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {recentExams.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 font-medium">Chưa có bài tập nào</p>
                  <p className="text-xs text-gray-400 mt-1">Khi thầy cô giao bài, đề thi sẽ hiện ở đây</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentExams.map(exam => (
                    <div key={exam.id} className="p-4 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-sm border border-gray-100 transition flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-3">
                        <h4 className="font-bold text-sm text-gray-800 truncate">{exam.title}</h4>
                        <div className="flex items-center flex-wrap gap-2 text-xs text-gray-400 mt-1">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{exam.duration_minutes ? `${exam.duration_minutes} phút` : 'Tự do'}</span>
                          </span>
                          <span>• {exam.question_count || exam.questions?.length || exam.question_ids?.length || 0} câu</span>
                          {exam.subject && <span className="px-2 py-0.5 bg-white border rounded-full text-[10px] font-bold text-gray-600">{exam.subject}</span>}
                        </div>
                      </div>
                      <Link
                        to={`/take-exam/${exam.id}`}
                        className="px-4 py-2 bg-pastel-purple text-white text-xs font-bold rounded-xl hover:bg-pastel-purpleDark transition shadow-sm whitespace-nowrap"
                      >
                        Làm bài
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
