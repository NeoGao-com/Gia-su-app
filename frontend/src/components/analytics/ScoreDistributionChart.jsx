import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  Award,
  AlertTriangle,
  Users,
  Target,
  BarChart2,
  FileCheck,
} from 'lucide-react';

const TIER_COLORS = {
  WEAK: '#ef4444', // Red < 5.0
  AVERAGE: '#f59e0b', // Amber 5.0 - 6.49
  GOOD: '#3b82f6', // Blue 6.5 - 7.99
  EXCELLENT: '#10b981', // Emerald >= 8.0
};

function getBinColor(binObj) {
  const max = binObj.max ?? 0;
  if (max <= 5.0) return TIER_COLORS.WEAK;
  if (max <= 6.5) return TIER_COLORS.AVERAGE;
  if (max <= 8.0) return TIER_COLORS.GOOD;
  return TIER_COLORS.EXCELLENT;
}

function CustomHistogramTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const color = getBinColor(data);

  return (
    <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-slate-200 text-xs z-50">
      <div className="flex items-center space-x-2 mb-1.5">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="font-bold text-slate-900">
          Khoảng điểm: {data.bin}
        </span>
      </div>
      <div className="space-y-1 text-slate-600">
        <div className="flex justify-between space-x-4">
          <span>Số bài thi:</span>
          <span className="font-bold text-slate-900 tabular-nums">
            {data.count} bài
          </span>
        </div>
        <div className="flex justify-between space-x-4">
          <span>Tỷ lệ:</span>
          <span className="font-bold text-slate-900 tabular-nums">
            {Number(data.percentage).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function ScoreDistributionChart({
  distribution = { bins: [], tiers: [] },
  summary = {
    total_submissions: 0,
    unique_students: 0,
    average_score: 0,
    median_score: 0,
    highest_score: 0,
    lowest_score: 0,
    standard_deviation: 0,
    pass_count: 0,
    fail_count: 0,
    pass_rate: 0,
  },
}) {
  const bins = distribution?.bins || [];
  const tiers = distribution?.tiers || [];
  const hasData = summary?.total_submissions > 0 && bins.length > 0;

  return (
    <div className="space-y-6">
      {/* 1. Academic Summary Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Mean / Average */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-500 mb-1">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-medium">Điểm trung bình</span>
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">
              {Number(summary.average_score || 0).toFixed(2)}
            </span>
            <span className="text-xs text-slate-400">/ 10</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Mean score</p>
        </div>

        {/* Median */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-500 mb-1">
            <Target className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-medium">Điểm trung vị</span>
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">
              {Number(summary.median_score || 0).toFixed(2)}
            </span>
            <span className="text-xs text-slate-400">/ 10</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Median score</p>
        </div>

        {/* Pass Rate */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-500 mb-1">
            <Award className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-medium">Tỷ lệ đạt (&ge;5.0)</span>
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-xl sm:text-2xl font-extrabold text-emerald-600 tabular-nums">
              {Number(summary.pass_rate || 0).toFixed(1)}%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {summary.pass_count || 0}/{summary.total_submissions || 0} bài đạt
          </p>
        </div>

        {/* Standard Deviation */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-500 mb-1">
            <BarChart2 className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium">Độ lệch chuẩn</span>
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">
              {Number(summary.standard_deviation || 0).toFixed(2)}
            </span>
            <span className="text-xs text-slate-400">(&sigma;)</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Độ phân tán phổ điểm</p>
        </div>

        {/* Min / Max Range */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-500 mb-1">
            <FileCheck className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-medium">Thấp nhất / Cao nhất</span>
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-lg sm:text-xl font-bold text-rose-600 tabular-nums">
              {Number(summary.lowest_score || 0).toFixed(1)}
            </span>
            <span className="text-xs text-slate-300">/</span>
            <span className="text-lg sm:text-xl font-bold text-emerald-600 tabular-nums">
              {Number(summary.highest_score || 0).toFixed(1)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Biên độ thang điểm</p>
        </div>

        {/* Total Submissions & Students */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-500 mb-1">
            <Users className="w-4 h-4 text-cyan-600" />
            <span className="text-xs font-medium">Tổng bài / Học sinh</span>
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
              {summary.total_submissions || 0}
            </span>
            <span className="text-xs text-slate-400">bài (</span>
            <span className="text-xs font-bold text-slate-700 tabular-nums">
              {summary.unique_students || 0}
            </span>
            <span className="text-xs text-slate-400">HS)</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Quy mô mẫu phân tích</p>
        </div>
      </div>

      {/* 2. Main 10-bin Histogram Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
              <BarChart2 className="w-5 h-5 text-indigo-600" />
              <span>Phổ điểm 10 phân khoảng chuẩn (0.0 - 10.0)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tần suất phân bố số lượng bài làm theo từng khoảng điểm kèm vạch mốc chuẩn 5.0
            </p>
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-slate-600 font-medium">Yếu (&lt; 5.0)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-slate-600 font-medium">Trung bình (5 - 6.49)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-slate-600 font-medium">Khá (6.5 - 7.99)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-600 font-medium">Giỏi (&ge; 8.0)</span>
            </div>
          </div>
        </div>

        {hasData ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={bins}
                margin={{ top: 20, right: 20, left: -10, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="bin"
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />
                <Tooltip content={<CustomHistogramTooltip />} />
                <ReferenceLine
                  x="5 - 6"
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: 'Mốc đạt (5.0)',
                    fill: '#dc2626',
                    fontSize: 11,
                    fontWeight: 700,
                    position: 'top',
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {bins.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getBinColor(entry)}
                      className="transition-opacity hover:opacity-85"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <BarChart2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              Chưa có dữ liệu bài nộp
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Chưa ghi nhận bài kiểm tra nào phù hợp với bộ lọc hiện tại. Hãy thử thay đổi bộ lọc lớp học hoặc đề thi.
            </p>
          </div>
        )}
      </div>

      {/* 3. 4 Academic Tier Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tiers.map((tier) => {
          const isWeak = tier.range?.includes('< 5') || tier.tier?.includes('Yếu');
          const isAverage = tier.range?.includes('5.0 - 6.49') || tier.tier?.includes('Trung bình');
          const isGood = tier.range?.includes('6.5 - 7.99') || tier.tier?.includes('Khá');
          const isExcellent = tier.range?.includes('>= 8') || tier.tier?.includes('Giỏi');

          let borderColor = 'border-slate-200';
          let badgeBg = 'bg-slate-100 text-slate-700';
          let progressBg = 'bg-slate-500';

          if (isWeak) {
            borderColor = 'border-rose-200/90';
            badgeBg = 'bg-rose-50 text-rose-700 border border-rose-200';
            progressBg = 'bg-rose-500';
          } else if (isAverage) {
            borderColor = 'border-amber-200/90';
            badgeBg = 'bg-amber-50 text-amber-700 border border-amber-200';
            progressBg = 'bg-amber-500';
          } else if (isGood) {
            borderColor = 'border-blue-200/90';
            badgeBg = 'bg-blue-50 text-blue-700 border border-blue-200';
            progressBg = 'bg-blue-500';
          } else if (isExcellent) {
            borderColor = 'border-emerald-200/90';
            badgeBg = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
            progressBg = 'bg-emerald-500';
          }

          return (
            <div
              key={tier.tier}
              className={`bg-white rounded-2xl border ${borderColor} p-4 shadow-xs`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${badgeBg}`}>
                  {tier.tier}
                </span>
                <span className="text-xs font-semibold text-slate-500 tabular-nums">
                  {tier.range}
                </span>
              </div>

              <div className="flex items-baseline justify-between mt-3 mb-2">
                <span className="text-2xl font-black text-slate-900 tabular-nums">
                  {tier.count} <span className="text-xs font-medium text-slate-400">bài</span>
                </span>
                <span className="text-sm font-extrabold text-slate-700 tabular-nums">
                  {Number(tier.percentage || 0).toFixed(1)}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${progressBg}`}
                  style={{ width: `${Math.min(100, Math.max(0, tier.percentage || 0))}%` }}
                />
              </div>

              {isWeak && tier.count > 0 && (
                <p className="text-[11px] text-rose-600 font-medium mt-2.5 flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5 inline-block shrink-0" />
                  <span>Cần phụ đạo & củng cố kiến thức</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
