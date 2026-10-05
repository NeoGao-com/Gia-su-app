import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, User, BookOpen, Menu, Sparkles, ChevronDown } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export function Navbar() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const userStr = localStorage.getItem('user');
  let user = null;
  try {
    user = userStr ? JSON.parse(userStr) : null;
  } catch {}

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    toast.info('Bạn đã đăng xuất khỏi hệ thống.');
    navigate('/login');
  };

  const toggleMobileSidebar = () => {
    window.dispatchEvent(new CustomEvent('toggle-sidebar'));
  };

  const initial = (user?.full_name || user?.username || user?.email || 'U').charAt(0).toUpperCase();
  const isTeacher = user?.role === 'TEACHER' || user?.role === 'teacher';

  return (
    <nav className="glass-nav sticky top-0 z-40 transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left: Mobile hamburger & Logo */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {user && (
              <button
                type="button"
                onClick={toggleMobileSidebar}
                className="md:hidden p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition interactive-btn"
                aria-label="Mở menu điều hướng"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <Link to="/" className="flex items-center space-x-2.5 group">
              <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-xs group-hover:bg-indigo-700 transition-colors duration-150">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-xl tracking-tight text-slate-900 leading-none">
                  Tutor<span className="text-indigo-600">Quiz</span>
                </span>
                <span className="text-[11px] font-medium text-slate-500 tracking-normal mt-0.5">
                  Nền tảng thi & học tập
                </span>
              </div>
            </Link>
          </div>

          {/* Right: User pill & actions */}
          <div className="flex items-center space-x-3">
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center space-x-2.5 bg-white hover:bg-slate-50 border border-slate-200/90 px-3 py-1.5 rounded-xl transition shadow-xs interactive-btn"
                >
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    {initial}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-xs font-bold text-slate-800 line-clamp-1 leading-tight max-w-[140px]">
                      {user.full_name || user.username}
                    </div>
                    <div className="text-[10px] text-indigo-700 font-semibold uppercase tracking-wider leading-none mt-0.5">
                      {isTeacher ? 'Giáo viên' : 'Học sinh'}
                    </div>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-40 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-4 py-2.5 border-b border-slate-100">
                        <div className="font-bold text-xs text-slate-800 line-clamp-1">{user.full_name || user.username}</div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">{user.email}</div>
                      </div>

                      <div className="py-1">
                        <Link
                          to={isTeacher ? '/teacher' : '/student'}
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center space-x-2 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
                        >
                          <User className="w-3.5 h-3.5" />
                          <span>Bảng điều khiển</span>
                        </Link>
                      </div>

                      <div className="border-t border-slate-100 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setDropdownOpen(false);
                            handleLogout();
                          }}
                          className="w-full flex items-center space-x-2 px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition text-left"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Đăng xuất</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs transition"
                >
                  Đăng ký tài khoản
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}