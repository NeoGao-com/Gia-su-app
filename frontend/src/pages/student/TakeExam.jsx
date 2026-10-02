import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { resolveImageUrl } from '../../api/axios';
import { 
  Clock, AlertCircle, Bookmark, ChevronLeft, ChevronRight, 
  CheckCircle2, Cloud, Send, Flag, Sparkles, X, Check
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
      <div className="min-h-screen bg-pastel-bg flex flex-col items-center justify-center space-y-3">
        <div className="w-12 h-12 border-4 border-pastel-purple/30 border-t-pastel-purple rounded-full animate-spin" />
        <div className="text-pastel-purpleDark font-semibold text-base animate-pulse">Đang chuẩn bị đề thi...</div>
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
    <div className="min-h-screen bg-[#f8f9fe] pb-16 font-sans">
      {/* Sticky Exam Top Bar */}
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-xs sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex justify-between items-center transition">
        <div className="flex items-center space-x-3 truncate">
          <div className="w-10 h-10 rounded-2xl bg-pastel-purple/10 flex items-center justify-center text-pastel-purpleDark shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="truncate">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">{exam.title}</h1>
            <div className="flex items-center space-x-2 text-xs text-gray-500 mt-0.5">
              <span>Đã trả lời <strong className="text-gray-900 font-semibold">{answeredCount}/{questions.length}</strong> câu</span>
              <span>•</span>
              <span className="inline-flex items-center space-x-1 text-emerald-600 font-medium">
                <Cloud className="w-3.5 h-3.5" />
                <span>{saveStatus === 'saving' ? 'Đang lưu...' : 'Tự động lưu'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Countdown Timer */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className={`flex items-center space-x-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl font-mono text-sm sm:text-base font-bold transition ${
            isUrgent 
              ? 'bg-rose-50 text-rose-600 border border-rose-200 animate-pulse' 
              : isWarning 
              ? 'bg-amber-50 text-amber-600 border border-amber-200 animate-pulse' 
              : 'bg-purple-50 text-pastel-purpleDark border border-purple-100'
          }`}>
            <Clock className={`w-4 h-4 sm:w-5 sm:h-5 ${isUrgent ? 'animate-bounce' : ''}`} />
            <span>{formatTime(timeLeft)}</span>
          </div>

          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="flex items-center space-x-1.5 px-4 sm:px-6 py-2 bg-gradient-to-r from-pastel-purple to-pastel-purpleDark text-white font-bold text-xs sm:text-sm rounded-2xl hover:opacity-95 transition shadow-sm hover:shadow disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Đang nộp...' : 'Nộp bài'}</span>
          </button>
        </div>
      </header>

      {/* Progress Bar & Anti-cheat alert */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4">
        {tabSwitches > 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2.5 rounded-2xl flex items-center justify-between mb-3 shadow-2xs">
            <span className="font-semibold">⚠️ Giám sát thi: Bạn đã rời khỏi màn hình bài thi {tabSwitches} lần. Lịch sử chuyển đổi cửa sổ đang được tự động lưu.</span>
          </div>
        )}
        <div className="w-full bg-gray-200/80 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-gradient-to-r from-pastel-purple to-pastel-purpleDark h-full transition-all duration-300"
            style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Question Panel */}
        <main className="lg:col-span-3 space-y-6">
          {currentQ ? (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-card">
              {/* Question Header */}
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold px-3 py-1 bg-pastel-purple/10 text-pastel-purpleDark rounded-xl">
                    Câu {currentIndex + 1} / {questions.length}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 text-gray-600 rounded-xl">
                    {currentQ.question_type === 'TRUE_FALSE' ? 'Đúng / Sai' : currentQ.question_type === 'SHORT_ANSWER' ? 'Điền khuyết / Trả lời ngắn' : 'Trắc nghiệm 1 đáp án'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => toggleBookmark(currentQ.id)}
                  className={`flex items-center space-x-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition ${
                    bookmarked[currentQ.id] 
                      ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${bookmarked[currentQ.id] ? 'fill-amber-600 text-amber-600' : ''}`} />
                  <span>{bookmarked[currentQ.id] ? 'Đã ghim xem lại' : 'Đánh dấu xem lại'}</span>
                </button>
              </div>

              {/* Question Content */}
              <div className="text-base sm:text-lg font-medium text-gray-900 mb-6 leading-relaxed">
                {currentQ.content && currentQ.content.includes('/key') ? (
                  <div>
                    {currentQ.content.split('/key').map((part, pIdx, arr) => (
                      <React.Fragment key={pIdx}>
                        <span>{part}</span>
                        {pIdx < arr.length - 1 && (
                          <input
                            type="text"
                            value={typeof answers[currentQ.id] === 'string' ? answers[currentQ.id] : ''}
                            onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                            placeholder="(Điền đáp án)"
                            className="inline-block mx-2 px-3 py-1 border-b-2 border-pastel-purple bg-purple-50/60 rounded-xl text-pastel-purpleDark font-bold w-40 text-center focus:outline-none focus:bg-purple-100/70"
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
                    className="max-h-72 rounded-2xl border border-gray-200 shadow-xs object-contain" 
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                  />
                </div>
              )}

              {/* Interactive Answers Section */}
              <div className="space-y-3.5 pt-2">
                {currentQ.question_type === 'MULTIPLE_CHOICE' || currentQ.question_type === 'SINGLE_CHOICE' || !currentQ.question_type ? (
                  currentQ.options && currentQ.options.map((opt, idx) => {
                    const optContent = typeof opt === 'string' ? opt : (opt.content ?? '');
                    const optValue = idx;
                    const isSelected = answers[currentQ.id] !== undefined && Number(answers[currentQ.id]) === optValue;
                    const letter = String.fromCharCode(65 + idx);

                    return (
                      <label
                        key={idx}
                        className={`flex items-start space-x-3.5 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-pastel-purple bg-purple-50/50 text-gray-900 shadow-xs ring-1 ring-pastel-purple/20'
                            : 'border-gray-200/90 hover:border-purple-200 hover:bg-gray-50/60 text-gray-700'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center text-sm shrink-0 transition ${
                          isSelected 
                            ? 'bg-pastel-purple text-white shadow-xs' 
                            : 'bg-gray-100 text-gray-600'
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
                        <div className="flex-1 pt-1 text-sm sm:text-base leading-relaxed">
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
                        <div key={sqId} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-gray-200 bg-gray-50/50 gap-3">
                          <div className="text-gray-800 text-sm font-medium flex-1">
                            <span className="font-bold mr-2 text-pastel-purpleDark">Ý {sIdx + 1}:</span>
                            <span>{sq.text || sq.statement || `Khẳng định ${sIdx + 1}`}</span>
                          </div>
                          <div className="flex space-x-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                const newSub = { ...currentSubAnswers, [sqId]: true };
                                handleAnswerChange(currentQ.id, newSub);
                              }}
                              className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
                                subVal === true 
                                  ? 'bg-emerald-600 text-white shadow-xs' 
                                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Đúng</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const newSub = { ...currentSubAnswers, [sqId]: false };
                                handleAnswerChange(currentQ.id, newSub);
                              }}
                              className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
                                subVal === false 
                                  ? 'bg-rose-600 text-white shadow-xs' 
                                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-rose-50'
                              }`}
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Sai</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : currentQ.question_type === 'SHORT_ANSWER' && !currentQ.content.includes('/key') ? (
                  <input
                    type="text"
                    value={typeof answers[currentQ.id] === 'string' ? answers[currentQ.id] : ''}
                    onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                    placeholder="Nhập câu trả lời của bạn..."
                    className="w-full p-4 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-pastel-purple text-gray-900 bg-white"
                  />
                ) : null}
              </div>

              {/* Navigation controls */}
              <div className="flex justify-between items-center pt-6 mt-8 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="flex items-center space-x-1.5 px-5 py-2.5 rounded-2xl border border-gray-200 text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 transition shadow-xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Câu trước</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                  disabled={currentIndex === questions.length - 1}
                  className="flex items-center space-x-1.5 px-5 py-2.5 rounded-2xl bg-pastel-purple text-xs font-bold text-white hover:bg-pastel-purpleDark disabled:opacity-40 transition shadow-sm"
                >
                  <span>Câu sau</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-card">
              <p className="text-gray-500 font-medium">Không tìm thấy câu hỏi nào trong đề thi này.</p>
            </div>
          )}
        </main>

        {/* Question Palette Sidebar */}
        <aside className="bg-white rounded-3xl p-6 border border-gray-100 shadow-card h-fit space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wider">Bảng câu hỏi</h3>
            <span className="text-xs font-bold text-pastel-purpleDark bg-purple-50 px-2.5 py-0.5 rounded-full">
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
                  className={`h-11 rounded-2xl font-bold text-xs transition flex flex-col items-center justify-center relative shadow-xs ${
                    isCurrent
                      ? 'ring-2 ring-pastel-purple bg-pastel-purple text-white shadow-md'
                      : isAnswered
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
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
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-xs text-gray-500 font-medium">
            <div className="flex items-center space-x-2">
              <span className="w-3.5 h-3.5 rounded-lg bg-emerald-50 border border-emerald-300"></span>
              <span>Đã trả lời ({answeredCount})</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3.5 h-3.5 rounded-lg bg-gray-50 border border-gray-200"></span>
              <span>Chưa làm ({Math.max(0, questions.length - answeredCount)})</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ml-0.5"></span>
              <span>Đánh dấu xem lại</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Conflict Modal */}
      {conflictModal && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-3xl max-w-md w-full space-y-4 shadow-float">
            <h3 className="text-lg font-bold text-red-600 flex items-center space-x-2">
              <AlertCircle className="w-5 h-5" />
              <span>Phát hiện xung đột bài làm</span>
            </h3>
            <p className="text-sm text-gray-600">Dữ liệu bài làm đã được cập nhật từ một thiết bị hoặc phiên khác. Bạn có muốn đồng bộ lại không?</p>
            <div className="flex justify-end space-x-3 pt-2">
              <button 
                type="button"
                onClick={() => setConflictModal(false)} 
                className="px-4 py-2 border rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Đóng
              </button>
              <button 
                type="button"
                onClick={() => { setAnswers(serverAnswers); setConflictModal(false); }} 
                className="px-4 py-2 bg-pastel-purple text-white rounded-xl text-sm font-bold hover:bg-pastel-purpleDark"
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
