import React from 'react';
import { Search, Edit3, Trash2, Send, CheckCircle2, XCircle } from 'lucide-react';

export function ExamListTable({ exams, loading, search, setSearch, page, totalPages, total, setPage, onAssign, onEdit, onDelete, onTogglePublish }) {
  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
      <div className="bg-white p-5 border-b border-slate-200/80">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tiêu đề đề thi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-800"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <th className="py-3.5 px-6">Mã / Tiêu đề đề thi</th>
              <th className="py-3.5 px-6">Thời lượng</th>
              <th className="py-3.5 px-6">Số câu / Điểm đạt</th>
              <th className="py-3.5 px-6">Trạng thái</th>
              <th className="py-3.5 px-6 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-slate-400">Đang tải danh sách đề thi...</td>
              </tr>
            ) : exams.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-slate-400">Không tìm thấy đề thi nào phù hợp.</td>
              </tr>
            ) : (
              exams.map((exam) => (
                <tr key={exam.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-900">{exam.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5 tabular-nums">Mã: #{exam.id} • Ngày tạo: {exam.created_at ? new Date(exam.created_at).toLocaleDateString('vi-VN') : 'N/A'}</div>
                  </td>
                  <td className="py-4 px-6 text-slate-700 font-semibold tabular-nums">{exam.duration_minutes} phút</td>
                  <td className="py-4 px-6 text-slate-700">
                    <div className="font-semibold tabular-nums">{exam.question_count || '-'} câu hỏi</div>
                    <div className="text-xs text-slate-500 tabular-nums">Đạt từ: {exam.pass_score ?? 5.0} điểm</div>
                  </td>
                  <td className="py-4 px-6">
                    <button
                      type="button"
                      onClick={() => onTogglePublish(exam)}
                      className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border transition cursor-pointer ${
                        exam.is_published
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      {exam.is_published ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-amber-600" />}
                      <span>{exam.is_published ? 'Đã xuất bản' : 'Bản nháp'}</span>
                    </button>
                  </td>
                  <td className="py-4 px-6 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => onAssign(exam)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-semibold hover:bg-indigo-100 transition cursor-pointer"
                      title="Giao đề thi cho lớp học"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Giao bài</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(exam)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-200 transition cursor-pointer"
                      title="Chỉnh sửa đề thi"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Sửa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(exam.id)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-xs font-semibold hover:bg-rose-100 transition cursor-pointer"
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
        <div className="flex justify-between items-center p-4 border-t border-slate-200 text-xs text-slate-600 tabular-nums">
          <span>Trang <strong className="text-slate-800 font-bold">{page}</strong> / {totalPages} (Tổng {total} đề thi)</span>
          <div className="space-x-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              className="px-3 py-1.5 border border-slate-200 rounded-xl disabled:opacity-40 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              Trước
            </button>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              className="px-3 py-1.5 border border-slate-200 rounded-xl disabled:opacity-40 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
