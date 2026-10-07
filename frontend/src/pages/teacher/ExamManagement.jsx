import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api, { clearApiCache } from '../../api/axios';
import { AssignmentModal } from '../../components/AssignmentModal';
import { 
  Plus, Search, Edit3, Trash2, Send, CheckCircle2, XCircle, 
  Download, FileDown, ChevronDown 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';

export function ExamManagement() {
  const navigate = useNavigate();
  const { toast, confirm } = useToast();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'published' | 'draft'
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Export State
  const [exportMenuExamId, setExportMenuExamId] = useState(null);
  const [exportingKey, setExportingKey] = useState(null);

  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedExamForAssign, setSelectedExamForAssign] = useState(null);

  // Edit / Details Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentExam, setCurrentExam] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDuration, setEditDuration] = useState(45);
  const [editPassScore, setEditPassScore] = useState(5.0);
  const [editMaxAttempts, setEditMaxAttempts] = useState(1);
  const [editShowAnswers, setEditShowAnswers] = useState(true);
  const [editPublished, setEditPublished] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    fetchExams();
  }, [page, search, subjectFilter, gradeFilter, statusFilter]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.export-dropdown-box')) {
        setExportMenuExamId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const res = await api.get('/exams', {
        params: { 
          page, 
          limit: 10, 
          search: search || undefined,
          subject: subjectFilter || undefined,
          grade_level: gradeFilter ? Number(gradeFilter) : undefined,
          is_published: statusFilter === 'published' ? true : statusFilter === 'draft' ? false : undefined
        }
      });
      setExams(res.data.items || res.data || []);
      setTotal(res.data.total || (res.data.items ? res.data.items.length : 0));
      setTotalPages(Math.ceil((res.data.total || (res.data.items ? res.data.items.length : 0)) / 10) || 1);
    } catch (err) {
      console.error('Error fetching exams:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectChange = (val) => {
    setSubjectFilter(val);
    setPage(1);
  };

  const handleGradeChange = (val) => {
    setGradeFilter(val);
    setPage(1);
  };

  const handleStatusChange = (val) => {
    setStatusFilter(val);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setSubjectFilter('');
    setGradeFilter('');
    setStatusFilter('all');
    setPage(1);
  };

  const handleExport = async (examId, examTitle, format, includeAnswers) => {
    const key = `${examId}_${format}_${includeAnswers ? 'ans' : 'noans'}`;
    try {
      setExportingKey(key);
      const res = await api.get(`/export/exam/${examId}/${format}`, {
        params: { include_answers: includeAnswers },
        responseType: 'blob',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const mime = format === 'pdf' 
        ? 'application/pdf' 
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const blob = new Blob([res.data], { type: mime });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanTitle = (examTitle || `de_thi_${examId}`).replace(/[\\/:*?"<>|]/g, '_');
      const suffix = includeAnswers ? '_co_dap_an' : '_de_bai';
      a.setAttribute('download', `${cleanTitle}${suffix}.${format}`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Đã xuất file ${format.toUpperCase()} (${includeAnswers ? 'có đáp án' : 'đề bài'}) thành công!`);
      setExportMenuExamId(null);
    } catch (err) {
      console.error(err);
      toast.error(`Lỗi khi xuất file ${format.toUpperCase()}: ` + (err.response?.data?.detail || err.message));
    } finally {
      setExportingKey(null);
    }
  };

  const handleTogglePublish = async (exam) => {
    try {
      await api.put(`/exams/${exam.id}`, {
        is_published: !exam.is_published
      });
      clearApiCache();
      toast.success(exam.is_published ? 'Đã chuyển đề thi về bản nháp' : 'Đã xuất bản đề thi thành công!');
      await fetchExams();
    } catch (err) {
      toast.error('Lỗi thay đổi trạng thái: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteExam = async (examId, isHard = false) => {
    const isConfirmed = await confirm({
      title: isHard ? 'Xóa vĩnh viễn đề thi' : 'Xác nhận xóa đề thi',
      message: isHard
        ? 'CẢNH BÁO: Xóa vĩnh viễn đề thi sẽ xóa toàn bộ bài nộp và phân công liên quan. Thao tác không thể hoàn tác!'
        : 'Bạn có chắc chắn muốn xóa đề thi này không?',
      confirmText: isHard ? 'Xóa vĩnh viễn' : 'Xóa đề thi',
      type: 'danger'
    });
    if (!isConfirmed) return;

    try {
      await api.delete(`/exams/${examId}${isHard ? '?hard=true&force=true' : ''}`);
      clearApiCache();
      toast.success('Đã xóa đề thi thành công');
      await fetchExams();
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      if (!isHard && (detail.includes('tiếp tục xóa') || detail.includes('đang được giao') || detail.includes('đã có học sinh'))) {
        const forceDelete = await confirm({
          title: 'Đề thi đã có bài làm',
          message: `${detail}\n\nBạn có muốn XÓA VĨNH VIỄN đề thi này cùng tất cả dữ liệu liên quan không?`,
          confirmText: 'Xác nhận xóa vĩnh viễn',
          type: 'danger'
        });
        if (forceDelete) {
          await handleDeleteExam(examId, true);
          return;
        }
      }
      toast.error('Lỗi khi xóa đề thi: ' + detail);
    }
  };

  const openAssignModal = (exam) => {
    setSelectedExamForAssign(exam);
    setAssignmentModalOpen(true);
  };

  const openEditModal = (exam) => {
    setCurrentExam(exam);
    setEditTitle(exam.title || '');
    setEditDuration(exam.duration_minutes || 45);
    setEditPassScore(exam.pass_score ?? 5.0);
    setEditMaxAttempts(exam.max_attempts || 1);
    setEditShowAnswers(exam.show_answers_after_submit ?? true);
    setEditPublished(exam.is_published ?? false);
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setSavingEdit(true);
      await api.put(`/exams/${currentExam.id}`, {
        title: editTitle,
        duration_minutes: parseInt(editDuration),
        pass_score: parseFloat(editPassScore),
        max_attempts: parseInt(editMaxAttempts),
        show_answers_after_submit: editShowAnswers,
        is_published: editPublished
      });
      clearApiCache();
      setEditModalOpen(false);
      fetchExams();
      toast.success('Cập nhật đề thi thành công!');
    } catch (err) {
      toast.error('Lỗi cập nhật đề thi: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar role="teacher" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Quản lý Đề thi & Giao bài</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">Quản lý danh sách đề thi đã tạo, chỉnh sửa cấu hình và phân bổ cho các lớp học.</p>
            </div>
            <button
              onClick={() => navigate('/teacher/exams')}
              className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-indigo-700 active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tạo đề thi mới</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 p-4 sm:p-5 mb-6 space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tiêu đề đề thi..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-indigo-600 focus:bg-white text-slate-800 transition"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Subject filter */}
                <select
                  value={subjectFilter}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-600 transition"
                >
                  <option value="">Tất cả môn học</option>
                  {['Toán học', 'Vật lý', 'Hóa học', 'Sinh học', 'Tiếng Anh', 'Ngữ văn', 'Lịch sử', 'Địa lý', 'Tin học', 'GDCD'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                {/* Grade Level filter */}
                <select
                  value={gradeFilter}
                  onChange={(e) => handleGradeChange(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-600 transition"
                >
                  <option value="">Tất cả khối lớp</option>
                  {[6, 7, 8, 9, 10, 11, 12].map(g => (
                    <option key={g} value={g}>Khối {g}</option>
                  ))}
                </select>

                {/* Status filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-indigo-600 transition"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="published">Đã xuất bản</option>
                  <option value="draft">Bản nháp</option>
                </select>

                {(search || subjectFilter || gradeFilter || statusFilter !== 'all') && (
                  <button
                    onClick={handleResetFilters}
                    className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Xóa lọc
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-4 px-6">ID / Tiêu đề đề thi</th>
                    <th className="py-4 px-6">Thời gian làm</th>
                    <th className="py-4 px-6">Số câu / Điểm đạt</th>
                    <th className="py-4 px-6">Trạng thái</th>
                    <th className="py-4 px-6 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="py-12 text-center text-slate-400">Đang tải danh sách đề thi...</td>
                    </tr>
                  ) : exams.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-12 text-center text-slate-400">Không tìm thấy đề thi nào phù hợp.</td>
                    </tr>
                  ) : (
                    exams.map((exam) => (
                      <tr key={exam.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900">{exam.title}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            ID: #{exam.id} | Ngày tạo: {exam.created_at ? new Date(exam.created_at).toLocaleDateString('vi-VN') : 'N/A'}
                            {exam.subject && <span> | Môn: {exam.subject}</span>}
                            {exam.grade_level && <span> | Khối {exam.grade_level}</span>}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-700 font-semibold tabular-nums">{exam.duration_minutes} phút</td>
                        <td className="py-4 px-6 text-slate-700">
                          <div className="font-semibold tabular-nums">{exam.question_count || '-'} câu hỏi</div>
                          <div className="text-xs text-slate-400">Điểm đạt: <span className="tabular-nums font-semibold text-slate-600">{exam.pass_score ?? 5.0}</span></div>
                        </td>
                        <td className="py-4 px-6">
                          <button
                            onClick={() => handleTogglePublish(exam)}
                            className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold border ${
                              exam.is_published
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            {exam.is_published ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            <span>{exam.is_published ? 'Đã xuất bản' : 'Bản nháp'}</span>
                          </button>
                        </td>
                        <td className="py-4 px-6 text-right space-x-2">
                          <button
                            onClick={() => openAssignModal(exam)}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 border border-indigo-200/70 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition"
                            title="Giao đề cho lớp học"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Giao bài</span>
                          </button>

                          {/* Export Word / PDF Dropdown */}
                          <div className="relative inline-block text-left export-dropdown-box">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExportMenuExamId(exportMenuExamId === exam.id ? null : exam.id);
                              }}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-50 border border-blue-200/70 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition cursor-pointer"
                              title="Tải đề thi dạng Word hoặc PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Xuất đề</span>
                              <ChevronDown className="w-3 h-3 ml-0.5" />
                            </button>

                            {exportMenuExamId === exam.id && (
                              <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-40 text-left animate-in fade-in zoom-in-95">
                                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  Xuất Word (.docx)
                                </div>
                                <button
                                  type="button"
                                  disabled={exportingKey === `${exam.id}_docx_noans`}
                                  onClick={() => handleExport(exam.id, exam.title, 'docx', false)}
                                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition disabled:opacity-50 cursor-pointer"
                                >
                                  <FileDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  <span>Đề bài (không đáp án)</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={exportingKey === `${exam.id}_docx_ans`}
                                  onClick={() => handleExport(exam.id, exam.title, 'docx', true)}
                                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition disabled:opacity-50 cursor-pointer"
                                >
                                  <FileDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  <span>Đề kèm đáp án & Lời giải</span>
                                </button>

                                <div className="border-t border-slate-100 my-1" />

                                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  Xuất PDF (.pdf)
                                </div>
                                <button
                                  type="button"
                                  disabled={exportingKey === `${exam.id}_pdf_noans`}
                                  onClick={() => handleExport(exam.id, exam.title, 'pdf', false)}
                                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition disabled:opacity-50 cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                  <span>Đề bài (không đáp án)</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={exportingKey === `${exam.id}_pdf_ans`}
                                  onClick={() => handleExport(exam.id, exam.title, 'pdf', true)}
                                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition disabled:opacity-50 cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                  <span>Đề kèm đáp án & Lời giải</span>
                                </button>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => openEditModal(exam)}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition"
                            title="Chỉnh sửa thông số đề thi"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Sửa</span>
                          </button>
                          <button
                            onClick={() => handleDeleteExam(exam.id)}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-bold hover:bg-rose-100 transition"
                            title="Xóa đề thi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-between items-center p-4 border-t border-slate-100 text-xs text-slate-500">
                <span>Trang <strong className="text-slate-800">{page}</strong> / {totalPages} (Tổng cộng {total} đề thi)</span>
                <div className="space-x-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(p - 1, 1))}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50 font-semibold"
                  >
                    Trước
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50 font-semibold"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>

          <AssignmentModal
            exam={selectedExamForAssign}
            isOpen={assignmentModalOpen}
            onClose={() => setAssignmentModalOpen(false)}
            onAssigned={() => toast.success('Giao đề thi cho các lớp thành công!')}
          />

          {/* Edit Modal */}
          {editModalOpen && currentExam && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Chỉnh sửa thông số đề thi</h3>
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tiêu đề đề thi</label>
                    <input
                      type="text"
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Thời gian (phút)</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Điểm đạt (thang 10)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        required
                        value={editPassScore}
                        onChange={(e) => setEditPassScore(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Số lần làm tối đa</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={editMaxAttempts}
                        onChange={(e) => setEditMaxAttempts(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div className="flex items-center pt-6">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editPublished}
                          onChange={(e) => setEditPublished(e.target.checked)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <span className="text-sm font-semibold text-slate-700">Đã xuất bản</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="editShowAnswers"
                      checked={editShowAnswers}
                      onChange={(e) => setEditShowAnswers(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <label htmlFor="editShowAnswers" className="text-xs sm:text-sm font-medium text-slate-700 cursor-pointer">
                      Cho phép học sinh xem đáp án sau khi nộp bài
                    </label>
                  </div>
                  <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditModalOpen(false)}
                      className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
                    >
                      {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
