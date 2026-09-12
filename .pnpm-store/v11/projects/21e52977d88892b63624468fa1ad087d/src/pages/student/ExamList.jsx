import React, { useEffect, useState, useMemo } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api from '../../api/axios';
import { Link } from 'react-router-dom';
import { Clock, Search, BookOpen, FileText, Sparkles, ArrowRight, Award, Filter } from 'lucide-react';

export function ExamList() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');

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

  const filtered = useMemo(() => {
    return exams.filter(e => {
      if (search && !(e.title || '').toLowerCase().includes(search.toLowerCase()) && !(e.description || '').toLowerCase().includes(search.toLowerCase())) return false;
      if (subjectFilter && e.subject !== subjectFilter) return false;
      return true;
    });
  }, [exams, search, subjectFilter]);

  return (
    <div className="min-h-screen bg-pastel-bg">
      <Navbar />
      <div className="flex">
        <Sidebar role="student" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl">
          {/* Header — matches Teacher ExamManagement / ClassroomManagement */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight flex items-center space-x-2">
                  <BookOpen className="w-7 h-7 text-pastel-purpleDark" />
                  <span>Danh sách bài thi</span>
                </h1>
                <p className="text-xs text-gray-500 mt-1">Các đề thi được giao và công khai — sẵn sàng làm bài ngay</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold bg-white border border-gray-100 px-3 py-2 rounded-2xl shadow-sm">
                  {filtered.length} đề thi
                </span>
                <Link to="/student/history" className="text-xs font-bold bg-white border border-gray-100 px-3 py-2 rounded-2xl hover:bg-gray-50 transition flex items-center space-x-1.5">
                  <Award className="w-3.5 h-3.5 text-pastel-purpleDark" />
                  <span>Lịch sử</span>
                </Link>
              </div>
            </div>

            {/* Filter bar — same style as QuestionBank */}
            <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Tìm theo tên đề thi hoặc mô tả..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-pastel-purple"
                />
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Filter className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-3 pointer-events-none" />
                  <select
                    value={subjectFilter}
                    onChange={e => setSubjectFilter(e.target.value)}
                    className="pl-8 pr-8 py-2.5 bg-white border border-gray-200 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:border-pastel-purple"
                  >
                    <option value="">Tất cả môn</option>
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {(search || subjectFilter) && (
                  <button
                    onClick={() => { setSearch(''); setSubjectFilter(''); }}
                    className="px-3 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-800 whitespace-nowrap"
                  >
                    Xóa lọc
                  </button>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
              <div className="text-pastel-purpleDark font-medium animate-pulse">Đang tải danh sách đề thi...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
              {exams.length === 0 ? (
                <>
                  <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-600">Hiện không có bài thi nào khả dụng</p>
                  <p className="text-xs text-gray-400 mt-1">Khi thầy cô giao bài hoặc xuất bản đề thi, bạn sẽ thấy chúng ở đây.</p>
                  <Link to="/student" className="mt-4 inline-flex items-center space-x-1.5 text-xs font-bold text-pastel-purpleDark hover:underline">
                    <span>Về trang tổng quan</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </>
              ) : (
                <>
                  <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-600">Không tìm thấy đề thi phù hợp</p>
                  <p className="text-xs text-gray-400 mt-1">Thử thay đổi từ khóa hoặc bộ lọc môn học.</p>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-800 flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-pastel-purpleDark" />
                  <span>Đề thi sẵn sàng ({filtered.length})</span>
                </h3>
                <span className="text-[11px] text-gray-400">Bấm "Vào thi" để bắt đầu — hệ thống sẽ tính giờ ngay khi vào phòng thi</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map(exam => {
                  const maxAttempts = exam.max_attempts || 1;
                  const attemptsTaken = exam.attempts_taken || 0;
                  const attemptsLeft = Math.max(0, maxAttempts - attemptsTaken);
                  const isExhausted = attemptsLeft === 0;

                  return (
                    <div key={exam.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-purple-200 transition group">
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border ${exam.is_published ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                            {exam.is_published ? 'Công khai' : 'Được giao'}
                          </span>
                          <div className="flex items-center space-x-1 text-xs text-gray-400 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{exam.duration_minutes || 45} phút</span>
                          </div>
                        </div>

                        <h3 className="text-sm font-bold text-gray-800 mb-1.5 line-clamp-2 group-hover:text-pastel-purpleDark transition">{exam.title}</h3>
                        <p className="text-xs text-gray-500 mb-3 line-clamp-2 min-h-[2.5em]">{exam.description || 'Không có mô tả'}</p>

                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <span className="text-[11px] px-2 py-1 bg-blue-50 text-blue-700 rounded-lg font-bold border border-blue-100">
                            {(exam.question_count ?? exam.questions?.length ?? exam.question_ids?.length ?? 0)} câu hỏi
                          </span>
                          {exam.subject && (
                            <span className="text-[11px] px-2 py-1 bg-purple-50 text-pastel-purpleDark rounded-lg font-bold border border-purple-100">
                              {exam.subject}
                            </span>
                          )}
                          {exam.grade_level && (
                            <span className="text-[11px] px-2 py-1 bg-gray-50 text-gray-600 rounded-lg font-medium border">
                              Khối {exam.grade_level}
                            </span>
                          )}
                        </div>

                        {/* Attempt info bar */}
                        <div className="bg-gray-50 px-3 py-2 rounded-xl border border-gray-100 flex items-center justify-between text-xs mb-3">
                          <span className="text-gray-500 font-medium">Lượt làm bài:</span>
                          <span className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${isExhausted ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                            {isExhausted ? `Đã hết lượt (${attemptsTaken}/${maxAttempts})` : `Còn ${attemptsLeft}/${maxAttempts} lượt`}
                          </span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex gap-2">
                        {isExhausted ? (
                          <Link
                            to="/student/history"
                            className="flex-1 py-2.5 bg-gray-100 text-gray-600 text-center text-xs font-bold rounded-xl hover:bg-gray-200 transition shadow-2xs flex items-center justify-center space-x-1"
                          >
                            <span>Xem lịch sử ({attemptsTaken}/{maxAttempts})</span>
                          </Link>
                        ) : (
                          <Link
                            to={`/take-exam/${exam.id}`}
                            className="flex-1 py-2.5 bg-pastel-purple text-white text-center text-xs font-bold rounded-xl hover:bg-pastel-purpleDark transition shadow-sm flex items-center justify-center space-x-1.5"
                          >
                            <span>Vào thi ({attemptsTaken}/{maxAttempts})</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
