import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, BookOpen, Users, Award, 
  BarChart2, Cpu, FileText, Send, X, Sparkles
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
          title: 'Học tập & Ôn luyện',
          items: [
            { to: '/student', icon: LayoutDashboard, label: 'Tổng quan bàn học' },
            { to: '/student/assignments', icon: Send, label: 'Bài tập về nhà' },
            { to: '/student/exams', icon: FileText, label: 'Kỳ thi trực tuyến' },
            { to: '/student/practice', icon: Sparkles, label: 'Tự luyện & Ôn tập' },
          ]
        },
        {
          title: 'Lớp học & Tiến độ',
          items: [
            { to: '/student/classrooms', icon: Users, label: 'Lớp học của tôi' },
            { to: '/student/history', icon: Award, label: 'Sổ điểm & Bài nộp' },
          ]
        }
      ];
    }

    if (normalizedRole === 'teacher' || normalizedRole === 'admin') {
      return [
        {
          title: 'Tổng quan',
          items: [
            { to: '/teacher', icon: LayoutDashboard, label: 'Bàn làm việc' },
          ]
        },
        {
          title: 'Đề thi & Đánh giá',
          items: [
            { to: '/teacher/assignments', icon: Send, label: 'Giao bài tập' },
            { to: '/teacher/exams', icon: FileText, label: 'Đề thi & Ma trận' },
            { to: '/teacher/questions', icon: BookOpen, label: 'Ngân hàng câu hỏi' },
          ]
        },
        {
          title: 'Quản lý & Báo cáo',
          items: [
            { to: '/teacher/classrooms', icon: Users, label: 'Lớp & Nhóm kèm' },
            { to: '/teacher/gradebook', icon: Award, label: 'Sổ điểm & Tiến độ' },
            { to: '/teacher/analytics', icon: BarChart2, label: 'Thống kê kết quả' },
          ]
        },
        {
          title: 'Hệ thống',
          items: [
            { to: '/teacher/ai-config', icon: Cpu, label: 'Cấu hình AI' },
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
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 px-3.5 py-1">
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
                  `flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl font-semibold text-xs sm:text-sm transition-all duration-150 interactive-btn ${
                    isActive
                      ? 'bg-gradient-to-r from-pastel-purple to-pastel-purpleDark text-white shadow-xs font-bold'
                      : 'text-gray-600 hover:text-pastel-purpleDark hover:bg-purple-50/70'
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
      <aside className="hidden md:block w-64 bg-white/80 backdrop-blur-md border-r border-gray-100 h-[calc(100vh-4rem)] sticky top-16 p-4 shadow-xs overflow-y-auto shrink-0 transition-all">
        <nav className="h-full flex flex-col justify-between">
          {renderNavLinks()}
          <div className="pt-4 mt-4 border-t border-gray-100 text-[11px] text-gray-400 px-3 text-center">
            TutorQuiz v2.4 • Smart Tutoring
          </div>
        </nav>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
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
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
            <div className="flex items-center space-x-2">
              <div className="bg-pastel-purple text-white p-1.5 rounded-xl">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-base text-gray-800">TutorQuiz Menu</span>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav>{renderNavLinks()}</nav>
        </div>

        <div className="pt-4 border-t border-gray-100 text-xs text-gray-400 text-center">
          TutorQuiz Platform
        </div>
      </aside>
    </>
  );
}
