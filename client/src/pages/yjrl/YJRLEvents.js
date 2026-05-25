import React, { useEffect, useState } from 'react';
import { Calendar, Clock, MapPin, Users } from 'lucide-react';
import api from '../../api';
import YJRLLayout from './YJRLLayout';
import './yjrl.css';

const EVENT_COLORS = {
  training: '#60a5fa',
  game: 'var(--yjrl-gold)',
  fundraiser: '#f472b6',
  social: '#4ade80',
  presentation: '#a78bfa',
  registration: '#38bdf8',
  'photo-day': '#fb923c',
  'gala-day': '#f59e0b',
  other: '#94a3b8',
};

const eventIcon = (type) => {
  if (type === 'fundraiser') return '$';
  if (type === 'presentation') return 'T';
  if (type === 'photo-day') return 'P';
  if (type === 'registration') return 'R';
  return 'E';
};

const YJRLEvents = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/yjrl/events?upcoming=true')
      .then(res => {
        if (Array.isArray(res.data)) setEvents(res.data);
      })
      .catch(() => setError('Unable to load club events right now. Please try again shortly.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <YJRLLayout>
      <div style={{ background: 'linear-gradient(135deg, #172554, #1d4ed8)', color: 'white', padding: '3.5rem 1.5rem 2rem', borderBottom: '1px solid var(--yjrl-border)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
            Club Calendar
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 0.5rem', color: 'white' }}>
            Events
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', margin: 0 }}>
            Training days, club events, fundraisers, registration sessions, and presentation nights.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {loading && <div className="yjrl-loading"><div className="yjrl-spinner" /><span>Loading events...</span></div>}
        {error && !loading && (
          <div className="yjrl-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--yjrl-muted)' }}>{error}</div>
        )}
        {!loading && !error && events.length === 0 && (
          <div className="yjrl-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--yjrl-muted)' }}>
            <Calendar size={40} style={{ marginBottom: '1rem', opacity: 0.45 }} />
            <p style={{ margin: 0 }}>No upcoming club events are published yet.</p>
          </div>
        )}
        {!loading && !error && events.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {events.map(event => {
              const color = EVENT_COLORS[event.type] || EVENT_COLORS.other;
              return (
                <div key={event._id} className="yjrl-card">
                  <div className="yjrl-card-body" style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 12, background: `${color}18`, border: `1px solid ${color}45`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontWeight: 900, flexShrink: 0 }}>
                      {eventIcon(event.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{event.title}</h2>
                        <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color, fontWeight: 800 }}>
                          {event.type || 'event'}
                        </span>
                      </div>
                      {event.description && <p style={{ color: 'var(--yjrl-muted)', lineHeight: 1.6, margin: '0 0 0.85rem', fontSize: '0.9rem' }}>{event.description}</p>}
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', color: 'var(--yjrl-muted)', fontSize: '0.84rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Calendar size={13} />{new Date(event.date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                        {event.time && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Clock size={13} />{event.time}</span>}
                        {event.venue && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><MapPin size={13} />{event.venue}</span>}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Users size={13} />{event.attendingCount || 0} attending</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </YJRLLayout>
  );
};

export default YJRLEvents;
