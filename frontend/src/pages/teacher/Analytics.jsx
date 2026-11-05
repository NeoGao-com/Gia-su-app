import React, { useEffect, useState, useCallback, useTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import {
  BarChart3,
  TrendingUp,
  BookOpen,
  Sparkles,
  HelpCircle,
  RefreshCw,
  AlertTriangle,
  Flame,
  ArrowRight,
} from 'lucide-react';
import api from '../../api/axios';
import { AnalyticsFilterBar } from '../../components/analytics/AnalyticsFilterBar';
import { ScoreDistributionChart } from '../../components/analytics/ScoreDistributionChart';
import { TopicPerformanceTable } from '../../components/analytics/TopicPerformanceTable';
import { RecommendationsPanel } from '../../components/analytics/RecommendationsPanel';
import { QuestionAnomaliesList } from '../../components/analytics/QuestionAnomaliesList';

export function Analytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [, startTransition] = useTransition();

  // Active Tab from URL or default to 'overview'
  const activeTab = searchParams.get('tab') || 'overview';

  // Filters state initialized from URL search params
  const [filters, setFilters] = useState(() => ({
    classroom_id:
      searchParams.get('classroom_id') ||
      searchParams.get('classroomId') ||
      '',
    exam_id: searchParams.get('exam_id') || searchParams.get('examId') || '',
    student_id:
      searchParams.get('student_id') ||
      searchParams.get('studentId') ||
      '',
    date_range:
      searchParams.get('date_range') ||
      searchParams.get('dateRange') ||
      'all',
    attempt_filter:
      searchParams.get('attempt_filter') ||
      searchParams.get('attemptFilter') ||
      'best',
  }));

  // Metadata dropdown options
  const [classrooms, setClassrooms] = useState([]);
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);

  // Analytics Response States
  const [dashboardData, setDashboardData] = useState(null);
  const [topicsData, setTopicsData] = useState(null);
  const [recommendationsData, setRecommendationsData] = useState(null);
  const [questionsData, setQuestionsData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sync state if URL query params change externally (e.g. back/forward navigation or drill-downs)
  useEffect(() => {
    const urlClassroomId =
      searchParams.get('classroom_id') || searchParams.get('classroomId') || '';
    const urlExamId =
      searchParams.get('exam_id') || searchParams.get('examId') || '';
    const urlStudentId =
      searchParams.get('student_id') || searchParams.get('studentId') || '';
    const urlDateRange =
      searchParams.get('date_range') || searchParams.get('dateRange') || 'all';
    const urlAttemptFilter =
      searchParams.get('attempt_filter') ||
      searchParams.get('attemptFilter') ||
      'best';

    setFilters((prev) => {
      if (
        prev.classroom_id === urlClassroomId &&
        prev.exam_id === urlExamId &&
        prev.student_id === urlStudentId &&
        prev.date_range === urlDateRange &&
        prev.attempt_filter === urlAttemptFilter
      ) {
        return prev;
      }
      return {
        classroom_id: urlClassroomId,
        exam_id: urlExamId,
        student_id: urlStudentId,
        date_range: urlDateRange,
        attempt_filter: urlAttemptFilter,
      };
    });
  }, [searchParams]);

  // Tab change handler
  const handleTabChange = (tabKey) => {
    startTransition(() => {
      const nextParams = new URLSearchParams(searchParams);
      if (tabKey === 'overview') {
        nextParams.delete('tab');
      } else {
        nextParams.set('tab', tabKey);
      }
      setSearchParams(nextParams, { replace: true });
    });
  };

  // Load teacher classrooms & exams metadata on mount
  useEffect(() => {
    let cancelled = false;
    const fetchMetadata = async () => {
      try {
        const [classRes, examRes] = await Promise.all([
          api.get('/classrooms', { params: { limit: 100 } }).catch(() => ({ data: [] })),
          api.get('/exams', { params: { limit: 100 } }).catch(() => ({ data: [] })),
        ]);

        if (cancelled) return;

        const classList = Array.isArray(classRes.data?.items)
          ? classRes.data.items
          : Array.isArray(classRes.data)
            ? classRes.data
            : [];
        const examList = Array.isArray(examRes.data?.items)
          ? examRes.data.items
          : Array.isArray(examRes.data)
            ? examRes.data
            : [];

        setClassrooms(classList);
        setExams(examList);
      } catch (err) {
        console.error('Lỗi tải danh mục lớp và đề thi:', err);
      }
    };

    fetchMetadata();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch students for selected classroom or all classrooms
  useEffect(() => {
    let cancelled = false;
    const fetchStudents = async () => {
      try {
        if (filters.classroom_id) {
          const res = await api
            .get(`/classrooms/${filters.classroom_id}`)
            .catch(() => ({ data: {} }));
          if (cancelled) return;
          const classStudents = res.data?.students || [];
          setStudents(classStudents);
        } else {
          const res = await api
            .get('/classrooms/students/all')
            .catch(() => ({ data: [] }));
          if (cancelled) return;
          const allStudents = Array.isArray(res.data) ? res.data : [];
          setStudents(allStudents);
        }
      } catch (err) {
        console.error('Lỗi tải danh sách học sinh:', err);
      }
    };

    fetchStudents();
    return () => {
      cancelled = true;
    };
  }, [filters.classroom_id]);

  // Compute date strings for backend filtering
  const computeDateRangeParams = (range) => {
    if (!range || range === 'all') return {};
    const now = new Date();
    let days = 0;
    if (range === '7d') days = 7;
    if (range === '30d') days = 30;
    if (range === '90d') days = 90;

    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return {
      start_date: startDate.toISOString(),
      end_date: now.toISOString(),
    };
  };

  // Fetch all analytics datasets
  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const dateParams = computeDateRangeParams(filters.date_range);
    const queryParams = {
      ...(filters.classroom_id ? { classroom_id: Number(filters.classroom_id) } : {}),
      ...(filters.exam_id ? { exam_id: Number(filters.exam_id) } : {}),
      ...(filters.student_id ? { student_id: Number(filters.student_id) } : {}),
      attempt_filter: filters.attempt_filter || 'best',
      ...dateParams,
    };

    try {
      const [dashRes, topicsRes, recsRes, questionsRes] = await Promise.all([
        api.get('/analytics/dashboard', { params: queryParams }).catch((err) => {
          console.warn('Dashboard API error:', err);
          return { data: null };
        }),
        api.get('/analytics/topics', { params: queryParams }).catch((err) => {
          console.warn('Topics API error:', err);
          return { data: null };
        }),
        api
          .get('/analytics/recommendations', {
            params: {
              ...(filters.classroom_id ? { classroom_id: Number(filters.classroom_id) } : {}),
              ...(filters.exam_id ? { exam_id: Number(filters.exam_id) } : {}),
            },
          })
          .catch((err) => {
            console.warn('Recommendations API error:', err);
            return { data: null };
          }),
        api
          .get('/analytics/questions', {
            params: {
              ...(filters.exam_id ? { exam_id: Number(filters.exam_id) } : {}),
              ...(filters.classroom_id ? { classroom_id: Number(filters.classroom_id) } : {}),
            },
          })
          .catch((err) => {
            console.warn('Questions API error:', err);
            return { data: null };
          }),
      ]);

      setDashboardData(dashRes.data);
      setTopicsData(topicsRes.data);
      setRecommendationsData(recsRes.data);
      setQuestionsData(questionsRes.data);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu phân tích:', err);
      setError('Không thể tải dữ liệu thống kê. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters({
      classroom_id: '',
      exam_id: '',
      student_id: '',
      date_range: 'all',
      attempt_filter: 'best',
    });
  };

  const topWeakTopics = dashboardData?.top_weak_topics || [];
  const recSummary = dashboardData?.recommendations_summary || recommendationsData?.summary;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Navbar />
      <div className="flex">
        <Sidebar role="teacher" />
        <main className="flex-1 p-5 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Trí tuệ Nhân tạo & Thống kê Sư phạm</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2.5">
                <BarChart3 className="w-8 h-8 text-indigo-600" />
                <span>Thống kê & Phân tích chất lượng</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Phân tích phổ điểm 10 mốc chuẩn, đánh giá năng lực theo chuyên đề và tự động đưa ra khuyến nghị can thiệp.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={fetchAnalyticsData}
                disabled={loading}
                className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50 shadow-2xs active:scale-95 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
                <span>Làm mới</span>
              </button>
            </div>
          </div>

          {/* 1. Multi-Dimensional Filter Bar */}
          <AnalyticsFilterBar
            classrooms={classrooms}
            exams={exams}
            students={students}
            filters={filters}
            onFilterChange={handleFilterChange}
            onReset={handleResetFilters}
            loading={loading}
          />

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800 text-xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-bold">Đã xảy ra sự cố khi tải dữ liệu</h4>
                <p className="mt-0.5">{error}</p>
              </div>
              <button
                type="button"
                onClick={fetchAnalyticsData}
                className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 transition"
              >
                Thử lại
              </button>
            </div>
          )}

          {/* 2. Modern Tab Navigation */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <button
              type="button"
              onClick={() => handleTabChange('overview')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center space-x-2 ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Tổng quan & Phổ điểm</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('topics')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center space-x-2 ${
                activeTab === 'topics'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Chuyên đề & Dạng bài</span>
              {topicsData?.topics?.length > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] ${
                    activeTab === 'topics'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {topicsData.topics.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('recommendations')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center space-x-2 ${
                activeTab === 'recommendations'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Khuyến nghị sư phạm</span>
              {recSummary?.high_priority_count > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500 text-white">
                  {recSummary.high_priority_count}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('questions')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center space-x-2 ${
                activeTab === 'questions'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>Phân tích câu hỏi & Bẫy</span>
              {questionsData?.questions?.filter((q) => q.is_flagged_anomaly)
                .length > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    activeTab === 'questions'
                      ? 'bg-white/20 text-white'
                      : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  {
                    questionsData.questions.filter((q) => q.is_flagged_anomaly)
                      .length
                  }
                </span>
              )}
            </button>
          </div>

          {/* 3. Tab Contents */}
          {loading && !dashboardData ? (
            <div className="py-24 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 animate-spin">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Đang tổng hợp dữ liệu thống kê...
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Đang tính toán phổ điểm 10 mốc và phân tích năng lực chuyên đề
              </p>
            </div>
          ) : (
            <div>
              {/* TAB 1: OVERVIEW & SCORE DISTRIBUTION */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Top Weak Topics Alert Spotlight (if any) */}
                  {topWeakTopics.length > 0 && (
                    <div className="bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-indigo-500/10 border border-rose-200 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Flame className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-extrabold text-slate-900">
                              Phát hiện {topWeakTopics.length} chuyên đề yếu cần củng cố (&lt;60% đúng)
                            </h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 uppercase">
                              Cần lưu ý
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Các chuyên đề: {topWeakTopics.map((t) => `${t.topic} (${Number(t.accuracy_rate).toFixed(1)}%)`).join(', ')}.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTabChange('recommendations')}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-xs active:scale-95 transition shrink-0"
                      >
                        <span>Xem khuyến nghị sư phạm</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Main Score Distribution Chart Component */}
                  <ScoreDistributionChart
                    distribution={dashboardData?.score_distribution}
                    summary={dashboardData?.summary}
                  />
                </div>
              )}

              {/* TAB 2: TOPIC PERFORMANCE */}
              {activeTab === 'topics' && (
                <TopicPerformanceTable
                  topics={topicsData?.topics || []}
                  difficultySummary={topicsData?.difficulty_summary || []}
                  questionTypeSummary={topicsData?.question_type_summary || []}
                />
              )}

              {/* TAB 3: RECOMMENDATIONS */}
              {activeTab === 'recommendations' && (
                <RecommendationsPanel
                  recommendations={recommendationsData?.recommendations || []}
                  summary={recommendationsData?.summary}
                />
              )}

              {/* TAB 4: QUESTIONS ANOMALY ANALYSIS */}
              {activeTab === 'questions' && (
                <QuestionAnomaliesList
                  questions={questionsData?.questions || []}
                  loading={loading}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
