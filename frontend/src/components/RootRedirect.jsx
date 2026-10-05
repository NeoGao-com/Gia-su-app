import { Navigate } from 'react-router-dom';

function getStoredRole() {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    return (user.role || '').toLowerCase();
  } catch (e) {
    console.error(e);
    return null;
  }
}

export function RootRedirect() {
  const role = getStoredRole();
  if (role === 'teacher') return <Navigate to="/teacher/dashboard" replace />;
  if (role === 'student') return <Navigate to="/student" replace />;
  return <Navigate to="/login" replace />;
}

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-indigo-600 font-semibold text-base animate-pulse">Đang tải trang...</div>
    </div>
  );
}
