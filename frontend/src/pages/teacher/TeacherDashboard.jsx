import React, { useEffect, useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api from '../../api/axios';
import { 
  CheckSquare, BookOpen, Users, UserCheck, PlusCircle, 
  ArrowRight, Sparkles, Copy, Check, Send, Award, Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';

export function TeacherDashboard() {
  const { toast } = useToast();
  const [stats, setStats] = useState({ questions: 0, exams: 0, classrooms: 0, students: 0 });
  const [classrooms, setClassrooms] = useState([]);
  const [recentExams, setRecentExams] = useState([]);
  const [copiedCode, setCopiedCode] = useState(null);
  const [loading, setLoading] = useState(true);

  const userStr = localStorage.getItem('user');
  let teacherName = 'Thầy/Cô';
  try {
    const user = userStr ? JSON.parse(userStr) : null;
    if (user?.full_name) teacherName = user.full_name;
  } catch {}

  // Determine time of day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [summaryRes, classRes, examRes, studentsRes] = await Promise.all([
          api.get('/analytics/summary').catch(() => ({ data: {} })),
          api.get('/classrooms', { params: { limit: 6 } }).catch(() => ({ data: { items: [] } })),
          api.get('/exams?limit=6').catch(() => ({ data: { items: [] } })),
          api.get('/classrooms/students/all').catch(() => ({ data: [] })),
        ]);

        const classList = Array.isArray(classRes.data?.items) ? classRes.data.items : (Array.isArray(classRes.data) ? classRes.data : []);
        const examList = Array.isArray(examRes.data?.items) ? examRes.data.items : (Array.isArray(examRes.data) ? examRes.data : []);
        const studentList = Array.isArray(studentsRes.data) ? studentsRes.data : [];

        setClassrooms(classList);
        setRecentExams(examList);
        setStats({
          questions: summaryRes.data?.questions_count ?? 0,
          exams: summaryRes.data?.exams_count ?? (examRes.data?.total ?? examList.length),
          classrooms: summaryRes.data?.classrooms_count ?? (classRes.data?.total ?? classList.length),
          students: summaryRes.data?.students_count ?? studentList.length,
        });
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Đã sao chép mã nhóm: ${code}`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex">
        <Sidebar role="teacher" />
        <main className="flex-1 p-5 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 text-white p-6 sm:p-7 rounded-2xl shadow-xs mb-6 relative overflow-hidden">
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center space-x-2 bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold mb-3 border border-white/20">
                <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                <span>Không gian Giảng dạy TutorQuiz</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {getGreeting()}, {teacherName}!
              </h1>
              <p className="mt-2 text-indigo-100 text-xs sm:text-sm leading-relaxed">
                Hệ thống hỗ trợ quản lý lớp học, phân phối bài tập và theo dõi kết quả làm bài của học sinh một cách trực quan, chính xác.
              </p>
            </div>
            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-8 translate-y-8">
              <BookOpen className="w-64 h-64" />
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-blue-300 transition-all interactive-card">
              <div className="flex items-center space-x-3 mb-2.5">
                <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
                  <UserCheck className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-slate-500 font-medium">Học sinh</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">{stats.students}</h3>
              <p className="text-[11px] text-slate-400 mt-1">Đang theo học các lớp</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-emerald-300 transition-all interactive-card">
              <div className="flex items-center space-x-3 mb-2.5">
                <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-slate-500 font-medium">Lớp học phụ trách</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">{stats.classrooms}</h3>
              <p className="text-[11px] text-slate-400 mt-1">Đang hoạt động</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-indigo-300 transition-all interactive-card">
              <div className="flex items-center space-x-3 mb-2.5">
                <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-slate-500 font-medium">Ngân hàng câu hỏi</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">{stats.questions}</h3>
              <p className="text-[11px] text-slate-400 mt-1">Hỗ trợ định dạng KaTeX</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:border-amber-300 transition-all interactive-card">
              <div className="flex items-center space-x-3 mb-2.5">
                <div className="bg-amber-50 text-amber-600 p-2.5 rounded-xl">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-slate-500 font-medium">Đề thi đã soạn</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">{stats.exams}</h3>
              <p className="text-[11px] text-slate-400 mt-1">Sẵn sàng giao cho lớp</p>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs mb-6">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base mb-4 flex items-center space-x-2">
              <PlusCircle className="w-5 h-5 text-indigo-600" />
              <span>Lối tắt tác vụ chính</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <Link 
                to="/teacher/assignments" 
                className="p-4 rounded-xl bg-slate-50 hover:bg-white border border-slate-200/80 hover:border-indigo-300 shadow-2xs hover:shadow-xs transition-all interactive-btn group flex items-start space-x-3"
              >
                <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-slate-800">Giao bài tập mới</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Phân phối bài tập đến lớp học</div>
                </div>
              </Link>

              <Link 
                to="/teacher/classrooms" 
                className="p-4 rounded-xl bg-slate-50 hover:bg-white border border-slate-200/80 hover:border-emerald-300 shadow-2xs hover:shadow-xs transition-all interactive-btn group flex items-start space-x-3"
              >
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-slate-800">Quản lý lớp học</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Tạo lớp và chia sẻ mã tham gia</div>
                </div>
              </Link>

              <Link 
                to="/teacher/questions" 
                className="p-4 rounded-xl bg-slate-50 hover:bg-white border border-slate-200/80 hover:border-blue-300 shadow-2xs hover:shadow-xs transition-all interactive-btn group flex items-start space-x-3"
              >
                <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-slate-800">Soạn câu hỏi mới</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Nhập tay hoặc nhập file JSON/Word</div>
                </div>
              </Link>

              <Link 
                to="/teacher/exams" 
                className="p-4 rounded-xl bg-slate-50 hover:bg-white border border-slate-200/80 hover:border-amber-300 shadow-2xs hover:shadow-xs transition-all interactive-btn group flex items-start space-x-3"
              >
                <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-slate-800">Tạo đề thi mới</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Tạo ma trận và xuất bản đề thi</div>
                </div>
              </Link>
            </div>
          </div>

          {/* 2-Column Grid: Recent Classrooms & Recent Exams */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Classrooms */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center space-x-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Lớp học phụ trách ({classrooms.length})</span>
                </h3>
                <Link to="/teacher/classrooms" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1">
                  <span>Xem tất cả</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {classrooms.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs sm:text-sm text-slate-600 font-medium">Chưa có lớp học nào được tạo</p>
                  <Link to="/teacher/classrooms" className="mt-2 inline-block text-xs font-semibold text-indigo-600 hover:underline">
                    + Tạo lớp học đầu tiên
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {classrooms.slice(0, 5).map((cls) => (
                    <div key={cls.id} className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/70 border border-slate-200/70 transition flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-3">
                        <h4 className="font-semibold text-xs sm:text-sm text-slate-800 truncate">{cls.name}</h4>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                          <span>{cls.students?.length || 0} học sinh</span>
                          {cls.description && <span className="truncate">• {cls.description}</span>}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {cls.code && (
                          <button 
                            onClick={() => handleCopyCode(cls.code)} 
                            title="Sao chép mã tham gia lớp" 
                            className="flex items-center space-x-1 text-xs bg-white text-indigo-700 px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono font-bold hover:bg-indigo-50 transition shadow-2xs interactive-btn"
                          >
                            {copiedCode === cls.code ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{cls.code}</span>
                          </button>
                        )}
                        <Link 
                          to="/teacher/classrooms" 
                          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-700 transition shadow-2xs"
                        >
                          Vào lớp
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Recent Exams */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span>Đề thi gần đây ({recentExams.length})</span>
                </h3>
                <Link to="/teacher/exams" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1">
                  <span>Kho đề</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {recentExams.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs sm:text-sm text-slate-600 font-medium">Chưa có đề thi nào</p>
                  <Link to="/teacher/exams" className="mt-2 inline-block text-xs font-semibold text-indigo-600 hover:underline">
                    + Soạn đề thi mới
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentExams.slice(0, 5).map((exam) => (
                    <div key={exam.id} className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/70 border border-slate-200/70 transition flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-semibold text-xs sm:text-sm text-slate-800 truncate">{exam.title}</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                            exam.is_published ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {exam.is_published ? 'Đã xuất bản' : 'Bản nháp'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 text-[11px] text-slate-500 mt-0.5">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{exam.duration_minutes} phút</span>
                          </span>
                          <span>• {exam.question_count ?? exam.questions?.length ?? 0} câu hỏi</span>
                        </div>
                      </div>

                      <Link 
                        to="/teacher/assignments" 
                        className="text-xs bg-white text-indigo-700 px-3 py-1.5 rounded-lg border border-slate-200 font-semibold hover:bg-indigo-50 transition shadow-2xs whitespace-nowrap flex items-center space-x-1"
                      >
                        <Send className="w-3 h-3" />
                        <span>Giao bài</span>
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
