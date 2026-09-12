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
    <div className="min-h-screen bg-pastel-bg flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-sm border border-gray-100">
        <div className="text-center mb-8">
          <div className="bg-pastel-purple text-white w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
            <BookOpen className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Quên mật khẩu</h2>
          <p className="text-sm text-gray-500 mt-1">Nhập email để nhận hướng dẫn đặt lại mật khẩu</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 bg-green-50 text-green-600 p-3 rounded-xl text-sm font-medium">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Email</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <Mail className="w-5 h-5" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-pastel-purple text-sm"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pastel-purple text-white py-3 rounded-xl font-medium hover:bg-pastel-purpleDark transition shadow-sm disabled:opacity-50"
          >
            {loading ? 'Đang gửi...' : 'Gửi yêu cầu'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Quay lại{' '}
          <Link to="/login" className="text-pastel-purpleDark font-semibold hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
