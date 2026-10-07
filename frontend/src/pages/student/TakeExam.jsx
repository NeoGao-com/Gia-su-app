import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { resolveImageUrl } from '../../api/axios';
import { 
  Clock, AlertCircle, Bookmark, ChevronLeft, ChevronRight, 
  CheckCircle2, Cloud, Send, Flag, Sparkles, X, Check,
  Layers, LayoutGrid
} from 'lucide-react';
import { MathRenderer } from '../../components/MathRenderer';
import { useToast } from '../../context/ToastContext';

export function TakeExam() {
  const params = useParams();
  const examId = params.examId || params.id;
  const navigate = useNavigate();
  const { toast, confirm } = useToast();

  const [exam, setExam] = useState(null);
  const [submissionId, setSubmissionId] = useState(null);
  const [version, setVersion] = useState(1);
  const [answers, setAnswers] = useState({});
  const [bookmarked, setBookmarked] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saving' | 'saved'
  const [conflictModal, setConflictModal] = useState(false);
  const [serverAnswers, setServerAnswers] = useState({});
  const [paletteDrawerOpen, setPaletteDrawerOpen] = useState(false);
  const [paletteTab, setPaletteTab] = useState('ALL'); // 'ALL' | 'ANSWERED' | 'UNANSWERED' | 'BOOKMARKED'

  useEffect(() => {
    if (!examId) return;
    const initExam = async () => {
      try {
        const startRes = await api.post(`/student/exams/${examId}/start`);
        setSubmissionId(startRes.data.id);
        setVersion(startRes.data.version || 1);
        if (startRes.data.answers) {
          setAnswers(startRes.data.answers);
        }

        const detailRes = await api.get(`/student/exams/${examId}`);
        setExam(detailRes.data);

        const durationSec = (detailRes.data.duration_minutes || 45) * 60;
        if (startRes.data.started_at) {
          const started = new Date(startRes.data.started_at).getTime();
          const elapsedSec = Math.floor((Date.now() - started) / 1000);
          const remainSec = Math.max(0, durationSec - elapsedSec);
          setTimeLeft(remainSec);
        } else {
          setTimeLeft(durationSec);
        }
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Không thể bắt đầu bài thi');
        navigate('/exams');
      } finally {
        setLoading(false);
      }
    };
    initExam();
  }, [examId, navigate]);

  const questions = exam?.questions || [];

  const handleSubmit = useCallback(async (isAuto = false) => {
    if (submitting) return;

    if (!isAuto) {
      const answeredTotal = Object.keys(answers).filter(
        k => answers[k] !== undefined && answers[k] !== '' && answers[k] !== null && 
        (typeof answers[k] !== 'object' || Object.keys(answers[k]).length > 0)
      ).length;
      const unanswered = Math.max(0, questions.length - answeredTotal);

      let msg = 'Bạn đã trả lời đầy đủ tất cả câu hỏi. Bạn có chắc chắn muốn nộp bài thi?';
      let title = 'Xác nhận nộp bài';
      let type = 'primary';

      if (unanswered > 0) {
        msg = `Bạn còn ${unanswered} câu chưa hoàn thành! Bạn có chắc chắn muốn nộp bài thi ngay bây giờ không?`;
        title = 'Còn câu chưa trả lời';
        type = 'warning';
      }

      const isConfirmed = await confirm({
        title,
        message: msg,
        confirmText: 'Nộp bài ngay',
        cancelText: 'Làm tiếp',
        type
      });
      if (!isConfirmed) return;
    }

    setSubmitting(true);

    try {
      await api.post(`/student/submissions/${submissionId}/submit`, {
        exam_id: parseInt(examId),
        answers: answers,
        time_spent: exam ? (exam.duration_minutes * 60 - timeLeft) : 0
      });
      toast.success('Nộp bài thi thành công!');
      navigate('/student/history');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Nộp bài thất bại. Vui lòng thử lại.');
      setSubmitting(false);
    }
  }, [submitting, submissionId, examId, answers, exam, timeLeft, questions.length, navigate, confirm, toast]);

  const versionRef = useRef(version);
  useEffect(() => {
    versionRef.current = version;
  }, [version]);

  const [tabSwitches, setTabSwitches] = useState(0);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches(prev => prev + 1);
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => window.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleAnswerChange = useCallback((questionId, value) => {
    setAnswers(prev => {
      const updatedAnswers = { ...prev, [questionId]: value };
      if (submissionId && !submitting) {
        setSaveStatus('saving');
        api.post(`/student/submissions/${submissionId}/save`, {
          answers: updatedAnswers,
          version: versionRef.current,
          tab_switches: tabSwitches
        })
        .then(res => {
          if (res.data?.version) {
            setVersion(res.data.version);
            versionRef.current = res.data.version;
          }
          setSaveStatus('saved');
        })
        .catch(err => {
          setSaveStatus('saved');
          if (err.response?.status === 409) {
            setServerAnswers(err.response.data.detail?.current_answers || {});
            setConflictModal(true);
          }
        });
      }
      return updatedAnswers;
    });
  }, [submissionId, submitting, tabSwitches]);

  const toggleBookmark = useCallback((qId) => {
    setBookmarked(prev => ({ ...prev, [qId]: !prev[qId] }));
  }, []);

  const timerTriggered = useRef(false);

  useEffect(() => {
    if (timeLeft <= 0 || loading) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!timerTriggered.current) {
            timerTriggered.current = true;
            toast.warning('Thời gian làm bài đã hết! Hệ thống đang tự động nộp bài...');
            handleSubmit(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, loading, handleSubmit, toast]);

  if (loading || !exam) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <div className="text-slate-700 font-semibold text-sm animate-pulse">Đang tải câu hỏi bài thi...</div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(answers).filter(
    k => answers[k] !== undefined && answers[k] !== '' && answers[k] !== null && 
    (typeof answers[k] !== 'object' || Object.keys(answers[k]).length > 0)
  ).length;

  // Timer color states
  const isUrgent = timeLeft < 60;
  const isWarning = timeLeft < 300 && !isUrgent;

  return (
    <div className="min-h-screen bg-slate-50 pb-28 lg:pb-16 font-sans">
      {/* Sticky Exam Top Bar */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs sticky top-0 z-40 px-3 sm:px-8 py-2.5 sm:py-3 flex justify-between items-center transition">
        <div className="flex items-center space-x-2.5 sm:space-x-3 truncate">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="truncate">
            <h1 className="text-sm sm:text-lg font-bold text-slate-900 truncate max-w-[140px] xs:max-w-[220px] sm:max-w-md" title={exam.title}>
              {exam.title}
            </h1>
            <div className="flex items-center space-x-2 text-[11px] sm:text-xs text-slate-500 mt-0.5">
              <span>Đã làm <strong className="text-slate-900 font-semibold tabular-nums">{answeredCount}/{questions.length}</strong></span>
              <span>•</span>
              <span className="inline-flex items-center space-x-1 text-emerald-600 font-medium">
                <Cloud className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>{saveStatus === 'saving' ? 'Đang lưu…' : 'Đã lưu'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Countdown Timer & Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <div className={`flex items-center space-x-1.5 sm:space-x-2 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl font-mono tabular-nums text-xs sm:text-base font-bold transition shadow-2xs ${
            isUrgent 
              ? 'bg-rose-50 text-rose-700 border border-rose-300 animate-pulse' 
              : isWarning 
              ? 'bg-amber-50 text-amber-700 border border-amber-300 animate-pulse' 
              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
          }`}>
            <Clock className={`w-3.5 h-3.5 sm:w-5 sm:h-5 ${isUrgent ? 'animate-bounce' : ''}`} />
            <span>{formatTime(timeLeft)}</span>
          </div>

          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="flex items-center space-x-1 sm:space-x-1.5 px-3 sm:px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-xs sm:text-sm rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer min-h-[38px] sm:min-h-[44px]"
          >
            <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">{submitting ? 'Đang nộp...' : 'Nộp bài'}</span>
            <span className="xs:hidden">Nộp</span>
          </button>
        </div>
      </header>

      {/* Progress Bar & Anti-cheat alert */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4">
        {tabSwitches > 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between mb-3 shadow-2xs">
            <span className="font-semibold">⚠️ Giám sát thi: Bạn đã rời khỏi màn hình bài thi {tabSwitches} lần. Lịch sử chuyển đổi cửa sổ đang được tự động ghi nhận.</span>
          </div>
        )}
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-indigo-600 h-full transition-all duration-300"
            style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Question Panel */}
        <main className="lg:col-span-3 space-y-6">
          {currentQ ? (
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-xs">
              {/* Question Header */}
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl tabular-nums">
                    Câu {currentIndex + 1} / {questions.length}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-xl">
                    {currentQ.question_type === 'TRUE_FALSE' ? 'Đúng / Sai' : currentQ.question_type === 'SHORT_ANSWER' ? 'Điền khuyết / Trả lời ngắn' : 'Trắc nghiệm 1 đáp án'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => toggleBookmark(currentQ.id)}
                  className={`flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition cursor-pointer ${
                    bookmarked[currentQ.id] 
                      ? 'bg-amber-50 text-amber-800 border border-amber-300' 
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${bookmarked[currentQ.id] ? 'fill-amber-600 text-amber-600' : ''}`} />
                  <span>{bookmarked[currentQ.id] ? 'Đã đánh dấu' : 'Đánh dấu xem lại'}</span>
                </button>
              </div>

              {/* Question Content */}
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

              {/* Optional Question Image */}
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

              {/* Interactive Answers Section */}
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
                          name={`question-${currentQ.id}`}
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
                      const sqId = String(sq.id || sIdx);
                      const currentSubAnswers = answers[currentQ.id] || {};
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

              {/* Navigation controls */}
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
                {currentIndex === questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => handleSubmit(false)}
                    disabled={submitting}
                    className="min-h-[44px] flex items-center space-x-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm font-bold text-white transition shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                    <span>{submitting ? 'Đang nộp...' : 'Nộp bài'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                    className="min-h-[44px] flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-xs cursor-pointer active:scale-95"
                  >
                    <span>Câu sau</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/90 shadow-xs">
              <p className="text-slate-500 font-medium">Không tìm thấy câu hỏi nào trong đề thi này.</p>
            </div>
          )}
        </main>

        {/* Desktop Question Palette Sidebar (Hidden on mobile) */}
        <aside className="hidden lg:block bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs h-fit space-y-4 sticky top-20">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center space-x-1.5">
              <LayoutGrid className="w-4 h-4 text-indigo-600" />
              <span>Bảng câu hỏi</span>
            </h3>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full tabular-nums">
              {answeredCount}/{questions.length}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '' && answers[q.id] !== null && 
                (typeof answers[q.id] !== 'object' || Object.keys(answers[q.id]).length > 0);
              const isCurrent = idx === currentIndex;
              const isBookmarked = bookmarked[q.id];

              return (
                <button
                  key={q.id || idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-11 rounded-xl font-bold text-xs transition flex flex-col items-center justify-center relative cursor-pointer tabular-nums shadow-2xs active:scale-95 ${
                    isCurrent
                      ? 'ring-2 ring-indigo-500 bg-indigo-600 text-white shadow-xs'
                      : isAnswered
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{idx + 1}</span>
                  {isBookmarked && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white"></span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs text-slate-500 font-medium">
            <div className="flex items-center space-x-2">
              <span className="w-3.5 h-3.5 rounded-md bg-emerald-50 border border-emerald-300"></span>
              <span>Đã làm ({answeredCount})</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3.5 h-3.5 rounded-md bg-slate-50 border border-slate-200"></span>
              <span>Chưa làm ({Math.max(0, questions.length - answeredCount)})</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ml-0.5"></span>
              <span>Đánh dấu xem lại</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile Sticky Quick Navigation Bar (Screen width < lg) */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg px-3 py-2 z-40 lg:hidden flex items-center justify-between gap-2 safe-area-bottom">
        {/* Prev Question Button */}
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

        {/* Center: Open Question Palette Drawer Trigger Button */}
        <button
          type="button"
          onClick={() => setPaletteDrawerOpen(true)}
          className="flex-1 min-h-[44px] px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100/70 border border-indigo-200/80 rounded-xl text-indigo-900 flex items-center justify-center space-x-1.5 font-bold text-xs transition active:scale-95 cursor-pointer shadow-2xs"
        >
          <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="truncate">Câu {currentIndex + 1}/{questions.length}</span>
          <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold tabular-nums shrink-0">
            {answeredCount}/{questions.length}
          </span>
        </button>

        {/* Quick Bookmark Toggle Button */}
        {currentQ && (
          <button
            type="button"
            onClick={() => toggleBookmark(currentQ.id)}
            className={`min-w-[44px] min-h-[44px] rounded-xl border transition active:scale-95 flex items-center justify-center cursor-pointer shadow-2xs ${
              bookmarked[currentQ.id]
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Đánh dấu câu hỏi này"
            aria-label="Đánh dấu câu hỏi này"
          >
            <Bookmark className={`w-5 h-5 ${bookmarked[currentQ.id] ? 'fill-amber-500 text-amber-500' : ''}`} />
          </button>
        )}

        {/* Next / Submit Button */}
        {currentIndex === questions.length - 1 ? (
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="min-w-[44px] min-h-[44px] px-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl flex items-center justify-center font-bold text-xs transition cursor-pointer shadow-xs whitespace-nowrap"
          >
            <Send className="w-4 h-4 mr-1" />
            <span>Nộp</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
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
                  <span>Bảng câu hỏi bài thi</span>
                </h3>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full tabular-nums">
                  {answeredCount}/{questions.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPaletteDrawerOpen(false)}
                className="w-10 h-10 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition"
                aria-label="Đóng bảng câu hỏi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Tabs in Drawer */}
            <div className="flex items-center gap-1.5 py-2.5 overflow-x-auto border-b border-slate-100 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPaletteTab('ALL')}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer tabular-nums whitespace-nowrap ${
                  paletteTab === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả ({questions.length})
              </button>
              <button
                type="button"
                onClick={() => setPaletteTab('ANSWERED')}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer tabular-nums whitespace-nowrap ${
                  paletteTab === 'ANSWERED'
                    ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Đã làm ({answeredCount})
              </button>
              <button
                type="button"
                onClick={() => setPaletteTab('UNANSWERED')}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer tabular-nums whitespace-nowrap ${
                  paletteTab === 'UNANSWERED'
                    ? 'bg-slate-700 text-white shadow-2xs font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Chưa làm ({Math.max(0, questions.length - answeredCount)})
              </button>
              <button
                type="button"
                onClick={() => setPaletteTab('BOOKMARKED')}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer tabular-nums whitespace-nowrap ${
                  paletteTab === 'BOOKMARKED'
                    ? 'bg-amber-600 text-white shadow-2xs font-bold'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                Đánh dấu ({Object.values(bookmarked).filter(Boolean).length})
              </button>
            </div>

            {/* Question Grid (Touch targets >= 44x44px) */}
            <div className="grid grid-cols-5 gap-2.5 overflow-y-auto py-3.5 pr-1 flex-1">
              {questions
                .map((q, idx) => ({ q, idx }))
                .filter(({ q, idx }) => {
                  const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '' && answers[q.id] !== null && 
                    (typeof answers[q.id] !== 'object' || Object.keys(answers[q.id]).length > 0);
                  const isMarked = bookmarked[q.id];

                  if (paletteTab === 'ANSWERED') return isAnswered;
                  if (paletteTab === 'UNANSWERED') return !isAnswered;
                  if (paletteTab === 'BOOKMARKED') return isMarked;
                  return true;
                })
                .map(({ q, idx }) => {
                  const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '' && answers[q.id] !== null && 
                    (typeof answers[q.id] !== 'object' || Object.keys(answers[q.id]).length > 0);
                  const isCurrent = idx === currentIndex;
                  const isMarked = bookmarked[q.id];

                  return (
                    <button
                      key={q.id || idx}
                      onClick={() => {
                        setCurrentIndex(idx);
                        setPaletteDrawerOpen(false);
                      }}
                      className={`min-h-[46px] rounded-xl font-bold text-xs transition flex flex-col items-center justify-center relative cursor-pointer tabular-nums shadow-2xs active:scale-95 ${
                        isCurrent
                          ? 'ring-2 ring-indigo-500 bg-indigo-600 text-white shadow-xs'
                          : isAnswered
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{idx + 1}</span>
                      {isMarked && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white"></span>
                      )}
                    </button>
                  );
                })}
            </div>

            {/* Legend inside Drawer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-100 border border-emerald-300"></span>
                <span>Đã làm</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-md bg-slate-100 border border-slate-300"></span>
                <span>Chưa làm</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>Đã đánh dấu</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Modal */}
      {conflictModal && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full space-y-4 shadow-float border border-slate-200">
            <h3 className="text-lg font-bold text-rose-600 flex items-center space-x-2">
              <AlertCircle className="w-5 h-5" />
              <span>Phát hiện xung đột bài làm</span>
            </h3>
            <p className="text-sm text-slate-600">Dữ liệu bài làm đã được cập nhật từ một thiết bị hoặc phiên khác. Bạn có muốn đồng bộ lại không?</p>
            <div className="flex justify-end space-x-3 pt-2">
              <button 
                type="button"
                onClick={() => setConflictModal(false)} 
                className="min-h-[44px] px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Đóng
              </button>
              <button 
                type="button"
                onClick={() => { setAnswers(serverAnswers); setConflictModal(false); }} 
                className="min-h-[44px] px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 cursor-pointer shadow-xs"
              >
                Đồng bộ lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

