import React, { useState, useEffect } from 'react';
import {
  Users, Calendar, CheckCircle, Clipboard, Star, Plus, Edit,
  Save, Award, MessageSquare, BarChart3, X, LogIn
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import YJRLLayout from './YJRLLayout';
import YJRLChat from './YJRLChat';
import './yjrl.css';

const POSITIONS = ['Fullback', 'Wing', 'Centre', 'Five-Eighth', 'Halfback', 'Hooker', 'Prop', 'Lock', 'Second-Row', 'Interchange'];


const AttendanceRate = ({ records }) => {
  if (!records?.length) return <span style={{ color: 'var(--yjrl-muted)' }}>—</span>;
  const pct = Math.round(records.filter(r => r.attended).length / records.length * 100);
  const color = pct >= 80 ? '#4ade80' : pct >= 60 ? 'var(--yjrl-gold)' : '#f87171';
  return <span style={{ color, fontWeight: 700 }}>{pct}%</span>;
};

const YJRLCoachPortal = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('roster');
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceType, setAttendanceType] = useState('training');
  const [attendanceMap, setAttendanceMap] = useState({});
  const [lineupModal, setLineupModal] = useState(false);
  const [lineup, setLineup] = useState({});
  const [notePlayer, setNotePlayer] = useState(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api.get('/yjrl/my-team').then(res => {
      setTeam(res.data.team);
      setPlayers(res.data.players || []);
      return api.get(`/yjrl/fixtures?teamId=${res.data.team._id}&upcoming=true&limit=5`);
    }).then(res => {
      if (res && Array.isArray(res.data)) setUpcoming(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    const init = {};
    players.forEach(p => { init[p._id] = true; });
    setAttendanceMap(init);
  }, [players]);

  const season = new Date().getFullYear().toString();

  const submitAttendance = async () => {
    const records = players.map(p => ({ playerId: p._id, attended: attendanceMap[p._id] ?? true }));
    try {
      await api.post(`/yjrl/teams/${team._id}/attendance`, { date: attendanceDate, type: attendanceType, records });
      toast.success('Attendance saved!');
    } catch (e) {
      toast.error('Failed to save attendance');
    }
  };

  const saveNote = async () => {
    if (!notePlayer) return;
    try {
      await api.put(`/yjrl/players/${notePlayer._id}`, { coachNotes: noteText });
      toast.success('Note saved!');
    } catch (e) { toast.error('Failed to save note'); }
    setNotePlayer(null);
    setNoteText('');
  };

  return (
    <YJRLLayout>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #172554, #1d4ed8)', color: 'white', padding: '3rem 1.5rem 0', borderBottom: '1px solid var(--yjrl-border)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          {!user && (
            <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '10px', padding: '0.875rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.875rem', color: '#4ade80' }}>
                <LogIn size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Viewing coach portal in demo mode. Sign in to manage your team.
              </span>
              <Link to="/login" className="yjrl-btn yjrl-btn-primary yjrl-btn-sm">Sign In</Link>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #4ade80, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🛡️</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, textTransform: 'uppercase' }}>Coach Portal</h1>
                <span className="yjrl-role-badge coach">Coach</span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>{team.name} · {team.wins}W {team.losses}L {team.draws}D</div>
            </div>
          </div>
          <div className="yjrl-tabs yjrl-tabs-dark">
            {[['roster', 'Roster'], ['attendance', 'Attendance'], ['lineup', 'Lineup'], ['notes', 'Dev Notes'], ['chat', '💬 Coaches Chat']].map(([k, l]) => (
              <button key={k} className={`yjrl-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* ── ROSTER ── */}
        {tab === 'roster' && (
          <div className="yjrl-card">
            <div className="yjrl-card-header">
              <div className="yjrl-card-title"><Users size={16} /> Player Roster ({players.length})</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="yjrl-table">
                <thead>
                  <tr>
                    <th>#</th><th>Player</th><th>Position</th><th>Games</th><th>Tries</th><th>Tackles</th><th>Attendance</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {players.map(p => {
                    const s = p.stats?.find(x => x.season === season) || p.stats?.[0] || {};
                    return (
                      <tr key={p._id}>
                        <td style={{ fontWeight: 800, color: 'var(--yjrl-gold)' }}>#{p.jerseyNumber}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div className="yjrl-player-avatar">{p.firstName[0]}{p.lastName[0]}</div>
                            <span style={{ fontWeight: 600 }}>{p.firstName} {p.lastName}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--yjrl-muted)' }}>{p.position}</td>
                        <td>{s.gamesPlayed || 0}</td>
                        <td style={{ color: 'var(--yjrl-gold)', fontWeight: 600 }}>{s.tries || 0}</td>
                        <td style={{ color: '#4ade80', fontWeight: 600 }}>{s.tackles || 0}</td>
                        <td><AttendanceRate records={p.attendanceRecords} /></td>
                        <td>
                          <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm"
                            onClick={() => { setNotePlayer(p); setNoteText(p.coachNotes || ''); setTab('notes'); }}>
                            Notes
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ATTENDANCE ── */}
        {tab === 'attendance' && (
          <div className="yjrl-card">
            <div className="yjrl-card-header">
              <div className="yjrl-card-title"><CheckCircle size={16} /> Record Attendance</div>
            </div>
            <div className="yjrl-card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', maxWidth: 480 }}>
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Date</label>
                  <input type="date" className="yjrl-input" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} />
                </div>
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Session Type</label>
                  <select className="yjrl-input" value={attendanceType} onChange={e => setAttendanceType(e.target.value)}>
                    <option value="training">Training</option>
                    <option value="game">Game</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {players.map(p => (
                  <div key={p._id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.75rem 1rem', borderRadius: '8px',
                    background: attendanceMap[p._id] ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.06)',
                    border: `1px solid ${attendanceMap[p._id] ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.15)'}`,
                    cursor: 'pointer', transition: 'all 0.15s'
                  }} onClick={() => setAttendanceMap(prev => ({ ...prev, [p._id]: !prev[p._id] }))}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="yjrl-player-avatar">{p.firstName[0]}{p.lastName[0]}</div>
                      <span style={{ fontWeight: 600 }}>{p.firstName} {p.lastName}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--yjrl-muted)' }}>#{p.jerseyNumber} · {p.position}</span>
                    </div>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: attendanceMap[p._id] ? '#4ade80' : '#f87171',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 900, fontSize: '0.9rem'
                    }}>
                      {attendanceMap[p._id] ? '✓' : '✗'}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--yjrl-muted)' }}>
                  {Object.values(attendanceMap).filter(Boolean).length}/{players.length} present
                </span>
                <button className="yjrl-btn yjrl-btn-primary" onClick={submitAttendance}>
                  <Save size={15} /> Save Attendance
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── LINEUP ── */}
        {tab === 'lineup' && (
          <div>
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' }}>
                {upcoming[0] ? `Round ${upcoming[0].round} vs ${upcoming[0].awayTeamName}` : 'Game-Day Lineup'}
              </h2>
              {upcoming[0] && (
                <div style={{ fontSize: '0.8rem', color: 'var(--yjrl-muted)' }}>
                  <Calendar size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  {new Date(upcoming[0].date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* Field positions */}
              <div className="yjrl-card">
                <div className="yjrl-card-header"><div className="yjrl-card-title"><Clipboard size={16} /> Starting 13</div></div>
                <div className="yjrl-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {POSITIONS.slice(0, 10).map(pos => (
                    <div key={pos} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ minWidth: 120, fontSize: '0.8rem', color: 'var(--yjrl-muted)', fontWeight: 600 }}>{pos}</div>
                      <select
                        className="yjrl-input"
                        value={lineup[pos] || ''}
                        onChange={e => setLineup(prev => ({ ...prev, [pos]: e.target.value }))}
                        style={{ flex: 1, padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                      >
                        <option value="">— Select Player —</option>
                        {players.map(p => <option key={p._id} value={p._id}>#{p.jerseyNumber} {p.firstName} {p.lastName}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Player availability */}
              <div className="yjrl-card">
                <div className="yjrl-card-header"><div className="yjrl-card-title"><Users size={16} /> Player Availability</div></div>
                <div className="yjrl-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {players.map(p => {
                    const isSelected = Object.values(lineup).includes(p._id);
                    return (
                      <div key={p._id} style={{
                        display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem',
                        borderRadius: '8px', background: isSelected ? 'rgba(74,222,128,0.08)' : 'transparent',
                        border: `1px solid ${isSelected ? 'rgba(74,222,128,0.2)' : 'transparent'}`
                      }}>
                        <div className="yjrl-player-avatar">{p.firstName[0]}{p.lastName[0]}</div>
                        <span style={{ fontWeight: 600, flex: 1, fontSize: '0.875rem' }}>{p.firstName} {p.lastName}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--yjrl-muted)' }}>{p.position}</span>
                        {isSelected && <span style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: 700 }}>Selected</span>}
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--yjrl-border)' }}>
                  <button className="yjrl-btn yjrl-btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => toast.success('Lineup saved!')}>
                    <Save size={15} /> Save Lineup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── NOTES ── */}
        {tab === 'notes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {players.map(p => (
              <div key={p._id} className="yjrl-card">
                <div className="yjrl-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="yjrl-player-avatar">{p.firstName[0]}{p.lastName[0]}</div>
                    <div className="yjrl-card-title">{p.firstName} {p.lastName}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--yjrl-muted)' }}>#{p.jerseyNumber} · {p.position}</span>
                  </div>
                </div>
                <div className="yjrl-card-body">
                  {notePlayer?._id === p._id ? (
                    <div>
                      <textarea
                        className="yjrl-input"
                        rows={3}
                        style={{ resize: 'vertical' }}
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        placeholder={`Development notes for ${p.firstName}...`}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button className="yjrl-btn yjrl-btn-primary yjrl-btn-sm" onClick={saveNote}>
                          <Save size={13} /> Save
                        </button>
                        <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" onClick={() => setNotePlayer(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                      <p style={{ color: p.coachNotes ? 'var(--yjrl-text)' : 'var(--yjrl-muted)', fontSize: '0.9rem', margin: 0, fontStyle: p.coachNotes ? 'normal' : 'italic', lineHeight: 1.6 }}>
                        {p.coachNotes || 'No notes yet.'}
                      </p>
                      <button
                        className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm"
                        onClick={() => { setNotePlayer(p); setNoteText(p.coachNotes || ''); }}
                      >
                        <Edit size={13} /> Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {/* ── COACHES CHAT ── */}
        {tab === 'chat' && (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                📋 Coaching staff discussion — all age groups
              </div>
            </div>
            <YJRLChat
              theme="coach"
              roomName="Coaches Room"
              teamName="All Yeppoon JRL Coaches"
              userName={user?.firstName || 'Coach'}
              onlineCount={3}
            />
          </div>
        )}
      </div>
    </YJRLLayout>
  );
};

export default YJRLCoachPortal;
