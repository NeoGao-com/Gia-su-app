import React, { useState } from 'react';
import {
  Sparkles,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  UserX,
  BookOpen,
  ArrowRight,
  HelpCircle,
  Clock,
  ListChecks,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const PRIORITY_BADGES = {
  HIGH: {
    label: 'Khẩn cấp',
    className: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
    icon: AlertOctagon,
    cardBorder: 'border-rose-200 hover:border-rose-300',
  },
  MEDIUM: {
    label: 'Cần lưu ý',
    className: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
    icon: AlertTriangle,
    cardBorder: 'border-amber-200 hover:border-amber-300',
  },
  LOW: {
    label: 'Khuyến nghị',
    className: 'bg-blue-100 text-blue-800 border-blue-300 font-semibold',
    icon: Info,
    cardBorder: 'border-blue-200 hover:border-blue-300',
  },
};

const CATEGORY_CONFIG = {
  WEAK_TOPIC: {
    label: 'Lỗ hổng chuyên đề',
    icon: BookOpen,
    iconColor: 'text-rose-600 bg-rose-50',
  },
  STUDENT_INTERVENTION: {
    label: 'Học sinh cần can thiệp',
    icon: UserX,
    iconColor: 'text-amber-600 bg-amber-50',
  },
  QUESTION_ANOMALY: {
    label: 'Câu hỏi bất thường / Bẫy',
    icon: HelpCircle,
    iconColor: 'text-purple-600 bg-purple-50',
  },
};

export function RecommendationsPanel({
  recommendations = [],
  summary = {
    high_priority_count: 0,
    medium_priority_count: 0,
    low_priority_count: 0,
    total_recommendations: 0,
  },
  onSelectCategory,
}) {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [checkedActions, setCheckedActions] = useState(new Set());

  const toggleAction = (recId, actionIdx) => {
    const key = `${recId}-${actionIdx}`;
    setCheckedActions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const filteredRecs = recommendations.filter((r) => {
    if (activeCategory === 'ALL') return true;
    return r.category === activeCategory;
  });

  return (
    <div className="space-y-6">
      {/* 1. Priority Summary Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-500 mb-1">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-medium">Tổng khuyến nghị</span>
          </div>
          <div className="text-2xl font-black text-slate-900 tabular-nums">
            {summary.total_recommendations || recommendations.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Tự động phát hiện qua AI & Heuristics</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs">
          <div className="flex items-center space-x-2 text-rose-600 mb-1">
            <AlertOctagon className="w-4 h-4" />
            <span className="text-xs font-semibold">Mức độ Khẩn cấp</span>
          </div>
          <div className="text-2xl font-black text-rose-600 tabular-nums">
            {summary.high_priority_count || 0}
          </div>
          <p className="text-[11px] text-rose-500/80 mt-0.5">Cần can thiệp ngay trong tuần</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs">
          <div className="flex items-center space-x-2 text-amber-600 mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-semibold">Cần lưu ý</span>
          </div>
          <div className="text-2xl font-black text-amber-600 tabular-nums">
            {summary.medium_priority_count || 0}
          </div>
          <p className="text-[11px] text-amber-500/80 mt-0.5">Theo dõi & nhắc nhở học sinh</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs">
          <div className="flex items-center space-x-2 text-blue-600 mb-1">
            <Info className="w-4 h-4" />
            <span className="text-xs font-semibold">Khuyến nghị thêm</span>
          </div>
          <div className="text-2xl font-black text-blue-600 tabular-nums">
            {summary.low_priority_count || 0}
          </div>
          <p className="text-[11px] text-blue-500/80 mt-0.5">Gợi ý tối ưu câu hỏi & đề</p>
        </div>
      </div>

      {/* 2. Category Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => {
            setActiveCategory('ALL');
            if (onSelectCategory) onSelectCategory('ALL');
          }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
            activeCategory === 'ALL'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span>Tất cả</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-current">
            {recommendations.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveCategory('WEAK_TOPIC');
            if (onSelectCategory) onSelectCategory('WEAK_TOPIC');
          }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
            activeCategory === 'WEAK_TOPIC'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Lỗ hổng chuyên đề</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveCategory('STUDENT_INTERVENTION');
            if (onSelectCategory) onSelectCategory('STUDENT_INTERVENTION');
          }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
            activeCategory === 'STUDENT_INTERVENTION'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <UserX className="w-3.5 h-3.5" />
          <span>Học sinh cần can thiệp</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveCategory('QUESTION_ANOMALY');
            if (onSelectCategory) onSelectCategory('QUESTION_ANOMALY');
          }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
            activeCategory === 'QUESTION_ANOMALY'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Câu hỏi bất thường / Bẫy</span>
        </button>
      </div>

      {/* 3. Recommendations Cards List */}
      <div className="space-y-4">
        {filteredRecs.length > 0 ? (
          filteredRecs.map((rec) => {
            const prio = PRIORITY_BADGES[rec.priority] || PRIORITY_BADGES.LOW;
            const cat =
              CATEGORY_CONFIG[rec.category] || CATEGORY_CONFIG.WEAK_TOPIC;
            const PrioIcon = prio.icon;
            const CatIcon = cat.icon;

            return (
              <div
                key={rec.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs transition-all ${prio.cardBorder}`}
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${cat.iconColor}`}
                    >
                      <CatIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        {cat.label}
                      </span>
                      <h4 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                        {rec.title}
                      </h4>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs border shrink-0 ${prio.className}`}
                  >
                    <PrioIcon className="w-3.5 h-3.5" />
                    <span>{prio.label}</span>
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                  {rec.description}
                </p>

                {/* Metrics Badges */}
                {rec.metrics && Object.keys(rec.metrics).length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {Object.entries(rec.metrics).map(([mKey, mVal]) => (
                      <span
                        key={mKey}
                        className="inline-flex items-center space-x-1 text-xs text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 font-medium"
                      >
                        <span className="text-slate-400 capitalize">
                          {mKey.replace(/_/g, ' ')}:
                        </span>
                        <span className="font-bold text-slate-900 tabular-nums">
                          {typeof mVal === 'number'
                            ? mVal.toFixed(1)
                            : String(mVal)}
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Suggested Action Checklist */}
                {rec.suggested_actions && rec.suggested_actions.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center space-x-1.5">
                      <ListChecks className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Lộ trình hành động sư phạm khuyến nghị:</span>
                    </h5>
                    <div className="space-y-1.5">
                      {rec.suggested_actions.map((act, aIdx) => {
                        const isDone = checkedActions.has(`${rec.id}-${aIdx}`);
                        return (
                          <button
                            key={aIdx}
                            type="button"
                            onClick={() => toggleAction(rec.id, aIdx)}
                            className={`w-full text-left flex items-start space-x-2.5 p-2 rounded-xl text-xs transition ${
                              isDone
                                ? 'bg-emerald-50/60 text-emerald-800 line-through opacity-75'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <span
                              className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition ${
                                isDone
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'border-slate-300 bg-white text-transparent'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                            </span>
                            <span className="leading-snug">{act}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quick Action Button */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Cập nhật theo dữ liệu chấm tự động mới nhất</span>
                  </div>

                  {rec.category === 'WEAK_TOPIC' && (
                    <Link
                      to="/teacher/assignments"
                      className="inline-flex items-center space-x-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition"
                    >
                      <span>Giao bài luyện chuyên đề này</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}

                  {rec.category === 'STUDENT_INTERVENTION' && (
                    <Link
                      to="/teacher/gradebook"
                      className="inline-flex items-center space-x-1.5 text-xs font-bold text-amber-600 hover:text-amber-700 transition"
                    >
                      <span>Mở sổ điểm cá nhân</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}

                  {rec.category === 'QUESTION_ANOMALY' && (
                    <Link
                      to="/teacher/questions"
                      className="inline-flex items-center space-x-1.5 text-xs font-bold text-purple-600 hover:text-purple-700 transition"
                    >
                      <span>Kiểm tra ngân hàng câu hỏi</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-extrabold text-slate-900">
              Lớp học đang có phong độ tốt!
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              Không phát hiện chuyên đề yếu (&lt;60%) hay học sinh cần can thiệp khẩn cấp nào trong phạm vi bộ lọc đã chọn.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
