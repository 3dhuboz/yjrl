import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import ChatAgreement from './ChatAgreement';
import YJRLChat from '../pages/yjrl/YJRLChat';
export default function CommunicationHub({ initialRoomId }) {
  const { user } = useAuth();
  const admin = ['admin', 'dev'].includes(user?.role);
  const [rooms, setRooms] = useState([]), [selected, setSelected] = useState(initialRoomId || ''), [search, setSearch] = useState(''), [error, setError] = useState(''), [loaded, setLoaded] = useState(false);
  const [members, setMembers] = useState(null), [memberSearch, setMemberSearch] = useState(''), [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => { try { const { data } = await api.get('/yjrl/chat/channels'); setRooms(data); setSelected(old => data.some(r => r.id === old) ? old : data[0]?.id || ''); setError(''); setLoaded(true); } catch (e) { setError(e.response?.data?.error || 'Unable to load your groups.'); setRooms([]); } }, []);
  useEffect(() => { refresh(); const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 10000); return () => clearInterval(timer); }, [refresh]);
  const room = rooms.find(r => r.id === selected);
  const visible = rooms.filter(r => r.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  const openMembers = async () => { try { const { data } = await api.get('/yjrl/chat/committee'); setMembers(data); } catch (e) { toast.error(e.response?.data?.error || 'Unable to load members.'); } };
  const setMembership = async (person, member) => { setBusy(true); setMembers(old => old.map(m => m.id === person.id ? { ...m, member } : m)); try { await api.put(`/yjrl/chat/committee/${person.id}`, { member }); await openMembers(); await refresh(); } catch (e) { setMembers(old => old.map(m => m.id === person.id ? person : m)); toast.error(e.response?.data?.error || 'Unable to change membership.'); } finally { setBusy(false); } };
  return <ChatAgreement><div>
    <div className="yjrl-communication-heading"><div><h2>Club communication</h2><p>Team families, coaches and committee groups.</p></div>{admin && <button className="yjrl-btn yjrl-btn-secondary" onClick={openMembers}>Manage Committee</button>}</div>
    {error && <p role="alert">{error} <button onClick={refresh}>Retry</button></p>}
    {!loaded && !error && <p>Loading your groups…</p>}
    {loaded && !rooms.length && !error && <p>Your groups will appear when the club assigns your family to a team or adds your adult account to the committee.</p>}
    {!!rooms.length && <div className="yjrl-communication-grid"><aside className="yjrl-group-picker"><label>Find a group<input className="yjrl-input" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Team, age group or committee" /></label><nav aria-label="Your groups">{visible.map(r => <button key={r.id} aria-current={selected === r.id ? 'page' : undefined} onClick={() => setSelected(r.id)}><span>{r.name}</span>{r.unread > 0 && <span className="yjrl-unread" aria-label={`${r.unread} unread messages`}>{r.unread}</span>}</button>)}{!visible.length && <p>No matching groups.</p>}</nav></aside>{room && <YJRLChat key={room.id} roomId={room.id} roomName={room.name} />}</div>}
    {members && <div className="yjrl-modal-overlay"><div className="yjrl-modal" role="dialog" aria-modal="true" aria-label="Committee members"><div className="yjrl-modal-header"><h3>Committee members</h3></div><div className="yjrl-modal-body"><p>Tick the adult accounts that need access to the private committee group. Club administrators already have access.</p><label>Find adult account<input className="yjrl-input" type="search" value={memberSearch} onChange={e => setMemberSearch(e.target.value)} /></label><div className="yjrl-committee-members">{members.filter(m => `${m.first_name} ${m.last_name}`.toLowerCase().includes(memberSearch.toLowerCase())).map(m => <label key={m.id}><input type="checkbox" disabled={busy || ['admin', 'dev'].includes(m.role)} checked={!!m.member || ['admin', 'dev'].includes(m.role)} onChange={e => setMembership(m, e.target.checked)} /> {m.first_name} {m.last_name} <small>({m.role})</small></label>)}</div></div><div className="yjrl-modal-footer"><button className="yjrl-btn yjrl-btn-primary" disabled={busy} onClick={() => setMembers(null)}>Done</button></div></div></div>}
  </div></ChatAgreement>;
}
