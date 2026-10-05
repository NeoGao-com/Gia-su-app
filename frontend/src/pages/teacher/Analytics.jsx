import React, { useEffect, useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import { TrendingUp, Users, Award, BookOpen, BarChart3, School, FileText, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../../api/axios';

export function Analytics() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'exams' | 'classrooms'
  const [stats, setStats] = useState({
    exams_count: 0,
    questions_count: 0,
    classrooms_count: 0,
    submissions_count: 0,
    average_score: 0,
    score_distribution: []
  });
  const [examsList, setExamsList] = useState([]);
  const [classroomsList, setClassroomsList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [summaryRes, examsRes, classRes] = await Promise.all([
          api.get('/analytics/summary').catch(() => ({ data: {} })),
          api.get('/exams').catch(() => ({ data: [] })),
          api.get('/classrooms', { params: { limit: 100 } }).catch(() => ({ data: [] }))
        ]);

        setStats(summaryRes.data || {});
        setExamsList(Array.isArray(examsRes.data?.items) ? examsRes.data.items : (Array.isArray(examsRes.data) ? examsRes.data : []));
        const classes = Array.isArray(classRes.data?.items) ? classRes.data.items : (Array.isArray(classRes.data) ? classRes.data : []);
        setClassroomsList(classes);
      } catch (err) {
        console.error('Lỗi lấy dữ liệu thống kê:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const chartData = (stats.score_distribution && stats.score_distribution.length > 0)
    ? stats.score_distribution.map(d => ({
        range: d.name || d.range,
        count: d.count || 0
      }))
    : [
        { range: 'Yếu (< 5)', count: 0 },
        { range: 'Trung bình (5 - 6.5)', count: 0 },
        { range: 'Khá (6.5 - 8)', count: 0 },
        { range: 'Giỏi (>= 8)', count: 0 }
      ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Navbar />
      <div className="flex">
        <Sidebar role="teacher" />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
              <BarChart3 className="w-7 h-7 text-indigo-600" />
              <span>Thống kê & Phân tích chất lượng</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Phân tích phổ điểm, chất lượng giảng dạy phân tầng theo tổng quan, từng đề thi và từng lớp học.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center space-x-2 ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Tổng quan chung</span>
            </button>

            <button
              onClick={() => setActiveTab('exams')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center space-x-2 ${activeTab === 'exams' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              <FileText className="w-4 h-4" />
              <span>Phân tích theo Đề thi ({examsList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('classrooms')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center space-x-2 ${activeTab === 'classrooms' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              <School className="w-4 h-4" />
              <span>Phân tích theo Lớp học ({classroomsList.length})</span>
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center space-x-4">
                  <div className="bg-indigo-50 text-indigo-600 p-3.5 rounded-xl">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Tổng số bài nộp</p>
                    <h3 className="text-2xl font-black text-slate-900 mt-0.5 tabular-nums">{loading ? '...' : (stats.submissions_count || 0)}</h3>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center space-x-4">
                  <div className="bg-emerald-50 text-emerald-600 p-3.5 rounded-xl">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Điểm trung bình</p>
                    <h3 className="text-2xl font-black text-emerald-700 mt-0.5 tabular-nums">{loading ? '...' : (stats.average_score || 0)}</h3>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center space-x-4">
                  <div className="bg-blue-50 text-blue-600 p-3.5 rounded-xl">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Tổng đề thi</p>
                    <h3 className="text-2xl font-black text-slate-900 mt-0.5 tabular-nums">{loading ? '...' : (stats.exams_count || 0)}</h3>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center space-x-4">
                  <div className="bg-amber-50 text-amber-600 p-3.5 rounded-xl">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Tổng câu hỏi</p>
                    <h3 className="text-2xl font-black text-slate-900 mt-0.5 tabular-nums">{loading ? '...' : (stats.questions_count || 0)}</h3>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  <span>Biểu đồ Phổ điểm Tổng thể</span>
                </h2>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="range" tick={{ fill: '#64748B', fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value) => [`${value} bài`, 'Số lượng']} 
                      />
                      <Bar dataKey="count" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'exams' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-800">
                Thống kê chi tiết theo từng bài thi ({examsList.length})
              </div>
              {examsList.length === 0 ? (
                <div className="p-12 text-center text-slate-400">Chưa có đề thi nào trong hệ thống.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <th className="p-4">Tên bài thi</th>
                        <th className="p-4">Thời gian</th>
                        <th className="p-4">Số lượng câu hỏi</th>
                        <th className="p-4">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {examsList.map((exam) => (
                        <tr key={exam.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-4 font-bold text-slate-900">{exam.title}</td>
                          <td className="p-4 text-slate-600 tabular-nums">{exam.duration_minutes} phút</td>
                          <td className="p-4 font-semibold text-indigo-700 tabular-nums">{exam.question_count ?? (exam.questions?.length || 0)} câu</td>
                          <td className="p-4">
                            <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              exam.is_published 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                : 'bg-amber-50 border-amber-200 text-amber-700'
                            }`}>
                              {exam.is_published ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Đã xuất bản</span>
                                </>
                              ) : (
                                <span>Bản nháp</span>
                              )}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'classrooms' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 font-bold text-sm text-slate-800">
                Thống kê chi tiết theo từng lớp học ({classroomsList.length})
              </div>
              {classroomsList.length === 0 ? (
                <div className="p-12 text-center text-slate-400">Chưa có lớp học nào.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 p-6">
                  {classroomsList.map((c) => (
                    <div key={c.id} className="p-5 border border-slate-200 rounded-xl bg-white hover:border-indigo-300 hover:shadow-sm transition">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                          <School className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-base">{c.name}</h4>
                          <span className="text-xs text-slate-400 font-mono">Mã lớp: {c.code || c.id}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mb-4">{c.description || 'Không có mô tả'}</p>
                      <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100 font-semibold text-slate-600">
                        <span className="tabular-nums">Sĩ số: {c.students?.length || 0} học sinh</span>
                        <span className="text-indigo-700 font-bold tabular-nums">Đề đã giao: {c.assignments?.length || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
