import React, { useEffect, useState, useCallback } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api, { resolveImageUrl } from '../../api/axios';
import { 
  Plus, Search, FolderTree, Trash2, Edit3, Sparkles, CheckCircle2, 
  AlertTriangle, Loader2, ChevronLeft, ChevronRight, Check, X, FileText, Copy, Upload,
  Wand2, AlertCircle
} from 'lucide-react';
import { Modal } from '../../components/Modal';
import { CreateQuestionModal } from '../../components/CreateQuestionModal';
import { CreateCategoryModal } from '../../components/CreateCategoryModal';
import { ImportFileModal } from '../../components/ImportFileModal';
import { ImportJsonModal } from '../../components/ImportJsonModal';
import { AIAuditFixModal } from '../../components/AIAuditFixModal';
import { WinFileExplorerTree } from '../../components/WinFileExplorerTree';
import { MathRenderer } from '../../components/MathRenderer';
import { useToast } from '../../context/ToastContext';

const QUESTION_TYPE_LABELS = {
  MULTIPLE_CHOICE: { label: 'Trắc nghiệm', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  TRUE_FALSE: { label: 'Đúng / Sai', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  SHORT_ANSWER: { label: 'Điền từ / Ngắn', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  ESSAY: { label: 'Tự luận', bg: 'bg-sky-50 text-sky-700 border-sky-200' },
};

const DIFFICULTY_LABELS = {
  NHAN_BIET: { label: 'Nhận biết', bg: 'bg-emerald-50 text-emerald-600' },
  THONG_HIEU: { label: 'Thông hiểu', bg: 'bg-blue-50 text-blue-600' },
  VAN_DUNG: { label: 'Vận dụng', bg: 'bg-orange-50 text-orange-600' },
  VAN_DUNG_CAO: { label: 'Vận dụng cao', bg: 'bg-rose-50 text-rose-600' },
};

export function QuestionBank() {
  const { toast, confirm } = useToast();
  const [questions, setQuestions] = useState([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [treeData, setTreeData] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [aiFilter, setAiFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);

  // Category modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [addingParentCategory, setAddingParentCategory] = useState(null);

  // JSON Import modal
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isImportFileModalOpen, setIsImportFileModalOpen] = useState(false);

  // AI Verification states
  const [verifyingId, setVerifyingId] = useState(null);
  const [verifyResults, setVerifyResults] = useState({});
  const [batchVerifying, setBatchVerifying] = useState(false);

  // AI Audit & Fix states
  const [isAuditFixModalOpen, setIsAuditFixModalOpen] = useState(false);
  const [auditingId, setAuditingId] = useState(null);

  const handleAuditAndFixSingle = async (q) => {
    try {
      setAuditingId(q.id);
      const res = await api.post('/ai/audit-and-fix', {
        question_id: q.id,
        auto_apply: true
      });
      const data = res.data;
      if (data.success && data.question) {
        setQuestions(prev => prev.map(item => item.id === q.id ? data.question : item));
        const audit = data.audit_result || {};
        if (audit.action === 'SET_MISSING_ANSWER') {
          toast.success(`AI đã giải và chọn đáp án ${audit.new_display || ''} thành công!`);
        } else if (audit.action === 'FIX_ANSWER') {
          toast.success(`AI đã phát hiện đáp án sai và sửa thành ${audit.new_display || ''}!`);
        } else {
          toast.info(`AI đã rà soát: Đáp án hiện tại đã chính xác.`);
        }
      } else {
        toast.warning(data.error || 'AI không đưa ra thay đổi nào.');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể rà soát câu hỏi với AI');
    } finally {
      setAuditingId(null);
    }
  };

  const handleVerifyAI = async (q) => {
    try {
      setVerifyingId(q.id);
      const res = await api.post('/ai/verify-question', {
        question_id: q.id,
        content: q.content,
        question_type: q.question_type,
        options: q.options,
        correct_option: q.correct_option,
        correct_answer: q.correct_answer,
        sample_solution: q.explanation || q.sample_solution
      });
      setVerifyResults(prev => ({ ...prev, [q.id]: res.data }));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể kiểm tra câu hỏi bằng AI');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleBatchVerifyAI = async () => {
    if (!selectedCategory) {
      toast.warning('Vui lòng chọn một danh mục từ cây kiến thức bên trái để kiểm tra hàng loạt.');
      return;
    }
    const confirmMsg = `Bạn có chắc muốn chạy AI kiểm tra cho các câu hỏi thuộc mục: ` +
      [selectedCategory.subject, selectedCategory.grade_level ? `Khối ${selectedCategory.grade_level}` : '', selectedCategory.chapter, selectedCategory.lesson].filter(Boolean).join(' › ') + `?`;
    
    confirm({
      title: 'Xác nhận AI kiểm tra hàng loạt',
      message: confirmMsg,
      confirmText: 'Bắt đầu kiểm tra',
      onConfirm: async () => {
        try {
          setBatchVerifying(true);
          const res = await api.post('/ai/verify-batch', {
            subject: selectedCategory.subject,
            grade_level: selectedCategory.grade_level,
            chapter: selectedCategory.chapter,
            limit: 20
          });
          const data = res.data.results || [];
          const newMap = {};
          let correctCount = 0;
          data.forEach(item => {
            newMap[item.question_id] = item;
            if (item.is_correct) correctCount++;
          });
          setVerifyResults(prev => ({ ...prev, ...newMap }));
          toast.success(`Đã kiểm tra xong ${data.length} câu hỏi! (${correctCount}/${data.length} câu chính xác)`);
          refreshQuestions();
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Không thể kiểm tra hàng loạt');
        } finally {
          setBatchVerifying(false);
        }
      }
    });
  };

  const buildQuestionsUrl = useCallback((targetPage = page) => {
    let url = `/questions/?page=${targetPage}&limit=${limit}`;
    if (selectedCategory) {
      if (selectedCategory.subject) url += `&subject=${encodeURIComponent(selectedCategory.subject)}`;
      if (selectedCategory.grade_level) url += `&grade_level=${selectedCategory.grade_level}`;
      if (selectedCategory.chapter) url += `&chapter=${encodeURIComponent(selectedCategory.chapter)}`;
      if (selectedCategory.lesson) url += `&lesson=${encodeURIComponent(selectedCategory.lesson)}`;
      if (selectedCategory.topic) url += `&topic=${encodeURIComponent(selectedCategory.topic)}`;
    }
    if (typeFilter && typeFilter !== 'all') url += `&question_type=${typeFilter}`;
    if (difficultyFilter && difficultyFilter !== 'all') url += `&difficulty=${difficultyFilter}`;
    if (aiFilter && aiFilter !== 'all') url += `&ai_status=${aiFilter}`;
    if (debouncedSearch.trim()) url += `&search=${encodeURIComponent(debouncedSearch.trim())}`;
    return url;
  }, [page, selectedCategory, typeFilter, difficultyFilter, aiFilter, debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    const loadQuestions = async () => {
      try {
        setLoading(true);
        const res = await api.get(buildQuestionsUrl(page));
        if (cancelled) return;
        setQuestions(Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []));
        setTotalQuestions(res.data?.total || 0);
      } catch {
        if (!cancelled) {
          setQuestions([]);
          setTotalQuestions(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadQuestions();
    return () => { cancelled = true; };
  }, [buildQuestionsUrl, page]);

  const refreshTreeData = useCallback(async () => {
    try {
      const res = await api.get('/questions/tree/structure');
      setTreeData(res.data || {});
    } catch {
      setTreeData({});
    }
  }, []);

  useEffect(() => {
    refreshTreeData();
  }, [refreshTreeData]);

  const handleSelectCategory = (cat) => {
    setSelectedCategory(prev => {
      if (!cat && !prev) return null;
      if (cat && prev && JSON.stringify(cat) === JSON.stringify(prev)) {
        return prev;
      }
      return cat;
    });
    setPage(1);
  };
  const handleTypeFilter = (val) => {
    setTypeFilter(val);
    setPage(1);
  };
  const handleDifficultyFilter = (val) => {
    setDifficultyFilter(val);
    setPage(1);
  };
  const handleAiFilter = (val) => {
    setAiFilter(val);
    setPage(1);
  };
  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setPage(1);
  };

  const refreshQuestions = async () => {
    try {
      setLoading(true);
      const res = await api.get(buildQuestionsUrl(page));
      setQuestions(Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []));
      setTotalQuestions(res.data?.total || 0);
    } catch {
      setQuestions([]);
      setTotalQuestions(0);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (q = null) => {
    setEditingQuestion(q);
    setIsModalOpen(true);
  };

  const handleSaveQuestion = async (formData) => {
    try {
      if (editingQuestion) {
        await api.put(`/questions/${editingQuestion.id}`, formData);
        toast.success('Cập nhật câu hỏi thành công!');
      } else {
        await api.post('/questions/', formData);
        toast.success('Tạo câu hỏi mới thành công!');
      }
      setIsModalOpen(false);
      refreshQuestions();
      refreshTreeData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể lưu câu hỏi');
    }
  };

  const handleDeleteQuestion = (id) => {
    confirm({
      title: 'Xóa câu hỏi',
      message: 'Bạn có chắc chắn muốn xóa câu hỏi này khỏi ngân hàng?',
      confirmText: 'Xóa câu hỏi',
      onConfirm: async () => {
        try {
          await api.delete(`/questions/${id}`);
          refreshQuestions();
          refreshTreeData();
          toast.success('Đã xóa câu hỏi thành công!');
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Không thể xóa câu hỏi');
        }
      }
    });
  };

  const handleDeleteCategory = (categoryPayload) => {
    const name = [
      categoryPayload.subject, 
      categoryPayload.grade_level ? `Khối ${categoryPayload.grade_level}` : '', 
      categoryPayload.chapter, 
      categoryPayload.lesson, 
      categoryPayload.topic
    ].filter(Boolean).join(' › ');

    confirm({
      title: 'Xóa thư mục kiến thức',
      message: `Bạn có chắc chắn muốn xóa thư mục "${name}" và TOÀN BỘ câu hỏi bên trong? Hành động này không thể hoàn tác!`,
      confirmText: 'Xóa vĩnh viễn',
      onConfirm: async () => {
        try {
          await api.delete('/questions/categories', { data: categoryPayload });
          toast.success('Xóa danh mục thành công!');
          if (selectedCategory && JSON.stringify(selectedCategory) === JSON.stringify(categoryPayload)) {
            setSelectedCategory(null);
          }
          refreshQuestions();
          refreshTreeData();
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Không thể xóa thư mục');
        }
      }
    });
  };

  const handleOpenAddCategory = (parentPayload = null) => {
    setAddingParentCategory(parentPayload);
    setIsCategoryModalOpen(true);
  };

  const handleAddCategory = async (categoryData) => {
    try {
      await api.post('/questions/categories', categoryData);
      setIsCategoryModalOpen(false);
      setAddingParentCategory(null);
      refreshTreeData();
      toast.success('Tạo thư mục thành công!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể tạo thư mục');
    }
  };

  const handleMoveQuestion = async (qId, targetTaxonomy) => {
    try {
      const payload = {
        subject: targetTaxonomy.subject,
        grade_level: targetTaxonomy.grade_level,
        chapter: targetTaxonomy.chapter,
        lesson: targetTaxonomy.lesson,
        topic: targetTaxonomy.topic
      };
      await api.put(`/questions/${qId}`, payload);
      refreshQuestions();
      refreshTreeData();
      toast.success('Di chuyển câu hỏi thành công!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể di chuyển câu hỏi');
    }
  };

  const handleMoveCategory = async (sourceTaxonomy, targetTaxonomy) => {
    try {
      await api.put('/questions/categories/move', { source: sourceTaxonomy, target: targetTaxonomy });
      refreshQuestions();
      refreshTreeData();
      toast.success('Di chuyển thư mục thành công!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể di chuyển thư mục');
    }
  };

  const totalPages = Math.ceil(totalQuestions / limit) || 1;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex">
        <Sidebar role="teacher" />
        <main className="flex-1 p-5 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {/* Top Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
                <FolderTree className="w-6 h-6 text-indigo-600" />
                <span>Ngân hàng Câu hỏi & Cây phân loại</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">Quản lý kho câu hỏi phân tầng theo Môn, Khối, Chương, Bài và Dạng bài chuẩn giáo dục.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsAuditFixModalOpen(true)}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium text-xs shadow-2xs transition"
                title="Tự động kiểm tra: câu nào sai thì sửa đáp án đúng, câu nào thiếu đáp án thì bổ sung"
              >
                <Wand2 className="w-4 h-4" />
                <span>Tự động kiểm tra & Điền đáp án</span>
              </button>
              <button
                onClick={handleBatchVerifyAI}
                disabled={batchVerifying}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-medium text-xs shadow-2xs transition"
                title="Kiểm tra hàng loạt câu hỏi trong danh mục"
              >
                {batchVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{batchVerifying ? 'Đang kiểm tra…' : 'Kiểm tra đáp án'}</span>
              </button>
              <button
                onClick={() => setIsImportFileModalOpen(true)}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-medium text-xs shadow-2xs transition"
                title="Trích xuất và nhập câu hỏi từ tệp Word (.docx, .doc), PDF (.pdf)"
              >
                <Upload className="w-4 h-4 text-indigo-600" />
                <span>Nhập từ File (Word/PDF)</span>
              </button>
              <button
                onClick={() => setIsJsonModalOpen(true)}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-medium text-xs shadow-2xs transition"
              >
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Nhập JSON</span>
              </button>
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-xs shadow-xs hover:bg-indigo-700 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Soạn câu hỏi</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Left Column: Knowledge Tree */}
            <div className="col-span-12 lg:col-span-4">
              <WinFileExplorerTree
                treeData={treeData}
                selectedCategory={selectedCategory}
                onSelectCategory={handleSelectCategory}
                onAddCategory={handleOpenAddCategory}
                onDeleteCategory={handleDeleteCategory}
                onMoveQuestion={handleMoveQuestion}
                onMoveCategory={handleMoveCategory}
              />
            </div>

            {/* Right Column: Questions List & Filters */}
            <div className="col-span-12 lg:col-span-8 space-y-4">
              {/* Search Bar */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs flex items-center space-x-3">
                <Search className="w-4 h-4 text-slate-400 ml-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Tìm kiếm câu hỏi theo nội dung hoặc mã câu..."
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  className="w-full bg-transparent border-none text-xs sm:text-sm focus:outline-none placeholder-slate-400 text-slate-800"
                />
                {searchQuery && (
                  <button onClick={() => handleSearchChange('')} className="p-1 hover:bg-slate-100 rounded-full text-slate-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filters Panel */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 w-24 shrink-0">Dạng câu hỏi:</span>
                  {[
                    ['all', 'Tất cả'],
                    ['MULTIPLE_CHOICE', 'Trắc nghiệm'],
                    ['TRUE_FALSE', 'Đúng / Sai'],
                    ['SHORT_ANSWER', 'Điền từ'],
                    ['ESSAY', 'Tự luận'],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => handleTypeFilter(val)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition ${typeFilter === val ? 'bg-indigo-600 text-white shadow-2xs font-semibold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 w-24 shrink-0">Mức độ:</span>
                  {[
                    ['all', 'Tất cả'],
                    ['NHAN_BIET', 'Nhận biết'],
                    ['THONG_HIEU', 'Thông hiểu'],
                    ['VAN_DUNG', 'Vận dụng'],
                    ['VAN_DUNG_CAO', 'Vận dụng cao'],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => handleDifficultyFilter(val)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition ${difficultyFilter === val ? 'bg-indigo-600 text-white shadow-2xs font-semibold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 w-24 shrink-0">Kiểm tra:</span>
                  {[
                    ['all', 'Tất cả'],
                    ['unverified', 'Chưa kiểm tra'],
                    ['correct', 'Đáp án chuẩn'],
                    ['incorrect', 'Cần xem lại'],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => handleAiFilter(val)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition ${aiFilter === val ? 'bg-indigo-600 text-white shadow-2xs font-semibold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Questions List Card */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center space-x-2 font-bold text-sm text-slate-800">
                    <span>Danh sách câu hỏi ({totalQuestions} câu)</span>
                    {loading && (
                      <span className="flex items-center space-x-1 text-xs font-normal text-indigo-600">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang đồng bộ…</span>
                      </span>
                    )}
                  </div>
                  {selectedCategory && (
                    <div className="flex items-center space-x-1.5 text-xs text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                      <span>{selectedCategory.subject} › Khối {selectedCategory.grade_level || 10}{selectedCategory.chapter ? ` › ${selectedCategory.chapter}` : ''}{selectedCategory.lesson ? ` › ${selectedCategory.lesson}` : ''}{selectedCategory.topic ? ` › ${selectedCategory.topic}` : ''}</span>
                      <button onClick={() => handleSelectCategory(null)} className="p-0.5 hover:bg-indigo-100 rounded-full text-indigo-700">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {loading && questions.length === 0 ? (
                  <div className="p-6 space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                        <div className="flex items-center space-x-2">
                          <div className="h-5 w-20 bg-slate-200 rounded-md" />
                          <div className="h-5 w-24 bg-slate-200 rounded-full" />
                          <div className="h-5 w-16 bg-slate-200 rounded-full" />
                        </div>
                        <div className="h-4 bg-slate-200 rounded w-4/5" />
                        <div className="h-4 bg-slate-200 rounded w-2/3" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                          <div className="h-9 bg-slate-200 rounded-xl" />
                          <div className="h-9 bg-slate-200 rounded-xl" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : questions.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 text-xs">
                    Không tìm thấy câu hỏi nào phù hợp với bộ lọc.
                  </div>
                ) : (
                  <div className={`divide-y divide-slate-100 transition-opacity duration-200 ${loading ? 'opacity-50' : 'opacity-100'}`}>
                    {questions.map((q, qIndex) => {
                      const typeConfig = QUESTION_TYPE_LABELS[q.question_type] || QUESTION_TYPE_LABELS.MULTIPLE_CHOICE;
                      const diffConfig = DIFFICULTY_LABELS[q.difficulty] || DIFFICULTY_LABELS.THONG_HIEU;

                      return (
                        <div key={q.id} className="p-5 space-y-3.5 hover:bg-slate-50/70 transition">
                          {/* Card Top Meta */}
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                #{(page - 1) * limit + qIndex + 1} ({q.code || `ID-${q.id}`})
                              </span>
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${typeConfig.bg}`}>
                                {typeConfig.label}
                              </span>
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${diffConfig.bg}`}>
                                {diffConfig.label}
                              </span>
                              {((q.question_type === 'MULTIPLE_CHOICE' && (q.correct_option === null || q.correct_option === undefined)) ||
                                (q.question_type === 'SHORT_ANSWER' && !q.correct_answer)) && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 flex items-center space-x-1">
                                  <AlertCircle className="w-3 h-3 text-amber-600" />
                                  <span>Chưa có đáp án</span>
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400">
                                {q.subject} • Khối {q.grade_level}{q.chapter ? ` • ${q.chapter}` : ''}
                              </span>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center space-x-1 shrink-0">
                              <button
                                onClick={() => handleAuditAndFixSingle(q)}
                                disabled={auditingId === q.id}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-medium transition flex items-center space-x-1 border border-amber-200 shadow-2xs"
                                title="Tự động kiểm tra: sửa nếu đáp án sai hoặc tự động chọn đáp án đúng nếu còn thiếu"
                              >
                                {auditingId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 text-amber-600" />}
                                <span className="hidden sm:inline">
                                  {q.question_type === 'MULTIPLE_CHOICE' && q.correct_option === null ? 'Điền đáp án' : 'Sửa câu'}
                                </span>
                              </button>
                              <button
                                onClick={() => handleVerifyAI(q)}
                                disabled={verifyingId === q.id}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium transition flex items-center space-x-1 border border-indigo-200"
                                title="Kiểm tra đáp án & lời giải"
                              >
                                {verifyingId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                <span className="hidden sm:inline">Kiểm tra</span>
                              </button>
                              <button 
                                onClick={() => handleOpenModal(q)} 
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                title="Sửa câu hỏi"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteQuestion(q.id)} 
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Xóa câu hỏi"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Question Content */}
                          <div className="text-sm text-gray-800 font-medium leading-relaxed">
                            <MathRenderer content={q.content} />
                          </div>

                          {/* Question Image if present */}
                          {q.image_url && (
                            <div className="p-2 bg-white rounded-xl border border-gray-200 inline-block">
                              <img 
                                src={resolveImageUrl(q.image_url)} 
                                alt="Hình minh họa" 
                                className="max-h-48 max-w-full rounded-lg object-contain"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            </div>
                          )}

                          {/* Choices / Answers Display */}
                          {q.question_type === 'MULTIPLE_CHOICE' && Array.isArray(q.options) && q.options.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                              {q.options.map((opt, optIdx) => {
                                const isCorrect = q.correct_option === optIdx;
                                return (
                                  <div 
                                    key={optIdx} 
                                    className={`flex items-center space-x-2.5 p-2.5 rounded-xl border text-xs ${isCorrect ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 font-semibold' : 'bg-gray-50/70 border-gray-100 text-gray-700'}`}
                                  >
                                    <span className={`w-5 h-5 flex items-center justify-center rounded-md font-bold text-[11px] shrink-0 ${isCorrect ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                                      {String.fromCharCode(65 + optIdx)}
                                    </span>
                                    <span className="flex-1"><MathRenderer content={opt || ''} /></span>
                                    {isCorrect && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {q.question_type === 'TRUE_FALSE' && Array.isArray(q.sub_questions) && q.sub_questions.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              {q.sub_questions.map((sub, sIdx) => (
                                <div key={sIdx} className="flex items-center justify-between p-2 bg-gray-50/80 border border-gray-100 rounded-xl text-xs">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-bold text-gray-500 w-5">{String.fromCharCode(97 + sIdx)})</span>
                                    <span><MathRenderer content={sub.statement || ''} /></span>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${sub.answer ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {sub.answer ? 'Đúng' : 'Sai'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {q.question_type === 'SHORT_ANSWER' && (
                            <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs flex items-center space-x-2">
                              <span className="font-bold text-amber-800">Đáp án chính xác:</span>
                              <span className="font-mono bg-white px-2 py-0.5 rounded border border-amber-300 text-amber-900 font-bold">
                                {q.correct_answer || 'Chưa nhập'}
                              </span>
                            </div>
                          )}

                          {q.question_type === 'ESSAY' && q.sample_solution && (
                            <div className="p-3 bg-sky-50/60 border border-sky-200 rounded-xl text-xs text-sky-900 space-y-1">
                              <span className="font-bold text-sky-800">Hướng dẫn chấm / Đáp án mẫu:</span>
                              <div><MathRenderer content={q.sample_solution} /></div>
                            </div>
                          )}

                          {/* Detailed Explanation */}
                          {q.explanation && (
                            <div className="text-xs text-gray-600 bg-blue-50/50 p-3 rounded-2xl border border-blue-100">
                              <strong className="text-blue-700 mr-1">Lời giải:</strong>
                              <MathRenderer content={q.explanation} />
                            </div>
                          )}

                          {/* AI Verification Results Box */}
                          {verifyResults[q.id] && (
                            <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${verifyResults[q.id].is_correct ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-amber-50/70 border-amber-200 text-amber-900'}`}>
                              <div className="flex items-center space-x-2 font-bold text-xs">
                                {verifyResults[q.id].is_correct ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <span className="text-emerald-700">AI Xác nhận: Đáp án chính xác</span>
                                  </>
                                ) : (
                                  <>
                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                    <span className="text-amber-700">AI Cảnh báo: Có thể có sai sót</span>
                                  </>
                                )}
                                <span className="text-[10px] bg-white/80 px-2 py-0.5 rounded-full font-mono">Độ tin cậy: {Math.round((verifyResults[q.id].confidence || 0) * 100)}%</span>
                              </div>
                              <div><strong>AI giải:</strong> {verifyResults[q.id].feedback}</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="p-4 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      Trang {page} / {totalPages} (Tổng {totalQuestions} câu hỏi)
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Trước</span>
                      </button>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1"
                      >
                        <span>Sau</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Create / Edit Question Modal */}
          <CreateQuestionModal
            key={editingQuestion ? editingQuestion.id : 'new-modal'}
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSubmit={handleSaveQuestion}
            initialData={editingQuestion}
          />

          {/* JSON Import Modal & AI Prompt Assistant */}
          <ImportJsonModal
            isOpen={isJsonModalOpen}
            onClose={() => setIsJsonModalOpen(false)}
            selectedCategory={selectedCategory}
            treeData={treeData}
            onSuccess={() => {
              refreshQuestions();
              refreshTreeData();
            }}
          />

          {/* Create Category Modal */}
          <CreateCategoryModal 
            isOpen={isCategoryModalOpen} 
            onClose={() => { setIsCategoryModalOpen(false); setAddingParentCategory(null); }} 
            onSubmit={handleAddCategory}
            parentCategory={addingParentCategory}
          />

          {/* Import File Modal (Word, PDF, Markdown) */}
          <ImportFileModal
            isOpen={isImportFileModalOpen}
            onClose={() => setIsImportFileModalOpen(false)}
            onSuccess={() => {
              refreshQuestions();
              refreshTreeData();
            }}
          />

          {/* AI Audit & Auto-Fix Modal */}
          <AIAuditFixModal
            isOpen={isAuditFixModalOpen}
            onClose={() => setIsAuditFixModalOpen(false)}
            selectedCategory={selectedCategory}
            onFinished={() => {
              refreshQuestions();
              refreshTreeData();
            }}
            toast={toast}
          />
        </main>
      </div>
    </div>
  );
}
