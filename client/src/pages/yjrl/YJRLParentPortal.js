import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart, Calendar, CheckCircle, MessageSquare, DollarSign,
  Users, Bell, MapPin, Clock, Shield, LogIn, Info, ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import toast from 'react-hot-toast';
import YJRLLayout from './YJRLLayout';
import './yjrl.css';

const DEMO_CHILDREN = [
  {
    _id: 'p1', firstName: 'Jordan', lastName: 'Smith', ageGroup: 'U14', jerseyNumber: 7, position: 'Halfback',
    registrationStatus: 'active',
    teamId: { name: 'Yeppoon Bulls U14', coachName: 'Mike Thompson', trainingDay: 'Tue & Thu', trainingTime: '5:00 PM', trainingVenue: 'Nev Skuse Oval' },
    stats: [{ season: '2026', gamesPlayed: 8, tries: 6, tackles: 47 }],
    attendanceRecords: [
      ...Array(6).fill({ type: 'training', attended: true }),
      ...Array(2).fill({ type: 'training', attended: false }),
    ]
  },
  {
    _id: 'p2', firstName: 'Emma', lastName: 'Smith', ageGroup: 'U10', jerseyNumber: 4, position: 'Centre',
    registrationStatus: 'active',
    teamId: { name: 'Yeppoon Bulls U10', coachName: 'Sarah Johnson', trainingDay: 'Wednesday', trainingTime: '4:30 PM', trainingVenue: 'Nev Skuse Oval' },
    stats: [{ season: '2026', gamesPlayed: 7, tries: 3, tackles: 18 }],
    attendanceRecords: Array(7).fill({ type: 'training', attended: true })
  }
];

const DEMO_UPCOMING = [
  { _id: 'f1', ageGroup: 'U14', round: 5, homeTeamName: 'Yeppoon Bulls', awayTeamName: 'Rockhampton Rockets', date: new Date(Date.now() + 6 * 86400000), time: '10:00 AM', venue: 'Nev Skuse Oval', status: 'scheduled' },
  { _id: 'f2', ageGroup: 'U10', round: 5, homeTeamName: 'Yeppoon Bulls', awayTeamName: 'Emu Park Eagles', date: new Date(Date.now() + 6 * 86400000), time: '11:30 AM', venue: 'Nev Skuse Oval', status: 'scheduled' },
  { _id: 'f3', ageGroup: 'U14', round: 6, homeTeamName: 'Gladstone Warriors', awayTeamName: 'Yeppoon Bulls', date: new Date(Date.now() + 13 * 86400000), time: '2:00 PM', venue: 'Gladstone City Oval', status: 'scheduled' },
];

const DEMO_EVENTS = [
  { _id: 'e1', title: 'Photo Day 2026', type: 'photo-day', date: new Date(Date.now() + 10 * 86400000), time: '8:30 AM', venue: 'Nev Skuse Oval', description: 'Annual club photos. All players in full uniform please.', rsvps: [] },
  { _id: 'e2', title: 'Season Presentation Night', type: 'presentation', date: new Date(Date.now() + 90 * 86400000), time: '6:00 PM', venue: 'Yeppoon RSL', description: 'End of season awards and celebration. Families welcome.', rsvps: [] },
  { _id: 'e3', title: 'Club BBQ Fundraiser', type: 'fundraiser', date: new Date(Date.now() + 20 * 86400000), time: '12:00 PM', venue: 'Nev Skuse Oval', description: 'Annual fundraiser BBQ. Come along and support the club!', rsvps: [] },
];

const EVENT_COLORS = {
  training: '#60a5fa', game: 'var(--yjrl-gold)', fundraiser: '#f472b6',
  social: '#4ade80', presentation: '#a78bfa', 'photo-day': '#fb923c', other: '#94a3b8'
};

const ONBOARDING_STEPS = [
  { id: 1, label: 'Registration Complete', done: true, icon: '✓' },
  { id: 2, label: 'Uniform Ordered', done: true, icon: '✓' },
  { id: 3, label: 'Medical Form Submitted', done: false, icon: '3' },
  { id: 4, label: 'Emergency Contact Added', done: true, icon: '✓' },
  { id: 5, label: 'Team Announced', done: true, icon: '✓' },
  { id: 6, label: 'First Training Attended', done: false, icon: '6' },
];

