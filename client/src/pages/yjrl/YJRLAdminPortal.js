import React, { useState, useEffect } from 'react';
import {
  Users, Trophy, Calendar, Newspaper, Plus, Edit, Trash2, Save,
  BarChart3, Shield, Bell, Settings, DollarSign, X, CheckCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import YJRLLayout from './YJRLLayout';
import './yjrl.css';

const SEASON = new Date().getFullYear().toString();

const EMPTY_TEAM = { name: '', ageGroup: 'U14', division: '', season: SEASON, coachName: '', managerName: '', trainingDay: '', trainingTime: '', trainingVenue: 'Nev Skuse Oval' };
const EMPTY_FIXTURE = { ageGroup: 'U14', round: 1, homeTeamName: 'Yeppoon Seagulls', awayTeamName: '', date: '', time: '', venue: 'Nev Skuse Oval', status: 'scheduled', isHomeGame: true, season: SEASON };
const EMPTY_NEWS = { title: '', content: '', excerpt: '', category: 'news', published: false, featured: false };

const AGE_GROUPS = ['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'Womens', 'Mens'];

// Demo overview stats
const DEMO_STATS = { teamCount: 14, playerCount: 280, fixtureCount: 42, upcomingCount: 8 };
const DEMO_TEAMS = [
  { _id: 't1', ageGroup: 'U14', name: 'Yeppoon Seagulls U14', coachName: 'Mike Thompson', wins: 4, losses: 1, draws: 0, players: [] },
  { _id: 't2', ageGroup: 'U12', name: 'Yeppoon Seagulls U12', coachName: 'Sarah Johnson', wins: 3, losses: 2, draws: 0, players: [] },
  { _id: 't3', ageGroup: 'U16', name: 'Yeppoon Seagulls U16', coachName: 'Dave Williams', wins: 5, losses: 0, draws: 0, players: [] },
];
const DEMO_NEWS = [
  { _id: 'n1', title: 'Season 2026 Registration Open', category: 'news', published: true, featured: true, views: 241, publishDate: new Date('2026-01-15') },
  { _id: 'n2', title: 'U14s Grand Final Victory!', category: 'results', published: true, featured: false, views: 583, publishDate: new Date('2025-09-20') },
];

const YJRLAdminPortal = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(DEMO_STATS);
  const [teams, setTeams] = useState(DEMO_TEAMS);
  const [news, setNews] = useState(DEMO_NEWS);
  const [loading, setLoading] = useState(false);
  const [teamModal, setTeamModal] = useState(false);
  const [teamForm, setTeamForm] = useState(EMPTY_TEAM);
  const [newsModal, setNewsModal] = useState(false);
  const [newsForm, setNewsForm] = useState(EMPTY_NEWS);
  const [editingNews, setEditingNews] = useState(null);

  const isAdmin = user && (user.role === 'admin' || user.role === 'dev');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/yjrl/stats/overview?season=${SEASON}`).catch(() => ({ data: null })),
      api.get(`/yjrl/teams?season=${SEASON}`).catch(() => ({ data: [] })),
      api.get('/news/all').catch(() => ({ data: [] })),
    ]).then(([sRes, tRes, nRes]) => {
      if (sRes.data && typeof sRes.data === 'object' && !Array.isArray(sRes.data)) setStats(sRes.data);
      if (Array.isArray(tRes.data) && tRes.data.length) setTeams(tRes.data);
      if (Array.isArray(nRes.data) && nRes.data.length) setNews(nRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const saveTeam = async () => {
    if (isAdmin) {
      try {
        const res = await api.post('/teams', teamForm);
        setTeams(prev => [...prev, res.data]);
        toast.success('Team created!');
      } catch (e) { toast.error('Failed to create team'); return; }
    } else {
      setTeams(prev => [...prev, { ...teamForm, _id: Date.now().toString(), wins: 0, losses: 0, draws: 0, players: [] }]);
      toast.success('Demo: Team added!');
    }
    setTeamModal(false);
    setTeamForm(EMPTY_TEAM);
  };

  const deleteTeam = async (id) => {
    if (isAdmin) {
      try { await api.delete(`/yjrl/teams/${id}`); } catch (e) { toast.error('Failed'); return; }
    }
    setTeams(prev => prev.filter(t => t._id !== id));
    toast.success('Team removed');
  };

  const saveNews = async () => {
    if (isAdmin) {
      try {
        if (editingNews) {
          const res = await api.put(`/yjrl/news/${editingNews}`, newsForm);
          setNews(prev => prev.map(n => n._id === editingNews ? res.data : n));
        } else {
          const res = await api.post('/news', newsForm);
          setNews(prev => [res.data, ...prev]);
        }
        toast.success(editingNews ? 'Article updated!' : 'Article created!');
      } catch (e) { toast.error('Failed'); return; }
    } else {
      const article = { ...newsForm, _id: editingNews || Date.now().toString(), views: 0, publishDate: new Date() };
      if (editingNews) setNews(prev => prev.map(n => n._id === editingNews ? article : n));
      else setNews(prev => [article, ...prev]);
      toast.success(editingNews ? 'Demo: Article updated!' : 'Demo: Article created!');
    }
    setNewsModal(false);
    setNewsForm(EMPTY_NEWS);
    setEditingNews(null);
  };

  const deleteNews = async (id) => {
    if (isAdmin) {
      try { await api.delete(`/yjrl/news/${id}`); } catch (e) { toast.error('Failed'); return; }
    }
    setNews(prev => prev.filter(n => n._id !== id));
    toast.success('Article removed');
  };

  const openEditNews = (article) => {
    setEditingNews(article._id);
    setNewsForm({ title: article.title, content: article.content, excerpt: article.excerpt, category: article.category, published: article.published, featured: article.featured });
    setNewsModal(true);
  };

  return (
    <YJRLLayout>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #172554, #1d4ed8)', color: 'white', padding: '3rem 1.5rem 0', borderBottom: '1px solid var(--yjrl-border)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          {!isAdmin && (
            <div style={{ background: 'rgba(240,165,0,0.08)', border: '1px solid rgba(240,165,0,0.2)', borderRadius: '10px', padding: '0.875rem 1.25rem', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--yjrl-gold)' }}>
                ⚠️ You need admin access to save changes. Currently in demo/view mode.
              </span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, var(--yjrl-gold), #d4840a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>🏆</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, textTransform: 'uppercase' }}>Club Admin</h1>
                <span className="yjrl-role-badge admin">Admin</span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>Yeppoon Junior Rugby League · {SEASON} Season</div>
            </div>
          </div>
          <div className="yjrl-tabs yjrl-tabs-dark">
            {[['overview', 'Overview'], ['teams', 'Teams'], ['fixtures', 'Fixtures'], ['news', 'News'], ['players', 'Players'], ['moderation', '🛡️ Chat Moderation']].map(([k, l]) => (
              <button key={k} className={`yjrl-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Stats cards */}
            <div className="yjrl-grid-4">
              {[
                { icon: Users, value: stats.teamCount, label: 'Active Teams', color: '#60a5fa' },
                { icon: Trophy, value: stats.playerCount, label: 'Registered Players', color: 'var(--yjrl-gold)' },
                { icon: CheckCircle, value: stats.fixtureCount, label: 'Games Played', color: '#4ade80' },
                { icon: Calendar, value: stats.upcomingCount, label: 'Upcoming Games', color: '#a78bfa' },
              ].map((item, i) => (
                <div key={i} className="yjrl-stat-card">
                  <div className="yjrl-stat-icon" style={{ color: item.color }}><item.icon size={20} /></div>
                  <span className="yjrl-stat-value" style={{ color: item.color }}>{item.value}</span>
                  <span className="yjrl-stat-label">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {[
                { icon: Plus, label: 'Create Team', onClick: () => { setTeamModal(true); setTab('teams'); }, color: '#60a5fa' },
                { icon: Plus, label: 'Add Fixture', onClick: () => setTab('fixtures'), color: 'var(--yjrl-gold)' },
                { icon: Plus, label: 'Write News', onClick: () => { setNewsModal(true); setTab('news'); }, color: '#4ade80' },
                { icon: Bell, label: 'Send Notification', onClick: () => toast.success('Demo: Notification sent to all members!'), color: '#f472b6' },
              ].map((action, i) => (
                <button
                  key={i}
                  onClick={action.onClick}
                  style={{ padding: '1.25rem', borderRadius: '12px', background: `${action.color}15`, border: `1px solid ${action.color}30`, color: action.color, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.15s' }}
                >
                  <action.icon size={18} /> {action.label}
                </button>
              ))}
            </div>

            {/* Top scorers */}
            {stats.topScorers?.length > 0 && (
              <div className="yjrl-card">
                <div className="yjrl-card-header"><div className="yjrl-card-title"><Trophy size={16} /> Top Try Scorers — {SEASON}</div></div>
                <table className="yjrl-table">
                  <thead><tr><th>#</th><th>Player</th><th>Team</th><th>Tries</th></tr></thead>
                  <tbody>
                    {stats.topScorers.map((p, i) => (
                      <tr key={p._id}>
                        <td style={{ fontWeight: 800, color: i === 0 ? 'var(--yjrl-gold)' : 'var(--yjrl-muted)' }}>{i + 1}</td>
                        <td><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="yjrl-player-avatar">{p.firstName[0]}{p.lastName[0]}</div>
                          {p.firstName} {p.lastName}
                        </div></td>
                        <td style={{ color: 'var(--yjrl-muted)' }}>{p.teamId?.name || p.ageGroup}</td>
                        <td style={{ color: 'var(--yjrl-gold)', fontWeight: 900, fontSize: '1.1rem' }}>{p.tries}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TEAMS ── */}
        {tab === 'teams' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase' }}>Teams ({teams.length})</h2>
              <button className="yjrl-btn yjrl-btn-primary" onClick={() => setTeamModal(true)}>
                <Plus size={15} /> Add Team
              </button>
            </div>

            <div className="yjrl-grid-3">
              {teams.map(team => (
                <div key={team._id} className="yjrl-card">
                  <div className="yjrl-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--yjrl-gold), #d4840a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--yjrl-navy)', fontSize: '0.8rem' }}>
                        {team.ageGroup.replace('U', '')}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{team.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--yjrl-muted)' }}>{team.ageGroup}</div>
                      </div>
                    </div>
                    <button onClick={() => deleteTeam(team._id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0.25rem' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="yjrl-card-body" style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.825rem', color: 'var(--yjrl-muted)' }}>
                      <span>Coach: <strong style={{ color: 'var(--yjrl-text)' }}>{team.coachName || '—'}</strong></span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                      <span style={{ color: '#4ade80', fontWeight: 700 }}>{team.wins}W</span>
                      <span style={{ color: 'var(--yjrl-muted)' }}>–</span>
                      <span style={{ color: '#f87171', fontWeight: 700 }}>{team.losses}L</span>
                      <span style={{ color: 'var(--yjrl-muted)' }}>–</span>
                      <span style={{ color: 'var(--yjrl-muted)' }}>{team.draws}D</span>
                      <span style={{ marginLeft: 'auto', color: 'var(--yjrl-muted)' }}>{team.players?.length || 0} players</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FIXTURES (admin view) ── */}
        {tab === 'fixtures' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase' }}>Manage Fixtures</h2>
              <button className="yjrl-btn yjrl-btn-primary" onClick={() => toast.success('Demo: Use the fixture form to add matches. Full implementation coming soon.')}>
                <Plus size={15} /> Add Fixture
              </button>
            </div>
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--yjrl-muted)' }}>
              <Calendar size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
              <p>Fixture management panel — add and manage all scheduled games here.</p>
              <p style={{ fontSize: '0.85rem' }}>Connect your PlayHQ integration or manually enter fixture data.</p>
            </div>
          </div>
        )}

        {/* ── NEWS MANAGEMENT ── */}
        {tab === 'news' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase' }}>News Articles ({news.length})</h2>
              <button className="yjrl-btn yjrl-btn-primary" onClick={() => { setNewsForm(EMPTY_NEWS); setEditingNews(null); setNewsModal(true); }}>
                <Plus size={15} /> Write Article
              </button>
            </div>
            <div className="yjrl-card">
              <table className="yjrl-table">
                <thead>
                  <tr><th>Title</th><th>Category</th><th>Status</th><th>Views</th><th>Date</th><th></th></tr>
                </thead>
                <tbody>
                  {news.map(article => (
                    <tr key={article._id}>
                      <td style={{ fontWeight: 600, maxWidth: 300 }}>{article.title}</td>
                      <td style={{ textTransform: 'capitalize' }}>
                        <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '100px', background: 'rgba(240,165,0,0.1)', color: 'var(--yjrl-gold)', fontWeight: 600 }}>
                          {article.category}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '100px', background: article.published ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.07)', color: article.published ? '#4ade80' : 'var(--yjrl-muted)', fontWeight: 600 }}>
                          {article.published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--yjrl-muted)' }}>{article.views || 0}</td>
                      <td style={{ color: 'var(--yjrl-muted)', fontSize: '0.8rem' }}>
                        {new Date(article.publishDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" onClick={() => openEditNews(article)}>
                            <Edit size={12} />
                          </button>
                          <button className="yjrl-btn yjrl-btn-danger yjrl-btn-sm" onClick={() => deleteNews(article._id)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {news.length === 0 && (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--yjrl-muted)' }}>
                  No articles yet. Write your first news post!
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PLAYERS ── */}
        {tab === 'players' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase' }}>Player Management</h2>
              <button className="yjrl-btn yjrl-btn-primary" onClick={() => toast.success('Demo: Player registration and management panel.')}>
                <Plus size={15} /> Add Player
              </button>
            </div>
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--yjrl-muted)' }}>
              <Users size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
              <p>Player management — view all registrations, update details, award achievements, and track participation.</p>
              <p style={{ fontSize: '0.85rem' }}>Sync with PlayHQ for automatic registration data.</p>
            </div>
          </div>
        )}

        {/* ── CHAT MODERATION ── */}
        {tab === 'moderation' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {[
                { label: 'Active Chat Rooms', value: '6', icon: '💬', color: '#3b82f6' },
                { label: 'Messages Today', value: '47', icon: '📨', color: '#10b981' },
                { label: 'Flagged Messages', value: '0', icon: '🚩', color: '#f59e0b' },
                { label: 'Active Users', value: '23', icon: '👥', color: '#8b5cf6' },
              ].map((s, i) => (
                <div key={i} className="yjrl-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>{s.icon}</span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>{s.label}</span>
                  </div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 900, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="yjrl-card">
              <div className="yjrl-card-header">
                <div className="yjrl-card-title"><Shield size={16} /> Chat Rooms</div>
              </div>
              <table className="yjrl-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Type</th>
                    <th>Members</th>
                    <th>Messages (24h)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { room: 'U14 Team Chat', type: 'Players', members: 18, msgs: 12, status: 'active' },
                    { room: 'U12 Team Chat', type: 'Players', members: 15, msgs: 8, status: 'active' },
                    { room: 'U10 Team Chat', type: 'Players', members: 14, msgs: 15, status: 'active' },
                    { room: 'U14 Parents', type: 'Parents', members: 24, msgs: 6, status: 'active' },
                    { room: 'U12 Parents', type: 'Parents', members: 20, msgs: 4, status: 'active' },
                    { room: 'Coaches Room', type: 'Coaches', members: 8, msgs: 2, status: 'active' },
                  ].map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{r.room}</td>
                      <td>
                        <span style={{
                          fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '100px', fontWeight: 600,
                          background: r.type === 'Players' ? '#dbeafe' : r.type === 'Parents' ? '#fef3c7' : '#d1fae5',
                          color: r.type === 'Players' ? '#1d4ed8' : r.type === 'Parents' ? '#92400e' : '#065f46'
                        }}>{r.type}</span>
                      </td>
                      <td>{r.members}</td>
                      <td>{r.msgs}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#10b981' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="yjrl-card" style={{ marginTop: '1.5rem' }}>
              <div className="yjrl-card-header">
                <div className="yjrl-card-title">🚩 Flagged Messages</div>
              </div>
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                <CheckCircle size={32} style={{ marginBottom: '0.5rem', color: '#10b981' }} />
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>All Clear</div>
                <div>No flagged messages. The auto-filter catches inappropriate content before it reaches the chat.</div>
              </div>
            </div>

            <div className="yjrl-card" style={{ marginTop: '1.5rem' }}>
              <div className="yjrl-card-header">
                <div className="yjrl-card-title">⚙️ Chat Settings</div>
              </div>
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { label: 'Auto-filter inappropriate language', desc: 'Blocks profanity and bullying language automatically', enabled: true },
                  { label: 'Player chat hours (7am – 8pm)', desc: 'Restricts when junior players can send messages', enabled: true },
                  { label: 'Link sharing disabled for players', desc: 'Prevents players from sharing external links', enabled: true },
                  { label: 'Image sharing', desc: 'Allow image uploads in chat (moderated)', enabled: false },
                ].map((setting, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.15rem' }}>{setting.label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{setting.desc}</div>
                    </div>
                    <div style={{
                      width: 44, height: 24, borderRadius: '100px', cursor: 'pointer',
                      background: setting.enabled ? '#1d4ed8' : '#cbd5e1',
                      position: 'relative', transition: 'background 0.2s'
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', background: 'white',
                        position: 'absolute', top: 3,
                        left: setting.enabled ? 23 : 3,
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── TEAM MODAL ── */}
      {teamModal && (
        <div className="yjrl-modal-overlay" onClick={() => setTeamModal(false)}>
          <div className="yjrl-modal" onClick={e => e.stopPropagation()}>
            <div className="yjrl-modal-header">
              <div className="yjrl-modal-title">Add New Team</div>
              <button onClick={() => setTeamModal(false)} style={{ background: 'none', border: 'none', color: 'var(--yjrl-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="yjrl-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {[
                  ['Team Name', 'name', 'text', 'e.g. Yeppoon Seagulls U14'],
                  ['Age Group', 'ageGroup', 'select', AGE_GROUPS],
                  ['Division', 'division', 'text', 'e.g. A Grade'],
                  ['Coach Name', 'coachName', 'text', ''],
                  ['Manager Name', 'managerName', 'text', ''],
                  ['Training Days', 'trainingDay', 'text', 'e.g. Tue & Thu'],
                  ['Training Time', 'trainingTime', 'text', 'e.g. 5:00 PM'],
                  ['Training Venue', 'trainingVenue', 'text', ''],
                ].map(([label, key, type, placeholder]) => (
                  <div key={key} className="yjrl-form-group" style={{ marginBottom: 0 }}>
                    <label className="yjrl-label">{label}</label>
                    {type === 'select' ? (
                      <select className="yjrl-input" value={teamForm[key]} onChange={e => setTeamForm(prev => ({ ...prev, [key]: e.target.value }))}>
                        {(placeholder).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <input type={type} className="yjrl-input" value={teamForm[key]} placeholder={placeholder} onChange={e => setTeamForm(prev => ({ ...prev, [key]: e.target.value }))} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="yjrl-modal-footer">
              <button className="yjrl-btn yjrl-btn-secondary" onClick={() => setTeamModal(false)}>Cancel</button>
              <button className="yjrl-btn yjrl-btn-primary" onClick={saveTeam} disabled={!teamForm.name}>
                <Save size={15} /> Create Team
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEWS MODAL ── */}
      {newsModal && (
        <div className="yjrl-modal-overlay" onClick={() => setNewsModal(false)}>
          <div className="yjrl-modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div className="yjrl-modal-header">
              <div className="yjrl-modal-title">{editingNews ? 'Edit Article' : 'New Article'}</div>
              <button onClick={() => setNewsModal(false)} style={{ background: 'none', border: 'none', color: 'var(--yjrl-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="yjrl-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                <label className="yjrl-label">Title</label>
                <input type="text" className="yjrl-input" value={newsForm.title} onChange={e => setNewsForm(p => ({ ...p, title: e.target.value }))} placeholder="Article headline..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Category</label>
                  <select className="yjrl-input" value={newsForm.category} onChange={e => setNewsForm(p => ({ ...p, category: e.target.value }))}>
                    {['news', 'results', 'events', 'club', 'pathways', 'community', 'sponsors'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingTop: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--yjrl-muted)' }}>
                    <input type="checkbox" checked={newsForm.published} onChange={e => setNewsForm(p => ({ ...p, published: e.target.checked }))} />
                    Publish immediately
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--yjrl-muted)' }}>
                    <input type="checkbox" checked={newsForm.featured} onChange={e => setNewsForm(p => ({ ...p, featured: e.target.checked }))} />
                    Feature on homepage
                  </label>
                </div>
              </div>
              <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                <label className="yjrl-label">Excerpt (short summary)</label>
                <input type="text" className="yjrl-input" value={newsForm.excerpt} onChange={e => setNewsForm(p => ({ ...p, excerpt: e.target.value }))} placeholder="1-2 sentence summary for listing pages..." />
              </div>
              <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                <label className="yjrl-label">Content</label>
                <textarea className="yjrl-input" rows={8} style={{ resize: 'vertical' }} value={newsForm.content} onChange={e => setNewsForm(p => ({ ...p, content: e.target.value }))} placeholder="Write your full article here..." />
              </div>
            </div>
            <div className="yjrl-modal-footer">
              <button className="yjrl-btn yjrl-btn-secondary" onClick={() => setNewsModal(false)}>Cancel</button>
              <button className="yjrl-btn yjrl-btn-primary" onClick={saveNews} disabled={!newsForm.title || !newsForm.content}>
                <Save size={15} /> {editingNews ? 'Update Article' : 'Publish Article'}
              </button>
            </div>
          </div>
        </div>
      )}
    </YJRLLayout>
  );
};

export default YJRLAdminPortal;
