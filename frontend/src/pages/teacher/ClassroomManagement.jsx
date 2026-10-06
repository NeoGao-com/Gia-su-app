import React, { useEffect, useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api, { clearApiCache } from '../../api/axios';
import {
  Plus, Trash2, UserPlus, CheckSquare, Square, Search,
  Copy, Check, Users, UserMinus, Edit3, Phone, School,
  Calendar, HeartHandshake, KeyRound, Pencil, GraduationCap, FileText
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { EditAssignmentModal } from '../../components/EditAssignmentModal';
import { useToast } from '../../context/ToastContext';

export function ClassroomManagement() {
  const { toast, confirm } = useToast();
  const [activeTab, setActiveTab] = useState('classes'); // 'classes' | 'students'
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [studentsInClass, setStudentsInClass] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [studentModalMode, setStudentModalMode] = useState('new'); // 'new' | 'existing'

  // System student modal & form
  const [isSystemStudentModalOpen, setIsSystemStudentModalOpen] = useState(false);
  const [systemStudentForm, setSystemStudentForm] = useState({
    full_name: '',
    email: '',
    password: 'Password@123!',
    phone_number: '',
    parent_phone: '',
    parent_name: '',
    date_of_birth: '',
    gender: 'Nam',
    school: '',
    student_code: '',
    grade_level: '',
    notes: '',
  });

  // Edit student modal & form
  const [isEditStudentModalOpen, setIsEditStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editStudentForm, setEditStudentForm] = useState({
    full_name: '',
    phone_number: '',
    parent_phone: '',
    parent_name: '',
    date_of_birth: '',
    gender: 'Nam',
    school: '',
    student_code: '',
    grade_level: '',
    notes: '',
    password: '',
  });

  const [isUnassignExamModalOpen, setIsUnassignExamModalOpen] = useState(false);
  const [examToUnassign, setExamToUnassign] = useState(null);
  const [selectedStudentIdsForUnassign, setSelectedStudentIdsForUnassign] = useState([]);

  const [isEditAssignmentModalOpen, setIsEditAssignmentModalOpen] = useState(false);
  const [assignmentToEdit, setAssignmentToEdit] = useState(null);

  // New group form
  const [form, setForm] = useState({ name: '', description: '' });

  // Quick add new student form
  const [newStudentForm, setNewStudentForm] = useState({
    full_name: '',
    email: '',
    password: 'Password@123!',
    phone_number: '',
    parent_phone: '',
    parent_name: '',
    date_of_birth: '',
    gender: 'Nam',
    school: '',
    student_code: '',
    grade_level: '',
    notes: '',
  });

  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const refreshClassrooms = async () => {
    try {
      const res = await api.get('/classrooms', { params: { limit: 100 } });
      const items = Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
      setClassrooms(items);
      return items;
    } catch {
      setClassrooms([]);
      return [];
    }
  };

  const refreshStudentsInClass = async (classObjOrId) => {
    const id = typeof classObjOrId === 'object' ? classObjOrId?.id : classObjOrId;
    if (!id) return [];
    try {
      const res = await api.get(`/classrooms/${id}/students`);
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
          api.get('/classrooms', { params: { limit: 100 } }),
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
    toast.success(`Đã sao chép mã nhóm: ${code}`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleDeleteClassroom = (id, e) => {
    e.stopPropagation();
    confirm({
      title: 'Xóa nhóm kèm',
      message: 'Bạn có chắc chắn muốn xóa nhóm kèm này? Học sinh và bài tập liên quan sẽ được gỡ khỏi nhóm.',
      confirmText: 'Xóa nhóm',
      onConfirm: async () => {
        try {
          await api.delete(`/classrooms/${id}`);
          clearApiCache();
          await refreshClassrooms();
          if (selectedClass?.id === id) setSelectedClass(null);
          toast.success('Đã xóa nhóm kèm thành công!');
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Không thể xóa nhóm kèm');
        }
      }
    });
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      const res = await api.post('/classrooms', form);
      clearApiCache();
      setIsClassModalOpen(false);
      setForm({ name: '', description: '' });
      await refreshClassrooms();
      setSelectedClass(res.data);
      toast.success('Đã tạo nhóm kèm mới thành công!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể tạo nhóm kèm');
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
        password: newStudentForm.password || 'Password@123!',
        phone_number: newStudentForm.phone_number?.trim() || null,
        parent_phone: newStudentForm.parent_phone?.trim() || null,
        parent_name: newStudentForm.parent_name?.trim() || null,
        date_of_birth: newStudentForm.date_of_birth || null,
        gender: newStudentForm.gender || null,
        school: newStudentForm.school?.trim() || null,
        student_code: newStudentForm.student_code?.trim() || null,
        grade_level: newStudentForm.grade_level ? parseInt(newStudentForm.grade_level, 10) : null,
        notes: newStudentForm.notes?.trim() || null,
      });
      const list = await refreshStudentsInClass(selectedClass.id);
      setStudentsInClass(list);
      await refreshAllStudents();
      setNewStudentForm({
        full_name: '',
        email: '',
        password: 'Password@123!',
        phone_number: '',
        parent_phone: '',
        parent_name: '',
        date_of_birth: '',
        gender: 'Nam',
        school: '',
        student_code: '',
        grade_level: '',
        notes: '',
      });
      setIsStudentModalOpen(false);
      toast.success('Đã thêm học sinh vào nhóm thành công!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể thêm học sinh');
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
      const list = await refreshStudentsInClass(selectedClass.id);
      setStudentsInClass(list);
      toast.success('Đã thêm các học sinh đã chọn vào nhóm thành công!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể thêm học sinh');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveStudentFromClass = (studentId, studentName) => {
    confirm({
      title: 'Xóa học sinh khỏi nhóm',
      message: `Bạn có chắc muốn xóa học sinh "${studentName}" khỏi nhóm kèm này?`,
      confirmText: 'Xóa khỏi nhóm',
      onConfirm: async () => {
        try {
          await api.delete(`/classrooms/${selectedClass.id}/students/${studentId}`);
          const list = await refreshStudentsInClass(selectedClass.id);
          setStudentsInClass(list);
          toast.success('Đã xóa học sinh khỏi nhóm thành công!');
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Không thể xóa học sinh khỏi nhóm');
        }
      }
    });
  };

  const handleUnassignExam = (examId, examTitle, studentIds = null) => {
    confirm({
      title: 'Hủy giao đề thi',
      message: `Bạn có chắc chắn muốn hủy giao đề thi "${examTitle}" cho ${studentIds ? 'các học sinh đã chọn' : 'toàn bộ lớp'}?`,
      confirmText: 'Hủy giao đề',
      onConfirm: async () => {
        try {
          await api.delete(`/classrooms/${selectedClass.id}/exams/${examId}`, { data: { student_ids: studentIds } });
          toast.success('Đã hủy giao đề thi thành công!');
          const updatedClassrooms = await refreshClassrooms();
          const updated = updatedClassrooms.find(c => c.id === selectedClass.id);
          if (updated) {
            setSelectedClass(updated);
            const updatedStudents = await refreshStudentsInClass(updated);
            setStudentsInClass(updatedStudents);
          }
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Lỗi khi hủy giao đề thi');
        }
      }
    });
  };

  const handleCreateSystemStudent = async (e) => {
    e.preventDefault();
    if (!systemStudentForm.email.trim()) return;
    setActionLoading(true);
    try {
      await api.post('/classrooms/students', {
        email: systemStudentForm.email.trim(),
        full_name: systemStudentForm.full_name.trim() || systemStudentForm.email.split('@')[0],
        password: systemStudentForm.password || 'Password@123!',
        phone_number: systemStudentForm.phone_number?.trim() || null,
        parent_phone: systemStudentForm.parent_phone?.trim() || null,
        parent_name: systemStudentForm.parent_name?.trim() || null,
        date_of_birth: systemStudentForm.date_of_birth || null,
        gender: systemStudentForm.gender || null,
        school: systemStudentForm.school?.trim() || null,
        student_code: systemStudentForm.student_code?.trim() || null,
        grade_level: systemStudentForm.grade_level ? parseInt(systemStudentForm.grade_level, 10) : null,
        notes: systemStudentForm.notes?.trim() || null,
      });
      await refreshAllStudents();
      setIsSystemStudentModalOpen(false);
      setSystemStudentForm({
        full_name: '',
        email: '',
        password: 'Password@123!',
        phone_number: '',
        parent_phone: '',
        parent_name: '',
        date_of_birth: '',
        gender: 'Nam',
        school: '',
        student_code: '',
        grade_level: '',
        notes: '',
      });
      toast.success('Đã thêm học sinh vào hệ thống thành công!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể thêm học sinh');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEditStudent = (student) => {
    setEditingStudent(student);
    setEditStudentForm({
      full_name: student.full_name || '',
      phone_number: student.phone_number || '',
      parent_phone: student.parent_phone || '',
      parent_name: student.parent_name || '',
      date_of_birth: student.date_of_birth || '',
      gender: student.gender || 'Nam',
      school: student.school || '',
      student_code: student.student_code || '',
      grade_level: student.grade_level ? String(student.grade_level) : '',
      notes: student.notes || '',
      password: '',
    });
    setIsEditStudentModalOpen(true);
  };

  const handleSaveEditStudent = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;
    setActionLoading(true);
    try {
      const payload = {
        full_name: editStudentForm.full_name.trim(),
        phone_number: editStudentForm.phone_number?.trim() || null,
        parent_phone: editStudentForm.parent_phone?.trim() || null,
        parent_name: editStudentForm.parent_name?.trim() || null,
        date_of_birth: editStudentForm.date_of_birth || null,
        gender: editStudentForm.gender || null,
        school: editStudentForm.school?.trim() || null,
        student_code: editStudentForm.student_code?.trim() || null,
        grade_level: editStudentForm.grade_level ? parseInt(editStudentForm.grade_level, 10) : null,
        notes: editStudentForm.notes?.trim() || null,
      };
      if (editStudentForm.password.trim()) {
        payload.password = editStudentForm.password.trim();
      }

      await api.put(`/classrooms/students/${editingStudent.id}`, payload);
      await refreshAllStudents();
      if (selectedClass) {
        const list = await refreshStudentsInClass(selectedClass.id);
        setStudentsInClass(list);
      }
      setIsEditStudentModalOpen(false);
      setEditingStudent(null);
      toast.success('Đã cập nhật thông tin học sinh thành công!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể cập nhật thông tin học sinh');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSystemStudent = (studentId, studentName) => {
    confirm({
      title: 'Xóa tài khoản học sinh',
      message: `Bạn có chắc chắn muốn xóa học sinh "${studentName}" khỏi hệ thống? Dữ liệu điểm số và bài thi của học sinh này sẽ bị xóa.`,
      confirmText: 'Xóa vĩnh viễn',
      onConfirm: async () => {
        try {
          await api.delete(`/classrooms/students/${studentId}`);
          await refreshAllStudents();
          await refreshClassrooms();
          if (selectedClass) {
            await refreshStudentsInClass(selectedClass.id);
          }
          toast.success('Đã xóa học sinh khỏi hệ thống!');
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Không thể xóa học sinh');
        }
      }
    });
  };


  const filteredStudentsForModal = allStudents.filter(s => {
    const query = modalSearchQuery.toLowerCase();
    const nameMatch = (s.full_name || '').toLowerCase().includes(query);
    const emailMatch = (s.email || '').toLowerCase().includes(query);
    return nameMatch || emailMatch;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex">
        <Sidebar role="teacher" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl">
          {/* Header & Tabs */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Quản lý Lớp học & Học sinh</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">Quản lý các lớp học, danh sách học sinh và phân bổ bài tập kiểm tra</p>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
              <div className="inline-flex bg-slate-200/70 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('classes')}
                  className={`px-4 py-2 rounded-lg font-bold text-xs transition ${activeTab === 'classes' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Lớp học phụ trách ({classrooms.length})
                </button>
                <button
                  onClick={() => setActiveTab('students')}
                  className={`px-4 py-2 rounded-lg font-bold text-xs transition ${activeTab === 'students' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Tất cả học sinh ({allStudents.length})
                </button>
              </div>

              {activeTab === 'classes' ? (
                <button
                  onClick={() => setIsClassModalOpen(true)}
                  className="flex items-center space-x-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 active:scale-95 transition shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo lớp học mới</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSystemStudentForm({ full_name: '', email: '', password: 'Password@123!' });
                    setIsSystemStudentModalOpen(true);
                  }}
                  className="flex items-center space-x-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 active:scale-95 transition shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Thêm học sinh</span>
                </button>
              )}
            </div>
          </div>

          {activeTab === 'classes' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Group List (Left Column) */}
              <div className="lg:col-span-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Danh sách lớp ({classrooms.length})</h3>
                {classrooms.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-slate-300 shadow-sm">
                    <Users className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">Chưa có lớp học nào</p>
                    <button
                      onClick={() => setIsClassModalOpen(true)}
                      className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      + Tạo lớp học đầu tiên
                    </button>
                  </div>
                ) : (
                  classrooms.map(c => {
                    const isSelected = selectedClass?.id === c.id;
                    return (
                      <div 
                        key={c.id} 
                        onClick={() => setSelectedClass(c)}
                        className={`bg-white rounded-2xl p-5 border cursor-pointer transition ${isSelected ? 'border-indigo-600 ring-2 ring-indigo-100 shadow-md' : 'border-slate-200/90 hover:border-slate-300 hover:shadow-sm'} group`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition">{c.name}</h3>
                            <span className="text-xs text-slate-500 mt-0.5 block">{c.description || 'Chưa có ghi chú lịch học'}</span>
                          </div>
                          <button
                            onClick={(e) => handleDeleteClassroom(c.id, e)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition"
                            title="Xóa lớp học này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 mt-3">
                          <span className="inline-flex items-center space-x-1 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                            <Users className="w-3.5 h-3.5" />
                            <span className="tabular-nums">{c.students?.length || 0} học sinh</span>
                          </span>
                          <span className="font-mono bg-indigo-50 border border-indigo-200/60 text-indigo-700 px-2.5 py-0.5 rounded-md font-bold">
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
                  <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-sm">
                    {/* Class Information Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-100 mb-6">
                      <div>
                        <div className="flex items-center space-x-3">
                          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">{selectedClass.name}</h2>
                          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full font-bold tabular-nums">
                            {studentsInClass.length} học sinh
                          </span>
                        </div>
                        {selectedClass.description && (
                          <p className="text-sm text-slate-500 mt-1">{selectedClass.description}</p>
                        )}
                      </div>

                      {/* Prominent Invite Code with Copy */}
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center space-x-3">
                        <div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mã tham gia lớp</div>
                          <div className="text-base font-mono font-extrabold text-indigo-700 tracking-wider">
                            {selectedClass.code}
                          </div>
                        </div>
                        <button
                          onClick={() => handleCopyCode(selectedClass.code)}
                          className="p-2 bg-white text-indigo-600 rounded-lg shadow-sm hover:bg-indigo-50 transition border border-slate-200"
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
                      <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                        <Users className="w-4 h-4 text-indigo-600" />
                        <span>Danh sách học sinh trong lớp ({studentsInClass.length})</span>
                      </h3>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setIsStudentModalOpen(true);
                            setStudentModalMode('new');
                            setModalSearchQuery('');
                          }}
                          className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition shadow-sm"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>+ Thêm học sinh</span>
                        </button>
                      </div>
                    </div>

                    {/* Assigned Exams Section */}
                    <div className="mt-6 pt-6 border-t border-slate-100">
                      <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center space-x-2">
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                        <span>Đề thi đã giao cho lớp</span>
                      </h3>
                      {(!selectedClass.assignments || selectedClass.assignments.filter(a => a.is_active !== false).length === 0) ? (
                        <p className="text-sm text-slate-400">Chưa có đề thi nào được giao cho lớp này.</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedClass.assignments.filter(a => a.is_active !== false).map(a => (
                            <div key={a.id} className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between">
                              <span className="font-semibold text-slate-800 text-sm">{a.exam?.title}</span>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => {
                                    setAssignmentToEdit({ ...a, classroom_id: selectedClass.id, classroom_name: selectedClass.name });
                                    setIsEditAssignmentModalOpen(true);
                                  }}
                                  className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-semibold transition flex items-center space-x-1"
                                  title="Chỉnh sửa hạn nộp, thời gian..."
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Cài đặt</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setExamToUnassign({ id: a.exam_id, title: a.exam?.title });
                                    setSelectedStudentIdsForUnassign([]);
                                    setIsUnassignExamModalOpen(true);
                                  }}
                                  className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg font-semibold transition"
                                >
                                  Hủy chọn HS
                                </button>
                                <button
                                  onClick={() => handleUnassignExam(a.exam_id, a.exam?.title)}
                                  className="text-xs px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg font-semibold transition"
                                >
                                  Hủy cả lớp
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Student List */}
                    <div className="space-y-2.5 mt-6">
                      <h3 className="font-bold text-slate-900 text-base mb-2">Chi tiết học sinh trong lớp</h3>
                      {studentsInClass.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm font-medium text-slate-600">Chưa có học sinh nào trong lớp này</p>
                          <p className="text-xs text-slate-400 mt-1">Gửi mã <b>{selectedClass.code}</b> cho học sinh hoặc bấm "+ Thêm học sinh" để tạo nhanh</p>
                        </div>
                      ) : (
                        studentsInClass.map((s) => (
                          <div
                            key={s.id}
                            className="p-3.5 bg-slate-50 hover:bg-white hover:shadow-sm border border-slate-200/80 rounded-xl flex items-center justify-between transition"
                          >
                            <div className="flex items-center space-x-3.5 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-sm shadow-xs shrink-0">
                                {(s.full_name || s.email || '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-sm text-slate-800 truncate">{s.full_name || 'Chưa đặt tên'}</h4>
                                <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs">
                                  <span className="text-slate-400 font-mono text-[11px]">{s.email}</span>
                                  {s.phone_number && (
                                    <span className="text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded flex items-center space-x-1">
                                      <Phone className="w-2.5 h-2.5 text-slate-400" />
                                      <span>{s.phone_number}</span>
                                    </span>
                                  )}
                                  {s.parent_phone && (
                                    <span className="text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center space-x-1" title={`PH: ${s.parent_name || 'Phụ huynh'}`}>
                                      <HeartHandshake className="w-2.5 h-2.5" />
                                      <span>PH: {s.parent_phone}</span>
                                    </span>
                                  )}
                                  {s.grade_level && (
                                    <span className="text-[11px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-semibold">
                                      Khối {s.grade_level}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-1.5 shrink-0">
                              <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold px-2.5 py-0.5 rounded-full hidden sm:inline-block">
                                Hoạt động
                              </span>
                              <button
                                onClick={() => handleOpenEditStudent(s)}
                                className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition"
                                title="Chỉnh sửa thông tin học sinh"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRemoveStudentFromClass(s.id, s.full_name || s.email)}
                                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition"
                                title="Xóa học sinh khỏi lớp"
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
                  <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200 shadow-sm">
                    Chọn một lớp học bên trái để xem chi tiết
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* All Students Tab */
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Danh sách toàn bộ học sinh</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Tổng số học sinh có tài khoản học tập trên hệ thống</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-4 rounded-l-xl">Học sinh</th>
                      <th className="p-4">Liên hệ &amp; Phụ huynh</th>
                      <th className="p-4">Trường &amp; Khối</th>
                      <th className="p-4">Trạng thái</th>
                      <th className="p-4 rounded-r-xl text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {allStudents.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
                              {(s.full_name || s.email || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800">{s.full_name || 'Chưa cập nhật'}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{s.email}</div>
                              {s.student_code && <div className="text-[10px] text-indigo-600 font-mono mt-0.5">MS: {s.student_code}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-xs">
                          {s.phone_number ? (
                            <div className="text-slate-800 font-medium flex items-center space-x-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{s.phone_number}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Chưa có SĐT</span>
                          )}
                          {s.parent_phone && (
                            <div className="text-emerald-700 mt-0.5 flex items-center space-x-1" title={s.parent_name ? `PH: ${s.parent_name}` : ''}>
                              <HeartHandshake className="w-3 h-3 text-emerald-600" />
                              <span>PH: {s.parent_phone} {s.parent_name && `(${s.parent_name})`}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-xs">
                          {s.school && <div className="text-slate-800 font-medium">{s.school}</div>}
                          {s.grade_level ? (
                            <span className="inline-block mt-0.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-bold text-[10px]">
                              Khối {s.grade_level}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Chưa chọn khối</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-xs font-bold">
                            Hoạt động
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => handleOpenEditStudent(s)}
                              className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition"
                              title="Chỉnh sửa thông tin học sinh"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSystemStudent(s.id, s.full_name || s.email)}
                              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition"
                              title="Xóa học sinh khỏi hệ thống"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Modal: Add System Student */}
          <Modal
            isOpen={isSystemStudentModalOpen}
            onClose={() => setIsSystemStudentModalOpen(false)}
            title="Thêm Học Sinh Mới Vào Hệ Thống"
          >
            <form onSubmit={handleCreateSystemStudent} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Họ và tên học sinh *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Nguyễn Văn An"
                    value={systemStudentForm.full_name}
                    onChange={e => setSystemStudentForm({ ...systemStudentForm, full_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email đăng nhập *</label>
                  <input
                    type="email"
                    required
                    placeholder="hocsinh@gmail.com"
                    value={systemStudentForm.email}
                    onChange={e => setSystemStudentForm({ ...systemStudentForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mật khẩu khởi tạo</label>
                  <input
                    type="text"
                    value={systemStudentForm.password}
                    onChange={e => setSystemStudentForm({ ...systemStudentForm, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Số điện thoại học sinh</label>
                  <input
                    type="tel"
                    placeholder="0912 345 678"
                    value={systemStudentForm.phone_number}
                    onChange={e => setSystemStudentForm({ ...systemStudentForm, phone_number: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Khối lớp</label>
                  <select
                    value={systemStudentForm.grade_level}
                    onChange={e => setSystemStudentForm({ ...systemStudentForm, grade_level: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">Chọn khối lớp</option>
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>Khối {i + 1}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Giới tính</label>
                  <select
                    value={systemStudentForm.gender}
                    onChange={e => setSystemStudentForm({ ...systemStudentForm, gender: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Trường học</label>
                  <input
                    type="text"
                    placeholder="THPT Chuyên..."
                    value={systemStudentForm.school}
                    onChange={e => setSystemStudentForm({ ...systemStudentForm, school: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mã học sinh</label>
                  <input
                    type="text"
                    placeholder="HS-01"
                    value={systemStudentForm.student_code}
                    onChange={e => setSystemStudentForm({ ...systemStudentForm, student_code: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Họ tên phụ huynh</label>
                  <input
                    type="text"
                    placeholder="Nguyễn Văn B (Bố)"
                    value={systemStudentForm.parent_name}
                    onChange={e => setSystemStudentForm({ ...systemStudentForm, parent_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">SĐT phụ huynh</label>
                  <input
                    type="tel"
                    placeholder="0987 654 321"
                    value={systemStudentForm.parent_phone}
                    onChange={e => setSystemStudentForm({ ...systemStudentForm, parent_phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ghi chú học lực / Mục tiêu</label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú về học sinh, mục tiêu điểm số..."
                  value={systemStudentForm.notes}
                  onChange={e => setSystemStudentForm({ ...systemStudentForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 resize-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSystemStudentModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Đang xử lý...' : 'Thêm học sinh'}
                </button>
              </div>
            </form>
          </Modal>

          {/* Modal: Create Tutoring Group */}
          <Modal isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)} title="Tạo Lớp Học Mới">
            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Tên lớp học</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Toán 12 - Luyện thi ĐH, Nhóm kèm 1-1 Nam..."
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Mô tả / Lịch học (tùy chọn)</label>
                <textarea
                  placeholder="Ví dụ: Tối thứ 3 & thứ 6 (19:30 - 21:00) tại phòng học online"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 text-sm resize-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsClassModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-sm"
                >
                  Tạo lớp học
                </button>
              </div>
            </form>
          </Modal>

          {/* Modal: Add Students (Quick Add or Existing) */}
          <Modal 
            isOpen={isStudentModalOpen} 
            onClose={() => setIsStudentModalOpen(false)} 
            title={`Thêm Học Sinh Vào Lớp "${selectedClass?.name}"`}
          >
            <div className="space-y-4">
              {/* Modal Tabs */}
              <div className="flex border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setStudentModalMode('new')}
                  className={`pb-2 px-3 text-xs font-bold border-b-2 transition ${studentModalMode === 'new' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  + Tạo nhanh học sinh mới
                </button>
                <button
                  type="button"
                  onClick={() => setStudentModalMode('existing')}
                  className={`pb-2 px-3 text-xs font-bold border-b-2 transition ${studentModalMode === 'existing' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  Chọn từ danh sách có sẵn
                </button>
              </div>

              {studentModalMode === 'new' ? (
                /* Quick Add Form */
                <form onSubmit={handleQuickCreateStudent} className="space-y-4 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Họ và tên học sinh *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ví dụ: Nguyễn Văn An"
                        value={newStudentForm.full_name}
                        onChange={e => setNewStudentForm({ ...newStudentForm, full_name: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email đăng nhập *</label>
                      <input
                        type="email"
                        required
                        placeholder="hocsinh@gmail.com"
                        value={newStudentForm.email}
                        onChange={e => setNewStudentForm({ ...newStudentForm, email: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mật khẩu khởi tạo</label>
                      <input
                        type="text"
                        value={newStudentForm.password}
                        onChange={e => setNewStudentForm({ ...newStudentForm, password: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Số điện thoại học sinh</label>
                      <input
                        type="tel"
                        placeholder="0912 345 678"
                        value={newStudentForm.phone_number}
                        onChange={e => setNewStudentForm({ ...newStudentForm, phone_number: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Khối lớp</label>
                      <select
                        value={newStudentForm.grade_level}
                        onChange={e => setNewStudentForm({ ...newStudentForm, grade_level: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="">Chọn khối lớp</option>
                        {[...Array(12)].map((_, i) => (
                          <option key={i + 1} value={i + 1}>Khối {i + 1}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Giới tính</label>
                      <select
                        value={newStudentForm.gender}
                        onChange={e => setNewStudentForm({ ...newStudentForm, gender: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Trường học</label>
                      <input
                        type="text"
                        placeholder="THPT Chuyên..."
                        value={newStudentForm.school}
                        onChange={e => setNewStudentForm({ ...newStudentForm, school: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mã học sinh</label>
                      <input
                        type="text"
                        placeholder="HS-01"
                        value={newStudentForm.student_code}
                        onChange={e => setNewStudentForm({ ...newStudentForm, student_code: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Họ tên phụ huynh</label>
                      <input
                        type="text"
                        placeholder="Nguyễn Văn B (Bố)"
                        value={newStudentForm.parent_name}
                        onChange={e => setNewStudentForm({ ...newStudentForm, parent_name: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">SĐT phụ huynh</label>
                      <input
                        type="tel"
                        placeholder="0987 654 321"
                        value={newStudentForm.parent_phone}
                        onChange={e => setNewStudentForm({ ...newStudentForm, parent_phone: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ghi chú học lực / Mục tiêu</label>
                    <textarea
                      rows={2}
                      placeholder="Ghi chú về học sinh, mục tiêu điểm số..."
                      value={newStudentForm.notes}
                      onChange={e => setNewStudentForm({ ...newStudentForm, notes: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 resize-none"
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsStudentModalOpen(false)}
                      className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-sm disabled:opacity-50"
                    >
                      {actionLoading ? 'Đang xử lý...' : 'Tạo & Thêm vào lớp'}
                    </button>
                  </div>
                </form>
              ) : (
                /* Select Existing Students */
                <div className="space-y-4 pt-1">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Tìm theo tên hoặc email..."
                      value={modalSearchQuery}
                      onChange={e => setModalSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2 pr-2">
                    {filteredStudentsForModal.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs">Không tìm thấy học sinh phù hợp.</div>
                    ) : (
                      filteredStudentsForModal.map(s => {
                        const isChecked = selectedStudentIds.includes(s.id);
                        const alreadyInClass = studentsInClass.some(sc => sc.id === s.id);
                        return (
                          <div 
                            key={s.id}
                            onClick={() => !alreadyInClass && handleToggleStudent(s.id)}
                            className={`p-3 rounded-xl border flex items-center justify-between transition ${alreadyInClass ? 'bg-slate-100 opacity-60 cursor-not-allowed' : `cursor-pointer hover:border-indigo-500 ${isChecked ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-slate-200'}`}`}
                          >
                            <div className="flex items-center space-x-3">
                              {!alreadyInClass && (
                                isChecked ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4 text-slate-400" />
                              )}
                              <div>
                                <div className="font-bold text-xs sm:text-sm text-slate-800">{s.full_name || 'Chưa cập nhật'}</div>
                                <div className="text-[11px] text-slate-500 font-mono">{s.email}</div>
                              </div>
                            </div>
                            {alreadyInClass && <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">Đã có trong lớp</span>}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="flex justify-end space-x-3 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setIsStudentModalOpen(false)} 
                      className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading || selectedStudentIds.length === 0}
                      onClick={handleAddSelectedStudents}
                      className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {actionLoading ? 'Đang xử lý...' : `Thêm học sinh đã chọn (${selectedStudentIds.length})`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Modal>

          {/* Modal: Unassign Exam for Selected Students */}
          <Modal
            isOpen={isUnassignExamModalOpen}
            onClose={() => {
              setIsUnassignExamModalOpen(false);
              setExamToUnassign(null);
              setSelectedStudentIdsForUnassign([]);
            }}
            title={`Hủy Giao Đề "${examToUnassign?.title}" Cho Học Sinh`}
          >
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Chọn các học sinh bạn muốn hủy giao đề thi này trong lớp. Lưu ý: Lịch sử nộp bài của các học sinh này cho đề thi sẽ bị xóa.
              </p>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {studentsInClass.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">Lớp chưa có học sinh nào.</div>
                ) : (
                  studentsInClass.map(s => {
                    const isChecked = selectedStudentIdsForUnassign.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelectedStudentIdsForUnassign(prev =>
                            prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                          );
                        }}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                          isChecked ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                          <div>
                            <div className="font-bold text-xs sm:text-sm text-slate-800">{s.full_name || 'Chưa cập nhật'}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{s.email}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedStudentIdsForUnassign.length === studentsInClass.length) {
                      setSelectedStudentIdsForUnassign([]);
                    } else {
                      setSelectedStudentIdsForUnassign(studentsInClass.map(s => s.id));
                    }
                  }}
                  className="text-xs text-indigo-600 font-semibold hover:underline"
                >
                  {selectedStudentIdsForUnassign.length === studentsInClass.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnassignExamModalOpen(false);
                      setExamToUnassign(null);
                      setSelectedStudentIdsForUnassign([]);
                    }}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    disabled={selectedStudentIdsForUnassign.length === 0}
                    onClick={async () => {
                      if (!examToUnassign) return;
                      await handleUnassignExam(examToUnassign.id, examToUnassign.title, selectedStudentIdsForUnassign);
                      setIsUnassignExamModalOpen(false);
                      setExamToUnassign(null);
                      setSelectedStudentIdsForUnassign([]);
                    }}
                    className="px-5 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-rose-700 disabled:opacity-50"
                  >
                    Hủy giao ({selectedStudentIdsForUnassign.length})
                  </button>
                </div>
              </div>
            </div>
          </Modal>

          {/* Modal: Edit Student Information */}
          <Modal
            isOpen={isEditStudentModalOpen}
            onClose={() => {
              setIsEditStudentModalOpen(false);
              setEditingStudent(null);
            }}
            title={`Chỉnh Sửa Thông Tin Học Sinh "${editingStudent?.full_name || editingStudent?.email}"`}
          >
            <form onSubmit={handleSaveEditStudent} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Họ và tên học sinh *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Nguyễn Văn An"
                    value={editStudentForm.full_name}
                    onChange={e => setEditStudentForm({ ...editStudentForm, full_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email đăng nhập</label>
                  <input
                    type="email"
                    disabled
                    value={editingStudent?.email || ''}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-sm font-mono cursor-not-allowed select-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Đổi mật khẩu mới (Tùy chọn)</label>
                  <input
                    type="text"
                    placeholder="Để trống nếu không đổi"
                    value={editStudentForm.password}
                    onChange={e => setEditStudentForm({ ...editStudentForm, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Số điện thoại học sinh</label>
                  <input
                    type="tel"
                    placeholder="0912 345 678"
                    value={editStudentForm.phone_number}
                    onChange={e => setEditStudentForm({ ...editStudentForm, phone_number: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Khối lớp</label>
                  <select
                    value={editStudentForm.grade_level}
                    onChange={e => setEditStudentForm({ ...editStudentForm, grade_level: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">Chọn khối lớp</option>
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>Khối {i + 1}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Giới tính</label>
                  <select
                    value={editStudentForm.gender}
                    onChange={e => setEditStudentForm({ ...editStudentForm, gender: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Trường học</label>
                  <input
                    type="text"
                    placeholder="THPT Chuyên..."
                    value={editStudentForm.school}
                    onChange={e => setEditStudentForm({ ...editStudentForm, school: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Mã học sinh</label>
                  <input
                    type="text"
                    placeholder="HS-01"
                    value={editStudentForm.student_code}
                    onChange={e => setEditStudentForm({ ...editStudentForm, student_code: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Họ tên phụ huynh</label>
                  <input
                    type="text"
                    placeholder="Nguyễn Văn B (Bố)"
                    value={editStudentForm.parent_name}
                    onChange={e => setEditStudentForm({ ...editStudentForm, parent_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">SĐT phụ huynh</label>
                  <input
                    type="tel"
                    placeholder="0987 654 321"
                    value={editStudentForm.parent_phone}
                    onChange={e => setEditStudentForm({ ...editStudentForm, parent_phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Ghi chú học lực / Mục tiêu</label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú về học sinh, mục tiêu điểm số..."
                  value={editStudentForm.notes}
                  onChange={e => setEditStudentForm({ ...editStudentForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 resize-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditStudentModalOpen(false);
                    setEditingStudent(null);
                  }}
                  className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Đang lưu...' : 'Lưu thông tin học sinh'}
                </button>
              </div>
            </form>
          </Modal>

          <EditAssignmentModal
            assignment={assignmentToEdit}
            isOpen={isEditAssignmentModalOpen}
            onClose={() => setIsEditAssignmentModalOpen(false)}
            onSaved={async () => {
              const updatedClassrooms = await refreshClassrooms();
              const updated = updatedClassrooms.find(c => c.id === selectedClass?.id);
              if (updated) setSelectedClass(updated);
            }}
          />
        </main>
      </div>
    </div>
  );
}

