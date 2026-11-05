import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api from '../../api/axios';
import {
  Users,
  Copy,
  Check,
  Award,
  BookOpen,
  TrendingUp,
  Target,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export function Gradebook() {
  const { toast } = useToast();
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState('');
  const [gradebookData, setGradebookData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);

  useEffect(() => {
    api.get('/classrooms?limit=100')
      .then((res) => {
        const items = Array.isArray(res.data?.items)
          ? res.data.items
          : Array.isArray(res.data)
            ? res.data
            : [];
        setClassrooms(items);
        if (items.length > 0) {
          setSelectedClassroomId(String(items[0].id));
        }
      })
      .catch(() => setClassrooms([]));
  }, []);

  useEffect(() => {
    if (!selectedClassroomId) return;
    setLoading(true);
    let cancelled = false;

    api.get(`/classrooms/${selectedClassroomId}/gradebook`)
      .then((res) => {
        if (!cancelled) setGradebookData(res.data);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Error fetching gradebook:', err);
          setGradebookData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClassroomId]);

  const assignments = useMemo(() => gradebookData?.assignments || [], [gradebookData]);
  const entries = useMemo(() => gradebookData?.gradebook || [], [gradebookData]);

  // Calculate average score for a student
  const calcStudentAverage = React.useCallback(
    (entry) => {
      let sum = 0;
      let count = 0;
      assignments.forEach((a) => {
        const scoreObj = entry.scores?.[a.exam_id];
        if (scoreObj && scoreObj.score !== undefined && scoreObj.score !== null) {
          sum += Number(scoreObj.score);
          count++;
        }
      });
      return count > 0 ? (sum / count).toFixed(1) : null;
    },
    [assignments]
  );

  // Comprehensive Class Statistics
  const classStats = useMemo(() => {
    const studentAvgs = entries
      .map(calcStudentAverage)
      .filter((v) => v !== null)
      .map(Number);

    if (studentAvgs.length === 0) {
      return {
        mean: '—',
        median: '—',
        passRate: '—',
        highest: '—',
        lowest: '—',
      };
    }

    // Mean
    const mean = (
      studentAvgs.reduce((acc, curr) => acc + curr, 0) / studentAvgs.length
    ).toFixed(2);

    // Median
    const sorted = [...studentAvgs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 !== 0
        ? sorted[mid].toFixed(2)
        : ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2);

    // Pass rate (>= 5.0)
    const passed = studentAvgs.filter((s) => s >= 5.0).length;
    const passRate = ((passed / studentAvgs.length) * 100).toFixed(1);

    // Highest and lowest
    const allIndividualScores = [];
    entries.forEach((e) => {
      assignments.forEach((a) => {
        const sc = e.scores?.[a.exam_id]?.score;
        if (sc !== undefined && sc !== null) {
          allIndividualScores.push(Number(sc));
        }
      });
    });

    const highest =
      allIndividualScores.length > 0
        ? Math.max(...allIndividualScores).toFixed(1)
        : Math.max(...studentAvgs).toFixed(1);
    const lowest =
      allIndividualScores.length > 0
        ? Math.min(...allIndividualScores).toFixed(1)
        : Math.min(...studentAvgs).toFixed(1);

    return {
      mean,
      median,
      passRate,
      highest,
      lowest,
    };
  }, [entries, assignments, calcStudentAverage]);

  const handleCopySummary = () => {
    const currentClass = classrooms.find(
      (c) => String(c.id) === String(selectedClassroomId)
    );
    const className = currentClass ? currentClass.name : 'Nhóm kèm';

    let text = `📊 BÁO CÁO TIẾN ĐỘ & ĐIỂM SỐ - ${className.toUpperCase()}\n`;
    text += `Điểm trung bình lớp: ${classStats.mean} | Trung vị: ${classStats.median} | Tỷ lệ đạt: ${classStats.passRate}%\n`;
    text += `------------------------------------\n`;

    if (entries.length === 0) {
      text += 'Chưa có dữ liệu học sinh.\n';
    } else {
      entries.forEach((e, idx) => {
        const studentAvg = calcStudentAverage(e);
        text += `${idx + 1}. ${e.student_name || 'Học sinh'} (ĐTB: ${studentAvg || '—'}):\n`;
        assignments.forEach((a) => {
          const scoreObj = e.scores?.[a.exam_id];
          const scoreText =
            scoreObj &&
            scoreObj.score !== undefined &&
            scoreObj.score !== null
              ? `${scoreObj.score}/10`
              : 'Chưa nộp';
          text += `   - ${a.exam?.title || `Bài thi #${a.exam_id}`}: ${scoreText}\n`;
        });
      });
    }

    navigator.clipboard.writeText(text);
    setSummaryCopied(true);
    toast.success('Đã sao chép tóm tắt sổ điểm để gửi phụ huynh qua Zalo!');
    setTimeout(() => setSummaryCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Navbar />
      <div className="flex">
        <Sidebar role="teacher" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
                <Award className="w-6 h-6 text-indigo-600" />
                <span>Sổ Điểm & Báo Cáo Tiến Độ</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Theo dõi điểm số từng bài thi của học sinh theo từng lớp học và xuất báo cáo gửi phụ huynh
              </p>
            </div>

            {classrooms.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <select
                  value={selectedClassroomId}
                  onChange={(e) => setSelectedClassroomId(e.target.value)}
                  className="px-4 py-2 bg-white rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 shadow-xs"
                >
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      Lớp: {c.name} ({c.code || c.id})
                    </option>
                  ))}
                </select>

                <Link
                  to={`/teacher/analytics?classroomId=${selectedClassroomId}`}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white border border-slate-200 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-50 active:scale-95 transition shadow-2xs whitespace-nowrap"
                  title="Mở bảng phân tích phổ điểm chi tiết của lớp này"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Phân tích phổ điểm lớp</span>
                </Link>

                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 active:scale-95 transition shadow-xs whitespace-nowrap"
                  title="Sao chép bảng tổng kết nhanh để gửi Zalo cho phụ huynh"
                >
                  {summaryCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{summaryCopied ? 'Đã sao chép!' : 'Xuất tóm tắt gửi PH'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Class Performance Summary Stats Bar */}
          {selectedClassroomId && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              {/* 1. Sĩ số lớp */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                <div className="flex items-center space-x-2 text-slate-500 mb-1">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-semibold">Sĩ số lớp</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums">
                  {entries.length}{' '}
                  <span className="text-xs font-normal text-slate-400">HS</span>
                </div>
              </div>

              {/* 2. Bài tập đã giao */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                <div className="flex items-center space-x-2 text-slate-500 mb-1">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold">Đề thi đã giao</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums">
                  {assignments.length}{' '}
                  <span className="text-xs font-normal text-slate-400">đề</span>
                </div>
              </div>

              {/* 3. Điểm TB cả lớp */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                <div className="flex items-center space-x-2 text-slate-500 mb-1">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold">Điểm TB cả lớp</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-600 tabular-nums">
                  {classStats.mean}{' '}
                  <span className="text-xs font-normal text-slate-400">/ 10</span>
                </div>
              </div>

              {/* 4. Trung vị */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                <div className="flex items-center space-x-2 text-slate-500 mb-1">
                  <Target className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-semibold">Điểm trung vị</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums">
                  {classStats.median}{' '}
                  <span className="text-xs font-normal text-slate-400">/ 10</span>
                </div>
              </div>

              {/* 5. Tỷ lệ đạt */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                <div className="flex items-center space-x-2 text-slate-500 mb-1">
                  <Award className="w-4 h-4 text-teal-600" />
                  <span className="text-xs font-semibold">Tỷ lệ đạt (&ge;5)</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-teal-600 tabular-nums">
                  {classStats.passRate === '—'
                    ? '—'
                    : `${classStats.passRate}%`}
                </div>
              </div>

              {/* 6. Thấp nhất / Cao nhất */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
                <div className="flex items-center space-x-2 text-slate-500 mb-1">
                  <BarChart3 className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-semibold">Min / Max</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums">
                  <span className="text-rose-600">{classStats.lowest}</span>
                  <span className="text-xs text-slate-300 mx-1">/</span>
                  <span className="text-emerald-600">{classStats.highest}</span>
                </div>
              </div>
            </div>
          )}

          {classrooms.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">Bạn chưa tạo lớp học nào để xem sổ điểm.</p>
            </div>
          ) : loading ? (
            <div className="bg-white rounded-2xl p-16 text-center border border-slate-200 shadow-sm text-indigo-600 font-semibold animate-pulse text-sm">
              Đang tải dữ liệu sổ điểm lớp học...
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-4 min-w-[200px]">Học sinh</th>
                    <th className="p-4 min-w-[200px]">Email</th>
                    <th className="p-4 text-center min-w-[110px] bg-indigo-50/70 text-indigo-800 font-extrabold">
                      Điểm TB
                    </th>
                    {assignments.map((a) => (
                      <th
                        key={a.id || a.exam_id}
                        className="p-4 text-center min-w-[140px]"
                      >
                        <Link
                          to={`/teacher/analytics?classroomId=${selectedClassroomId}&examId=${a.exam_id}`}
                          className="group inline-flex items-center space-x-1 hover:text-indigo-600 transition"
                          title="Click để xem phổ điểm và phân tích câu hỏi của đề thi này"
                        >
                          <span className="truncate max-w-[130px] font-bold">
                            {a.exam?.title || `Đề thi #${a.exam_id}`}
                          </span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600 shrink-0" />
                        </Link>
                      </th>
                    ))}
                    {assignments.length === 0 && (
                      <th className="p-4 text-center text-slate-400">Chưa giao bài thi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {entries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3 + Math.max(assignments.length, 1)}
                        className="p-12 text-center text-slate-400"
                      >
                        Chưa có học sinh tham gia lớp học này. Hãy gửi mã mời cho học sinh.
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => {
                      const studentAvg = calcStudentAverage(entry);
                      return (
                        <tr
                          key={entry.student_id}
                          className="hover:bg-slate-50/80 transition"
                        >
                          <td className="p-4 font-bold text-slate-800">
                            <Link
                              to={`/teacher/analytics?classroomId=${selectedClassroomId}&studentId=${entry.student_id}`}
                              className="group inline-flex items-center space-x-1.5 hover:text-indigo-600 transition"
                              title="Xem chi tiết tiến trình & phân tích năng lực học sinh này"
                            >
                              <span>{entry.student_name || 'Học sinh'}</span>
                              <TrendingUp className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 transition" />
                            </Link>
                          </td>
                          <td className="p-4 text-slate-400 text-xs font-mono">
                            {entry.student_email || '-'}
                          </td>
                          <td className="p-4 text-center bg-indigo-50/40 font-extrabold">
                            {studentAvg !== null ? (
                              <span
                                className={`px-2.5 py-1 rounded-xl text-xs font-extrabold tabular-nums border ${
                                  Number(studentAvg) >= 8.0
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                                    : Number(studentAvg) >= 6.5
                                      ? 'bg-blue-50 text-blue-800 border-blue-200/80'
                                      : Number(studentAvg) >= 5.0
                                        ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                                        : 'bg-rose-50 text-rose-800 border-rose-200/80'
                                }`}
                              >
                                {studentAvg}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-normal">—</span>
                            )}
                          </td>
                          {assignments.map((a) => {
                            const examScore = entry.scores?.[a.exam_id];
                            return (
                              <td
                                key={a.id || a.exam_id}
                                className="p-4 text-center"
                              >
                                {examScore !== undefined &&
                                examScore !== null &&
                                examScore.score !== undefined ? (
                                  <Link
                                    to={`/teacher/analytics?classroomId=${selectedClassroomId}&examId=${a.exam_id}&studentId=${entry.student_id}`}
                                    className={`inline-block font-extrabold px-2.5 py-1 rounded-xl text-xs tabular-nums border hover:scale-105 transition-transform ${
                                      Number(examScore.score) >= 8.0
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                                        : Number(examScore.score) >= 6.5
                                          ? 'bg-blue-50 text-blue-700 border-blue-200/80'
                                          : Number(examScore.score) >= 5.0
                                            ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                                            : 'bg-rose-50 text-rose-700 border-rose-200/80'
                                    }`}
                                    title="Xem phân tích bài thi của học sinh này"
                                  >
                                    {examScore.score}
                                  </Link>
                                ) : (
                                  <span className="text-slate-300 text-xs font-medium">
                                    Chưa nộp
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          {assignments.length === 0 && (
                            <td className="p-4 text-center text-slate-400">-</td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}