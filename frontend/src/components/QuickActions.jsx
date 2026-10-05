import React from 'react';
import { PlusCircle, BookOpen, Users, Play, Award, LogIn, FileText, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

export function QuickActions({ role }) {
  const actions = {
    teacher: [
      { label: 'Ngân hàng câu hỏi', path: '/teacher/questions', icon: BookOpen, color: 'bg-blue-50 text-blue-600', detail: 'Quản lý và thêm mới câu hỏi' },
      { label: 'Quản lý lớp học', path: '/teacher/classrooms', icon: Users, color: 'bg-emerald-50 text-emerald-600', detail: 'Quản lý danh sách lớp và học sinh' },
      { label: 'Thống kê kết quả', path: '/teacher/analytics', icon: Award, color: 'bg-amber-50 text-amber-600', detail: 'Xem báo cáo phổ điểm và kết quả' },
    ],
    student: [
      { label: 'Làm bài thi', path: '/student/exams', icon: Play, color: 'bg-emerald-50 text-emerald-600', detail: 'Bắt đầu làm bài thi được giao' },
      { label: 'Lịch sử học tập', path: '/student/history', icon: Award, color: 'bg-blue-50 text-blue-600', detail: 'Xem lại kết quả các bài đã làm' },
      { label: 'Tham gia lớp học', path: '/student', icon: LogIn, color: 'bg-indigo-50 text-indigo-600', detail: 'Nhập mã để vào lớp học mới' },
      { label: 'Tài liệu hướng dẫn', path: '/student', icon: FileText, color: 'bg-slate-100 text-slate-600', detail: 'Xem tài liệu và hướng dẫn sử dụng' },
    ]
  };

  const currentActions = actions[role] || [];

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs mt-8">
      <h3 className="font-bold text-slate-800 text-base mb-4 flex items-center space-x-2">
        <Zap className="w-5 h-5 text-indigo-600" />
        <span>Thao tác nhanh</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {currentActions.map((action, idx) => (
          <Link 
            key={idx} 
            to={action.path}
            className="p-4 rounded-xl bg-slate-50/70 hover:bg-white hover:shadow-xs border border-slate-200/70 hover:border-indigo-300 transition group flex items-start space-x-3 cursor-pointer"
          >
            <div className={`p-2.5 rounded-xl ${action.color} group-hover:scale-105 transition`}>
              <action.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-800 group-hover:text-indigo-600 transition">{action.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{action.detail}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}