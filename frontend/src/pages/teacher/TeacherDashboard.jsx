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
          api.get('/classrooms/?limit=6').catch(() => ({ data: { items: [] } })),
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
          exams: summaryRes.data?.exams_count ?? examList.length,
          classrooms: summaryRes.data?.classrooms_count ?? classList.length,
          students: studentList.length,
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
    <div className="min-h-screen bg-pastel-bg">
      <Navbar />
      <div className="flex">
        <Sidebar role="teacher" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-pastel-purple via-pastel-purpleDark to-indigo-600 text-white p-6 sm:p-8 rounded-3xl shadow-sm mb-8 relative overflow-hidden">
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-bold mb-3 border border-white/20">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Không gian Giảng dạy Thông minh TutorQuiz</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {getGreeting()}, {teacherName}!
              </h1>
              <p className="mt-2 text-white/90 text-xs sm:text-sm leading-relaxed">
                Quản lý các nhóm dạy kèm, giao bài tập tự động theo bài học và theo dõi tiến độ học sinh một cách trực quan, chính xác nhất.
              </p>
            </div>
            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-8 translate-y-8">
              <BookOpen className="w-64 h-64" />
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <div className="bg-white p-5 rounded-3xl border border-gray-100/90 shadow-card hover:shadow-card-hover transition-all interactive-card">
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-blue-50 text-blue-600 p-2.5 rounded-2xl">
                  <UserCheck className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-semibold">Học sinh kèm</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-gray-800">{stats.students}</h3>
              <p className="text-[11px] text-gray-400 mt-1">Đang theo học các lớp</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100/90 shadow-card hover:shadow-card-hover transition-all interactive-card">
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-2xl">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-semibold">Lớp & Nhóm kèm</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-gray-800">{stats.classrooms}</h3>
              <p className="text-[11px] text-gray-400 mt-1">Đang hoạt động</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100/90 shadow-card hover:shadow-card-hover transition-all interactive-card">
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-purple-50 text-pastel-purpleDark p-2.5 rounded-2xl">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-semibold">Ngân hàng câu hỏi</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-gray-800">{stats.questions}</h3>
              <p className="text-[11px] text-gray-400 mt-1">Hỗ trợ công thức KaTeX</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100/90 shadow-card hover:shadow-card-hover transition-all interactive-card">
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-amber-50 text-amber-600 p-2.5 rounded-2xl">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-semibold">Đề thi đã tạo</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-gray-800">{stats.exams}</h3>
              <p className="text-[11px] text-gray-400 mt-1">Sẵn sàng giao cho học sinh</p>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-card mb-8">
            <h3 className="font-extrabold text-gray-800 text-sm sm:text-base mb-4 flex items-center space-x-2">
              <PlusCircle className="w-5 h-5 text-pastel-purpleDark" />
              <span>Thao tác nhanh trong ngày</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link 
                to="/teacher/assignments" 
                className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/70 to-indigo-50/50 hover:bg-white border border-purple-100 hover:border-pastel-purple/40 shadow-xs hover:shadow-card transition-all interactive-btn group flex items-start space-x-3"
              >
                <div className="p-2.5 rounded-xl bg-purple-100 text-pastel-purpleDark group-hover:scale-110 transition-transform">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm text-gray-800">Giao bài theo bài học</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Chọn bài học & câu hỏi giao cho lớp</div>
                </div>
              </Link>

              <Link 
                to="/teacher/classrooms" 
                className="p-4 rounded-2xl bg-gray-50 hover:bg-white border border-gray-100 hover:border-emerald-200 shadow-xs hover:shadow-card transition-all interactive-btn group flex items-start space-x-3"
              >
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm text-gray-800">Tạo nhóm kèm mới</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Tạo nhóm & cấp mã cho học sinh</div>
                </div>
              </Link>

              <Link 
                to="/teacher/questions" 
                className="p-4 rounded-2xl bg-gray-50 hover:bg-white border border-gray-100 hover:border-blue-200 shadow-xs hover:shadow-card transition-all interactive-btn group flex items-start space-x-3"
              >
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm text-gray-800">Thêm câu hỏi mới</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Nhập tay hoặc nhập nhanh JSON</div>
                </div>
              </Link>

              <Link 
                to="/teacher/exams" 
                className="p-4 rounded-2xl bg-gray-50 hover:bg-white border border-gray-100 hover:border-amber-200 shadow-xs hover:shadow-card transition-all interactive-btn group flex items-start space-x-3"
              >
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm text-gray-800">Thiết kế đề thi</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Ma trận tự động & tạo đề chuẩn</div>
                </div>
              </Link>
            </div>
          </div>

          {/* 2-Column Grid: Recent Classrooms & Recent Exams */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Classrooms */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-card">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                <h3 className="font-extrabold text-gray-800 text-sm sm:text-base flex items-center space-x-2">
                  <Users className="w-4 h-4 text-pastel-purpleDark" />
                  <span>Nhóm kèm đang dạy ({classrooms.length})</span>
                </h3>
                <Link to="/teacher/classrooms" className="text-xs font-bold text-pastel-purpleDark hover:underline flex items-center space-x-1">
                  <span>Tất cả</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {classrooms.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs sm:text-sm text-gray-500 font-medium">Chưa có nhóm dạy kèm nào</p>
                  <Link to="/teacher/classrooms" className="mt-2 inline-block text-xs font-bold text-pastel-purpleDark hover:underline">
                    + Tạo nhóm kèm đầu tiên
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {classrooms.slice(0, 5).map((cls) => (
                    <div key={cls.id} className="p-3.5 rounded-2xl bg-gray-50 hover:bg-purple-50/40 border border-gray-100 transition flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-3">
                        <h4 className="font-bold text-xs sm:text-sm text-gray-800 truncate">{cls.name}</h4>
                        <div className="flex items-center space-x-2 text-[11px] text-gray-400 mt-0.5">
                          <span>{cls.students?.length || 0} học sinh</span>
                          {cls.description && <span className="truncate">• {cls.description}</span>}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {cls.code && (
                          <button 
                            onClick={() => handleCopyCode(cls.code)} 
                            title="Sao chép mã vào nhóm" 
                            className="flex items-center space-x-1 text-xs bg-white text-pastel-purpleDark px-2.5 py-1.5 rounded-xl border border-purple-100 font-mono font-bold hover:bg-purple-50 transition shadow-2xs interactive-btn"
                          >
                            {copiedCode === cls.code ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{cls.code}</span>
                          </button>
                        )}
                        <Link 
                          to="/teacher/classrooms" 
                          className="text-xs bg-pastel-purple text-white px-3 py-1.5 rounded-xl font-semibold hover:bg-pastel-purpleDark transition shadow-2xs"
                        >
                          Vào nhóm
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Recent Exams */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-card">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                <h3 className="font-extrabold text-gray-800 text-sm sm:text-base flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-pastel-purpleDark" />
                  <span>Đề thi & Bài tập gần đây ({recentExams.length})</span>
                </h3>
                <Link to="/teacher/exams" className="text-xs font-bold text-pastel-purpleDark hover:underline flex items-center space-x-1">
                  <span>Kho đề</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {recentExams.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs sm:text-sm text-gray-500 font-medium">Chưa có đề thi nào</p>
                  <Link to="/teacher/exams" className="mt-2 inline-block text-xs font-bold text-pastel-purpleDark hover:underline">
                    + Tạo đề thi mới
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentExams.slice(0, 5).map((exam) => (
                    <div key={exam.id} className="p-3.5 rounded-2xl bg-gray-50 hover:bg-purple-50/40 border border-gray-100 transition flex items-center justify-between">
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-xs sm:text-sm text-gray-800 truncate">{exam.title}</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            exam.is_published ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {exam.is_published ? 'Đã xuất bản' : 'Bản nháp'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 text-[11px] text-gray-400 mt-0.5">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{exam.duration_minutes} phút</span>
                          </span>
                          <span>• {exam.question_count ?? exam.questions?.length ?? 0} câu hỏi</span>
                        </div>
                      </div>

                      <Link 
                        to="/teacher/assignments" 
                        className="text-xs bg-white text-pastel-purpleDark px-3 py-1.5 rounded-xl border border-purple-200 font-bold hover:bg-purple-50 transition shadow-2xs whitespace-nowrap flex items-center space-x-1"
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
