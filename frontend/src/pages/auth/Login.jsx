import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import { BookOpen, Lock, Mail } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

      const role = (userData?.role || '').toLowerCase();
      if (role === 'admin' || role === 'teacher') navigate('/teacher');
      else navigate('/student');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map(d => d.msg).join(', '));
      } else {
        setError('Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-pastel-bg flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-sm border border-gray-100">
        <div className="text-center mb-8">
          <div className="bg-pastel-purple text-white w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
            <BookOpen className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Chào mừng trở lại</h2>
          <p className="text-sm text-gray-500 mt-1">Đăng nhập để tiếp tục làm bài thi</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Email hoặc Tên đăng nhập</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Mail className="w-5 h-5" />
              </span>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pastel-purple text-sm"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Mật khẩu</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pastel-purple text-sm"
                placeholder="••••••••"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Lưu ý: Mật khẩu phải có chứa chữ in hoa và ký tự đặc biệt.</p>
          </div>

          <div className="flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="text-pastel-purpleDark hover:underline font-medium">
              Quên mật khẩu?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pastel-purple text-white py-3 rounded-xl font-medium hover:bg-pastel-purpleDark transition shadow-sm disabled:opacity-50"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-pastel-purpleDark font-semibold hover:underline">
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}