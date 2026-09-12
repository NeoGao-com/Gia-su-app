import React, { useEffect, useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import axios from 'axios';
import api from '../../api/axios';
import { Users, Copy, Check } from 'lucide-react';

export function Gradebook() {
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
    const controller = new AbortController();
    api.get(`/classrooms/${selectedClassroomId}/gradebook`, { signal: controller.signal })
      .then(res => {
        setGradebookData(res.data);
      })
      .catch((error) => {
        if (axios.isCancel(error)) return;
        setGradebookData(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [selectedClassroomId]);

  const assignments = gradebookData?.assignments || [];
  const entries = gradebookData?.gradebook || [];

  const handleCopySummary = () => {
    const currentClass = classrooms.find(c => String(c.id) === String(selectedClassroomId));
    const className = currentClass ? currentClass.name : 'Nhóm kèm';
    
    let text = `📊 BÁO CÁO TIẾN ĐỘ & ĐIỂM SỐ - ${className.toUpperCase()}\n`;
    text += `------------------------------------\n`;
    
    if (entries.length === 0) {
      text += 'Chưa có dữ liệu học sinh.\n';
    } else {
      entries.forEach((e, idx) => {
        text += `${idx + 1}. ${e.student_name || 'Học sinh'}:\n`;
        assignments.forEach(a => {
          const scoreObj = e.scores?.[a.exam_id];
          const scoreText = (scoreObj && scoreObj.score !== undefined) ? `${scoreObj.score}/10` : 'Chưa nộp';
          text += `   - ${a.exam?.title || `Bài thi #${a.exam_id}`}: ${scoreText}\n`;
        });
      });
    }
    
    navigator.clipboard.writeText(text);
    setSummaryCopied(true);
    setTimeout(() => setSummaryCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-pastel-bg">
      <Navbar />
      <div className="flex">
        <Sidebar role="teacher" />
        <main className="flex-1 p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Sổ Điểm & Báo Cáo Tiến Độ</h1>
              <p className="text-xs text-gray-500 mt-1">Theo dõi điểm số từng bài thi của học sinh theo từng nhóm kèm</p>
            </div>

            {classrooms.length > 0 && (
              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <select
                  value={selectedClassroomId}
                  onChange={(e) => setSelectedClassroomId(e.target.value)}
                  className="px-4 py-2.5 bg-white rounded-2xl border border-gray-200 text-xs sm:text-sm font-bold text-gray-700 focus:outline-none focus:border-pastel-purple shadow-sm"
                >
                  {classrooms.map(c => (
                    <option key={c.id} value={c.id}>Nhóm: {c.name} ({c.code || c.id})</option>
                  ))}
                </select>

                <button
                  onClick={handleCopySummary}
                  className="flex items-center space-x-1.5 px-4 py-2.5 bg-pastel-purple text-white text-xs font-bold rounded-2xl hover:bg-pastel-purpleDark transition shadow-sm whitespace-nowrap"
                  title="Sao chép bảng tổng kết nhanh để gửi Zalo cho phụ huynh"
                >
                  {summaryCopied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{summaryCopied ? 'Đã sao chép!' : 'Xuất tóm tắt gửi PH'}</span>
                </button>
              </div>
            )}
          </div>

          {classrooms.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Bạn chưa tạo lớp học nào để xem sổ điểm.</p>
            </div>
          ) : loading ? (
            <div className="p-12 text-center text-pastel-purpleDark font-medium animate-pulse">Đang tải sổ điểm...</div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-pastel-bg text-xs font-bold text-gray-500 uppercase">
                    <th className="p-4 min-w-[180px]">Học sinh</th>
                    <th className="p-4 min-w-[200px]">Email</th>
                    {assignments.map(a => (
                      <th key={a.id || a.exam_id} className="p-4 text-center min-w-[120px]">
                        {a.exam?.title || `Đề thi #${a.exam_id}`}
                      </th>
                    ))}
                    {assignments.length === 0 && (
                      <th className="p-4 text-center text-gray-400">Chưa giao bài thi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={2 + Math.max(assignments.length, 1)} className="p-8 text-center text-gray-500">
                        Chưa có học sinh tham gia lớp học này.
                      </td>
                    </tr>
                  ) : (
                    entries.map(entry => (
                      <tr key={entry.student_id} className="hover:bg-pastel-bg/50 transition">
                        <td className="p-4 font-medium text-gray-800">{entry.student_name || 'Học sinh'}</td>
                        <td className="p-4 text-gray-500 text-xs">{entry.student_email || '-'}</td>
                        {assignments.map(a => {
                          const examScore = entry.scores?.[a.exam_id];
                          return (
                            <td key={a.id || a.exam_id} className="p-4 text-center">
                              {examScore !== undefined && examScore !== null ? (
                                <span className={`font-bold px-2.5 py-1 rounded-full text-xs ${
                                  Number(examScore.score) >= 5
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-red-50 text-red-600'
                                }`}>
                                  {examScore.score} / 10
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">Chưa nộp</span>
                              )}
                            </td>
                          );
                        })}
                        {assignments.length === 0 && (
                          <td className="p-4 text-center text-gray-400">-</td>
                        )}
                      </tr>
                    ))
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