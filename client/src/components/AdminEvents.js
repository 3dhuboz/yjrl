import React, { useEffect, useState } from 'react';
import { Plus, X, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import MapLocationFields from './MapLocationFields';
import { locationFields } from '../../../shared/maps';

const TYPES = ['training', 'game', 'fundraiser', 'social', 'presentation', 'registration', 'photo-day', 'gala-day', 'other'];
const EMPTY = { title: '', description: '', type: 'other', date: '', time: '', endDate: '', endTime: '', venue: '', address: '', isPublic: false, mapsUrl: '', mapsEmbedUrl: '' };
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/yjrl/events/all').then(r => setEvents(r.data)).catch(() => setError('Could not load events. Reload to try again.')); }, []);
  const save = async e => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      locationFields(form);
      const result = form._id ? await api.put(`/yjrl/events/${form._id}`, form) : await api.post('/yjrl/events', form);
      setEvents(prev => form._id ? prev.map(item => item._id === form._id ? result.data : item) : [...prev, result.data]);
      const date = new Date(`${form.date}T12:00:00`); setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      toast.success(form.isPublic ? 'Event published on the website' : 'Event saved as a draft'); setForm(null);
    } catch (e) { setError(e.response?.data?.error || e.message || 'Could not save event'); }
    finally { setSaving(false); }
  };
  const remove = async event => {
    if (!window.confirm(`Remove ${event.title} from the calendar?`)) return;
    try { await api.delete(`/yjrl/events/${event._id}`); setEvents(prev => prev.filter(item => item._id !== event._id)); toast.success('Event removed'); }
    catch { setError('Could not remove event. Please try again.'); }
  };
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (month.getDay() + 6) % 7;
  const monthEvents = events.filter(event => event.date?.slice(0, 7) === dateKey(month).slice(0, 7)).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  return <div>
    <div className="admin-toolbar" style={{ justifyContent: 'space-between', marginBottom: 20 }}><h2>Events calendar</h2><button className="yjrl-btn yjrl-btn-primary" onClick={() => { setError(''); setForm({ ...EMPTY, date: dateKey(month) }); }}><Plus size={16} /> Add Event</button></div>
    {error && !form && <p role="alert" className="yjrl-form-error">{error}</p>}
    <div className="yjrl-card" style={{ padding: '1rem' }}>
      <div className="admin-toolbar" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <button className="yjrl-btn yjrl-btn-secondary" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
        <strong>{month.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</strong>
        <button className="yjrl-btn yjrl-btn-secondary" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
      </div>
      <p style={{ color: 'var(--yjrl-muted)', fontSize: '.85rem' }}>Select a date to add an event. Drafts appear here until you publish them.</p>
      <div className="admin-calendar">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <strong key={day}>{day}</strong>)}
        {Array.from({ length: offset }, (_, index) => <div key={`blank-${index}`} />)}
        {Array.from({ length: days }, (_, index) => {
          const date = dateKey(new Date(month.getFullYear(), month.getMonth(), index + 1));
          const items = monthEvents.filter(event => event.date === date);
          return <button className="admin-calendar-day" key={date} aria-label={`Add event on ${date}${items.length ? `, ${items.length} events` : ''}`} onClick={() => { setError(''); setForm({ ...EMPTY, date }); }}><b>{index + 1}</b>{items.map(event => <span key={event._id} title={event.title}>{event.isPublic ? '' : 'Draft: '}{event.title}</span>)}</button>;
        })}
      </div>
    </div>
    <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
      {monthEvents.length === 0 && <p>No events in this month.</p>}
      {monthEvents.map(event => <div key={event._id} className="yjrl-card admin-toolbar" style={{ padding: 16, justifyContent: 'space-between' }}><div><strong>{event.title}</strong><p>{event.date} {event.time} · {event.venue || 'Location TBC'} · {event.isPublic ? 'Published' : 'Draft'}</p></div><div className="admin-toolbar"><button className="yjrl-btn yjrl-btn-secondary" onClick={() => { setError(''); setForm({ ...EMPTY, ...event, endDate: event.endDate || '' }); }}><Edit size={14} /> Edit</button><button className="yjrl-btn yjrl-btn-danger" aria-label={`Remove ${event.title}`} onClick={() => remove(event)}><Trash2 size={14} /></button></div></div>)}
    </div>
    {form && <div className="yjrl-modal-overlay"><form className="yjrl-modal" onSubmit={save}>
      <div className="yjrl-modal-header"><h2 className="yjrl-modal-title">{form._id ? 'Edit Event' : 'Add Event'}</h2><button type="button" className="yjrl-btn yjrl-btn-secondary" aria-label="Close event form" onClick={() => setForm(null)}><X size={18} /></button></div>
      <div className="yjrl-modal-body">
        {error && <p role="alert" className="yjrl-form-error">{error}</p>}
        <label className="yjrl-label" htmlFor="event-title">Event title *</label><input id="event-title" required maxLength={150} className="yjrl-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <label className="yjrl-label" htmlFor="event-type">Type</label><select id="event-type" className="yjrl-input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{TYPES.map(type => <option key={type}>{type}</option>)}</select>
        <div className="admin-form-grid">{[['Date', 'date', 'date'], ['Time', 'time', 'time'], ['End date', 'endDate', 'date'], ['End time', 'endTime', 'time'], ['Venue', 'venue', 'text'], ['Address', 'address', 'text']].map(([label, key, type]) => <label key={key}>{label}<input aria-label={`Event ${label.toLowerCase()}`} required={key === 'date'} type={type} className="yjrl-input" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}</div>
        <label className="yjrl-label" htmlFor="event-description">Description</label><textarea id="event-description" className="yjrl-input" rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        <MapLocationFields form={form} setForm={setForm} />
        <label className="admin-check"><input type="checkbox" checked={form.isPublic} onChange={e => setForm({ ...form, isPublic: e.target.checked })} /> Publish on the public events calendar</label>
      </div>
      <div className="yjrl-modal-footer"><button type="button" className="yjrl-btn yjrl-btn-secondary" onClick={() => setForm(null)}>Cancel</button><button disabled={saving} className="yjrl-btn yjrl-btn-primary">{saving ? 'Saving…' : form.isPublic ? 'Publish Event' : 'Save Draft'}</button></div>
    </form></div>}
  </div>;
}
