import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, Star, Trophy, TrendingUp, Calendar, Shield, Target,
  Award, Users, CheckCircle, Clock, MapPin, BarChart3, LogIn
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import toast from 'react-hot-toast';
import YJRLLayout from './YJRLLayout';
import YJRLChat from './YJRLChat';
import './yjrl.css';

const RARITY_COLORS = { common: '#94a3b8', rare: '#60a5fa', epic: '#c084fc', legendary: '#f0a500' };
const RARITY_GLOW = { common: 'none', rare: '0 0 12px rgba(96,165,250,0.3)', epic: '0 0 12px rgba(192,132,252,0.3)', legendary: '0 0 18px rgba(240,165,0,0.4)' };


const PATHWAY_LEVELS = [
  { key: 'grassroots', label: 'Grassroots', color: '#94a3b8', icon: '🌱' },
  { key: 'development', label: 'Development', color: '#60a5fa', icon: '📈' },
  { key: 'rep', label: 'Representative', color: '#a78bfa', icon: '🏅' },
  { key: 'pathways', label: 'QRL Pathways', color: '#f59e0b', icon: '⭐' },
  { key: 'elite', label: 'Elite', color: '#f0a500', icon: '👑' },
];

const XPBar = ({ current, max }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>
      <span>{current} XP</span><span>{max} XP to next level</span>
    </div>
    <div className="yjrl-xp-bar"><div className="yjrl-xp-fill" style={{ width: `${Math.min((current / max) * 100, 100)}%` }} /></div>
  </div>
);

const AttendanceHistory = ({ records }) => {
  const recent = records.slice(-20);
  return (
    <div className="yjrl-attendance-dots">
      {recent.map((r, i) => (
        <div
          key={i}
          className={`yjrl-dot ${r.attended ? 'present' : 'absent'}`}
          title={`${r.type} — ${new Date(r.date).toLocaleDateString('en-AU')} — ${r.attended ? '✓ Present' : '✗ Absent'}`}
        />
      ))}
    </div>
  );
};

const StatCard = ({ icon: Icon, value, label, color }) => (
  <div className="yjrl-stat-card">
    <div className="yjrl-stat-icon" style={{ color }}><Icon size={20} /></div>
    <span className="yjrl-stat-value" style={{ color }}>{value}</span>
    <span className="yjrl-stat-label">{label}</span>
  </div>
);

