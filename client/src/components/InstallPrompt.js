import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Check if dismissed recently
    const dismissed = localStorage.getItem('yjrl_install_dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    // iOS detection (no beforeinstallprompt event)
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    if (isiOS) {
      setIsIOS(true);
      // Show after a short delay
      setTimeout(() => setShowPrompt(true), 5000);
      return;
    }

    // Android/Desktop — listen for beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowPrompt(true), 3000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('yjrl_install_dismissed', Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 'max(1rem, env(safe-area-inset-bottom))',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 150,
      width: 'calc(100% - 2rem)',
      maxWidth: 420,
      background: 'linear-gradient(135deg, #0f2570, #1a3cb0)',
      border: '1px solid rgba(255, 225, 0, 0.3)',
      borderRadius: '14px',
      padding: '1.25rem',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 225, 0, 0.1)',
      animation: 'slideUp 0.4s ease-out'
    }}>
      <button
        onClick={handleDismiss}
        style={{
          position: 'absolute', top: 8, right: 8,
          background: 'none', border: 'none', color: '#8fa3cc',
          cursor: 'pointer', padding: '4px'
        }}
      >
        <X size={16} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: 44, height: 44, borderRadius: '10px',
          background: 'rgba(255, 225, 0, 0.15)',
          border: '1px solid rgba(255, 225, 0, 0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>
          <img
            src="/images/logo.png"
            alt=""
            style={{ width: 32, height: 32, objectFit: 'contain' }}
            onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '🏉'; }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#ffe100', marginBottom: '0.2rem' }}>
            Install Yeppoon Seagulls
          </div>
          <div style={{ fontSize: '0.78rem', color: '#8fa3cc', lineHeight: 1.4 }}>
            {isIOS
              ? 'Tap the share button, then "Add to Home Screen" for quick access.'
              : 'Add to your home screen for the full app experience.'
            }
          </div>
        </div>
      </div>

      {!isIOS && deferredPrompt && (
        <button
          onClick={handleInstall}
          style={{
            marginTop: '0.875rem',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.65rem',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #ffe100, #e6cb00)',
            color: '#0f2570',
            fontWeight: 700,
            fontSize: '0.85rem',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Download size={16} /> Install App
        </button>
      )}

      {isIOS && (
        <div style={{
          marginTop: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          fontSize: '0.78rem',
          color: '#8fa3cc'
        }}>
          Tap <span style={{ fontSize: '1.1rem' }}>⎋</span> then <strong style={{ color: '#ffe100' }}>"Add to Home Screen"</strong>
        </div>
      )}
    </div>
  );
};

export default InstallPrompt;
