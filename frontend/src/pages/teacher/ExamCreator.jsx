import React, { useState, useEffect } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api from '../../api/axios';
import { 
  Plus, Trash2, BookOpen, Save, Sparkles, Layers, CheckCircle, 
  ArrowRight, Settings, FileText, Folder, FolderOpen, ChevronRight, 
  ChevronDown, Search, File, Shuffle, Copy, Sliders, Check, 
  AlertTriangle, Eye, ShieldCheck, Hash, Send, Edit3, CheckCircle2,
  XCircle, Clock, Award, Archive, Filter, RefreshCw, Upload
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { AssignmentModal } from '../../components/AssignmentModal';
import { Modal } from '../../components/Modal';
import { MathRenderer } from '../../components/MathRenderer';
import { ManualQuestionExplorer } from '../../components/ManualQuestionExplorer';
import { ImportFileModal } from '../../components/ImportFileModal';

export function ExamCreator() {
  const navigate = useNavigate();
  const { toast, confirm } = useToast();
  const [activeTab, setActiveTab] = useState('repository'); // 'repository' | 'matrix' | 'matrix-select' | 'manual'

  // Kho đề thi state (Chuyên biệt cho Đề thi, tách riêng với Bài tập)
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [examSearch, setExamSearch] = useState('');
  const [examStatusFilter, setExamStatusFilter] = useState('all'); // 'all' | 'published' | 'draft'
  const [examPage, setExamPage] = useState(1);
  const [totalExams, setTotalExams] = useState(0);
  const [totalExamPages, setTotalExamPages] = useState(1);

  // Modals for Kho đề thi
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedExamForAssign, setSelectedExamForAssign] = useState(null);

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewExam, setPreviewExam] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedExamForEdit, setSelectedExamForEdit] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDuration, setEditDuration] = useState(45);
  const [isImportFileModalOpen, setIsImportFileModalOpen] = useState(false);
  const [editPassScore, setEditPassScore] = useState(5.0);
  const [editMaxAttempts, setEditMaxAttempts] = useState(1);
  const [editShowAnswers, setEditShowAnswers] = useState(true);
  const [editPublished, setEditPublished] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // 1. Exam General Info
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(45);
  const [passScore, setPassScore] = useState(5.0);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [showAnswers, setShowAnswers] = useState(true);

  // Multi-version & shuffle generation options (Mới theo yêu cầu)
  const [numberOfVersions, setNumberOfVersions] = useState(1);
  const [codePrefix, setCodePrefix] = useState('10');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [independentDraw, setIndependentDraw] = useState(false);

  // 2. Manual questions mode
  const [questions, setQuestions] = useState([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [manualExpanded, setManualExpanded] = useState(() => new Set());
  const [manualSearch, setManualSearch] = useState('');

  // 3. Matrix creation state
  const [matrices, setMatrices] = useState([]);
  const [selectedMatrixId, setSelectedMatrixId] = useState('');
  const [matrixName, setMatrixName] = useState('');
  const [matrixDesc, setMatrixDesc] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [chapters, setChapters] = useState([]);
  const [autoTotal, setAutoTotal] = useState(40);
  const [pickerSelection, setPickerSelection] = useState(() => new Set());
  const [pickerExpanded, setPickerExpanded] = useState(() => new Set());
  const [pickerSearch, setPickerSearch] = useState('');
  const [matrixCollapsed, setMatrixCollapsed] = useState(() => new Set());
  const [matrixSearch, setMatrixSearch] = useState('');
  const [deletingMatrixId, setDeletingMatrixId] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchExams();
    fetchQuestions();
    fetchMatrices();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchExams();
  }, [examPage, examSearch]);

  const fetchExams = async () => {
    try {
      setLoadingExams(true);
      const res = await api.get('/exams', {
        params: {
          page: examPage,
          limit: 10,
          search: examSearch || undefined,
          exam_type: 'EXAM' // Tách biệt hoàn toàn: Chỉ lấy ĐỀ THI
        }
      });
      setExams(res.data.items || res.data || []);
      const tot = res.data.total || (res.data.items ? res.data.items.length : 0);
      setTotalExams(tot);
      setTotalExamPages(res.data.total_pages || Math.ceil(tot / 10) || 1);
    } catch (err) {
      console.error('Error loading exams:', err);
      setExams([]);
    } finally {
      setLoadingExams(false);
    }
  };

  const handleTogglePublish = async (exam) => {
    try {
      await api.put(`/exams/${exam.id}`, {
        is_published: !exam.is_published
      });
      toast.success(exam.is_published ? 'Đã chuyển đề thi về bản nháp' : 'Đã xuất bản đề thi thành công!');
      fetchExams();
    } catch (err) {
      toast.error('Lỗi thay đổi trạng thái: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteExam = async (exam) => {
    const ok = await confirm({
      title: 'Xác nhận xóa đề thi',
      message: `Bạn có chắc chắn muốn xóa đề thi "${exam.title}" (ID: #${exam.id}) khỏi kho đề thi? Thao tác này không thể hoàn tác.`,
      confirmText: 'Xác nhận xóa',
      cancelText: 'Hủy'
    });
    if (!ok) return;

    try {
      await api.delete(`/exams/${exam.id}?force=true`);
      toast.success('Đã xóa đề thi khỏi kho thành công!');
      fetchExams();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể xóa đề thi');
    }
  };

  const handleOpenPreview = async (exam) => {
    setLoadingPreview(true);
    setPreviewModalOpen(true);
    try {
      const res = await api.get(`/exams/${exam.id}`);
      setPreviewExam(res.data);
    } catch (err) {
      toast.error('Không thể tải chi tiết đề thi');
      setPreviewModalOpen(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleOpenEdit = (exam) => {
    setSelectedExamForEdit(exam);
    setEditTitle(exam.title || '');
    setEditDuration(exam.duration_minutes || 45);
    setEditPassScore(exam.pass_score ?? 5.0);
    setEditMaxAttempts(exam.max_attempts || 1);
    setEditShowAnswers(exam.show_answers_after_submit ?? true);
    setEditPublished(exam.is_published ?? false);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedExamForEdit) return;
    try {
      setSavingEdit(true);
      await api.put(`/exams/${selectedExamForEdit.id}`, {
        title: editTitle,
        duration_minutes: parseInt(editDuration),
        pass_score: parseFloat(editPassScore),
        max_attempts: parseInt(editMaxAttempts),
        show_answers_after_submit: editShowAnswers,
        is_published: editPublished
      });
      toast.success('Cập nhật thông tin đề thi thành công!');
      setEditModalOpen(false);
      fetchExams();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Lỗi cập nhật đề thi');
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredExams = exams.filter(ex => {
    if (examStatusFilter === 'published') return ex.is_published;
    if (examStatusFilter === 'draft') return !ex.is_published;
    return true;
  });

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await api.get('/questions/stats');
      setStats(res.data);
      const subs = res.data?.subjects || [];
      const grades = res.data?.grades || [];
      if (subs.length > 0) setSubject((prev) => prev || subs[0]);
      if (grades.length > 0) setGradeLevel((prev) => prev || String(grades[0]));
    } catch (err) {
      console.error('Error loading question stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const gradeHierarchy = stats?.hierarchy?.[subject]?.[String(gradeLevel)] || {};

  const getTopicAvailable = (chapterName, lessonName, topicName, difficulty) => {
    try {
      return parseInt(gradeHierarchy?.[chapterName]?.[lessonName]?.[topicName]?.[difficulty] || 0);
    } catch { return 0; }
  };

  const getChapterTotalAvail = (chapterName) => {
    const chap = gradeHierarchy[chapterName];
    if (!chap) return 0;
    let total = 0;
    Object.values(chap).forEach((lessons) => {
      Object.values(lessons).forEach((topics) => {
        Object.values(topics).forEach((cnt) => { total += parseInt(cnt || 0); });
      });
    });
    return total;
  };

  const getLessonTotalAvail = (chapterName, lessonName) => {
    const les = gradeHierarchy[chapterName]?.[lessonName];
    if (!les) return 0;
    let total = 0;
    Object.values(les).forEach((topics) => {
      Object.values(topics).forEach((cnt) => { total += parseInt(cnt || 0); });
    });
    return total;
  };

  const getTotalAvailable = () => {
    let total = 0;
    Object.values(gradeHierarchy).forEach((chap) => {
      Object.values(chap).forEach((lessons) => {
        Object.values(lessons).forEach((topics) => {
          Object.values(topics).forEach((cnt) => { total += parseInt(cnt || 0); });
        });
      });
    });
    return total;
  };

  const pickerKey = (chap, les, top) => `${chap}|||${les}|||${top}`;

  const isExpanded = (key, defaultOpen = false) => {
    if (pickerExpanded.has(key)) return true;
    if (pickerExpanded.has(`!${key}`)) return false;
    return defaultOpen;
  };

  const toggleExpand = (key) => {
    setPickerExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); next.add(`!${key}`); }
      else if (next.has(`!${key}`)) { next.delete(`!${key}`); next.add(key); }
      else { next.add(key); }
      return next;
    });
  };

  const expandAllPicker = () => {
    const next = new Set();
    Object.entries(gradeHierarchy).forEach(([chapName, lesMap]) => {
      next.add(`c:${chapName}`);
      Object.keys(lesMap || {}).forEach((lesName) => { next.add(`l:${chapName}|||${lesName}`); });
    });
    setPickerExpanded(next);
  };

  const collapseAllPicker = () => {
    const next = new Set();
    Object.entries(gradeHierarchy).forEach(([chapName, lesMap]) => {
      next.add(`!c:${chapName}`);
      Object.keys(lesMap || {}).forEach((lesName) => { next.add(`!l:${chapName}|||${lesName}`); });
    });
    setPickerExpanded(next);
  };

  const togglePicker = (key) => {
    setPickerSelection((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleChapterPicker = (chapName) => {
    const lesMap = gradeHierarchy[chapName] || {};
    const allKeys = [];
    Object.keys(lesMap).forEach((ln) => {
      Object.keys(lesMap[ln] || {}).forEach((tn) => allKeys.push(pickerKey(chapName, ln, tn)));
    });
    const allChecked = allKeys.length > 0 && allKeys.every((k) => pickerSelection.has(k));
    setPickerSelection((prev) => {
      const next = new Set(prev);
      allKeys.forEach((k) => { if (allChecked) next.delete(k); else next.add(k); });
      return next;
    });
  };

  const toggleLessonPicker = (chapName, lesName) => {
    const topMap = gradeHierarchy[chapName]?.[lesName] || {};
    const allKeys = Object.keys(topMap).map((tn) => pickerKey(chapName, lesName, tn));
    const allChecked = allKeys.length > 0 && allKeys.every((k) => pickerSelection.has(k));
    setPickerSelection((prev) => {
      const next = new Set(prev);
      allKeys.forEach((k) => { if (allChecked) next.delete(k); else next.add(k); });
      return next;
    });
  };

  const handleAddPicked = () => {
    if (pickerSelection.size === 0) return;
    const next = JSON.parse(JSON.stringify(chapters));
    const findChap = (name) => next.find((c) => c.chapter === name);
    const findLes = (chapObj, name) => chapObj.topics.find((l) => l.topic === name);
    let added = 0;
    pickerSelection.forEach((key) => {
      const [chapName, lesName, topName] = key.split('|||');
      let chapObj = findChap(chapName);
      if (!chapObj) { chapObj = { chapter: chapName, topics: [] }; next.push(chapObj); }
      let lesObj = findLes(chapObj, lesName);
      if (!lesObj) { lesObj = { topic: lesName, topics: [] }; chapObj.topics.push(lesObj); }
      const exists = lesObj.topics.some((t) => t.topic === topName);
      if (!exists) { 
        lesObj.topics.push({ topic: topName, difficulties: { NHAN_BIET: 0, THONG_HIEU: 0, VAN_DUNG: 0, VAN_DUNG_CAO: 0 } }); 
        added += 1; 
      }
    });
    if (added === 0) { 
      toast.info('Các mục đã chọn đều đã có trong ma trận.'); 
      return; 
    }
    setChapters(next);
    setPickerSelection(new Set());
    toast.success(`Đã thêm ${added} chủ đề vào ma trận!`);
  };

  const handleAddAllFromDB = () => {
    const hier = gradeHierarchy;
    const chapNames = Object.keys(hier);
    if (chapNames.length === 0) {
      toast.warning('DB chưa có câu hỏi cho môn và khối này.');
      return;
    }
    const built = chapNames.map((chapName) => {
      const lessons = hier[chapName] || {};
      const lessonArr = Object.keys(lessons).map((lesName) => {
        const topics = lessons[lesName] || {};
        const topicArr = Object.keys(topics).map((topName) => ({
          topic: topName,
          difficulties: { NHAN_BIET: 0, THONG_HIEU: 0, VAN_DUNG: 0, VAN_DUNG_CAO: 0 }
        }));
        return { 
          topic: lesName, 
          topics: topicArr.length > 0 ? topicArr : [{ topic: 'Chưa phân loại', difficulties: { NHAN_BIET: 0, THONG_HIEU: 0, VAN_DUNG: 0, VAN_DUNG_CAO: 0 } }] 
        };
      });
      return { chapter: chapName, topics: lessonArr };
    });
    setChapters(built);
    toast.success(`Đã tải toàn bộ ${chapNames.length} chương vào ma trận!`);
  };

  // Phân bổ câu hỏi theo tỉ lệ tự động
  const handleAutoDistribute = (totalWanted, customRatio = null) => {
    let hier = gradeHierarchy;
    let base = chapters;
    if (base.length === 0) {
      const chapNames = Object.keys(hier);
      if (chapNames.length === 0) { 
        toast.error('DB chưa có câu hỏi cho Môn/Khối này.'); 
        return; 
      }
      base = chapNames.map((chapName) => {
        const lessons = hier[chapName] || {};
        return {
          chapter: chapName,
          topics: Object.keys(lessons).map((lesName) => ({
            topic: lesName,
            topics: Object.keys(lessons[lesName] || {}).map((topName) => ({
              topic: topName,
              difficulties: { NHAN_BIET: 0, THONG_HIEU: 0, VAN_DUNG: 0, VAN_DUNG_CAO: 0 }
            }))
          }))
        };
      });
    }

    const diffKeys = ['NHAN_BIET', 'THONG_HIEU', 'VAN_DUNG', 'VAN_DUNG_CAO'];
    const leaves = [];
    base.forEach((chap, ci) => {
      (chap.topics || []).forEach((les, li) => {
        (les.topics || []).forEach((top, ti) => {
          diffKeys.forEach((dk) => {
            const avail = getTopicAvailable(chap.chapter, les.topic, top.topic, dk);
            if (avail > 0) leaves.push({ ci, li, ti, dk, avail });
          });
        });
      });
    });

    const totalAvail = leaves.reduce((s, l) => s + l.avail, 0);
    if (totalAvail === 0) { 
      toast.error('Ngân hàng không có câu hỏi nào khả dụng cho phạm vi này.'); 
      return; 
    }

    let total = parseInt(totalWanted);
    if (!total || total <= 0) total = Math.min(40, totalAvail);
    if (total > totalAvail) { 
      toast.warning(`Tổng ${total} câu vượt quá tồn kho DB (${totalAvail} câu). Đã tự điều chỉnh về ${totalAvail} câu.`); 
      total = totalAvail; 
    }

    let alloc = [];
    if (customRatio && Array.isArray(customRatio) && customRatio.length === 4) {
      // Phân bổ theo tỉ lệ nhận thức [NB, TH, VD, VDC]
      const [rNB, rTH, rVD, rVDC] = customRatio;
      const targetDiffCount = {
        NHAN_BIET: Math.round((total * rNB) / 100),
        THONG_HIEU: Math.round((total * rTH) / 100),
        VAN_DUNG: Math.round((total * rVD) / 100),
        VAN_DUNG_CAO: Math.round((total * rVDC) / 100),
      };

      alloc = leaves.map((l) => {
        const diffTotalAvail = leaves.filter(x => x.dk === l.dk).reduce((s, x) => s + x.avail, 0) || 1;
        const targetForDiff = targetDiffCount[l.dk] || 0;
        const share = (l.avail / diffTotalAvail) * targetForDiff;
        return {
          ...l,
          want: Math.min(l.avail, Math.floor(share)),
          frac: share - Math.floor(share)
        };
      });
    } else {
      // Phân bổ theo tỉ lệ tồn kho đều
      alloc = leaves.map((l) => ({
        ...l,
        want: Math.floor((total * l.avail) / totalAvail),
        frac: (total * l.avail) / totalAvail - Math.floor((total * l.avail) / totalAvail)
      }));
    }

    let assigned = alloc.reduce((s, a) => s + Math.min(a.want, a.avail), 0);
    alloc.forEach((a) => { a.want = Math.min(a.want, a.avail); });
    alloc.sort((a, b) => b.frac - a.frac);

    let i = 0;
    while (assigned < total && alloc.length > 0) {
      const a = alloc[i % alloc.length];
      if (a.want < a.avail) { 
        a.want += 1; 
        assigned += 1; 
      }
      i += 1;
      if (i > totalAvail * 2 + alloc.length) break;
    }

    const built = JSON.parse(JSON.stringify(base));
    built.forEach((chap) => (chap.topics || []).forEach((les) => (les.topics || []).forEach((top) => {
      top.difficulties = { NHAN_BIET: 0, THONG_HIEU: 0, VAN_DUNG: 0, VAN_DUNG_CAO: 0 };
    })));
    alloc.forEach((a) => { 
      built[a.ci].topics[a.li].topics[a.ti].difficulties[a.dk] = a.want; 
    });

    setChapters(built);
    toast.success(`Đã tự động phân bổ ${assigned} câu hỏi vào ma trận!`);
  };

  const fetchQuestions = async () => {
    try {
      setLoadingQuestions(true);
      const res = await api.get('/questions?limit=1000');
      const items = Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
      setQuestions(items);
    } catch (err) {
      console.error('Error fetching questions:', err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const fetchMatrices = async () => {
    try {
      const res = await api.get('/exams/matrices');
      const items = Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
      setMatrices(items);
      if (items.length > 0 && !selectedMatrixId) {
        setSelectedMatrixId(items[0].id.toString());
      }
    } catch (err) {
      console.error('Error loading matrices:', err);
    }
  };

  const handleDeleteMatrix = async (id) => {
    const isConfirmed = await confirm({
      title: 'Xóa ma trận đề thi',
      message: 'Bạn có chắc chắn muốn xóa ma trận này? Các đề đã sinh từ ma trận vẫn được giữ nguyên.',
      confirmText: 'Xóa ma trận',
      type: 'danger'
    });
    if (!isConfirmed) return;
    try {
      setDeletingMatrixId(id);
      await api.delete(`/exams/matrices/${id}`);
      const next = matrices.filter((m) => String(m.id) !== String(id));
      setMatrices(next);
      if (String(selectedMatrixId) === String(id)) setSelectedMatrixId(next[0]?.id?.toString() || '');
      toast.success('Đã xóa ma trận thành công');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể xóa ma trận.');
    } finally {
      setDeletingMatrixId(null);
    }
  };

  const countMatrixConfig = (cfg) => {
    let t = 0;
    (cfg?.chapters || []).forEach((c) => (c.topics || []).forEach((l) => (l.topics || []).forEach((tp) => Object.values(tp.difficulties || {}).forEach((v) => { t += parseInt(v || 0); }))));
    return t;
  };

  const toggleSelectQuestion = (id) => {
    setSelectedQuestionIds(prev =>
      prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
    );
  };

  const handleSelectBatchQuestions = (ids, shouldSelect) => {
    setSelectedQuestionIds(prev => {
      if (shouldSelect) {
        const set = new Set([...prev, ...ids]);
        return Array.from(set);
      } else {
        const toRemove = new Set(ids);
        return prev.filter(id => !toRemove.has(id));
      }
    });
  };

  // Tính toán tổng số câu và phân bổ theo 4 mức độ nhận thức
  const getMatrixBreakdown = () => {
    let nb = 0, th = 0, vd = 0, vdc = 0;
    chapters.forEach(chap => {
      (chap.topics || []).forEach(les => {
        (les.topics || []).forEach(top => {
          nb += parseInt(top.difficulties?.NHAN_BIET || 0);
          th += parseInt(top.difficulties?.THONG_HIEU || 0);
          vd += parseInt(top.difficulties?.VAN_DUNG || 0);
          vdc += parseInt(top.difficulties?.VAN_DUNG_CAO || 0);
        });
      });
    });
    const total = nb + th + vd + vdc;
    return {
      nb, th, vd, vdc, total,
      pctNb: total > 0 ? Math.round((nb / total) * 100) : 0,
      pctTh: total > 0 ? Math.round((th / total) * 100) : 0,
      pctVd: total > 0 ? Math.round((vd / total) * 100) : 0,
      pctVdc: total > 0 ? Math.round((vdc / total) * 100) : 0,
      pointPerQ: total > 0 ? (10 / total).toFixed(2) : 0
    };
  };

  const matrixStats = getMatrixBreakdown();

  const handleAddChapter = () => {
    const chapNames = Object.keys(gradeHierarchy);
    const unused = chapNames.find((n) => !chapters.some((c) => c.chapter === n));
    setChapters([
      ...chapters,
      {
        chapter: unused || `Chương ${chapters.length + 1}: Tên chương mới`,
        topics: [
          {
            topic: 'Bài 1: Nội dung trọng tâm',
            topics: [
              {
                topic: 'Dạng bài 1',
                difficulties: { NHAN_BIET: 0, THONG_HIEU: 0, VAN_DUNG: 0, VAN_DUNG_CAO: 0 }
              }
            ]
          }
        ]
      }
    ]);
  };

  const handleRemoveChapter = (cIdx) => {
    setChapters(chapters.filter((_, idx) => idx !== cIdx));
  };

  const handleAddLesson = (cIdx) => {
    const updated = [...chapters];
    updated[cIdx].topics.push({
      topic: `Bài ${updated[cIdx].topics.length + 1}`,
      topics: [
        {
          topic: 'Dạng bài 1',
          difficulties: { NHAN_BIET: 0, THONG_HIEU: 0, VAN_DUNG: 0, VAN_DUNG_CAO: 0 }
        }
      ]
    });
    setChapters(updated);
  };

  const handleRemoveLesson = (cIdx, lIdx) => {
    const updated = [...chapters];
    updated[cIdx].topics = updated[cIdx].topics.filter((_, idx) => idx !== lIdx);
    setChapters(updated);
  };

  const handleAddTopic = (cIdx, lIdx) => {
    const updated = [...chapters];
    updated[cIdx].topics[lIdx].topics.push({
      topic: `Chủ đề ${updated[cIdx].topics[lIdx].topics.length + 1}`,
      difficulties: { NHAN_BIET: 0, THONG_HIEU: 0, VAN_DUNG: 0, VAN_DUNG_CAO: 0 }
    });
    setChapters(updated);
  };

  const handleRemoveTopic = (cIdx, lIdx, tIdx) => {
    const updated = [...chapters];
    updated[cIdx].topics[lIdx].topics = updated[cIdx].topics[lIdx].topics.filter((_, idx) => idx !== tIdx);
    setChapters(updated);
  };

  // Lưu ma trận làm mẫu dùng lại
  const handleSaveMatrixOnly = async () => {
    if (!matrixName.trim()) {
      toast.warning('Vui lòng nhập tên ma trận đề thi.');
      return;
    }
    if (matrixStats.total === 0) {
      toast.warning('Ma trận phải có ít nhất 1 câu hỏi.');
      return;
    }
    try {
      setSaving(true);
      await api.post('/exams/matrices', {
        name: matrixName,
        description: matrixDesc,
        subject,
        grade_level: gradeLevel,
        matrix_config: { chapters }
      });
      toast.success('Đã lưu ma trận đề thi làm mẫu thành công!');
      await fetchMatrices();
      setActiveTab('matrix-select');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể lưu ma trận');
    } finally {
      setSaving(false);
    }
  };

  // Tạo đề thi & Sinh đề từ ma trận hoặc thủ công
  const handleCreateExamAndMatrix = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề bài thi.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      let targetMatrixId = selectedMatrixId;

      // Nếu tạo ma trận mới, lưu ma trận trước
      if (activeTab === 'matrix') {
        if (!matrixName.trim()) {
          setError('Vui lòng nhập tên ma trận đề thi.');
          setSaving(false);
          return;
        }

        if (matrixStats.total === 0) {
          setError('Ma trận phải có ít nhất 1 câu hỏi.');
          setSaving(false);
          return;
        }

        const matrixRes = await api.post('/exams/matrices', {
          name: matrixName,
          description: matrixDesc,
          subject,
          grade_level: gradeLevel,
          matrix_config: { chapters }
        });
        targetMatrixId = matrixRes.data?.id;
      }

      if (activeTab === 'matrix' || activeTab === 'matrix-select') {
        if (!targetMatrixId) {
          setError('Vui lòng chọn hoặc tạo ma trận đề thi.');
          setSaving(false);
          return;
        }

        const genPayload = {
          matrix_id: parseInt(targetMatrixId),
          title: title,
          duration_minutes: parseInt(duration),
          pass_score: parseFloat(passScore),
          max_attempts: parseInt(maxAttempts),
          show_answers_after_submit: showAnswers,
          is_published: true,
          number_of_versions: parseInt(numberOfVersions) || 1,
          code_prefix: (codePrefix || '10').trim(),
          shuffle_questions: Boolean(shuffleQuestions),
          shuffle_options: Boolean(shuffleOptions),
          independent_draw: Boolean(independentDraw)
        };

        const genRes = await api.post('/exams/matrices/generate', genPayload);
        const msg = genRes.data?.message || (numberOfVersions > 1 ? `Đã sinh thành công ${numberOfVersions} mã đề thi!` : 'Tạo đề thi thành công!');
        toast.success(msg);
      } else {
        if (selectedQuestionIds.length === 0) {
          setError('Vui lòng chọn ít nhất một câu hỏi cho đề thi thủ công.');
          setSaving(false);
          return;
        }
        await api.post('/exams', {
          title: title,
          duration_minutes: parseInt(duration),
          pass_score: parseFloat(passScore),
          max_attempts: parseInt(maxAttempts),
          show_answers_after_submit: showAnswers,
          question_ids: selectedQuestionIds
        });
        toast.success('Tạo đề thi thủ công thành công!');
      }

      await fetchExams();
      setActiveTab('repository');
    } catch (err) {
      console.error('Error creating exam:', err);
      setError(err.response?.data?.detail || 'Không thể tạo đề thi. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setSaving(false);
    }
  };

  const previewCodes = Array.from({ length: Math.min(numberOfVersions, 6) }).map((_, idx) => {
    const raw = codePrefix.trim();
    if (raw.match(/^\d+$/)) return `${raw}${idx + 1}`;
    return `${raw}${String(idx + 1).padStart(2, '0')}`;
  });

  return (
    <div className="min-h-screen bg-[#f8f9fe] font-sans pb-16">
      <Navbar />
      <div className="flex">
        <Sidebar role="teacher" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-pastel-purple/10 flex items-center justify-center text-pastel-purpleDark">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span>Thiết Kế Ma Trận & Sinh Đề Thi Trắc Nghiệm</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Tạo ma trận chuẩn 4 mức độ nhận thức của Bộ GD&ĐT, sinh hàng loạt mã đề thi xáo trộn câu và đáp án chống quay cóp.
              </p>
            </div>

            {/* Mode Tabs */}
            <div className="flex flex-wrap bg-white p-1.5 rounded-2xl border border-gray-200 shadow-xs gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('repository')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                  activeTab === 'repository' 
                    ? 'bg-gradient-to-r from-pastel-purple to-pastel-purpleDark text-white shadow-xs' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Archive className="w-4 h-4" />
                <span>Kho đề thi ({totalExams})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('matrix')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                  activeTab === 'matrix' 
                    ? 'bg-gradient-to-r from-pastel-purple to-pastel-purpleDark text-white shadow-xs' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Tạo ma trận mới</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('matrix-select')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                  activeTab === 'matrix-select' 
                    ? 'bg-gradient-to-r from-pastel-purple to-pastel-purpleDark text-white shadow-xs' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Mẫu ma trận có sẵn</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('manual')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                  activeTab === 'manual' 
                    ? 'bg-gradient-to-r from-pastel-purple to-pastel-purpleDark text-white shadow-xs' 
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Chọn câu hỏi thủ công</span>
              </button>
              <button
                type="button"
                onClick={() => setIsImportFileModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 bg-gradient-to-r from-pastel-purple to-indigo-600 hover:from-pastel-purpleDark hover:to-indigo-700 text-white shadow-xs interactive-btn"
                title="Tự động nhận diện câu hỏi từ tệp Word (.docx, .doc), PDF (.pdf), Markdown (.md)"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Nhập đề từ File</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs sm:text-sm font-medium flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="font-bold text-xs uppercase underline">Đóng</button>
            </div>
          )}

          {/* TAB 1: KHO ĐỀ THI (Chuyên biệt cho Đề thi, tách biệt Bài tập) */}
          {activeTab === 'repository' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Stats & Search Bar */}
              <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-xs flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-purple-50 text-pastel-purpleDark font-bold text-xs">
                    <Archive className="w-3.5 h-3.5" />
                    <span>Tổng số: {totalExams} đề thi</span>
                  </div>
                  <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Đã xuất bản: {exams.filter(e => e.is_published).length}</span>
                  </div>
                  <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 font-bold text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Bản nháp: {exams.filter(e => !e.is_published).length}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto">
                  {/* Status filter */}
                  <select
                    value={examStatusFilter}
                    onChange={(e) => setExamStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:border-pastel-purple"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="published">Đã xuất bản</option>
                    <option value="draft">Bản nháp</option>
                  </select>

                  {/* Search input */}
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm đề thi..."
                      value={examSearch}
                      onChange={(e) => {
                        setExamSearch(e.target.value);
                        setExamPage(1);
                      }}
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pastel-purple"
                    />
                  </div>

                  {/* Quick create button */}
                  <button
                    onClick={() => setActiveTab('matrix')}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-pastel-purple to-pastel-purpleDark text-white rounded-xl text-xs font-bold shadow-xs hover:opacity-95 transition whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tạo đề mới</span>
                  </button>
                </div>
              </div>

              {/* Exams Table */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                        <th className="p-4">Tiêu đề đề thi</th>
                        <th className="p-4">Thời gian</th>
                        <th className="p-4">Số lượng câu</th>
                        <th className="p-4">Điểm đạt</th>
                        <th className="p-4">Trạng thái</th>
                        <th className="p-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                      {loadingExams ? (
                        <tr>
                          <td colSpan="6" className="py-16 text-center text-gray-400">
                            Đang tải kho đề thi...
                          </td>
                        </tr>
                      ) : filteredExams.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-16 text-center text-gray-400">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <Archive className="w-8 h-8 text-gray-300" />
                              <span className="font-medium">Chưa có đề thi nào trong kho.</span>
                              <button
                                onClick={() => setActiveTab('matrix')}
                                className="text-xs font-bold text-pastel-purpleDark hover:underline mt-1"
                              >
                                + Thiết kế ma trận & sinh đề thi ngay
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredExams.map((exam) => (
                          <tr key={exam.id} className="hover:bg-gray-50/60 transition">
                            <td className="p-4">
                              <div className="font-bold text-gray-800 text-sm flex items-center space-x-2">
                                <span>{exam.title}</span>
                              </div>
                              <div className="text-[11px] text-gray-400 mt-0.5 flex items-center space-x-2">
                                <span>Mã ID: #{exam.id}</span>
                                {exam.created_at && (
                                  <span>• Tạo ngày: {new Date(exam.created_at).toLocaleDateString('vi-VN')}</span>
                                )}
                                {exam.description && (
                                  <span className="line-clamp-1 max-w-xs">• {exam.description}</span>
                                )}
                              </div>
                            </td>

                            <td className="p-4 text-xs font-semibold text-gray-600">
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3.5 h-3.5 text-gray-400" />
                                <span>{exam.duration_minutes} phút</span>
                              </div>
                            </td>

                            <td className="p-4 text-xs font-bold text-pastel-purpleDark">
                              {exam.question_count ?? exam.questions?.length ?? '-'} câu
                            </td>

                            <td className="p-4 text-xs text-gray-600 font-semibold">
                              {exam.pass_score ?? 5.0} / 10
                            </td>

                            <td className="p-4">
                              <button
                                onClick={() => handleTogglePublish(exam)}
                                className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold transition ${
                                  exam.is_published
                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                }`}
                                title="Bấm để bật/tắt xuất bản"
                              >
                                {exam.is_published ? (
                                  <CheckCircle2 className="w-3 h-3" />
                                ) : (
                                  <Clock className="w-3 h-3" />
                                )}
                                <span>{exam.is_published ? 'Đã xuất bản' : 'Bản nháp'}</span>
                              </button>
                            </td>

                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  onClick={() => handleOpenPreview(exam)}
                                  className="p-2 text-gray-500 hover:text-pastel-purpleDark hover:bg-purple-50 rounded-xl transition"
                                  title="Xem trước câu hỏi đề thi"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedExamForAssign(exam);
                                    setAssignmentModalOpen(true);
                                  }}
                                  className="inline-flex items-center space-x-1 px-3 py-1.5 bg-pastel-purple/10 text-pastel-purpleDark font-bold rounded-xl text-xs hover:bg-pastel-purple hover:text-white transition"
                                  title="Giao đề thi cho lớp học"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Giao đề</span>
                                </button>

                                <button
                                  onClick={() => handleOpenEdit(exam)}
                                  className="p-2 text-gray-400 hover:text-pastel-purpleDark hover:bg-gray-100 rounded-xl transition"
                                  title="Chỉnh sửa thông tin đề thi"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() => handleDeleteExam(exam)}
                                  className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                                  title="Xóa đề thi khỏi kho"
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

                {/* Pagination */}
                {totalExamPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-gray-100 text-xs text-gray-500">
                    <span>Trang {examPage} / {totalExamPages} (Tổng cộng {totalExams} đề thi)</span>
                    <div className="flex items-center space-x-2">
                      <button
                        disabled={examPage === 1}
                        onClick={() => setExamPage(p => Math.max(1, p - 1))}
                        className="px-3 py-1.5 border border-gray-200 rounded-xl font-bold disabled:opacity-40 hover:bg-gray-50 transition"
                      >
                        Trước
                      </button>
                      <button
                        disabled={examPage === totalExamPages}
                        onClick={() => setExamPage(p => Math.min(totalExamPages, p + 1))}
                        className="px-3 py-1.5 border border-gray-200 rounded-xl font-bold disabled:opacity-40 hover:bg-gray-50 transition"
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab !== 'repository' && (
          <form onSubmit={handleCreateExamAndMatrix} className="space-y-6">
            {/* 1. THÔNG TIN CHUNG BÀI KIỂM TRA */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-card space-y-4">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center space-x-2 border-b border-gray-100 pb-3">
                <span className="w-6 h-6 bg-pastel-purple/10 text-pastel-purpleDark rounded-lg flex items-center justify-center text-xs font-extrabold">1</span>
                <span>Thông tin chung bài kiểm tra</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Tiêu đề bài thi / đợt thi *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Ví dụ: Kiểm tra giữa kì 1 Toán 10"
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pastel-purple text-sm bg-gray-50/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Thời gian làm bài (phút)</label>
                  <input
                    type="number"
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
                    min="5"
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pastel-purple text-sm bg-gray-50/50 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Điểm đạt (Thang 10)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={passScore}
                    onChange={e => setPassScore(e.target.value)}
                    min="0"
                    max="10"
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pastel-purple text-sm bg-gray-50/50 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Số lần làm tối đa</label>
                  <input
                    type="number"
                    value={maxAttempts}
                    onChange={e => setMaxAttempts(e.target.value)}
                    min="1"
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pastel-purple text-sm bg-gray-50/50 font-bold"
                  />
                </div>

                <div className="flex items-center pt-2 md:col-span-3">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAnswers}
                      onChange={e => setShowAnswers(e.target.checked)}
                      className="rounded border-gray-300 text-pastel-purple focus:ring-pastel-purple w-5 h-5"
                    />
                    <span className="text-xs sm:text-sm font-semibold text-gray-700">
                      Cho phép học sinh xem đáp án và lời giải chi tiết sau khi nộp bài
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* 2. CẤU HÌNH SINH MÃ ĐỀ & CHỐNG GIAN LẬN (CHO CẢ TAB 1 VÀ TAB 2) */}
            {(activeTab === 'matrix' || activeTab === 'matrix-select') && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-card space-y-5">
                <div className="flex items-center space-x-3 pb-3 border-b border-gray-100">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-pastel-purpleDark flex items-center justify-center">
                    <Shuffle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-gray-900 text-sm sm:text-base">
                      Cấu hình Sinh Mã Đề & Xáo Trộn Đề Thi (Chống gian lận)
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Sinh hàng loạt mã đề thi khác nhau từ ma trận, xáo trộn thứ tự câu hỏi và thứ tự đáp án A, B, C, D
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Số lượng mã đề */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Số lượng mẫu đề / mã đề cần sinh
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {[1, 2, 4, 8].map(num => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setNumberOfVersions(num)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                            numberOfVersions === num
                              ? 'bg-pastel-purple text-white shadow-xs'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {num} đề
                        </button>
                      ))}
                      <div className="flex items-center space-x-1 pl-2">
                        <span className="text-xs text-gray-500 font-medium">Tùy chỉnh:</span>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={numberOfVersions}
                          onChange={e => setNumberOfVersions(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                          className="w-16 px-2.5 py-1.5 text-center font-bold text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-pastel-purple"
                        />
                        <span className="text-xs text-gray-500">đề</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Hệ thống hỗ trợ sinh tối đa 20 mã đề thi song song cho một đợt kiểm tra.
                    </p>
                  </div>

                  {/* Tiền tố mã đề */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Tiền tố mã đề
                    </label>
                    <input
                      type="text"
                      value={codePrefix}
                      onChange={e => setCodePrefix(e.target.value)}
                      placeholder="10 (Ví dụ: Mã 101, 102...)"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-pastel-purple"
                    />
                    <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5 flex-wrap">
                      <span>Mã đề dự kiến:</span>
                      <div className="flex flex-wrap gap-1">
                        {previewCodes.map((c, i) => (
                          <span key={i} className="px-2 py-0.5 bg-purple-50 text-pastel-purpleDark rounded-md font-mono font-bold text-[10px] border border-purple-100">
                            {c}
                          </span>
                        ))}
                        {numberOfVersions > 6 && <span className="text-gray-400 text-[10px]">...</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tùy chọn xáo trộn (Cards) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Đảo đáp án */}
                  <label className={`p-4 rounded-2xl border-2 flex items-start space-x-3.5 cursor-pointer transition ${
                    shuffleOptions ? 'border-pastel-purple bg-purple-50/40 text-gray-900 ring-1 ring-pastel-purple/20' : 'border-gray-200 bg-white text-gray-600'
                  }`}>
                    <input
                      type="checkbox"
                      checked={shuffleOptions}
                      onChange={e => setShuffleOptions(e.target.checked)}
                      className="mt-0.5 rounded text-pastel-purple focus:ring-pastel-purple w-4 h-4 shrink-0"
                    />
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-gray-900 flex items-center space-x-1.5">
                        <span>Đảo thứ tự đáp án (A, B, C, D)</span>
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">Khuyên dùng</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                        Tự động hoán vị ngẫu nhiên 4 phương án trắc nghiệm cho từng mã đề. Vị trí đáp án đúng tự động cập nhật chính xác cho hệ thống chấm bài.
                      </p>
                    </div>
                  </label>

                  {/* Đảo câu hỏi */}
                  <label className={`p-4 rounded-2xl border-2 flex items-start space-x-3.5 cursor-pointer transition ${
                    shuffleQuestions ? 'border-pastel-purple bg-purple-50/40 text-gray-900 ring-1 ring-pastel-purple/20' : 'border-gray-200 bg-white text-gray-600'
                  }`}>
                    <input
                      type="checkbox"
                      checked={shuffleQuestions}
                      onChange={e => setShuffleQuestions(e.target.checked)}
                      className="mt-0.5 rounded text-pastel-purple focus:ring-pastel-purple w-4 h-4 shrink-0"
                    />
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-gray-900 flex items-center space-x-1.5">
                        <span>Đảo thứ tự câu hỏi</span>
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">Khuyên dùng</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                        Xáo trộn vị trí các câu hỏi giữa các mã đề để các thí sinh ngồi cạnh nhau có thứ tự làm bài khác nhau hoàn toàn.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Phương thức bốc câu hỏi khi số đề > 1 */}
                {numberOfVersions > 1 && (
                  <div className="pt-3 border-t border-gray-100 space-y-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Quy chuẩn bốc câu hỏi giữa các mã đề
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className={`p-3.5 rounded-2xl border-2 cursor-pointer transition flex items-start space-x-3 ${
                        !independentDraw ? 'border-pastel-purple bg-purple-50/40' : 'border-gray-200 bg-white'
                      }`}>
                        <input
                          type="radio"
                          name="drawMode"
                          checked={!independentDraw}
                          onChange={() => setIndependentDraw(false)}
                          className="mt-0.5 text-pastel-purple focus:ring-pastel-purple"
                        />
                        <div>
                          <div className="text-xs font-bold text-gray-900 flex items-center space-x-1.5">
                            <span>Dùng chung 1 tổ hợp câu hỏi chuẩn</span>
                            <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">Chuẩn Bộ GD&ĐT</span>
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                            Tất cả các mã đề dùng chung một tập câu hỏi nhưng được đảo vị trí câu và đáp án. Đảm bảo độ khó và kiến thức công bằng $100\%$.
                          </div>
                        </div>
                      </label>

                      <label className={`p-3.5 rounded-2xl border-2 cursor-pointer transition flex items-start space-x-3 ${
                        independentDraw ? 'border-pastel-purple bg-purple-50/40' : 'border-gray-200 bg-white'
                      }`}>
                        <input
                          type="radio"
                          name="drawMode"
                          checked={independentDraw}
                          onChange={() => setIndependentDraw(true)}
                          className="mt-0.5 text-pastel-purple focus:ring-pastel-purple"
                        />
                        <div>
                          <div className="text-xs font-bold text-gray-900">Bốc câu hỏi độc lập từng đề</div>
                          <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                            Mỗi mã đề bốc ngẫu nhiên một bộ câu hỏi riêng biệt từ ngân hàng theo ma trận đã đặt. Phù hợp cho luyện tập tự do.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. TAB 1: THIẾT KẾ MA TRẬN MỚI (LÀM LẠI THEO CHUẨN MA TRẬN BỘ GD&ĐT) */}
            {activeTab === 'matrix' && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-card space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-3">
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center space-x-2">
                    <span className="w-6 h-6 bg-pastel-purple/10 text-pastel-purpleDark rounded-lg flex items-center justify-center text-xs font-extrabold">2</span>
                    <span>Thiết kế ma trận đề thi chuẩn 4 mức độ nhận thức</span>
                  </h2>
                  <div className="flex items-center space-x-2">
                    <span className="px-3.5 py-1 bg-purple-50 text-pastel-purpleDark rounded-full text-xs font-extrabold border border-purple-100">
                      Tổng: {matrixStats.total} câu ({matrixStats.pointPerQ}đ/câu)
                    </span>
                  </div>
                </div>

                {/* Matrix metadata */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Tên ma trận đề thi *</label>
                    <input
                      type="text"
                      value={matrixName}
                      onChange={e => setMatrixName(e.target.value)}
                      placeholder="Ví dụ: Ma trận kiểm tra giữa kì 1 - Khối 10"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pastel-purple text-sm bg-gray-50/50"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Môn học</label>
                    <select
                      value={subject}
                      onChange={e => { setSubject(e.target.value); setChapters([]); setError(null); }}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pastel-purple text-sm bg-white font-bold"
                    >
                      <option value="">-- Chọn môn --</option>
                      {(stats?.subjects || []).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Khối lớp</label>
                    <select
                      value={gradeLevel}
                      onChange={e => { setGradeLevel(e.target.value); setChapters([]); setError(null); }}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pastel-purple text-sm bg-white font-bold"
                    >
                      <option value="">-- Chọn khối --</option>
                      {(stats?.grades || []).map((g) => (
                        <option key={g} value={String(g)}>Lớp {g}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quick actions & Tree picker */}
                <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-2">
                      <Sliders className="w-4 h-4 text-pastel-purpleDark" />
                      <span className="text-xs font-bold text-gray-800">Công cụ hỗ trợ phân bổ ma trận tự động</span>
                    </div>
                    <span className="text-xs font-bold text-pastel-purpleDark bg-white px-3 py-1 rounded-full border border-purple-200">
                      Tồn kho DB {subject || '?'} Lớp {gradeLevel || '?'}: {getTotalAvailable()} câu
                    </span>
                  </div>

                  {/* Ratio Presets */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs text-gray-500 font-medium">Tỉ lệ chuẩn:</span>
                    <button
                      type="button"
                      onClick={() => handleAutoDistribute(autoTotal, [40, 30, 20, 10])}
                      disabled={loadingStats || getTotalAvailable() === 0}
                      className="px-3 py-1.5 bg-white border border-purple-200 text-pastel-purpleDark rounded-xl text-xs font-bold hover:bg-purple-50 shadow-2xs"
                    >
                      Chuẩn Bộ (40-30-20-10)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAutoDistribute(autoTotal, [30, 30, 30, 10])}
                      disabled={loadingStats || getTotalAvailable() === 0}
                      className="px-3 py-1.5 bg-white border border-purple-200 text-pastel-purpleDark rounded-xl text-xs font-bold hover:bg-purple-50 shadow-2xs"
                    >
                      ĐGNL (30-30-30-10)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAutoDistribute(autoTotal, [50, 40, 10, 0])}
                      disabled={loadingStats || getTotalAvailable() === 0}
                      className="px-3 py-1.5 bg-white border border-purple-200 text-pastel-purpleDark rounded-xl text-xs font-bold hover:bg-purple-50 shadow-2xs"
                    >
                      Cơ bản (50-40-10-0)
                    </button>

                    <div className="flex items-center space-x-1.5 bg-white border border-gray-200 rounded-xl px-2 py-1 ml-auto">
                      <span className="text-xs font-bold text-gray-600">Tổng câu:</span>
                      <input
                        type="number"
                        min="1"
                        value={autoTotal}
                        onChange={e => setAutoTotal(e.target.value)}
                        className="w-14 text-center font-bold text-xs bg-gray-50 border border-gray-200 rounded-lg py-0.5"
                      />
                      <button
                        type="button"
                        onClick={() => handleAutoDistribute(autoTotal)}
                        disabled={loadingStats || getTotalAvailable() === 0}
                        className="px-3 py-1 bg-pastel-purple text-white rounded-lg text-xs font-bold hover:bg-pastel-purpleDark"
                      >
                        Phân bổ đều
                      </button>
                    </div>
                  </div>

                  {/* Knowledge Tree Picker */}
                  {Object.keys(gradeHierarchy).length > 0 && (
                    <div className="bg-white rounded-2xl border border-purple-100 overflow-hidden mt-2">
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/80 border-b border-gray-100">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            value={pickerSearch}
                            onChange={(e) => setPickerSearch(e.target.value)}
                            placeholder="Tìm nhanh chương / bài / dạng bài..."
                            className="w-full pl-8 pr-2 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-pastel-purple"
                          />
                        </div>
                        <button type="button" onClick={expandAllPicker} className="text-[11px] font-bold text-gray-600 hover:text-pastel-purple px-1.5 py-1 whitespace-nowrap">Mở hết</button>
                        <button type="button" onClick={collapseAllPicker} className="text-[11px] font-bold text-gray-600 hover:text-pastel-purple px-1.5 py-1 whitespace-nowrap">Thu gọn</button>
                        <span className="text-[11px] text-pastel-purpleDark font-bold whitespace-nowrap">{pickerSelection.size} đã chọn</span>
                      </div>

                      <div className="max-h-[260px] overflow-y-auto py-1">
                        {Object.entries(gradeHierarchy).map(([chapName, lesMap], chapIdx) => {
                          const q = pickerSearch.trim().toLowerCase();
                          const lesEntries = Object.entries(lesMap || {}).map(([lesName, topics]) => {
                            const topEntries = Object.entries(topics || {}).filter(([topName]) => !q || chapName.toLowerCase().includes(q) || lesName.toLowerCase().includes(q) || topName.toLowerCase().includes(q));
                            return [lesName, topEntries];
                          }).filter(([, tops]) => tops.length > 0);
                          if (q && lesEntries.length === 0) return null;
                          const chapAvail = getChapterTotalAvail(chapName);
                          const chapKeys = [];
                          Object.keys(lesMap || {}).forEach((ln) => Object.keys(lesMap[ln] || {}).forEach((tn) => chapKeys.push(pickerKey(chapName, ln, tn))));
                          const chapChecked = chapKeys.length > 0 && chapKeys.every((k) => pickerSelection.has(k));
                          const chapPartial = !chapChecked && chapKeys.some((k) => pickerSelection.has(k));
                          const open = q ? true : isExpanded(`c:${chapName}`, chapIdx === 0);

                          return (
                            <div key={chapName}>
                              <div className="flex items-center gap-1 pl-1.5 pr-2 py-1.5 hover:bg-purple-50/70">
                                <button type="button" onClick={() => toggleExpand(`c:${chapName}`)} className="p-1 text-gray-500 hover:bg-gray-100 rounded-md shrink-0">
                                  {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                </button>
                                <input
                                  type="checkbox"
                                  checked={chapChecked}
                                  ref={(el) => { if (el) el.indeterminate = chapPartial; }}
                                  onChange={() => toggleChapterPicker(chapName)}
                                  className="w-3.5 h-3.5 rounded border-gray-300 text-pastel-purple shrink-0"
                                />
                                {open ? <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" /> : <Folder className="w-4 h-4 text-amber-500 shrink-0" />}
                                <span className="text-xs font-extrabold text-gray-800 flex-1 truncate">{chapName}</span>
                                <span className="text-[10px] font-bold text-pastel-purpleDark bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5 whitespace-nowrap">{chapAvail} câu</span>
                              </div>

                              {open && (
                                <div className="ml-[22px] pl-1 border-l border-gray-200">
                                  {lesEntries.map(([lesName, topEntries]) => {
                                    const lesAvail = getLessonTotalAvail(chapName, lesName);
                                    const lesKeys = Object.keys(lesMap[lesName] || {}).map((tn) => pickerKey(chapName, lesName, tn));
                                    const lesChecked = lesKeys.length > 0 && lesKeys.every((k) => pickerSelection.has(k));
                                    const lesPartial = !lesChecked && lesKeys.some((k) => pickerSelection.has(k));
                                    const lesOpen = q ? true : isExpanded(`l:${chapName}|||${lesName}`, false);

                                    return (
                                      <div key={lesName}>
                                        <div className="flex items-center gap-1 pl-1.5 pr-2 py-1.5 hover:bg-purple-50/70">
                                          <button type="button" onClick={() => toggleExpand(`l:${chapName}|||${lesName}`)} className="p-1 text-gray-500 hover:bg-gray-100 rounded-md shrink-0">
                                            {lesOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                          </button>
                                          <input
                                            type="checkbox"
                                            checked={lesChecked}
                                            ref={(el) => { if (el) el.indeterminate = lesPartial; }}
                                            onChange={() => toggleLessonPicker(chapName, lesName)}
                                            className="w-3.5 h-3.5 rounded border-gray-300 text-pastel-purple shrink-0"
                                          />
                                          {lesOpen ? <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" /> : <Folder className="w-4 h-4 text-amber-400 shrink-0" />}
                                          <span className="text-xs font-bold text-gray-700 flex-1 truncate">{lesName}</span>
                                          <span className="text-[10px] text-gray-500 font-bold whitespace-nowrap">{lesAvail} câu</span>
                                        </div>

                                        {lesOpen && (
                                          <div className="ml-[22px] pl-1 border-l border-gray-200">
                                            {topEntries.map(([topName, diffMap]) => {
                                              const k = pickerKey(chapName, lesName, topName);
                                              const checked = pickerSelection.has(k);
                                              const total = Object.values(diffMap || {}).reduce((s, v) => s + parseInt(v || 0), 0);
                                              const nb = parseInt(diffMap?.NHAN_BIET || 0);
                                              const th = parseInt(diffMap?.THONG_HIEU || 0);
                                              const vd = parseInt(diffMap?.VAN_DUNG || 0);
                                              const vdc = parseInt(diffMap?.VAN_DUNG_CAO || 0);

                                              return (
                                                <label key={k} className={`flex items-center gap-1.5 pl-1.5 pr-2 py-1.5 cursor-pointer hover:bg-purple-50/70 ${checked ? 'bg-purple-50/60' : ''}`}>
                                                  <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => togglePicker(k)}
                                                    className="w-3.5 h-3.5 rounded border-gray-300 text-pastel-purple shrink-0"
                                                  />
                                                  <File className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                                  <span className="text-xs text-gray-700 font-medium flex-1 truncate">{topName}</span>
                                                  <span className="text-[10px] text-gray-500 font-bold whitespace-nowrap">
                                                    {total} câu (NB:{nb} TH:{th} VD:{vd} VDC:{vdc})
                                                  </span>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleAddPicked}
                      disabled={pickerSelection.size === 0}
                      className="px-4 py-2 bg-pastel-purple text-white rounded-xl text-xs font-bold hover:bg-pastel-purpleDark disabled:opacity-40 flex items-center gap-1.5 shadow-2xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Thêm {pickerSelection.size} mục đã tích vào ma trận</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddAllFromDB}
                      disabled={loadingStats || Object.keys(gradeHierarchy).length === 0}
                      className="px-4 py-2 bg-white border border-purple-200 text-pastel-purpleDark rounded-xl text-xs font-bold hover:bg-purple-50 disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <Layers className="w-4 h-4" />
                      <span>Thêm tất cả chương trong ngân hàng</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddChapter}
                      className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100 flex items-center gap-1.5 ml-auto"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Thêm chương thủ công</span>
                    </button>
                  </div>
                </div>

                {/* THE MATRIX TABLE - Clean Grid View per chapter */}
                {chapters.length === 0 ? (
                  <div className="p-12 text-center border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50 space-y-3">
                    <Layers className="w-10 h-10 text-gray-300 mx-auto" />
                    <p className="text-sm font-semibold text-gray-600">Chưa có chương hoặc chủ đề nào trong ma trận</p>
                    <p className="text-xs text-gray-400">Chọn các chủ đề từ cây ngân hàng câu hỏi phía trên hoặc bấm nút thêm chương để bắt đầu.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {chapters.map((chap, cIdx) => {
                      const chapTotal = (chap.topics || []).reduce((s, l) => s + (l.topics || []).reduce((s2, t) => s2 + Object.values(t.difficulties || {}).reduce((a, v) => a + parseInt(v || 0), 0), 0), 0);

                      return (
                        <div key={cIdx} className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
                          {/* Chapter Header */}
                          <div className="p-4 bg-gray-50/90 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center space-x-2.5 flex-1 min-w-[240px]">
                              <span className="w-6 h-6 rounded-lg bg-pastel-purple text-white text-xs font-extrabold flex items-center justify-center shrink-0">
                                {cIdx + 1}
                              </span>
                              <input
                                type="text"
                                value={chap.chapter}
                                onChange={e => {
                                  const updated = [...chapters];
                                  updated[cIdx].chapter = e.target.value;
                                  setChapters(updated);
                                }}
                                className="font-extrabold text-sm text-gray-900 bg-white px-3.5 py-1.5 rounded-xl border border-gray-200 flex-1 focus:outline-none focus:border-pastel-purple"
                                placeholder="Tên chương học..."
                              />
                            </div>

                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-extrabold text-pastel-purpleDark bg-purple-50 px-3 py-1 rounded-full border border-purple-100">
                                {chapTotal} câu hỏi
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddLesson(cIdx)}
                                className="px-3 py-1 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100"
                              >
                                + Thêm bài
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveChapter(cIdx)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                title="Xóa chương"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Lessons and Topic Matrix Table */}
                          <div className="p-4 space-y-4">
                            {chap.topics.map((les, lIdx) => (
                              <div key={lIdx} className="bg-gray-50/50 rounded-2xl border border-gray-100 p-3.5 space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center space-x-2 flex-1">
                                    <span className="text-xs font-bold text-gray-400">Bài:</span>
                                    <input
                                      type="text"
                                      value={les.topic}
                                      onChange={e => {
                                        const updated = [...chapters];
                                        updated[cIdx].topics[lIdx].topic = e.target.value;
                                        setChapters(updated);
                                      }}
                                      className="font-bold text-xs text-gray-800 bg-white px-3 py-1.5 rounded-xl border border-gray-200 flex-1 focus:outline-none focus:border-pastel-purple"
                                      placeholder="Tên bài học..."
                                    />
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => handleAddTopic(cIdx, lIdx)}
                                      className="px-2.5 py-1 bg-white border border-purple-200 text-pastel-purpleDark rounded-lg text-[11px] font-bold hover:bg-purple-50"
                                    >
                                      + Dạng bài
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveLesson(cIdx, lIdx)}
                                      className="text-gray-400 hover:text-rose-600 p-1"
                                      title="Xóa bài"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Table of Topics / Dạng bài */}
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs">
                                    <thead>
                                      <tr className="text-gray-500 font-bold border-b border-gray-200 pb-2">
                                        <th className="py-2 px-2 font-bold min-w-[200px]">Dạng bài / Yêu cầu cần đạt</th>
                                        <th className="py-2 px-2 text-center text-emerald-700">Nhận biết (NB)</th>
                                        <th className="py-2 px-2 text-center text-blue-700">Thông hiểu (TH)</th>
                                        <th className="py-2 px-2 text-center text-amber-700">Vận dụng (VD)</th>
                                        <th className="py-2 px-2 text-center text-rose-700">Vận dụng cao (VDC)</th>
                                        <th className="py-2 px-2 text-center font-bold">Tổng</th>
                                        <th className="py-2 px-2 text-right"></th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {les.topics.map((top, tIdx) => {
                                        const topRowTotal = Object.values(top.difficulties || {}).reduce((s, v) => s + parseInt(v || 0), 0);

                                        return (
                                          <tr key={tIdx} className="hover:bg-white/80 transition">
                                            <td className="py-2 px-2">
                                              <input
                                                type="text"
                                                value={top.topic}
                                                onChange={e => {
                                                  const updated = [...chapters];
                                                  updated[cIdx].topics[lIdx].topics[tIdx].topic = e.target.value;
                                                  setChapters(updated);
                                                }}
                                                className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium focus:outline-none focus:border-pastel-purple"
                                                placeholder="Nội dung chi tiết..."
                                              />
                                            </td>

                                            {/* 4 Difficulties Inputs */}
                                            {[
                                              ['NHAN_BIET', 'border-emerald-200 focus:border-emerald-500 text-emerald-800'],
                                              ['THONG_HIEU', 'border-blue-200 focus:border-blue-500 text-blue-800'],
                                              ['VAN_DUNG', 'border-amber-200 focus:border-amber-500 text-amber-800'],
                                              ['VAN_DUNG_CAO', 'border-rose-200 focus:border-rose-500 text-rose-800'],
                                            ].map(([dk, colorClass]) => {
                                              const avail = getTopicAvailable(chap.chapter, les.topic, top.topic, dk);
                                              const val = top.difficulties?.[dk] ?? 0;
                                              const isOver = val > avail && avail > 0;

                                              return (
                                                <td key={dk} className="py-2 px-2 text-center">
                                                  <div className="flex flex-col items-center">
                                                    <input
                                                      type="number"
                                                      min="0"
                                                      value={val}
                                                      onChange={e => {
                                                        const updated = [...chapters];
                                                        const v = Math.max(0, parseInt(e.target.value) || 0);
                                                        updated[cIdx].topics[lIdx].topics[tIdx].difficulties[dk] = v;
                                                        setChapters(updated);
                                                      }}
                                                      className={`w-14 text-center font-extrabold text-xs py-1 rounded-lg border bg-white ${colorClass} ${
                                                        isOver ? 'ring-2 ring-rose-500 bg-rose-50' : ''
                                                      }`}
                                                    />
                                                    <span className={`text-[10px] mt-0.5 font-semibold ${isOver ? 'text-rose-600 font-bold' : 'text-gray-400'}`}>
                                                      kho: {avail}
                                                    </span>
                                                  </div>
                                                </td>
                                              );
                                            })}

                                            <td className="py-2 px-2 text-center font-extrabold text-gray-800">
                                              {topRowTotal}
                                            </td>

                                            <td className="py-2 px-2 text-right">
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveTopic(cIdx, lIdx, tIdx)}
                                                className="text-gray-300 hover:text-rose-500 p-1"
                                                title="Xóa dạng bài"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* MATRIX SUMMARY BAR (Bảng tổng kết ma trận) */}
                <div className="p-6 bg-gradient-to-r from-purple-50/80 via-white to-purple-50/80 rounded-3xl border border-purple-100 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-purple-100">
                    <h3 className="font-extrabold text-gray-900 text-sm flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-pastel-purpleDark" />
                      <span>Tổng kết cấu trúc phân bổ ma trận đề thi</span>
                    </h3>
                    <span className="text-xs text-gray-500 font-medium">Thang điểm chuẩn: 10.0 điểm</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-2xs">
                      <div className="text-[11px] font-bold text-emerald-700 uppercase">Nhận biết (NB)</div>
                      <div className="text-xl font-extrabold text-gray-900 mt-1">{matrixStats.nb} câu</div>
                      <div className="text-[11px] text-gray-500 font-semibold mt-0.5">
                        {matrixStats.pctNb}% • {(matrixStats.nb * matrixStats.pointPerQ).toFixed(1)}đ
                      </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-blue-100 shadow-2xs">
                      <div className="text-[11px] font-bold text-blue-700 uppercase">Thông hiểu (TH)</div>
                      <div className="text-xl font-extrabold text-gray-900 mt-1">{matrixStats.th} câu</div>
                      <div className="text-[11px] text-gray-500 font-semibold mt-0.5">
                        {matrixStats.pctTh}% • {(matrixStats.th * matrixStats.pointPerQ).toFixed(1)}đ
                      </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-amber-100 shadow-2xs">
                      <div className="text-[11px] font-bold text-amber-700 uppercase">Vận dụng (VD)</div>
                      <div className="text-xl font-extrabold text-gray-900 mt-1">{matrixStats.vd} câu</div>
                      <div className="text-[11px] text-gray-500 font-semibold mt-0.5">
                        {matrixStats.pctVd}% • {(matrixStats.vd * matrixStats.pointPerQ).toFixed(1)}đ
                      </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-rose-100 shadow-2xs">
                      <div className="text-[11px] font-bold text-rose-700 uppercase">Vận dụng cao (VDC)</div>
                      <div className="text-xl font-extrabold text-gray-900 mt-1">{matrixStats.vdc} câu</div>
                      <div className="text-[11px] text-gray-500 font-semibold mt-0.5">
                        {matrixStats.pctVdc}% • {(matrixStats.vdc * matrixStats.pointPerQ).toFixed(1)}đ
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between pt-2 gap-3 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-gray-900 text-sm">
                        Tổng cộng: {matrixStats.total} câu hỏi
                      </span>
                      <span>•</span>
                      <span className="font-semibold text-pastel-purpleDark">
                        {matrixStats.pointPerQ} điểm / mỗi câu
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveMatrixOnly}
                      disabled={saving || matrixStats.total === 0}
                      className="px-4 py-2 bg-white border border-purple-200 text-pastel-purpleDark rounded-xl text-xs font-bold hover:bg-purple-50 transition flex items-center space-x-1.5 shadow-2xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Lưu ma trận làm mẫu dùng lại</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 4. TAB 2: CHỌN MA TRẬN CÓ SẴN TỪ HỆ THỐNG */}
            {activeTab === 'matrix-select' && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-card space-y-6">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center space-x-2">
                    <span className="w-6 h-6 bg-pastel-purple/10 text-pastel-purpleDark rounded-lg flex items-center justify-center text-xs font-extrabold">2</span>
                    <span>Chọn ma trận đề thi đã lưu</span>
                  </h2>
                  <span className="text-xs font-bold text-gray-400">{matrices.length} ma trận khả dụng</span>
                </div>

                <div className="space-y-4">
                  <div className="max-w-2xl space-y-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase">Chọn ma trận áp dụng *</label>
                    <select
                      value={selectedMatrixId}
                      onChange={e => setSelectedMatrixId(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pastel-purple text-sm bg-white font-bold"
                    >
                      <option value="">-- Chọn ma trận --</option>
                      {matrices.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.total_questions ?? countMatrixConfig(m.matrix_config)} câu - Môn {m.subject} Lớp {m.grade_level})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Matrix List Viewer */}
                  <div className="pt-2 border-t border-gray-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-pastel-purpleDark" />
                        <span>Danh sách ma trận mẫu</span>
                      </h3>
                      <div className="relative w-64">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          value={matrixSearch}
                          onChange={(e) => setMatrixSearch(e.target.value)}
                          placeholder="Tìm ma trận..."
                          className="w-full pl-8 pr-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-pastel-purple"
                        />
                      </div>
                    </div>

                    {matrices.length === 0 ? (
                      <div className="text-center py-8 text-xs text-gray-400 border border-dashed border-gray-200 rounded-2xl">
                        Chưa có ma trận mẫu nào. Chuyển sang tab "Tạo ma trận mới" để thiết lập.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
                        {matrices
                          .filter((m) => {
                            const q = matrixSearch.trim().toLowerCase();
                            return !q || (m.name || '').toLowerCase().includes(q) || (m.subject || '').toLowerCase().includes(q);
                          })
                          .map((m) => {
                            const total = m.total_questions ?? countMatrixConfig(m.matrix_config);
                            const isSel = String(selectedMatrixId) === String(m.id);

                            return (
                              <div
                                key={m.id}
                                onClick={() => setSelectedMatrixId(String(m.id))}
                                className={`p-4 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between ${
                                  isSel 
                                    ? 'border-pastel-purple bg-purple-50/50 shadow-xs ring-1 ring-pastel-purple/20' 
                                    : 'border-gray-200 bg-white hover:border-purple-200'
                                }`}
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-extrabold text-sm text-gray-900 line-clamp-1">{m.name}</h4>
                                    {isSel && (
                                      <span className="text-[10px] bg-pastel-purple text-white px-2 py-0.5 rounded-full font-bold shrink-0">
                                        Đang chọn
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs">
                                    <span className="px-2 py-0.5 bg-gray-100 rounded-md font-semibold text-gray-700">
                                      {m.subject} • Lớp {m.grade_level}
                                    </span>
                                    <span className="px-2 py-0.5 bg-purple-100 text-pastel-purpleDark rounded-md font-bold">
                                      {total} câu hỏi
                                    </span>
                                  </div>
                                  {m.description && (
                                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{m.description}</p>
                                  )}
                                </div>

                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-[11px]">
                                  <span className="text-gray-400">
                                    {m.created_at ? new Date(m.created_at).toLocaleDateString('vi-VN') : ''}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteMatrix(m.id);
                                    }}
                                    disabled={deletingMatrixId === m.id}
                                    className="p-1 text-gray-400 hover:text-rose-600 rounded-md"
                                    title="Xóa ma trận"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 5. TAB 3: CHỌN CÂU HỎI THỦ CÔNG (Giao diện Thư mục máy tính / File Explorer) */}
            {activeTab === 'manual' && (
              <div className="space-y-4">
                <ManualQuestionExplorer
                  questions={questions}
                  selectedQuestionIds={selectedQuestionIds}
                  onToggleSelect={toggleSelectQuestion}
                  onSelectBatch={handleSelectBatchQuestions}
                />
              </div>
            )}

            {/* Bottom Submit Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/teacher/assignments')}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition"
              >
                Hủy bỏ
              </button>

              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-pastel-purple to-pastel-purpleDark text-white text-sm font-extrabold hover:opacity-95 transition shadow-sm hover:shadow flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                <span>
                  {saving 
                    ? 'Đang xử lý & Sinh đề...' 
                    : activeTab === 'manual' 
                    ? `Tạo đề từ ${selectedQuestionIds.length} câu đã chọn` 
                    : numberOfVersions > 1 
                    ? `Tạo ma trận & Sinh ${numberOfVersions} mã đề thi` 
                    : 'Tạo ma trận & Xuất bản đề thi'
                  }
                </span>
              </button>
            </div>
          </form>
          )}

          {/* Modal Giao đề thi */}
          <AssignmentModal
            exam={selectedExamForAssign}
            exams={exams}
            examType="EXAM"
            isOpen={assignmentModalOpen}
            onClose={() => setAssignmentModalOpen(false)}
            onAssigned={() => {
              fetchExams();
              setActiveTab('repository');
            }}
          />

          {/* Modal Xem chi tiết / Xem trước đề thi */}
          <Modal
            isOpen={previewModalOpen}
            onClose={() => {
              setPreviewModalOpen(false);
              setPreviewExam(null);
            }}
            title={previewExam ? `Chi tiết đề thi: ${previewExam.title}` : 'Xem trước đề thi'}
            size="xl"
          >
            {loadingPreview ? (
              <div className="py-16 text-center text-gray-400">Đang tải nội dung đề thi...</div>
            ) : !previewExam ? (
              <div className="py-16 text-center text-gray-400">Không tìm thấy thông tin đề thi.</div>
            ) : (
              <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">
                <div className="flex flex-wrap gap-2.5 p-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-semibold text-gray-600">
                  <span className="px-2.5 py-1 bg-white rounded-lg border border-gray-200">
                    Thời gian: <strong>{previewExam.duration_minutes} phút</strong>
                  </span>
                  <span className="px-2.5 py-1 bg-white rounded-lg border border-gray-200">
                    Số câu: <strong>{previewExam.questions?.length || 0} câu</strong>
                  </span>
                  <span className="px-2.5 py-1 bg-white rounded-lg border border-gray-200">
                    Điểm đạt: <strong>{previewExam.pass_score ?? 5.0} / 10</strong>
                  </span>
                  <span className="px-2.5 py-1 bg-white rounded-lg border border-gray-200">
                    Trạng thái: <strong>{previewExam.is_published ? 'Đã xuất bản' : 'Bản nháp'}</strong>
                  </span>
                </div>

                <div className="space-y-4">
                  {(previewExam.questions || []).map((q, idx) => {
                    const optList = Array.isArray(q.options)
                      ? q.options
                      : typeof q.options === 'string'
                      ? JSON.parse(q.options || '[]')
                      : [];
                    const diffLabels = {
                      NHAN_BIET: { label: 'Nhận biết', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                      THONG_HIEU: { label: 'Thông hiểu', color: 'bg-blue-50 text-blue-700 border-blue-100' },
                      VAN_DUNG: { label: 'Vận dụng', color: 'bg-amber-50 text-amber-700 border-amber-100' },
                      VAN_DUNG_CAO: { label: 'Vận dụng cao', color: 'bg-rose-50 text-rose-700 border-rose-100' }
                    };
                    const diffConfig = diffLabels[q.difficulty] || { label: q.difficulty || 'Mức độ', color: 'bg-gray-50 text-gray-600 border-gray-200' };

                    return (
                      <div key={q.id || idx} className="p-4 bg-white border border-gray-200 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="font-extrabold text-gray-800 text-sm">Câu {idx + 1}</span>
                            <span className={`px-2 py-0.5 rounded-lg border font-bold text-[10px] ${diffConfig.color}`}>
                              {diffConfig.label}
                            </span>
                          </div>
                          <span className="text-gray-400 font-medium">Mã ID: #{q.id}</span>
                        </div>

                        <div className="text-sm text-gray-800 leading-relaxed">
                          <MathRenderer content={q.content || ''} />
                        </div>

                        {optList.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {optList.map((opt, optIdx) => {
                              const isCorrect = q.correct_option === optIdx;
                              return (
                                <div
                                  key={optIdx}
                                  className={`p-2.5 rounded-xl border text-xs font-medium flex items-start space-x-2 ${
                                    isCorrect
                                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 font-semibold'
                                      : 'bg-gray-50 border-gray-200 text-gray-700'
                                  }`}
                                >
                                  <span className="w-5 h-5 rounded-lg bg-white border flex items-center justify-center font-bold text-[11px] shrink-0">
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <div className="flex-1 pt-0.5">
                                    <MathRenderer content={opt} />
                                  </div>
                                  {isCorrect && (
                                    <Check className="w-4 h-4 text-emerald-600 shrink-0 ml-1" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {q.explanation && (
                          <div className="p-3 bg-pastel-purple/5 border border-pastel-purple/20 rounded-xl text-xs text-gray-700 mt-2">
                            <span className="font-bold text-pastel-purpleDark mr-1">Lời giải chi tiết:</span>
                            <MathRenderer content={q.explanation} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Modal>

          {/* Modal Chỉnh sửa đề thi */}
          <Modal
            isOpen={editModalOpen}
            onClose={() => {
              setEditModalOpen(false);
              setSelectedExamForEdit(null);
            }}
            title="Chỉnh sửa thông tin đề thi"
            size="md"
          >
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">Tiêu đề đề thi *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-pastel-purple"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">Thời gian (phút)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pastel-purple"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">Điểm đạt (0 - 10)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    required
                    value={editPassScore}
                    onChange={(e) => setEditPassScore(e.target.value)}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pastel-purple"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">Số lần làm tối đa</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={editMaxAttempts}
                  onChange={(e) => setEditMaxAttempts(e.target.value)}
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-pastel-purple"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center space-x-2 text-xs sm:text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editShowAnswers}
                    onChange={(e) => setEditShowAnswers(e.target.checked)}
                    className="rounded border-gray-300 text-pastel-purple focus:ring-pastel-purple"
                  />
                  <span className="font-medium text-gray-700">Cho học sinh xem đáp án sau khi nộp</span>
                </label>

                <label className="flex items-center space-x-2 text-xs sm:text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editPublished}
                    onChange={(e) => setEditPublished(e.target.checked)}
                    className="rounded border-gray-300 text-pastel-purple focus:ring-pastel-purple"
                  />
                  <span className="font-medium text-gray-700">Xuất bản đề thi ngay</span>
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-gradient-to-r from-pastel-purple to-pastel-purpleDark text-white rounded-xl text-xs sm:text-sm font-bold hover:opacity-95 disabled:opacity-50 transition shadow-sm"
                >
                  {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </Modal>

          {/* Import File Modal (Word, PDF, Markdown) */}
          <ImportFileModal
            isOpen={isImportFileModalOpen}
            onClose={() => setIsImportFileModalOpen(false)}
            onSuccess={() => {
              loadQuestions();
            }}
          />
        </main>
      </div>
    </div>
  );
}
