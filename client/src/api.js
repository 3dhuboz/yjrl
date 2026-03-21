import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

// JWT token interceptor
api.interceptors.request.use(config => {
  const token = localStorage.getItem('yjrl_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 redirect
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('yjrl_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
