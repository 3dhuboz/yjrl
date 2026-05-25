import React, { useEffect, useState } from 'react';
import { Calendar, MapPin, Shield, Users } from 'lucide-react';
import api from '../../api';
import YJRLLayout from './YJRLLayout';
import './yjrl.css';

const YJRLTeams = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/yjrl/teams')
      .then(res => {
        if (Array.isArray(res.data)) setTeams(res.data);
      })
      .catch(() => setError('Unable to load teams right now. Please try again shortly.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <YJRLLayout>
      <div style={{ background: 'linear-gradient(135deg, #172554, #1d4ed8)', color: 'white', padding: '3.5rem 1.5rem 2rem', borderBottom: '1px solid var(--yjrl-border)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
            2026 Season
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 0.5rem', color: 'white' }}>
            Teams
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', margin: 0 }}>
            Age groups, coaches, training details, and team records for Yeppoon Seagulls JRL.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {loading && <div className="yjrl-loading"><div className="yjrl-spinner" /><span>Loading teams...</span></div>}
        {error && !loading && (
          <div className="yjrl-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--yjrl-muted)' }}>{error}</div>
        )}
        {!loading && !error && teams.length === 0 && (
          <div className="yjrl-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--yjrl-muted)' }}>
            <Users size={40} style={{ marginBottom: '1rem', opacity: 0.45 }} />
            <p style={{ margin: 0 }}>No teams are published yet.</p>
          </div>
        )}
        {!loading && !error && teams.length > 0 && (
          <div className="yjrl-grid-3">
            {teams.map(team => (
              <div key={team._id} className="yjrl-card">
                <div className="yjrl-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, var(--yjrl-gold), #d4840a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--yjrl-navy)' }}>
                      {team.ageGroup?.replace('U', '') || 'Y'}
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{team.name}</h2>
                      <div style={{ color: 'var(--yjrl-muted)', fontSize: '0.8rem' }}>{team.ageGroup}{team.division ? ` · ${team.division}` : ''}</div>
                    </div>
                  </div>
                </div>
                <div className="yjrl-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                    {[['W', team.wins || 0, '#16a34a'], ['L', team.losses || 0, '#dc2626'], ['D', team.draws || 0, 'var(--yjrl-muted)'], ['Pts', team.points || 0, 'var(--yjrl-gold)']].map(([label, value, color]) => (
                      <div key={label} style={{ textAlign: 'center', background: '#f8fafc', border: '1px solid var(--yjrl-border-light)', borderRadius: 8, padding: '0.55rem 0.35rem' }}>
                        <div style={{ color, fontWeight: 900 }}>{value}</div>
                        <div style={{ color: 'var(--yjrl-muted)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--yjrl-muted)', fontSize: '0.86rem' }}>
                    <Shield size={15} style={{ color: 'var(--yjrl-gold)' }} />
                    <span>{team.coachName || 'Coach TBC'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--yjrl-muted)', fontSize: '0.86rem' }}>
                    <Calendar size={15} style={{ color: 'var(--yjrl-gold)' }} />
                    <span>{team.trainingDay || 'Training TBC'}{team.trainingTime ? ` at ${team.trainingTime}` : ''}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--yjrl-muted)', fontSize: '0.86rem' }}>
                    <MapPin size={15} style={{ color: 'var(--yjrl-gold)' }} />
                    <span>{team.trainingVenue || 'Nev Skuse Oval, Yeppoon'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </YJRLLayout>
  );
};

export default YJRLTeams;
