import axios from 'axios';
import { handleUnauthorized } from './apiErrors.mjs';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://yjrl-api.steve-700.workers.dev/api' : '/api'),
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
    handleUnauthorized(error, localStorage, window.location);
    return Promise.reject(error);
  }
);

export default api;
