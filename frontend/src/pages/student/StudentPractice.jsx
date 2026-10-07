import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api, { resolveImageUrl } from '../../api/axios';
import { 
  Sparkles, BookOpen, Clock, CheckCircle2, XCircle, 
  RotateCcw, ArrowRight, Award, ChevronLeft, ChevronRight, 
  Layers, Filter, Send, AlertCircle, Check, X, Bookmark,
  Brain, Target, Lightbulb, RefreshCw, TrendingDown, ArrowUpRight,
  LayoutGrid
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
  { value: 'NHAN_BIET', label: 'Nhận biết (Cơ bản - Dễ)' },
  { value: 'THONG_HIEU', label: 'Thông hiểu (Trung bình)' },
  { value: 'VAN_DUNG', label: 'Vận dụng (Nâng cao)' },
  { value: 'VAN_DUNG_CAO', label: 'Vận dụng cao (Phân loại 9+)' },
];

const formatDifficultyLabel = (diff) => {
  if (!diff) return 'Tổng hợp';
  const d = String(diff).toUpperCase();
  if (d === 'NHAN_BIET' || d === 'EASY') return 'Nhận biết';
  if (d === 'THONG_HIEU' || d === 'MEDIUM') return 'Thông hiểu';
  if (d === 'VAN_DUNG' || d === 'HARD') return 'Vận dụng';
  if (d === 'VAN_DUNG_CAO') return 'Vận dụng cao';
  return diff;
};

