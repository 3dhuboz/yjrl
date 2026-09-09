import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
export default function ChatAgreement({ children }) {
  const [agreement, setAgreement] = useState(null), [accepted, setAccepted] = useState(false), [checked, setChecked] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const load = async () => { try { const { data } = await api.get('/yjrl/chat/agreement'); setAgreement(data); setAccepted(!!data.acceptedAt); setError(''); } catch (e) { setError(e.response?.data?.error || 'Unable to load the communication agreement.'); } };
  useEffect(() => { load(); }, []);
  if (accepted) return <><p className="yjrl-chat-seen" style={{ marginBottom: '1rem' }}>Keep your account private and sign out on shared devices. <Link to="/legal/communication" target="_blank" rel="noopener noreferrer">Adult communication rules</Link></p>{children}</>;
  return <form className="yjrl-card" style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }} onSubmit={async e => { e.preventDefault(); if (!checked) return; setBusy(true); try { await api.post('/yjrl/chat/agreement', { accepted: true, version: agreement.version }); setAccepted(true); } catch (err) { setError(err.response?.data?.error || 'Unable to record your agreement.'); } finally { setBusy(false); } }}>
    <h2>{agreement?.title || 'Adult communication agreement'}</h2>
    {error && <p role="alert">{error} <button type="button" onClick={load}>Retry</button></p>}
    {!agreement && !error && <p>Loading…</p>}
    {agreement && <><p style={{ margin: '1rem 0' }}>Please read this before using team, coaches or committee communication.</p>{agreement.sections.map(([title, text]) => <section key={title} style={{ margin: '1rem 0' }}><h3 style={{ fontSize: '1rem' }}>{title}</h3><p style={{ color: 'var(--yjrl-muted)', lineHeight: 1.65 }}>{text}</p></section>)}
      <p><Link to="/legal/terms" target="_blank" rel="noopener noreferrer">Terms of Use</Link> · <Link to="/legal/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link> · <Link to="/legal/child-safety" target="_blank" rel="noopener noreferrer">Child Safety</Link></p>
      <label style={{ display: 'flex', gap: '.8rem', alignItems: 'flex-start', margin: '1.5rem 0' }}><input type="checkbox" required checked={checked} onChange={e => setChecked(e.target.checked)} style={{ marginTop: 4 }} /><span>{agreement.statement}</span></label>
      <button className="yjrl-btn yjrl-btn-primary" disabled={busy || !checked}>Agree and Continue</button>
    </>}
  </form>;
}
