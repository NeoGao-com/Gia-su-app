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
  if (role === 'teacher' || role === 'admin') return <Navigate to="/teacher/dashboard" replace />;
  if (role === 'student') return <Navigate to="/student" replace />;
  return <Navigate to="/login" replace />;
}

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-pastel-bg">
      <div className="text-pastel-purpleDark font-medium text-lg animate-pulse">Đang tải trang...</div>
    </div>
  );
}
