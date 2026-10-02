import React, { useState, useEffect } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api from '../../api/axios';
import { AssignmentModal } from '../../components/AssignmentModal';
import { Plus, Search, Edit3, Trash2, Send, CheckCircle2, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';

export function ExamManagement() {
  const navigate = useNavigate();
  const { toast, confirm } = useToast();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

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
  }, [page, search]);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const res = await api.get('/exams', {
        params: { page, limit: 10, search: search || undefined }
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

  const handleTogglePublish = async (exam) => {
    try {
      await api.put(`/exams/${exam.id}`, {
        is_published: !exam.is_published
      });
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
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar role="teacher" />
        <main className="flex-1 p-8 max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Quản lý Đề thi & Giao bài</h1>
              <p className="text-sm text-gray-500 mt-1">Quản lý danh sách đề thi đã tạo, chỉnh sửa và giao bài cho học sinh.</p>
            </div>
            <button
              onClick={() => navigate('/teacher/exams')}
              className="flex items-center space-x-2 bg-pastel-purple text-white px-4 py-2.5 rounded-2xl font-medium shadow-sm hover:opacity-90 transition"
            >
              <Plus className="w-5 h-5" />
              <span>Tạo đề thi mới</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tiêu đề đề thi..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pastel-purple"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-4 px-6">ID / Tiêu đề</th>
                    <th className="py-4 px-6">Thời gian</th>
                    <th className="py-4 px-6">Số câu / Điểm đạt</th>
                    <th className="py-4 px-6">Trạng thái</th>
                    <th className="py-4 px-6 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-gray-400">Đang tải danh sách đề thi...</td>
                    </tr>
                  ) : exams.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-gray-400">Không tìm thấy đề thi nào.</td>
                    </tr>
                  ) : (
                    exams.map((exam) => (
                      <tr key={exam.id} className="hover:bg-gray-50 transition">
                        <td className="py-4 px-6">
                          <div className="font-semibold text-gray-900">{exam.title}</div>
                          <div className="text-xs text-gray-400 mt-0.5">ID: #{exam.id} | Tạo ngày: {exam.created_at ? new Date(exam.created_at).toLocaleDateString('vi-VN') : 'N/A'}</div>
                        </td>
                        <td className="py-4 px-6 text-gray-600 font-medium">{exam.duration_minutes} phút</td>
                        <td className="py-4 px-6 text-gray-600">
                          <div>{exam.question_count || '-'} câu hỏi</div>
                          <div className="text-xs text-gray-400">Đạt: {exam.pass_score ?? 5.0} điểm</div>
                        </td>
                        <td className="py-4 px-6">
                          <button
                            onClick={() => handleTogglePublish(exam)}
                            className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold ${
                              exam.is_published
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            }`}
                          >
                            {exam.is_published ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            <span>{exam.is_published ? 'Đã xuất bản' : 'Bản nháp'}</span>
                          </button>
                        </td>
                        <td className="py-4 px-6 text-right space-x-2">
                          <button
                            onClick={() => openAssignModal(exam)}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-medium hover:bg-indigo-100 transition"
                            title="Giao bài cho lớp"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Giao bài</span>
                          </button>
                          <button
                            onClick={() => openEditModal(exam)}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-medium hover:bg-gray-200 transition"
                            title="Chỉnh sửa đề thi"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Sửa</span>
                          </button>
                          <button
                            onClick={() => handleDeleteExam(exam.id)}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-xs font-medium hover:bg-red-100 transition"
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
              <div className="flex justify-between items-center p-4 border-t border-gray-100 text-sm text-gray-500">
                <span>Trang {page} / {totalPages} (Tổng {total} đề thi)</span>
                <div className="space-x-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(p - 1, 1))}
                    className="px-3 py-1 border rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    Trước
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                    className="px-3 py-1 border rounded-lg disabled:opacity-50 hover:bg-gray-50"
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
            onAssigned={() => toast.success('Giao bài thi cho các lớp thành công!')}
          />

          {/* Edit Modal */}
          {editModalOpen && currentExam && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Chỉnh sửa đề thi</h3>
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Tiêu đề đề thi</label>
                    <input
                      type="text"
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Thời gian (phút)</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Điểm đạt (0-10)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        required
                        value={editPassScore}
                        onChange={(e) => setEditPassScore(e.target.value)}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Số lần làm tối đa</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={editMaxAttempts}
                        onChange={(e) => setEditMaxAttempts(e.target.value)}
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                      />
                    </div>
                    <div className="flex items-center pt-6">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editPublished}
                          onChange={(e) => setEditPublished(e.target.checked)}
                          className="rounded border-gray-300 text-pastel-purple focus:ring-pastel-purple"
                        />
                        <span className="text-sm font-medium text-gray-700">Đã xuất bản</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="editShowAnswers"
                      checked={editShowAnswers}
                      onChange={(e) => setEditShowAnswers(e.target.checked)}
                      className="rounded border-gray-300 text-pastel-purple focus:ring-pastel-purple"
                    />
                    <label htmlFor="editShowAnswers" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Hiển thị đáp án sau khi nộp bài
                    </label>
                  </div>
                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setEditModalOpen(false)}
                      className="px-4 py-2 border rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="px-4 py-2 bg-pastel-purple text-white rounded-xl text-sm font-medium shadow-sm hover:opacity-90 disabled:opacity-50"
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