const mapDifficultyToOption = (diff) => {
  if (!diff) return '';
  const d = String(diff).toUpperCase();
  if (d === 'EASY' || d === 'NHAN_BIET') return 'NHAN_BIET';
  if (d === 'MEDIUM' || d === 'THONG_HIEU') return 'THONG_HIEU';
  if (d === 'HARD' || d === 'VAN_DUNG') return 'VAN_DUNG';
  if (d === 'VAN_DUNG_CAO') return 'VAN_DUNG_CAO';
  return diff;
};

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

  // AI Tutor recommendations
  const [recommendationData, setRecommendationData] = useState(null);
  const [recLoading, setRecLoading] = useState(false);

  // Practice state
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [paletteDrawerOpen, setPaletteDrawerOpen] = useState(false);
  const [paletteTab, setPaletteTab] = useState('ALL'); // 'ALL' | 'ANSWERED' | 'UNANSWERED'

  // Result state
  const [resultData, setResultData] = useState(null);
  const [filterResultTab, setFilterResultTab] = useState('ALL'); // 'ALL' | 'INCORRECT' | 'CORRECT'

  // Load AI practice recommendations based on student's weak areas
  const loadRecommendations = async () => {
    try {
      setRecLoading(true);
      const res = await api.get('/student/practice/recommendations', {
        params: { subject, grade_level: gradeLevel }
      });
      if (res.data?.success) {
        setRecommendationData(res.data);
      }
    } catch (err) {
      console.warn('Cannot fetch AI recommendations:', err);
    } finally {
      setRecLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'CONFIG') {
      loadRecommendations();
    }
  }, [subject, gradeLevel, mode]);

  const handleApplyTopic = (topic) => {
    if (topic.chapter) setChapter(topic.chapter);
    if (topic.subject) setSubject(topic.subject);
    if (topic.grade_level) setGradeLevel(Number(topic.grade_level));
    const diff = (topic.accuracy < 40) ? 'NHAN_BIET' : 'THONG_HIEU';
    setDifficulty(diff);
    toast.success(`Đã chọn chuyên đề "${topic.chapter}" vào bộ lọc!`);
  };

  const handleApplyAIRecommendation = () => {
    const rec = recommendationData?.recommendation;
    if (!rec?.suggested_config) return;
    const cfg = rec.suggested_config;
    if (cfg.subject) setSubject(cfg.subject);
    if (cfg.grade_level) setGradeLevel(Number(cfg.grade_level));
    if (cfg.chapter) setChapter(cfg.chapter);
    if (cfg.difficulty) setDifficulty(mapDifficultyToOption(cfg.difficulty));
    if (cfg.count) setQuestionCount(Number(cfg.count));
    toast.success('Đã áp dụng toàn bộ lộ trình gợi ý của AI Tutor!');
  };

  // Timer loop
  useEffect(() => {
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
  const answeredTotal = useMemo(() => {
    return practiceQuestions.filter(q => {
      const val = answers[q.id];
      if (val === undefined || val === null || val === '') return false;
      if (typeof val === 'object') return Object.keys(val).length > 0;
      return true;
    }).length;
  }, [practiceQuestions, answers]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex">
        <Sidebar role="student" />
        <main className={`flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full ${mode === 'PRACTICE' ? 'pb-28 lg:pb-8' : ''}`}>
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

              {/* AI Tutor Smart Recommendation Card */}
              <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-indigo-700/50 max-w-3xl mx-auto relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Brain className="w-56 h-56 text-purple-200" />
                </div>

                <div className="relative z-10 space-y-4">
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-200 text-indigo-950 flex items-center justify-center font-bold shadow-md shrink-0">
                        <Sparkles className="w-5 h-5 text-indigo-900" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-extrabold text-base sm:text-lg tracking-tight">AI Tutor Gợi Ý Ôn Tập Thông Minh</h3>
                          <span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-300/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Cá nhân hóa
                          </span>
                        </div>
                        <p className="text-xs text-indigo-200 mt-0.5">Phân tích tự động từ lịch sử làm bài và các câu làm sai gần đây</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={loadRecommendations}
                      disabled={recLoading}
                      className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 border border-white/20 text-xs font-semibold text-white transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                      title="Làm mới phân tích AI"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${recLoading ? 'animate-spin' : ''}`} />
                      <span>{recLoading ? 'Đang phân tích...' : 'Làm mới'}</span>
                    </button>
                  </div>

                  {/* AI Advice Message */}
                  {recommendationData?.recommendation?.ai_tutor_message && (
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-xs sm:text-sm text-indigo-50 leading-relaxed flex items-start space-x-3">
                      <Lightbulb className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-amber-300">Lời khuyên gia sư: </span>
                        <span>{recommendationData.recommendation.ai_tutor_message}</span>
                      </div>
                    </div>
                  )}

                  {/* Weak Topics List (if detected) */}
                  {recommendationData?.weak_topics && recommendationData.weak_topics.length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
                        <TrendingDown className="w-3.5 h-3.5 text-rose-300" />
                        <span>Chuyên đề cần củng cố gấp (Độ chính xác còn thấp):</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {recommendationData.weak_topics.map((t, idx) => {
                          const acc = Math.round(t.accuracy ?? 0);
                          const isLow = acc < 50;
                          return (
                            <div
                              key={idx}
                              className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 hover:border-amber-300/50 transition flex items-center justify-between gap-2.5"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-xs text-white truncate" title={t.chapter}>
                                  {t.chapter}
                                </div>
                                <div className="flex items-center space-x-2 text-[11px] text-indigo-200 mt-1">
                                  <span className={`font-bold px-1.5 py-0.5 rounded ${isLow ? 'bg-rose-500/30 text-rose-200' : 'bg-amber-500/30 text-amber-200'}`}>
                                    {acc}% đúng
                                  </span>
                                  <span>• {t.wrong_count || 0} câu sai</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleApplyTopic(t)}
                                className="px-2.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-indigo-950 font-bold text-[11px] rounded-lg transition shadow-2xs whitespace-nowrap cursor-pointer shrink-0 flex items-center space-x-1"
                              >
                                <span>Luyện này</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Focus points & One-Click Apply Button */}
                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-white/10">
                    {recommendationData?.recommendation?.focus_points && recommendationData.recommendation.focus_points.length > 0 && (
                      <div className="text-[11px] text-indigo-200 space-y-1">
                        {recommendationData.recommendation.focus_points.slice(0, 2).map((pt, pIdx) => (
                          <div key={pIdx} className="flex items-center space-x-1.5">
                            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate">{pt}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleApplyAIRecommendation}
                      className="min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-indigo-950 font-extrabold text-xs sm:text-sm rounded-xl transition shadow-md flex items-center justify-center space-x-2 cursor-pointer shrink-0"
                    >
                      <Target className="w-4 h-4 text-indigo-900" />
                      <span>Áp dụng gợi ý của AI vào đề</span>
                    </button>
                  </div>
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
                        {formatDifficultyLabel(currentQ.difficulty)}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 font-mono tabular-nums font-bold text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-slate-800">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{formatTimer(timeElapsed)}</span>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div className="text-base sm:text-lg font-medium text-slate-900 mb-6 leading-relaxed">
                    {currentQ.content && currentQ.content.includes('/key') ? (
                      <div>
                        {currentQ.content.split('/key').map((part, pIdx, arr) => (
                          <React.Fragment key={pIdx}>
                            <MathRenderer content={part} inline />
                            {pIdx < arr.length - 1 && (
                              <input
                                type="text"
                                value={typeof answers[currentQ.id] === 'string' ? answers[currentQ.id] : ''}
                                onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                                placeholder="(Điền đáp án)"
                                className="inline-block mx-2 px-3 py-1 border-b-2 border-indigo-600 bg-indigo-50/60 rounded-xl text-indigo-700 font-bold w-40 text-center focus:outline-none focus:bg-indigo-100/70 align-middle"
                              />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    ) : (
                      <MathRenderer content={currentQ.content} />
                    )}
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
                    {currentQ.question_type === 'MULTIPLE_CHOICE' || currentQ.question_type === 'SINGLE_CHOICE' || !currentQ.question_type ? (
                      currentQ.options && currentQ.options.map((opt, idx) => {
                        const optContent = typeof opt === 'string' ? opt : (opt.content ?? '');
                        const optValue = idx;
                        const isSelected = answers[currentQ.id] !== undefined && Number(answers[currentQ.id]) === optValue;
                        const letter = String.fromCharCode(65 + idx);

                        return (
                          <label
                            key={idx}
                            className={`flex items-start space-x-3.5 p-4 rounded-xl border-2 cursor-pointer transition-all min-h-[52px] select-none ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50/70 text-slate-900 shadow-2xs ring-2 ring-indigo-500/20'
                                : 'border-slate-200/90 hover:border-indigo-300 hover:bg-slate-50/70 text-slate-700 active:bg-slate-100'
                            }`}
                          >
                            <div className={`w-9 h-9 sm:w-8 sm:h-8 rounded-xl font-bold flex items-center justify-center text-sm shrink-0 transition ${
                              isSelected 
                                ? 'bg-indigo-600 text-white shadow-xs scale-105' 
                                : 'bg-slate-100 text-slate-700'
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
                            <div className="flex-1 pt-1 text-sm sm:text-base leading-relaxed text-slate-800 break-words">
                              <MathRenderer content={optContent} />
                            </div>
                          </label>
                        );
                      })
                    ) : currentQ.question_type === 'TRUE_FALSE' ? (
                      <div className="space-y-3">
                        {currentQ.sub_questions && currentQ.sub_questions.map((sq, sIdx) => {
                          const sqId = String(sq.id !== undefined && sq.id !== null ? sq.id : (sIdx + 1));
                          const currentSubAnswers = (typeof answers[currentQ.id] === 'object' && answers[currentQ.id] !== null) ? answers[currentQ.id] : {};
                          const subVal = currentSubAnswers[sqId];

                          return (
                            <div key={sqId} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/60 gap-3">
                              <div className="text-slate-800 text-sm font-medium flex-1">
                                <span className="font-bold mr-2 text-indigo-700">Ý {sIdx + 1}:</span>
                                <span>{sq.text || sq.statement || `Khẳng định ${sIdx + 1}`}</span>
                              </div>
                              <div className="flex space-x-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newSub = { ...currentSubAnswers, [sqId]: true };
                                    handleAnswerChange(currentQ.id, newSub);
                                  }}
                                  className={`min-h-[44px] min-w-[76px] flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 ${
                                    subVal === true 
                                      ? 'bg-emerald-600 text-white shadow-xs' 
                                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-emerald-50'
                                  }`}
                                >
                                  <Check className="w-4 h-4" />
                                  <span>Đúng</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newSub = { ...currentSubAnswers, [sqId]: false };
                                    handleAnswerChange(currentQ.id, newSub);
                                  }}
                                  className={`min-h-[44px] min-w-[76px] flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 ${
                                    subVal === false 
                                      ? 'bg-rose-600 text-white shadow-xs' 
                                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-rose-50'
                                  }`}
                                >
                                  <X className="w-4 h-4" />
                                  <span>Sai</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : currentQ.question_type === 'ESSAY' ? (
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-500">
                          Bài làm tự luận:
                        </label>
                        <textarea
                          rows={6}
                          value={typeof answers[currentQ.id] === 'string' ? answers[currentQ.id] : ''}
                          onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                          placeholder="Nhập phần giải thích, lập luận và bài làm tự luận của bạn tại đây..."
                          className="w-full p-4 min-h-[140px] rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 text-slate-900 bg-white text-base leading-relaxed resize-y"
                        />
                        <div className="text-right text-[11px] text-slate-400">
                          {(typeof answers[currentQ.id] === 'string' ? answers[currentQ.id].length : 0)} ký tự
                        </div>
                      </div>
                    ) : (currentQ.question_type === 'FILL_IN_BLANK' || currentQ.question_type === 'SHORT_ANSWER') && !currentQ.content?.includes('/key') ? (
                      <input
                        type="text"
                        value={typeof answers[currentQ.id] === 'string' ? answers[currentQ.id] : ''}
                        onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                        placeholder="Nhập câu trả lời của bạn..."
                        className="w-full p-4 min-h-[52px] rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 text-slate-900 bg-white text-base"
                      />
                    ) : null}
                  </div>

                  {/* Navigation Buttons */}
                  <div className="flex justify-between items-center pt-6 mt-8 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentIndex === 0}
                      className="min-h-[44px] flex items-center space-x-1.5 px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 transition shadow-2xs cursor-pointer active:scale-95"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Câu trước</span>
                    </button>
                    {currentIndex === practiceQuestions.length - 1 ? (
                      <button
                        type="button"
                        onClick={handleSubmitPractice}
                        disabled={loading}
                        className="min-h-[44px] flex items-center space-x-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm font-bold text-white transition shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
                      >
                        <Send className="w-4 h-4" />
                        <span>{loading ? 'Đang chấm điểm...' : 'Nộp bài & Xem giải thích'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCurrentIndex(prev => Math.min(practiceQuestions.length - 1, prev + 1))}
                        className="min-h-[44px] flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-xs cursor-pointer active:scale-95"
                      >
                        <span>Câu sau</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop Sidebar Question Palette (Hidden on mobile) */}
              <aside className="hidden lg:block space-y-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-4 sticky top-20">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                      <LayoutGrid className="w-4 h-4 text-indigo-600" />
                      <span>Tiến trình tự luyện</span>
                    </h3>
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full tabular-nums">
                      {answeredTotal}/{practiceQuestions.length} câu
                    </span>
                  </div>

                  {/* Desktop Palette Filter Tabs */}
                  <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setPaletteTab('ALL')}
                      className={`flex-1 py-1 rounded-lg transition cursor-pointer text-center ${
                        paletteTab === 'ALL' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tất cả
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaletteTab('ANSWERED')}
                      className={`flex-1 py-1 rounded-lg transition cursor-pointer text-center ${
                        paletteTab === 'ANSWERED' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Đã làm
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaletteTab('UNANSWERED')}
                      className={`flex-1 py-1 rounded-lg transition cursor-pointer text-center ${
                        paletteTab === 'UNANSWERED' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Chưa làm
                    </button>
                  </div>

                  <div className="grid grid-cols-5 gap-2 max-h-[50vh] overflow-y-auto pr-1">
                    {practiceQuestions.map((q, idx) => {
                      const val = answers[q.id];
                      const isAnswered = val !== undefined && val !== null && val !== '' && (typeof val !== 'object' || Object.keys(val).length > 0);
                      const isCurrent = idx === currentIndex;

                      if (paletteTab === 'ANSWERED' && !isAnswered) return null;
                      if (paletteTab === 'UNANSWERED' && isAnswered) return null;

                      return (
                        <button
                          key={q.id || idx}
                          onClick={() => setCurrentIndex(idx)}
                          className={`min-h-[44px] h-11 rounded-xl font-bold text-xs transition flex items-center justify-center cursor-pointer tabular-nums shadow-2xs active:scale-95 ${
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
                    className="min-h-[44px] w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Nộp bài & Xem giải thích</span>
                  </button>
                </div>
              </aside>

              {/* Mobile Sticky Quick Navigation Bar (Screen width < lg) */}
              <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-3 py-2 z-40 lg:hidden flex items-center justify-between gap-2 safe-area-bottom">
                {/* Prev Button */}
                <button
                  type="button"
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="min-w-[44px] min-h-[44px] px-3 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-30 flex items-center justify-center font-bold text-xs transition cursor-pointer active:scale-95 shadow-2xs"
                  aria-label="Câu trước"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="hidden xs:inline ml-0.5">Trước</span>
                </button>

                {/* Center Drawer Trigger Button */}
                <button
                  type="button"
                  onClick={() => setPaletteDrawerOpen(true)}
                  className="flex-1 min-h-[44px] px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100/70 border border-indigo-200/80 rounded-xl text-indigo-900 flex items-center justify-center space-x-1.5 font-bold text-xs transition active:scale-95 cursor-pointer shadow-2xs"
                >
                  <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="truncate">Câu {currentIndex + 1}/{practiceQuestions.length}</span>
                  <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold tabular-nums shrink-0">
                    {answeredTotal}/{practiceQuestions.length}
                  </span>
                </button>

                {/* Next / Submit Button */}
                {currentIndex === practiceQuestions.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleSubmitPractice}
                    disabled={loading}
                    className="min-w-[44px] min-h-[44px] px-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl flex items-center justify-center font-bold text-xs transition cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    <Send className="w-4 h-4 mr-1" />
                    <span>Nộp</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex(prev => Math.min(practiceQuestions.length - 1, prev + 1))}
                    className="min-w-[44px] min-h-[44px] px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl flex items-center justify-center font-bold text-xs transition cursor-pointer shadow-xs"
                    aria-label="Câu sau"
                  >
                    <span className="hidden xs:inline mr-0.5">Sau</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Mobile Question Palette Bottom Sheet Drawer */}
              {paletteDrawerOpen && (
                <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
                    onClick={() => setPaletteDrawerOpen(false)}
                  />
                  {/* Sheet Container */}
                  <div className="relative bg-white rounded-t-3xl border-t border-slate-200/90 shadow-2xl p-5 max-h-[82vh] flex flex-col z-10 transition-transform">
                    {/* Grab indicator bar */}
                    <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-3" />

                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center space-x-1.5">
                          <LayoutGrid className="w-4 h-4 text-indigo-600" />
                          <span>Bảng câu hỏi tự luyện</span>
                        </h3>
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full tabular-nums">
                          {answeredTotal}/{practiceQuestions.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPaletteDrawerOpen(false)}
                        className="w-10 h-10 min-h-[44px] min-w-[44px] rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition"
                        aria-label="Đóng bảng câu hỏi"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex rounded-xl bg-slate-100 p-1 my-3 text-xs font-bold shrink-0">
                      <button
                        type="button"
                        onClick={() => setPaletteTab('ALL')}
                        className={`flex-1 py-1.5 rounded-lg transition cursor-pointer text-center ${
                          paletteTab === 'ALL' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Tất cả ({practiceQuestions.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaletteTab('ANSWERED')}
                        className={`flex-1 py-1.5 rounded-lg transition cursor-pointer text-center ${
                          paletteTab === 'ANSWERED' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Đã làm ({answeredTotal})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaletteTab('UNANSWERED')}
                        className={`flex-1 py-1.5 rounded-lg transition cursor-pointer text-center ${
                          paletteTab === 'UNANSWERED' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Chưa làm ({practiceQuestions.length - answeredTotal})
                      </button>
                    </div>

                    {/* Grid of question buttons */}
                    <div className="grid grid-cols-5 gap-2.5 overflow-y-auto max-h-[42vh] py-1 pr-1">
                      {practiceQuestions.map((q, idx) => {
                        const val = answers[q.id];
                        const isAnswered = val !== undefined && val !== null && val !== '' && (typeof val !== 'object' || Object.keys(val).length > 0);
                        const isCurrent = idx === currentIndex;

                        if (paletteTab === 'ANSWERED' && !isAnswered) return null;
                        if (paletteTab === 'UNANSWERED' && isAnswered) return null;

                        return (
                          <button
                            key={q.id || idx}
                            onClick={() => {
                              setCurrentIndex(idx);
                              setPaletteDrawerOpen(false);
                            }}
                            className={`min-h-[44px] h-11 rounded-xl font-bold text-xs transition flex items-center justify-center cursor-pointer tabular-nums shadow-2xs active:scale-95 ${
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

                    {/* Drawer Action Button */}
                    <div className="pt-3 mt-2 border-t border-slate-100 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setPaletteDrawerOpen(false);
                          handleSubmitPractice();
                        }}
                        disabled={loading}
                        className="min-h-[44px] w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs sm:text-sm rounded-xl transition shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        <span>Nộp bài &amp; Chấm điểm</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
                    const isTF = item.question_type === 'TRUE_FALSE';
                    const isEssay = item.question_type === 'ESSAY';
                    const isShort = item.question_type === 'SHORT_ANSWER' || item.question_type === 'FILL_IN_BLANK';

                    const studentAnsLetter = !isTF && item.student_answer !== undefined && item.student_answer !== null && item.student_answer !== ''
                      ? (typeof item.student_answer === 'number' ? String.fromCharCode(65 + item.student_answer) : String(item.student_answer))
                      : 'Chưa chọn';

                    const correctAnsLetter = !isTF && item.correct_answer !== undefined && item.correct_answer !== null && item.correct_answer !== ''
                      ? (typeof item.correct_answer === 'number' ? String.fromCharCode(65 + item.correct_answer) : String(item.correct_answer))
                      : (item.correct_option !== undefined && item.correct_option !== null ? String.fromCharCode(65 + Number(item.correct_option)) : '—');

                    return (
                      <div
                        key={item.id || idx}
                        className={`bg-white rounded-2xl p-6 sm:p-7 border shadow-xs transition ${
                          item.is_correct ? 'border-emerald-200' : 'border-rose-200'
                        }`}
                      >
                        {/* Question Status */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 mb-4 gap-2">
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
                              <span>{item.is_correct ? 'Chính xác (+1 đ)' : isEssay ? 'Đã ghi nhận bài nộp' : 'Chưa đúng (0 đ)'}</span>
                            </span>
                          </div>

                          {!isTF && !isEssay && (
                            <div className="text-xs text-slate-500 font-medium">
                              Bạn chọn: <strong className={item.is_correct ? 'text-emerald-700' : 'text-rose-700'}>{studentAnsLetter}</strong> • Đáp án đúng: <strong className="text-emerald-700">{correctAnsLetter}</strong>
                            </div>
                          )}
                        </div>

                        {/* Question Content */}
                        <div className="text-base text-slate-900 font-medium mb-4 leading-relaxed">
                          {item.content && item.content.includes('/key') ? (
                            <div>
                              {item.content.split('/key').map((part, pIdx, arr) => (
                                <React.Fragment key={pIdx}>
                                  <MathRenderer content={part} inline />
                                  {pIdx < arr.length - 1 && (
                                    <span className="inline-block mx-1.5 px-2.5 py-0.5 rounded-lg border border-dashed border-indigo-400 bg-indigo-50/70 text-indigo-700 font-bold text-xs align-middle">
                                      {item.student_answer || '______'}
                                    </span>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          ) : (
                            <MathRenderer content={item.content} />
                          )}
                        </div>

                        {/* Optional Question Image */}
                        {item.image_url && (
                          <div className="mb-4 flex justify-center">
                            <img 
                              src={resolveImageUrl(item.image_url)} 
                              alt="Hình minh họa" 
                              className="max-h-64 rounded-xl border border-slate-200 object-contain" 
                              onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                            />
                          </div>
                        )}

                        {/* MCQ Options */}
                        {item.options && (item.question_type === 'MULTIPLE_CHOICE' || item.question_type === 'SINGLE_CHOICE' || !item.question_type) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                            {item.options.map((opt, oIdx) => {
                              const optContent = typeof opt === 'string' ? opt : (opt.content ?? '');
                              const letter = String.fromCharCode(65 + oIdx);
                              const isStudentPick = Number(item.student_answer) === oIdx;
                              const isCorrectOpt = Number(item.correct_answer ?? item.correct_option) === oIdx;

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

                        {/* TRUE_FALSE Sub-questions Review */}
                        {isTF && item.sub_questions && (
                          <div className="space-y-2.5 mb-4">
                            {item.sub_questions.map((sq, sIdx) => {
                              const sqId = String(sq.id !== undefined && sq.id !== null ? sq.id : (sIdx + 1));
                              const studentSubVal = item.student_answer?.[sqId];
                              const expected = sq.correct !== undefined ? sq.correct : (sq.answer === true || String(sq.answer).toLowerCase() === 'true');
                              const isSubCorrect = studentSubVal === expected;

                              return (
                                <div
                                  key={sqId}
                                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs sm:text-sm ${
                                    isSubCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
                                  }`}
                                >
                                  <div className="flex-1 text-slate-800">
                                    <span className="font-bold mr-1.5 text-indigo-700">Ý {sIdx + 1}:</span>
                                    <span>{sq.text || sq.statement || `Khẳng định ${sIdx + 1}`}</span>
                                  </div>
                                  <div className="flex items-center space-x-3 shrink-0 text-xs font-semibold">
                                    <span>Bạn chọn: <strong className={isSubCorrect ? 'text-emerald-700' : 'text-rose-700'}>{studentSubVal === true ? 'Đúng' : studentSubVal === false ? 'Sai' : 'Chưa chọn'}</strong></span>
                                    <span>•</span>
                                    <span>Đáp án: <strong className="text-emerald-700">{expected ? 'Đúng' : 'Sai'}</strong></span>
                                    <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${isSubCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                      {isSubCorrect ? 'Đúng' : 'Sai'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* ESSAY Review */}
                        {isEssay && (
                          <div className="space-y-3 mb-4">
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm">
                              <span className="font-bold text-slate-700 block mb-1">Bài làm của bạn:</span>
                              <p className="whitespace-pre-wrap text-slate-800 leading-relaxed font-sans">
                                {item.student_answer || '(Chưa điền bài làm)'}
                              </p>
                            </div>
                            {item.sample_solution && (
                              <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200 text-xs sm:text-sm">
                                <span className="font-bold text-indigo-900 block mb-1">Đáp án mẫu / Thang điểm tự luận:</span>
                                <MathRenderer content={item.sample_solution} />
                              </div>
                            )}
                          </div>
                        )}

                        {/* SHORT_ANSWER / FILL_IN_BLANK Review */}
                        {isShort && !item.content?.includes('/key') && (
                          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 mb-4 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <span className="text-slate-500">Câu trả lời của bạn: </span>
                              <strong className={item.is_correct ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                                {item.student_answer || '(Chưa điền)'}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500">Đáp án chuẩn: </span>
                              <strong className="text-emerald-700 font-bold">
                                {item.correct_answer || (Array.isArray(item.correct_answers) ? item.correct_answers.join(' / ') : '—')}
                              </strong>
                            </div>
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
