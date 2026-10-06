import React, { useState, useEffect } from 'react';
import { 
  X, Award, Clock, CheckCircle2, XCircle, AlertCircle, 
  HelpCircle, Eye, ChevronDown, ChevronUp, Filter, Sparkles, RefreshCw
} from 'lucide-react';
import { Modal } from './Modal';
import { MathRenderer } from './MathRenderer';
import api, { resolveImageUrl } from '../api/axios';

const QUESTION_TYPE_LABELS = {
  MULTIPLE_CHOICE: { label: 'Trắc nghiệm', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  TRUE_FALSE: { label: 'Đúng / Sai', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  SHORT_ANSWER: { label: 'Điền từ / Ngắn', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  ESSAY: { label: 'Tự luận', bg: 'bg-sky-50 text-sky-700 border-sky-200' },
};

const DIFFICULTY_LABELS = {
  NHAN_BIET: { label: 'Nhận biết', bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  THONG_HIEU: { label: 'Thông hiểu', bg: 'bg-blue-50 text-blue-600 border-blue-100' },
  VAN_DUNG: { label: 'Vận dụng', bg: 'bg-orange-50 text-orange-600 border-orange-100' },
  VAN_DUNG_CAO: { label: 'Vận dụng cao', bg: 'bg-rose-50 text-rose-600 border-rose-100' },
};

export function SubmissionReviewModal({ isOpen, onClose, submissionId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'correct' | 'incorrect'

  useEffect(() => {
    if (!isOpen || !submissionId) {
      setData(null);
      return;
    }

    setLoading(true);
    api.get(`/student/submissions/${submissionId}`)
      .then(res => {
        setData(res.data);
      })
      .catch(err => {
        console.error('Failed to load submission review:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, submissionId]);

  if (!isOpen) return null;

  const submission = data?.submission || {};
  const questions = data?.questions || [];
  const showAnswers = data?.show_answers ?? true;
  const gradedAnswers = submission?.graded_answers || {};
  const studentAnswers = submission?.answers || {};

  // Compute question statuses
  const evaluatedQuestions = questions.map((q, idx) => {
    const qId = String(q.id);
    const gradInfo = gradedAnswers[qId] || gradedAnswers[q.id];
    const userAns = studentAnswers[qId] !== undefined ? studentAnswers[qId] : studentAnswers[q.id];
    
    let isCorrect = false;
    let isAnswered = userAns !== undefined && userAns !== '' && userAns !== null;
    let earnedPoints = 0;

    if (gradInfo) {
      isCorrect = gradInfo.is_correct || gradInfo.correct || false;
      earnedPoints = gradInfo.points || (isCorrect ? 1 : 0);
    } else if (q.question_type === 'MULTIPLE_CHOICE') {
      isCorrect = Number(userAns) === Number(q.correct_option);
    } else if (q.question_type === 'SHORT_ANSWER') {
      isCorrect = String(userAns || '').trim().toLowerCase() === String(q.correct_answer || '').trim().toLowerCase();
    }

    return {
      ...q,
      originalIndex: idx + 1,
      userAns,
      isCorrect,
      isAnswered,
      earnedPoints
    };
  });

  const correctCount = evaluatedQuestions.filter(q => q.isCorrect).length;
  const incorrectCount = evaluatedQuestions.filter(q => q.isAnswered && !q.isCorrect).length;
  const unansweredCount = evaluatedQuestions.filter(q => !q.isAnswered).length;

  const filteredQuestions = evaluatedQuestions.filter(q => {
    if (filterType === 'correct') return q.isCorrect;
    if (filterType === 'incorrect') return !q.isCorrect;
    return true;
  });

  const scoreNum = Number(submission?.score ?? 0);
  const isPassed = scoreNum >= 5.0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={data?.exam_title ? `Xem lại bài làm: ${data.exam_title}` : 'Chi tiết bài làm'}
      maxWidth="max-w-4xl"
    >
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Đang tải chi tiết bài làm &amp; đáp án...</p>
        </div>
      ) : !data ? (
        <div className="py-12 text-center text-slate-500 text-sm">
          Không tìm thấy dữ liệu bài làm hoặc bạn không có quyền xem.
        </div>
      ) : (
        <div className="space-y-5">
          {/* Top Score Banner */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kết quả tổng thể</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  submission.grading_status === 'GRADED'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}>
                  {submission.grading_status === 'GRADED' ? 'Đã chấm điểm' : 'Chờ chấm tự luận'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white">{data.exam_title}</h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-0.5">
                {submission.submitted_at && (
                  <span className="flex items-center space-x-1 tabular-nums">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Nộp lúc: {new Date(submission.submitted_at).toLocaleString('vi-VN')}</span>
                  </span>
                )}
                {submission.time_spent && (
                  <span className="tabular-nums">• Thời gian: {Math.floor(submission.time_spent / 60)}p {submission.time_spent % 60}s</span>
                )}
                {submission.attempt_number && (
                  <span className="tabular-nums">• Lần làm bài #{submission.attempt_number}</span>
                )}
              </div>
            </div>

            {/* Score Ring / Pill */}
            <div className="flex items-center space-x-4 bg-slate-800 p-3.5 rounded-xl border border-slate-700 shadow-xs shrink-0">
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Điểm số</span>
                <div className="text-2xl font-black text-white flex items-baseline space-x-1">
                  <span className={`tabular-nums ${isPassed ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {scoreNum}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">/ 10</span>
                </div>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isPassed ? 'bg-emerald-900/60 text-emerald-400 border border-emerald-700/60' : 'bg-rose-900/60 text-rose-400 border border-rose-700/60'
              }`}>
                <Award className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Quick Stat Chips & Filter Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tabular-nums">
              <span className="text-slate-500 mr-1">Thống kê:</span>
              <span className="inline-flex items-center space-x-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">
                <span>Tổng: {questions.length} câu</span>
              </span>
              <span className="inline-flex items-center space-x-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Đúng: {correctCount}</span>
              </span>
              <span className="inline-flex items-center space-x-1 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 text-rose-800">
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>Sai: {incorrectCount}</span>
              </span>
              {unansweredCount > 0 && (
                <span className="inline-flex items-center space-x-1 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-amber-800">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Chưa làm: {unansweredCount}</span>
                </span>
              )}
            </div>

            {/* Filter buttons */}
            <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer tabular-nums ${
                  filterType === 'all' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tất cả ({questions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('correct')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer tabular-nums ${
                  filterType === 'correct' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                Đúng ({correctCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('incorrect')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer tabular-nums ${
                  filterType === 'incorrect' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                Sai / Thiếu ({incorrectCount + unansweredCount})
              </button>
            </div>
          </div>

          {!showAnswers && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Đề thi này được cấu hình không hiển thị đáp án và lời giải chi tiết cho học sinh.</span>
            </div>
          )}

          {/* Question List View */}
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {filteredQuestions.map((q) => {
              const typeInfo = QUESTION_TYPE_LABELS[q.question_type] || QUESTION_TYPE_LABELS.MULTIPLE_CHOICE;
              const diffInfo = DIFFICULTY_LABELS[q.difficulty] || DIFFICULTY_LABELS.THONG_HIEU;

              return (
                <div 
                  key={q.id}
                  className={`p-5 rounded-2xl border transition space-y-3.5 ${
                    q.isCorrect 
                      ? 'bg-white border-emerald-200 shadow-2xs' 
                      : q.isAnswered 
                        ? 'bg-white border-rose-200 shadow-2xs' 
                        : 'bg-gray-50/50 border-gray-200'
                  }`}
                >
                  {/* Question Header */}
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <div className="flex items-center space-x-2">
                      <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black ${
                        q.isCorrect 
                          ? 'bg-emerald-600 text-white' 
                          : q.isAnswered 
                            ? 'bg-rose-600 text-white' 
                            : 'bg-gray-200 text-gray-700'
                      }`}>
                        {q.originalIndex}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${typeInfo.bg}`}>
                        {typeInfo.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${diffInfo.bg}`}>
                        {diffInfo.label}
                      </span>
                      {q.subject && (
                        <span className="text-[11px] text-gray-400 font-medium">
                          {q.subject}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {q.isCorrect ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Chính xác</span>
                        </span>
                      ) : q.isAnswered ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-100 text-rose-800 rounded-xl text-xs font-bold">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Chưa đúng</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-xl text-xs font-bold">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Chưa trả lời</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question Content */}
                  <div className="text-sm font-medium text-gray-800 leading-relaxed">
                    {q.content && q.content.includes('/key') ? (
                      <div>
                        {q.content.split('/key').map((part, pIdx, arr) => (
                          <React.Fragment key={pIdx}>
                            <MathRenderer content={part} inline />
                            {pIdx < arr.length - 1 && (
                              <span className="inline-block mx-1.5 px-2.5 py-0.5 rounded-lg border border-dashed border-indigo-400 bg-indigo-50/70 text-indigo-700 font-bold text-xs align-middle">
                                {q.userAns || '______'}
                              </span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    ) : (
                      <MathRenderer content={q.content} />
                    )}
                  </div>

                  {/* Attached Image */}
                  {q.image_url && (
                    <div className="pt-1">
                      <img 
                        src={resolveImageUrl(q.image_url)} 
                        alt="Đính kèm câu hỏi" 
                        className="max-h-56 rounded-xl border border-gray-200 object-contain"
                      />
                    </div>
                  )}

                  {/* Options for MULTIPLE_CHOICE */}
                  {q.question_type === 'MULTIPLE_CHOICE' && Array.isArray(q.options) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {q.options.map((opt, optIdx) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        const isChosenByStudent = Number(q.userAns) === optIdx;
                        const isCorrectOption = Number(q.correct_option) === optIdx;

                        let cardStyle = 'bg-gray-50 border-gray-200 text-gray-700';
                        let badgeStyle = 'bg-gray-200 text-gray-700';

                        if (isCorrectOption && showAnswers) {
                          cardStyle = 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold';
                          badgeStyle = 'bg-emerald-600 text-white';
                        } else if (isChosenByStudent && !isCorrectOption) {
                          cardStyle = 'bg-rose-50 border-rose-300 text-rose-950 font-medium';
                          badgeStyle = 'bg-rose-600 text-white';
                        }

                        return (
                          <div 
                            key={optIdx}
                            className={`p-3 rounded-xl border flex items-start space-x-2.5 text-xs transition ${cardStyle}`}
                          >
                            <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 ${badgeStyle}`}>
                              {letter}
                            </span>
                            <div className="flex-1 overflow-hidden leading-relaxed">
                              <MathRenderer content={opt} />
                            </div>

                            {/* Badges for student choice & correct */}
                            <div className="shrink-0 flex items-center space-x-1">
                              {isChosenByStudent && (
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  isCorrectOption ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                                }`}>
                                  Bạn chọn
                                </span>
                              )}
                              {isCorrectOption && showAnswers && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Sub-questions for TRUE_FALSE */}
                  {q.question_type === 'TRUE_FALSE' && Array.isArray(q.sub_questions) && (
                    <div className="space-y-2 pt-1">
                      {q.sub_questions.map((sub, sIdx) => {
                        const letter = String.fromCharCode(97 + sIdx);
                        const userSubAns = q.userAns ? q.userAns[sIdx] : undefined;
                        const isSubCorrect = showAnswers ? (userSubAns === sub.answer) : null;

                        return (
                          <div 
                            key={sIdx}
                            className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs"
                          >
                            <div className="flex items-start space-x-2 flex-1">
                              <span className="font-bold text-gray-500 shrink-0">{letter})</span>
                              <div className="text-gray-800">
                                <MathRenderer content={sub.statement} />
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 shrink-0">
                              <div className="flex items-center space-x-1">
                                <span className="text-[11px] text-gray-400">Bạn chọn:</span>
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                  userSubAns === true ? 'bg-emerald-100 text-emerald-800' : 
                                  userSubAns === false ? 'bg-rose-100 text-rose-800' : 'bg-gray-200 text-gray-600'
                                }`}>
                                  {userSubAns === true ? 'ĐÚNG' : userSubAns === false ? 'SAI' : 'Chưa chọn'}
                                </span>
                              </div>

                              {showAnswers && (
                                <div className="flex items-center space-x-1 pl-2 border-l border-gray-200">
                                  <span className="text-[11px] text-gray-400">Đáp án:</span>
                                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                                    sub.answer ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                                  }`}>
                                    {sub.answer ? 'ĐÚNG' : 'SAI'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* SHORT_ANSWER display */}
                  {q.question_type === 'SHORT_ANSWER' && (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-gray-600">Câu trả lời của bạn:</span>
                        <code className={`px-2 py-0.5 rounded font-mono font-bold ${
                          q.isCorrect ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                        }`}>
                          {q.userAns || '(Chưa điền)'}
                        </code>
                      </div>
                      {showAnswers && q.correct_answer && (
                        <div className="flex items-center space-x-2 pt-1 border-t border-gray-200 text-emerald-900">
                          <span className="font-semibold">Đáp án chính xác:</span>
                          <code className="bg-emerald-100 px-2 py-0.5 rounded font-mono font-bold text-emerald-900">
                            {q.correct_answer}
                          </code>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ESSAY display */}
                  {q.question_type === 'ESSAY' && (
                    <div className="space-y-2 pt-1 text-xs">
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                        <span className="font-bold text-gray-700 block mb-1">Bài làm của bạn:</span>
                        <div className="whitespace-pre-wrap text-gray-800 font-mono text-[11px]">
                          {q.userAns || '(Không có nội dung bài làm)'}
                        </div>
                      </div>
                      {showAnswers && q.sample_solution && (
                        <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                          <span className="font-bold text-indigo-700 block mb-1">Hướng dẫn chấm / Lời giải mẫu:</span>
                          <div className="text-slate-800 leading-relaxed text-xs">
                            <MathRenderer content={q.sample_solution} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Explanation Section */}
                  {showAnswers && q.explanation && (
                    <div className="p-3.5 bg-indigo-50/40 border border-indigo-100 rounded-xl text-xs text-slate-800 space-y-1">
                      <div className="font-bold text-indigo-700 flex items-center space-x-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Lời giải chi tiết:</span>
                      </div>
                      <div className="leading-relaxed">
                        <MathRenderer content={q.explanation} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer action */}
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
