import React, { useState, useEffect } from 'react';
import { Gift, Calendar, ExternalLink, Trophy, Mail, DollarSign, Image } from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';
import YJRLLayout from './YJRLLayout';
import './yjrl.css';

const YJRLRaffles = () => {
  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/yjrl/club/raffles')
      .then(res => {
        if (Array.isArray(res.data)) setRaffles(res.data);
      })
      .catch(() => toast.error('Failed to load raffles'))
      .finally(() => setLoading(false));
  }, []);

  const activeRaffles = raffles.filter(r => r.status === 'active' || r.status === 'open');
  const pastRaffles = raffles.filter(r => r.status === 'closed' || r.status === 'drawn');

  return (
    <YJRLLayout>
      {/* Page Header */}
      <div style={{ background: 'linear-gradient(135deg, #172554, #1d4ed8)', color: 'white', padding: '3.5rem 1.5rem 2rem', borderBottom: '1px solid var(--yjrl-border)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
            Support the Seagulls
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 0.5rem', color: 'white' }}>
            Raffles & Fundraising
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', margin: 0 }}>
            Every ticket helps keep our kids on the field. Check out current raffles and grab your tickets today.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Loading State */}
        {loading && (
          <div className="yjrl-loading"><div className="yjrl-spinner" /></div>
        )}

        {/* Empty State */}
        {!loading && raffles.length === 0 && (
          <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--yjrl-muted)' }}>
            <Gift size={48} style={{ marginBottom: '1rem', opacity: 0.4 }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--yjrl-text)' }}>No raffles currently running</h3>
            <p style={{ fontSize: '0.95rem', maxWidth: 420, margin: '0 auto' }}>Check back soon! We regularly run raffles and fundraising events to support the club.</p>
          </div>
        )}

        {/* Active Raffles */}
        {!loading && activeRaffles.length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <Gift size={18} style={{ color: 'var(--yjrl-gold)' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', margin: 0, letterSpacing: '0.04em' }}>Active Raffles</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.5rem' }}>
              {activeRaffles.map(raffle => (
                <div key={raffle._id} className="yjrl-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* Image or Placeholder */}
                  {raffle.image ? (
                    <img src={raffle.image} alt={raffle.title} style={{ width: '100%', height: 200, objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '100%', height: 200,
                      background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Image size={48} style={{ color: 'rgba(255,255,255,0.3)' }} />
                    </div>
                  )}

                  <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.75rem', lineHeight: 1.3 }}>{raffle.title}</h3>

                    {raffle.prizeDescription && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--yjrl-gold)', marginBottom: '0.35rem' }}>Prize</div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--yjrl-muted)', lineHeight: 1.6, margin: 0 }}>{raffle.prizeDescription}</p>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                      {raffle.ticketPrice != null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--yjrl-muted)' }}>
                          <DollarSign size={14} style={{ color: '#4ade80' }} />
                          <span><strong style={{ color: '#4ade80' }}>${raffle.ticketPrice}</strong> per ticket</span>
                        </div>
                      )}
                      {raffle.drawDate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--yjrl-muted)' }}>
                          <Calendar size={14} style={{ color: '#60a5fa' }} />
                          <span>Draw: {new Date(raffle.drawDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: 'auto' }}>
                      {raffle.externalUrl ? (
                        <a
                          href={raffle.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="yjrl-btn yjrl-btn-primary"
                          style={{ width: '100%', justifyContent: 'center' }}
                        >
                          Buy Tickets <ExternalLink size={15} />
                        </a>
                      ) : (
                        <div style={{
                          background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.15)',
                          borderRadius: '8px', padding: '0.875rem 1rem', textAlign: 'center'
                        }}>
                          <p style={{ fontSize: '0.85rem', color: 'var(--yjrl-muted)', margin: '0 0 0.5rem' }}>Contact the club to purchase tickets</p>
                          <a href="mailto:info@yepponjrl.com.au" style={{ fontSize: '0.85rem', color: '#60a5fa', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Mail size={14} /> info@yepponjrl.com.au
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Past Raffles */}
        {!loading && pastRaffles.length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--yjrl-border)' }}>
              <Trophy size={18} style={{ color: 'var(--yjrl-muted)' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase', margin: 0, color: 'var(--yjrl-muted)', letterSpacing: '0.04em' }}>Past Raffles</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {pastRaffles.map(raffle => (
                <div key={raffle._id} className="yjrl-card" style={{ opacity: 0.8 }}>
                  <div style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{raffle.title}</h3>
                      {raffle.status === 'drawn' && (
                        <span style={{
                          fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '100px',
                          background: 'rgba(74,222,128,0.1)', color: '#4ade80',
                          border: '1px solid rgba(74,222,128,0.2)', fontWeight: 700, whiteSpace: 'nowrap'
                        }}>
                          DRAWN
                        </span>
                      )}
                      {raffle.status === 'closed' && (
                        <span style={{
                          fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '100px',
                          background: 'rgba(248,113,113,0.1)', color: '#f87171',
                          border: '1px solid rgba(248,113,113,0.2)', fontWeight: 700, whiteSpace: 'nowrap'
                        }}>
                          CLOSED
                        </span>
                      )}
                    </div>

                    {raffle.prizeDescription && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--yjrl-muted)', lineHeight: 1.5, margin: '0 0 0.75rem' }}>{raffle.prizeDescription}</p>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--yjrl-muted)' }}>
                      {raffle.drawDate && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Calendar size={12} />
                          {new Date(raffle.drawDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>

                    {raffle.status === 'drawn' && raffle.winnerName && (
                      <div style={{
                        marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                        background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
                        borderRadius: '8px', padding: '0.6rem 0.875rem'
                      }}>
                        <Trophy size={14} style={{ color: '#fbbf24' }} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                          Winner: <strong style={{ color: 'var(--yjrl-gold)' }}>{raffle.winnerName}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Donate a Prize CTA */}
        {!loading && (
          <div style={{
            background: 'rgba(240,165,0,0.06)', border: '1px solid rgba(240,165,0,0.2)',
            borderRadius: '12px', padding: '2rem', textAlign: 'center', marginTop: '2rem'
          }}>
            <Gift size={28} style={{ color: 'var(--yjrl-gold)', marginBottom: '0.75rem' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.5rem' }}>Want to donate a prize?</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--yjrl-muted)', margin: '0 0 1.25rem', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
              Local businesses and families can help support the Seagulls by donating raffle prizes. Every contribution helps keep our kids on the field.
            </p>
            <a
              href="mailto:info@yepponjrl.com.au"
              className="yjrl-btn yjrl-btn-primary"
              style={{ display: 'inline-flex' }}
            >
              <Mail size={15} /> Contact us at info@yepponjrl.com.au
            </a>
          </div>
        )}
      </div>
    </YJRLLayout>
  );
};

export default YJRLRaffles;
