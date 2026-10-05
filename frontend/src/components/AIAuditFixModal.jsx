import React, { useState } from 'react';
import { 
  Wand2, X, AlertCircle, CheckCircle2, RefreshCw, Loader2, 
  HelpCircle, ArrowRight, ShieldCheck, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react';
import api from '../api/axios';
import { MathRenderer } from './MathRenderer';

export function AIAuditFixModal({ isOpen, onClose, selectedCategory, onFinished, toast }) {
  const [scope, setScope] = useState(selectedCategory ? 'category' : 'all');
  const [filterType, setFilterType] = useState('missing_or_incorrect'); // 'missing_or_incorrect' | 'missing_only' | 'incorrect_only' | 'all'
  const [limit, setLimit] = useState(15);
  const [autoApply, setAutoApply] = useState(true);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  if (!isOpen) return null;

  const handleStartAudit = async () => {
    try {
      setLoading(true);
      setResult(null);

      const payload = {
        filter_type: filterType,
        limit: Number(limit),
        auto_apply: autoApply
      };

      if (scope === 'category' && selectedCategory) {
        if (selectedCategory.subject) payload.subject = selectedCategory.subject;
        if (selectedCategory.grade_level) payload.grade_level = selectedCategory.grade_level;
        if (selectedCategory.chapter) payload.chapter = selectedCategory.chapter;
        if (selectedCategory.lesson) payload.lesson = selectedCategory.lesson;
        if (selectedCategory.topic) payload.topic = selectedCategory.topic;
      }

      const res = await api.post('/ai/audit-and-fix-batch', payload);
      setResult(res.data);
      if (res.data?.success) {
        const total = (res.data.fixed_count || 0) + (res.data.filled_missing_count || 0);
        if (total > 0) {
          toast?.success?.(`AI đã xử lý xong! Sửa ${res.data.fixed_count} câu sai và chọn đáp án cho ${res.data.filled_missing_count} câu thiếu.`);
        } else {
          toast?.info?.('AI đã rà soát xong: Không có câu nào cần sửa trong phạm vi này.');
        }
        if (onFinished) onFinished();
      }
    } catch (err) {
      toast?.error?.(err.response?.data?.detail || 'Không thể thực hiện rà soát AI');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (result && onFinished) {
      onFinished();
    }
    setResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-gray-100 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-200/90 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-2xs">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <span>Tự động kiểm tra & Chuẩn hóa đáp án</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kiểm tra câu hỏi, sửa phương án sai và tự động chọn đáp án đúng cho câu chưa có lời giải.
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose} 
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {!result && !loading && (
            <div className="space-y-5">
              {/* Scope Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Phạm vi rà soát
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setScope('category')}
                    disabled={!selectedCategory}
                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                      scope === 'category' 
                        ? 'border-amber-400 bg-amber-50/50 text-amber-900 shadow-xs' 
                        : 'border-gray-200 bg-gray-50/50 text-gray-600 hover:bg-gray-50'
                    } ${!selectedCategory ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="font-bold text-xs flex items-center space-x-1.5">
                      <span>📁 Theo thư mục đang chọn</span>
                    </span>
                    <span className="text-[11px] text-gray-500 mt-1 line-clamp-1">
                      {selectedCategory 
                        ? `${selectedCategory.subject} › Khối ${selectedCategory.grade_level || 10}${selectedCategory.chapter ? ` › ${selectedCategory.chapter}` : ''}`
                        : '(Chưa chọn thư mục nào ở cây)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('all')}
                    className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                      scope === 'all' 
                        ? 'border-amber-400 bg-amber-50/50 text-amber-900 shadow-xs' 
                        : 'border-gray-200 bg-gray-50/50 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-bold text-xs">🌐 Toàn bộ ngân hàng câu hỏi</span>
                    <span className="text-[11px] text-gray-500 mt-1">
                      Quét tất cả các môn, khối và chương
                    </span>
                  </button>
                </div>
              </div>

              {/* Target Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Đối tượng câu hỏi cần xử lý
                </label>
                <div className="space-y-2">
                  {[
                    {
                      id: 'missing_or_incorrect',
                      title: '⚡ Câu chưa có đáp án HOẶC nghi ngờ sai (Khuyên dùng)',
                      desc: 'AI ưu tiên sửa các câu bị thiếu đáp án hoặc đã được đánh dấu có khả năng sai.'
                    },
                    {
                      id: 'missing_only',
                      title: '⚠️ Chỉ các câu chưa chọn đáp án',
                      desc: 'AI sẽ giải và chọn đáp án chính xác cho các câu hỏi còn bỏ trống.'
                    },
                    {
                      id: 'incorrect_only',
                      title: '❌ Chỉ các câu đã phát hiện sai đáp án',
                      desc: 'AI sẽ kiểm tra lại và sửa đáp án giáo viên chọn sai sang đáp án đúng.'
                    },
                    {
                      id: 'all',
                      title: '🔍 Rà soát toàn diện tất cả câu hỏi',
                      desc: 'Kiểm tra độc lập toàn bộ câu hỏi và chuẩn hóa lời giải chi tiết.'
                    }
                  ].map(item => (
                    <label 
                      key={item.id}
                      className={`flex items-start space-x-3 p-3 rounded-2xl border cursor-pointer transition ${
                        filterType === item.id 
                          ? 'border-amber-300 bg-amber-50/60 shadow-xs' 
                          : 'border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="filterType"
                        value={item.id}
                        checked={filterType === item.id}
                        onChange={() => setFilterType(item.id)}
                        className="mt-1 text-amber-600 focus:ring-amber-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-gray-800">{item.title}</div>
                        <div className="text-[11px] text-gray-500">{item.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Limit & Auto Apply */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1.5">
                    Số lượng mỗi đợt
                  </label>
                  <select
                    value={limit}
                    onChange={e => setLimit(Number(e.target.value))}
                    className="w-full text-xs font-semibold p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value={5}>5 câu (Kiểm tra nhanh)</option>
                    <option value={10}>10 câu (Tiêu chuẩn)</option>
                    <option value={15}>15 câu (Khuyên dùng)</option>
                    <option value={20}>20 câu</option>
                    <option value={30}>30 câu</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="autoApplyCheck"
                    checked={autoApply}
                    onChange={e => setAutoApply(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-gray-300"
                  />
                  <label htmlFor="autoApplyCheck" className="text-xs font-bold text-gray-700 cursor-pointer">
                    Tự động lưu thay đổi vào CSDL
                  </label>
                </div>
              </div>

              {/* Explanation Note */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-start space-x-2.5 text-xs text-blue-800">
                <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Cơ chế an toàn:</strong> Khi AI sửa đáp án hoặc bổ sung lời giải, hệ thống sẽ lưu lại lịch sử thay đổi (Audit Log). Bạn luôn có thể xem lại đáp án cũ và lý giải của AI.
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-amber-100 border-t-amber-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Wand2 className="w-6 h-6 text-amber-500 animate-pulse" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-gray-800">AI đang phân tích &amp; đối chiếu đáp án...</h3>
                <p className="text-xs text-gray-500 max-w-sm">
                  Đang giải độc lập, kiểm định các phương án và cập nhật lời giải khoa học cho {limit} câu hỏi.
                </p>
              </div>
            </div>
          )}

          {/* Result State */}
          {result && (
            <div className="space-y-5">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                  <div className="text-xl font-extrabold text-amber-700">{result.filled_missing_count || 0}</div>
                  <div className="text-[11px] font-bold text-amber-800 mt-0.5">Đã điền đáp án thiếu</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-center">
                  <div className="text-xl font-extrabold text-rose-700">{result.fixed_count || 0}</div>
                  <div className="text-[11px] font-bold text-rose-800 mt-0.5">Đã sửa đáp án sai</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                  <div className="text-xl font-extrabold text-emerald-700">{result.kept_count || 0}</div>
                  <div className="text-[11px] font-bold text-emerald-800 mt-0.5">Đã chính xác chuẩn</div>
                </div>
              </div>

              {/* Details List */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-gray-700 flex justify-between items-center">
                  <span>Chi tiết kết quả rà soát ({result.details?.length || 0} câu)</span>
                  <span className="text-[11px] font-normal text-gray-500">Nhấp vào câu để xem lời giải chi tiết</span>
                </div>

                {result.details && result.details.length > 0 ? (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {result.details.map((item, idx) => {
                      const isExpanded = expandedId === item.question_id;
                      const isChanged = item.action === 'SET_MISSING_ANSWER' || item.action === 'FIX_ANSWER';

                      return (
                        <div 
                          key={item.question_id || idx}
                          className={`rounded-2xl border p-3.5 transition text-xs space-y-2 ${
                            item.action === 'SET_MISSING_ANSWER'
                              ? 'bg-amber-50/50 border-amber-200'
                              : item.action === 'FIX_ANSWER'
                              ? 'bg-rose-50/50 border-rose-200'
                              : 'bg-gray-50/60 border-gray-100'
                          }`}
                        >
                          <div 
                            className="flex items-start justify-between cursor-pointer"
                            onClick={() => setExpandedId(isExpanded ? null : item.question_id)}
                          >
                            <div className="space-y-1 flex-1 pr-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-mono font-bold text-[10px] bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-700">
                                  {item.code}
                                </span>
                                {item.action === 'SET_MISSING_ANSWER' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    Đã chọn đáp án mới
                                  </span>
                                )}
                                {item.action === 'FIX_ANSWER' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    Đã sửa đáp án sai
                                  </span>
                                )}
                                {item.action === 'KEEP' && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                    Đúng chuẩn
                                  </span>
                                )}
                              </div>
                              <div className="text-gray-700 line-clamp-1 font-medium">
                                <MathRenderer content={item.content || ''} />
                              </div>
                            </div>
                            <button className="text-gray-400 p-1 hover:text-gray-600">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>

                          {/* Before -> After Diff display */}
                          {isChanged && (
                            <div className="flex items-center space-x-2 text-[11px] pt-1">
                              <span className="text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                                Cũ: <strong className="text-gray-700">{item.old_display || 'Chưa có'}</strong>
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                                Mới: {item.new_display || 'Đã cập nhật'}
                              </span>
                            </div>
                          )}

                          {/* Expanded Reason & Explanation */}
                          {isExpanded && (
                            <div className="pt-2 border-t border-gray-200/60 space-y-2 mt-2">
                              {item.reason && (
                                <div>
                                  <div className="font-bold text-[11px] text-gray-600">Lý do của AI:</div>
                                  <div className="text-gray-700 italic bg-white/70 p-2 rounded-xl border border-gray-100 mt-0.5">
                                    {item.reason}
                                  </div>
                                </div>
                              )}
                              {item.suggested_explanation && (
                                <div>
                                  <div className="font-bold text-[11px] text-gray-600">Lời giải chi tiết:</div>
                                  <div className="text-gray-800 bg-white p-2.5 rounded-xl border border-gray-200 mt-0.5 leading-relaxed">
                                    <MathRenderer content={item.suggested_explanation} />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400 text-xs">
                    Không tìm thấy câu hỏi nào cần thay đổi trong đợt này.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200/90 flex items-center justify-between bg-slate-50">
          {!result ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleStartAudit}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs shadow-2xs flex items-center space-x-1.5 transition disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                <span>{loading ? 'Đang kiểm tra…' : 'Bắt đầu kiểm tra & chuẩn hóa'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="px-4 py-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition flex items-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tiếp tục đợt tiếp theo</span>
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs shadow-2xs transition"
              >
                Hoàn tất &amp; Đóng
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
