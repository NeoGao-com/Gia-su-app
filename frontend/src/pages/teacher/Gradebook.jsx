import React, { useEffect, useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api from '../../api/axios';
import { Users, Copy, Check, Award, BookOpen, TrendingUp, CheckCircle2 } from 'lucide-react';
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
      .then(res => {
        const items = Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
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
      .then(res => {
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

    return () => { cancelled = true; };
  }, [selectedClassroomId]);

  const assignments = gradebookData?.assignments || [];
  const entries = gradebookData?.gradebook || [];

  // Calculate stats for current classroom
  const calcStudentAverage = (entry) => {
    let sum = 0;
    let count = 0;
    assignments.forEach(a => {
      const scoreObj = entry.scores?.[a.exam_id];
      if (scoreObj && scoreObj.score !== undefined && scoreObj.score !== null) {
        sum += Number(scoreObj.score);
        count++;
      }
    });
    return count > 0 ? (sum / count).toFixed(1) : null;
  };

  const classAvg = (() => {
    const studentAvgs = entries.map(calcStudentAverage).filter(Boolean).map(Number);
    return studentAvgs.length > 0 ? (studentAvgs.reduce((a, b) => a + b, 0) / studentAvgs.length).toFixed(1) : '—';
  })();

  const handleCopySummary = () => {
    const currentClass = classrooms.find(c => String(c.id) === String(selectedClassroomId));
    const className = currentClass ? currentClass.name : 'Nhóm kèm';
    
    let text = `📊 BÁO CÁO TIẾN ĐỘ & ĐIỂM SỐ - ${className.toUpperCase()}\n`;
    text += `Điểm trung bình lớp: ${classAvg}\n`;
    text += `------------------------------------\n`;
    
    if (entries.length === 0) {
      text += 'Chưa có dữ liệu học sinh.\n';
    } else {
      entries.forEach((e, idx) => {
        const studentAvg = calcStudentAverage(e);
        text += `${idx + 1}. ${e.student_name || 'Học sinh'} (ĐTB: ${studentAvg || '—'}):\n`;
        assignments.forEach(a => {
          const scoreObj = e.scores?.[a.exam_id];
          const scoreText = (scoreObj && scoreObj.score !== undefined && scoreObj.score !== null) 
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
                  {classrooms.map(c => (
                    <option key={c.id} value={c.id}>Lớp: {c.name} ({c.code || c.id})</option>
                  ))}
                </select>

                <button
                  onClick={handleCopySummary}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 active:scale-95 transition shadow-sm whitespace-nowrap"
                  title="Sao chép bảng tổng kết nhanh để gửi Zalo cho phụ huynh"
                >
                  {summaryCopied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{summaryCopied ? 'Đã sao chép!' : 'Xuất tóm tắt gửi PH'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Classroom Stats */}
          {selectedClassroomId && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sĩ số lớp</div>
                  <div className="text-xl font-extrabold text-slate-900 tabular-nums">{entries.length} học sinh</div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bài tập đã giao</div>
                  <div className="text-xl font-extrabold text-slate-900 tabular-nums">{assignments.length} đề thi</div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Điểm TB cả lớp</div>
                  <div className="text-xl font-extrabold text-emerald-700 tabular-nums">{classAvg} / 10</div>
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
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-4 min-w-[180px]">Học sinh</th>
                    <th className="p-4 min-w-[200px]">Email</th>
                    <th className="p-4 text-center min-w-[110px] bg-indigo-50/70 text-indigo-800 font-extrabold">
                      Điểm TB
                    </th>
                    {assignments.map(a => (
                      <th key={a.id || a.exam_id} className="p-4 text-center min-w-[130px]">
                        <div className="truncate max-w-[150px] mx-auto font-bold" title={a.exam?.title}>
                          {a.exam?.title || `Đề thi #${a.exam_id}`}
                        </div>
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
                      <td colSpan={3 + Math.max(assignments.length, 1)} className="p-12 text-center text-slate-400">
                        Chưa có học sinh tham gia lớp học này. Hãy gửi mã mời cho học sinh.
                      </td>
                    </tr>
                  ) : (
                    entries.map(entry => {
                      const studentAvg = calcStudentAverage(entry);
                      return (
                        <tr key={entry.student_id} className="hover:bg-slate-50/80 transition">
                          <td className="p-4 font-bold text-slate-800">
                            {entry.student_name || 'Học sinh'}
                          </td>
                          <td className="p-4 text-slate-400 text-xs font-mono">
                            {entry.student_email || '-'}
                          </td>
                          <td className="p-4 text-center bg-indigo-50/40 font-extrabold">
                            {studentAvg !== null ? (
                              <span className={`px-2.5 py-1 rounded-xl text-xs font-extrabold tabular-nums border ${
                                Number(studentAvg) >= 8.0 
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80' 
                                  : Number(studentAvg) >= 6.5
                                    ? 'bg-blue-50 text-blue-800 border-blue-200/80'
                                    : Number(studentAvg) >= 5.0 
                                      ? 'bg-amber-50 text-amber-800 border-amber-200/80' 
                                      : 'bg-rose-50 text-rose-800 border-rose-200/80'
                              }`}>
                                {studentAvg}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-normal">—</span>
                            )}
                          </td>
                          {assignments.map(a => {
                            const examScore = entry.scores?.[a.exam_id];
                            return (
                              <td key={a.id || a.exam_id} className="p-4 text-center">
                                {examScore !== undefined && examScore !== null && examScore.score !== undefined ? (
                                  <span className={`inline-block font-extrabold px-2.5 py-1 rounded-xl text-xs tabular-nums border ${
                                    Number(examScore.score) >= 8.0
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                                      : Number(examScore.score) >= 6.5
                                        ? 'bg-blue-50 text-blue-700 border-blue-200/80'
                                        : Number(examScore.score) >= 5.0
                                          ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                                          : 'bg-rose-50 text-rose-700 border-rose-200/80'
                                  }`}>
                                    {examScore.score}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-xs font-medium">Chưa nộp</span>
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