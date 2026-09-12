import React, { useEffect, useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api from '../../api/axios';
import {
  CheckSquare, BookOpen, Users, UserCheck, PlusCircle,
  ArrowRight, Send, Sparkles, Copy, Check
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function TeacherDashboard() {
  const [stats, setStats] = useState({ questions: 0, exams: 0, classrooms: 0, students: 0 });
  const [classrooms, setClassrooms] = useState([]);
  const [recentExams, setRecentExams] = useState([]);
  const [copiedCode, setCopiedCode] = useState(null);

  const userStr = localStorage.getItem('user');
  let teacherName = 'Thầy/Cô';
  try {
    const user = userStr ? JSON.parse(userStr) : null;
    if (user?.full_name) teacherName = user.full_name;
  } catch {}

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
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
      }
    };

    fetchDashboardData();
  }, []);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-screen bg-pastel-bg">
      <Navbar />
      <div className="flex">
        <Sidebar role="teacher" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-pastel-purple to-pastel-purpleDark text-white p-6 sm:p-8 rounded-3xl shadow-sm mb-8 relative overflow-hidden">
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Không gian làm việc cho Gia sư & Giáo viên</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Chào mừng {teacherName}!
              </h1>
              <p className="mt-2 text-white/90 text-sm sm:text-base leading-relaxed">
                Tất cả công cụ cần thiết để quản lý học sinh kèm, thiết kế đề thi trắc nghiệm Toán học và theo dõi tiến độ học tập đều sẵn sàng.
              </p>
            </div>
            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-8 translate-y-8">
              <BookOpen className="w-64 h-64" />
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition">
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-blue-50 text-blue-600 p-2.5 rounded-2xl">
                  <UserCheck className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-medium">Học sinh kèm</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-800">{stats.students}</h3>
              <p className="text-[11px] text-gray-400 mt-1">Tổng học sinh trong các nhóm</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition">
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-2xl">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-medium">Lớp & Nhóm kèm</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-800">{stats.classrooms}</h3>
              <p className="text-[11px] text-gray-400 mt-1">Đang hoạt động</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition">
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-purple-50 text-pastel-purpleDark p-2.5 rounded-2xl">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-medium">Ngân hàng câu hỏi</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-800">{stats.questions}</h3>
              <p className="text-[11px] text-gray-400 mt-1">Hỗ trợ công thức LaTeX</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition">
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-amber-50 text-amber-600 p-2.5 rounded-2xl">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-medium">Bộ đề & Bài tập</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-800">{stats.exams}</h3>
              <p className="text-[11px] text-gray-400 mt-1">Đã tạo và sẵn sàng giao</p>
            </div>
          </div>

          {/* Action Center */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-8">
            <h3 className="font-bold text-gray-800 text-base mb-4 flex items-center space-x-2">
              <PlusCircle className="w-5 h-5 text-pastel-purpleDark" />
              <span>Thao tác nhanh cho buổi dạy</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link 
                to="/teacher/classrooms" 
                className="p-4 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-md border border-gray-100 hover:border-pastel-purple/20 transition group flex items-start space-x-3"
              >
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-800">Tạo nhóm kèm mới</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Tạo nhóm & cấp mã cho học sinh</div>
                </div>
              </Link>

              <Link 
                to="/teacher/questions" 
                className="p-4 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-md border border-gray-100 hover:border-pastel-purple/20 transition group flex items-start space-x-3"
              >
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-110 transition">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-800">Thêm câu hỏi mới</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Nhập tay hoặc nhập nhanh JSON</div>
                </div>
              </Link>

              <Link 
                to="/teacher/exams" 
                className="p-4 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-md border border-gray-100 hover:border-pastel-purple/20 transition group flex items-start space-x-3"
              >
                <div className="p-2.5 rounded-xl bg-purple-50 text-pastel-purpleDark group-hover:scale-110 transition">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-800">Soạn đề kiểm tra</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Tập hợp câu hỏi thành đề thi</div>
                </div>
              </Link>

              <Link 
                to="/teacher/assignments" 
                className="p-4 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-md border border-gray-100 hover:border-pastel-purple/20 transition group flex items-start space-x-3"
              >
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 group-hover:scale-110 transition">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-800">Giao bài tập về nhà</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Giao theo lớp kèm & hẹn giờ</div>
                </div>
              </Link>
            </div>
          </div>

          {/* Two-Column Grid: Groups & Exams */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Tutoring Groups */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 text-base flex items-center space-x-2">
                  <Users className="w-5 h-5 text-pastel-purpleDark" />
                  <span>Nhóm kèm đang dạy</span>
                </h3>
                <Link 
                  to="/teacher/classrooms" 
                  className="text-xs font-semibold text-pastel-purpleDark hover:underline flex items-center space-x-1"
                >
                  <span>Xem tất cả</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {classrooms.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 font-medium">Chưa có nhóm dạy kèm nào</p>
                  <Link 
                    to="/teacher/classrooms" 
                    className="mt-3 inline-block text-xs font-semibold text-pastel-purpleDark hover:underline"
                  >
                    + Tạo nhóm kèm đầu tiên
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {classrooms.map((cls) => (
                    <div 
                      key={cls.id} 
                      className="p-4 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-sm border border-gray-100 transition flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <h4 className="font-bold text-sm text-gray-800 truncate">{cls.name}</h4>
                        <div className="flex items-center space-x-3 text-xs text-gray-400 mt-1">
                          <span>{cls.students?.length || 0} học sinh</span>
                          {cls.description && <span className="truncate">• {cls.description}</span>}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {cls.code && (
                          <button
                            onClick={() => handleCopyCode(cls.code)}
                            title="Sao chép mã tham gia nhóm"
                            className="flex items-center space-x-1 text-xs bg-purple-50 text-pastel-purpleDark px-2.5 py-1.5 rounded-xl font-mono font-bold hover:bg-purple-100 transition"
                          >
                            {copiedCode === cls.code ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{cls.code}</span>
                          </button>
                        )}
                        <Link
                          to="/teacher/classrooms"
                          className="text-xs bg-white text-gray-700 px-3 py-1.5 rounded-xl border border-gray-200 font-medium hover:bg-gray-50 transition"
                        >
                          Vào nhóm
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Quizzes / Exams */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 text-base flex items-center space-x-2">
                  <CheckSquare className="w-5 h-5 text-pastel-purpleDark" />
                  <span>Đề thi & Bài tập gần đây</span>
                </h3>
                <Link 
                  to="/teacher/exams" 
                  className="text-xs font-semibold text-pastel-purpleDark hover:underline flex items-center space-x-1"
                >
                  <span>Quản lý đề</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {recentExams.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <CheckSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 font-medium">Chưa có đề thi nào</p>
                  <Link 
                    to="/teacher/exams" 
                    className="mt-3 inline-block text-xs font-semibold text-pastel-purpleDark hover:underline"
                  >
                    + Soạn đề kiểm tra mới
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentExams.map((exam) => (
                    <div 
                      key={exam.id} 
                      className="p-4 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-sm border border-gray-100 transition flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <h4 className="font-bold text-sm text-gray-800 truncate">{exam.title}</h4>
                        <div className="flex items-center space-x-3 text-xs text-gray-400 mt-1">
                          <span>{exam.duration_minutes ? `${exam.duration_minutes} phút` : 'Tự do'}</span>
                          <span>• {exam.questions?.length || exam.question_count || 0} câu</span>
                          {exam.subject && <span>• {exam.subject}</span>}
                        </div>
                      </div>

                      <Link
                        to="/teacher/assignments"
                        className="text-xs bg-pastel-purple text-white px-3 py-1.5 rounded-xl font-medium hover:bg-pastel-purpleDark transition flex items-center space-x-1"
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