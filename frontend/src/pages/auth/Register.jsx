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

        {/* Separator */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-gray-400 font-semibold tracking-wider text-[11px]">
              Hoặc đăng ký nhanh với
            </span>
          </div>
        </div>

        {/* Social Register: Google & Zalo */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="flex items-center justify-center space-x-2.5 py-3 px-3 rounded-2xl border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50/80 text-gray-700 font-semibold text-xs sm:text-sm transition shadow-xs hover:shadow-sm"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Google</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="flex items-center justify-center space-x-2.5 py-3 px-3 rounded-2xl border border-[#0068FF]/30 hover:border-[#0068FF]/50 bg-[#0068FF]/5 hover:bg-[#0068FF]/10 text-[#0068FF] font-semibold text-xs sm:text-sm transition shadow-xs hover:shadow-sm"
          >
            <div className="w-5 h-5 rounded-md bg-[#0068FF] flex items-center justify-center font-black text-white text-[11px] tracking-tighter leading-none shrink-0 shadow-xs">
              Z
            </div>
            <span>Zalo</span>
          </button>
        </div>

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