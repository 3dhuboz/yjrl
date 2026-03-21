import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ── Register Service Worker (PWA) ──
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((reg) => {
        console.log('[PWA] Service worker registered:', reg.scope);
        // Check for updates periodically
        setInterval(() => reg.update(), 60 * 60 * 1000); // hourly
      })
      .catch((err) => {
        console.log('[PWA] Service worker registration failed:', err);
      });
  });
}
