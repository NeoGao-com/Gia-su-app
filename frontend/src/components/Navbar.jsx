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
                className="md:hidden p-2 text-gray-600 hover:text-pastel-purpleDark hover:bg-purple-50 rounded-xl transition interactive-btn"
                aria-label="Toggle navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            <Link to="/" className="flex items-center space-x-2.5 group">
              <div className="bg-gradient-to-tr from-pastel-purpleDark via-pastel-purple to-purple-400 text-white p-2 rounded-2xl shadow-sm group-hover:scale-105 transition-transform duration-200">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-xl tracking-tight text-gray-800 leading-none">
                  Tutor<span className="text-pastel-purpleDark">Quiz</span>
                </span>
                <span className="text-[10px] font-semibold text-gray-400 tracking-wider uppercase mt-0.5 flex items-center space-x-1">
                  <Sparkles className="w-2.5 h-2.5 text-pastel-purple" />
                  <span>Dạy Kèm Thông Minh</span>
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
                  className="flex items-center space-x-2.5 bg-white hover:bg-gray-50 border border-gray-200/80 px-3 py-1.5 rounded-2xl transition shadow-xs interactive-btn"
                >
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-pastel-purple to-pastel-purpleDark text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                    {initial}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-xs font-bold text-gray-800 line-clamp-1 leading-tight max-w-[140px]">
                      {user.full_name || user.username}
                    </div>
                    <div className="text-[10px] text-pastel-purpleDark font-semibold uppercase tracking-wider leading-none mt-0.5">
                      {isTeacher ? 'Giáo viên / Gia sư' : 'Học sinh'}
                    </div>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-40 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-4 py-2.5 border-b border-gray-100">
                        <div className="font-bold text-xs text-gray-800 line-clamp-1">{user.full_name || user.username}</div>
                        <div className="text-[11px] text-gray-400 truncate mt-0.5">{user.email}</div>
                      </div>

                      <div className="py-1">
                        <Link
                          to={isTeacher ? '/teacher' : '/student'}
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-purple-50 hover:text-pastel-purpleDark transition"
                        >
                          <User className="w-3.5 h-3.5" />
                          <span>Bàn làm việc chính</span>
                        </Link>
                      </div>

                      <div className="border-t border-gray-100 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setDropdownOpen(false);
                            handleLogout();
                          }}
                          className="w-full flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition text-left"
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
                  className="px-4 py-2 text-xs font-bold text-gray-700 hover:text-pastel-purpleDark hover:bg-purple-50 rounded-xl transition"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-xs font-bold bg-pastel-purple hover:bg-pastel-purpleDark text-white rounded-xl shadow-xs transition"
                >
                  Đăng ký miễn phí
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}