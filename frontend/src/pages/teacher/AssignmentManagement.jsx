import React, { useState, useEffect } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import { AssignmentModal } from '../../components/AssignmentModal';
import { EditAssignmentModal } from '../../components/EditAssignmentModal';
import { AssignByLessonModal } from '../../components/AssignByLessonModal';
import { 
  Send, Search, Plus, Trash2, Edit3, BookOpen, 
  Sparkles, Calendar, Clock, School, Layers, CheckCircle2, AlertTriangle, Eye
} from 'lucide-react';
import api from '../../api/axios';
import { useToast } from '../../context/ToastContext';

export function AssignmentManagement() {
  const { toast, confirm } = useToast();
  const [activeTab, setActiveTab] = useState('assigned'); // 'assigned' | 'exams'

  // Classroom data
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');

  // Tab 1: Assigned list state
  const [assignments, setAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState('');

  // Tab 2: Available exams state
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [examSearch, setExamSearch] = useState('');
  const [examPage, setExamPage] = useState(1);
  const [totalExams, setTotalExams] = useState(0);

  // Modals state
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedExamForAssign, setSelectedExamForAssign] = useState(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedAssignmentForEdit, setSelectedAssignmentForEdit] = useState(null);

  const [lessonModalOpen, setLessonModalOpen] = useState(false);

  // Load classrooms on mount
  useEffect(() => {
    const fetchClassrooms = async () => {
      try {
        const res = await api.get('/classrooms', { params: { limit: 100 } });
        const items = Array.isArray(res.data?.items)
          ? res.data.items
          : Array.isArray(res.data)
            ? res.data
            : [];
        setClassrooms(items);
      } catch (err) {
        console.error('Error fetching classrooms:', err);
        setClassrooms([]);
      }
    };
    fetchClassrooms();
  }, []);

  // Load assignments when activeTab is 'assigned' or class filter changes
  useEffect(() => {
    if (activeTab === 'assigned') {
      fetchAssignments();
    }
  }, [activeTab, selectedClassFilter]);

  // Load exams when activeTab is 'exams' or search/page changes
  useEffect(() => {
    if (activeTab === 'exams') {
      fetchExams();
    }
  }, [activeTab, examPage, examSearch]);

  const fetchAssignments = async () => {
    try {
      setLoadingAssignments(true);
      const params = {};
      if (selectedClassFilter !== 'all') {
        params.classroom_id = selectedClassFilter;
      }
      const res = await api.get('/classrooms/assignments/all', { params });
      const items = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.items)
          ? res.data.items
          : [];
      setAssignments(items);
    } catch (err) {
      console.error('Error fetching assignments:', err);
      setAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const fetchExams = async () => {
    try {
      setLoadingExams(true);
      const res = await api.get('/exams', {
        params: { page: examPage, limit: 12, search: examSearch || undefined, exam_type: 'ASSIGNMENT' }
      });
      const items = Array.isArray(res.data?.items)
        ? res.data.items
        : Array.isArray(res.data)
          ? res.data
          : [];
      setExams(items);
      setTotalExams(res.data?.total || items.length);
    } catch (err) {
      console.error('Error fetching exams:', err);
      setExams([]);
    } finally {
      setLoadingExams(false);
    }
  };

  const handleOpenEdit = (assignment) => {
    setSelectedAssignmentForEdit(assignment);
    setEditModalOpen(true);
  };

  const handleDeleteAssignment = async (assignment) => {
    const examTitle = assignment.exam?.title || `Đề thi #${assignment.exam_id}`;
    const className = assignment.classroom_name || 'lớp học';
    const ok = await confirm({
      title: 'Hủy giao bài tập',
      message: `Bạn có chắc chắn muốn hủy / xóa bài tập "${examTitle}" khỏi lớp "${className}"?`,
      confirmText: 'Xác nhận xóa',
      cancelText: 'Hủy'
    });
    if (!ok) return;

    try {
      await api.delete(`/classrooms/${assignment.classroom_id}/exams/${assignment.exam_id}`);
      toast.success('Đã xóa bài tập khỏi lớp thành công!');
      fetchAssignments();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể xóa bài tập');
    }
  };

  const openAssignExamModal = (exam) => {
    setSelectedExamForAssign(exam);
    setAssignmentModalOpen(true);
  };

  // Filter assignments by search keyword
  const filteredAssignments = assignments.filter((a) => {
    if (!assignmentSearch.trim()) return true;
    const term = assignmentSearch.toLowerCase();
    const titleMatch = (a.exam?.title || '').toLowerCase().includes(term);
    const classMatch = (a.classroom_name || '').toLowerCase().includes(term);
    return titleMatch || classMatch;
  });

  // Calculate assignment status badge
  const getStatusBadge = (assignment) => {
    const now = new Date();
    if (assignment.open_date && new Date(assignment.open_date) > now) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
          <Clock className="w-3 h-3" />
          <span>Chưa mở</span>
        </span>
      );
    }
    if (assignment.due_date && new Date(assignment.due_date) < now) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600">
          <AlertTriangle className="w-3 h-3" />
          <span>Đã hết hạn</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
        <CheckCircle2 className="w-3 h-3" />
        <span>Đang diễn ra</span>
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-pastel-bg flex flex-col font-sans">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar role="teacher" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {/* Top Title & Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight flex items-center space-x-2">
                <Send className="w-6 h-6 text-pastel-purpleDark" />
                <span>Quản lý Giao bài tập & Về nhà</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Theo dõi, chỉnh sửa bài tập đã giao và giao bài tập linh hoạt theo từng bài học trên lớp.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setLessonModalOpen(true)}
                className="flex items-center space-x-1.5 px-4 py-2.5 bg-gradient-to-r from-pastel-purple to-pastel-purpleDark text-white rounded-2xl font-bold text-xs sm:text-sm shadow-sm hover:opacity-95 transition"
              >
                <Sparkles className="w-4 h-4" />
                <span>Giao bài theo bài học</span>
              </button>

              <button
                onClick={() => {
                  setSelectedExamForAssign(null);
                  setAssignmentModalOpen(true);
                }}
                className="flex items-center space-x-1.5 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-2xl font-semibold text-xs sm:text-sm shadow-xs hover:bg-gray-50 transition"
              >
                <Plus className="w-4 h-4 text-pastel-purpleDark" />
                <span>Giao từ kho bài tập</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-2 mb-6">
            <button
              onClick={() => setActiveTab('assigned')}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition ${
                activeTab === 'assigned'
                  ? 'bg-pastel-purple text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>Bài tập đã giao ({assignments.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('exams')}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition ${
                activeTab === 'exams'
                  ? 'bg-pastel-purple text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Kho bài tập ({totalExams})</span>
            </button>
          </div>

          {/* TAB 1: DANH SÁCH BÀI TẬP ĐÃ GIAO */}
          {activeTab === 'assigned' && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <School className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
                  <span className="text-xs font-bold text-gray-500 whitespace-nowrap">Lọc theo lớp:</span>
                  <select
                    value={selectedClassFilter}
                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-700 focus:outline-none focus:border-pastel-purple"
                  >
                    <option value="all">Tất cả các lớp ({classrooms.length})</option>
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.id}>
                        Lớp: {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên bài hoặc lớp..."
                    value={assignmentSearch}
                    onChange={(e) => setAssignmentSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pastel-purple"
                  />
                </div>
              </div>

              {/* Assignments Table Card */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                        <th className="p-4">Bài tập / Đề thi</th>
                        <th className="p-4">Lớp nhận bài</th>
                        <th className="p-4">Thời gian</th>
                        <th className="p-4">Cài đặt làm bài</th>
                        <th className="p-4">Trạng thái</th>
                        <th className="p-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                      {loadingAssignments ? (
                        <tr>
                          <td colSpan="6" className="py-16 text-center text-gray-400">
                            Đang tải danh sách bài tập đã giao...
                          </td>
                        </tr>
                      ) : filteredAssignments.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-16 text-center text-gray-400">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <BookOpen className="w-8 h-8 text-gray-300" />
                              <span className="font-medium">Chưa có bài tập nào được giao.</span>
                              <button
                                onClick={() => setLessonModalOpen(true)}
                                className="text-xs font-bold text-pastel-purpleDark hover:underline mt-1"
                              >
                                + Giao bài tập theo bài học ngay
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredAssignments.map((a) => {
                          const examTitle = a.exam?.title || `Đề thi #${a.exam_id}`;
                          const duration = a.duration_minutes_override ?? a.exam?.duration_minutes ?? 45;
                          const questionCount = a.exam?.question_count ?? a.exam?.questions?.length ?? 0;

                          return (
                            <tr key={`${a.classroom_id}-${a.exam_id}-${a.id}`} className="hover:bg-gray-50/60 transition">
                              <td className="p-4">
                                <div className="font-bold text-gray-800 text-sm">{examTitle}</div>
                                <div className="text-[11px] text-gray-400 mt-0.5 flex items-center space-x-2">
                                  <span>{questionCount} câu hỏi</span>
                                  {a.exam?.subject && <span>• {a.exam.subject}</span>}
                                  {a.exam?.pass_score && <span>• Điểm đạt: {a.exam.pass_score}</span>}
                                </div>
                              </td>

                              <td className="p-4">
                                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-purple-50 text-pastel-purpleDark font-bold text-xs border border-purple-100">
                                  <School className="w-3.5 h-3.5" />
                                  <span>{a.classroom_name || `Lớp #${a.classroom_id}`}</span>
                                </span>
                              </td>

                              <td className="p-4 space-y-1">
                                <div className="flex items-center space-x-1.5 text-xs text-gray-600">
                                  <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                  <span>Hạn: {a.due_date ? new Date(a.due_date).toLocaleString('vi-VN') : 'Không giới hạn'}</span>
                                </div>
                                {a.open_date && (
                                  <div className="flex items-center space-x-1.5 text-[11px] text-gray-400">
                                    <Calendar className="w-3 h-3 text-gray-400 shrink-0" />
                                    <span>Mở: {new Date(a.open_date).toLocaleString('vi-VN')}</span>
                                  </div>
                                )}
                              </td>

                              <td className="p-4 space-y-1 text-xs text-gray-600">
                                <div>Thời gian: <strong>{duration} phút</strong></div>
                                <div className="text-[11px] text-gray-400">
                                  Số lần làm: <strong>{a.max_attempts || 1}</strong> lượt
                                </div>
                                {a.show_answers_after_submit && (
                                  <div className="text-[10px] text-emerald-600 font-semibold flex items-center space-x-1">
                                    <Eye className="w-3 h-3" />
                                    <span>Xem đáp án sau thi</span>
                                  </div>
                                )}
                              </td>

                              <td className="p-4">
                                {getStatusBadge(a)}
                              </td>

                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end space-x-1.5">
                                  <button
                                    onClick={() => handleOpenEdit(a)}
                                    className="p-2 text-pastel-purpleDark hover:bg-purple-50 rounded-xl transition"
                                    title="Chỉnh sửa bài tập đã giao (Hạn nộp, số lần làm...)"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>

                                  <button
                                    onClick={() => handleDeleteAssignment(a)}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                                    title="Xóa / Hủy bài tập này khỏi lớp"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: KHO BÀI TẬP */}
          {activeTab === 'exams' && (
            <div className="space-y-4">
              <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="font-bold text-sm text-gray-700">
                  Chọn bài tập để giao cho các lớp học ({totalExams} bài tập)
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm bài tập..."
                    value={examSearch}
                    onChange={(e) => {
                      setExamSearch(e.target.value);
                      setExamPage(1);
                    }}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pastel-purple"
                  />
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                      <th className="p-4">Tiêu đề bài tập</th>
                      <th className="p-4">Thời gian</th>
                      <th className="p-4">Số lượng câu</th>
                      <th className="p-4">Trạng thái</th>
                      <th className="p-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {loadingExams ? (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-gray-400">
                          Đang tải kho bài tập...
                        </td>
                      </tr>
                    ) : exams.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-gray-400">
                          Không tìm thấy bài tập nào.
                        </td>
                      </tr>
                    ) : (
                      exams.map((exam) => (
                        <tr key={exam.id} className="hover:bg-gray-50/60 transition">
                          <td className="p-4 font-bold text-gray-800">
                            <div>{exam.title}</div>
                            {exam.description && (
                              <div className="text-xs text-gray-400 font-normal mt-0.5 line-clamp-1">
                                {exam.description}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-xs text-gray-600 font-medium">
                            {exam.duration_minutes} phút
                          </td>
                          <td className="p-4 text-xs font-semibold text-pastel-purpleDark">
                            {exam.question_count ?? exam.questions?.length ?? 0} câu
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              exam.is_published ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {exam.is_published ? 'Đã xuất bản' : 'Bản nháp'}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => openAssignExamModal(exam)}
                                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-pastel-purple text-white rounded-xl text-xs font-bold hover:bg-pastel-purpleDark transition shadow-xs"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Giao bài</span>
                              </button>
                              <button
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: 'Xóa bài tập khỏi kho',
                                    message: `Bạn có chắc chắn muốn xóa bài tập "${exam.title}" khỏi kho bài tập?`,
                                    confirmText: 'Xác nhận xóa',
                                    cancelText: 'Hủy'
                                  });
                                  if (!ok) return;
                                  try {
                                    await api.delete(`/exams/${exam.id}?force=true`);
                                    toast.success('Đã xóa bài tập khỏi kho thành công!');
                                    fetchExams();
                                  } catch (err) {
                                    toast.error(err.response?.data?.detail || 'Không thể xóa bài tập');
                                  }
                                }}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                                title="Xóa bài tập khỏi kho"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Modal Giao đề thi có sẵn */}
          <AssignmentModal
            exam={selectedExamForAssign}
            exams={exams}
            examType="ASSIGNMENT"
            isOpen={assignmentModalOpen}
            onClose={() => setAssignmentModalOpen(false)}
            onAssigned={() => {
              fetchAssignments();
              setActiveTab('assigned');
            }}
          />

          {/* Modal Chỉnh sửa bài tập đã giao */}
          <EditAssignmentModal
            assignment={selectedAssignmentForEdit}
            isOpen={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            onSaved={() => {
              toast.success('Cập nhật bài tập thành công!');
              fetchAssignments();
            }}
          />

          {/* Modal Giao bài tập theo bài học trên lớp */}
          <AssignByLessonModal
            isOpen={lessonModalOpen}
            onClose={() => setLessonModalOpen(false)}
            onSuccess={() => {
              toast.success('Tạo và giao bài tập theo bài học thành công!');
              fetchAssignments();
              setActiveTab('assigned');
            }}
          />
        </main>
      </div>
    </div>
  );
}
