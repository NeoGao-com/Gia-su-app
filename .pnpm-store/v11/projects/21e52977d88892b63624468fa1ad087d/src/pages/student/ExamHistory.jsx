import React, { useEffect, useState } from 'react';
import { Navbar } from '../../components/Navbar';
import { Sidebar } from '../../components/Sidebar';
import api from '../../api/axios';
import { Clock, Award, FileText, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ExamHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/student/history?limit=100')
      .then(res => {
        const items = Array.isArray(res.data?.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
        setHistory(items);
      })
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  const avgScore = history.length > 0 ? (history.reduce((a, b) => a + Number(b.score || 0), 0) / history.length).toFixed(1) : 0;
  const passedCount = history.filter(h => Number(h.score || 0) >= 5.0).length;

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
                <span>Lịch sử làm bài & Điểm số</span>
              </h1>
              <p className="text-xs text-gray-500 mt-1">Xem lại kết quả các bài thi bạn đã hoàn thành</p>
            </div>
            <div className="flex items-center space-x-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
              <div className="text-right">
                <div className="text-[10px] text-gray-400 font-bold uppercase">Tổng số bài nộp</div>
                <div className="text-sm font-extrabold text-gray-800">{history.length} bài</div>
              </div>
              <div className="h-8 w-px bg-gray-100"></div>
              <div className="text-right">
                <div className="text-[10px] text-gray-400 font-bold uppercase">Điểm TB</div>
                <div className="text-sm font-extrabold text-pastel-purpleDark">{avgScore}</div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
              <div className="text-pastel-purpleDark font-medium animate-pulse">Đang tải lịch sử làm bài...</div>
            </div>
          ) : history.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600">Bạn chưa có lịch sử làm bài thi nào</p>
              <p className="text-xs text-gray-400 mt-1">Hãy vào danh sách bài thi và bắt đầu làm bài đầu tiên.</p>
              <Link to="/student/exams" className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 bg-pastel-purple text-white rounded-xl text-xs font-bold hover:bg-pastel-purpleDark transition shadow-sm">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Xem danh sách bài thi</span>
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center text-xs text-gray-500 font-bold">
                <span>Danh sách kết quả nộp bài ({history.length})</span>
                <span>Đạt &gt;= 5.0đ: {passedCount}/{history.length}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {history.map(item => {
                  const scoreNum = Number(item.score ?? 0);
                  const isPassed = scoreNum >= 5.0;
                  return (
                    <div key={item.id} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-gray-50/50 transition">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-bold text-gray-800 text-base">{item.exam_title || 'Bài thi trắc nghiệm'}</h3>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            item.grading_status === 'GRADED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
                          }`}>
                            {item.grading_status === 'GRADED' ? 'Đã chấm điểm' : 'Chờ chấm tự luận'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-gray-500 font-medium">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Nộp lúc: {item.submitted_at ? new Date(item.submitted_at).toLocaleString('vi-VN') : '—'}</span>
                          </span>
                          {item.attempt_number && <span>• Lần thi #{item.attempt_number}</span>}
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-gray-400 block">Điểm số</span>
                          <span className={`text-xl font-black ${isPassed ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {item.score ?? 0} <span className="text-xs text-gray-400 font-normal">/ 10</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
