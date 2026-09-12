import React, { useEffect, useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api from '../../api/axios';
import { Send, Plus, Trash2, Calendar, BookOpen, School } from 'lucide-react';
import { Modal } from '../../components/Modal';

export function AssignmentManagement() {
  const [classrooms, setClassrooms] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    exam_id: '',
    due_date: '',
    open_date: '',
    max_attempts: 1,
    duration_minutes_override: ''
  });

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const [classRes, examRes] = await Promise.all([
          api.get('/classrooms/?limit=100'),
          api.get('/exams')
        ]);
        if (cancelled) return;
        const classes = Array.isArray(classRes.data?.items) ? classRes.data.items : (Array.isArray(classRes.data) ? classRes.data : []);
        setClassrooms(classes);
        const examItems = Array.isArray(examRes.data?.items) ? examRes.data.items : (Array.isArray(examRes.data) ? examRes.data : []);
        setExams(examItems);
        if (classes.length > 0) {
          setSelectedClassId(prev => prev || classes[0].id);
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu giao bài:', err);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchAssignments = async (classId) => {
      try {
        const res = await api.get(`/classrooms/${classId}`);
        if (cancelled) return;
        const assignedList = res.data?.assignments || [];
        setAssignments(assignedList);
      } catch (err) {
        console.error('Lỗi tải danh sách bài giao:', err);
        if (!cancelled) setAssignments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (selectedClassId) {
      fetchAssignments(selectedClassId);
    }
    return () => { cancelled = true; };
  }, [selectedClassId]);

  const refreshAssignments = async () => {
    if (!selectedClassId) return;
    try {
      setLoading(true);
      const res = await api.get(`/classrooms/${selectedClassId}`);
      setAssignments(res.data?.assignments || []);
    } catch (err) {
      console.error('Lỗi tải danh sách bài giao:', err);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignExam = async (e) => {
    e.preventDefault();
    if (!selectedClassId || !form.exam_id) return;
    try {
      const payload = {
        exam_id: Number(form.exam_id),
        classroom_id: Number(selectedClassId),
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        open_date: form.open_date ? new Date(form.open_date).toISOString() : null,
        max_attempts: form.max_attempts ? Number(form.max_attempts) : 1,
        duration_minutes_override: form.duration_minutes_override ? Number(form.duration_minutes_override) : null
      };
      await api.post(`/classrooms/${selectedClassId}/exams`, payload);
      setIsModalOpen(false);
      setForm({ exam_id: '', due_date: '', open_date: '', max_attempts: 1, duration_minutes_override: '' });
      refreshAssignments();
      alert('Giao đề thi cho lớp học thành công!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể giao đề thi');
    }
  };

  const handleUnassign = async (examId) => {
    if (!confirm('Bạn có chắc muốn hủy giao đề thi này cho lớp?')) return;
    try {
      await api.delete(`/classrooms/${selectedClassId}/exams/${examId}`);
      refreshAssignments();
      alert('Đã hủy giao đề thi!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể hủy giao đề thi');
    }
  };

  const currentClass = classrooms.find(c => c.id === Number(selectedClassId));

  return (
    <div className="min-h-screen bg-pastel-bg">
      <Navbar />
      <div className="flex">
        <Sidebar role="teacher" />
        <main className="flex-1 p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
                <Send className="w-7 h-7 text-pastel-purpleDark" />
                <span>Giao Đề thi cho Lớp học</span>
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                Phân công đề thi, thiết lập thời hạn nộp bài và quản lý danh sách bài đã giao cho từng lớp.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              disabled={!selectedClassId}
              className="flex items-center space-x-2 px-4 py-2.5 bg-pastel-purple text-white rounded-2xl font-semibold text-sm shadow-sm hover:opacity-90 transition disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Giao đề thi mới</span>
            </button>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Classroom Selector Sidebar */}
            <div className="col-span-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-800 text-sm flex items-center space-x-2">
                <School className="w-4 h-4 text-pastel-purpleDark" />
                <span>Chọn lớp học</span>
              </h3>
              {classrooms.length === 0 ? (
                <div className="text-xs text-gray-400 py-4 text-center">Chưa có lớp học nào.</div>
              ) : (
                <div className="space-y-2">
                  {classrooms.map(c => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedClassId(c.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition ${Number(selectedClassId) === c.id ? 'bg-purple-50 border-pastel-purple font-bold text-pastel-purpleDark' : 'bg-gray-50 border-gray-100 text-gray-700 hover:bg-gray-100'}`}
                    >
                      <div className="text-base font-bold">{c.name}</div>
                      <div className="text-xs opacity-70 mt-0.5">Mã lớp: {c.code || c.id}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assignments List */}
            <div className="col-span-8 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 text-base">
                  Danh sách đề thi đã giao {currentClass ? `cho lớp ${currentClass.name}` : ''}
                </h3>
              </div>

              {loading ? (
                <div className="text-center py-16 text-gray-400">Đang tải danh sách bài giao...</div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-16 text-gray-400">Lớp học này chưa được giao đề thi nào.</div>
              ) : (
                <div className="space-y-3">
                  {assignments.map(a => (
                    <div key={a.id || a.exam_id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-3 bg-purple-100 text-pastel-purpleDark rounded-xl">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-800 text-base">{a.exam?.title || `Đề thi ID: ${a.exam_id}`}</div>
                          <div className="text-xs text-gray-500 flex items-center space-x-2 mt-1">
                            <span className="flex items-center space-x-1">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              <span>Hạn nộp: {a.due_date ? new Date(a.due_date).toLocaleString('vi-VN') : 'Không giới hạn'}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUnassign(a.exam_id)}
                        className="p-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition"
                        title="Hủy giao đề"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Giao đề thi cho lớp học" size="lg">
            <form onSubmit={handleAssignExam} className="space-y-4 p-2 max-h-[80vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Chọn đề thi</label>
                <select
                  required
                  value={form.exam_id}
                  onChange={e => setForm({ ...form, exam_id: e.target.value })}
                  className="w-full px-3 py-2.5 border rounded-xl text-sm bg-white"
                >
                  <option value="">-- Chọn đề thi --</option>
                  {exams.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.title} ({ex.duration_minutes} phút)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Thời gian mở đề (Tùy chọn)</label>
                  <input
                    type="datetime-local"
                    value={form.open_date}
                    onChange={e => setForm({ ...form, open_date: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Hạn nộp bài (Tùy chọn)</label>
                  <input
                    type="datetime-local"
                    value={form.due_date}
                    onChange={e => setForm({ ...form, due_date: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Số lần làm bài tối đa</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={form.max_attempts}
                    onChange={e => setForm({ ...form, max_attempts: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm"
                    placeholder="Mặc định: 1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Thời gian làm bài riêng (phút)</label>
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={form.duration_minutes_override}
                    onChange={e => setForm({ ...form, duration_minutes_override: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-xl text-sm"
                    placeholder="Để trống nếu dùng theo đề"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-xl text-sm">Hủy</button>
                <button type="submit" className="px-5 py-2.5 bg-pastel-purple text-white rounded-xl text-sm font-semibold hover:bg-pastel-purpleDark transition">
                  Xác nhận giao bài
                </button>
              </div>
            </form>
          </Modal>
        </main>
      </div>
    </div>
  );
}
