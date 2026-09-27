import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Flag, Pin, Calendar, MessageCircle, Megaphone, ThumbsUp, Heart, Hand, Check } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import GroupSchedule from '../../components/GroupSchedule';

const reactions = ['👍', '❤️', '👏', '✅'];
const reactionIcons = { '👍': ThumbsUp, '❤️': Heart, '👏': Hand, '✅': Check };
const dateLabel = value => new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Australia/Brisbane' });
const errorText = error => error.response?.data?.error || 'Unable to connect. Please try again.';

export default function YJRLChat({ roomId, roomName = 'Team group' }) {
  const [messages, setMessages] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [moreUpdates, setMoreUpdates] = useState(false);
  const [pins, setPins] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [input, setInput] = useState('');
  const [kind, setKind] = useState('message');
  const [tab, setTab] = useState('messages');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [report, setReport] = useState(null);
  const [reason, setReason] = useState('');
  const list = useRef(null), end = useRef(null), first = useRef(true), alive = useRef(true), request = useRef(null), read = useRef(0);
  const refresh = useCallback(async () => {
    if (!roomId) return;
    try {
      const [response, announcements] = await Promise.all([api.get('/yjrl/chat', { params: { room_id: roomId, limit: 50 } }), api.get('/yjrl/chat', { params: { room_id: roomId, kind: 'announcement', limit: 50 } })]);
      if (!alive.current) return;
      const nearBottom = !list.current || list.current.scrollHeight - list.current.scrollTop - list.current.clientHeight < 80;
      setMessages(old => [...new Map([...old, ...response.data.messages].map(m => [m.id, m])).values()].sort((a, b) => a.id - b.id));
      setUpdates(old => [...new Map([...old, ...announcements.data.messages].map(m => [m.id, m])).values()].sort((a, b) => a.id - b.id));
      if (first.current) setMoreUpdates(announcements.data.hasMore);
      setPins(response.data.pinned || []); setCanManage(response.data.canManage);
      if (first.current) setMore(response.data.hasMore);
      setError(''); setLoading(false);
      if (first.current || nearBottom) requestAnimationFrame(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; });
      first.current = false;
    } catch (err) {
      if (!alive.current) return;
      setError(errorText(err)); setLoading(false);
      if ([401, 403].includes(err.response?.status)) { setMessages([]); setUpdates([]); setPins([]); setCanManage(false); }
    }
  }, [roomId]);
  useEffect(() => {
    alive.current = true; refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 5000);
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { alive.current = false; clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  useEffect(() => {
    if (!end.current || !messages.length || tab !== 'messages') return;
    const lastId = messages[messages.length - 1].id;
    const observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting || document.visibilityState !== 'visible' || read.current >= lastId) return;
      api.put('/yjrl/chat/read', { roomId, messageId: lastId }).then(() => { read.current = lastId; }).catch(() => {});
    }, { threshold: 1 });
    observer.observe(end.current); return () => observer.disconnect();
  }, [messages, tab, roomId]);
  const send = async event => {
    event.preventDefault(); if (!input.trim() || busy) return;
    setBusy(true);
    const fingerprint = `${kind}:${input.trim()}`;
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    try {
      await api.post('/yjrl/chat', { room_id: roomId, message: input.trim(), kind, requestId: request.current.id });
      setInput(''); request.current = null; first.current = true; await refresh();
    } catch (err) { toast.error(errorText(err)); } finally { setBusy(false); }
  };
  const action = async (url, body) => {
    if (busy) return; setBusy(true);
    try { await api.put(url, body); await refresh(); } catch (err) { toast.error(errorText(err)); } finally { setBusy(false); }
  };
  const older = async () => {
    setBusy(true);
    try {
      const isUpdate = tab === 'announcements';
      const { data } = await api.get('/yjrl/chat', { params: { room_id: roomId, before: (isUpdate ? updates : messages)[0]?.id, kind: isUpdate ? 'announcement' : undefined, limit: 50 } });
      (isUpdate ? setUpdates : setMessages)(old => [...new Map([...data.messages, ...old].map(m => [m.id, m])).values()].sort((a, b) => a.id - b.id)); (isUpdate ? setMoreUpdates : setMore)(data.hasMore);
    } catch (err) { toast.error(errorText(err)); } finally { setBusy(false); }
  };
  if (!roomId) return <div className="yjrl-card" style={{ padding: 24 }}>Your team group will appear once the club assigns your player to a team.</div>;
  const shown = tab === 'announcements' ? updates : messages;
  return <section className="yjrl-chat-panel" aria-label={roomName}>
    <header className="yjrl-chat-header"><h2><MessageCircle size={22} /> {roomName}</h2><p>Private adult group · Times in Queensland (AEST)</p></header>
    <div className="yjrl-chat-tabs" role="tablist" aria-label="Group sections">
      {[['messages', MessageCircle, 'Messages'], ['announcements', Megaphone, 'Announcements'], ['schedule', Calendar, 'Schedule']].map(([id, Icon, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}><Icon size={17} /> {label}</button>)}
    </div>
    {error && <div className="yjrl-chat-error" role="alert">{error} <button onClick={refresh}>Retry</button></div>}
    {tab === 'schedule' ? <GroupSchedule roomId={roomId} canManage={canManage} /> : <>
      {pins.length > 0 && <details className="yjrl-chat-pins"><summary><Pin size={15} /> Pinned updates ({pins.length})</summary>{pins.map(m => <div key={m.id}><strong>{m.user_name}</strong><p>{m.text}</p>{canManage && <button onClick={() => action(`/yjrl/chat/${m.id}/pin`, { pinned: false })}>Unpin</button>}</div>)}</details>}
      <div className="yjrl-chat-messages" ref={list} aria-label={tab === 'announcements' ? 'Group announcements' : 'Conversation'}>
        {(tab === 'announcements' ? moreUpdates : more) && <button className="yjrl-btn yjrl-btn-secondary" disabled={busy} onClick={older}>Load older messages</button>}
        {loading ? <p>Loading conversation…</p> : !shown.length && <p className="yjrl-chat-empty">{tab === 'announcements' ? 'No announcements yet.' : 'Start the conversation with your group.'}</p>}
        {shown.map(m => <article key={m.id} className={`yjrl-chat-message ${m.isOwn ? 'is-own' : ''} ${m.kind === 'announcement' ? 'is-announcement' : ''}`}>
          <div className="yjrl-chat-meta"><strong>{m.user_name}</strong><time>{dateLabel(m.created_at)}</time></div>
          {m.kind === 'announcement' && <span className="yjrl-chat-badge">Announcement</span>}{m.pinned && <span className="yjrl-chat-badge">Pinned</span>}
          <p>{m.text}</p>
          <div className="yjrl-chat-actions">{reactions.map(emoji => <button key={emoji} disabled={busy} aria-label={`React ${emoji} to message ${m.id}`} aria-pressed={m.myReactions?.includes(emoji) || false} onClick={() => action(`/yjrl/chat/${m.id}/reaction`, { emoji, active: !m.myReactions?.includes(emoji) })}>{React.createElement(reactionIcons[emoji], { size: 15, 'aria-hidden': true })} {m.reactions?.[emoji] || ''}</button>)}
            {canManage && <button disabled={busy} aria-label={`${m.pinned ? 'Unpin' : 'Pin'} message ${m.id}`} onClick={() => action(`/yjrl/chat/${m.id}/pin`, { pinned: !m.pinned })}><Pin size={14} /></button>}
            <button aria-label={`Report message ${m.id}`} onClick={() => { setReport(m); setReason(''); }}><Flag size={14} /></button>
          </div>
          {m.isOwn && <small className="yjrl-chat-seen">{m.seenCount ? `Seen by ${m.seenCount}` : 'Sent'}</small>}
        </article>)}<div ref={end} style={{ height: 2 }} />
      </div>
      <form onSubmit={send} className="yjrl-chat-compose">
        {canManage && <label>Post as<select className="yjrl-input" value={kind} onChange={e => setKind(e.target.value)}><option value="message">Message</option><option value="announcement">Announcement</option></select></label>}
        <label className="yjrl-chat-input-label">{kind === 'announcement' ? 'Write an announcement' : 'Write a message'}<textarea className="yjrl-input" value={input} maxLength={500} rows={2} required onChange={e => setInput(e.target.value)} /></label>
        <button className="yjrl-btn yjrl-btn-primary" disabled={busy || !input.trim() || !!error}><Send size={17} /> {busy ? 'Saving…' : 'Send'}</button>
      </form>
    </>}
    {report && <div className="yjrl-modal-overlay"><form className="yjrl-modal" role="dialog" aria-modal="true" aria-label="Report message" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await api.post(`/yjrl/chat/${report.id}/report`, { reason }); setReport(null); toast.success('Report sent to the club safety team.'); } catch (err) { toast.error(errorText(err)); } finally { setBusy(false); } }}>
      <div className="yjrl-modal-header"><h3>Report message</h3></div><div className="yjrl-modal-body"><label>Describe the concern<textarea className="yjrl-input" required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label></div><div className="yjrl-modal-footer"><button type="button" className="yjrl-btn yjrl-btn-secondary" onClick={() => setReport(null)}>Cancel</button><button className="yjrl-btn yjrl-btn-primary" disabled={busy}>Send Report</button></div>
    </form></div>}
  </section>;
}
