import { lazy } from 'react';

export const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard').then(m => ({ default: m.StudentDashboard })));
export const ExamList = lazy(() => import('./pages/student/ExamList').then(m => ({ default: m.ExamList })));
export const TakeExam = lazy(() => import('./pages/student/TakeExam').then(m => ({ default: m.TakeExam })));
export const ExamHistory = lazy(() => import('./pages/student/ExamHistory').then(m => ({ default: m.ExamHistory })));

export const TeacherDashboard = lazy(() => import('./pages/teacher/TeacherDashboard').then(m => ({ default: m.TeacherDashboard })));
export const QuestionBank = lazy(() => import('./pages/teacher/QuestionBank').then(m => ({ default: m.QuestionBank })));
export const ExamManagement = lazy(() => import('./pages/teacher/ExamManagement').then(m => ({ default: m.ExamManagement })));
export const ClassroomManagement = lazy(() => import('./pages/teacher/ClassroomManagement').then(m => ({ default: m.ClassroomManagement })));
export const AssignmentManagement = lazy(() => import('./pages/teacher/AssignmentManagement').then(m => ({ default: m.AssignmentManagement })));
export const Gradebook = lazy(() => import('./pages/teacher/Gradebook').then(m => ({ default: m.Gradebook })));
export const Analytics = lazy(() => import('./pages/teacher/Analytics').then(m => ({ default: m.Analytics })));
