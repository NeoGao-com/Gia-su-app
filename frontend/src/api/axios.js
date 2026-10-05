import axios from 'axios';

const defaultBaseURL = import.meta.env.DEV ? 'http://127.0.0.1:8000/api' : '/api';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || defaultBaseURL,
  withCredentials: true,
});

// --- High-Performance In-Memory Client Cache & Request Deduplication ---
const responseCache = new Map();
const inflightRequests = new Map();
const CACHE_TTL_MS = 20000; // 20s TTL for fast tab switching & navigation

export function clearApiCache() {
  responseCache.clear();
}

function getCacheKey(config) {
  const paramsStr = config.params ? JSON.stringify(config.params) : '';
  return `${config.method || 'get'}:${config.url || ''}:${paramsStr}`;
}

const originalAdapter = api.defaults.adapter || axios.defaults.adapter;

api.defaults.adapter = async (config) => {
  const method = (config.method || 'get').toLowerCase();

  // Invalidate cache immediately on mutations
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    responseCache.clear();
    return originalAdapter(config);
  }

  // Only cache GET requests unless Cache-Control explicitly forbids it
  const isNoCache = config.headers && (config.headers['Cache-Control'] === 'no-cache' || config.headers['Pragma'] === 'no-cache');
  if (method === 'get' && !isNoCache) {
    const key = getCacheKey(config);
    const now = Date.now();
    const cached = responseCache.get(key);

    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return {
        data: JSON.parse(JSON.stringify(cached.data)),
        status: 200,
        statusText: 'OK (Cache)',
        headers: { ...cached.headers, 'x-client-cache': 'HIT' },
        config,
        request: {}
      };
    }

    if (inflightRequests.has(key)) {
      return inflightRequests.get(key);
    }

    const requestPromise = (async () => {
      try {
        const response = await originalAdapter(config);
        if (response.status === 200) {
          responseCache.set(key, {
            data: response.data,
            headers: response.headers,
            timestamp: Date.now()
          });
        }
        return response;
      } finally {
        inflightRequests.delete(key);
      }
    })();

    inflightRequests.set(key, requestPromise);
    return requestPromise;
  }

  return originalAdapter(config);
};

// Helper lấy cookie theo tên (dùng cho csrf_token)
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Request interceptor gắn CSRF token & Authorization Bearer
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token && token !== 'undefined' && token !== 'null') {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    const method = config.method ? config.method.toUpperCase() : '';
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrfToken = getCookie('csrf_token');
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor xử lý lỗi chung
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response ? error.response.status : null;
    if (status === 401) {
      // Xóa thông tin đăng nhập hoặc chuyển hướng nếu không ở trang /login
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export function resolveImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const defaultBase = import.meta.env.DEV ? 'http://127.0.0.1:8000/api' : '/api';
  const apiBase = import.meta.env.VITE_API_URL || defaultBase;
  try {
    const origin = apiBase.startsWith('http') ? new URL(apiBase).origin : window.location.origin;
    return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
  } catch {
    return `${url.startsWith('/') ? '' : '/'}${url}`;
  }
}

export default api;