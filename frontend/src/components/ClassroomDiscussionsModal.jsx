import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, Send, Pin, CheckCircle2, Trash2, 
  Plus, Search, Image as ImageIcon, X, Loader2, Sparkles, 
  ShieldCheck, User, CornerDownRight, AlertCircle, Eye, ArrowLeft
} from 'lucide-react';
import api, { resolveImageUrl } from '../api/axios';
import { Modal } from './Modal';
import { MathRenderer } from './MathRenderer';
import { useToast } from '../context/ToastContext';

export function ClassroomDiscussionsModal({ 
  isOpen, 
  onClose, 
  classroomId, 
  classroomName = 'Lớp học', 
  isTeacher = false 
}) {
  const { toast, confirm } = useToast();
  const fileInputRef = useRef(null);
  const commentFileInputRef = useRef(null);

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleUserSync = () => {
      try {
        const userStr = localStorage.getItem('user');
        setCurrentUser(userStr ? JSON.parse(userStr) : null);
      } catch {}
    };
    window.addEventListener('user-updated', handleUserSync);
    window.addEventListener('storage', handleUserSync);
    return () => {
      window.removeEventListener('user-updated', handleUserSync);
      window.removeEventListener('storage', handleUserSync);
    };
  }, []);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activePost, setActivePost] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'unanswered' | 'pinned'
  const [search, setSearch] = useState('');

  // New post form state
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // New comment state
  const [commentContent, setCommentContent] = useState('');
  const [commentImageUrl, setCommentImageUrl] = useState('');
  const [uploadingCommentImage, setUploadingCommentImage] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchPosts = async (selectPostId = null) => {
    if (!classroomId) return;
    try {
      setLoading(true);
      const res = await api.get(`/classrooms/${classroomId}/posts`);
      const items = res.data || [];
      setPosts(items);

      if (selectPostId) {
        const found = items.find(p => p.id === selectPostId);
        if (found) setActivePost(found);
      } else if (activePost) {
        const updated = items.find(p => p.id === activePost.id);
        if (updated) setActivePost(updated);
      }
    } catch (err) {
      toast.error('Không thể tải bài thảo luận của lớp');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && classroomId) {
      fetchPosts();
      setActivePost(null);
      setIsCreatingPost(false);
    }
  }, [isOpen, classroomId]);

  const handleImageUpload = async (e, isComment = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.warning('Dung lượng ảnh không được vượt quá 5MB');
      return;
    }

    try {
      if (isComment) setUploadingCommentImage(true);
      else setUploadingImage(true);

      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const url = res.data?.url;
      if (url) {
        if (isComment) setCommentImageUrl(url);
        else setNewImageUrl(url);
        toast.success('Đã tải ảnh lên thành công!');
      }
    } catch (err) {
      toast.error('Lỗi tải ảnh lên: ' + (err.response?.data?.detail || err.message));
    } finally {
      if (isComment) setUploadingCommentImage(false);
      else setUploadingImage(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      toast.warning('Vui lòng nhập tiêu đề và nội dung câu hỏi');
      return;
    }

    try {
      setSubmittingPost(true);
      const res = await api.post(`/classrooms/${classroomId}/posts`, {
        title: newTitle.trim(),
        content: newContent.trim(),
        image_url: newImageUrl || undefined
      });
      toast.success('Đã đăng câu hỏi vào kênh thảo luận của lớp!');
      setNewTitle('');
      setNewContent('');
      setNewImageUrl('');
      setIsCreatingPost(false);
      setShowPreview(false);
      await fetchPosts(res.data?.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể đăng câu hỏi');
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!activePost || !commentContent.trim()) return;

    try {
      setSubmittingComment(true);
      const res = await api.post(`/classrooms/${classroomId}/posts/${activePost.id}/comments`, {
        content: commentContent.trim(),
        image_url: commentImageUrl || undefined
      });
      toast.success(isTeacher ? 'Đã gửi câu trả lời của giáo viên!' : 'Đã gửi bình luận!');
      setCommentContent('');
      setCommentImageUrl('');

      // Refresh current post comments
      const updatedPost = {
        ...activePost,
        comments: [...(activePost.comments || []), res.data],
        comments_count: (activePost.comments_count || 0) + 1
      };
      setActivePost(updatedPost);
      setPosts(prev => prev.map(p => p.id === activePost.id ? updatedPost : p));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Không thể gửi câu trả lời');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleTogglePin = async (postId) => {
    try {
      const res = await api.put(`/classrooms/${classroomId}/posts/${postId}/pin`);
      toast.success(res.data?.message || 'Đã cập nhật trạng thái ghim');
      fetchPosts();
    } catch (err) {
      toast.error('Không thể thay đổi ghim bài viết');
    }
  };

  const handleToggleTeacherAnswer = async (postId, commentId) => {
    try {
      const res = await api.put(`/classrooms/${classroomId}/posts/${postId}/comments/${commentId}/mark-teacher-answer`);
      toast.success(res.data?.is_teacher_answer ? 'Đã đánh dấu câu trả lời mẫu/giáo viên' : 'Đã bỏ đánh dấu');
      fetchPosts();
    } catch (err) {
      toast.error('Không thể cập nhật nhãn câu trả lời');
    }
  };

  const handleDeletePost = (postId) => {
    confirm({
      title: 'Xóa câu hỏi thảo luận?',
      message: 'Bạn có chắc chắn muốn xóa bài viết này cùng toàn bộ các câu trả lời?',
      confirmText: 'Xóa bài viết',
      onConfirm: async () => {
        try {
          await api.delete(`/classrooms/${classroomId}/posts/${postId}`);
          toast.success('Đã xóa bài viết thành công');
          if (activePost?.id === postId) setActivePost(null);
          fetchPosts();
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Không thể xóa bài viết');
        }
      }
    });
  };

  const handleDeleteComment = (postId, commentId) => {
    confirm({
      title: 'Xóa bình luận?',
      message: 'Bạn có chắc muốn xóa bình luận này?',
      confirmText: 'Xóa',
      onConfirm: async () => {
        try {
          await api.delete(`/classrooms/${classroomId}/posts/${postId}/comments/${commentId}`);
          toast.success('Đã xóa bình luận');
          if (activePost) {
            const nextComments = (activePost.comments || []).filter(c => c.id !== commentId);
            const updated = {
              ...activePost,
              comments: nextComments,
              comments_count: Math.max(0, (activePost.comments_count || 1) - 1)
            };
            setActivePost(updated);
            setPosts(prev => prev.map(p => p.id === activePost.id ? updated : p));
          }
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Không thể xóa bình luận');
        }
      }
    });
  };

  const filteredPosts = posts.filter(p => {
    if (filter === 'pinned' && !p.is_pinned) return false;
    if (filter === 'unanswered') {
      const hasTeacherAns = (p.comments || []).some(c => c.is_teacher_answer || c.author?.role === 'TEACHER');
      if (hasTeacherAns) return false;
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      const matchTitle = (p.title || '').toLowerCase().includes(s);
      const matchContent = (p.content || '').toLowerCase().includes(s);
      const matchAuthor = (p.author?.full_name || '').toLowerCase().includes(s);
      return matchTitle || matchContent || matchAuthor;
    }
    return true;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`💬 Kênh Hỏi Đáp & Trao Đổi: ${classroomName}`}
      maxWidth="max-w-5xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[72vh] min-h-[500px]">
        {/* LEFT COLUMN: POST LIST & SEARCH */}
        <div className={`md:col-span-5 flex flex-col h-full border-r border-slate-200/80 pr-2 ${
          activePost ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Action Bar */}
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Tìm câu hỏi..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsCreatingPost(true);
                  setActivePost(null);
                }}
                className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shrink-0 cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Đặt câu hỏi</span>
              </button>
            </div>

            {/* Filter Pills */}
            <div className="flex space-x-1">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'unanswered', label: 'Chưa trả lời' },
                { id: 'pinned', label: 'Đã ghim' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                    filter === f.id
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Posts Scrollable List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                Đang tải thảo luận...
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                <MessageCircle className="w-8 h-8 text-slate-300 mx-auto" />
                <p>Chưa có câu hỏi nào trong mục này</p>
                <p className="text-[11px] text-slate-400">Hãy là người đầu tiên đặt câu hỏi cho lớp!</p>
              </div>
            ) : (
              filteredPosts.map((p) => {
                const isSelected = activePost?.id === p.id;
                const hasTeacherAns = (p.comments || []).some(c => c.is_teacher_answer || c.author?.role === 'TEACHER');

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      setActivePost(p);
                      setIsCreatingPost(false);
                    }}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                      isSelected 
                        ? 'bg-indigo-50/70 border-indigo-300 shadow-2xs' 
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                        {p.is_pinned && (
                          <Pin className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {p.title}
                        </h4>
                      </div>

                      {hasTeacherAns && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center space-x-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>GV đã giải</span>
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-2 font-normal">
                      {p.content}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-medium text-slate-600 truncate max-w-[120px]">
                        {p.author?.role === 'TEACHER' ? 'Thầy/Cô: ' : ''}{p.author?.full_name || 'Học sinh'}
                      </span>
                      <span className="flex items-center space-x-1">
                        <MessageCircle className="w-3 h-3 text-indigo-400" />
                        <strong className="text-slate-600">{p.comments_count || 0}</strong>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL OR CREATE FORM */}
        <div className={`md:col-span-7 flex flex-col h-full pl-1 ${
          !activePost && !isCreatingPost ? 'hidden md:flex' : 'flex'
        }`}>
          {/* VIEW: CREATE NEW POST */}
          {isCreatingPost ? (
            <div className="flex-1 flex flex-col overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingPost(false)}
                    className="md:hidden p-1 rounded-lg text-slate-500 hover:bg-slate-100"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Đặt câu hỏi mới cho lớp</span>
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-semibold flex items-center space-x-1 cursor-pointer ${
                    showPreview ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  <span>{showPreview ? 'Chỉnh sửa' : 'Xem trước công thức'}</span>
                </button>
              </div>

              {showPreview ? (
                <div className="flex-1 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 overflow-y-auto mb-3">
                  <h4 className="text-sm font-bold text-slate-900">
                    <MathRenderer content={newTitle || 'Tiêu đề câu hỏi...'} />
                  </h4>
                  <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                    <MathRenderer content={newContent || 'Nội dung câu hỏi...'} />
                  </div>
                  {newImageUrl && (
                    <img 
                      src={resolveImageUrl(newImageUrl)} 
                      alt="Ảnh đính kèm" 
                      className="max-h-48 rounded-xl border object-contain"
                    />
                  )}
                </div>
              ) : (
                <form onSubmit={handleCreatePost} className="flex-1 flex flex-col space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tiêu đề câu hỏi / thắc mắc
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Giúp em giải bài toán cực trị này với ạ / Câu 3 đề ôn tập..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div className="flex-1 flex flex-col">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nội dung chi tiết (Hỗ trợ công thức Toán LaTeX $...$ hoặc $$...$$)
                    </label>
                    <textarea
                      required
                      rows={6}
                      placeholder="Mô tả đề bài, vướng mắc của em ở bước nào (Gõ $x^2 - 4x + 3 = 0$ để hiển thị công thức đẹp mắt)..."
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      className="w-full flex-1 p-3 bg-white border border-slate-300 rounded-xl text-xs font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 leading-relaxed font-sans"
                    />
                  </div>

                  {/* Attachment image */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => handleImageUpload(e, false)}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition"
                    >
                      {uploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />}
                      <span>{newImageUrl ? 'Đổi ảnh đính kèm' : 'Đính kèm ảnh bài tập'}</span>
                    </button>

                    {newImageUrl && (
                      <span className="text-[11px] text-emerald-600 font-semibold flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Đã kèm ảnh</span>
                      </span>
                    )}
                  </div>

                  {newImageUrl && (
                    <div className="relative inline-block">
                      <img 
                        src={resolveImageUrl(newImageUrl)} 
                        alt="Đính kèm" 
                        className="h-20 w-auto rounded-lg border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setNewImageUrl('')}
                        className="absolute -top-1.5 -right-1.5 p-0.5 bg-rose-500 text-white rounded-full cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsCreatingPost(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={submittingPost}
                      className="flex items-center space-x-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      {submittingPost ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Đăng câu hỏi</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : activePost ? (
            /* VIEW: POST DETAILS & COMMENTS THREAD */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Post Header */}
              <div className="pb-3 border-b border-slate-200/90 mb-3 shrink-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setActivePost(null)}
                      className="md:hidden p-1 rounded-lg text-slate-500 hover:bg-slate-100"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 leading-snug">
                        <MathRenderer content={activePost.title} />
                      </h3>
                      <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-semibold text-slate-700">
                          {activePost.author?.full_name || 'Học sinh'}
                        </span>
                        {activePost.author?.role === 'TEACHER' && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-100 text-indigo-800 font-bold">
                            Giáo viên
                          </span>
                        )}
                        <span>•</span>
                        <span>{activePost.created_at ? new Date(activePost.created_at).toLocaleDateString('vi-VN') : ''}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    {isTeacher && (
                      <button
                        type="button"
                        onClick={() => handleTogglePin(activePost.id)}
                        className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                          activePost.is_pinned 
                            ? 'bg-amber-50 border-amber-300 text-amber-700' 
                            : 'border-slate-200 text-slate-400 hover:text-slate-700'
                        }`}
                        title={activePost.is_pinned ? 'Bỏ ghim' : 'Ghim bài viết'}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {(isTeacher || (currentUser && currentUser.id === activePost.user_id)) && (
                      <button
                        type="button"
                        onClick={() => handleDeletePost(activePost.id)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Xóa bài viết"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Post body */}
                <div className="text-xs text-slate-800 leading-relaxed mt-2.5 whitespace-pre-wrap bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  <MathRenderer content={activePost.content} />
                </div>

                {activePost.image_url && (
                  <div className="mt-2.5">
                    <img
                      src={resolveImageUrl(activePost.image_url)}
                      alt="Ảnh đính kèm câu hỏi"
                      className="max-h-52 rounded-xl border border-slate-200 object-contain cursor-pointer hover:opacity-95"
                      onClick={() => window.open(resolveImageUrl(activePost.image_url), '_blank')}
                    />
                  </div>
                )}
              </div>

              {/* Comments Thread Scrollable */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 mb-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold px-1">
                  <span>CÁC CÂU TRẢ LỜI &amp; BÌNH LUẬN ({activePost.comments?.length || 0})</span>
                </div>

                {(!activePost.comments || activePost.comments.length === 0) ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Chưa có câu trả lời nào. Hãy là người đầu tiên giải đáp!
                  </div>
                ) : (
                  activePost.comments.map((c) => {
                    const isTeacherComment = c.is_teacher_answer || c.author?.role === 'TEACHER';

                    return (
                      <div
                        key={c.id}
                        className={`p-3 rounded-xl border transition ${
                          isTeacherComment 
                            ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs' 
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-bold text-slate-900">
                              {c.author?.full_name || 'Người dùng'}
                            </span>

                            {isTeacherComment && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-600 text-white flex items-center space-x-1">
                                <ShieldCheck className="w-3 h-3" />
                                <span>Lời giải Thầy/Cô</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-1">
                            {isTeacher && (
                              <button
                                type="button"
                                onClick={() => handleToggleTeacherAnswer(activePost.id, c.id)}
                                className={`text-[10px] px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                  c.is_teacher_answer
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : 'border-slate-200 text-slate-400 hover:text-emerald-700'
                                }`}
                                title="Đánh dấu câu trả lời chính thức"
                              >
                                {c.is_teacher_answer ? '★ Lời giải GV' : '☆ Đánh dấu GV'}
                              </button>
                            )}

                            {(isTeacher || (currentUser && currentUser.id === c.user_id)) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(activePost.id, c.id)}
                                className="p-1 text-slate-300 hover:text-rose-600 rounded transition cursor-pointer"
                                title="Xóa bình luận"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Comment text */}
                        <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                          <MathRenderer content={c.content} />
                        </div>

                        {c.image_url && (
                          <div className="mt-2">
                            <img
                              src={resolveImageUrl(c.image_url)}
                              alt="Ảnh đính kèm"
                              className="max-h-40 rounded-lg border border-slate-200 object-contain"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Comment Input Bar */}
              <form onSubmit={handleAddComment} className="pt-2 border-t border-slate-200/90 shrink-0 space-y-2">
                <div className="flex items-end space-x-2">
                  <div className="flex-1 bg-white border border-slate-300 rounded-xl p-2 focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-600">
                    <textarea
                      rows={2}
                      placeholder={isTeacher ? "Nhập lời giải đáp án hoặc hướng dẫn học sinh (Hỗ trợ LaTeX $...$)..." : "Nhập câu trả lời hoặc trao đổi thêm..."}
                      value={commentContent}
                      onChange={(e) => setCommentContent(e.target.value)}
                      className="w-full text-xs text-slate-800 focus:outline-none resize-none leading-relaxed font-sans"
                    />

                    {commentImageUrl && (
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-emerald-600">
                        <span className="truncate max-w-[200px]">Đã đính kèm ảnh</span>
                        <button
                          type="button"
                          onClick={() => setCommentImageUrl('')}
                          className="text-rose-500 font-bold hover:underline"
                        >
                          Xóa ảnh
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col space-y-1">
                    <input
                      type="file"
                      ref={commentFileInputRef}
                      onChange={(e) => handleImageUpload(e, true)}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingCommentImage}
                      onClick={() => commentFileInputRef.current?.click()}
                      className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl cursor-pointer transition"
                      title="Đính kèm ảnh"
                    >
                      {uploadingCommentImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    </button>

                    <button
                      type="submit"
                      disabled={submittingComment || !commentContent.trim()}
                      className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer transition shadow-2xs disabled:opacity-50"
                      title="Gửi câu trả lời"
                    >
                      {submittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            /* VIEW: EMPTY STATE */
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 p-8 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                <MessageCircle className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-slate-700">Kênh Hỏi Đáp &amp; Trao Đổi Lớp Học</h4>
              <p className="text-xs text-slate-400 max-w-sm">
                Chọn một câu hỏi từ danh sách bên trái để xem thảo luận chi tiết, hoặc bấm "Đặt câu hỏi" để gửi bài mới cho thầy cô và các bạn.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
