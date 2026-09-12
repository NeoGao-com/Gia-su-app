import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, User, BookOpen } from 'lucide-react';

export function Navbar() {
  const navigate = useNavigate();
  const userStr = localStorage.getItem('user');
  let user = null;
  try {
    user = userStr ? JSON.parse(userStr) : null;
  } catch {}

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-2">
              <div className="bg-pastel-purple text-white p-2 rounded-xl">
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="font-bold text-xl tracking-tight text-gray-800">Tutor<span className="text-pastel-purpleDark font-extrabold">Quiz</span></span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <div className="flex items-center space-x-2 bg-pastel-bg px-3 py-1.5 rounded-full border border-pastel-purple/10">
                  <User className="w-4 h-4 text-pastel-purpleDark" />
                  <span className="text-sm font-medium text-gray-700">{user.full_name || user.username}</span>
                  <span className="text-xs bg-pastel-purpleLight text-pastel-purpleDark px-2.5 py-0.5 rounded-full font-bold">
                    {user.role === 'TEACHER' || user.role === 'ADMIN' ? 'Gia sư / Giáo viên' : 'Học sinh'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 text-gray-600 hover:text-red-600 px-3 py-2 rounded-xl transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm font-medium">Đăng xuất</span>
                </button>
              </>
            ) : (
              <div className="space-x-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-pastel-purpleDark hover:bg-pastel-bg rounded-xl transition"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-medium bg-pastel-purple text-white rounded-xl shadow-sm hover:bg-pastel-purpleDark transition"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}