import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Calendar, Trophy, Users, Star, Zap, Shield,
  ChevronRight, MapPin, Clock, TrendingUp, Heart, Award
} from 'lucide-react';
import api from '../../api';
import YJRLLayout from './YJRLLayout';
import './yjrl.css';

const AGE_GROUPS = ['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'Womens'];

const CATEGORY_EMOJI = {
  news: '📰', results: '🏆', events: '📅', club: '🏉', pathways: '⭐', community: '🤝', sponsors: '💛'
};

const DEFAULT_NEWS = [
  {
    _id: '1', title: 'Season 2026 Registration Now Open', category: 'news',
    excerpt: 'Registration for the 2026 season is now open. All age groups from U6 through to Opens are welcome. Early bird pricing available until February 28.',
    publishDate: new Date('2026-01-15'), image: ''
  },
  {
    _id: '2', title: 'Seagulls Claim Grand Final Victory — U14s Champions!', category: 'results',
    excerpt: 'What a performance! The Yeppoon Seagulls U14s fought back from a 10-point deficit in the second half to claim the 2025 Grand Final 24-16 against Rockhampton Tigers.',
    publishDate: new Date('2025-09-20'), image: ''
  },
  {
    _id: '3', title: 'Junior Pathway Program — Applications Open', category: 'pathways',
    excerpt: 'The QRL RISE Program is now accepting applications for eligible U13-U15 players. This is your chance to take the next step in your rugby league journey.',
    publishDate: new Date('2025-11-10'), image: ''
  }
];

const DEFAULT_FIXTURES = [
  { _id: 'f1', ageGroup: 'U14', homeTeamName: 'Yeppoon Seagulls', awayTeamName: 'Rockhampton Rockets', date: new Date(Date.now() + 7 * 86400000), time: '10:00 AM', venue: 'Nev Skuse Oval', status: 'scheduled' },
  { _id: 'f2', ageGroup: 'U12', homeTeamName: 'Capricorn Cobras', awayTeamName: 'Yeppoon Seagulls', date: new Date(Date.now() + 7 * 86400000), time: '11:30 AM', venue: 'Gangwon Park', status: 'scheduled' },
  { _id: 'f3', ageGroup: 'U16', homeTeamName: 'Yeppoon Seagulls', awayTeamName: 'Gladstone Warriors', date: new Date(Date.now() - 7 * 86400000), time: '2:00 PM', venue: 'Nev Skuse Oval', status: 'completed', homeScore: 26, awayScore: 14 },
];

const DEFAULT_TEAMS = AGE_GROUPS.map((ag, i) => ({
  _id: String(i + 1), ageGroup: ag, name: `Yeppoon Seagulls ${ag}`, isActive: true,
  wins: Math.floor(Math.random() * 8), losses: Math.floor(Math.random() * 5), draws: 0,
  coachName: ['Mike Thompson', 'Sarah Johnson', 'Dave Williams', 'Lisa Chen', 'Brad Smith'][i % 5]
}));

const Countdown = ({ date }) => {
  const [diff, setDiff] = useState(0);
  useEffect(() => {
    const update = () => setDiff(Math.max(0, new Date(date) - new Date()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [date]);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
      {[['Days', d], ['Hrs', h], ['Min', m], ['Sec', s]].map(([label, val]) => (
        <div key={label} style={{ textAlign: 'center', background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.2)', borderRadius: '8px', padding: '0.6rem 0.75rem', minWidth: 60 }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--yjrl-gold)', lineHeight: 1 }}>{String(val).padStart(2, '0')}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--yjrl-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.2rem' }}>{label}</div>
        </div>
      ))}
    </div>
  );
};

const YJRLHome = () => {
  const [news, setNews] = useState(DEFAULT_NEWS);
  const [fixtures, setFixtures] = useState(DEFAULT_FIXTURES);
  const [teams, setTeams] = useState(DEFAULT_TEAMS);
  const [stats, setStats] = useState({ teamCount: 14, playerCount: 280, fixtureCount: 120 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/news?limit=3&published=true').catch(() => ({ data: [] })),
      api.get('/fixtures?upcoming=true&limit=3').catch(() => ({ data: [] })),
      api.get('/teams').catch(() => ({ data: [] })),
      api.get('/stats/overview').catch(() => ({ data: null }))
    ]).then(([nRes, fRes, tRes, sRes]) => {
      if (Array.isArray(nRes.data) && nRes.data.length) setNews(nRes.data);
      if (Array.isArray(fRes.data) && fRes.data.length) setFixtures(fRes.data);
      if (Array.isArray(tRes.data) && tRes.data.length) setTeams(tRes.data);
      if (sRes.data && typeof sRes.data === 'object' && !Array.isArray(sRes.data)) setStats(sRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const nextGame = fixtures.find(f => f.status === 'scheduled' && new Date(f.date) > new Date());
  const recentResults = fixtures.filter(f => f.status === 'completed').slice(0, 3);

  return (
    <YJRLLayout>
      {/* ═══ HERO ═══ */}
      <section className="yjrl-hero">
        <div className="yjrl-hero-bg" style={{ backgroundImage: 'url(/images/hero.jpg)' }} />
        <div className="yjrl-hero-grid" />
        <div className="yjrl-hero-content">
          <div>
            <div className="yjrl-hero-badge">
              <img src="/images/logo.png" alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} /> 2026 Season — Go Seagulls!
            </div>
            <h1>
              Yeppoon<br />
              <span>Seagulls</span>
              Junior Rugby League
            </h1>
            <p>
              Where Capricorn Coast champions are made. From Mini Mod to Opens — join the Seagulls family that builds players,
              leaders, and lifelong mates on and off the field.
            </p>
            <div className="yjrl-hero-actions">
              <Link to="/register" className="yjrl-btn yjrl-btn-primary yjrl-btn-lg">
                Join the Club <ArrowRight size={18} />
              </Link>
              <Link to="/fixtures" className="yjrl-btn yjrl-btn-secondary yjrl-btn-lg">
                View Fixtures
              </Link>
            </div>
            <div className="yjrl-hero-stats">
              <div className="yjrl-hero-stat">
                <span className="yjrl-hero-stat-value">{stats.teamCount}+</span>
                <span className="yjrl-hero-stat-label">Teams</span>
              </div>
              <div className="yjrl-hero-stat">
                <span className="yjrl-hero-stat-value">{stats.playerCount}+</span>
                <span className="yjrl-hero-stat-label">Players</span>
              </div>
              <div className="yjrl-hero-stat">
                <span className="yjrl-hero-stat-value">60+</span>
                <span className="yjrl-hero-stat-label">Years of History</span>
              </div>
              <div className="yjrl-hero-stat">
                <span className="yjrl-hero-stat-value">12</span>
                <span className="yjrl-hero-stat-label">Premierships</span>
              </div>
            </div>
          </div>

          {/* Right panel — Next Game Countdown */}
          <div>
            {nextGame ? (
              <div style={{
                background: 'rgba(12, 29, 53, 0.8)', border: '1px solid rgba(240,165,0,0.3)',
                borderRadius: '16px', padding: '2rem', backdropFilter: 'blur(16px)'
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--yjrl-gold)', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', marginBottom: '1.25rem' }}>
                  Next Game
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--yjrl-muted)', textAlign: 'center', marginBottom: '0.5rem' }}>{nextGame.ageGroup}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--yjrl-text)', textAlign: 'center', marginBottom: '1.5rem' }}>
                  {nextGame.homeTeamName} <span style={{ color: 'var(--yjrl-gold)' }}>vs</span> {nextGame.awayTeamName}
                </div>
                <Countdown date={nextGame.date} />
                <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--yjrl-muted)', justifyContent: 'center' }}>
                    <Calendar size={14} />
                    {new Date(nextGame.date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {nextGame.time && ` at ${nextGame.time}`}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--yjrl-muted)', justifyContent: 'center' }}>
                    <MapPin size={14} /> {nextGame.venue}
                  </div>
                </div>
                <Link to="/fixtures" className="yjrl-btn yjrl-btn-secondary" style={{ marginTop: '1.5rem', width: '100%', justifyContent: 'center' }}>
                  Full Schedule <ChevronRight size={15} />
                </Link>
              </div>
            ) : (
              <div style={{
                background: 'rgba(12,29,53,0.6)', border: '1px solid var(--yjrl-border)',
                borderRadius: '16px', padding: '2.5rem', textAlign: 'center'
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏆</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Season 2026 Underway</div>
                <div style={{ color: 'var(--yjrl-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  Check the full fixture schedule and follow your team all season long.
                </div>
                <Link to="/fixtures" className="yjrl-btn yjrl-btn-primary">View All Fixtures</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══ LATEST RESULTS TICKER ═══ */}
      {recentResults.length > 0 && (
        <div style={{ background: 'var(--yjrl-blue-deeper)', borderTop: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid var(--yjrl-border)', padding: '0.875rem 0', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: '3rem', padding: '0 1.5rem', overflowX: 'auto', maxWidth: 1280, margin: '0 auto', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--yjrl-gold)', whiteSpace: 'nowrap' }}>Latest Results</span>
            {recentResults.map(f => (
              <div key={f._id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--yjrl-gold)', fontWeight: 700 }}>{f.ageGroup}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{f.homeTeamName}</span>
                <span style={{
                  background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.2)',
                  borderRadius: '4px', padding: '0.15rem 0.5rem',
                  fontSize: '0.9rem', fontWeight: 900, color: 'var(--yjrl-gold)'
                }}>
                  {f.homeScore ?? '–'} – {f.awayScore ?? '–'}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{f.awayTeamName}</span>
              </div>
            ))}
            <Link to="/fixtures" style={{ fontSize: '0.75rem', color: 'var(--yjrl-gold)', textDecoration: 'none', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
              All Results <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      )}

      {/* ═══ STATS STRIP ═══ */}
      <section style={{ background: '#f0f9ff', padding: '3rem 1.5rem' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="yjrl-grid-4">
            {[
              { icon: Users, value: `${stats.teamCount}+`, label: 'Active Teams', color: '#0ea5e9' },
              { icon: Zap, value: `${stats.playerCount}+`, label: 'Registered Players', color: '#1d4ed8' },
              { icon: Trophy, value: '12', label: 'Premierships', color: '#ca8a04' },
              { icon: Heart, value: '60+', label: 'Years of Community', color: '#0ea5e9' },
            ].map((item, i) => (
              <div key={i} className="yjrl-stat-card">
                <div className="yjrl-stat-icon" style={{ color: item.color }}>
                  <item.icon size={22} />
                </div>
                <span className="yjrl-stat-value" style={{ color: item.color }}>{item.value}</span>
                <span className="yjrl-stat-label">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ LATEST NEWS ═══ */}
      <section className="yjrl-section">
        <div className="yjrl-section-inner">
          <div className="yjrl-section-header">
            <div className="yjrl-section-label">Latest from the Club</div>
            <h2 className="yjrl-section-title">News & Updates</h2>
            <p className="yjrl-section-desc">Stay up to date with results, events, player news, and everything happening at Yeppoon JRL.</p>
          </div>

          <div className="yjrl-grid-3">
            {news.map(article => (
              <Link key={article._id} to={`/yjrl/news/${article._id}`} className="yjrl-news-card">
                {article.image ? (
                  <img src={article.image} alt={article.title} className="yjrl-news-img" />
                ) : (
                  <div className="yjrl-news-img-placeholder">
                    <span>{CATEGORY_EMOJI[article.category] || '📰'}</span>
                  </div>
                )}
                <div className="yjrl-news-body">
                  <div className="yjrl-news-cat">{article.category}</div>
                  <h3 className="yjrl-news-title">{article.title}</h3>
                  <p className="yjrl-news-excerpt">{article.excerpt}</p>
                  <div className="yjrl-news-meta">
                    <Clock size={12} />
                    {new Date(article.publishDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <Link to="/news" className="yjrl-btn yjrl-btn-secondary">
              View All News <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ TEAMS GRID ═══ */}
      <section className="yjrl-section" style={{ background: 'white' }}>
        <div className="yjrl-section-inner">
          <div className="yjrl-section-header">
            <div className="yjrl-section-label">2026 Season</div>
            <h2 className="yjrl-section-title">Our Teams</h2>
            <p className="yjrl-section-desc">From Mini Mod to Seniors — there's a place for every player at Yeppoon JRL.</p>
          </div>

          <div className="yjrl-grid-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {teams.slice(0, 12).map((team) => (
              <div key={team._id} className="yjrl-card" style={{ padding: '1.25rem', textAlign: 'center', cursor: 'pointer' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 0.75rem', fontSize: '1.3rem', fontWeight: 900, color: 'var(--yjrl-blue-dark)'
                }}>
                  {team.ageGroup.replace('U', '').replace('Womens', 'W').replace('Mens', 'M')}
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{team.ageGroup}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--yjrl-muted)', marginBottom: '0.75rem' }}>
                  {team.coachName ? `Coach: ${team.coachName}` : 'Yeppoon Seagulls'}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', fontSize: '0.75rem' }}>
                  <span style={{ color: '#4ade80', fontWeight: 700 }}>{team.wins}W</span>
                  <span style={{ color: 'var(--yjrl-muted)' }}>–</span>
                  <span style={{ color: '#f87171', fontWeight: 700 }}>{team.losses}L</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ROLE PORTALS CTA ═══ */}
      <section className="yjrl-section">
        <div className="yjrl-section-inner">
          <div className="yjrl-section-header">
            <div className="yjrl-section-label">Digital Club Hub</div>
            <h2 className="yjrl-section-title">Your Portal Awaits</h2>
            <p className="yjrl-section-desc">Every member of our club community has a personalised digital home — stats, schedules, badges, and more.</p>
          </div>

          <div className="yjrl-grid-4">
            {[
              {
                icon: '⚡', title: 'Player Portal', desc: 'Track your stats, earn achievement badges, view your training attendance streak, and follow your pathway to rep football.',
                to: '/portal/player', color: '#60a5fa', badge: 'Players'
              },
              {
                icon: '💛', title: 'Parent Portal', desc: "Stay connected with your child's team. RSVP to events, view training schedules, communicate with coaches, and manage registrations.",
                to: '/portal/parent', color: '#c084fc', badge: 'Parents'
              },
              {
                icon: '🛡️', title: 'Coach Portal', desc: 'Manage your roster, record attendance, build game-day lineups, add player development notes, and communicate with families.',
                to: '/portal/coach', color: '#4ade80', badge: 'Coaches'
              },
              {
                icon: '🏆', title: 'Club Admin', desc: 'Full club management — registrations, financials, volunteer coordination, sponsor management, and club-wide communications.',
                to: '/portal/admin', color: '#ca8a04', badge: 'Admin'
              },
            ].map((portal) => (
              <Link key={portal.to} to={portal.to} style={{ textDecoration: 'none' }}>
                <div className="yjrl-card" style={{ padding: '1.75rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{portal.icon}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: portal.color }}>{portal.title}</h3>
                    <span className="yjrl-role-badge" style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.07)', color: portal.color, border: 'none' }}>
                      {portal.badge}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--yjrl-muted)', lineHeight: 1.6, flex: 1, margin: '0 0 1.25rem' }}>
                    {portal.desc}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600, color: portal.color }}>
                    Access Portal <ChevronRight size={14} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ JOIN CTA ═══ */}
      <section style={{
        background: 'linear-gradient(135deg, var(--yjrl-blue-deeper) 0%, var(--yjrl-blue) 100%)',
        padding: '5rem 1.5rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(240,165,0,0.08) 0%, transparent 60%)',
          pointerEvents: 'none'
        }} />
        <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 2 }}>
          <img src="/images/logo.png" alt="Yeppoon Seagulls" style={{ width: 100, height: 100, objectFit: 'contain', marginBottom: '1rem' }} />
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 1rem', lineHeight: 1.1 }}>
            Ready to <span style={{ color: 'var(--yjrl-gold)' }}>Play?</span>
          </h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--yjrl-muted)', lineHeight: 1.7, margin: '0 0 2.5rem', maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
            Join the Yeppoon Seagulls family. All ages and skill levels welcome — from your first game of Mini Mod to chasing a QRL premiership.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="yjrl-btn yjrl-btn-primary yjrl-btn-lg">
              Register Now <ArrowRight size={18} />
            </Link>
            <a href="mailto:info@yepponjrl.com.au" className="yjrl-btn yjrl-btn-secondary yjrl-btn-lg">
              Contact Us
            </a>
          </div>
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginTop: '2.5rem', flexWrap: 'wrap' }}>
            {[
              ['📍', 'Nev Skuse Oval, Yeppoon QLD'],
              ['📞', '(07) 4939 XXXX'],
              ['✉️', 'info@yepponjrl.com.au']
            ].map(([icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', color: 'var(--yjrl-muted)' }}>
                <span>{icon}</span> {text}
              </div>
            ))}
          </div>
        </div>
      </section>
    </YJRLLayout>
  );
};

export default YJRLHome;
