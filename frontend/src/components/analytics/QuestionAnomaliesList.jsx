import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  HelpCircle,
  Search,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { MathRenderer } from '../MathRenderer';

export function QuestionAnomaliesList({
  questions = [],
  loading = false,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [anomalyOnly, setAnomalyOnly] = useState(false);
  const [highErrorOnly, setHighErrorOnly] = useState(false);
  const [sortAsc, setSortAsc] = useState(false); // Default: highest error first

  const filteredQuestions = useMemo(() => {
    return questions
      .filter((q) => {
        const text = `${q.content || ''} ${q.code || ''} ${q.topic || ''}`.toLowerCase();
        const matchesSearch = text.includes(searchTerm.toLowerCase());
        const matchesAnomaly = !anomalyOnly || q.is_flagged_anomaly;
        const matchesError = !highErrorOnly || (100 - (q.accuracy_rate || 0)) >= 50;
        return matchesSearch && matchesAnomaly && matchesError;
      })
      .sort((a, b) => {
        const errorA = 100 - (a.accuracy_rate || 0);
        const errorB = 100 - (b.accuracy_rate || 0);
        return sortAsc ? errorA - errorB : errorB - errorA;
      });
  }, [questions, searchTerm, anomalyOnly, highErrorOnly, sortAsc]);

  const flaggedCount = questions.filter((q) => q.is_flagged_anomaly).length;

  return (
    <div className="space-y-6">
      {/* 1. Header Overview & Stats */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
                <span>Phân tích Item Analysis & Bẫy phương án nhiễu</span>
                {flaggedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                    {flaggedCount} câu bất thường
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500">
                Theo dõi tỷ lệ sai và phân tích tần suất học sinh bị đánh lừa bởi phương án nhiễu (Distractors)
              </p>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm nội dung câu hỏi, mã câu, chuyên đề..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
            />
          </div>

          <button
            type="button"
            onClick={() => setAnomalyOnly(!anomalyOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              anomalyOnly
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Chỉ câu có bẫy / bất thường ({flaggedCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setHighErrorOnly(!highErrorOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              highErrorOnly
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Tỷ lệ sai cao &ge; 50%</span>
          </button>

          <button
            type="button"
            onClick={() => setSortAsc(!sortAsc)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition flex items-center space-x-1.5"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {sortAsc ? 'Tỷ lệ sai tăng dần' : 'Tỷ lệ sai giảm dần'}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Questions List */}
      <div className="space-y-4">
        {filteredQuestions.length > 0 ? (
          filteredQuestions.map((q, idx) => {
            const errorRate = 100 - (q.accuracy_rate || 0);
            const isAnomaly = q.is_flagged_anomaly;

            return (
              <div
                key={q.question_id || idx}
                className={`bg-white rounded-2xl border p-5 shadow-xs transition-all ${
                  isAnomaly
                    ? 'border-rose-300 ring-1 ring-rose-200/60'
                    : errorRate >= 50
                      ? 'border-amber-200'
                      : 'border-slate-200/90'
                }`}
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-xs text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                      Câu #{q.question_id} {q.code ? `• ${q.code}` : ''}
                    </span>
                    {q.topic && (
                      <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                        {q.topic}
                      </span>
                    )}
                    {q.difficulty && (
                      <span className="text-xs font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                        {q.difficulty}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-900 tabular-nums">
                        {q.correct_count} / {q.total_attempts} đúng
                      </div>
                      <div className="text-[11px] font-semibold text-slate-400">
                        Tỷ lệ sai:{' '}
                        <span
                          className={`font-black tabular-nums ${
                            errorRate >= 65
                              ? 'text-rose-600'
                              : errorRate >= 50
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                          }`}
                        >
                          {errorRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {isAnomaly && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Bất thường / Bẫy</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Question Content with MathRenderer */}
                <div className="text-xs sm:text-sm text-slate-800 leading-relaxed font-normal mb-4 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                  <MathRenderer content={q.content || 'Nội dung câu hỏi'} />
                </div>

                {/* Anomaly Reason Warning Alert */}
                {q.anomaly_reason && (
                  <div className="mb-4 bg-rose-50/80 border border-rose-200 p-3 rounded-xl flex items-start space-x-2 text-xs text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Cảnh báo sư phạm: </span>
                      <span>{q.anomaly_reason}</span>
                    </div>
                  </div>
                )}

                {/* Distractor Analysis Grid */}
                {q.distractor_analysis && q.distractor_analysis.length > 0 && (
                  <div>
                    <h5 className="text-xs font-bold text-slate-700 mb-2">
                      Phân tích tần suất lựa chọn các phương án:
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {q.distractor_analysis.map((opt) => {
                        const isTrap =
                          !opt.is_correct && opt.percentage >= 40;
                        const isCorrect = opt.is_correct;

                        let cardStyle = 'bg-slate-50 border-slate-200 text-slate-700';
                        if (isCorrect) {
                          cardStyle =
                            'bg-emerald-50/80 border-emerald-300 text-emerald-900';
                        } else if (isTrap) {
                          cardStyle =
                            'bg-rose-50 border-rose-300 text-rose-900 ring-1 ring-rose-200';
                        }

                        return (
                          <div
                            key={opt.option_index}
                            className={`p-2.5 rounded-xl border text-xs relative ${cardStyle}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-black text-xs px-1.5 py-0.5 rounded-md bg-white/80 border border-current">
                                {opt.option_letter}
                              </span>
                              {isCorrect ? (
                                <span className="inline-flex items-center space-x-0.5 text-[10px] font-bold text-emerald-700">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Đáp án đúng</span>
                                </span>
                              ) : isTrap ? (
                                <span className="inline-flex items-center space-x-0.5 text-[10px] font-bold text-rose-700">
                                  <XCircle className="w-3 h-3" />
                                  <span>Bẫy gây nhiễu</span>
                                </span>
                              ) : null}
                            </div>

                            <div className="flex items-baseline justify-between mt-2">
                              <span className="text-sm font-extrabold tabular-nums">
                                {Number(opt.percentage || 0).toFixed(1)}%
                              </span>
                              <span className="text-[11px] text-slate-500 tabular-nums">
                                {opt.count} chọn
                              </span>
                            </div>

                            {/* Bar */}
                            <div className="w-full bg-slate-200/70 rounded-full h-1.5 mt-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isCorrect
                                    ? 'bg-emerald-500'
                                    : isTrap
                                      ? 'bg-rose-500'
                                      : 'bg-slate-400'
                                }`}
                                style={{
                                  width: `${Math.min(100, Math.max(0, opt.percentage || 0))}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              Không tìm thấy câu hỏi phù hợp
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {loading
                ? 'Đang tải dữ liệu phân tích...'
                : 'Chưa có câu hỏi nào thỏa mãn các điều kiện tìm kiếm hoặc bộ lọc hiện tại.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