const YJRLPlayerPortal = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [player, setPlayer] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      api.get('/yjrl/my-player').catch(() => ({ data: null })),
      api.get('/yjrl/achievements').catch(() => ({ data: [] })),
      api.get('/yjrl/fixtures?upcoming=true&limit=5').catch(() => ({ data: [] }))
    ]).then(([pRes, aRes, fRes]) => {
      if (pRes.data && typeof pRes.data === 'object' && pRes.data._id) setPlayer(pRes.data);
      if (Array.isArray(aRes.data)) setAchievements(aRes.data);
      if (Array.isArray(fRes.data)) setUpcoming(fRes.data);
    }).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <YJRLLayout><div className="yjrl-loading"><div className="yjrl-spinner" /><span>Loading your profile...</span></div></YJRLLayout>;

  if (user && !player) return <YJRLLayout><div style={{ maxWidth: 1280, margin: '0 auto', padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--yjrl-muted)' }}><p>No player profile found. Contact your club admin to be registered.</p></div></YJRLLayout>;

  const p = player || {};
  const season = new Date().getFullYear().toString();
  const stats = p.stats?.find(s => s.season === season) || p.stats?.[0] || {};
  const earnedIds = new Set((p.achievementDates || []).map(a => a.achievement?._id || a.achievement));
  const xp = (p.achievementDates || []).reduce((sum, a) => sum + (a.achievement?.xpValue || 0), 0);
  const attendanceRate = p.attendanceRecords?.length
    ? Math.round((p.attendanceRecords.filter(r => r.attended).length / p.attendanceRecords.length) * 100)
    : 100;
  const pathwayIdx = PATHWAY_LEVELS.findIndex(l => l.key === p.pathwayProgress?.level);

  return (
    <YJRLLayout>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #172554, #1d4ed8)', color: 'white', padding: '3rem 1.5rem 0', borderBottom: '1px solid var(--yjrl-border)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          {!user && (
            <div style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', padding: '0.875rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'white' }}>
                <LogIn size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                You're viewing a demo profile. Sign in to see your real stats, badges and schedule.
              </span>
              <Link to="/login" className="yjrl-btn yjrl-btn-primary yjrl-btn-sm">Sign In</Link>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', paddingBottom: '1.5rem', flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--yjrl-gold), #d4840a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.75rem', fontWeight: 900, color: 'var(--yjrl-navy)',
              border: '3px solid var(--yjrl-gold)', flexShrink: 0,
              boxShadow: 'var(--yjrl-glow-gold)'
            }}>
              {p.jerseyNumber || p.firstName?.[0]}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, margin: 0, textTransform: 'uppercase' }}>
                  {p.firstName} {p.lastName}
                </h1>
                <span className="yjrl-role-badge player">Player</span>
                {p.registrationStatus === 'active' && (
                  <span style={{ fontSize: '0.7rem', background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)', padding: '0.2rem 0.6rem', borderRadius: '100px', fontWeight: 700 }}>
                    ✓ Registered
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                  <strong style={{ color: '#fbbf24' }}>#{p.jerseyNumber}</strong> · {p.position}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                  <strong style={{ color: 'white' }}>{p.ageGroup}</strong> · {p.teamId?.name || 'Yeppoon Seagulls'}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                  <strong style={{ color: '#fbbf24' }}>{xp}</strong> XP · Level {Math.floor(xp / 50) + 1}
                </span>
              </div>
              <div style={{ marginTop: '0.75rem', maxWidth: 320 }}>
                <XPBar current={xp % 50} max={50} />
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>Pathway</div>
              <div style={{ display: 'flex', align: 'center', gap: '0.3rem' }}>
                {PATHWAY_LEVELS.map((lvl, idx) => (
                  <div
                    key={lvl.key}
                    title={lvl.label}
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: idx <= pathwayIdx ? lvl.color : 'rgba(255,255,255,0.07)',
                      border: `2px solid ${idx <= pathwayIdx ? lvl.color : 'transparent'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.8rem', opacity: idx <= pathwayIdx ? 1 : 0.3
                    }}
                  >
                    {idx <= pathwayIdx ? lvl.icon : '·'}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '0.75rem', color: PATHWAY_LEVELS[pathwayIdx]?.color || 'var(--yjrl-gold)', fontWeight: 700, marginTop: '0.3rem' }}>
                {PATHWAY_LEVELS[pathwayIdx]?.label || 'Grassroots'}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="yjrl-tabs yjrl-tabs-dark">
            {[['overview', 'Overview'], ['stats', 'Stats'], ['badges', 'My Badges'], ['chat', '💬 Team Chat'], ['schedule', 'Schedule'], ['attendance', 'Attendance']].map(([k, l]) => (
              <button key={k} className={`yjrl-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Left */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Season Stats */}
              <div className="yjrl-card">
                <div className="yjrl-card-header">
                  <div className="yjrl-card-title"><BarChart3 size={16} /> 2026 Season Stats</div>
                </div>
                <div className="yjrl-card-body">
                  <div className="yjrl-grid-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <StatCard icon={TrendingUp} value={stats.gamesPlayed || 0} label="Games" color="#60a5fa" />
                    <StatCard icon={Zap} value={stats.tries || 0} label="Tries" color="var(--yjrl-gold)" />
                    <StatCard icon={Target} value={stats.tackles || 0} label="Tackles" color="#4ade80" />
                    <StatCard icon={Star} value={stats.goals || 0} label="Goals" color="#f472b6" />
                    <StatCard icon={TrendingUp} value={`${stats.runMetres || 0}m`} label="Run Metres" color="#a78bfa" />
                    <StatCard icon={Award} value={stats.manOfMatch || 0} label="MOM Awards" color="var(--yjrl-gold)" />
                  </div>
                </div>
              </div>

              {/* Training Schedule */}
              <div className="yjrl-card">
                <div className="yjrl-card-header">
                  <div className="yjrl-card-title"><Calendar size={16} /> Training Schedule</div>
                </div>
                <div className="yjrl-card-body">
                  {p.teamId ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(240,165,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--yjrl-gold)' }}>
                          <Calendar size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.teamId.trainingDay || 'Tuesday & Thursday'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--yjrl-muted)' }}>{p.teamId.trainingTime || '5:00 PM'}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(240,165,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--yjrl-gold)' }}>
                          <MapPin size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.teamId.trainingVenue || 'Nev Skuse Oval'}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--yjrl-muted)' }}>Training Ground</div>
                        </div>
                      </div>
                      {p.teamId.coachName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(74,222,128,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80' }}>
                            <Shield size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.teamId.coachName}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--yjrl-muted)' }}>Head Coach</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--yjrl-muted)', fontSize: '0.9rem' }}>Contact admin to be assigned to a team.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Attendance */}
              <div className="yjrl-card">
                <div className="yjrl-card-header">
                  <div className="yjrl-card-title"><CheckCircle size={16} /> Attendance</div>
                  <span style={{ fontSize: '1.25rem', fontWeight: 900, color: attendanceRate >= 80 ? '#4ade80' : attendanceRate >= 60 ? 'var(--yjrl-gold)' : '#f87171' }}>
                    {attendanceRate}%
                  </span>
                </div>
                <div className="yjrl-card-body">
                  <AttendanceHistory records={p.attendanceRecords || []} />
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--yjrl-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span className="yjrl-dot present" style={{ width: 8, height: 8 }} /> Present</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span className="yjrl-dot absent" style={{ width: 8, height: 8 }} /> Absent</span>
                  </div>
                </div>
              </div>

              {/* Earned Badges */}
              <div className="yjrl-card">
                <div className="yjrl-card-header">
                  <div className="yjrl-card-title"><Award size={16} /> Earned Badges</div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--yjrl-muted)' }}>{(p.achievementDates || []).length}/{achievements.length}</span>
                </div>
                <div className="yjrl-card-body">
                  {p.achievementDates?.length ? (
                    <div className="yjrl-badge-grid">
                      {p.achievementDates.map((ad, i) => {
                        const ach = ad.achievement;
                        if (!ach) return null;
                        return (
                          <div key={i} className={`yjrl-achievement-badge ${ach.rarity}`} title={ach.description}
                            style={{ boxShadow: RARITY_GLOW[ach.rarity] }}>
                            <span className="icon">{ach.icon}</span>
                            <span className="name" style={{ color: RARITY_COLORS[ach.rarity] }}>{ach.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--yjrl-muted)', fontSize: '0.875rem' }}>No badges yet — keep playing to earn your first!</p>
                  )}
                  <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" style={{ marginTop: '1rem' }} onClick={() => setTab('badges')}>
                    View All Badges
                  </button>
                </div>
              </div>

              {/* Next Game */}
              {upcoming[0] && (
                <div className="yjrl-card">
                  <div className="yjrl-card-header">
                    <div className="yjrl-card-title"><Calendar size={16} /> Next Game</div>
                    <span style={{ fontSize: '0.7rem', background: 'rgba(96,165,250,0.1)', color: '#60a5fa', padding: '0.2rem 0.6rem', borderRadius: '100px', fontWeight: 700, border: '1px solid rgba(96,165,250,0.2)' }}>
                      Round {upcoming[0].round}
                    </span>
                  </div>
                  <div className="yjrl-card-body">
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.75rem', textAlign: 'center' }}>
                      {upcoming[0].homeTeamName} <span style={{ color: 'var(--yjrl-gold)' }}>vs</span> {upcoming[0].awayTeamName}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--yjrl-muted)' }}>
                        <Calendar size={13} />
                        {new Date(upcoming[0].date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
                        {upcoming[0].time && ` at ${upcoming[0].time}`}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--yjrl-muted)' }}>
                        <MapPin size={13} /> {upcoming[0].venue}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STATS ── */}
        {tab === 'stats' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="yjrl-card">
              <div className="yjrl-card-header"><div className="yjrl-card-title"><BarChart3 size={16} /> Season Statistics</div></div>
              <div className="yjrl-card-body">
                <div className="yjrl-grid-4">
                  <StatCard icon={TrendingUp} value={stats.gamesPlayed || 0} label="Games Played" color="#60a5fa" />
                  <StatCard icon={Zap} value={stats.tries || 0} label="Tries Scored" color="var(--yjrl-gold)" />
                  <StatCard icon={Star} value={stats.goals || 0} label="Goals Kicked" color="#4ade80" />
                  <StatCard icon={Target} value={stats.fieldGoals || 0} label="Field Goals" color="#f472b6" />
                  <StatCard icon={Shield} value={stats.tackles || 0} label="Tackles Made" color="#a78bfa" />
                  <StatCard icon={TrendingUp} value={`${stats.runMetres || 0}m`} label="Run Metres" color="#38bdf8" />
                  <StatCard icon={Award} value={stats.manOfMatch || 0} label="Man of Match" color="var(--yjrl-gold)" />
                  <StatCard icon={Trophy} value={Math.round((stats.tries || 0) + (stats.goals || 0) * 0.5)} label="Points Contrib." color="#fb923c" />
                </div>
              </div>
            </div>

            {/* Career History */}
            <div className="yjrl-card">
              <div className="yjrl-card-header"><div className="yjrl-card-title">Career History</div></div>
              <table className="yjrl-table">
                <thead>
                  <tr>
                    <th>Season</th><th>Games</th><th>Tries</th><th>Goals</th><th>Tackles</th><th>Run Metres</th><th>MOM</th>
                  </tr>
                </thead>
                <tbody>
                  {(p.stats || [stats]).map((s, i) => (
                    <tr key={i} style={s.season === season ? { background: 'rgba(240,165,0,0.05)' } : {}}>
                      <td style={{ fontWeight: s.season === season ? 700 : 400, color: s.season === season ? 'var(--yjrl-gold)' : 'inherit' }}>
                        {s.season} {s.season === season && '★'}
                      </td>
                      <td>{s.gamesPlayed}</td>
                      <td style={{ color: 'var(--yjrl-gold)', fontWeight: 600 }}>{s.tries}</td>
                      <td>{s.goals}</td>
                      <td style={{ color: '#4ade80', fontWeight: 600 }}>{s.tackles}</td>
                      <td>{s.runMetres}m</td>
                      <td>{s.manOfMatch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── BADGES ── */}
        {tab === 'badges' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="yjrl-card">
              <div className="yjrl-card-header">
                <div className="yjrl-card-title"><Award size={16} /> Achievement Showcase</div>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem' }}>
                  {Object.entries(RARITY_COLORS).map(([r, c]) => (
                    <span key={r} style={{ color: c, textTransform: 'capitalize', fontWeight: 600 }}>{r}</span>
                  ))}
                </div>
              </div>
              <div className="yjrl-card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' }}>
                  {achievements.map(ach => {
                    const earned = earnedIds.has(ach._id);
                    const earnedDate = p.achievementDates?.find(a => (a.achievement?._id || a.achievement) === ach._id);
                    return (
                      <div
                        key={ach._id}
                        style={{
                          background: earned ? `rgba(${ach.rarity === 'legendary' ? '240,165,0' : ach.rarity === 'epic' ? '168,85,247' : ach.rarity === 'rare' ? '59,130,246' : '148,163,184'}, 0.12)` : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${earned ? RARITY_COLORS[ach.rarity] + '50' : 'rgba(255,255,255,0.07)'}`,
                          borderRadius: '12px',
                          padding: '1rem',
                          textAlign: 'center',
                          opacity: earned ? 1 : 0.4,
                          filter: earned ? 'none' : 'grayscale(1)',
                          boxShadow: earned ? RARITY_GLOW[ach.rarity] : 'none',
                          transition: 'all 0.2s',
                          cursor: 'default'
                        }}
                      >
                        <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>{ach.icon}</div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.25rem', color: earned ? RARITY_COLORS[ach.rarity] : 'var(--yjrl-muted)' }}>{ach.name}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--yjrl-muted)', lineHeight: 1.4 }}>{ach.description}</div>
                        {earned && <div style={{ fontSize: '0.65rem', color: 'var(--yjrl-gold)', marginTop: '0.4rem', fontWeight: 600 }}>+{ach.xpValue} XP</div>}
                        {earned && earnedDate && (
                          <div style={{ fontSize: '0.6rem', color: 'var(--yjrl-muted)', marginTop: '0.2rem' }}>
                            {new Date(earnedDate.date).toLocaleDateString('en-AU')}
                          </div>
                        )}
                        {!earned && <div style={{ fontSize: '0.65rem', color: 'var(--yjrl-muted)', marginTop: '0.4rem' }}>🔒 Locked</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SCHEDULE ── */}
        {tab === 'schedule' && (
          <div>
            <div className="yjrl-card">
              <div className="yjrl-card-header"><div className="yjrl-card-title"><Calendar size={16} /> Upcoming Games</div></div>
              {upcoming.length ? upcoming.map(f => (
                <div key={f._id} style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--yjrl-border)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 48, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--yjrl-gold)', fontWeight: 700, textTransform: 'uppercase' }}>Rnd {f.round}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{f.homeTeamName} vs {f.awayTeamName}</div>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--yjrl-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Calendar size={11} />
                        {new Date(f.date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {f.time && ` · ${f.time}`}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <MapPin size={11} /> {f.venue}
                      </span>
                    </div>
                  </div>
                </div>
              )) : (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--yjrl-muted)' }}>No upcoming games scheduled.</div>
              )}
            </div>
          </div>
        )}

        {/* ── ATTENDANCE ── */}
        {tab === 'attendance' && (
          <div className="yjrl-card">
            <div className="yjrl-card-header">
              <div className="yjrl-card-title"><CheckCircle size={16} /> Attendance Record</div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#4ade80' }}>{attendanceRate}%</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--yjrl-muted)' }}>Overall</div>
                </div>
              </div>
            </div>
            <div className="yjrl-card-body">
              {(p.attendanceRecords || []).length === 0 ? (
                <p style={{ color: 'var(--yjrl-muted)' }}>No attendance records yet.</p>
              ) : (
                <table className="yjrl-table">
                  <thead>
                    <tr><th>Date</th><th>Type</th><th>Status</th><th>Notes</th></tr>
                  </thead>
                  <tbody>
                    {[...p.attendanceRecords].reverse().map((r, i) => (
                      <tr key={i}>
                        <td>{new Date(r.date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                        <td style={{ textTransform: 'capitalize' }}>{r.type}</td>
                        <td>
                          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '100px', fontWeight: 700, background: r.attended ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: r.attended ? '#4ade80' : '#f87171', border: `1px solid ${r.attended ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}` }}>
                            {r.attended ? '✓ Present' : '✗ Absent'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--yjrl-muted)', fontSize: '0.85rem' }}>{r.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        {/* ── TEAM CHAT ── */}
        {tab === 'chat' && (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', background: '#f0f7ff', border: '1px solid #dbeafe', borderRadius: '10px', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                🦅 Chat with your {p.teamId?.name || 'team'} teammates!
              </div>
            </div>
            <YJRLChat
              theme="player"
              roomName="Team Chat"
              teamName={p.teamId?.name || 'Yeppoon Seagulls'}
              userName={p.firstName || 'Player'}
              onlineCount={5}
            />
          </div>
        )}
      </div>
    </YJRLLayout>
  );
};

export default YJRLPlayerPortal;
