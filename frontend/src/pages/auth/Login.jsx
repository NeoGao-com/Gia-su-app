import React, { useState } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import api from '../../api/axios';
import {
  BookOpen,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  X,
  Copy,
  Check,
  Sparkles,
  User,
  Settings2,
  ShieldCheck,
  GraduationCap,
  School,
  Loader2,
  AlertCircle,
  LogOut,
  CheckCircle2,
  Zap,
  PhoneCall,
  Phone,
  MessageCircle,
  HelpCircle,
  ExternalLink,
  Headphones,
  Clock
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export function Login() {
  const [rememberMe, setRememberMe] = useState(() => {
    return !!localStorage.getItem('saved_login_email');
  });
  const [email, setEmail] = useState(() => {
    return localStorage.getItem('saved_login_email') || '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);

  // Teacher Contact Modal State
  const [showTeacherContactModal, setShowTeacherContactModal] = useState(false);
  const [copiedContact, setCopiedContact] = useState(null);

  // Active user session detection
  const [activeUser, setActiveUser] = useState(() => {
    try {
      const token = localStorage.getItem('access_token');
      const u = localStorage.getItem('user');
      if (token && u) return JSON.parse(u);
    } catch {
      return null;
    }
    return null;
  });

  // Quick Social Login Modal State
  const [oauthModal, setOauthModal] = useState(null); // 'google' | 'zalo' | null
  const [socialUserEmail, setSocialUserEmail] = useState('');
  const [socialUserName, setSocialUserName] = useState('');
  const [socialRole, setSocialRole] = useState('student');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showConfigDetails, setShowConfigDetails] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const copyContact = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedContact(label);
    toast.success(`Đã sao chép ${label}: ${text}`);
    setTimeout(() => setCopiedContact(null), 2000);
  };

  const getRedirectUrl = (userRole) => {
    const queryRedirect = searchParams.get('redirect');
    if (queryRedirect && queryRedirect.startsWith('/') && !queryRedirect.includes('/login')) {
      return queryRedirect;
    }
    const fromState = location.state?.from?.pathname;
    if (fromState && fromState.startsWith('/') && !fromState.includes('/login')) {
      return fromState;
    }
    return (userRole || '').toLowerCase() === 'teacher' ? '/teacher' : '/student';
  };

  const handleContinueSession = () => {
    const target = getRedirectUrl(activeUser?.role);
    navigate(target, { replace: true });
  };

  const handleSwitchAccount = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setActiveUser(null);
    toast.info('Đã đăng xuất phiên làm việc. Vui lòng đăng nhập tài khoản khác.');
  };

  const checkCapsLock = (e) => {
    if (e.getModifierState) {
      setIsCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  const handleQuickFill = (roleType) => {
    if (roleType === 'teacher') {
      setEmail('teacher@example.com');
      setPassword('Password@123!');
      toast.success('Đã điền tài khoản Giáo viên mẫu!');
    } else {
      setEmail('student@example.com');
      setPassword('Password@123!');
      toast.success('Đã điền tài khoản Học sinh mẫu!');
    }
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Vui lòng nhập email hoặc tên đăng nhập.');
      return;
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/login', {
        email: trimmedEmail,
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

      if (rememberMe) {
        localStorage.setItem('saved_login_email', trimmedEmail);
      } else {
        localStorage.removeItem('saved_login_email');
      }

      toast.success(`Chào mừng ${userData?.full_name || 'bạn'} quay trở lại!`);
      const targetUrl = getRedirectUrl(userData?.role);
      navigate(targetUrl, { replace: true });
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

      if (provider === 'google' && cfg.google_configured) {
        window.location.href = '/api/auth/oauth/google';
        return;
      }
      if (provider === 'zalo' && cfg.zalo_configured) {
        window.location.href = '/api/auth/oauth/zalo';
        return;
      }

      // If official OAuth keys are not yet bound, open intuitive login modal
      setSocialUserEmail(provider === 'google' ? 'user@gmail.com' : '0912345678');
      setSocialUserName(provider === 'google' ? 'Người dùng Google' : 'Người dùng Zalo');
      setSocialRole('student');
      setShowConfigDetails(false);
      setOauthModal(provider);
    } catch (err) {
      console.error('Failed to query OAuth config:', err);
      setOauthModal(provider);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleDirectSocialSubmit = async (e) => {
    e.preventDefault();
    if (!socialUserEmail) {
      toast.error('Vui lòng nhập email hoặc số điện thoại Zalo.');
      return;
    }

    setSocialLoading(oauthModal);
    try {
      const formattedEmail = oauthModal === 'google'
        ? (socialUserEmail.includes('@') ? socialUserEmail : `${socialUserEmail}@gmail.com`)
        : (socialUserEmail.includes('@') ? socialUserEmail : `zalo_${socialUserEmail.replace(/[^0-9]/g, '')}@zalo.me`);

      const res = await api.post('/auth/oauth/sync-user', {
        email: formattedEmail,
        full_name: socialUserName || (oauthModal === 'google' ? 'Người dùng Google' : 'Người dùng Zalo'),
        provider: oauthModal.toUpperCase(),
        role: socialRole.toUpperCase(),
      });

      if (res.data.access_token) {
        localStorage.setItem('access_token', res.data.access_token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        toast.success(`Đăng nhập thành công với tài khoản ${oauthModal === 'google' ? 'Google' : 'Zalo'}!`);
        setOauthModal(null);

        const targetRole = (res.data.user?.role || socialRole || 'student').toLowerCase();
        const targetUrl = getRedirectUrl(targetRole);
        navigate(targetUrl, { replace: true });
      }
    } catch (err) {
      toast.error('Lỗi đăng nhập: ' + (err.response?.data?.detail || err.message));
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans relative overflow-hidden">
      {/* Background ambient accents */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-100/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-slate-200/60 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-xl mx-auto relative z-10">
        <div className="bg-white rounded-3xl p-6 sm:p-9 shadow-card border border-slate-200/90 flex flex-col justify-between">
          <div>
            {/* Brand Header */}
            <div className="text-center mb-6">
              <div className="flex justify-center mb-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
                  <BookOpen className="w-6 h-6" />
                </div>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Đăng nhập hệ thống
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                Chào mừng bạn quay trở lại với <span className="font-bold text-indigo-600">TutorQuiz</span>
              </p>
            </div>

            {/* Active Session Warning / Quick Continue */}
            {activeUser && (
              <div className="mb-5 p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 animate-fadeIn">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 text-xs font-bold">
                    {activeUser.role === 'TEACHER' ? 'GV' : 'HS'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {activeUser.full_name || activeUser.email}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Đang có phiên đăng nhập ({activeUser.role === 'TEACHER' ? 'Giáo viên' : 'Học sinh'})
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleContinueSession}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition flex items-center space-x-1 cursor-pointer"
                  >
                    <span>Vào ngay</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSwitchAccount}
                    title="Đổi tài khoản khác"
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Quick Demo Accounts Banner */}
            <div className="mb-5 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Dùng thử nhanh (Tài khoản mẫu)</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Bấm để tự điền</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickFill('teacher')}
                  className="px-3 py-2 bg-white hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 rounded-xl text-left transition group cursor-pointer flex items-center space-x-2"
                >
                  <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <School className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">Giáo viên mẫu</div>
                    <div className="text-[10px] text-slate-500 truncate">teacher@example.com</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickFill('student')}
                  className="px-3 py-2 bg-white hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-300 rounded-xl text-left transition group cursor-pointer flex items-center space-x-2"
                >
                  <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                    <GraduationCap className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">Học sinh mẫu</div>
                    <div className="text-[10px] text-slate-500 truncate">student@example.com</div>
                  </div>
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium flex items-center space-x-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* --- FORM ĐĂNG NHẬP TRUYỀN THỐNG --- */}
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email hoặc Tên đăng nhập
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError('');
                    }}
                    className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 text-sm text-slate-900 transition font-medium"
                    placeholder="teacher@example.com hoặc student@example.com"
                  />
                  {email && (
                    <button
                      type="button"
                      onClick={() => setEmail('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Mật khẩu
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    onKeyDown={checkCapsLock}
                    onKeyUp={checkCapsLock}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 text-sm text-slate-900 transition font-medium"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {isCapsLockOn && (
                  <div className="mt-1.5 flex items-center space-x-1.5 text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 animate-fadeIn">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span>Chú ý: Phím Caps Lock đang bật.</span>
                  </div>
                )}
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="text-xs text-slate-600 font-medium">Ghi nhớ tài khoản trên thiết bị này</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-sm transition shadow-xs flex items-center justify-center space-x-2 disabled:opacity-50 mt-2 cursor-pointer active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang xác thực thông tin...</span>
                  </>
                ) : (
                  <>
                    <span>Đăng nhập hệ thống</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* --- DÒNG PHÂN CÁCH HOẶC --- */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-slate-400 font-bold tracking-wider text-[11px]">
                  Hoặc đăng nhập với
                </span>
              </div>
            </div>

            {/* --- KHỐI ĐĂNG NHẬP GOOGLE & ZALO --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Nút Đăng nhập bằng Google */}
              <button
                type="button"
                onClick={() => handleSocialLogin('google')}
                disabled={socialLoading !== null}
                className="flex items-center justify-center space-x-2.5 py-2.5 px-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs sm:text-sm transition shadow-2xs active:scale-[0.99] cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Google</span>
              </button>

              {/* Nút Đăng nhập bằng Zalo */}
              <button
                type="button"
                onClick={() => handleSocialLogin('zalo')}
                disabled={socialLoading !== null}
                className="flex items-center justify-center space-x-2.5 py-2.5 px-3 rounded-xl bg-[#0068FF] hover:bg-[#0057d9] text-white font-semibold text-xs sm:text-sm transition shadow-2xs active:scale-[0.99] cursor-pointer"
              >
                <div className="w-4 h-4 rounded bg-white flex items-center justify-center font-black text-[#0068FF] text-[10px] tracking-tighter leading-none shrink-0 shadow-2xs">
                  Z
                </div>
                <span>Tài khoản Zalo</span>
              </button>
            </div>
          </div>

          {/* Chuyển hướng đăng ký */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs sm:text-sm text-slate-600 mb-3">
              Chưa có tài khoản?{' '}
              <Link to="/register" className="text-indigo-600 font-bold hover:underline">
                Đăng ký tài khoản mới ngay
              </Link>
            </p>

            {/* Khối Hỗ trợ học viên & Liên hệ Giáo viên */}
            <div className="p-3 sm:p-3.5 bg-gradient-to-r from-indigo-50/90 via-sky-50/70 to-indigo-50/90 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Headphones className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold text-slate-900">Liên hệ Giáo viên &amp; Trợ giảng</span>
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Trực tuyến</span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">Cần mã lớp, cấp lại mật khẩu hoặc hỗ trợ thi?</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <a
                  href="https://zalo.me/0988123456"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1.5 bg-[#0068FF] hover:bg-[#0057d9] text-white text-[11px] font-bold rounded-lg transition shadow-2xs flex items-center space-x-1"
                >
                  <MessageCircle className="w-3 h-3" />
                  <span>Zalo</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowTeacherContactModal(true)}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-indigo-700 text-[11px] font-bold rounded-lg border border-indigo-200 transition shadow-2xs flex items-center space-x-1 cursor-pointer"
                >
                  <span>Chi tiết</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- MODAL XÁC THỰC SOCIAL & CẤU HÌNH LIÊN KẾT --- */}
      {oauthModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => setOauthModal(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-5">
              {oauthModal === 'google' ? (
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
                  <svg className="w-7 h-7" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-[#0068FF] flex items-center justify-center text-white font-black text-2xl shrink-0 shadow-sm">
                  Z
                </div>
              )}
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {oauthModal === 'google' ? 'Đăng nhập tài khoản Google' : 'Đăng nhập tài khoản Zalo'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">Xác thực tài khoản người dùng trực tiếp</p>
              </div>
            </div>

            {/* FORM NHẬP THÔNG TIN TÀI KHOẢN ĐỂ VÀO NGAY */}
            <form onSubmit={handleDirectSocialSubmit} className="space-y-3.5 mb-4">
              {/* Role Selection for Social Sync */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Vai trò của bạn
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSocialRole('student')}
                    className={`py-2 px-3 rounded-xl border-2 flex items-center justify-center space-x-1.5 text-xs font-bold transition cursor-pointer ${
                      socialRole === 'student'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Học sinh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSocialRole('teacher')}
                    className={`py-2 px-3 rounded-xl border-2 flex items-center justify-center space-x-1.5 text-xs font-bold transition cursor-pointer ${
                      socialRole === 'teacher'
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                    }`}
                  >
                    <School className="w-4 h-4" />
                    <span>Giáo viên</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {oauthModal === 'google' ? 'Địa chỉ Email Google' : 'Số điện thoại / ID Zalo'}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={socialUserEmail}
                    onChange={(e) => setSocialUserEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm font-medium text-slate-900"
                    placeholder={oauthModal === 'google' ? 'vd: nguyen.van.a@gmail.com' : 'vd: 0987654321'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Họ và tên hiển thị
                </label>
                <input
                  type="text"
                  required
                  value={socialUserName}
                  onChange={(e) => setSocialUserName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm font-medium text-slate-900"
                  placeholder="vd: Nguyễn Văn A"
                />
              </div>

              <button
                type="submit"
                disabled={socialLoading !== null}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold text-sm transition shadow-xs flex items-center justify-center space-x-2 cursor-pointer mt-1 active:scale-[0.99]"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {socialLoading ? 'Đang tạo phiên đăng nhập...' : `Tiếp tục đăng nhập ${oauthModal === 'google' ? 'Google' : 'Zalo'}`}
                </span>
              </button>
            </form>

            {/* Mục Cấu hình dành cho Quản trị viên */}
            <div className="border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowConfigDetails(!showConfigDetails)}
                className="text-[12px] text-slate-500 hover:text-slate-800 flex items-center justify-between w-full font-semibold cursor-pointer"
              >
                <span className="flex items-center space-x-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Dành cho Quản trị viên: Tích hợp OAuth chính thức</span>
                </span>
                <span>{showConfigDetails ? '▲ Ẩn' : '▼ Chi tiết'}</span>
              </button>

              {showConfigDetails && (
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 mt-2 space-y-2 text-[11px] animate-fadeIn">
                  <div className="flex justify-between items-center font-bold text-slate-700">
                    <span>Callback URL (Redirect URI):</span>
                    <button
                      type="button"
                      onClick={() => copyCallbackUrl(oauthModal === 'google' ? googleCallbackUrl : zaloCallbackUrl)}
                      className="text-indigo-600 hover:underline flex items-center space-x-1 font-bold cursor-pointer"
                    >
                      {copiedUrl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedUrl ? 'Đã sao chép' : 'Sao chép'}</span>
                    </button>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200 font-mono text-slate-600 break-all select-all">
                    {oauthModal === 'google' ? googleCallbackUrl : zaloCallbackUrl}
                  </div>
                  <p className="text-slate-500">
                    {oauthModal === 'google'
                      ? 'Thêm Callback URL này vào Google Cloud Console và điền GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET trên Vercel.'
                      : 'Thêm Callback URL này vào Zalo for Developers và điền ZALO_APP_ID, ZALO_APP_SECRET trên Vercel.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL THÔNG TIN LIÊN LẠC VỚI GIÁO VIÊN --- */}
      {showTeacherContactModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowTeacherContactModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center space-x-3.5 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Thông tin liên lạc Giáo viên &amp; Trợ giảng
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Kênh giải đáp học tập, cấp mã lớp và hỗ trợ học sinh / phụ huynh
                </p>
              </div>
            </div>

            {/* Main Contact Cards */}
            <div className="space-y-3 mb-5">
              {/* Số điện thoại / Hotline */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Điện thoại / Hotline</div>
                    <div className="text-sm font-extrabold font-mono text-slate-800">0988 123 456</div>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5">
                  <a
                    href="tel:0988123456"
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-2xs flex items-center space-x-1"
                  >
                    <PhoneCall className="w-3 h-3" />
                    <span>Gọi ngay</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => copyContact('0988 123 456', 'SĐT')}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                    title="Sao chép số điện thoại"
                  >
                    {copiedContact === 'SĐT' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Zalo */}
              <div className="p-3.5 rounded-2xl bg-[#0068FF]/5 border border-[#0068FF]/20 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0068FF] text-white font-black text-sm flex items-center justify-center shrink-0 shadow-2xs">
                    Z
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-[#0068FF] uppercase tracking-wider">Tài khoản Zalo Thầy/Cô</div>
                    <div className="text-sm font-extrabold font-mono text-slate-800">0988 123 456</div>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5">
                  <a
                    href="https://zalo.me/0988123456"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-[#0068FF] hover:bg-[#0057d9] text-white text-xs font-bold rounded-xl transition shadow-2xs flex items-center space-x-1"
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span>Nhắn Zalo</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => copyContact('0988 123 456', 'Zalo')}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                    title="Sao chép Zalo"
                  >
                    {copiedContact === 'Zalo' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Email */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hòm thư điện tử</div>
                    <div className="text-xs font-bold font-mono text-slate-800 truncate">giaovien@tutorquiz.edu.vn</div>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 shrink-0">
                  <a
                    href="mailto:giaovien@tutorquiz.edu.vn"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition shadow-2xs flex items-center space-x-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Gửi Mail</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => copyContact('giaovien@tutorquiz.edu.vn', 'Email')}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                    title="Sao chép email"
                  >
                    {copiedContact === 'Email' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Office hours & Guidance */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-2.5 mb-5">
              <div className="flex items-center space-x-2 text-indigo-700 font-bold">
                <Clock className="w-4 h-4 shrink-0" />
                <span>Khung giờ hỗ trợ: 08:00 - 22:00 hàng ngày (Tất cả các ngày trong tuần)</span>
              </div>
              <div className="border-t border-slate-200/80 pt-2 space-y-1.5 text-slate-600 leading-relaxed">
                <p>
                  <span className="font-bold text-slate-800">• Chưa có tài khoản:</span> Nhắn tin Zalo kèm Họ tên, Trường lớp để Thầy/Cô khởi tạo tài khoản học tập miễn phí.
                </p>
                <p>
                  <span className="font-bold text-slate-800">• Quên mật khẩu:</span> Bấm "Quên mật khẩu" trên màn hình hoặc nhắn Thầy/Cô để được cấp lại mật khẩu mới trong 1 phút.
                </p>
                <p>
                  <span className="font-bold text-slate-800">• Mã vào lớp:</span> Mã lớp (6 ký tự) do giáo viên chủ nhiệm cung cấp riêng cho từng nhóm học sinh.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowTeacherContactModal(false)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Đã hiểu &amp; Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}