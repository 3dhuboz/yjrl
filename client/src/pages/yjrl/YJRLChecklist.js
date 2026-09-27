import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import WebsiteChecklist from '../../components/WebsiteChecklist';
export default function YJRLChecklist() {
  const { user, loading } = useAuth();
  const [token] = useState(() => {
    const incoming = new URLSearchParams(window.location.hash.slice(1)).get('access');
    if (incoming) { sessionStorage.setItem('yjrl-checklist-access', incoming); window.history.replaceState(null, '', window.location.pathname); }
    return sessionStorage.getItem('yjrl-checklist-access') || '';
  });
  return <div className="checklist-page"><header className="checklist-brand"><Link to="/">Yeppoon Seagulls JRL</Link><span>Website preparation</span></header><main>
    {token || ['admin', 'dev'].includes(user?.role) ? <WebsiteChecklist privateToken={token} /> : loading ? <p>Loading…</p> : <div className="yjrl-card" style={{ padding: '2rem' }}><h1>Nathan’s website checklist</h1><p>Open the private link supplied by the club to add information and photos.</p><p>Club administrators can open <strong>Admin → Website checklist</strong>.</p><Link className="yjrl-btn yjrl-btn-primary" to="/login">Club admin sign in</Link></div>}
  </main></div>;
}
