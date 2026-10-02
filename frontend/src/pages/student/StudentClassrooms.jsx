import React, { useEffect, useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api from '../../api/axios';
import { 
  Users, KeyRound, BookOpen, Clock, Calendar, CheckCircle2, 
  Search, ArrowRight, ShieldCheck, Copy, Check, Sparkles, GraduationCap 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';

export function StudentClassrooms() {
  const { toast } = useToast();
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);

  const fetchClassrooms = async () => {
    try {
      setLoading(true);
      const res = await api.get('/student/classrooms');
      setClassrooms(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Fallback to standard classrooms endpoint
      try {
        const fallback = await api.get('/classrooms/?limit=50');
        const items = fallback.data?.items || fallback.data || [];
        setClassrooms(Array.isArray(items) ? items : []);
      } catch {
        setClassrooms([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const handleJoinClass = async (e) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;

    setJoining(true);
    try {
      const res = await api.post('/classrooms/join', { code });
      toast.success(`Chúc mừng bạn đã gia nhập lớp "${res.data?.name || code}"!`);
      setJoinCode('');
      fetchClassrooms();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Mã lớp không hợp lệ hoặc đã hết hạn!');
    } finally {
      setJoining(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    toast.success(`Đã sao chép mã lớp: ${text}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredClassrooms = classrooms.filter(c => {
    const nameMatch = (c.name || '').toLowerCase().includes(search.toLowerCase());
    const teacherMatch = (c.teacher_name || '').toLowerCase().includes(search.toLowerCase());
    const descMatch = (c.description || '').toLowerCase().includes(search.toLowerCase());
    return nameMatch || teacherMatch || descMatch;
  });

  return (
    <div className="min-h-screen bg-pastel-bg">
      <Navbar />
      <div className="flex">
        <Sidebar role="student" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight flex items-center space-x-2">
                  <Users className="w-7 h-7 text-pastel-purpleDark" />
                  <span>Lớp học & Nhóm kèm của tôi</span>
                </h1>
                <p className="text-xs text-gray-500 mt-1">Danh sách các lớp bạn đã tham gia và thông tin giáo viên phụ trách</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold bg-white border border-gray-100 px-3 py-2 rounded-2xl shadow-sm text-gray-700">
                  {classrooms.length} lớp đang học
                </span>
                <Link
                  to="/student/assignments"
                  className="text-xs font-bold bg-pastel-purple text-white px-3.5 py-2 rounded-2xl hover:bg-pastel-purpleDark transition shadow-sm flex items-center space-x-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Bài tập theo lớp</span>
                </Link>
              </div>
            </div>

            {/* Quick Join Banner */}
            <div className="bg-gradient-to-r from-purple-50 via-white to-purple-50/40 p-6 rounded-3xl border border-purple-100 shadow-sm mb-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="p-3 bg-pastel-purple text-white rounded-2xl shadow-sm">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-base">Gia nhập lớp học mới</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Nhập mã tham gia 6 ký tự được thầy cô hoặc gia sư chia sẻ</p>
                  </div>
                </div>

                <form onSubmit={handleJoinClass} className="flex items-center space-x-2 w-full md:w-auto">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="MÃ 6 KÝ TỰ"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="px-4 py-2.5 bg-white border border-purple-200 rounded-2xl text-sm font-mono uppercase font-bold focus:outline-none focus:border-pastel-purple text-center tracking-widest w-full md:w-44 shadow-2xs"
                  />
                  <button
                    type="submit"
                    disabled={joining || !joinCode.trim()}
                    className="px-5 py-2.5 bg-gradient-to-r from-pastel-purple to-pastel-purpleDark text-white text-xs font-bold rounded-2xl hover:opacity-95 transition shadow-sm disabled:opacity-50 whitespace-nowrap"
                  >
                    {joining ? 'Đang vào lớp...' : 'Gia nhập lớp'}
                  </button>
                </form>
              </div>
            </div>

            {/* Search and Filter */}
            <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-sm flex items-center space-x-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Tìm theo tên lớp, tên giáo viên hoặc môn học..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:border-pastel-purple"
                />
              </div>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-xs font-bold text-gray-500 hover:text-gray-800 px-3 py-2"
                >
                  Xóa
                </button>
              )}
            </div>
          </div>

          {/* Classrooms Grid */}
          {loading ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
              <div className="w-8 h-8 border-3 border-pastel-purple/30 border-t-pastel-purple rounded-full animate-spin mx-auto mb-3" />
              <div className="text-pastel-purpleDark font-medium text-sm animate-pulse">Đang tải danh sách lớp học...</div>
            </div>
          ) : filteredClassrooms.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
              <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-700">Chưa tìm thấy lớp học nào</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                {classrooms.length === 0 
                  ? 'Bạn chưa tham gia lớp học nào. Hãy hỏi giáo viên hoặc gia sư để lấy mã 6 ký tự và nhập vào ô phía trên.'
                  : 'Không có lớp học nào khớp với từ khóa tìm kiếm của bạn.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClassrooms.map((c) => {
                const pendingCount = c.active_assignments_count || 0;
                return (
                  <div
                    key={c.id}
                    className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pastel-purple/20 to-purple-100 text-pastel-purpleDark font-extrabold flex items-center justify-center text-lg shadow-2xs group-hover:scale-105 transition">
                          {(c.name || 'L').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Đang học</span>
                        </span>
                      </div>

                      {/* Class Title & Description */}
                      <h3 className="font-bold text-base text-gray-900 group-hover:text-pastel-purpleDark transition line-clamp-1 mb-1">
                        {c.name}
                      </h3>
                      <p className="text-xs text-gray-500 line-clamp-2 min-h-[2.5em] mb-4">
                        {c.description || 'Lớp bồi dưỡng & kèm học tập định kỳ.'}
                      </p>

                      {/* Teacher & Stats Info */}
                      <div className="space-y-2 py-3 border-y border-gray-100 text-xs text-gray-600 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 font-medium">Giáo viên:</span>
                          <span className="font-bold text-gray-800 flex items-center space-x-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-pastel-purpleDark" />
                            <span>{c.teacher_name || 'Thầy/Cô phụ trách'}</span>
                          </span>
                        </div>

                        {c.teacher_email && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400 font-medium">Liên hệ:</span>
                            <span className="text-gray-600 font-mono text-[11px] truncate max-w-[160px]">{c.teacher_email}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 font-medium">Sĩ số lớp:</span>
                          <span className="font-semibold text-gray-700">{c.student_count || 1} học sinh</span>
                        </div>

                        {c.code && (
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-gray-400 font-medium">Mã lớp:</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(c.code)}
                              className="inline-flex items-center space-x-1 font-mono font-bold text-xs bg-gray-50 hover:bg-purple-50 text-pastel-purpleDark px-2 py-0.5 rounded-lg border border-purple-100 transition"
                              title="Bấm để sao chép mã lớp"
                            >
                              <span>{c.code}</span>
                              {copiedCode === c.code ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-gray-400" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl ${
                          pendingCount > 0 
                            ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                            : 'bg-gray-50 text-gray-500 border border-gray-100'
                        }`}>
                          {pendingCount > 0 ? `${pendingCount} bài chưa nộp` : 'Đã xong mọi bài'}
                        </span>

                        <Link
                          to={`/student/assignments?classroom=${c.id}`}
                          className="inline-flex items-center space-x-1 text-xs font-bold text-pastel-purpleDark hover:underline"
                        >
                          <span>Xem bài tập</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
