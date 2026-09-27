export function handleUnauthorized(error, storage, location) {
  // A form password error is recoverable without destroying the current session.
  if (error.response?.status !== 401 || error.config?.skipAuthRedirect) return;
  storage.removeItem('yjrl_token');
  if (location.pathname !== '/login') location.href = '/login';
}
