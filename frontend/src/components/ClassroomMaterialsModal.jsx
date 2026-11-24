import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderDown, FileText, Download, UploadCloud, Trash2, Search, X, Loader2, 
  FileArchive, FileSpreadsheet, Presentation, File, Calendar, User, 
  HardDrive, CheckCircle2, AlertCircle, Sparkles, Filter, Plus, ArrowDownToLine
} from 'lucide-react';
import api, { clearApiCache } from '../api/axios';
import { Modal } from './Modal';
import { useToast } from '../context/ToastContext';

export function ClassroomMaterialsModal({
  isOpen,
  onClose,
  classroomId,
  classroomName = 'Lớp học',
  isTeacher = false
}) {
  const { toast, confirm } = useToast();
  const fileInputRef = useRef(null);

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Teacher Upload state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchMaterials = async () => {
    if (!classroomId) return;
    try {
      setLoading(true);
      const res = await api.get(`/classrooms/${classroomId}/materials`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      setMaterials(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error('Không thể tải danh sách tài liệu của lớp');
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && classroomId) {
      fetchMaterials();
      setIsUploadOpen(false);
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      setSearch('');
      setFilterType('all');
    }
  }, [isOpen, classroomId]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error('Kích thước tệp vượt quá 50MB. Vui lòng chọn tệp nhỏ hơn.');
        return;
      }
      setSelectedFile(file);
      if (!title.trim()) {
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setTitle(nameWithoutExt);
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.warning('Vui lòng nhập tiêu đề tài liệu');
      return;
    }
    if (!selectedFile) {
      toast.warning('Vui lòng chọn tệp tin cần tải lên');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('title', title.trim());
      if (description.trim()) {
        formData.append('description', description.trim());
      }
      formData.append('file', selectedFile);

      const res = await api.post(`/classrooms/${classroomId}/materials`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });

      clearApiCache();
      toast.success('Đã tải tài liệu lên lớp học thành công!');
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsUploadOpen(false);
      await fetchMaterials();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Lỗi khi tải tài liệu lên lớp');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (material) => {
    try {
      setDownloadingId(material.id);
      const res = await api.get(`/classrooms/materials/${material.id}/download`, {
        responseType: 'blob',
        headers: { 'Cache-Control': 'no-cache' }
      });

      const blob = new Blob([res.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = material.file_name || 'tai_lieu';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      // Cập nhật số lượt tải ngay lập tức trên UI
      setMaterials(prev => prev.map(m => m.id === material.id ? { ...m, download_count: (m.download_count || 0) + 1 } : m));
      toast.success(`Đang tải về: ${material.file_name}`);
    } catch (err) {
      toast.error('Không thể tải xuống tệp tin. Vui lòng thử lại sau.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = (material) => {
    confirm({
      title: 'Xóa tài liệu học tập?',
      message: `Bạn có chắc chắn muốn xóa tài liệu "${material.title}" khỏi lớp học này? Học sinh sẽ không thể tải về tài liệu này nữa.`,
      confirmText: 'Xóa tài liệu',
      onConfirm: async () => {
        try {
          await api.delete(`/classrooms/${classroomId}/materials/${material.id}`);
          clearApiCache();
          toast.success('Đã xóa tài liệu khỏi lớp học');
          setMaterials(prev => prev.filter(m => m.id !== material.id));
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Không thể xóa tài liệu');
        }
      }
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileTypeBadge = (type) => {
    switch (type) {
      case 'pdf':
        return {
          icon: <FileText className="w-5 h-5 text-rose-600" />,
          bg: 'bg-rose-50 border-rose-200/80 text-rose-700',
          label: 'PDF'
        };
      case 'word':
        return {
          icon: <FileText className="w-5 h-5 text-blue-600" />,
          bg: 'bg-blue-50 border-blue-200/80 text-blue-700',
          label: 'Word'
        };
      case 'powerpoint':
        return {
          icon: <Presentation className="w-5 h-5 text-amber-600" />,
          bg: 'bg-amber-50 border-amber-200/80 text-amber-700',
          label: 'PowerPoint'
        };
      case 'excel':
        return {
          icon: <FileSpreadsheet className="w-5 h-5 text-emerald-600" />,
          bg: 'bg-emerald-50 border-emerald-200/80 text-emerald-700',
          label: 'Excel'
        };
      case 'archive':
        return {
          icon: <FileArchive className="w-5 h-5 text-purple-600" />,
          bg: 'bg-purple-50 border-purple-200/80 text-purple-700',
          label: 'Zip / Nén'
        };
      default:
        return {
          icon: <File className="w-5 h-5 text-indigo-600" />,
          bg: 'bg-indigo-50 border-indigo-200/80 text-indigo-700',
          label: 'Tài liệu'
        };
    }
  };

  // Client-side filtering & instant real-time search
  const filteredMaterials = materials.filter(m => {
    const matchesSearch = 
      (m.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.file_name || '').toLowerCase().includes(search.toLowerCase());

    const matchesType = filterType === 'all' || m.file_type === filterType;

    return matchesSearch && matchesType;
  });

  const totalDownloads = materials.reduce((acc, cur) => acc + (cur.download_count || 0), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`📁 Kho Tài Liệu & Học Liệu: ${classroomName}`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Top Summary Banner */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border border-teal-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FolderDown className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                Kho tài liệu học tập lớp {classroomName}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Học sinh có thể tìm kiếm, xem hướng dẫn và tải về đề cương, bài giảng hoặc tệp bài tập bất cứ lúc nào (24/7).
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-xs font-bold px-3 py-1 bg-white/90 text-teal-800 rounded-lg border border-teal-200/80 shadow-2xs">
              {materials.length} tài liệu
            </span>
            <span className="text-xs font-bold px-3 py-1 bg-white/90 text-indigo-700 rounded-lg border border-indigo-200/80 shadow-2xs">
              {totalDownloads} lượt tải
            </span>
          </div>
        </div>

        {/* Toolbar: Search, Filters & Upload Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm kiếm tài liệu theo tên bài, đề cương, ghi chú..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500 transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Teacher Upload Toggle Button */}
          {isTeacher && (
            <button
              type="button"
              onClick={() => setIsUploadOpen(!isUploadOpen)}
              className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl font-bold text-xs shadow-2xs transition active:scale-95 cursor-pointer shrink-0"
            >
              {isUploadOpen ? (
                <>
                  <X className="w-4 h-4" />
                  <span>Đóng biểu mẫu</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>+ Tải lên tài liệu mới</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-semibold flex items-center space-x-1 mr-1 shrink-0">
            <Filter className="w-3 h-3" />
            <span>Lọc:</span>
          </span>
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'pdf', label: 'PDF' },
            { id: 'word', label: 'Word' },
            { id: 'powerpoint', label: 'PowerPoint' },
            { id: 'excel', label: 'Excel' },
            { id: 'archive', label: 'Tệp nén (Zip)' },
            { id: 'other', label: 'Khác' }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterType(f.id)}
              className={`px-3 py-1 rounded-lg font-bold transition shrink-0 cursor-pointer ${
                filterType === f.id
                  ? 'bg-teal-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Teacher Upload Form (Collapsible) */}
        {isTeacher && isUploadOpen && (
          <form onSubmit={handleUpload} className="p-4 bg-slate-50 border border-teal-200/90 rounded-2xl space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h5 className="font-bold text-xs uppercase tracking-wider text-teal-800 flex items-center space-x-1.5">
                <UploadCloud className="w-4 h-4 text-teal-600" />
                <span>Tải lên tài liệu hoặc học liệu mới cho lớp</span>
              </h5>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Tiêu đề tài liệu *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Đề cương ôn tập Học kỳ 1 Toán 10"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Chọn tệp đính kèm (Tối đa 50MB) *
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  required
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.7z,.txt,.png,.jpg,.jpeg"
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Ghi chú / Hướng dẫn cho học sinh (Tùy chọn)
              </label>
              <textarea
                rows={2}
                placeholder="Ví dụ: Học sinh tải về đọc kỹ mục 2 trang 15 và chuẩn bị bài trước buổi học online..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-600"
              />
            </div>

            {selectedFile && (
              <div className="flex items-center space-x-2 text-xs text-slate-600 bg-white p-2 rounded-xl border border-slate-200">
                <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                <span className="font-semibold truncate">{selectedFile.name}</span>
                <span className="text-slate-400">({formatFileSize(selectedFile.size)})</span>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="flex items-center space-x-1.5 px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang tải lên...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Lưu và Phát hành</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Materials List */}
        <div className="max-h-[52vh] min-h-[260px] overflow-y-auto space-y-2.5 pr-1">
          {loading ? (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">Đang tải danh sách tài liệu...</p>
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="py-14 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <FolderDown className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <h5 className="font-bold text-sm text-slate-700">
                {materials.length === 0 ? 'Chưa có tài liệu nào trong lớp học này' : 'Không tìm thấy tài liệu phù hợp'}
              </h5>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {materials.length === 0
                  ? (isTeacher
                      ? 'Thầy/Cô hãy bấm vào nút "+ Tải lên tài liệu mới" ở phía trên để chia sẻ đề cương, bài giảng hoặc tài liệu cho học sinh.'
                      : 'Giáo viên phụ trách chưa đăng tài liệu nào cho lớp này. Bạn hãy quay lại sau nhé!')
                  : `Không có tài liệu nào khớp với từ khóa "${search}". Hãy thử tìm kiếm với từ khóa khác.`}
              </p>
            </div>
          ) : (
            filteredMaterials.map((mat) => {
              const badge = getFileTypeBadge(mat.file_type);
              const isDownloading = downloadingId === mat.id;

              return (
                <div
                  key={mat.id}
                  className="p-3.5 bg-white border border-slate-200 hover:border-teal-300 rounded-2xl shadow-2xs hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  {/* Left: Icon & Info */}
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${badge.bg}`}>
                      {badge.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <h4 className="font-bold text-sm text-slate-900 group-hover:text-teal-700 transition truncate">
                          {mat.title}
                        </h4>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </div>

                      {mat.description && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                          {mat.description}
                        </p>
                      )}

                      {/* Metadata */}
                      <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-2 flex-wrap gap-y-1">
                        <span className="font-mono text-slate-500 truncate max-w-[200px]" title={mat.file_name}>
                          {mat.file_name}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-slate-600">
                          {formatFileSize(mat.file_size)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>
                            {mat.created_at ? new Date(mat.created_at).toLocaleDateString('vi-VN') : 'Mới cập nhật'}
                          </span>
                        </span>
                        <span>•</span>
                        <span className="text-teal-700 font-bold flex items-center space-x-1">
                          <ArrowDownToLine className="w-3 h-3" />
                          <span>{mat.download_count || 0} lượt tải</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      disabled={isDownloading}
                      onClick={() => handleDownload(mat)}
                      className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
                      title="Bấm để tải tệp về máy tính hoặc điện thoại"
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Đang tải...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Tải về</span>
                        </>
                      )}
                    </button>

                    {isTeacher && (
                      <button
                        type="button"
                        onClick={() => handleDelete(mat)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        title="Xóa tài liệu này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
