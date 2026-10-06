import React, { useEffect, useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api, { clearApiCache } from '../../api/axios';
import { 
  Users, KeyRound, BookOpen, Clock, Calendar, CheckCircle2, 
  Search, ArrowRight, ShieldCheck, Copy, Check, Sparkles, GraduationCap,
  PhoneCall, Phone, MessageCircle, Mail, ExternalLink, Headphones, X, Info
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
  const [contactModalClass, setContactModalClass] = useState(null);
  const [copiedContact, setCopiedContact] = useState(null);

  const cleanPhone = (phone) => (phone || '').replace(/[^0-9]/g, '');

  const copyContact = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedContact(label);
    toast.success(`Đã sao chép ${label}: ${text}`);
    setTimeout(() => setCopiedContact(null), 2000);
  };

  const mapClassItem = (c) => ({
    ...c,
    teacher_name: c.teacher_name || c.instructor_name || c.instructor?.full_name || 'Thầy/Cô phụ trách',
    teacher_email: c.teacher_email || c.instructor_email || c.instructor?.email || 'giaovien@tutorquiz.edu.vn',
    teacher_phone: c.teacher_phone || c.instructor_phone || c.instructor?.phone_number || '0988 123 456',
    student_count: c.student_count ?? c.students_count ?? (Array.isArray(c.students) ? c.students.length : 1),
    active_assignments_count: c.active_assignments_count ?? c.pending_assignments_count ?? (Array.isArray(c.assignments) ? c.assignments.length : 0),
  });

  const fetchClassrooms = async () => {
    try {
      setLoading(true);
      const res = await api.get('/student/classrooms');
      const raw = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      setClassrooms(raw.map(mapClassItem));
    } catch {
      // Fallback to standard classrooms endpoint
      try {
        const fallback = await api.get('/classrooms', { params: { limit: 50 } });
        const items = Array.isArray(fallback.data?.items) ? fallback.data.items : (Array.isArray(fallback.data) ? fallback.data : []);
        setClassrooms(items.map(mapClassItem));
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
      clearApiCache();
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
    <div className="min-h-screen bg-slate-50 font-sans">
      <Navbar />
      <div className="flex">
        <Sidebar role="student" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl">
          {/* Header */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
                  <Users className="w-7 h-7 text-indigo-600" />
                  <span>Lớp học & Nhóm kèm của tôi</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">Danh sách các lớp bạn đã tham gia và thông tin giáo viên phụ trách</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-xs text-slate-700 tabular-nums">
                  {classrooms.length} lớp đang học
                </span>
                <Link
                  to="/student/assignments"
                  className="text-xs font-bold bg-indigo-600 text-white px-3.5 py-2 rounded-xl hover:bg-indigo-700 active:scale-95 transition shadow-sm flex items-center space-x-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Bài tập theo lớp</span>
                </Link>
              </div>
            </div>

            {/* Quick Join Banner */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm mb-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl shadow-xs">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Gia nhập lớp học mới</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Nhập mã tham gia 6 ký tự được thầy cô hoặc gia sư chia sẻ</p>
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
                    className="px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono uppercase font-extrabold focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-center tracking-widest w-full md:w-44 text-slate-800"
                  />
                  <button
                    type="submit"
                    disabled={joining || !joinCode.trim()}
                    className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 active:scale-95 transition shadow-sm disabled:opacity-50 whitespace-nowrap"
                  >
                    {joining ? 'Đang vào lớp...' : 'Gia nhập lớp'}
                  </button>
                </form>
              </div>
            </div>

            {/* Search and Filter */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm flex items-center space-x-3 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Tìm theo tên lớp, tên giáo viên hoặc môn học..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-2"
                >
                  Xóa
                </button>
              )}
            </div>

            {/* Teacher Support Info Banner */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-sky-50/70 to-blue-50/80 border border-indigo-100/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Headphones className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Kênh liên hệ trực tiếp với Thầy/Cô phụ trách</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Mỗi lớp đều hiển thị Hotline, Zalo và Email giáo viên. Bạn có thể bấm "Liên hệ Thầy/Cô" trên từng lớp để gọi điện hoặc nhắn tin hỏi bài ngay.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Classrooms Grid */}
          {loading ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
              <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
              <div className="text-indigo-700 font-medium text-sm animate-pulse">Đang tải danh sách lớp học...</div>
            </div>
          ) : filteredClassrooms.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
              <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">Chưa tìm thấy lớp học nào</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
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
                    className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-lg shadow-xs group-hover:scale-105 transition">
                          {(c.name || 'L').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Đang học</span>
                        </span>
                      </div>

                      {/* Class Title & Description */}
                      <h3 className="font-bold text-base text-slate-900 group-hover:text-indigo-600 transition line-clamp-1 mb-1">
                        {c.name}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 min-h-[2.5em] mb-4">
                        {c.description || 'Lớp bồi dưỡng & kèm học tập định kỳ.'}
                      </p>

                      {/* Teacher & Stats Info */}
                      <div className="space-y-2.5 py-3 border-y border-slate-100 text-xs text-slate-600 mb-3">
                        {/* Tên Giáo viên */}
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Giáo viên:</span>
                          <span className="font-bold text-slate-800 flex items-center space-x-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{c.teacher_name || 'Thầy/Cô phụ trách'}</span>
                          </span>
                        </div>

                        {/* SĐT / Zalo của Giáo viên */}
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Hotline / Zalo:</span>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold font-mono text-slate-700 text-[11px]">
                              {c.teacher_phone || '0988 123 456'}
                            </span>
                            <a
                              href={`https://zalo.me/${cleanPhone(c.teacher_phone || '0988 123 456')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-[#0068FF] hover:bg-[#0068FF]/10 rounded-md transition"
                              title="Nhắn Zalo cho Thầy/Cô"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`tel:${cleanPhone(c.teacher_phone || '0988 123 456')}`}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition"
                              title="Gọi điện thoại"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>

                        {/* Email của Giáo viên */}
                        {c.teacher_email && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 font-medium">Email:</span>
                            <a
                              href={`mailto:${c.teacher_email}`}
                              className="text-slate-600 hover:text-indigo-600 font-mono text-[11px] truncate max-w-[150px] transition"
                              title={`Gửi email đến ${c.teacher_email}`}
                            >
                              {c.teacher_email}
                            </a>
                          </div>
                        )}

                        {/* Sĩ số lớp */}
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">Sĩ số lớp:</span>
                          <span className="font-semibold text-slate-700 tabular-nums">{c.student_count || 1} học sinh</span>
                        </div>

                        {/* Mã lớp */}
                        {c.code && (
                          <div className="flex items-center justify-between pt-0.5">
                            <span className="text-slate-400 font-medium">Mã lớp:</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(c.code)}
                              className="inline-flex items-center space-x-1 font-mono font-bold text-xs bg-slate-50 hover:bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg border border-slate-200 transition cursor-pointer"
                              title="Bấm để sao chép mã lớp"
                            >
                              <span>{c.code}</span>
                              {copiedCode === c.code ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Nút mở Modal liên hệ Thầy/Cô chi tiết */}
                      <button
                        type="button"
                        onClick={() => setContactModalClass(c)}
                        className="w-full mb-3 py-2 px-3 rounded-xl bg-indigo-50/70 hover:bg-indigo-100/80 text-indigo-700 font-bold text-xs flex items-center justify-center space-x-1.5 transition border border-indigo-200/60 cursor-pointer shadow-2xs group-hover:border-indigo-300"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Liên hệ Thầy/Cô phụ trách</span>
                      </button>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                          pendingCount > 0 
                            ? 'bg-amber-50 text-amber-800 border border-amber-200/80' 
                            : 'bg-slate-50 text-slate-500 border border-slate-200'
                        }`}>
                          {pendingCount > 0 ? `${pendingCount} bài chưa nộp` : 'Đã xong mọi bài'}
                        </span>

                        <Link
                          to={`/student/assignments?classroom=${c.id}`}
                          className="inline-flex items-center space-x-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
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

      {/* --- MODAL CHI TIẾT LIÊN HỆ GIÁO VIÊN BỘ MÔN --- */}
      {contactModalClass && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setContactModalClass(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center space-x-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-extrabold flex items-center justify-center text-lg shadow-md shadow-indigo-600/20 shrink-0">
                {(contactModalClass.teacher_name || 'T').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5">
                  <h3 className="text-base font-extrabold text-slate-900 truncate">
                    {contactModalClass.teacher_name || 'Thầy/Cô phụ trách'}
                  </h3>
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                </div>
                <p className="text-xs text-slate-500 font-medium truncate">
                  Giáo viên phụ trách lớp <span className="font-bold text-slate-700">{contactModalClass.name}</span>
                </p>
              </div>
            </div>

            {/* Classroom Info Pill */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 mb-4 flex items-center justify-between text-xs">
              <span className="text-slate-500">Mã lớp tham gia:</span>
              <span className="font-mono font-extrabold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                {contactModalClass.code}
              </span>
            </div>

            {/* Contact Action Cards */}
            <div className="space-y-2.5 mb-5">
              {/* Phone */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số điện thoại / Hotline</div>
                    <div className="text-xs font-extrabold font-mono text-slate-800">
                      {contactModalClass.teacher_phone || '0988 123 456'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <a
                    href={`tel:${cleanPhone(contactModalClass.teacher_phone || '0988 123 456')}`}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition shadow-2xs flex items-center space-x-1"
                  >
                    <PhoneCall className="w-3 h-3" />
                    <span>Gọi</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => copyContact(contactModalClass.teacher_phone || '0988 123 456', 'SĐT')}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
                    title="Sao chép SĐT"
                  >
                    {copiedContact === 'SĐT' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Zalo */}
              <div className="p-3 rounded-2xl bg-[#0068FF]/5 border border-[#0068FF]/20 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-[#0068FF] text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                    Z
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[#0068FF] uppercase tracking-wider">Tài khoản Zalo</div>
                    <div className="text-xs font-extrabold font-mono text-slate-800">
                      {contactModalClass.teacher_phone || '0988 123 456'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <a
                    href={`https://zalo.me/${cleanPhone(contactModalClass.teacher_phone || '0988 123 456')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1.5 bg-[#0068FF] hover:bg-[#0057d9] text-white text-[11px] font-bold rounded-lg transition shadow-2xs flex items-center space-x-1"
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span>Nhắn Zalo</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => copyContact(contactModalClass.teacher_phone || '0988 123 456', 'Zalo')}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
                    title="Sao chép Zalo"
                  >
                    {copiedContact === 'Zalo' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Email */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hòm thư Email</div>
                    <div className="text-xs font-bold font-mono text-slate-800 truncate">
                      {contactModalClass.teacher_email || 'giaovien@tutorquiz.edu.vn'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  <a
                    href={`mailto:${contactModalClass.teacher_email || 'giaovien@tutorquiz.edu.vn'}`}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold rounded-lg transition shadow-2xs flex items-center space-x-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Gửi Mail</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => copyContact(contactModalClass.teacher_email || 'giaovien@tutorquiz.edu.vn', 'Email')}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
                    title="Sao chép Email"
                  >
                    {copiedContact === 'Email' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Note for student */}
            <div className="bg-indigo-50/70 rounded-2xl p-3.5 border border-indigo-100 text-[11px] text-slate-600 space-y-1.5 mb-5">
              <div className="flex items-center space-x-1.5 text-indigo-700 font-bold">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Khung giờ hỗ trợ giải đáp: 08:00 - 22:00 hàng ngày</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                💡 <span className="font-semibold text-slate-800">Lưu ý khi hỏi bài:</span> Hãy gửi kèm ảnh chụp câu hỏi hoặc mã đề thi qua Zalo để Thầy/Cô nắm được bài tập và hướng dẫn chi tiết nhé!
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setContactModalClass(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
