import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import { BookOpen, User, Mail, Lock, Eye, EyeOff, GraduationCap, School, ArrowRight } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export function Register() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'student',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register', {
        email: formData.email,
        full_name: formData.full_name,
        password: formData.password,
        role: formData.role.toUpperCase(),
      });
      toast.success('Đăng ký tài khoản thành công! Vui lòng đăng nhập.');
      navigate('/login');
    } catch (err) {
      const detail = err.response?.data?.detail;
      let msg = 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.';
      if (typeof detail === 'string') {
        msg = detail;
      } else if (Array.isArray(detail)) {
        msg = detail.map(d => d.msg).join(', ');
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fe] flex items-center justify-center p-4 font-sans relative overflow-hidden py-12">
      {/* Soft background glow */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />

      <div className="bg-white rounded-4xl p-8 sm:p-10 max-w-lg w-full shadow-card border border-gray-100 relative z-10">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-pastel-purple to-pastel-purpleDark flex items-center justify-center text-white mx-auto mb-4 shadow-md shadow-pastel-purple/20">
            <BookOpen className="w-7 h-7" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Tạo tài khoản mới</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 font-medium">Bắt đầu dạy kèm và học tập thông minh trên TutorQuiz</p>
        </div>

        {error && (
          <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs sm:text-sm font-medium animate-fadeIn">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role Selection Cards */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Bạn là ai?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'student' })}
                className={`p-3.5 rounded-2xl border-2 flex items-center space-x-3 transition text-left ${
                  formData.role === 'student'
                    ? 'border-pastel-purple bg-purple-50/50 text-gray-900 ring-1 ring-pastel-purple/20'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${formData.role === 'student' ? 'bg-pastel-purple text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm">Học sinh</div>
                  <div className="text-[11px] text-gray-400">Làm bài & nhận điểm</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'teacher' })}
                className={`p-3.5 rounded-2xl border-2 flex items-center space-x-3 transition text-left ${
                  formData.role === 'teacher'
                    ? 'border-pastel-purple bg-purple-50/50 text-gray-900 ring-1 ring-pastel-purple/20'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${formData.role === 'teacher' ? 'bg-pastel-purple text-white' : 'bg-gray-100 text-gray-500'}`}>
                  <School className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm">Giáo viên / Gia sư</div>
                  <div className="text-[11px] text-gray-400">Tạo đề & quản lý lớp</div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Họ và tên
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <User className="w-5 h-5" />
              </span>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full pl-11 pr-4 py-2.5 sm:py-3 rounded-2xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-pastel-purple/40 focus:border-pastel-purple text-sm transition"
                placeholder="Nguyễn Văn A"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Email đăng nhập
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <Mail className="w-5 h-5" />
              </span>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-11 pr-4 py-2.5 sm:py-3 rounded-2xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-pastel-purple/40 focus:border-pastel-purple text-sm transition"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Mật khẩu
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-11 pr-11 py-2.5 sm:py-3 rounded-2xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-pastel-purple/40 focus:border-pastel-purple text-sm transition"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Gợi ý: Mật khẩu nên có tối thiểu 8 ký tự gồm chữ hoa, chữ thường và số.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-pastel-purple to-pastel-purpleDark text-white py-3.5 rounded-2xl font-bold text-sm hover:opacity-95 transition shadow-sm hover:shadow flex items-center justify-center space-x-2 disabled:opacity-50 mt-3"
          >
            <span>{loading ? 'Đang khởi tạo tài khoản...' : 'Đăng ký ngay'}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs sm:text-sm text-gray-600">
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-pastel-purpleDark font-bold hover:underline">
              Đăng nhập tại đây
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}