import React, { useState, useEffect } from 'react';
import {
  Calendar, MapPin, Users, DollarSign, Trophy, ExternalLink,
  X, ChevronRight, Clock, Tag
} from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import YJRLLayout from './YJRLLayout';
import './yjrl.css';

const YJRLCarnivals = () => {
  const [carnivals, setCarnivals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedCarnival, setSelectedCarnival] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    teamName: '', ageGroup: '', contactName: '', contactEmail: '',
    contactPhone: '', numberOfPlayers: '', notes: ''
  });

  useEffect(() => {
    api.get('/yjrl/club/carnivals')
      .then(res => {
        if (Array.isArray(res.data)) setCarnivals(res.data);
      })
      .catch(() => toast.error('Failed to load carnivals'))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const upcomingCarnivals = carnivals.filter(c =>
    c.status !== 'completed' && (c.status === 'open' || c.status === 'upcoming' || c.status === 'active' || (!c.status && new Date(c.date) >= now))
  );
  const pastCarnivals = carnivals.filter(c =>
    c.status === 'completed' || (c.status !== 'open' && c.status !== 'upcoming' && c.status !== 'active' && c.status !== 'closed' && c.date && new Date(c.date) < now)
  );
  const closedCarnivals = carnivals.filter(c => c.status === 'closed');

  const openRegistration = (carnival) => {
    setSelectedCarnival(carnival);
    setForm({
      teamName: '', ageGroup: carnival.ageGroups?.[0] || '', contactName: '',
      contactEmail: '', contactPhone: '', numberOfPlayers: '', notes: ''
    });
    setShowModal(true);
  };

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.teamName || !form.ageGroup || !form.contactName || !form.contactEmail || !form.contactPhone) {
      toast.error('Please complete all required fields');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/yjrl/club/carnivals/${selectedCarnival._id}/register`, {
        teamName: form.teamName,
        ageGroup: form.ageGroup,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        numberOfPlayers: form.numberOfPlayers ? parseInt(form.numberOfPlayers, 10) : undefined,
        notes: form.notes || undefined
      });
      toast.success('Registration submitted! You will receive a confirmation email.');
      setShowModal(false);
      // Refresh carnivals to get updated registration count
      api.get('/yjrl/club/carnivals').then(res => {
        if (Array.isArray(res.data)) setCarnivals(res.data);
      }).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const CarnivalCard = ({ carnival, isPast }) => {
    const isClosed = carnival.status === 'closed';
    const isCompleted = isPast || carnival.status === 'completed';
    const registrationOpen = !isClosed && !isCompleted && (carnival.status === 'open' || carnival.status === 'active' || carnival.status === 'upcoming');

    return (
      <div className="yjrl-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: isCompleted ? 0.8 : 1 }}>
        <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Title & Status */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, lineHeight: 1.3 }}>{carnival.title}</h3>
            {isClosed && (
              <span style={{
                fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '100px',
                background: 'rgba(248,113,113,0.1)', color: '#f87171',
                border: '1px solid rgba(248,113,113,0.2)', fontWeight: 700, whiteSpace: 'nowrap'
              }}>
                REGISTRATION CLOSED
              </span>
            )}
            {isCompleted && (
              <span style={{
                fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '100px',
                background: 'rgba(156,163,175,0.1)', color: '#9ca3af',
                border: '1px solid rgba(156,163,175,0.2)', fontWeight: 700, whiteSpace: 'nowrap'
              }}>
                COMPLETED
              </span>
            )}
          </div>

          {/* Description */}
          {carnival.description && (
            <p style={{ fontSize: '0.9rem', color: 'var(--yjrl-muted)', lineHeight: 1.6, margin: '0 0 1rem' }}>{carnival.description}</p>
          )}

          {/* Details Grid */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1.25rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {carnival.date && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--yjrl-muted)' }}>
                <Calendar size={14} style={{ color: '#60a5fa' }} />
                <span>{new Date(carnival.date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            )}
            {carnival.venue && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--yjrl-muted)' }}>
                <MapPin size={14} style={{ color: '#f87171' }} />
                <span>{carnival.venue}</span>
              </div>
            )}
            {carnival.entryFee != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--yjrl-muted)' }}>
                <DollarSign size={14} style={{ color: '#4ade80' }} />
                <span><strong style={{ color: '#4ade80' }}>${carnival.entryFee}</strong> entry fee</span>
              </div>
            )}
            {carnival.maxTeams && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--yjrl-muted)' }}>
                <Users size={14} style={{ color: '#c084fc' }} />
                <span>Max {carnival.maxTeams} teams</span>
              </div>
            )}
            {carnival.registrationCount != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--yjrl-muted)' }}>
                <Users size={14} style={{ color: 'var(--yjrl-gold)' }} />
                <span><strong style={{ color: 'var(--yjrl-gold)' }}>{carnival.registrationCount}</strong> {carnival.registrationCount === 1 ? 'team' : 'teams'} registered</span>
              </div>
            )}
          </div>

          {/* Age Group Pills */}
          {carnival.ageGroups && carnival.ageGroups.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
              {carnival.ageGroups.map(ag => (
                <span key={ag} style={{
                  fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '100px',
                  background: 'rgba(96,165,250,0.1)', color: '#60a5fa',
                  border: '1px solid rgba(96,165,250,0.2)'
                }}>
                  {ag}
                </span>
              ))}
            </div>
          )}

          {/* Action Button */}
          <div style={{ marginTop: 'auto' }}>
            {registrationOpen && carnival.externalUrl && (
              <a
                href={carnival.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="yjrl-btn yjrl-btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Register via External Link <ExternalLink size={15} />
              </a>
            )}
            {registrationOpen && !carnival.externalUrl && (
              <button
                className="yjrl-btn yjrl-btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => openRegistration(carnival)}
              >
                Register Now <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <YJRLLayout>
      {/* Page Header */}
      <div style={{ background: 'linear-gradient(135deg, #172554, #1d4ed8)', color: 'white', padding: '3.5rem 1.5rem 2rem', borderBottom: '1px solid var(--yjrl-border)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
            Events & Competition
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 0.5rem', color: 'white' }}>
            Carnivals & Tournaments
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', margin: 0 }}>
            Upcoming carnivals, gala days, and tournament opportunities for all age groups.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Loading State */}
        {loading && (
          <div className="yjrl-loading"><div className="yjrl-spinner" /></div>
        )}

        {/* Empty State */}
        {!loading && carnivals.length === 0 && (
          <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--yjrl-muted)' }}>
            <Trophy size={48} style={{ marginBottom: '1rem', opacity: 0.4 }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--yjrl-text)' }}>No upcoming carnivals</h3>
            <p style={{ fontSize: '0.95rem', maxWidth: 420, margin: '0 auto' }}>Stay tuned! We will announce carnivals and tournament opportunities as they come up.</p>
          </div>
        )}

        {/* Upcoming / Open Carnivals */}
        {!loading && upcomingCarnivals.length > 0 && (
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <Calendar size={18} style={{ color: 'var(--yjrl-gold)' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', margin: 0, letterSpacing: '0.04em' }}>Upcoming Carnivals</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.5rem' }}>
              {upcomingCarnivals.map(c => <CarnivalCard key={c._id} carnival={c} />)}
            </div>
          </div>
        )}

        {/* Closed Registration Carnivals */}
        {!loading && closedCarnivals.length > 0 && (
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.5rem' }}>
              {closedCarnivals.map(c => <CarnivalCard key={c._id} carnival={c} />)}
            </div>
          </div>
        )}

        {/* Past Carnivals */}
        {!loading && pastCarnivals.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--yjrl-border)' }}>
              <Trophy size={18} style={{ color: 'var(--yjrl-muted)' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', margin: 0, color: 'var(--yjrl-muted)', letterSpacing: '0.04em' }}>Past Carnivals</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {pastCarnivals.map(c => <CarnivalCard key={c._id} carnival={c} isPast />)}
            </div>
          </div>
        )}
      </div>

      {/* Registration Modal */}
      {showModal && selectedCarnival && (
        <div className="yjrl-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="yjrl-modal" style={{ maxWidth: 600 }}>
            <div className="yjrl-modal-header">
              <div>
                <div className="yjrl-modal-title">Register for Carnival</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--yjrl-muted)', marginTop: '0.25rem' }}>{selectedCarnival.title}</div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--yjrl-muted)', padding: '0.25rem' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="yjrl-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="yjrl-form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                    <label className="yjrl-label">Team Name <span style={{ color: 'var(--yjrl-red, #f87171)' }}>*</span></label>
                    <input type="text" className="yjrl-input" value={form.teamName} onChange={e => update('teamName', e.target.value)} placeholder="e.g. Yeppoon Seagulls U12" />
                  </div>

                  <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                    <label className="yjrl-label">Age Group <span style={{ color: 'var(--yjrl-red, #f87171)' }}>*</span></label>
                    <select className="yjrl-input" value={form.ageGroup} onChange={e => update('ageGroup', e.target.value)}>
                      <option value="">-- Select --</option>
                      {(selectedCarnival.ageGroups || []).map(ag => (
                        <option key={ag} value={ag}>{ag}</option>
                      ))}
                    </select>
                  </div>

                  <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                    <label className="yjrl-label">Number of Players</label>
                    <input type="number" className="yjrl-input" value={form.numberOfPlayers} onChange={e => update('numberOfPlayers', e.target.value)} placeholder="e.g. 15" min="1" />
                  </div>

                  <div className="yjrl-form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                    <label className="yjrl-label">Contact Name <span style={{ color: 'var(--yjrl-red, #f87171)' }}>*</span></label>
                    <input type="text" className="yjrl-input" value={form.contactName} onChange={e => update('contactName', e.target.value)} placeholder="Full name" />
                  </div>

                  <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                    <label className="yjrl-label">Contact Email <span style={{ color: 'var(--yjrl-red, #f87171)' }}>*</span></label>
                    <input type="email" className="yjrl-input" value={form.contactEmail} onChange={e => update('contactEmail', e.target.value)} placeholder="your@email.com" />
                  </div>

                  <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                    <label className="yjrl-label">Contact Phone <span style={{ color: 'var(--yjrl-red, #f87171)' }}>*</span></label>
                    <input type="tel" className="yjrl-input" value={form.contactPhone} onChange={e => update('contactPhone', e.target.value)} placeholder="04XX XXX XXX" />
                  </div>

                  <div className="yjrl-form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                    <label className="yjrl-label">Notes</label>
                    <textarea className="yjrl-input" rows={3} style={{ resize: 'vertical' }} value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Any additional information or special requirements" />
                  </div>
                </div>

                {selectedCarnival.entryFee != null && (
                  <div style={{
                    marginTop: '1rem', background: 'rgba(240,165,0,0.08)', border: '1px solid rgba(240,165,0,0.2)',
                    borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--yjrl-muted)' }}>Entry Fee</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--yjrl-gold)' }}>${selectedCarnival.entryFee}</span>
                  </div>
                )}
              </div>

              <div className="yjrl-modal-footer">
                <button type="button" className="yjrl-btn yjrl-btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="yjrl-btn yjrl-btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </YJRLLayout>
  );
};

export default YJRLCarnivals;
