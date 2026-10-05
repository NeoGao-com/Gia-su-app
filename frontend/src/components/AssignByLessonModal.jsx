import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Modal } from './Modal';
import { MathRenderer } from './MathRenderer';
import { 
  BookOpen, Sparkles, CheckSquare, Square, Calendar, 
  Clock, RotateCcw, AlertCircle, Layers, Check 
} from 'lucide-react';

export function AssignByLessonModal({ isOpen, onClose, onSuccess, defaultClassroomId }) {
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(defaultClassroomId || '');
  
  // Tree selection state
  const [treeData, setTreeData] = useState({});
  const [loadingTree, setLoadingTree] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('Toán');
  const [selectedGrade, setSelectedGrade] = useState('Khối 10');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedLesson, setSelectedLesson] = useState('');

  // Questions in selected lesson
  const [lessonQuestions, setLessonQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [selectionMode, setSelectionMode] = useState('count'); // 'count' | 'manual'
  const [questionCount, setQuestionCount] = useState(10);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);

  // Assignment configuration
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [dueDate, setDueDate] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [showAnswers, setShowAnswers] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Load classrooms and tree structure when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSelectedQuestionIds([]);

    const loadInitialData = async () => {
      setLoadingTree(true);
      try {
        const [classRes, treeRes] = await Promise.all([
          api.get('/classrooms', { params: { limit: 100 } }),
          api.get('/questions/tree/structure')
        ]);
        const classes = Array.isArray(classRes.data?.items)
          ? classRes.data.items
          : Array.isArray(classRes.data)
            ? classRes.data
            : [];
        setClassrooms(classes);
        if (!selectedClassId && classes.length > 0) {
          setSelectedClassId(String(classes[0].id));
        }

        const tree = treeRes.data || {};
        setTreeData(tree);

        // Auto select first available subject and grade
        const subjects = Object.keys(tree);
        const subj = subjects.includes('Toán') ? 'Toán' : subjects[0] || 'Toán';
        setSelectedSubject(subj);

        const grades = tree[subj] ? Object.keys(tree[subj]) : [];
        const grade = grades.includes('Khối 10') ? 'Khối 10' : grades[0] || 'Khối 10';
        setSelectedGrade(grade);

        const chapters = tree[subj]?.[grade] ? Object.keys(tree[subj][grade]) : [];
        const chap = chapters[0] || '';
        setSelectedChapter(chap);

        const lessons = tree[subj]?.[grade]?.[chap] ? Object.keys(tree[subj][grade][chap]) : [];
        const less = lessons[0] || '';
        setSelectedLesson(less);
      } catch (err) {
        console.error('Error loading tree data:', err);
      } finally {
        setLoadingTree(false);
      }
    };

    loadInitialData();
  }, [isOpen]);

  // When chapter changes, update lesson options
  useEffect(() => {
    if (!selectedChapter) {
      setSelectedLesson('');
      return;
    }
    const lessons = treeData[selectedSubject]?.[selectedGrade]?.[selectedChapter]
      ? Object.keys(treeData[selectedSubject][selectedGrade][selectedChapter])
      : [];
    if (!lessons.includes(selectedLesson)) {
      setSelectedLesson(lessons[0] || '');
    }
  }, [selectedChapter, selectedSubject, selectedGrade, treeData]);

  // Load questions when selected lesson changes
  useEffect(() => {
    if (!selectedLesson || !selectedChapter) {
      setLessonQuestions([]);
      return;
    }

    const loadQuestions = async () => {
      setLoadingQuestions(true);
      try {
        const gradeNum = parseInt(selectedGrade.replace(/\D/g, '')) || 10;
        const res = await api.get('/questions', {
          params: {
            subject: selectedSubject,
            grade_level: gradeNum,
            chapter: selectedChapter,
            lesson: selectedLesson,
            limit: 100
          }
        });
        const items = res.data.items || res.data || [];
        setLessonQuestions(items);

        // Auto suggest title
        const currentClass = classrooms.find(c => String(c.id) === String(selectedClassId));
        const className = currentClass ? currentClass.name : '';
        setTitle(`Bài tập: ${selectedLesson}${className ? ` - Lớp ${className}` : ''}`);
        
        // Auto set default question count
        setQuestionCount(Math.min(items.length || 10, 10));
      } catch (err) {
        console.error('Error fetching questions for lesson:', err);
        setLessonQuestions([]);
      } finally {
        setLoadingQuestions(false);
      }
    };

    loadQuestions();
  }, [selectedLesson, selectedChapter, selectedSubject, selectedGrade, selectedClassId, classrooms]);

  if (!isOpen) return null;

  const subjects = Object.keys(treeData);
  const grades = treeData[selectedSubject] ? Object.keys(treeData[selectedSubject]) : [];
  const chapters = treeData[selectedSubject]?.[selectedGrade] ? Object.keys(treeData[selectedSubject][selectedGrade]) : [];
  const lessons = treeData[selectedSubject]?.[selectedGrade]?.[selectedChapter] ? Object.keys(treeData[selectedSubject][selectedGrade][selectedChapter]) : [];

  const toggleQuestionSelection = (qid) => {
    setSelectedQuestionIds(prev => 
      prev.includes(qid) ? prev.filter(id => id !== qid) : [...prev, qid]
    );
  };

  const selectAllQuestions = () => {
    if (selectedQuestionIds.length === lessonQuestions.length) {
      setSelectedQuestionIds([]);
    } else {
      setSelectedQuestionIds(lessonQuestions.map(q => q.id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClassId) {
      setError('Vui lòng chọn lớp học nhận bài tập.');
      return;
    }
    if (!selectedLesson) {
      setError('Vui lòng chọn bài học trên lớp.');
      return;
    }
    if (selectionMode === 'manual' && selectedQuestionIds.length === 0) {
      setError('Vui lòng chọn ít nhất 1 câu hỏi từ bài học.');
      return;
    }
    if (selectionMode === 'count' && (!questionCount || questionCount <= 0)) {
      setError('Số lượng câu hỏi phải lớn hơn 0.');
      return;
    }
    if (openDate && dueDate && new Date(openDate) > new Date(dueDate)) {
      setError('Thời gian mở đề phải trước hạn nộp.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const gradeNum = parseInt(selectedGrade.replace(/\D/g, '')) || 10;
      
      const payload = {
        classroom_id: parseInt(selectedClassId),
        title: title.trim() || `Bài tập: ${selectedLesson}`,
        description: description.trim() || `Bài tập theo bài học ${selectedLesson} (${selectedChapter})`,
        subject: selectedSubject,
        grade_level: gradeNum,
        chapter: selectedChapter,
        lesson: selectedLesson,
        question_ids: selectionMode === 'manual' ? selectedQuestionIds : null,
        question_count: selectionMode === 'count' ? parseInt(questionCount) : null,
        duration_minutes: parseInt(durationMinutes) || 45,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        open_date: openDate ? new Date(openDate).toISOString() : null,
        max_attempts: parseInt(maxAttempts) || 1,
        show_answers_after_submit: showAnswers
      };

      await api.post(`/classrooms/${selectedClassId}/assign-by-lesson`, payload);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Lỗi khi giao bài tập theo bài học');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Giao bài tập theo bài học trên lớp" size="xl">
      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs sm:text-sm flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Step 1: Chọn lớp học */}
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            1. Chọn lớp học nhận bài tập *
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
          >
            <option value="">-- Chọn lớp học --</option>
            {classrooms.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name} (Mã: {cls.code || cls.id})
              </option>
            ))}
          </select>
        </div>

        {/* Step 2: Chọn bài học từ Cây kiến thức */}
        <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-3">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
              2. Chọn bài học trong chương trình
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Môn học</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-600 text-slate-800"
              >
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Khối lớp</label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-600 text-slate-800"
              >
                {grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Chương</label>
              <select
                value={selectedChapter}
                onChange={(e) => setSelectedChapter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-600 text-slate-800"
              >
                {chapters.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Bài học trên lớp *</label>
              <select
                value={selectedLesson}
                onChange={(e) => setSelectedLesson(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl text-xs font-bold text-indigo-700 focus:outline-none focus:border-indigo-600"
              >
                {lessons.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Step 3: Chọn câu hỏi trong bài học */}
        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                3. Danh sách câu hỏi ({lessonQuestions.length} câu có sẵn)
              </h4>
            </div>

            {/* Mode selection tabs */}
            <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setSelectionMode('count')}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${selectionMode === 'count' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Ngẫu nhiên theo số lượng
              </button>
              <button
                type="button"
                onClick={() => setSelectionMode('manual')}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${selectionMode === 'manual' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Tự chọn từng câu ({selectedQuestionIds.length})
              </button>
            </div>
          </div>

          {loadingQuestions ? (
            <div className="text-center py-6 text-xs text-slate-400">Đang tải câu hỏi của bài học...</div>
          ) : lessonQuestions.length === 0 ? (
            <div className="text-center py-6 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
              Bài học này chưa có câu hỏi nào trong ngân hàng. Hãy thêm câu hỏi vào bài học này trước hoặc chọn bài học khác.
            </div>
          ) : selectionMode === 'count' ? (
            <div className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200/70 rounded-xl">
              <span className="text-xs font-bold text-slate-700">Giao ngẫu nhiên:</span>
              <input
                type="number"
                min={1}
                max={lessonQuestions.length}
                value={questionCount}
                onChange={(e) => setQuestionCount(e.target.value)}
                className="w-20 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center focus:outline-none focus:border-indigo-600 text-slate-800"
              />
              <span className="text-xs text-slate-500 tabular-nums">/ {lessonQuestions.length} câu hỏi có sẵn của bài học này</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-500 px-1">
                <span>Chọn các câu hỏi bạn muốn giao:</span>
                <button
                  type="button"
                  onClick={selectAllQuestions}
                  className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  {selectedQuestionIds.length === lessonQuestions.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                {lessonQuestions.map((q, idx) => {
                  const isChecked = selectedQuestionIds.includes(q.id);
                  return (
                    <div
                      key={q.id}
                      onClick={() => toggleQuestionSelection(q.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition flex items-start space-x-3 ${isChecked ? 'bg-indigo-50/60 border-indigo-300' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                    >
                      <div className="mt-0.5">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 tabular-nums">
                            Câu {idx + 1}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                            {q.difficulty || 'THONG_HIEU'}
                          </span>
                          {q.topic && (
                            <span className="text-[10px] text-slate-400 truncate">
                              • {q.topic}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-800 line-clamp-2">
                          <MathRenderer content={q.content} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Step 4: Thiết lập đề thi và thời hạn */}
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            4. Thiết lập bài tập &amp; Thời hạn
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Tiêu đề bài tập *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Bài tập: Đồ thị hàm số bậc hai"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-indigo-600 text-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Thời gian làm bài (phút)</span>
              </label>
              <input
                type="number"
                min={1}
                max={300}
                required
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-600 text-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center space-x-1">
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Số lần làm tối đa</span>
              </label>
              <input
                type="number"
                min={1}
                max={10}
                required
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-600 text-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Thời gian mở đề (Tùy chọn)</span>
              </label>
              <input
                type="datetime-local"
                value={openDate}
                onChange={(e) => setOpenDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-600 text-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Hạn nộp bài (Tùy chọn)</span>
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-600 text-slate-800"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showAnswers}
                onChange={(e) => setShowAnswers(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <span>Cho học sinh xem đáp án và lời giải chi tiết sau khi nộp bài</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting || lessonQuestions.length === 0}
            className="flex items-center space-x-1.5 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{submitting ? 'Đang tạo &amp; giao bài...' : 'Xác nhận giao bài theo bài học'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
