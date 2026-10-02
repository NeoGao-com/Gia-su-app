import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import { BookOpen, Lock, Mail, Eye, EyeOff, Sparkles, ArrowRight } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', {
        email: email,
        password: password,
      });

      if (res.data.access_token) {
        localStorage.setItem('access_token', res.data.access_token);
      }

      let userData = res.data.user;
      if (!userData) {
        // Fallback fetch current user profile
        const userRes = await api.get('/auth/me');
        userData = userRes.data;
      }
      localStorage.setItem('user', JSON.stringify(userData));

      toast.success(`Chào mừng ${userData?.full_name || 'bạn'} quay trở lại!`);

      const role = (userData?.role || '').toLowerCase();
      if (role === 'teacher') navigate('/teacher');
      else navigate('/student');
    } catch (err) {
      const detail = err.response?.data?.detail;
      let msg = 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';
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
    <div className="min-h-screen bg-[#f8f9fe] flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background soft ambient accents */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />

      <div className="bg-white rounded-4xl p-8 sm:p-10 max-w-md w-full shadow-card border border-gray-100 relative z-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-pastel-purple to-pastel-purpleDark flex items-center justify-center text-white mx-auto mb-4 shadow-md shadow-pastel-purple/20">
            <BookOpen className="w-7 h-7" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">TutorQuiz</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1.5 font-medium">Hệ thống khảo thí & Dạy kèm trắc nghiệm thông minh</p>
        </div>

        {error && (
          <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs sm:text-sm font-medium animate-fadeIn">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Email hoặc Tên đăng nhập
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <Mail className="w-5 h-5" />
              </span>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-pastel-purple/40 focus:border-pastel-purple text-sm transition"
                placeholder="teacher@example.com"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Mật khẩu
              </label>
              <Link to="/forgot-password" className="text-xs text-pastel-purpleDark hover:underline font-semibold">
                Quên mật khẩu?
              </Link>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 rounded-2xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-pastel-purple/40 focus:border-pastel-purple text-sm transition"
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
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-pastel-purple to-pastel-purpleDark text-white py-3.5 rounded-2xl font-bold text-sm hover:opacity-95 transition shadow-sm hover:shadow flex items-center justify-center space-x-2 disabled:opacity-50 mt-2"
          >
            <span>{loading ? 'Đang xác thực...' : 'Đăng nhập'}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs sm:text-sm text-gray-600">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-pastel-purpleDark font-bold hover:underline">
              Đăng ký tài khoản mới
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}