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
          api.get('/classrooms/?limit=100').catch(() => ({ data: [] }))
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
    <div className="min-h-screen bg-pastel-bg">
      <Navbar />
      <div className="flex">
        <Sidebar role="teacher" />
        <main className="flex-1 p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
              <BarChart3 className="w-7 h-7 text-pastel-purpleDark" />
              <span>Thống kê & Phân tích chất lượng</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Phân tích phổ điểm, chất lượng giảng dạy phân tầng theo tổng quan, từng đề thi và từng lớp học.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center space-x-3 mb-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2.5 rounded-2xl font-bold text-sm transition flex items-center space-x-2 ${activeTab === 'overview' ? 'bg-pastel-purple text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Tổng quan chung</span>
            </button>

            <button
              onClick={() => setActiveTab('exams')}
              className={`px-4 py-2.5 rounded-2xl font-bold text-sm transition flex items-center space-x-2 ${activeTab === 'exams' ? 'bg-pastel-purple text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            >
              <FileText className="w-4 h-4" />
              <span>Phân tích theo Đề thi ({examsList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('classrooms')}
              className={`px-4 py-2.5 rounded-2xl font-bold text-sm transition flex items-center space-x-2 ${activeTab === 'classrooms' ? 'bg-pastel-purple text-white shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            >
              <School className="w-4 h-4" />
              <span>Phân tích theo Lớp học ({classroomsList.length})</span>
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
                  <div className="bg-purple-50 text-pastel-purpleDark p-3.5 rounded-2xl">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Tổng số bài nộp</p>
                    <h3 className="text-2xl font-bold text-gray-800 mt-1">{loading ? '...' : (stats.submissions_count || 0)}</h3>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
                  <div className="bg-emerald-50 text-emerald-600 p-3.5 rounded-2xl">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Điểm trung bình toàn khóa</p>
                    <h3 className="text-2xl font-bold text-gray-800 mt-1">{loading ? '...' : (stats.average_score || 0)}</h3>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
                  <div className="bg-blue-50 text-blue-600 p-3.5 rounded-2xl">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Tổng đề thi đã tạo</p>
                    <h3 className="text-2xl font-bold text-gray-800 mt-1">{loading ? '...' : (stats.exams_count || 0)}</h3>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
                  <div className="bg-amber-50 text-amber-600 p-3.5 rounded-2xl">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Tổng câu hỏi ngân hàng</p>
                    <h3 className="text-2xl font-bold text-gray-800 mt-1">{loading ? '...' : (stats.questions_count || 0)}</h3>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-pastel-purpleDark" />
                  <span>Biểu đồ Phổ điểm Tổng thể</span>
                </h2>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="range" />
                      <YAxis allowDecimals={false} />
                      <Tooltip formatter={(value) => [`${value} bài`, 'Số lượng']} />
                      <Bar dataKey="count" fill="#9382f6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'exams' && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 font-bold text-sm text-gray-700">
                Thống kê chi tiết theo từng bài thi ({examsList.length})
              </div>
              {examsList.length === 0 ? (
                <div className="p-12 text-center text-gray-400">Chưa có đề thi nào trong hệ thống.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        <th className="p-4">Tên bài thi</th>
                        <th className="p-4">Thời gian</th>
                        <th className="p-4">Số lượng câu hỏi</th>
                        <th className="p-4">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {examsList.map((exam) => (
                        <tr key={exam.id} className="hover:bg-gray-50 transition">
                          <td className="p-4 font-bold text-gray-800">{exam.title}</td>
                          <td className="p-4 text-gray-600">{exam.duration_minutes} phút</td>
                          <td className="p-4 font-semibold text-pastel-purpleDark">{exam.question_count ?? (exam.questions?.length || 0)} câu</td>
                          <td className="p-4">
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Hoạt động</span>
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
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 font-bold text-sm text-gray-700">
                Thống kê chi tiết theo từng lớp học ({classroomsList.length})
              </div>
              {classroomsList.length === 0 ? (
                <div className="p-12 text-center text-gray-400">Chưa có lớp học nào.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                  {classroomsList.map((c) => (
                    <div key={c.id} className="p-5 border border-gray-100 rounded-2xl bg-gray-50/50 hover:bg-white hover:shadow-md transition">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="p-3 bg-purple-50 text-pastel-purpleDark rounded-xl">
                          <School className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-800 text-base">{c.name}</h4>
                          <span className="text-xs text-gray-400">Mã lớp: {c.code || c.id}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">{c.description || 'Không có mô tả'}</p>
                      <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100 font-semibold text-gray-600">
                        <span>Sĩ số: {c.students?.length || 0} học sinh</span>
                        <span className="text-pastel-purpleDark font-bold">Đề đã giao: {c.assignments?.length || 0}</span>
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
