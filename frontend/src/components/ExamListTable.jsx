import React from 'react';
import { Search, Edit3, Trash2, Send, CheckCircle2, XCircle } from 'lucide-react';

export function ExamListTable({ exams, loading, search, setSearch, page, totalPages, total, setPage, onAssign, onEdit, onDelete, onTogglePublish }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-white p-6 border-b border-gray-100">
        <div className="relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tiêu đề đề thi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pastel-purple"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="py-4 px-6">ID / Tiêu đề</th>
              <th className="py-4 px-6">Thời gian</th>
              <th className="py-4 px-6">Số câu / Điểm đạt</th>
              <th className="py-4 px-6">Trạng thái</th>
              <th className="py-4 px-6 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-gray-400">Đang tải danh sách đề thi...</td>
              </tr>
            ) : exams.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-gray-400">Không tìm thấy đề thi nào.</td>
              </tr>
            ) : (
              exams.map((exam) => (
                <tr key={exam.id} className="hover:bg-gray-50 transition">
                  <td className="py-4 px-6">
                    <div className="font-semibold text-gray-900">{exam.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">ID: #{exam.id} | Tạo ngày: {exam.created_at ? new Date(exam.created_at).toLocaleDateString('vi-VN') : 'N/A'}</div>
                  </td>
                  <td className="py-4 px-6 text-gray-600 font-medium">{exam.duration_minutes} phút</td>
                  <td className="py-4 px-6 text-gray-600">
                    <div>{exam.question_count || '-'} câu hỏi</div>
                    <div className="text-xs text-gray-400">Đạt: {exam.pass_score ?? 5.0} điểm</div>
                  </td>
                  <td className="py-4 px-6">
                    <button
                      onClick={() => onTogglePublish(exam)}
                      className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold ${
                        exam.is_published
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      }`}
                    >
                      {exam.is_published ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      <span>{exam.is_published ? 'Đã xuất bản' : 'Bản nháp'}</span>
                    </button>
                  </td>
                  <td className="py-4 px-6 text-right space-x-2">
                    <button
                      onClick={() => onAssign(exam)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-medium hover:bg-indigo-100 transition"
                      title="Giao bài cho lớp"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Giao bài</span>
                    </button>
                    <button
                      onClick={() => onEdit(exam)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-medium hover:bg-gray-200 transition"
                      title="Chỉnh sửa đề thi"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Sửa</span>
                    </button>
                    <button
                      onClick={() => onDelete(exam.id)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-xs font-medium hover:bg-red-100 transition"
                      title="Xóa đề thi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center p-4 border-t border-gray-100 text-sm text-gray-500">
          <span>Trang {page} / {totalPages} (Tổng {total} đề thi)</span>
          <div className="space-x-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              className="px-3 py-1 border rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              Trước
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              className="px-3 py-1 border rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
