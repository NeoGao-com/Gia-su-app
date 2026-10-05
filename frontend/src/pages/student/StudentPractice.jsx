import React, { useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api, { resolveImageUrl } from '../../api/axios';
import { 
  Sparkles, BookOpen, Clock, CheckCircle2, XCircle, 
  RotateCcw, ArrowRight, Award, ChevronLeft, ChevronRight, 
  Layers, Filter, Send, AlertCircle, Check, X, Bookmark
} from 'lucide-react';
import { MathRenderer } from '../../components/MathRenderer';
import { useToast } from '../../context/ToastContext';

const SUBJECT_OPTIONS = [
  'Toán học', 'Vật lý', 'Hóa học', 'Sinh học', 
  'Tiếng Anh', 'Ngữ văn', 'Lịch sử', 'Địa lý', 'Tin học'
];

const GRADE_OPTIONS = [6, 7, 8, 9, 10, 11, 12];

const DIFFICULTY_OPTIONS = [
  { value: '', label: 'Tất cả mức độ (Tổng hợp)' },
  { value: 'easy', label: 'Cơ bản / Nhận biết' },
  { value: 'medium', label: 'Trung bình / Thông hiểu' },
  { value: 'hard', label: 'Nâng cao / Vận dụng' },
];

export function StudentPractice() {
  const { toast, confirm } = useToast();

  // Mode: 'CONFIG' | 'PRACTICE' | 'RESULT'
  const [mode, setMode] = useState('CONFIG');

  // Config parameters
  const [subject, setSubject] = useState('Toán học');
  const [gradeLevel, setGradeLevel] = useState(12);
  const [chapter, setChapter] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [loading, setLoading] = useState(false);

  // Practice state
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  // Result state
  const [resultData, setResultData] = useState(null);
  const [filterResultTab, setFilterResultTab] = useState('ALL'); // 'ALL' | 'INCORRECT' | 'CORRECT'

  // Timer loop
  React.useEffect(() => {
    let interval = null;
    if (timerActive) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  const handleStartPractice = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (subject) params.append('subject', subject);
      if (gradeLevel) params.append('grade_level', gradeLevel);
      if (chapter) params.append('chapter', chapter);
      if (difficulty) params.append('difficulty', difficulty);
      params.append('count', questionCount);

      const res = await api.get(`/student/practice/questions?${params.toString()}`);
      const questions = Array.isArray(res.data?.questions) ? res.data.questions : [];

      if (questions.length === 0) {
        toast.warning('Chưa có câu hỏi nào trong ngân hàng phù hợp với cấu hình này. Hãy thử chọn môn hoặc khối khác!');
        setLoading(false);
        return;
      }

      setPracticeQuestions(questions);
      setAnswers({});
      setCurrentIndex(0);
      setTimeElapsed(0);
      setTimerActive(true);
      setMode('PRACTICE');
      toast.success(`Đã chuẩn bị xong ${questions.length} câu hỏi tự luyện!`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể tạo đề tự luyện lúc này');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (qId, val) => {
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const handleSubmitPractice = async () => {
    const answeredCount = Object.keys(answers).length;
    const unanswered = practiceQuestions.length - answeredCount;

    if (unanswered > 0) {
      const ok = await confirm({
        title: 'Còn câu chưa làm',
        message: `Bạn còn ${unanswered} câu chưa chọn đáp án. Bạn có muốn nộp và xem lời giải ngay không?`,
        confirmText: 'Chấm điểm ngay',
        cancelText: 'Làm tiếp',
        type: 'warning'
      });
      if (!ok) return;
    }

    setTimerActive(false);
    setLoading(true);

    try {
      const payload = {
        question_ids: practiceQuestions.map(q => q.id),
        answers: answers
      };

      const res = await api.post('/student/practice/grade', payload);
      setResultData(res.data);
      setMode('RESULT');
      toast.success('Đã chấm điểm xong bài tự luyện!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Lỗi khi chấm điểm bài tự luyện');
      setTimerActive(true);
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentQ = practiceQuestions[currentIndex];
  const answeredTotal = Object.keys(answers).filter(k => answers[k] !== undefined && answers[k] !== '').length;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex">
        <Sidebar role="student" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl">
          {/* Header */}
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span>Tự luyện & Ôn tập thông minh</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">Tự tạo đề ôn tập theo từng chuyên đề, chấm điểm tức thì và xem lời giải chi tiết từng bước</p>
            </div>

            {mode !== 'CONFIG' && (
              <button
                type="button"
                onClick={() => {
                  if (mode === 'PRACTICE') {
                    if (window.confirm('Bạn có chắc muốn thoát bài tự luyện đang làm?')) {
                      setTimerActive(false);
                      setMode('CONFIG');
                    }
                  } else {
                    setMode('CONFIG');
                  }
                }}
                className="text-xs font-semibold bg-white border border-slate-200 px-4 py-2 rounded-xl text-slate-700 hover:bg-slate-50 transition shadow-2xs flex items-center space-x-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Tạo đề mới</span>
              </button>
            )}
          </div>

          {/* ======================================================== */}
          {/* SCREEN 1: CONFIGURATION MODE */}
          {/* ======================================================== */}
          {mode === 'CONFIG' && (
            <div className="space-y-6">
              {/* Introduction Card */}
              <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 text-white p-6 sm:p-8 rounded-3xl shadow-sm relative overflow-hidden border border-indigo-700/30">
                <div className="relative z-10 max-w-2xl">
                  <div className="inline-flex items-center space-x-2 bg-white/15 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-white mb-3">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Luyện tập tự do không giới hạn</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Chủ động bứt phá điểm số
                  </h2>
                  <p className="mt-2 text-indigo-100 text-sm sm:text-base leading-relaxed">
                    Hệ thống sẽ tự động tổng hợp câu hỏi từ ngân hàng đề chuẩn, hỗ trợ công thức Toán LaTeX và hiển thị đáp án, lời giải giải thích ngay sau khi nộp.
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-8 translate-y-8">
                  <BookOpen className="w-64 h-64" />
                </div>
              </div>

              {/* Practice Configuration Form */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-xs max-w-3xl mx-auto space-y-6">
                <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100">
                  <Filter className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-900">Cấu hình đề ôn luyện của bạn</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Subject */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Môn học
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                    >
                      {SUBJECT_OPTIONS.map((sub) => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>

                  {/* Grade */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Khối lớp
                    </label>
                    <select
                      value={gradeLevel}
                      onChange={(e) => setGradeLevel(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                    >
                      {GRADE_OPTIONS.map((g) => (
                        <option key={g} value={g}>Khối {g}</option>
                      ))}
                    </select>
                  </div>

                  {/* Chapter / Topic */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Chuyên đề / Chủ đề (Tùy chọn)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Hàm số, Hình không gian, Este..."
                      value={chapter}
                      onChange={(e) => setChapter(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 focus:bg-white transition text-slate-800"
                    />
                  </div>

                  {/* Difficulty */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Độ khó mong muốn
                    </label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                    >
                      {DIFFICULTY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Number of questions */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Số lượng câu hỏi trong đề
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {[5, 10, 15, 20].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setQuestionCount(cnt)}
                        className={`py-2.5 rounded-xl font-bold text-sm transition-all border cursor-pointer tabular-nums ${
                          questionCount === cnt
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {cnt} câu
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleStartPractice}
                    disabled={loading}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition shadow-xs flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{loading ? 'Đang soạn đề tự luyện...' : 'Tạo đề & Bắt đầu làm bài'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SCREEN 2: ACTIVE PRACTICE MODE */}
          {/* ======================================================== */}
          {mode === 'PRACTICE' && currentQ && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Question Workspace */}
              <div className="lg:col-span-3 space-y-6">
                <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-xs">
                  {/* Question Info Bar */}
                  <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl tabular-nums">
                        Câu {currentIndex + 1} / {practiceQuestions.length}
                      </span>
                      {currentQ.chapter && (
                        <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-xl">
                          {currentQ.chapter}
                        </span>
                      )}
                      <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-xl">
                        {currentQ.difficulty === 'easy' ? 'Dễ' : currentQ.difficulty === 'hard' ? 'Khó' : 'Trung bình'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 font-mono tabular-nums font-bold text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-slate-800">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{formatTimer(timeElapsed)}</span>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div className="text-base sm:text-lg font-medium text-slate-900 mb-6 leading-relaxed">
                    <MathRenderer content={currentQ.content} />
                  </div>

                  {/* Optional Image */}
                  {currentQ.image_url && (
                    <div className="mb-6 flex justify-center">
                      <img 
                        src={resolveImageUrl(currentQ.image_url)} 
                        alt="Hình minh họa" 
                        className="max-h-72 rounded-2xl border border-slate-200 shadow-2xs object-contain" 
                        onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                      />
                    </div>
                  )}

                  {/* Answer Options */}
                  <div className="space-y-3 pt-2">
                    {currentQ.options && currentQ.options.map((opt, idx) => {
                      const optContent = typeof opt === 'string' ? opt : (opt.content ?? '');
                      const optValue = idx;
                      const isSelected = answers[currentQ.id] !== undefined && Number(answers[currentQ.id]) === optValue;
                      const letter = String.fromCharCode(65 + idx);

                      return (
                        <label
                          key={idx}
                          className={`flex items-start space-x-3.5 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/60 text-slate-900 shadow-2xs ring-1 ring-indigo-500/20'
                              : 'border-slate-200/90 hover:border-indigo-300 hover:bg-slate-50/70 text-slate-700'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center text-sm shrink-0 transition ${
                            isSelected 
                              ? 'bg-indigo-600 text-white shadow-xs' 
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {letter}
                          </div>
                          <input
                            type="radio"
                            name={`practice-${currentQ.id}`}
                            checked={isSelected}
                            onChange={() => handleAnswerChange(currentQ.id, optValue)}
                            className="sr-only"
                          />
                          <div className="flex-1 pt-1 text-sm sm:text-base leading-relaxed text-slate-800">
                            <MathRenderer content={optContent} />
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex justify-between items-center pt-6 mt-8 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentIndex === 0}
                      className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 transition shadow-2xs cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Câu trước</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentIndex(prev => Math.min(practiceQuestions.length - 1, prev + 1))}
                      disabled={currentIndex === practiceQuestions.length - 1}
                      className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40 transition shadow-xs cursor-pointer"
                    >
                      <span>Câu sau</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sidebar Question Palette */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Tiến trình làm bài</h3>
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full tabular-nums">
                      {answeredTotal}/{practiceQuestions.length} câu
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-2 max-h-[50vh] overflow-y-auto pr-1">
                    {practiceQuestions.map((q, idx) => {
                      const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '';
                      const isCurrent = idx === currentIndex;

                      return (
                        <button
                          key={q.id || idx}
                          onClick={() => setCurrentIndex(idx)}
                          className={`h-10 rounded-xl font-bold text-xs transition flex items-center justify-center cursor-pointer tabular-nums shadow-2xs ${
                            isCurrent
                              ? 'ring-2 ring-indigo-500 bg-indigo-600 text-white shadow-xs'
                              : isAnswered
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={handleSubmitPractice}
                    disabled={loading}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Nộp bài & Xem giải thích</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SCREEN 3: RESULT & SOLUTIONS MODE */}
          {/* ======================================================== */}
          {mode === 'RESULT' && resultData && (
            <div className="space-y-6">
              {/* Score Summary Card */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-xs">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-100">
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-sm tabular-nums">
                      {resultData.score}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h2 className="text-xl font-bold text-slate-900">Kết quả bài tự luyện</h2>
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          resultData.score >= 8.0 
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                            : resultData.score >= 5.0 
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {resultData.score >= 8.0 ? 'Xuất sắc! 🔥' : resultData.score >= 5.0 ? 'Khá tốt! 👍' : 'Cần cố gắng thêm 💪'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 tabular-nums">
                        Đúng {resultData.correct_count} / {resultData.total_questions} câu • Thời gian hoàn thành: {formatTimer(timeElapsed)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={handleStartPractice}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center space-x-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Làm lại đề này</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('CONFIG')}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition shadow-xs flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Tạo đề mới</span>
                    </button>
                  </div>
                </div>

                {/* Filter Tabs for questions */}
                <div className="flex items-center space-x-2 pt-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Bộ lọc câu:</span>
                  <button
                    type="button"
                    onClick={() => setFilterResultTab('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer tabular-nums ${
                      filterResultTab === 'ALL' 
                        ? 'bg-indigo-600 text-white shadow-2xs' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả ({resultData.graded_questions?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterResultTab('INCORRECT')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer tabular-nums ${
                      filterResultTab === 'INCORRECT' 
                        ? 'bg-rose-600 text-white shadow-2xs' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Câu làm sai ({resultData.total_questions - resultData.correct_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterResultTab('CORRECT')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer tabular-nums ${
                      filterResultTab === 'CORRECT' 
                        ? 'bg-emerald-600 text-white shadow-2xs' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Câu làm đúng ({resultData.correct_count})
                  </button>
                </div>
              </div>

              {/* Detailed Solutions List */}
              <div className="space-y-4">
                {(resultData.graded_questions || [])
                  .filter(q => {
                    if (filterResultTab === 'INCORRECT') return !q.is_correct;
                    if (filterResultTab === 'CORRECT') return q.is_correct;
                    return true;
                  })
                  .map((item, idx) => {
                    const studentAnsLetter = item.student_answer !== undefined && item.student_answer !== null && item.student_answer !== ''
                      ? (typeof item.student_answer === 'number' ? String.fromCharCode(65 + item.student_answer) : item.student_answer)
                      : 'Chưa chọn';

                    const correctAnsLetter = item.correct_answer !== undefined && item.correct_answer !== null && item.correct_answer !== ''
                      ? (typeof item.correct_answer === 'number' ? String.fromCharCode(65 + item.correct_answer) : item.correct_answer)
                      : '—';

                    return (
                      <div
                        key={item.id || idx}
                        className={`bg-white rounded-2xl p-6 sm:p-7 border shadow-xs transition ${
                          item.is_correct ? 'border-emerald-200' : 'border-rose-200'
                        }`}
                      >
                        {/* Question Status */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg tabular-nums">
                              Câu {idx + 1}
                            </span>
                            <span className={`text-xs font-bold px-3 py-1 rounded-full flex items-center space-x-1 ${
                              item.is_correct 
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}>
                              {item.is_correct ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                              <span>{item.is_correct ? 'Chính xác (+1 đ)' : 'Chưa đúng (0 đ)'}</span>
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 font-medium">
                            Bạn chọn: <strong className={item.is_correct ? 'text-emerald-700' : 'text-rose-700'}>{studentAnsLetter}</strong> • Đáp án đúng: <strong className="text-emerald-700">{correctAnsLetter}</strong>
                          </div>
                        </div>

                        {/* Question Content */}
                        <div className="text-base text-slate-900 font-medium mb-4 leading-relaxed">
                          <MathRenderer content={item.content} />
                        </div>

                        {/* Options */}
                        {item.options && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                            {item.options.map((opt, oIdx) => {
                              const optContent = typeof opt === 'string' ? opt : (opt.content ?? '');
                              const letter = String.fromCharCode(65 + oIdx);
                              const isStudentPick = Number(item.student_answer) === oIdx;
                              const isCorrectOpt = Number(item.correct_answer) === oIdx;

                              return (
                                <div
                                  key={oIdx}
                                  className={`p-3 rounded-xl border text-xs sm:text-sm flex items-start space-x-2.5 ${
                                    isCorrectOpt 
                                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-semibold'
                                      : isStudentPick 
                                      ? 'bg-rose-50/70 border-rose-300 text-rose-950 font-medium'
                                      : 'bg-slate-50 border-slate-200/80 text-slate-700'
                                  }`}
                                >
                                  <span className={`w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center shrink-0 ${
                                    isCorrectOpt 
                                      ? 'bg-emerald-600 text-white' 
                                      : isStudentPick 
                                      ? 'bg-rose-600 text-white' 
                                      : 'bg-white text-slate-700 border border-slate-200'
                                  }`}>
                                    {letter}
                                  </span>
                                  <div className="flex-1 pt-0.5 leading-relaxed">
                                    <MathRenderer content={optContent} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Detailed Step-by-Step Explanation */}
                        {item.explanation && (
                          <div className="mt-4 pt-4 border-t border-slate-100 bg-indigo-50/40 p-4 rounded-xl border border-indigo-100">
                            <div className="flex items-center space-x-1.5 text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Lời giải chi tiết & Phương pháp:</span>
                            </div>
                            <div className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                              <MathRenderer content={item.explanation} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
