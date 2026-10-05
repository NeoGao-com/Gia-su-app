import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { useToast } from '../../context/ToastContext';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';

export function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [statusText, setStatusText] = useState('Đang hoàn tất đăng nhập...');
  const [error, setError] = useState(null);

  useEffect(() => {
    async function processOAuth() {
      try {
        const token = searchParams.get('token');
        const role = searchParams.get('role');
        const errorParam = searchParams.get('error') || searchParams.get('oauth_error');

        if (errorParam) {
          let errorMsg = 'Đăng nhập không thành công. Vui lòng thử lại.';
          if (errorParam === 'google_not_configured') errorMsg = 'Chưa cấu hình tài khoản Google OAuth trên hệ thống.';
          if (errorParam === 'zalo_not_configured') errorMsg = 'Chưa cấu hình tài khoản Zalo OAuth trên hệ thống.';
          if (errorParam === 'cancelled' || errorParam.includes('cancel')) errorMsg = 'Bạn đã hủy đăng nhập liên kết.';
          setError(errorMsg);
          toast.error(errorMsg);
          setTimeout(() => navigate('/login'), 2500);
          return;
        }

        if (token) {
          localStorage.setItem('access_token', token);
          setStatusText('Đang tải thông tin tài khoản...');

          try {
            const userRes = await api.get('/auth/me');
            const userData = userRes.data;
            localStorage.setItem('user', JSON.stringify(userData));
            toast.success(`Chào mừng ${userData.full_name || 'bạn'}!`);

            const userRole = (userData.role || role || 'student').toLowerCase();
            if (userRole === 'teacher') {
              navigate('/teacher', { replace: true });
            } else {
              navigate('/student', { replace: true });
            }
          } catch (profileErr) {
            console.error('Error fetching profile:', profileErr);
            // Fallback navigation
            if ((role || '').toLowerCase() === 'teacher') {
              navigate('/teacher', { replace: true });
            } else {
              navigate('/student', { replace: true });
            }
          }
          return;
        }

        // Check if there is a hash fragment from Supabase OAuth (#access_token=...)
        if (window.location.hash && window.location.hash.includes('access_token')) {
          const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
          const supaAccessToken = hashParams.get('access_token');

          if (supaAccessToken) {
            setStatusText('Đang đồng bộ phiên đăng nhập Supabase...');
            // Fetch Supabase user profile from JWT or API
            try {
              const base64Url = supaAccessToken.split('.')[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const jsonPayload = decodeURIComponent(
                atob(base64)
                  .split('')
                  .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                  .join('')
              );
              const jwtData = JSON.parse(jsonPayload);
              const email = jwtData.email;
              const fullName = jwtData.user_metadata?.full_name || jwtData.user_metadata?.name || email?.split('@')[0];

              if (email) {
                const syncRes = await api.post('/auth/oauth/sync-user', {
                  email,
                  full_name: fullName,
                  provider: 'supabase_oauth',
                });

                if (syncRes.data.access_token) {
                  localStorage.setItem('access_token', syncRes.data.access_token);
                  localStorage.setItem('user', JSON.stringify(syncRes.data.user));
                  toast.success(`Chào mừng ${syncRes.data.user?.full_name || 'bạn'}!`);
                  const userRole = (syncRes.data.user?.role || 'student').toLowerCase();
                  if (userRole === 'teacher') navigate('/teacher', { replace: true });
                  else navigate('/student', { replace: true });
                  return;
                }
              }
            } catch (syncErr) {
              console.error('Failed to sync Supabase user:', syncErr);
            }
          }
        }

        // If no token found
        setError('Không tìm thấy thông tin phiên đăng nhập.');
        setTimeout(() => navigate('/login'), 2000);
      } catch (err) {
        console.error('OAuth callback processing failed:', err);
        setError('Có lỗi xảy ra khi xác thực tài khoản.');
        setTimeout(() => navigate('/login'), 2500);
      }
    }

    processOAuth();
  }, [navigate, searchParams, toast]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-card border border-slate-200/90 text-center">
        {error ? (
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Xác thực thất bại</h3>
            <p className="text-xs text-rose-700 font-medium">{error}</p>
            <p className="text-[11px] text-slate-400">Đang quay lại trang đăng nhập...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto animate-pulse">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Đang kết nối</h3>
            <p className="text-xs text-slate-600 font-medium">{statusText}</p>
            <div className="flex items-center justify-center space-x-1.5 text-indigo-600 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>TutorQuiz — Hệ thống khảo thí &amp; Học tập</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
