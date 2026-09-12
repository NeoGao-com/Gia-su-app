import React, { useEffect, useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api from '../../api/axios';
import {
  Plus, Trash2, UserPlus, CheckSquare, Square, Search,
  Copy, Check, Users, UserMinus
} from 'lucide-react';
import { Modal } from '../../components/Modal';

export function ClassroomManagement() {
  const [activeTab, setActiveTab] = useState('classes'); // 'classes' | 'students'
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [studentsInClass, setStudentsInClass] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [studentModalMode, setStudentModalMode] = useState('new'); // 'new' | 'existing'
  
  // New group form
  const [form, setForm] = useState({ name: '', description: '' });

  // Quick add new student form
  const [newStudentForm, setNewStudentForm] = useState({
    full_name: '',
    email: '',
    password: 'Password@123!'
  });

  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const refreshClassrooms = async () => {
    try {
      const res = await api.get('/classrooms/?limit=100');
      const items = Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
      setClassrooms(items);
      return items;
    } catch {
      setClassrooms([]);
      return [];
    }
  };

  const refreshStudentsInClass = async (classObj) => {
    if (!classObj?.id) return [];
    try {
      const res = await api.get(`/classrooms/${classObj.id}/students`);
      return res.data || [];
    } catch {
      return [];
    }
  };

  const refreshAllStudents = async () => {
    try {
      const res = await api.get('/classrooms/students/all');
      setAllStudents(res.data || []);
    } catch {
      setAllStudents([]);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [classRes, studRes] = await Promise.all([
          api.get('/classrooms/?limit=100'),
          api.get('/classrooms/students/all')
        ]);
        if (cancelled) return;
        const items = Array.isArray(classRes.data?.items) ? classRes.data.items : (Array.isArray(classRes.data) ? classRes.data : []);
        setClassrooms(items);
        setAllStudents(studRes.data || []);
        if (items.length > 0) {
          setSelectedClass((prev) => prev ?? items[0]);
        }
      } catch {
        if (!cancelled) {
          setClassrooms([]);
          setAllStudents([]);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const selectedClassId = selectedClass?.id;
  useEffect(() => {
    if (!selectedClassId) return;
    let cancelled = false;
    const load = async () => {
      const list = await refreshStudentsInClass({ id: selectedClassId });
      if (!cancelled) setStudentsInClass(list);
    };
    load();
    return () => { cancelled = true; };
  }, [selectedClassId]);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleDeleteClassroom = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Bạn có chắc chắn muốn xóa nhóm kèm này?')) return;
    try {
      await api.delete(`/classrooms/${id}`);
      await refreshClassrooms();
      if (selectedClass?.id === id) setSelectedClass(null);
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể xóa nhóm kèm');
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      const res = await api.post('/classrooms/', form);
      setIsClassModalOpen(false);
      setForm({ name: '', description: '' });
      await refreshClassrooms();
      setSelectedClass(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể tạo nhóm kèm');
    }
  };

  // Quick create student directly into class
  const handleQuickCreateStudent = async (e) => {
    e.preventDefault();
    if (!newStudentForm.email.trim() || !selectedClass) return;
    setActionLoading(true);
    try {
      await api.post(`/classrooms/${selectedClass.id}/students`, {
        email: newStudentForm.email.trim(),
        full_name: newStudentForm.full_name.trim() || newStudentForm.email.split('@')[0],
        password: newStudentForm.password || 'Password@123!'
      });
      await refreshStudentsInClass(selectedClass.id);
      await refreshAllStudents();
      setNewStudentForm({ full_name: '', email: '', password: 'Password@123!' });
      setIsStudentModalOpen(false);
      alert('Đã thêm học sinh vào nhóm thành công!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể thêm học sinh');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStudent = (studentId) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const handleAddSelectedStudents = async () => {
    if (selectedStudentIds.length === 0 || !selectedClass) return;
    setActionLoading(true);
    try {
      for (const sId of selectedStudentIds) {
        const student = allStudents.find(s => s.id === sId);
        if (student) {
          await api.post(`/classrooms/${selectedClass.id}/students`, { email: student.email });
        }
      }
      setIsStudentModalOpen(false);
      setSelectedStudentIds([]);
      setModalSearchQuery('');
      await refreshStudentsInClass(selectedClass.id);
      alert('Đã thêm các học sinh đã chọn vào nhóm thành công!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể thêm học sinh');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveStudentFromClass = async (studentId, studentName) => {
    if (!confirm(`Bạn có chắc muốn xóa học sinh "${studentName}" khỏi nhóm kèm này?`)) return;
    try {
      await api.delete(`/classrooms/${selectedClass.id}/students/${studentId}`);
      await refreshStudentsInClass(selectedClass.id);
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể xóa học sinh khỏi nhóm');
    }
  };

  const filteredStudentsForModal = allStudents.filter(s => {
    const query = modalSearchQuery.toLowerCase();
    const nameMatch = (s.full_name || '').toLowerCase().includes(query);
    const emailMatch = (s.email || '').toLowerCase().includes(query);
    return nameMatch || emailMatch;
  });

  return (
    <div className="min-h-screen bg-pastel-bg">
      <Navbar />
      <div className="flex">
        <Sidebar role="teacher" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl">
          {/* Header & Tabs */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Lớp & Nhóm Dạy Kèm</h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">Quản lý các nhóm kèm 1-1, nhóm nhỏ và danh sách học sinh</p>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
              <div className="inline-flex bg-gray-100 p-1 rounded-2xl">
                <button
                  onClick={() => setActiveTab('classes')}
                  className={`px-4 py-2 rounded-xl font-bold text-xs transition ${activeTab === 'classes' ? 'bg-white text-pastel-purpleDark shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Nhóm dạy kèm ({classrooms.length})
                </button>
                <button
                  onClick={() => setActiveTab('students')}
                  className={`px-4 py-2 rounded-xl font-bold text-xs transition ${activeTab === 'students' ? 'bg-white text-pastel-purpleDark shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Tất cả học sinh ({allStudents.length})
                </button>
              </div>

              {activeTab === 'classes' && (
                <button
                  onClick={() => setIsClassModalOpen(true)}
                  className="flex items-center space-x-1.5 px-4 py-2.5 bg-pastel-purple text-white rounded-2xl font-bold text-xs hover:bg-pastel-purpleDark transition shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo nhóm kèm</span>
                </button>
              )}
            </div>
          </div>

          {activeTab === 'classes' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Group List (Left Column) */}
              <div className="lg:col-span-4 space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Danh sách nhóm ({classrooms.length})</h3>
                {classrooms.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 text-center border border-dashed border-gray-200">
                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-gray-600">Chưa có nhóm kèm nào</p>
                    <button
                      onClick={() => setIsClassModalOpen(true)}
                      className="mt-3 text-xs font-bold text-pastel-purpleDark hover:underline"
                    >
                      + Tạo nhóm đầu tiên
                    </button>
                  </div>
                ) : (
                  classrooms.map(c => {
                    const isSelected = selectedClass?.id === c.id;
                    return (
                      <div 
                        key={c.id} 
                        onClick={() => setSelectedClass(c)}
                        className={`bg-white rounded-3xl p-5 border cursor-pointer transition ${isSelected ? 'border-pastel-purple ring-2 ring-pastel-purpleLight shadow-md' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'} group`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="text-base font-bold text-gray-800 group-hover:text-pastel-purpleDark transition">{c.name}</h3>
                            <span className="text-xs text-gray-400 mt-0.5 block">{c.description || 'Chưa có ghi chú'}</span>
                          </div>
                          <button
                            onClick={(e) => handleDeleteClassroom(c.id, e)}
                            className="text-gray-300 hover:text-red-500 p-1.5 rounded-xl transition"
                            title="Xóa nhóm kèm này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-50 mt-3">
                          <span className="inline-flex items-center space-x-1 font-medium text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                            <Users className="w-3 h-3" />
                            <span>{c.students?.length || 0} học sinh</span>
                          </span>
                          <span className="font-mono bg-purple-50 text-pastel-purpleDark px-2 py-0.5 rounded-md font-bold">
                            Mã: {c.code}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Group Detail (Right Column) */}
              <div className="lg:col-span-8">
                {selectedClass ? (
                  <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm">
                    {/* Class Information Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-100 mb-6">
                      <div>
                        <div className="flex items-center space-x-3">
                          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-800">{selectedClass.name}</h2>
                          <span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full font-bold">
                            {studentsInClass.length} học sinh
                          </span>
                        </div>
                        {selectedClass.description && (
                          <p className="text-sm text-gray-500 mt-1">{selectedClass.description}</p>
                        )}
                      </div>

                      {/* Prominent Invite Code with Copy */}
                      <div className="bg-pastel-bg p-3.5 rounded-2xl border border-pastel-purple/20 flex items-center space-x-3">
                        <div>
                          <div className="text-[10px] font-bold text-gray-500 uppercase">Mã tham gia nhóm</div>
                          <div className="text-base font-mono font-black text-pastel-purpleDark tracking-wider">
                            {selectedClass.code}
                          </div>
                        </div>
                        <button
                          onClick={() => handleCopyCode(selectedClass.code)}
                          className="p-2 bg-white text-pastel-purpleDark rounded-xl shadow-sm hover:bg-purple-50 transition border border-pastel-purple/10"
                          title="Sao chép mã vào lớp để gửi học sinh"
                        >
                          {copiedCode === selectedClass.code ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Students in this Group Section */}
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-800 text-base flex items-center space-x-2">
                        <Users className="w-4 h-4 text-pastel-purpleDark" />
                        <span>Danh sách học sinh trong nhóm ({studentsInClass.length})</span>
                      </h3>

                      <button
                        onClick={() => {
                          setIsStudentModalOpen(true);
                          setStudentModalMode('new');
                          setModalSearchQuery('');
                        }}
                        className="flex items-center space-x-1.5 px-3.5 py-2 bg-pastel-purple text-white rounded-2xl font-bold text-xs hover:bg-pastel-purpleDark transition shadow-sm"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ Thêm học sinh</span>
                      </button>
                    </div>

                    {/* Student List */}
                    <div className="space-y-2.5">
                      {studentsInClass.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                          <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm font-medium text-gray-500">Chưa có học sinh nào trong nhóm này</p>
                          <p className="text-xs text-gray-400 mt-1">Gửi mã <b>{selectedClass.code}</b> cho học sinh hoặc bấm "+ Thêm học sinh" để tạo nhanh</p>
                        </div>
                      ) : (
                        studentsInClass.map((s) => (
                          <div 
                            key={s.id} 
                            className="p-4 bg-gray-50 hover:bg-white hover:shadow-sm border border-gray-100 rounded-2xl flex items-center justify-between transition"
                          >
                            <div className="flex items-center space-x-3.5">
                              <div className="w-9 h-9 rounded-xl bg-purple-100 text-pastel-purpleDark font-extrabold flex items-center justify-center text-sm">
                                {(s.full_name || s.email || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h4 className="font-bold text-sm text-gray-800">{s.full_name || 'Chưa đặt tên'}</h4>
                                <p className="text-xs text-gray-400">{s.email}</p>
                              </div>
                            </div>

                            <div className="flex items-center space-x-3">
                              <span className="text-[11px] bg-emerald-50 text-emerald-600 font-bold px-2.5 py-1 rounded-full">
                                Đang học
                              </span>
                              <button
                                onClick={() => handleRemoveStudentFromClass(s.id, s.full_name || s.email)}
                                className="text-gray-400 hover:text-red-500 p-1.5 rounded-xl transition"
                                title="Xóa học sinh khỏi nhóm"
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl p-12 text-center text-gray-400 border border-gray-100">
                    Chọn một nhóm dạy kèm bên trái để xem chi tiết
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* All Students Tab */
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Tất cả học sinh kèm trong hệ thống</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Tổng số học sinh có tài khoản học tập</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      <th className="p-4 rounded-l-2xl">Học sinh</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Vai trò</th>
                      <th className="p-4 rounded-r-2xl">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {allStudents.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50 transition">
                        <td className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-xl bg-purple-100 text-pastel-purpleDark font-bold flex items-center justify-center text-xs">
                              {(s.full_name || s.email || '?').charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-gray-800">{s.full_name || 'Chưa cập nhật'}</span>
                          </div>
                        </td>
                        <td className="p-4 text-gray-600 font-mono text-xs">{s.email}</td>
                        <td className="p-4">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold">
                            <span>Học sinh</span>
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-xs text-emerald-600 font-bold">Hoạt động</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Modal: Create Tutoring Group */}
          <Modal isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)} title="Tạo Nhóm Dạy Kèm Mới">
            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Tên nhóm / Lớp kèm</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Toán 12 - Luyện thi ĐH, Nhóm Kèm 1-1 Nam..."
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pastel-purple text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Mô tả / Lịch học (tùy chọn)</label>
                <textarea
                  placeholder="Ví dụ: Tối thứ 3 & thứ 6 (19:30 - 21:00) tại phòng học online"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pastel-purple text-sm resize-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsClassModalOpen(false)}
                  className="px-4 py-2.5 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-pastel-purple text-white rounded-xl text-xs font-bold hover:bg-pastel-purpleDark transition shadow-sm"
                >
                  Tạo nhóm kèm
                </button>
              </div>
            </form>
          </Modal>

          {/* Modal: Add Students (Quick Add or Existing) */}
          <Modal 
            isOpen={isStudentModalOpen} 
            onClose={() => setIsStudentModalOpen(false)} 
            title={`Thêm Học Sinh Vào Nhóm "${selectedClass?.name}"`}
          >
            <div className="space-y-4">
              {/* Modal Tabs */}
              <div className="flex border-b border-gray-100 pb-2">
                <button
                  type="button"
                  onClick={() => setStudentModalMode('new')}
                  className={`pb-2 px-3 text-xs font-bold border-b-2 transition ${studentModalMode === 'new' ? 'border-pastel-purple text-pastel-purpleDark' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                  + Tạo nhanh học sinh mới
                </button>
                <button
                  type="button"
                  onClick={() => setStudentModalMode('existing')}
                  className={`pb-2 px-3 text-xs font-bold border-b-2 transition ${studentModalMode === 'existing' ? 'border-pastel-purple text-pastel-purpleDark' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                  Chọn từ danh sách có sẵn
                </button>
              </div>

              {studentModalMode === 'new' ? (
                /* Quick Add Form */
                <form onSubmit={handleQuickCreateStudent} className="space-y-3.5 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Họ và tên học sinh *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Nguyễn Văn An"
                      value={newStudentForm.full_name}
                      onChange={e => setNewStudentForm({ ...newStudentForm, full_name: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pastel-purple"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Email đăng nhập *</label>
                    <input
                      type="email"
                      required
                      placeholder="hocsinh@gmail.com"
                      value={newStudentForm.email}
                      onChange={e => setNewStudentForm({ ...newStudentForm, email: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pastel-purple"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Mật khẩu mặc định</label>
                    <input
                      type="text"
                      value={newStudentForm.password}
                      onChange={e => setNewStudentForm({ ...newStudentForm, password: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-pastel-purple"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Học sinh có thể đổi mật khẩu sau khi đăng nhập</p>
                  </div>

                  <div className="flex justify-end space-x-3 pt-3">
                    <button
                      type="button"
                      onClick={() => setIsStudentModalOpen(false)}
                      className="px-4 py-2.5 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-5 py-2.5 bg-pastel-purple text-white rounded-xl text-xs font-bold hover:bg-pastel-purpleDark transition shadow-sm disabled:opacity-50"
                    >
                      {actionLoading ? 'Đang xử lý...' : 'Tạo & Thêm vào nhóm'}
                    </button>
                  </div>
                </form>
              ) : (
                /* Select Existing Students */
                <div className="space-y-4 pt-1">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên hoặc email..."
                      value={modalSearchQuery}
                      onChange={e => setModalSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-pastel-purple"
                    />
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2 pr-2">
                    {filteredStudentsForModal.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-xs">Không tìm thấy học sinh phù hợp.</div>
                    ) : (
                      filteredStudentsForModal.map(s => {
                        const isChecked = selectedStudentIds.includes(s.id);
                        const alreadyInClass = studentsInClass.some(sc => sc.id === s.id);
                        return (
                          <div 
                            key={s.id}
                            onClick={() => !alreadyInClass && handleToggleStudent(s.id)}
                            className={`p-3 rounded-2xl border flex items-center justify-between transition ${alreadyInClass ? 'bg-gray-100 opacity-60 cursor-not-allowed' : `cursor-pointer hover:border-pastel-purple ${isChecked ? 'bg-purple-50 border-pastel-purple' : 'bg-white'}`}`}
                          >
                            <div className="flex items-center space-x-3">
                              {!alreadyInClass && (
                                isChecked ? <CheckSquare className="w-4 h-4 text-pastel-purpleDark" /> : <Square className="w-4 h-4 text-gray-400" />
                              )}
                              <div>
                                <div className="font-bold text-xs sm:text-sm text-gray-800">{s.full_name || 'Chưa cập nhật'}</div>
                                <div className="text-[11px] text-gray-500 font-mono">{s.email}</div>
                              </div>
                            </div>
                            {alreadyInClass && <span className="text-xs text-emerald-600 font-bold">Đã có trong nhóm</span>}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="flex justify-end space-x-3 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setIsStudentModalOpen(false)} 
                      className="px-4 py-2 border rounded-xl text-xs font-semibold"
                    >
                      Hủy
                    </button>
                    <button 
                      type="button" 
                      disabled={actionLoading || selectedStudentIds.length === 0}
                      onClick={handleAddSelectedStudents} 
                      className="px-5 py-2 bg-pastel-purple text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50"
                    >
                      {actionLoading ? 'Đang xử lý...' : `Thêm học sinh đã chọn (${selectedStudentIds.length})`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Modal>
        </main>
      </div>
    </div>
  );
}

