import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

function parseUser(userStr) {
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export function ProtectedRoute({ allowedRoles }) {
  const location = useLocation();
  const token = localStorage.getItem('access_token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const user = parseUser(userStr);
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRole = (user.role || '').toLowerCase();
  const allowed = (allowedRoles || []).map(r => r.toLowerCase());
  if (allowedRoles && !allowed.includes(userRole)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
