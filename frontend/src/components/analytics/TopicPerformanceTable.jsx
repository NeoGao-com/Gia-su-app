import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Brain,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const MASTERY_CONFIG = {
  MASTERED: {
    label: 'Thành thạo',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    progressClass: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  GOOD: {
    label: 'Khá',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    progressClass: 'bg-blue-500',
    icon: CheckCircle2,
  },
  SATISFACTORY: {
    label: 'Cần củng cố',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    progressClass: 'bg-amber-500',
    icon: AlertTriangle,
  },
  NEEDS_IMPROVEMENT: {
    label: 'Báo động yếu',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    progressClass: 'bg-rose-500',
    icon: AlertTriangle,
  },
};

export function TopicPerformanceTable({
  topics = [],
  difficultySummary = [],
  questionTypeSummary = [],
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [masteryFilter, setMasteryFilter] = useState('ALL');
  const [sortField, setSortField] = useState('accuracy_rate');
  const [sortAsc, setSortAsc] = useState(false); // default highest to lowest or vice versa
  const [expandedTopics, setExpandedTopics] = useState(new Set());

  const toggleTopicExpand = (topicName) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicName)) {
        next.delete(topicName);
      } else {
        next.add(topicName);
      }
      return next;
    });
  };

  const getMasteryKey = (topic) => {
    if (topic.mastery_level && MASTERY_CONFIG[topic.mastery_level]) {
      return topic.mastery_level;
    }
    const acc = topic.accuracy_rate ?? 0;
    if (acc >= 80) return 'MASTERED';
    if (acc >= 65) return 'GOOD';
    if (acc >= 50) return 'SATISFACTORY';
    return 'NEEDS_IMPROVEMENT';
  };

  const filteredTopics = useMemo(() => {
    return topics
      .filter((t) => {
        const matchesSearch =
          (t.topic || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (t.chapter || '').toLowerCase().includes(searchTerm.toLowerCase());
        const masteryKey = getMasteryKey(t);
        const matchesMastery =
          masteryFilter === 'ALL' || masteryKey === masteryFilter;
        return matchesSearch && matchesMastery;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [topics, searchTerm, masteryFilter, sortField, sortAsc]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Cognitive Difficulty & Question Type Summaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cognitive Difficulty Summary */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Phân bố theo Cấp độ Nhận thức
              </h3>
              <p className="text-xs text-slate-500">
                Tỷ lệ làm đúng theo 4 mức độ: Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {difficultySummary.length > 0 ? (
              difficultySummary.map((item) => (
                <div key={item.difficulty} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      {item.difficulty}
                    </span>
                    <span className="tabular-nums font-bold text-slate-900">
                      {Number(item.accuracy_rate || 0).toFixed(1)}%{' '}
                      <span className="text-[11px] font-normal text-slate-400">
                        ({item.correct}/{item.total} câu)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.accuracy_rate >= 75
                          ? 'bg-emerald-500'
                          : item.accuracy_rate >= 50
                            ? 'bg-blue-500'
                            : 'bg-rose-500'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(0, item.accuracy_rate || 0))}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic py-2">
                Chưa có dữ liệu độ khó cho các bài thi đã làm.
              </p>
            )}
          </div>
        </div>

        {/* Question Type Summary */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                Độ chính xác theo Dạng câu hỏi
              </h3>
              <p className="text-xs text-slate-500">
                Hiệu suất trả lời theo trắc nghiệm đơn, đúng/sai, tự luận ngắn
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {questionTypeSummary.length > 0 ? (
              questionTypeSummary.map((item) => (
                <div key={item.question_type} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      {item.question_type}
                    </span>
                    <span className="tabular-nums font-bold text-slate-900">
                      {Number(item.accuracy_rate || 0).toFixed(1)}%{' '}
                      <span className="text-[11px] font-normal text-slate-400">
                        ({item.correct}/{item.total} lượt)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.accuracy_rate >= 75
                          ? 'bg-emerald-500'
                          : item.accuracy_rate >= 50
                            ? 'bg-indigo-500'
                            : 'bg-amber-500'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(0, item.accuracy_rate || 0))}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic py-2">
                Chưa có dữ liệu thống kê dạng câu hỏi.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Topic Performance Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Table Controls Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Bảng ma trận Chuyên đề & Đánh giá năng lực ({filteredTopics.length})
            </h3>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm chuyên đề, chương..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition"
              />
            </div>

            {/* Mastery Level Filter */}
            <select
              value={masteryFilter}
              onChange={(e) => setMasteryFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition"
            >
              <option value="ALL">Tất cả mức độ</option>
              <option value="MASTERED">Thành thạo (&ge;80%)</option>
              <option value="GOOD">Khá (65-79%)</option>
              <option value="SATISFACTORY">Cần củng cố (50-64%)</option>
              <option value="NEEDS_IMPROVEMENT">Báo động yếu (&lt;50%)</option>
            </select>
          </div>
        </div>

        {/* Table Component */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200/80 text-slate-600 font-semibold">
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('topic')}
                    className="inline-flex items-center space-x-1 hover:text-slate-900 transition"
                  >
                    <span>Chuyên đề & Chương</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-4 text-center">
                  <button
                    type="button"
                    onClick={() => handleSort('accuracy_rate')}
                    className="inline-flex items-center space-x-1 hover:text-slate-900 transition"
                  >
                    <span>Tỷ lệ chính xác</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-4 text-center">Mức độ làm chủ</th>
                <th className="py-3 px-4 text-center">
                  <button
                    type="button"
                    onClick={() => handleSort('total_attempts')}
                    className="inline-flex items-center space-x-1 hover:text-slate-900 transition"
                  >
                    <span>Lượt làm bài</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-4 text-center">Số câu hỏi</th>
                <th className="py-3 px-4 text-center">Chi tiết độ khó</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTopics.length > 0 ? (
                filteredTopics.map((topic) => {
                  const masteryKey = getMasteryKey(topic);
                  const mastery =
                    MASTERY_CONFIG[masteryKey] ||
                    MASTERY_CONFIG.NEEDS_IMPROVEMENT;
                  const isExpanded = expandedTopics.has(topic.topic);
                  const hasDifficultyBreakdown =
                    topic.difficulty_breakdown &&
                    Object.keys(topic.difficulty_breakdown).length > 0;

                  return (
                    <React.Fragment key={topic.topic}>
                      <tr className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 text-sm">
                            {topic.topic}
                          </div>
                          {topic.chapter && (
                            <div className="text-slate-400 text-[11px] mt-0.5">
                              {topic.chapter}
                            </div>
                          )}
                        </td>

                        {/* Accuracy Rate */}
                        <td className="py-3.5 px-4 text-center min-w-[140px]">
                          <div className="flex items-center justify-center space-x-2">
                            <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${mastery.progressClass}`}
                                style={{
                                  width: `${Math.min(100, Math.max(0, topic.accuracy_rate || 0))}%`,
                                }}
                              />
                            </div>
                            <span className="font-extrabold text-slate-900 tabular-nums">
                              {Number(topic.accuracy_rate || 0).toFixed(1)}%
                            </span>
                          </div>
                        </td>

                        {/* Mastery Badge */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${mastery.badgeClass}`}
                          >
                            <mastery.icon className="w-3 h-3" />
                            <span>{mastery.label}</span>
                          </span>
                        </td>

                        {/* Attempts */}
                        <td className="py-3.5 px-4 text-center tabular-nums text-slate-600 font-medium">
                          {topic.correct_attempts} / {topic.total_attempts} đúng
                        </td>

                        {/* Question Count */}
                        <td className="py-3.5 px-4 text-center tabular-nums text-slate-600 font-medium">
                          {topic.question_count} câu
                        </td>

                        {/* Expand Details */}
                        <td className="py-3.5 px-4 text-center">
                          {hasDifficultyBreakdown ? (
                            <button
                              type="button"
                              onClick={() => toggleTopicExpand(topic.topic)}
                              className="p-1 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                              title="Xem chi tiết các cấp độ nhận thức"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Difficulty Breakdown Row */}
                      {isExpanded && hasDifficultyBreakdown && (
                        <tr className="bg-indigo-50/40">
                          <td colSpan={6} className="py-3 px-6">
                            <div className="text-xs font-semibold text-indigo-900 mb-2">
                              Phân tích mức độ nhận thức của chuyên đề &ldquo;
                              {topic.topic}&rdquo;:
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {Object.entries(topic.difficulty_breakdown).map(
                                ([diffName, diffStat]) => (
                                  <div
                                    key={diffName}
                                    className="bg-white p-2.5 rounded-xl border border-indigo-100 shadow-2xs"
                                  >
                                    <div className="text-[11px] font-bold text-slate-700">
                                      {diffName}
                                    </div>
                                    <div className="flex items-baseline justify-between mt-1">
                                      <span className="text-xs font-black text-slate-900 tabular-nums">
                                        {Number(
                                          diffStat.accuracy || 0
                                        ).toFixed(1)}
                                        %
                                      </span>
                                      <span className="text-[10px] text-slate-400 tabular-nums">
                                        {diffStat.correct}/{diffStat.total} đúng
                                      </span>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-medium">
                      Không tìm thấy chuyên đề phù hợp với bộ lọc.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
