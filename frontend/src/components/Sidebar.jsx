import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Users, Award, BarChart2, CheckSquare, Send } from 'lucide-react';

export function Sidebar({ role }) {
  const normalizedRole = (role || '').toLowerCase();
  const getLinks = () => {
    if (normalizedRole === 'student') {
      return [
        { to: '/student', icon: LayoutDashboard, label: 'Tổng quan' },
        { to: '/student/exams', icon: BookOpen, label: 'Danh sách bài thi' },
        { to: '/student/history', icon: Award, label: 'Lịch sử làm bài' },
      ];
    }
    if (normalizedRole === 'teacher' || normalizedRole === 'admin') {
      return [
        { to: '/teacher/dashboard', icon: LayoutDashboard, label: 'Bàn làm việc' },
        { to: '/teacher/classrooms', icon: Users, label: 'Lớp & Nhóm kèm' },
        { to: '/teacher/questions', icon: BookOpen, label: 'Ngân hàng câu hỏi' },
        { to: '/teacher/exams', icon: CheckSquare, label: 'Bộ đề & Bài tập' },
        { to: '/teacher/assignments', icon: Send, label: 'Giao bài tập' },
        { to: '/teacher/gradebook', icon: Award, label: 'Sổ điểm & Tiến độ' },
        { to: '/teacher/analytics', icon: BarChart2, label: 'Thống kê kết quả' },
      ];
    }
    return [];
  };

  const links = getLinks();

  return (
    <aside className="w-64 bg-white border-r border-gray-100 h-[calc(100vh-4rem)] sticky top-16 p-6 shadow-sm overflow-y-auto shrink-0">
      <nav className="space-y-1.5">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-2xl font-medium text-sm transition ${
                  isActive
                    ? 'bg-pastel-purple text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
