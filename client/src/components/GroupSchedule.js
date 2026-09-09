import React, { useState, useEffect, useCallback } from 'react';
import { Plus, MapPin } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
const blank = { title: '', kind: 'training', date: '', time: '', venue: '', mapsUrl: '', details: '', cancelled: false };
const errorText = e => e.response?.data?.error || 'Unable to save. Please try again.';
const aest = value => new Date(value).toLocaleString('en-AU', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Australia/Brisbane' });
export default function GroupSchedule({ roomId, canManage }) {
  const [activities, setActivities] = useState([]), [form, setForm] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const refresh = useCallback(async () => { try { const { data } = await api.get('/yjrl/chat/activities', { params: { room_id: roomId } }); setActivities(data); setError(''); } catch (e) { setError(errorText(e)); } }, [roomId]);
  useEffect(() => { refresh(); const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 10000); return () => clearInterval(timer); }, [refresh]);
  const edit = a => { const local = new Date(Date.parse(a.starts_at) + 10 * 3600000).toISOString(); setForm({ ...a, date: local.slice(0, 10), time: local.slice(11, 16), mapsUrl: a.maps_url, cancelled: !!a.cancelled }); };
  const change = (key, value) => setForm(old => ({ ...old, [key]: value }));
  const save = async e => {
    e.preventDefault(); setBusy(true);
    try { const body = { ...form, roomId, startsAt: `${form.date}T${form.time}:00+10:00` }; if (form.id) await api.put(`/yjrl/chat/activities/${form.id}`, body); else await api.post('/yjrl/chat/activities', body); setForm(null); await refresh(); toast.success('Group schedule saved.'); } catch (err) { toast.error(errorText(err)); } finally { setBusy(false); }
  };
  const attendance = async (a, status) => { setBusy(true); try { await api.put(`/yjrl/chat/activities/${a.id}/attendance`, { status }); await refresh(); } catch (err) { toast.error(errorText(err)); } finally { setBusy(false); } };
  const ordered = [...activities].sort((a, b) => { const pastA = Date.parse(a.starts_at) < Date.now(), pastB = Date.parse(b.starts_at) < Date.now(); return pastA !== pastB ? Number(pastA) - Number(pastB) : pastA ? b.starts_at.localeCompare(a.starts_at) : a.starts_at.localeCompare(b.starts_at); });
  return <div className="yjrl-group-schedule">
    <div className="yjrl-chat-schedule-heading"><div><h3>Group schedule</h3><p>One attendance reply per adult account. Parents reply for their family.</p></div>{canManage && <button className="yjrl-btn yjrl-btn-primary" onClick={() => setForm({ ...blank })}><Plus size={16} /> Add Activity</button>}</div>
    {error && <p role="alert">{error} <button onClick={refresh}>Retry</button></p>}
    {!activities.length && !error && <p>No group activities yet.</p>}
    {ordered.map(a => <article key={a.id} className="yjrl-group-activity"><div className="yjrl-chat-meta"><span>{a.kind}</span>{canManage && <button className="yjrl-btn yjrl-btn-secondary" onClick={() => edit(a)}>Edit activity</button>}</div><h3>{a.title}{!!a.cancelled && ' · Cancelled'}</h3><p>{aest(a.starts_at)} AEST</p>{a.venue && <p><MapPin size={15} /> {a.maps_url ? <a href={a.maps_url} target="_blank" rel="noopener noreferrer">{a.venue} · Open Google Maps</a> : a.venue}</p>}{a.maps_url && !a.venue && <a href={a.maps_url} target="_blank" rel="noopener noreferrer">Open Google Maps</a>}<p style={{ whiteSpace: 'pre-wrap' }}>{a.details}</p>
      <div className="yjrl-attendance">{[['going', 'Going'], ['maybe', 'Maybe'], ['unavailable', 'Unavailable']].map(([status, label]) => <button key={status} disabled={busy || !!a.cancelled || Date.parse(a.starts_at) < Date.now()} aria-pressed={a.my_status === status} onClick={() => attendance(a, status)}>{label} ({a.counts[status]})</button>)}</div>
      <p className="yjrl-chat-seen">{a.my_status ? `Your reply: ${a.my_status}` : 'You haven’t replied yet.'}</p>
      {canManage && a.replies?.length > 0 && <details><summary>View attendance replies</summary><ul>{a.replies.map((r, i) => <li key={i}>{r.name} — {r.status}</li>)}</ul></details>}
    </article>)}
    {form && <div className="yjrl-modal-overlay"><form className="yjrl-modal" role="dialog" aria-modal="true" aria-label={form.id ? 'Edit activity' : 'Add activity'} onSubmit={save}><div className="yjrl-modal-header"><h3>{form.id ? 'Edit activity' : 'Add activity'}</h3></div><div className="yjrl-modal-body yjrl-activity-fields">
      <label>Activity title<input className="yjrl-input" required maxLength={150} value={form.title} onChange={e => change('title', e.target.value)} /></label><label>Activity type<select aria-label="Activity type" className="yjrl-input" value={form.kind} onChange={e => change('kind', e.target.value)}>{['training', 'game', 'meeting', 'event'].map(k => <option key={k}>{k}</option>)}</select></label>
      <label>Date (Queensland)<input className="yjrl-input" type="date" required value={form.date} onChange={e => change('date', e.target.value)} /></label><label>Time (AEST)<input className="yjrl-input" type="time" required value={form.time} onChange={e => change('time', e.target.value)} /></label>
      <label>Venue<input className="yjrl-input" maxLength={200} value={form.venue} onChange={e => change('venue', e.target.value)} /></label><label>Google Maps link<input className="yjrl-input" type="url" value={form.mapsUrl} onChange={e => change('mapsUrl', e.target.value)} placeholder="https://maps.app.goo.gl/…" /></label><label>Activity details<textarea className="yjrl-input" maxLength={2000} rows={3} value={form.details} onChange={e => change('details', e.target.value)} /></label>
      {form.id && <label><input type="checkbox" checked={form.cancelled} onChange={e => change('cancelled', e.target.checked)} /> Cancel this activity</label>}
    </div><div className="yjrl-modal-footer"><button className="yjrl-btn yjrl-btn-secondary" type="button" onClick={() => setForm(null)}>Close</button><button className="yjrl-btn yjrl-btn-primary" disabled={busy}>Save Activity</button></div></form></div>}
  </div>;
}
