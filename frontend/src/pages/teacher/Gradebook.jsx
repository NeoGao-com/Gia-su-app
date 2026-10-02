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
    <div className="min-h-screen bg-pastel-bg">
      <Navbar />
      <div className="flex">
        <Sidebar role="teacher" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight flex items-center space-x-2">
                <Award className="w-6 h-6 text-pastel-purpleDark" />
                <span>Sổ Điểm & Báo Cáo Tiến Độ</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Theo dõi điểm số từng bài thi của học sinh theo từng nhóm kèm và xuất báo cáo Zalo
              </p>
            </div>

            {classrooms.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <select
                  value={selectedClassroomId}
                  onChange={(e) => setSelectedClassroomId(e.target.value)}
                  className="px-4 py-2 bg-white rounded-2xl border border-gray-200 text-xs sm:text-sm font-bold text-gray-700 focus:outline-none focus:border-pastel-purple shadow-xs"
                >
                  {classrooms.map(c => (
                    <option key={c.id} value={c.id}>Nhóm: {c.name} ({c.code || c.id})</option>
                  ))}
                </select>

                <button
                  onClick={handleCopySummary}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-pastel-purple to-pastel-purpleDark text-white text-xs font-bold rounded-2xl hover:opacity-95 transition shadow-xs whitespace-nowrap interactive-btn"
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
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-card flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-gray-400 uppercase">Sĩ số nhóm</div>
                  <div className="text-lg font-black text-gray-800">{entries.length} học sinh</div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-card flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-pastel-purpleDark flex items-center justify-center font-bold">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-gray-400 uppercase">Bài tập đã giao</div>
                  <div className="text-lg font-black text-gray-800">{assignments.length} đề thi</div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-card flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-gray-400 uppercase">Điểm TB cả nhóm</div>
                  <div className="text-lg font-black text-emerald-600">{classAvg} / 10</div>
                </div>
              </div>
            </div>
          )}

          {classrooms.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-card">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Bạn chưa tạo lớp học nào để xem sổ điểm.</p>
            </div>
          ) : loading ? (
            <div className="bg-white rounded-3xl p-16 text-center border border-gray-100 shadow-card text-pastel-purpleDark font-semibold animate-pulse text-sm">
              Đang tải dữ liệu sổ điểm nhóm học...
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-card overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                    <th className="p-4 min-w-[180px]">Học sinh</th>
                    <th className="p-4 min-w-[200px]">Email</th>
                    <th className="p-4 text-center min-w-[110px] bg-purple-50/40 text-pastel-purpleDark font-black">
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
                      <th className="p-4 text-center text-gray-400">Chưa giao bài thi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={3 + Math.max(assignments.length, 1)} className="p-12 text-center text-gray-400">
                        Chưa có học sinh tham gia nhóm học này. Hãy gửi mã mời cho học sinh.
                      </td>
                    </tr>
                  ) : (
                    entries.map(entry => {
                      const studentAvg = calcStudentAverage(entry);
                      return (
                        <tr key={entry.student_id} className="hover:bg-purple-50/20 transition">
                          <td className="p-4 font-bold text-gray-800">
                            {entry.student_name || 'Học sinh'}
                          </td>
                          <td className="p-4 text-gray-400 text-xs font-mono">
                            {entry.student_email || '-'}
                          </td>
                          <td className="p-4 text-center bg-purple-50/20 font-black">
                            {studentAvg !== null ? (
                              <span className={`px-2.5 py-1 rounded-xl text-xs font-extrabold ${
                                Number(studentAvg) >= 8.0 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : Number(studentAvg) >= 5.0 
                                    ? 'bg-amber-100 text-amber-800' 
                                    : 'bg-rose-100 text-rose-800'
                              }`}>
                                {studentAvg}
                              </span>
                            ) : (
                              <span className="text-gray-300 font-normal">—</span>
                            )}
                          </td>
                          {assignments.map(a => {
                            const examScore = entry.scores?.[a.exam_id];
                            return (
                              <td key={a.id || a.exam_id} className="p-4 text-center">
                                {examScore !== undefined && examScore !== null && examScore.score !== undefined ? (
                                  <span className={`inline-block font-extrabold px-2.5 py-1 rounded-xl text-xs ${
                                    Number(examScore.score) >= 8.0
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : Number(examScore.score) >= 5.0
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}>
                                    {examScore.score}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 text-xs font-medium">Chưa nộp</span>
                                )}
                              </td>
                            );
                          })}
                          {assignments.length === 0 && (
                            <td className="p-4 text-center text-gray-400">-</td>
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