const YJRLParentPortal = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [children, setChildren] = useState(DEMO_CHILDREN);
  const [upcoming, setUpcoming] = useState(DEMO_UPCOMING);
  const [events, setEvents] = useState(DEMO_EVENTS);
  const [selectedChild, setSelectedChild] = useState(0);
  const [rsvpMap, setRsvpMap] = useState({});

  const child = children[selectedChild] || children[0];
  const season = new Date().getFullYear().toString();
  const childStats = child?.stats?.find(s => s.season === season) || child?.stats?.[0] || {};
  const attendance = child?.attendanceRecords || [];
  const attendRate = attendance.length ? Math.round(attendance.filter(r => r.attended).length / attendance.length * 100) : 100;

  const handleRsvp = async (eventId, status) => {
    setRsvpMap(prev => ({ ...prev, [eventId]: status }));
    if (user) {
      try {
        await api.post(`/yjrl/events/${eventId}/rsvp`, { status, adults: 2, children: 1 });
        toast.success('RSVP saved!');
      } catch (e) { toast.error('Failed to save RSVP'); }
    } else {
      toast.success(`Demo: RSVP'd ${status} for this event`);
    }
  };

  const childUpcoming = upcoming.filter(f => f.ageGroup === child?.ageGroup);
  const onboardingDone = ONBOARDING_STEPS.filter(s => s.done).length;

  return (
    <YJRLLayout>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, var(--yjrl-dark), var(--yjrl-navy))', padding: '3rem 1.5rem 0', borderBottom: '1px solid var(--yjrl-border)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          {!user && (
            <div style={{ background: 'rgba(192,132,252,0.08)', border: '1px solid rgba(192,132,252,0.2)', borderRadius: '10px', padding: '0.875rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.875rem', color: '#c084fc' }}>
                <LogIn size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Demo mode — showing sample family data. Sign in to see your children's real information.
              </span>
              <Link to="/login" className="yjrl-btn yjrl-btn-primary yjrl-btn-sm">Sign In</Link>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #c084fc, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>💛</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, textTransform: 'uppercase' }}>Parent Portal</h1>
                <span className="yjrl-role-badge parent">Parent</span>
              </div>
              <div style={{ color: 'var(--yjrl-muted)', fontSize: '0.875rem' }}>{children.length} registered player{children.length !== 1 ? 's' : ''} in your family</div>
            </div>

            {/* Child switcher */}
            {children.length > 1 && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                {children.map((c, i) => (
                  <button
                    key={c._id}
                    onClick={() => setSelectedChild(i)}
                    style={{
                      padding: '0.4rem 0.9rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                      cursor: 'pointer', border: '1px solid',
                      borderColor: selectedChild === i ? 'var(--yjrl-gold)' : 'rgba(255,255,255,0.15)',
                      background: selectedChild === i ? 'rgba(240,165,0,0.12)' : 'transparent',
                      color: selectedChild === i ? 'var(--yjrl-gold)' : 'var(--yjrl-muted)'
                    }}
                  >
                    {c.firstName}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="yjrl-tabs">
            {[['overview', 'Overview'], ['schedule', 'Schedule'], ['events', 'Events & RSVP'], ['onboarding', 'Getting Started']].map(([k, l]) => (
              <button key={k} className={`yjrl-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && child && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Child Profile */}
            <div className="yjrl-card">
              <div className="yjrl-card-header">
                <div className="yjrl-card-title"><Users size={16} /> {child.firstName}'s Profile</div>
                {child.registrationStatus === 'active' && (
                  <span style={{ fontSize: '0.7rem', background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)', padding: '0.2rem 0.6rem', borderRadius: '100px', fontWeight: 700 }}>
                    ✓ Registered 2026
                  </span>
                )}
              </div>
              <div className="yjrl-card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--yjrl-gold), #d4840a)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.25rem', fontWeight: 900, color: 'var(--yjrl-navy)',
                    border: '2px solid var(--yjrl-gold)'
                  }}>
                    #{child.jerseyNumber}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{child.firstName} {child.lastName}</div>
                    <div style={{ color: 'var(--yjrl-muted)', fontSize: '0.85rem' }}>{child.ageGroup} · {child.position}</div>
                    <div style={{ color: 'var(--yjrl-muted)', fontSize: '0.8rem' }}>{child.teamId?.name}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  {[['Games', childStats.gamesPlayed || 0, '#60a5fa'], ['Tries', childStats.tries || 0, 'var(--yjrl-gold)'], ['Attendance', `${attendRate}%`, attendRate >= 80 ? '#4ade80' : 'var(--yjrl-gold)']].map(([l, v, c]) => (
                    <div key={l} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.75rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: c }}>{v}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--yjrl-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Training Info */}
            <div className="yjrl-card">
              <div className="yjrl-card-header"><div className="yjrl-card-title"><Calendar size={16} /> Training & Team Info</div></div>
              <div className="yjrl-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { icon: Calendar, label: 'Training Days', value: child.teamId?.trainingDay || 'TBC' },
                  { icon: Clock, label: 'Training Time', value: child.teamId?.trainingTime || 'TBC' },
                  { icon: MapPin, label: 'Venue', value: child.teamId?.trainingVenue || 'Nev Skuse Oval' },
                  { icon: Shield, label: 'Head Coach', value: child.teamId?.coachName || 'TBC' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(240,165,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--yjrl-gold)', flexShrink: 0 }}>
                      <Icon size={15} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--yjrl-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Next games for child */}
            <div className="yjrl-card">
              <div className="yjrl-card-header"><div className="yjrl-card-title"><Calendar size={16} /> Next Games</div></div>
              <div>
                {childUpcoming.slice(0, 3).map(f => (
                  <div key={f._id} style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--yjrl-border)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ background: 'rgba(240,165,0,0.1)', borderRadius: '6px', padding: '0.4rem 0.6rem', textAlign: 'center', minWidth: 52 }}>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--yjrl-gold)', lineHeight: 1 }}>
                        {new Date(f.date).getDate()}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--yjrl-muted)', textTransform: 'uppercase' }}>
                        {new Date(f.date).toLocaleString('en-AU', { month: 'short' })}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{f.homeTeamName} vs {f.awayTeamName}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--yjrl-muted)', display: 'flex', gap: '0.75rem' }}>
                        <span><Clock size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />{f.time}</span>
                        <span><MapPin size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />{f.venue}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {childUpcoming.length === 0 && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--yjrl-muted)', fontSize: '0.875rem' }}>No upcoming games scheduled.</div>
                )}
              </div>
            </div>

            {/* Quick links */}
            <div className="yjrl-card">
              <div className="yjrl-card-header"><div className="yjrl-card-title"><Info size={16} /> Quick Actions</div></div>
              <div className="yjrl-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { label: 'View Full Fixtures', to: '/fixtures', icon: Calendar },
                  { label: 'Club Events & RSVP', onClick: () => setTab('events'), icon: Heart },
                  { label: 'Register Another Child', to: '/register', icon: Users },
                  { label: 'Contact the Club', href: 'mailto:info@yepponjrl.com.au', icon: MessageSquare },
                ].map((item, i) => (
                  item.to ? (
                    <Link key={i} to={item.to} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--yjrl-text)', textDecoration: 'none', transition: 'all 0.15s' }}>
                      <item.icon size={16} style={{ color: 'var(--yjrl-gold)' }} />
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', flex: 1 }}>{item.label}</span>
                      <ChevronRight size={14} style={{ color: 'var(--yjrl-muted)' }} />
                    </Link>
                  ) : item.onClick ? (
                    <button key={i} onClick={item.onClick} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--yjrl-text)', cursor: 'pointer', transition: 'all 0.15s', width: '100%', textAlign: 'left' }}>
                      <item.icon size={16} style={{ color: 'var(--yjrl-gold)' }} />
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', flex: 1 }}>{item.label}</span>
                      <ChevronRight size={14} style={{ color: 'var(--yjrl-muted)' }} />
                    </button>
                  ) : (
                    <a key={i} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--yjrl-text)', textDecoration: 'none', transition: 'all 0.15s' }}>
                      <item.icon size={16} style={{ color: 'var(--yjrl-gold)' }} />
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', flex: 1 }}>{item.label}</span>
                      <ChevronRight size={14} style={{ color: 'var(--yjrl-muted)' }} />
                    </a>
                  )
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SCHEDULE ── */}
        {tab === 'schedule' && (
          <div>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              {children.map((c, i) => (
                <button key={c._id} onClick={() => setSelectedChild(i)}
                  style={{ padding: '0.4rem 0.9rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: selectedChild === i ? 'var(--yjrl-gold)' : 'rgba(255,255,255,0.15)', background: selectedChild === i ? 'rgba(240,165,0,0.12)' : 'transparent', color: selectedChild === i ? 'var(--yjrl-gold)' : 'var(--yjrl-muted)' }}>
                  {c.firstName} ({c.ageGroup})
                </button>
              ))}
            </div>
            <div className="yjrl-card">
              <div className="yjrl-card-header"><div className="yjrl-card-title"><Calendar size={16} /> {child?.firstName}'s Upcoming Schedule</div></div>
              {childUpcoming.length ? childUpcoming.map(f => (
                <div key={f._id} style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--yjrl-border)', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ background: 'rgba(240,165,0,0.1)', borderRadius: '8px', padding: '0.6rem 0.75rem', textAlign: 'center', minWidth: 56, flexShrink: 0 }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--yjrl-gold)', lineHeight: 1 }}>{new Date(f.date).getDate()}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--yjrl-muted)', textTransform: 'uppercase' }}>{new Date(f.date).toLocaleString('en-AU', { month: 'short' })}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Round {f.round}: {f.homeTeamName} vs {f.awayTeamName}</div>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--yjrl-muted)' }}>
                      <span><Clock size={11} style={{ marginRight: 3 }} />{f.time}</span>
                      <span><MapPin size={11} style={{ marginRight: 3 }} />{f.venue}</span>
                    </div>
                  </div>
                </div>
              )) : (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--yjrl-muted)' }}>No upcoming games for {child?.firstName}.</div>
              )}
            </div>
          </div>
        )}

        {/* ── EVENTS & RSVP ── */}
        {tab === 'events' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {events.map(event => {
              const myRsvp = rsvpMap[event._id];
              return (
                <div key={event._id} className="yjrl-card">
                  <div className="yjrl-card-body" style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '12px', background: `${EVENT_COLORS[event.type] || '#94a3b8'}20`, border: `1px solid ${EVENT_COLORS[event.type] || '#94a3b8'}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                      {event.type === 'fundraiser' ? '🍖' : event.type === 'presentation' ? '🏆' : event.type === 'photo-day' ? '📸' : '📅'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                        <div>
                          <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 800 }}>{event.title}</h3>
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--yjrl-muted)', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                            <span><Calendar size={11} style={{ marginRight: 3 }} />{new Date(event.date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long' })}</span>
                            {event.time && <span><Clock size={11} style={{ marginRight: 3 }} />{event.time}</span>}
                            {event.venue && <span><MapPin size={11} style={{ marginRight: 3 }} />{event.venue}</span>}
                          </div>
                          <p style={{ color: 'var(--yjrl-muted)', fontSize: '0.85rem', margin: 0, lineHeight: 1.6 }}>{event.description}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: 160 }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--yjrl-muted)', textAlign: 'center', marginBottom: '0.25rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your RSVP</div>
                          {[['attending', '✓ Attending', '#4ade80'], ['maybe', '? Maybe', 'var(--yjrl-gold)'], ['not-attending', '✗ Can\'t Make It', '#f87171']].map(([status, label, color]) => (
                            <button
                              key={status}
                              onClick={() => handleRsvp(event._id, status)}
                              style={{
                                padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                                border: `1px solid ${myRsvp === status ? color : 'rgba(255,255,255,0.1)'}`,
                                background: myRsvp === status ? `${color}20` : 'transparent',
                                color: myRsvp === status ? color : 'var(--yjrl-muted)',
                                transition: 'all 0.15s'
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── ONBOARDING ── */}
        {tab === 'onboarding' && (
          <div style={{ maxWidth: 600 }}>
            <div className="yjrl-card" style={{ marginBottom: '1.5rem' }}>
              <div className="yjrl-card-header">
                <div className="yjrl-card-title">Getting Started Checklist</div>
                <span style={{ fontSize: '0.875rem', color: 'var(--yjrl-muted)' }}>{onboardingDone}/{ONBOARDING_STEPS.length} complete</span>
              </div>
              <div className="yjrl-card-body">
                <div style={{ marginBottom: '1rem' }}>
                  <div className="yjrl-xp-bar">
                    <div className="yjrl-xp-fill" style={{ width: `${(onboardingDone / ONBOARDING_STEPS.length) * 100}%` }} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {ONBOARDING_STEPS.map(step => (
                    <div key={step.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem',
                      borderRadius: '8px', background: step.done ? 'rgba(74,222,128,0.07)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${step.done ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)'}`
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: step.done ? '#4ade80' : 'rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 900,
                        color: step.done ? 'white' : 'var(--yjrl-muted)'
                      }}>
                        {step.done ? '✓' : step.id}
                      </div>
                      <span style={{ fontWeight: step.done ? 600 : 400, color: step.done ? 'var(--yjrl-text)' : 'var(--yjrl-muted)', fontSize: '0.9rem' }}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Important info */}
            <div className="yjrl-card">
              <div className="yjrl-card-header"><div className="yjrl-card-title"><Info size={16} /> Important Information</div></div>
              <div className="yjrl-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { icon: '🛡️', title: 'Child Safety', text: 'All coaches and volunteers hold current Working With Children Checks (Blue Card). Our Child Safety Policy is available at the clubhouse or via email.' },
                  { icon: '🚑', title: 'Medical & First Aid', text: 'First aid is available at all training sessions and games. Please ensure you have submitted your child\'s medical form and updated it if anything changes.' },
                  { icon: '👕', title: 'Uniform', text: 'All players are required to wear the club jersey, shorts, and socks for game day. Boots with moulded stops are recommended for juniors.' },
                  { icon: '📱', title: 'Communication', text: 'Team communications are managed through this portal. For urgent matters, contact your coach directly or call the club on (07) 4939 XXXX.' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.875rem', padding: '0.875rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: '0.3rem', fontSize: '0.9rem' }}>{item.title}</div>
                      <div style={{ fontSize: '0.825rem', color: 'var(--yjrl-muted)', lineHeight: 1.6 }}>{item.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </YJRLLayout>
  );
};

export default YJRLParentPortal;
