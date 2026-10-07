import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, BookOpen, Users, Award, 
  BarChart2, Cpu, FileText, Send, X, UserCheck
} from 'lucide-react';

export function Sidebar({ role }) {
  const normalizedRole = (role || '').toLowerCase();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => {
      setMobileOpen((prev) => !prev);
    };
    window.addEventListener('toggle-sidebar', handleToggle);
    return () => window.removeEventListener('toggle-sidebar', handleToggle);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const getMenuSections = () => {
    if (normalizedRole === 'student') {
      return [
        {
          title: 'Học tập & Rèn luyện',
          items: [
            { to: '/student', icon: LayoutDashboard, label: 'Tổng quan học tập' },
            { to: '/student/assignments', icon: Send, label: 'Bài tập cần nộp' },
            { to: '/student/exams', icon: FileText, label: 'Đề thi & Kiểm tra' },
          ]
        },
        {
          title: 'Lớp học & Kết quả',
          items: [
            { to: '/student/classrooms', icon: Users, label: 'Lớp học của tôi' },
            { to: '/student/history', icon: Award, label: 'Lịch sử & Điểm số' },
          ]
        },
        {
          title: 'Tài khoản & Cài đặt',
          items: [
            { to: '/student/profile', icon: UserCheck, label: 'Hồ sơ & Mật khẩu' },
          ]
        }
      ];
    }

    if (normalizedRole === 'teacher') {
      return [
        {
          title: 'Khu vực chính',
          items: [
            { to: '/teacher', icon: LayoutDashboard, label: 'Tổng quan giảng dạy' },
            { to: '/teacher/assignments', icon: Send, label: 'Bài tập đã giao' },
            { to: '/teacher/exams', icon: FileText, label: 'Đề thi trắc nghiệm' },
            { to: '/teacher/questions', icon: BookOpen, label: 'Ngân hàng câu hỏi' },
          ]
        },
        {
          title: 'Lớp học & Học sinh',
          items: [
            { to: '/teacher/classrooms', icon: Users, label: 'Quản lý lớp học' },
            { to: '/teacher/gradebook', icon: Award, label: 'Sổ điểm học sinh' },
            { to: '/teacher/analytics', icon: BarChart2, label: 'Báo cáo & Thống kê' },
          ]
        },
        {
          title: 'Công cụ hỗ trợ',
          items: [
            { to: '/teacher/ai-config', icon: Cpu, label: 'Trợ lý soạn đề & AI' },
          ]
        }
      ];
    }

    return [];
  };

  const sections = getMenuSections();

  const renderNavLinks = () => (
    <div className="space-y-4">
      {sections.map((sec, sIdx) => (
        <div key={sIdx} className="space-y-1">
          {sec.title && (
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
              {sec.title}
            </div>
          )}
          {sec.items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all duration-150 interactive-btn ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100/90'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden md:block w-64 bg-white border-r border-slate-200/80 h-[calc(100vh-4rem)] sticky top-16 p-4 shadow-xs overflow-y-auto shrink-0 transition-all">
        <nav className="h-full flex flex-col justify-between">
          {renderNavLinks()}
          <div className="pt-4 mt-4 border-t border-slate-100 text-[11px] text-slate-400 px-3 text-center">
            TutorQuiz • Nền tảng học tập thông minh
          </div>
        </nav>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer Panel */}
      <aside
        className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 bg-white shadow-2xl p-5 overflow-y-auto transform transition-transform duration-300 ease-out flex flex-col justify-between ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <div className="bg-indigo-600 text-white p-1.5 rounded-xl">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-base text-slate-900">Menu chức năng</span>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
              aria-label="Đóng menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav>{renderNavLinks()}</nav>
        </div>

        <div className="pt-4 border-t border-slate-100 text-xs text-slate-400 text-center">
          TutorQuiz Platform
        </div>
      </aside>
    </>
  );
}
