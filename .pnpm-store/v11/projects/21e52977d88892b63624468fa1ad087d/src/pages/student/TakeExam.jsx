import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { resolveImageUrl } from '../../api/axios';
import { Clock, AlertCircle, Bookmark, ChevronLeft, ChevronRight } from 'lucide-react';
import { MathRenderer } from '../../components/MathRenderer';

export function TakeExam() {
  const params = useParams();
  const examId = params.examId || params.id;
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [submissionId, setSubmissionId] = useState(null);
  const [version, setVersion] = useState(1);
  const [answers, setAnswers] = useState({});
  const [bookmarked, setBookmarked] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
        alert(err.response?.data?.detail || 'Không thể bắt đầu bài thi');
        navigate('/exams');
      } finally {
        setLoading(false);
      }
    };
    initExam();
  }, [examId, navigate]);

  const handleSubmit = useCallback(async (isAuto = false) => {
    if (!isAuto && !window.confirm('Bạn có chắc chắn muốn nộp bài thi này không?')) {
      return;
    }
    if (submitting) return;
    setSubmitting(true);

    try {
      await api.post(`/student/submissions/${submissionId}/submit`, {
        exam_id: parseInt(examId),
        answers: answers,
        time_spent: exam ? (exam.duration_minutes * 60 - timeLeft) : 0
      });
      navigate('/history');
    } catch (err) {
      alert(err.response?.data?.detail || 'Nộp bài thất bại. Vui lòng thử lại.');
      setSubmitting(false);
    }
  }, [submitting, submissionId, examId, answers, exam, timeLeft, navigate]);

  const versionRef = useRef(version);
  useEffect(() => {
    versionRef.current = version;
  }, [version]);

  const handleAnswerChange = useCallback((questionId, value) => {
    setAnswers(prev => {
      const updatedAnswers = { ...prev, [questionId]: value };
      if (submissionId && !submitting) {
        api.post(`/student/submissions/${submissionId}/save`, {
          answers: updatedAnswers,
          version: versionRef.current
        })
        .then(res => {
          if (res.data?.version) {
            setVersion(res.data.version);
            versionRef.current = res.data.version;
          }
        })
        .catch(err => {
          if (err.response?.status === 409) {
            setServerAnswers(err.response.data.detail?.current_answers || {});
            setConflictModal(true);
          }
        });
      }
      return updatedAnswers;
    });
  }, [submissionId, submitting]);

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
            handleSubmit(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, loading, handleSubmit]);

  if (loading || !exam) {
    return (
      <div className="min-h-screen bg-pastel-bg flex items-center justify-center">
        <div className="text-pastel-purpleDark font-medium text-lg animate-pulse">Đang tải đề thi...</div>
      </div>
    );
  }

  const questions = exam.questions || [];
  const currentQ = questions[currentIndex];

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(answers).filter(k => answers[k] !== undefined && answers[k] !== '' && answers[k] !== null).length;

  return (
    <div className="min-h-screen bg-pastel-bg pb-16">
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50 px-8 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-gray-800">{exam.title}</h1>
          <p className="text-xs text-gray-500">Đã trả lời: {answeredCount}/{questions.length} câu</p>
        </div>

        <div className={`flex items-center space-x-2 px-4 py-2 rounded-2xl font-bold ${timeLeft < 300 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-pastel-bg text-pastel-purpleDark'}`}>
          <Clock className="w-5 h-5" />
          <span>{formatTime(timeLeft)}</span>
        </div>

        <button
          onClick={() => handleSubmit(false)}
          disabled={submitting}
          className="px-6 py-2 bg-pastel-purple text-white font-medium rounded-xl hover:bg-pastel-purpleDark transition shadow-sm disabled:opacity-50"
        >
          {submitting ? 'Đang nộp...' : 'Nộp bài'}
        </button>
      </header>

      <div className="max-w-7xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        <main className="lg:col-span-3 space-y-6">
          {currentQ && (
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <span className="text-sm font-semibold px-3 py-1 bg-pastel-bg text-pastel-purpleDark rounded-full">
                  Câu {currentIndex + 1} / {questions.length} ({currentQ.question_type || 'MULTIPLE_CHOICE'})
                </span>
                <button
                  onClick={() => toggleBookmark(currentQ.id)}
                  className={`flex items-center space-x-1 text-sm font-medium px-3 py-1 rounded-full transition ${
                    bookmarked[currentQ.id] ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                  <span>{bookmarked[currentQ.id] ? 'Đã đánh dấu' : 'Đánh dấu'}</span>
                </button>
              </div>

              {/* Question Content with /key syntax support */}
              <div className="text-lg font-semibold text-gray-800 mb-6 leading-relaxed">
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
                            placeholder="(Điền vào đây)"
                            className="inline-block mx-2 px-3 py-1 border-b-2 border-pastel-purple bg-purple-50/50 rounded-lg text-pastel-purpleDark font-bold w-36 text-center focus:outline-none"
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <MathRenderer content={currentQ.content} />
                )}
              </div>

              {currentQ.image_url && (
                <div className="mb-6">
                  <img src={resolveImageUrl(currentQ.image_url)} alt="Minh họa" className="max-h-64 rounded-xl border" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                </div>
              )}

              {/* Options */}
              <div className="space-y-3">
                {currentQ.question_type === 'MULTIPLE_CHOICE' || currentQ.question_type === 'SINGLE_CHOICE' || !currentQ.question_type ? (
                  currentQ.options && currentQ.options.map((opt, idx) => {
                    const optContent = typeof opt === 'string' ? opt : (opt.content ?? '');
                    const optValue = idx;
                    const isSelected = answers[currentQ.id] !== undefined && Number(answers[currentQ.id]) === optValue;
                    const letter = String.fromCharCode(65 + idx);

                    return (
                      <label
                        key={idx}
                        className={`flex items-center space-x-3 p-4 rounded-2xl border cursor-pointer transition ${
                          isSelected
                            ? 'border-pastel-purple bg-pastel-bg text-pastel-purpleDark font-medium shadow-xs'
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`question-${currentQ.id}`}
                          checked={isSelected}
                          onChange={() => handleAnswerChange(currentQ.id, optValue)}
                          className="text-pastel-purple focus:ring-pastel-purple"
                        />
                        <span className="font-bold mr-1">{letter}.</span>
                        <div className="flex-1">
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
                        <div key={sqId} className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 bg-gray-50/50">
                          <span className="text-gray-700 text-sm font-medium flex-1 mr-4">
                            {sq.text || sq.statement || `Ý ${sIdx + 1}`}
                          </span>
                          <div className="flex space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                const newSub = { ...currentSubAnswers, [sqId]: true };
                                handleAnswerChange(currentQ.id, newSub);
                              }}
                              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                                subVal === true ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-700 hover:bg-emerald-50'
                              }`}
                            >
                              Đúng
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const newSub = { ...currentSubAnswers, [sqId]: false };
                                handleAnswerChange(currentQ.id, newSub);
                              }}
                              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                                subVal === false ? 'bg-red-600 text-white' : 'bg-white border text-gray-700 hover:bg-red-50'
                              }`}
                            >
                              Sai
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
                    className="w-full p-4 rounded-2xl border border-gray-200 focus:outline-none focus:border-pastel-purple text-gray-800"
                  />
                ) : null}
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-100">
                <button
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="flex items-center space-x-1.5 px-5 py-2.5 rounded-2xl border border-gray-200 text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 transition shadow-2xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Câu trước</span>
                </button>
                <button
                  onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                  disabled={currentIndex === questions.length - 1}
                  className="flex items-center space-x-1.5 px-5 py-2.5 rounded-2xl bg-purple-600 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-40 transition shadow-md shadow-purple-500/20"
                >
                  <span>Câu sau</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Question Palette Sidebar */}
        <aside className="bg-white rounded-3xl p-6 border border-purple-100/60 shadow-xl shadow-purple-900/5 h-fit space-y-4">
          <h3 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Danh sách câu hỏi</h3>
          <div className="grid grid-cols-5 gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '' && answers[q.id] !== null && (typeof answers[q.id] !== 'object' || Object.keys(answers[q.id]).length > 0);
              const isCurrent = idx === currentIndex;
              const isBookmarked = bookmarked[q.id];
              return (
                <button
                  key={q.id || idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-11 rounded-2xl font-bold text-xs transition flex flex-col items-center justify-center relative shadow-2xs ${
                    isCurrent
                      ? 'ring-2 ring-purple-600 bg-purple-600 text-white shadow-md shadow-purple-500/30'
                      : isAnswered
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <span>{idx + 1}</span>
                  {isBookmarked && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500"></span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5 text-[11px] text-gray-500 font-medium">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-lg bg-emerald-50 border border-emerald-200"></span>
              <span>Đã trả lời ({answeredCount})</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-lg bg-gray-50 border border-gray-200"></span>
              <span>Chưa trả lời</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 ml-0.5"></span>
              <span>Đã đánh dấu</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Conflict Modal */}
      {conflictModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-3xl max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-red-600 flex items-center space-x-2">
              <AlertCircle className="w-5 h-5" />
              <span>Phát hiện xung đột dữ liệu</span>
            </h3>
            <p className="text-sm text-gray-600">Dữ liệu bài làm đã được cập nhật từ một phiên bản khác. Bạn có muốn đồng bộ lại không?</p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setConflictModal(false)} className="px-4 py-2 border rounded-xl text-sm font-semibold">Đóng</button>
              <button onClick={() => { setAnswers(serverAnswers); setConflictModal(false); }} className="px-4 py-2 bg-pastel-purple text-white rounded-xl text-sm font-bold">Đồng bộ lại</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
