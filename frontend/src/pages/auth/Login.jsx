import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import { BookOpen, Lock, Mail, Eye, EyeOff, ArrowRight, X, ExternalLink, Copy, Check, Sparkles, ShieldCheck } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);
  const [oauthModal, setOauthModal] = useState(null); // 'google' | 'zalo' | null
  const [copiedUrl, setCopiedUrl] = useState(false);
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
        msg = detail.map((d) => d.msg).join(', ');
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    setSocialLoading(provider);
    try {
      const res = await api.get('/auth/oauth/config');
      const cfg = res.data;

      if (provider === 'google') {
        if (cfg.google_configured) {
          window.location.href = '/api/auth/oauth/google';
          return;
        }
      } else if (provider === 'zalo') {
        if (cfg.zalo_configured) {
          window.location.href = '/api/auth/oauth/zalo';
          return;
        }
      }
      // If not configured yet, display helpful setup modal
      setOauthModal(provider);
    } catch (err) {
      console.error('Failed to query OAuth config:', err);
      setOauthModal(provider);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleDemoSocialLogin = async (provider) => {
    try {
      setSocialLoading(provider);
      const demoEmail = provider === 'google' ? 'google_student@example.com' : 'zalo_student@zalo.me';
      const demoName = provider === 'google' ? 'Học Viên Google' : 'Học Viên Zalo';

      const res = await api.post('/auth/oauth/sync-user', {
        email: demoEmail,
        full_name: demoName,
        provider: provider.toUpperCase(),
      });

      if (res.data.access_token) {
        localStorage.setItem('access_token', res.data.access_token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        toast.success(`Đăng nhập thử nghiệm thành công với tài khoản ${provider.toUpperCase()}!`);
        setOauthModal(null);
        navigate('/student');
      }
    } catch (err) {
      toast.error('Đăng nhập thử nghiệm không thành công: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSocialLoading(null);
    }
  };

  const copyCallbackUrl = (url) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    toast.success('Đã sao chép Callback URL vào bộ nhớ tạm!');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://gia-su-app-psi.vercel.app';
  const googleCallbackUrl = `${currentOrigin}/api/auth/oauth/google/callback`;
  const zaloCallbackUrl = `${currentOrigin}/api/auth/oauth/zalo/callback`;

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

        {/* Separator */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-gray-400 font-semibold tracking-wider text-[11px]">
              Hoặc tiếp tục với
            </span>
          </div>
        </div>

        {/* Social Login Buttons: Google & Zalo */}
        <div className="grid grid-cols-2 gap-3">
          {/* Google Button */}
          <button
            type="button"
            onClick={() => handleSocialLogin('google')}
            disabled={socialLoading !== null}
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

          {/* Zalo Button */}
          <button
            type="button"
            onClick={() => handleSocialLogin('zalo')}
            disabled={socialLoading !== null}
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
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-pastel-purpleDark font-bold hover:underline">
              Đăng ký tài khoản mới
            </Link>
          </p>
        </div>
      </div>

      {/* OAuth Configuration & Demo Guidance Modal */}
      {oauthModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-gray-100 relative">
            <button
              onClick={() => setOauthModal(null)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              {oauthModal === 'google' ? (
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-[#0068FF]/10 flex items-center justify-center text-[#0068FF] font-black text-lg">
                  Z
                </div>
              )}
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {oauthModal === 'google' ? 'Đăng nhập Google' : 'Đăng nhập Zalo'}
                </h3>
                <p className="text-xs text-gray-500 font-medium">Cấu hình kết nối & Thử nghiệm</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Tính năng đăng nhập với {oauthModal === 'google' ? 'Google' : 'Zalo'} đã sẵn sàng trong mã nguồn. Bạn có thể sử dụng tính năng thử nghiệm ngay hoặc cấu hình biến môi trường chính thức:
            </p>

            <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200/80 mb-4 space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-gray-700">
                <span>Callback URL (Redirect URI):</span>
                <button
                  type="button"
                  onClick={() => copyCallbackUrl(oauthModal === 'google' ? googleCallbackUrl : zaloCallbackUrl)}
                  className="text-pastel-purpleDark hover:text-pastel-purple flex items-center space-x-1 font-bold text-[11px]"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'Đã sao chép' : 'Sao chép'}</span>
                </button>
              </div>
              <div className="bg-white p-2 rounded-xl border border-gray-200 text-[11px] font-mono text-gray-600 break-all select-all">
                {oauthModal === 'google' ? googleCallbackUrl : zaloCallbackUrl}
              </div>
              <div className="text-[11px] text-gray-400">
                {oauthModal === 'google'
                  ? 'Cần biến GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET trên Vercel.'
                  : 'Cần biến ZALO_APP_ID & ZALO_APP_SECRET trên Vercel.'}
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleDemoSocialLogin(oauthModal)}
                className="w-full bg-gradient-to-r from-pastel-purple to-pastel-purpleDark text-white py-3 rounded-2xl font-bold text-xs sm:text-sm hover:opacity-95 transition flex items-center justify-center space-x-2 shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span>Trải nghiệm nhanh với tài khoản Demo ({oauthModal === 'google' ? 'Google' : 'Zalo'})</span>
              </button>

              <button
                type="button"
                onClick={() => setOauthModal(null)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-2xl font-semibold text-xs transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}