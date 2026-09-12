import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RootRedirect, PageLoader } from './components/RootRedirect'
import { Login } from './pages/auth/Login'
import { Register } from './pages/auth/Register'
import { ForgotPassword } from './pages/auth/ForgotPassword'
import { ErrorBoundary } from './components/ErrorBoundary'
import {
  StudentDashboard, ExamList, TakeExam, ExamHistory,
  TeacherDashboard, QuestionBank, ExamManagement, ClassroomManagement,
  AssignmentManagement, Gradebook, Analytics,
} from './lazyPages'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Student Routes */}
          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/dashboard" element={<StudentDashboard />} />
            <Route path="/exams" element={<ExamList />} />
            <Route path="/student/exams" element={<ExamList />} />
            <Route path="/take-exam/:id" element={<TakeExam />} />
            <Route path="/take-exam/:examId" element={<TakeExam />} />
            <Route path="/student/exams/:id" element={<TakeExam />} />
            <Route path="/history" element={<ExamHistory />} />
            <Route path="/student/history" element={<ExamHistory />} />
          </Route>

          {/* Teacher Routes */}
          <Route element={<ProtectedRoute allowedRoles={['teacher']} />}>
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
            <Route path="/teacher/questions" element={<QuestionBank />} />
            <Route path="/teacher/exams" element={<ExamManagement />} />
            <Route path="/teacher/classrooms" element={<ClassroomManagement />} />
            <Route path="/teacher/assignments" element={<AssignmentManagement />} />
            <Route path="/teacher/gradebook" element={<Gradebook />} />
            <Route path="/teacher/analytics" element={<Analytics />} />
          </Route>


          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
