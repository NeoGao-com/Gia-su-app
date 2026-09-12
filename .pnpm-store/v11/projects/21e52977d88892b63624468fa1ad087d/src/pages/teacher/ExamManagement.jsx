import React, { useEffect, useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api from '../../api/axios';
import { Plus, Clock, Trash2, FileText, Edit3, Grid, Sparkles, RefreshCw, Layers } from 'lucide-react';
import { Modal } from '../../components/Modal';

const DIFFICULTIES = [
  { value: 'NHAN_BIET', label: 'Nhận biết', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'THONG_HIEU', label: 'Thông hiểu', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'VAN_DUNG', label: 'Vận dụng', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'VAN_DUNG_CAO', label: 'Vận dụng cao', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
];

export function ExamManagement() {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'matrices'

  // --- Tab 1: Tạo đề thi ---
  const [exams, setExams] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    duration_minutes: 45,
    pass_score: 5.0,
    max_attempts: 1,
    shuffle_questions: true,
    shuffle_options: true,
    show_answers_after_submit: true,
    is_published: false,
    question_ids: []
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionFilter, setQuestionFilter] = useState({ subject: '', grade: '', type: '', difficulty: '' });

  // --- Tab 2: Ma trận đề thi ---
  const [matrices, setMatrices] = useState([]);
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const [editingMatrix, setEditingMatrix] = useState(null);
  const [matrixForm, setMatrixForm] = useState({
    name: '',
    description: '',
    subject: 'Toán',
    grade_level: 10,
    matrix_config: { chapters: [] }
  });
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [autoTotalQuestions, setAutoTotalQuestions] = useState(20);

  // Modal Sinh đề
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    matrix_id: null,
    title: '',
    duration_minutes: 45,
    pass_score: 5.0,
    max_attempts: 1,
    show_answers_after_submit: false,
    is_published: false
  });
  const [generateLoading, setGenerateLoading] = useState(false);

  // ---- Fetch Data ----
  const fetchData = async () => {
    try {
      const [eRes, qRes] = await Promise.all([
        api.get('/exams?limit=100').catch(() => ({ data: [] })),
        api.get('/questions?limit=500').catch(() => ({ data: [] })),
      ]);
      setExams(Array.isArray(eRes.data?.items) ? eRes.data.items : (Array.isArray(eRes.data) ? eRes.data : []));
      setQuestions(Array.isArray(qRes.data?.items) ? qRes.data.items : (Array.isArray(qRes.data) ? qRes.data : []));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMatrices = async () => {
    try {
      const res = await api.get('/exams/matrices?limit=50');
      setMatrices(Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'matrices') fetchMatrices();
  }, [activeTab]);

  // ---- Handlers Tab 1 ----
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (createForm.question_ids.length === 0) return alert('Vui lòng chọn ít nhất 1 câu hỏi');
    setCreateLoading(true);
    try {
      await api.post('/exams', createForm);
      setIsCreateModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể tạo bài thi');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteExam = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa bài thi này?')) return;
    try {
      await api.delete(`/exams/${id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Xóa thất bại');
    }
  };

  const handleViewSubmissions = async (exam) => {
    setSelectedExam(exam);
    try {
      const res = await api.get(`/exams/${exam.id}/submissions`);
      setSubmissions(Array.isArray(res.data) ? res.data : (res.data?.items || []));
      setIsSubmissionsModalOpen(true);
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể tải bài nộp');
    }
  };

  const filteredQuestions = questions.filter(q => {
    if (questionSearch && !(q.content || '').toLowerCase().includes(questionSearch.toLowerCase())) return false;
    if (questionFilter.subject && q.subject !== questionFilter.subject) return false;
    if (questionFilter.grade && q.grade_level !== questionFilter.grade) return false;
    if (questionFilter.type && q.question_type !== questionFilter.type) return false;
    if (questionFilter.difficulty && q.difficulty !== questionFilter.difficulty) return false;
    return true;
  });

  const toggleQuestion = (qid) => {
    setCreateForm(prev => ({
      ...prev,
      question_ids: prev.question_ids.includes(qid)
        ? prev.question_ids.filter(id => id !== qid)
        : [...prev.question_ids, qid]
    }));
  };

  // ---- Handlers Tab 2 (Ma trận) ----
  const resetMatrixForm = (matrix = null) => {
    if (matrix) {
      setMatrixForm({
        name: matrix.name,
        description: matrix.description || '',
        subject: matrix.subject,
        grade_level: matrix.grade_level,
        matrix_config: matrix.matrix_config || { chapters: [] }
      });
      setEditingMatrix(matrix);
    } else {
      setMatrixForm({
        name: '',
        description: '',
        subject: 'Toán',
        grade_level: 10,
        matrix_config: { chapters: [] }
      });
      setEditingMatrix(null);
    }
    setIsMatrixModalOpen(true);
  };

  // Lấy các chương có sẵn trong Ngân hàng câu hỏi cho Môn + Khối đã chọn
  const getAvailableChapters = (subj, grade) => {
    const list = questions.filter(q => q.subject === subj && q.grade_level === Number(grade));
    const chaps = [...new Set(list.map(q => q.chapter || 'Mặc định'))];
    return chaps.length > 0 ? chaps : ['Chương I', 'Chương II', 'Chương III'];
  };

  // Lấy danh sách câu khả dụng cho 1 ô (Chapter, Topic, Difficulty)
  const getAvailableCount = (subj, grade, chap, diff) => {
    return questions.filter(q =>
      q.subject === subj &&
      q.grade_level === Number(grade) &&
      (q.chapter || 'Mặc định') === chap &&
      q.difficulty === diff
    ).length;
  };

  // Lấy giá trị đã nhập trong matrix_config
  const getCellValue = (chapName, diff) => {
    const chapters = matrixForm.matrix_config?.chapters || [];
    const ch = chapters.find(c => c.chapter === chapName);
    if (!ch) return 0;
    const top = ch.topics?.[0]?.topics?.[0]; // topic chung
    return top?.difficulties?.[diff] || 0;
  };

  // Cập nhật 1 ô trong matrix_config
  const updateCellValue = (chapName, diff, val) => {
    const count = Math.max(0, parseInt(val) || 0);
    setMatrixForm(prev => {
      const config = JSON.parse(JSON.stringify(prev.matrix_config || { chapters: [] }));
      let chapters = config.chapters || [];
      let ch = chapters.find(c => c.chapter === chapName);
      if (!ch) {
        ch = { chapter: chapName, topics: [{ lesson: 'Bài 1', topics: [{ topic: 'Chung', difficulties: {} }] }] };
        chapters.push(ch);
      }
      if (!ch.topics || ch.topics.length === 0) {
        ch.topics = [{ lesson: 'Bài 1', topics: [{ topic: 'Chung', difficulties: {} }] }];
      }
      const les = ch.topics[0];
      if (!les.topics || les.topics.length === 0) {
        les.topics = [{ topic: 'Chung', difficulties: {} }];
      }
      const top = les.topics[0];
      if (!top.difficulties) top.difficulties = {};

      if (count > 0) {
        top.difficulties[diff] = count;
      } else {
        delete top.difficulties[diff];
      }

      // Xóa các chapter rỗng
      config.chapters = chapters.filter(c => {
        const t = c.topics?.[0]?.topics?.[0];
        return t && Object.keys(t.difficulties || {}).length > 0;
      });

      return { ...prev, matrix_config: config };
    });
  };

  // Tự động phân bổ đều số câu hỏi cho các chương
  const handleAutoDistribute = () => {
    const availableChaps = getAvailableChapters(matrixForm.subject, matrixForm.grade_level);
    if (availableChaps.length === 0) return alert('Không có chương nào');
    const perChap = Math.floor(autoTotalQuestions / availableChaps.length);
    const remainder = autoTotalQuestions % availableChaps.length;

    const newChapters = availableChaps.map((chap, idx) => {
      const total = perChap + (idx < remainder ? 1 : 0);
      // Tỉ lệ mặc định: 40% Nhận biết, 30% Thông hiểu, 20% Vận dụng, 10% Vận dụng cao
      const nb = Math.round(total * 0.4);
      const th = Math.round(total * 0.3);
      const vd = Math.round(total * 0.2);
      const vdc = Math.max(0, total - nb - th - vd);
      return {
        chapter: chap,
        topics: [{
          lesson: 'Bài 1',
          topics: [{
            topic: 'Chung',
            difficulties: {
              ...(nb > 0 && { NHAN_BIET: nb }),
              ...(th > 0 && { THONG_HIEU: th }),
              ...(vd > 0 && { VAN_DUNG: vd }),
              ...(vdc > 0 && { VAN_DUNG_CAO: vdc })
            }
          }]
        }]
      };
    });

    setMatrixForm(prev => ({ ...prev, matrix_config: { chapters: newChapters } }));
  };

  // Tính tổng số câu hỏi real-time
  const calculateTotal = () => {
    let sum = 0;
    (matrixForm.matrix_config?.chapters || []).forEach(ch => {
      (ch.topics || []).forEach(les => {
        (les.topics || []).forEach(top => {
          Object.values(top.difficulties || {}).forEach(c => sum += Number(c || 0));
        });
      });
    });
    return sum;
  };

  const handleMatrixSubmit = async (e) => {
    e.preventDefault();
    if (!matrixForm.name.trim()) return alert('Nhập tên ma trận');
    if (calculateTotal() === 0) return alert('Ma trận phải có ít nhất 1 câu hỏi');
    setMatrixLoading(true);
    try {
      if (editingMatrix) {
        await api.put(`/exams/matrices/${editingMatrix.id}`, matrixForm);
      } else {
        await api.post('/exams/matrices', matrixForm);
      }
      setIsMatrixModalOpen(false);
      fetchMatrices();
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể lưu ma trận');
    } finally {
      setMatrixLoading(false);
    }
  };

  const handleDeleteMatrix = async (id) => {
    if (!confirm('Xóa ma trận này?')) return;
    try {
      await api.delete(`/exams/matrices/${id}`);
      fetchMatrices();
    } catch (err) {
      alert(err.response?.data?.detail || 'Xóa thất bại');
    }
  };

  const openGenerateModal = (matrix) => {
    setGenerateForm({
      matrix_id: matrix.id,
      title: `Đề thi từ ${matrix.name}`,
      duration_minutes: 45,
      pass_score: 5.0,
      max_attempts: 1,
      show_answers_after_submit: false,
      is_published: false
    });
    setIsGenerateModalOpen(true);
  };

  const handleGenerateSubmit = async (e) => {
    e.preventDefault();
    setGenerateLoading(true);
    try {
      const res = await api.post('/exams/matrices/generate', generateForm);
      alert(`Sinh đề thi thành công! Bài thi: "${res.data.title}"`);
      setIsGenerateModalOpen(false);
      setActiveTab('create');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Không thể sinh đề thi');
    } finally {
      setGenerateLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-pastel-bg font-sans">
      <Navbar />
      <div className="flex">
        <Sidebar role="teacher" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl">
          {/* Header */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold text-gray-800">
                {activeTab === 'create' ? 'Quản lý đề thi' : 'Ma trận đề thi'}
              </h1>
              {activeTab === 'create' && (
                <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center space-x-2 px-4 py-2.5 bg-pastel-purple text-white rounded-xl font-bold hover:bg-pastel-purpleDark transition shadow-xs text-sm">
                  <Plus className="w-4 h-4" />
                  <span>Tạo đề thủ công</span>
                </button>
              )}
              {activeTab === 'matrices' && (
                <button onClick={() => resetMatrixForm()} className="flex items-center space-x-2 px-4 py-2.5 bg-pastel-purple text-white rounded-xl font-bold hover:bg-pastel-purpleDark transition shadow-xs text-sm">
                  <Plus className="w-4 h-4" />
                  <span>Tạo ma trận mới</span>
                </button>
              )}
            </div>

            {/* Tab bar */}
            <div className="flex space-x-1 bg-white rounded-2xl p-1 border border-gray-100 w-fit shadow-xs">
              <button
                onClick={() => setActiveTab('create')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${activeTab === 'create' ? 'bg-pastel-purple text-white shadow-xs' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Danh sách đề thi</span>
              </button>
              <button
                onClick={() => setActiveTab('matrices')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${activeTab === 'matrices' ? 'bg-pastel-purple text-white shadow-xs' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Ma trận đề thi</span>
              </button>
            </div>
          </div>

          {/* ===== TAB 1: DANH SÁCH ĐỀ THI ===== */}
          {activeTab === 'create' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs">
                <h3 className="text-base font-bold text-gray-800 mb-4">Danh sách đề thi ({exams.length})</h3>
                {exams.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">Chưa có đề thi nào. Hãy tạo mới hoặc sinh đề từ Ma trận.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {exams.map(exam => (
                      <div key={exam.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs flex flex-col justify-between hover:shadow-md transition">
                        <div>
                          <div className="flex justify-between items-start mb-3">
                            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${exam.is_published ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                              {exam.is_published ? 'Đã xuất bản' : 'Bản nháp'}
                            </span>
                            <div className="flex items-center space-x-1 text-xs text-gray-400 font-medium">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{exam.duration_minutes} phút</span>
                            </div>
                          </div>
                          <h4 className="text-sm font-bold text-gray-800 mb-1.5">{exam.title}</h4>
                          <p className="text-xs text-gray-500 mb-3 line-clamp-2">{exam.description || 'Không có mô tả'}</p>
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg font-bold border border-blue-100">{(exam.question_count ?? exam.questions?.length ?? exam.question_ids?.length ?? 0)} câu hỏi</span>
                            {exam.created_at && <span className="text-[11px] px-2 py-0.5 bg-gray-50 text-gray-500 rounded-lg font-medium border">Tạo: {new Date(exam.created_at).toLocaleString('vi-VN')}</span>}
                          </div>
                        </div>
                        <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                          <button
                            onClick={() => handleViewSubmissions(exam)}
                            className="flex items-center space-x-1 text-xs font-bold text-pastel-purpleDark hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Bài nộp ({exam.submissions_count || 0})</span>
                          </button>
                          <button
                            onClick={() => handleDeleteExam(exam.id)}
                            className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== TAB 2: MA TRẬN ĐỀ THI ===== */}
          {activeTab === 'matrices' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xs">
                <h3 className="text-base font-bold text-gray-800 mb-4">Danh sách Ma trận ({matrices.length})</h3>
                {matrices.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">Chưa có ma trận nào. Bấm "Tạo ma trận mới" để thiết lập.</div>
                ) : (
                  <div className="space-y-3">
                    {matrices.map(m => (
                      <div key={m.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-purple-200 transition">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-bold text-gray-800 text-sm">{m.name}</h4>
                            <span className="text-[11px] px-2 py-0.5 bg-purple-50 text-pastel-purpleDark rounded-lg font-bold border border-purple-100">
                              {m.subject} - Khối {m.grade_level}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg font-bold border border-emerald-100">
                              Tổng {m.total_questions} câu
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">{m.description || 'Không có mô tả'}</p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {m.created_at && <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg font-bold border border-blue-100">Tạo: {new Date(m.created_at).toLocaleString('vi-VN')}</span>}
                            <span className="text-[11px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded-lg font-bold border border-amber-100">{m.total_questions ?? countMatrixQuestions(m) ?? 0} câu hỏi</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button onClick={() => openGenerateModal(m)} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition flex items-center space-x-1.5 shadow-xs">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Sinh đề thi</span>
                          </button>
                          <button onClick={() => resetMatrixForm(m)} className="p-2 text-gray-600 hover:text-pastel-purple hover:bg-purple-50 rounded-xl transition">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteMatrix(m.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== MODAL TẠO/SỬA MA TRẬN ===== */}
          <Modal isOpen={isMatrixModalOpen} onClose={() => setIsMatrixModalOpen(false)} title={editingMatrix ? "Chỉnh sửa Ma trận đề thi" : "Tạo Ma trận đề thi mới"} size="lg">
            <form onSubmit={handleMatrixSubmit} className="space-y-5 p-2 max-h-[82vh] overflow-y-auto pr-2">
              {/* Bước 1: Thông tin môn & khối */}
              <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100 space-y-3">
                <h4 className="text-xs font-bold text-pastel-purpleDark uppercase tracking-wider flex items-center space-x-1.5">
                  <Grid className="w-4 h-4" />
                  <span>1. Thông tin ma trận</span>
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-3">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Tên ma trận đề thi</label>
                    <input required value={matrixForm.name} onChange={e => setMatrixForm({ ...matrixForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-pastel-purple" placeholder="VD: Ma trận đề thi Giữa kỳ 1 Toán 10" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Môn học</label>
                    <input required value={matrixForm.subject} onChange={e => setMatrixForm({ ...matrixForm, subject: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-pastel-purple" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Khối lớp</label>
                    <input type="number" min={1} max={12} required value={matrixForm.grade_level} onChange={e => setMatrixForm({ ...matrixForm, grade_level: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-pastel-purple" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Tổng câu dự kiến</label>
                    <div className="flex space-x-1">
                      <input type="number" min={1} value={autoTotalQuestions} onChange={e => setAutoTotalQuestions(Number(e.target.value))}
                        className="w-full px-2 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-center" />
                      <button type="button" onClick={handleAutoDistribute} title="Tự động chia đều cho các chương"
                        className="px-3 py-2 bg-purple-100 text-pastel-purpleDark rounded-xl text-xs font-bold hover:bg-purple-200 transition flex items-center space-x-1 whitespace-nowrap">
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Chia đều</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bước 2: Bảng cấu hình theo Chương & Độ khó */}
              <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-pastel-purpleDark uppercase tracking-wider flex items-center space-x-1.5">
                    <Layers className="w-4 h-4" />
                    <span>2. Cấu hình số lượng câu hỏi theo Chương</span>
                  </h4>
                  <span className="text-xs font-bold bg-purple-50 text-pastel-purpleDark px-3 py-1 rounded-xl border border-purple-100">
                    Đã chọn: <strong className="text-sm">{calculateTotal()}</strong> câu
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100">
                        <th className="p-2.5 rounded-l-xl w-1/3">Tên Chương / Chủ đề</th>
                        {DIFFICULTIES.map(d => (
                          <th key={d.value} className="p-2.5 text-center">{d.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {getAvailableChapters(matrixForm.subject, matrixForm.grade_level).map(chap => (
                        <tr key={chap} className="hover:bg-gray-50/50 transition">
                          <td className="p-2.5 font-bold text-gray-800">{chap}</td>
                          {DIFFICULTIES.map(d => {
                            const available = getAvailableCount(matrixForm.subject, matrixForm.grade_level, chap, d.value);
                            const currentVal = getCellValue(chap, d.value);
                            const isOver = currentVal > available;
                            return (
                              <td key={d.value} className="p-2 text-center">
                                <div className="flex flex-col items-center space-y-0.5">
                                  <input
                                    type="number"
                                    min={0}
                                    max={available}
                                    value={currentVal || ''}
                                    onChange={e => updateCellValue(chap, d.value, e.target.value)}
                                    className={`w-14 text-center py-1.5 border rounded-xl font-bold text-xs focus:outline-none focus:border-pastel-purple ${isOver ? 'border-red-400 bg-red-50 text-red-700' : currentVal > 0 ? 'border-purple-300 bg-purple-50/50 text-pastel-purpleDark' : 'border-gray-200'}`}
                                    placeholder="0"
                                  />
                                  <span className={`text-[10px] ${available === 0 ? 'text-gray-300' : 'text-gray-500 font-medium'}`}>
                                    Có sẵn: {available}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-[11px] text-gray-400">Gợi ý: Nhập số câu vào từng ô hoặc bấm "Chia đều" để phân bổ tự động.</span>
                <div className="flex space-x-3">
                  <button type="button" onClick={() => setIsMatrixModalOpen(false)} className="px-5 py-2.5 border border-gray-200 rounded-2xl text-xs font-bold hover:bg-gray-50 transition">Hủy</button>
                  <button type="submit" disabled={matrixLoading} className="px-6 py-2.5 bg-pastel-purple text-white rounded-2xl text-xs font-bold shadow-xs hover:bg-pastel-purpleDark transition disabled:opacity-50">
                    {matrixLoading ? 'Đang lưu...' : (editingMatrix ? 'Cập nhật ma trận' : 'Lưu ma trận')}
                  </button>
                </div>
              </div>
            </form>
          </Modal>

          {/* ===== MODAL SINH ĐỀ TỪ MA TRẬN ===== */}
          <Modal isOpen={isGenerateModalOpen} onClose={() => setIsGenerateModalOpen(false)} title="Sinh đề thi ngẫu nhiên từ Ma trận" size="md">
            <form onSubmit={handleGenerateSubmit} className="space-y-4 p-2">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-xs text-emerald-800 space-y-1">
                <p className="font-bold flex items-center space-x-1">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Tự động tạo đề thi ngẫu nhiên</span>
                </p>
                <p>Hệ thống sẽ bốc ngẫu nhiên câu hỏi trong Ngân hàng theo số lượng và phân bổ đã định nghĩa trong Ma trận.</p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Tiêu đề bài thi mới</label>
                <input required value={generateForm.title} onChange={e => setGenerateForm({ ...generateForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-pastel-purple" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Thời gian (phút)</label>
                  <input type="number" min={1} required value={generateForm.duration_minutes} onChange={e => setGenerateForm({ ...generateForm, duration_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Điểm đạt</label>
                  <input type="number" step="0.1" min={0} max={10} required value={generateForm.pass_score} onChange={e => setGenerateForm({ ...generateForm, pass_score: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Số lần thi</label>
                  <input type="number" min={1} required value={generateForm.max_attempts} onChange={e => setGenerateForm({ ...generateForm, max_attempts: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium" />
                </div>
              </div>

              <div className="flex items-center space-x-6 bg-gray-50 p-3 rounded-xl border">
                <label className="flex items-center space-x-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={generateForm.show_answers_after_submit} onChange={e => setGenerateForm({ ...generateForm, show_answers_after_submit: e.target.checked })} className="text-pastel-purple rounded" />
                  <span>Cho xem đáp án</span>
                </label>
                <label className="flex items-center space-x-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={generateForm.is_published} onChange={e => setGenerateForm({ ...generateForm, is_published: e.target.checked })} className="text-pastel-purple rounded" />
                  <span>Xuất bản ngay</span>
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setIsGenerateModalOpen(false)} className="px-5 py-2.5 border border-gray-200 rounded-2xl text-xs font-bold hover:bg-gray-50 transition">Hủy</button>
                <button type="submit" disabled={generateLoading} className="px-6 py-2.5 bg-emerald-500 text-white rounded-2xl text-xs font-bold hover:bg-emerald-600 transition disabled:opacity-50 shadow-xs">
                  {generateLoading ? 'Đang sinh...' : 'Sinh đề ngay'}
                </button>
              </div>
            </form>
          </Modal>

          {/* ===== MODAL THỦ CÔNG TẠO ĐỀ THI ===== */}
          <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Tạo bài thi thủ công trực quan" size="xl">
            <form onSubmit={handleCreateSubmit} className="space-y-5 p-3 max-h-[85vh] overflow-y-auto pr-2">
              <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-100 space-y-3">
                <h4 className="text-xs font-bold text-pastel-purpleDark uppercase tracking-wider flex items-center space-x-1.5">
                  <FileText className="w-4 h-4" />
                  <span>1. Thông tin chung đề thi</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Tiêu đề bài thi</label>
                    <input required value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-pastel-purple" placeholder="VD: Kiểm tra 1 tiết Đại số 10" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Thời gian (phút)</label>
                    <input type="number" min={1} required value={createForm.duration_minutes} onChange={e => setCreateForm({ ...createForm, duration_minutes: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Điểm đạt</label>
                    <input type="number" step="0.1" min={0} max={10} required value={createForm.pass_score} onChange={e => setCreateForm({ ...createForm, pass_score: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Số lần thi tối đa</label>
                    <input type="number" min={1} required value={createForm.max_attempts} onChange={e => setCreateForm({ ...createForm, max_attempts: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium" />
                  </div>
                </div>
              </div>

              {/* Lọc & Chọn câu hỏi chia theo Chương */}
              <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">2. Chọn câu hỏi từ ngân hàng</h4>
                    <p className="text-[11px] text-gray-500">Đã chọn: <strong className="text-pastel-purpleDark">{createForm.question_ids.length}</strong> câu hỏi</p>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <input type="text" placeholder="Tìm kiếm nội dung..." value={questionSearch} onChange={e => setQuestionSearch(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs w-48 focus:outline-none focus:border-pastel-purple" />
                    <select value={questionFilter.subject} onChange={e => setQuestionFilter({ ...questionFilter, subject: e.target.value })} className="px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs bg-white">
                      <option value="">Tất cả môn</option>
                      {[...new Set(questions.map(q => q.subject))].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={questionFilter.difficulty} onChange={e => setQuestionFilter({ ...questionFilter, difficulty: e.target.value })} className="px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs bg-white">
                      <option value="">Tất cả độ khó</option>
                      {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                    {createForm.question_ids.length > 0 && (
                      <button type="button" onClick={() => setCreateForm({ ...createForm, question_ids: [] })} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition">
                        Bỏ chọn tất cả
                      </button>
                    )}
                  </div>
                </div>

                {/* Danh sách câu hỏi gom nhóm theo Chương */}
                <div className="max-h-96 overflow-y-auto space-y-4 pr-1">
                  {filteredQuestions.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-xs">Không tìm thấy câu hỏi nào phù hợp bộ lọc</div>
                  ) : (
                    Object.entries(
                      filteredQuestions.reduce((acc, q) => {
                        const chap = q.chapter || 'Chương chung';
                        if (!acc[chap]) acc[chap] = [];
                        acc[chap].push(q);
                        return acc;
                      }, {})
                    ).map(([chapterName, chQuestions]) => (
                      <div key={chapterName} className="border border-gray-100 rounded-2xl overflow-hidden shadow-xs bg-gray-50/50">
                        <div className="bg-purple-50/80 px-4 py-2 border-b border-purple-100 flex justify-between items-center">
                          <h5 className="text-xs font-bold text-pastel-purpleDark flex items-center space-x-1.5">
                            <span>📖 {chapterName}</span>
                            <span className="text-[10px] px-2 py-0.5 bg-white text-gray-600 rounded-full border">({chQuestions.length} câu)</span>
                          </h5>
                          <button
                            type="button"
                            onClick={() => {
                              const ids = chQuestions.map(q => q.id);
                              const allSelected = ids.every(id => createForm.question_ids.includes(id));
                              setCreateForm(prev => ({
                                ...prev,
                                question_ids: allSelected
                                  ? prev.question_ids.filter(id => !ids.includes(id))
                                  : [...new Set([...prev.question_ids, ...ids])]
                              }));
                            }}
                            className="text-[11px] font-bold text-pastel-purpleDark hover:underline"
                          >
                            {chQuestions.map(q => q.id).every(id => createForm.question_ids.includes(id)) ? 'Bỏ chọn chương này' : 'Chọn toàn bộ chương'}
                          </button>
                        </div>
                        <div className="divide-y divide-gray-100 bg-white">
                          {chQuestions.map((q, idx) => {
                            const isSelected = createForm.question_ids.includes(q.id);
                            return (
                              <div key={q.id} onClick={() => toggleQuestion(q.id)} className={`p-3 flex items-start space-x-3 cursor-pointer transition ${isSelected ? 'bg-purple-50/40' : 'hover:bg-gray-50'}`}>
                                <input type="checkbox" checked={isSelected} onChange={() => {}} className="mt-1 text-pastel-purple rounded" />
                                <div className="flex-1 text-xs">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <span className="font-bold text-gray-500">#{idx + 1}</span>
                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-bold">{q.subject} - Lớp {q.grade_level}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      q.difficulty === 'NHAN_BIET' ? 'bg-blue-50 text-blue-700' :
                                      q.difficulty === 'THONG_HIEU' ? 'bg-emerald-50 text-emerald-700' :
                                      q.difficulty === 'VAN_DUNG' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                                    }`}>
                                      {q.difficulty === 'NHAN_BIET' ? 'Nhận biết' : q.difficulty === 'THONG_HIEU' ? 'Thông hiểu' : q.difficulty === 'VAN_DUNG' ? 'Vận dụng' : 'Vận dụng cao'}
                                    </span>
                                  </div>
                                  <p className="font-medium text-gray-800 line-clamp-2">{q.content}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-xs text-gray-500 font-medium">Tổng đã chọn: <strong className="text-pastel-purpleDark text-sm">{createForm.question_ids.length}</strong> câu</span>
                <div className="flex space-x-3">
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-5 py-2.5 border border-gray-200 rounded-2xl text-xs font-bold hover:bg-gray-50 transition">Hủy</button>
                  <button type="submit" disabled={createLoading} className="px-6 py-2.5 bg-pastel-purple text-white rounded-2xl text-xs font-bold shadow-xs hover:bg-pastel-purpleDark transition disabled:opacity-50">
                    {createLoading ? 'Đang lưu...' : 'Tạo bài thi'}
                  </button>
                </div>
              </div>
            </form>
          </Modal>

          {/* ===== MODAL BÀI NỘP ===== */}
          <Modal isOpen={isSubmissionsModalOpen} onClose={() => setIsSubmissionsModalOpen(false)} title={`Bài nộp - ${selectedExam?.title || ''}`} size="md">
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2 text-xs">
              {submissions.length === 0 ? (
                <div className="p-8 text-center text-gray-400">Chưa có học sinh nào nộp bài.</div>
              ) : (
                submissions.map(sub => (
                  <div key={sub.id} className="bg-white border p-3 rounded-2xl flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-gray-800">{sub.student_name || 'Học sinh'}</h4>
                      <p className="text-[10px] text-gray-400">Nộp: {new Date(sub.submitted_at).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-bold text-emerald-600">{sub.score} / 10</span>
                      <p className="text-[10px] text-gray-400 uppercase">{sub.status}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Modal>
        </main>
      </div>
    </div>
  );
}
