import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { BookOpen, Mail } from 'lucide-react';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setMessage('Yêu cầu đặt lại mật khẩu đã được gửi qua email (nếu email tồn tại trong hệ thống).');
    } catch (err) {
      setError(err.response?.data?.detail || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-card border border-slate-200/90">
        <div className="text-center mb-8">
          <div className="bg-indigo-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm shadow-indigo-600/20">
            <BookOpen className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Quên mật khẩu</h2>
          <p className="text-sm text-slate-500 mt-1">Nhập email để nhận hướng dẫn đặt lại mật khẩu</p>
        </div>

        {error && (
          <div className="mb-4 bg-rose-50 text-rose-800 border border-rose-200 p-3 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-xl text-sm font-medium">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Mail className="w-5 h-5" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 text-sm text-slate-900 transition"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Đang gửi...' : 'Gửi yêu cầu đặt lại mật khẩu'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-600 mt-6">
          Quay lại{' '}
          <Link to="/login" className="text-indigo-600 font-bold hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
