import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import InstallPrompt from './components/InstallPrompt';
import YJRLHome from './pages/yjrl/YJRLHome';
import YJRLFixtures from './pages/yjrl/YJRLFixtures';
import YJRLNews from './pages/yjrl/YJRLNews';
import YJRLRegister from './pages/yjrl/YJRLRegister';
import YJRLPlayerPortal from './pages/yjrl/YJRLPlayerPortal';
import YJRLCoachPortal from './pages/yjrl/YJRLCoachPortal';
import YJRLParentPortal from './pages/yjrl/YJRLParentPortal';
import YJRLAdminPortal from './pages/yjrl/YJRLAdminPortal';
import './pages/yjrl/yjrl.css';

// ── Standalone Login Page ──
const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await login(email, password);
      const role = result?.user?.role;
      if (role === 'admin' || role === 'dev') navigate('/portal/admin');
      else if (role === 'coach') navigate('/portal/coach');
      else if (role === 'parent') navigate('/portal/parent');
      else navigate('/portal/player');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, var(--yjrl-dark), var(--yjrl-navy))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'rgba(26, 58, 92, 0.4)',
        border: '1px solid rgba(240,165,0,0.2)',
        borderRadius: '16px',
        padding: '2.5rem'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 48, height: 48, background: 'linear-gradient(135deg, var(--yjrl-gold), #d4840a)',
              borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', boxShadow: '0 0 30px rgba(240,165,0,0.25)'
            }}>
              🏉
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 800, color: 'var(--yjrl-gold)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Yeppoon JRL</div>
              <div style={{ fontSize: '0.7rem', color: '#8fa3be', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Junior Rugby League</div>
            </div>
          </Link>
        </div>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, textAlign: 'center', marginBottom: '1.5rem', textTransform: 'uppercase' }}>
          Sign In
        </h2>

        {error && (
          <div style={{ background: 'rgba(196,30,58,0.1)', border: '1px solid rgba(196,30,58,0.3)', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#f87171' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#8fa3be', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="yjrl-input"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#8fa3be', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="yjrl-input"
              placeholder="Your password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="yjrl-btn yjrl-btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: '#8fa3be' }}>
          New to the club?{' '}
          <Link to="/register" style={{ color: 'var(--yjrl-gold)', fontWeight: 600 }}>Register Here</Link>
        </p>
      </div>
    </div>
  );
};

// ── Protected Route ──
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && user.role !== 'admin' && user.role !== 'dev') return <Navigate to="/portal/player" />;
  return children;
};

// ── App Routes ──
const AppRoutes = () => (
  <Routes>
    {/* Public */}
    <Route path="/" element={<YJRLHome />} />
    <Route path="/fixtures" element={<YJRLFixtures />} />
    <Route path="/teams" element={<YJRLFixtures />} />
    <Route path="/news" element={<YJRLNews />} />
    <Route path="/news/:id" element={<YJRLNews />} />
    <Route path="/events" element={<YJRLFixtures />} />
    <Route path="/register" element={<YJRLRegister />} />
    <Route path="/login" element={<Login />} />

    {/* Portals */}
    <Route path="/portal/player" element={<YJRLPlayerPortal />} />
    <Route path="/portal/coach" element={<YJRLCoachPortal />} />
    <Route path="/portal/parent" element={<YJRLParentPortal />} />
    <Route path="/portal/admin" element={<ProtectedRoute adminOnly><YJRLAdminPortal /></ProtectedRoute>} />

    {/* Legacy routes — redirect /yjrl/* to root */}
    <Route path="/yjrl" element={<Navigate to="/" replace />} />
    <Route path="/yjrl/*" element={<Navigate to="/" replace />} />

    {/* Catch-all */}
    <Route path="*" element={<Navigate to="/" />} />
  </Routes>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
        <InstallPrompt />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: '#0f2570', color: '#f8fafc', borderRadius: '8px', border: '1px solid rgba(255,225,0,0.2)' }
          }}
        />
      </Router>
    </AuthProvider>
  );
}

export default App;
