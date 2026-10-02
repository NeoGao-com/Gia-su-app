import React, { useEffect, useState, useMemo } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api from '../../api/axios';
import { 
  Award, Clock, CheckCircle2, XCircle, Search, 
  ArrowRight, Eye, Trophy, BookOpen, Filter, Sparkles, FileText
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { SubmissionReviewModal } from '../../components/SubmissionReviewModal';

export function ExamHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('ALL');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);

  useEffect(() => {
    api.get('/student/history?limit=100')
      .then(res => {
        const items = Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
        setHistory(items);
      })
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  const scores = history.map(h => Number(h.score ?? 0));
  const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0;
  const highestScore = scores.length > 0 ? Math.max(...scores).toFixed(1) : '—';
  const passedCount = history.filter(h => Number(h.score ?? 0) >= 5.0).length;
  const passRate = history.length > 0 ? Math.round((passedCount / history.length) * 100) : 0;

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const titleMatch = (item.exam_title || '').toLowerCase().includes(search.toLowerCase());
      if (search && !titleMatch) return false;

      const sc = Number(item.score ?? 0);
      if (ratingFilter === 'EXCELLENT' && sc < 8.5) return false;
      if (ratingFilter === 'GOOD' && (sc < 6.5 || sc >= 8.5)) return false;
      if (ratingFilter === 'AVERAGE' && (sc < 5.0 || sc >= 6.5)) return false;
      if (ratingFilter === 'POOR' && sc >= 5.0) return false;

      return true;
    });
  }, [history, search, ratingFilter]);

  return (
    <div className="min-h-screen bg-pastel-bg">
      <Navbar />
      <div className="flex">
        <Sidebar role="student" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl">
          {/* Header */}
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight flex items-center space-x-2">
                <Award className="w-7 h-7 text-pastel-purpleDark" />
                <span>Sổ điểm & Lịch sử làm bài</span>
              </h1>
              <p className="text-xs text-gray-500 mt-1">Theo dõi tiến độ học tập, điểm số và xem lại lời giải chi tiết cho từng bài nộp</p>
            </div>

            <div className="flex items-center space-x-2">
              <Link
                to="/student/exams"
                className="text-xs font-bold bg-white border border-gray-200 px-3.5 py-2 rounded-2xl hover:bg-gray-50 transition shadow-sm text-gray-700 flex items-center space-x-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-pastel-purpleDark" />
                <span>Xem danh sách đề thi</span>
              </Link>
            </div>
          </div>

          {/* High-level KPI Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center space-x-3 mb-2">
                <div className="bg-purple-50 text-pastel-purpleDark p-2.5 rounded-2xl">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-medium">Tổng bài nộp</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-800">{history.length}</h3>
              <p className="text-[11px] text-gray-400 mt-1">Lượt nộp bài thi</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center space-x-3 mb-2">
                <div className="bg-amber-50 text-amber-600 p-2.5 rounded-2xl">
                  <Trophy className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-medium">Điểm trung bình</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-pastel-purpleDark">
                {avgScore} <span className="text-xs text-gray-400 font-normal">/ 10</span>
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">GPA tích lũy</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center space-x-3 mb-2">
                <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-2xl">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-medium">Điểm cao nhất</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-emerald-600">
                {highestScore} <span className="text-xs text-gray-400 font-normal">/ 10</span>
              </h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">Kỷ lục bài thi</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center space-x-3 mb-2">
                <div className="bg-blue-50 text-blue-600 p-2.5 rounded-2xl">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <span className="text-xs sm:text-sm text-gray-500 font-medium">Tỷ lệ đạt (≥ 5đ)</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-800">{passRate}%</h3>
              <p className="text-[11px] text-gray-400 mt-1">{passedCount}/{history.length} bài đạt chuẩn</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-sm mb-6 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên bài thi..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:border-pastel-purple"
              />
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={ratingFilter}
                onChange={e => setRatingFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-200 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:border-pastel-purple"
              >
                <option value="ALL">Tất cả xếp loại</option>
                <option value="EXCELLENT">Xuất sắc (≥ 8.5)</option>
                <option value="GOOD">Khá (6.5 – 8.4)</option>
                <option value="AVERAGE">Trung bình (5.0 – 6.4)</option>
                <option value="POOR">Cần cố gắng (&lt; 5.0)</option>
              </select>

              {(search || ratingFilter !== 'ALL') && (
                <button
                  onClick={() => { setSearch(''); setRatingFilter('ALL'); }}
                  className="px-3 py-2 text-xs font-bold text-gray-500 hover:text-gray-800"
                >
                  Xóa lọc
                </button>
              )}
            </div>
          </div>

          {/* Submissions List */}
          {loading ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
              <div className="w-8 h-8 border-3 border-pastel-purple/30 border-t-pastel-purple rounded-full animate-spin mx-auto mb-3" />
              <div className="text-pastel-purpleDark font-medium text-sm animate-pulse">Đang tải lịch sử bài làm...</div>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-700">Chưa có kết quả nộp bài nào</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                {history.length === 0 
                  ? 'Bạn chưa hoàn thành bài thi nào. Hãy bắt đầu với bài tập về nhà hoặc đề tự luyện!' 
                  : 'Không có bài nộp nào phù hợp với bộ lọc hiện tại.'}
              </p>
              {history.length === 0 && (
                <Link
                  to="/student/exams"
                  className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 bg-pastel-purple text-white rounded-2xl text-xs font-bold hover:bg-pastel-purpleDark transition shadow-sm"
                >
                  <span>Làm bài thi ngay</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 bg-gray-50/70 border-b border-gray-100 flex justify-between items-center text-xs text-gray-500 font-bold">
                <span>Danh sách bài đã nộp ({filteredHistory.length})</span>
                <span>Bấm "Xem chi tiết" để xem lời giải LaTeX từng câu</span>
              </div>

              <div className="divide-y divide-gray-100">
                {filteredHistory.map(item => {
                  const scoreNum = Number(item.score ?? 0);
                  const isExcellent = scoreNum >= 8.5;
                  const isGood = scoreNum >= 6.5 && scoreNum < 8.5;
                  const isPassed = scoreNum >= 5.0 && scoreNum < 6.5;
                  const isFail = scoreNum < 5.0;

                  return (
                    <div
                      key={item.id}
                      className="p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-purple-50/20 transition"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <h3 className="font-bold text-gray-900 text-base">{item.exam_title || 'Bài kiểm tra'}</h3>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            item.grading_status === 'GRADED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {item.grading_status === 'GRADED' ? 'Đã chấm điểm' : 'Chờ chấm'}
                          </span>
                        </div>

                        <div className="flex items-center flex-wrap gap-3 text-xs text-gray-500 font-medium">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            <span>Nộp: {item.submitted_at ? new Date(item.submitted_at).toLocaleString('vi-VN') : '—'}</span>
                          </span>
                          {item.attempt_number && <span>• Lần thi thứ #{item.attempt_number}</span>}
                          {item.time_spent && <span>• Làm trong: {Math.round(item.time_spent / 60)} phút</span>}
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 w-full sm:w-auto justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                        {/* Score Pill */}
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-gray-400 block">Điểm số</span>
                          <div className="flex items-baseline space-x-1">
                            <span className={`text-2xl font-black ${
                              isExcellent ? 'text-emerald-600' : isGood ? 'text-blue-600' : isPassed ? 'text-amber-600' : 'text-rose-600'
                            }`}>
                              {item.score ?? 0}
                            </span>
                            <span className="text-xs text-gray-400 font-normal">/ 10</span>
                          </div>
                        </div>

                        {/* Action: Open KaTeX review modal */}
                        <button
                          type="button"
                          onClick={() => setSelectedSubmissionId(item.id)}
                          className="px-4 py-2.5 bg-gradient-to-r from-pastel-purple to-pastel-purpleDark text-white text-xs font-bold rounded-2xl hover:opacity-95 transition shadow-sm flex items-center space-x-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem giải chi tiết</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* KaTeX Step-by-Step Review Modal */}
      {selectedSubmissionId && (
        <SubmissionReviewModal
          submissionId={selectedSubmissionId}
          onClose={() => setSelectedSubmissionId(null)}
        />
      )}
    </div>
  );
}
