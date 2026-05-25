import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, Trophy, Calendar, Newspaper, Plus, Edit, Trash2, Save,
  Shield, X, CheckCircle, AlertCircle
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import YJRLLayout from './YJRLLayout';
import './yjrl.css';

const SEASON = new Date().getFullYear().toString();

const AGE_GROUPS = ['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'Womens', 'Mens'];
const STATUS_OPTIONS = ['pending', 'active', 'waitlisted', 'cancelled'];

const EMPTY_TEAM = {
  name: '',
  ageGroup: 'U14',
  division: '',
  season: SEASON,
  coachName: '',
  managerName: '',
  trainingDay: '',
  trainingTime: '',
  trainingVenue: 'Nev Skuse Oval'
};

const EMPTY_FIXTURE = {
  teamId: '',
  ageGroup: 'U14',
  round: 1,
  homeTeamName: 'Yeppoon Seagulls',
  awayTeamName: '',
  date: '',
  time: '',
  venue: 'Nev Skuse Oval',
  status: 'scheduled',
  isHomeGame: true,
  season: SEASON
};

const EMPTY_NEWS = {
  title: '',
  content: '',
  excerpt: '',
  category: 'news',
  published: false,
  featured: false
};

function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusColor(status) {
  switch (status) {
    case 'completed':
    case 'active':
      return '#16a34a';
    case 'cancelled':
    case 'postponed':
      return '#dc2626';
    case 'waitlisted':
      return '#d97706';
    default:
      return '#1d4ed8';
  }
}

function emptyTable(colSpan, icon, title, detail) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--yjrl-muted)' }}>
        <div style={{ display: 'inline-flex', color: 'var(--yjrl-light)', marginBottom: '0.75rem' }}>{icon}</div>
        <div style={{ fontWeight: 700, color: 'var(--yjrl-text)', marginBottom: '0.25rem' }}>{title}</div>
        <div style={{ fontSize: '0.85rem' }}>{detail}</div>
      </td>
    </tr>
  );
}

const YJRLAdminPortal = () => {
  const { user } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.role === 'dev');

  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState({ teamCount: 0, playerCount: 0, fixtureCount: 0, upcomingCount: 0 });
  const [teams, setTeams] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [players, setPlayers] = useState([]);
  const [news, setNews] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [safetyReports, setSafetyReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teamModal, setTeamModal] = useState(false);
  const [teamForm, setTeamForm] = useState(EMPTY_TEAM);
  const [fixtureModal, setFixtureModal] = useState(false);
  const [fixtureForm, setFixtureForm] = useState(EMPTY_FIXTURE);
  const [newsModal, setNewsModal] = useState(false);
  const [newsForm, setNewsForm] = useState(EMPTY_NEWS);
  const [editingNews, setEditingNews] = useState(null);

  const fixtureTeamOptions = useMemo(() => teams.map(team => ({
    id: team._id || team.id,
    label: `${team.name || team.ageGroup} (${team.ageGroup || 'Team'})`
  })), [teams]);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    setLoading(true);

    Promise.all([
      api.get(`/yjrl/stats/overview?season=${SEASON}`).catch(() => ({ data: null })),
      api.get(`/yjrl/teams?season=${SEASON}`).catch(() => ({ data: [] })),
      api.get(`/yjrl/fixtures?season=${SEASON}`).catch(() => ({ data: [] })),
      api.get('/yjrl/players').catch(() => ({ data: [] })),
      api.get('/yjrl/news/all').catch(() => ({ data: [] })),
      api.get('/yjrl/chat/rooms').catch(() => ({ data: [] })),
      api.get('/yjrl/safety/reports').catch(() => ({ data: [] }))
    ]).then(([sRes, tRes, fRes, pRes, nRes, rRes, srRes]) => {
      if (!alive) return;
      if (sRes.data && typeof sRes.data === 'object' && !Array.isArray(sRes.data)) setStats(sRes.data);
      setTeams(Array.isArray(tRes.data) ? tRes.data : []);
      setFixtures(Array.isArray(fRes.data) ? fRes.data : []);
      setPlayers(Array.isArray(pRes.data) ? pRes.data : []);
      setNews(Array.isArray(nRes.data) ? nRes.data : []);
      setRooms(Array.isArray(rRes.data) ? rRes.data : []);
      setSafetyReports(Array.isArray(srRes.data) ? srRes.data : []);
    }).finally(() => {
      if (alive) setLoading(false);
    });

    return () => { alive = false; };
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/login" replace />;

  const saveTeam = async () => {
    try {
      const res = await api.post('/yjrl/teams', teamForm);
      setTeams(prev => [...prev, res.data]);
      setStats(prev => ({ ...prev, teamCount: (prev.teamCount || 0) + 1 }));
      setTeamModal(false);
      setTeamForm(EMPTY_TEAM);
      toast.success('Team created');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create team');
    }
  };

  const deleteTeam = async (id) => {
    try {
      await api.delete(`/yjrl/teams/${id}`);
      setTeams(prev => prev.filter(team => (team._id || team.id) !== id));
      setStats(prev => ({ ...prev, teamCount: Math.max((prev.teamCount || 1) - 1, 0) }));
      toast.success('Team deactivated');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to remove team');
    }
  };

  const saveFixture = async () => {
    try {
      const payload = { ...fixtureForm, round: Number(fixtureForm.round) || 1 };
      const res = await api.post('/yjrl/fixtures', payload);
      setFixtures(prev => [res.data, ...prev]);
      setStats(prev => ({ ...prev, fixtureCount: (prev.fixtureCount || 0) + 1 }));
      setFixtureModal(false);
      setFixtureForm(EMPTY_FIXTURE);
      toast.success('Fixture created');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create fixture');
    }
  };

  const deleteFixture = async (id) => {
    try {
      await api.delete(`/yjrl/fixtures/${id}`);
      setFixtures(prev => prev.filter(fixture => (fixture._id || fixture.id) !== id));
      toast.success('Fixture removed');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to remove fixture');
    }
  };

  const updatePlayerStatus = async (player, status) => {
    try {
      const id = player._id || player.id;
      await api.put(`/yjrl/players/${id}`, { registrationStatus: status });
      setPlayers(prev => prev.map(item => ((item._id || item.id) === id ? { ...item, registrationStatus: status } : item)));
      toast.success('Player status updated');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update player');
    }
  };

  const saveNews = async () => {
    try {
      if (editingNews) {
        const res = await api.put(`/yjrl/news/${editingNews}`, newsForm);
        setNews(prev => prev.map(article => (article._id === editingNews ? res.data : article)));
        toast.success('Article updated');
      } else {
        const res = await api.post('/yjrl/news', newsForm);
        setNews(prev => [res.data, ...prev]);
        toast.success('Article created');
      }
      setNewsModal(false);
      setNewsForm(EMPTY_NEWS);
      setEditingNews(null);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save article');
    }
  };

  const deleteNews = async (id) => {
    try {
      await api.delete(`/yjrl/news/${id}`);
      setNews(prev => prev.filter(article => article._id !== id));
      toast.success('Article removed');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to remove article');
    }
  };

  const openEditNews = (article) => {
    setEditingNews(article._id);
    setNewsForm({
      title: article.title || '',
      content: article.content || '',
      excerpt: article.excerpt || '',
      category: article.category || 'news',
      published: !!article.published,
      featured: !!article.featured
    });
    setNewsModal(true);
  };

  return (
    <YJRLLayout>
      <div style={{ background: 'linear-gradient(135deg, #172554, #1d4ed8)', color: 'white', padding: '3rem 1.5rem 0', borderBottom: '1px solid var(--yjrl-border)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ width: 56, height: 56, borderRadius: 12, background: 'linear-gradient(135deg, var(--yjrl-gold), #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={26} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, textTransform: 'uppercase' }}>Club Admin</h1>
                <span className="yjrl-role-badge admin">Admin</span>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.875rem' }}>Yeppoon Junior Rugby League - {SEASON} Season</div>
            </div>
          </div>
          <div className="yjrl-tabs yjrl-tabs-dark">
            {[
              ['overview', 'Overview'],
              ['teams', 'Teams'],
              ['fixtures', 'Fixtures'],
              ['news', 'News'],
              ['players', 'Players'],
              ['moderation', 'Chat Safety']
            ].map(([key, label]) => (
              <button key={key} className={`yjrl-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {loading && (
          <div className="yjrl-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', color: 'var(--yjrl-muted)' }}>
            Loading club data...
          </div>
        )}

        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="yjrl-grid-4">
              {[
                { icon: Users, value: stats.teamCount || teams.length, label: 'Active Teams', color: '#0ea5e9' },
                { icon: Trophy, value: stats.playerCount || players.length, label: 'Registered Players', color: 'var(--yjrl-gold)' },
                { icon: CheckCircle, value: stats.fixtureCount || fixtures.length, label: 'Fixtures', color: '#16a34a' },
                { icon: Calendar, value: stats.upcomingCount || fixtures.filter(f => f.status === 'scheduled').length, label: 'Upcoming Games', color: '#7c3aed' }
              ].map((item) => (
                <div key={item.label} className="yjrl-stat-card">
                  <div className="yjrl-stat-icon" style={{ color: item.color }}><item.icon size={20} /></div>
                  <span className="yjrl-stat-value" style={{ color: item.color }}>{item.value}</span>
                  <span className="yjrl-stat-label">{item.label}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {[
                { icon: Plus, label: 'Create Team', onClick: () => { setTeamModal(true); setTab('teams'); }, color: '#0ea5e9' },
                { icon: Calendar, label: 'Add Fixture', onClick: () => { setFixtureModal(true); setTab('fixtures'); }, color: 'var(--yjrl-gold)' },
                { icon: Newspaper, label: 'Write News', onClick: () => { setNewsForm(EMPTY_NEWS); setEditingNews(null); setNewsModal(true); setTab('news'); }, color: '#16a34a' },
                { icon: Shield, label: 'Review Chat Safety', onClick: () => setTab('moderation'), color: '#7c3aed' }
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  style={{ padding: '1.25rem', borderRadius: 8, background: `${action.color}14`, border: `1px solid ${action.color}33`, color: action.color, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 700, fontSize: '0.9rem' }}
                >
                  <action.icon size={18} /> {action.label}
                </button>
              ))}
            </div>

            <div className="yjrl-card">
              <div className="yjrl-card-header">
                <div className="yjrl-card-title"><AlertCircle size={16} /> Admin Attention</div>
              </div>
              <div className="yjrl-card-body" style={{ display: 'grid', gap: '0.75rem' }}>
                {players.filter(p => p.registrationStatus === 'pending').length > 0 ? (
                  <button className="yjrl-btn yjrl-btn-secondary" onClick={() => setTab('players')} style={{ justifyContent: 'space-between' }}>
                    <span>{players.filter(p => p.registrationStatus === 'pending').length} registrations awaiting review</span>
                    <span>Open</span>
                  </button>
                ) : (
                  <div style={{ color: 'var(--yjrl-muted)' }}>No pending registrations.</div>
                )}
                {fixtures.filter(f => f.status === 'scheduled').slice(0, 3).map(fixture => (
                  <div key={fixture._id || fixture.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                    <span style={{ fontWeight: 700 }}>{fixture.homeTeamName} v {fixture.awayTeamName}</span>
                    <span style={{ color: 'var(--yjrl-muted)' }}>{formatDate(fixture.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'teams' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase' }}>Teams ({teams.length})</h2>
              <button className="yjrl-btn yjrl-btn-primary" onClick={() => setTeamModal(true)}>
                <Plus size={15} /> Add Team
              </button>
            </div>

            <div className="yjrl-grid-3">
              {teams.map(team => (
                <div key={team._id || team.id} className="yjrl-card">
                  <div className="yjrl-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, var(--yjrl-gold), #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--yjrl-blue-deeper)', fontSize: '0.8rem' }}>
                        {(team.ageGroup || 'T').replace('U', '')}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{team.name || team.ageGroup}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--yjrl-muted)' }}>{team.ageGroup}</div>
                      </div>
                    </div>
                    <button onClick={() => deleteTeam(team._id || team.id)} aria-label={`Deactivate ${team.name}`} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0.25rem' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="yjrl-card-body" style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ fontSize: '0.825rem', color: 'var(--yjrl-muted)' }}>
                      Coach: <strong style={{ color: 'var(--yjrl-text)' }}>{team.coachName || 'Unassigned'}</strong>
                    </div>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.825rem', color: 'var(--yjrl-muted)' }}>
                      {team.trainingDay || 'Training day TBA'} {team.trainingTime ? `at ${team.trainingTime}` : ''} - {team.trainingVenue || 'Venue TBA'}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                      <span style={{ color: '#16a34a', fontWeight: 700 }}>{team.wins || 0}W</span>
                      <span style={{ color: '#dc2626', fontWeight: 700 }}>{team.losses || 0}L</span>
                      <span style={{ color: 'var(--yjrl-muted)' }}>{team.draws || 0}D</span>
                      <span style={{ marginLeft: 'auto', color: 'var(--yjrl-muted)' }}>{team.players?.length || 0} players</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {teams.length === 0 && !loading && (
              <div className="yjrl-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--yjrl-muted)' }}>
                No teams have been created for {SEASON}.
              </div>
            )}
          </div>
        )}

        {tab === 'fixtures' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase' }}>Fixtures ({fixtures.length})</h2>
              <button className="yjrl-btn yjrl-btn-primary" onClick={() => setFixtureModal(true)}>
                <Plus size={15} /> Add Fixture
              </button>
            </div>
            <div className="yjrl-card">
              <table className="yjrl-table">
                <thead>
                  <tr><th>Round</th><th>Date</th><th>Match</th><th>Venue</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {fixtures.map(fixture => {
                    const id = fixture._id || fixture.id;
                    return (
                      <tr key={id}>
                        <td style={{ fontWeight: 700 }}>{fixture.round || '-'}</td>
                        <td>{formatDate(fixture.date)}{fixture.time ? `, ${fixture.time}` : ''}</td>
                        <td style={{ fontWeight: 600 }}>{fixture.homeTeamName} v {fixture.awayTeamName}</td>
                        <td style={{ color: 'var(--yjrl-muted)' }}>{fixture.venue || 'TBA'}</td>
                        <td>
                          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: 999, background: `${statusColor(fixture.status)}14`, color: statusColor(fixture.status), fontWeight: 700, textTransform: 'capitalize' }}>
                            {fixture.status || 'scheduled'}
                          </span>
                        </td>
                        <td>
                          <button className="yjrl-btn yjrl-btn-danger yjrl-btn-sm" onClick={() => deleteFixture(id)} aria-label="Remove fixture">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {fixtures.length === 0 && !loading && emptyTable(6, <Calendar size={34} />, 'No fixtures yet', 'Create the first fixture when the season draw is available.')}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'news' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
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
                      <td style={{ fontWeight: 600, maxWidth: 320 }}>{article.title}</td>
                      <td style={{ textTransform: 'capitalize' }}>{article.category}</td>
                      <td>
                        <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: 999, background: article.published ? '#16a34a14' : '#64748b14', color: article.published ? '#16a34a' : 'var(--yjrl-muted)', fontWeight: 700 }}>
                          {article.published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--yjrl-muted)' }}>{article.views || 0}</td>
                      <td style={{ color: 'var(--yjrl-muted)', fontSize: '0.8rem' }}>{formatDate(article.publishDate)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" onClick={() => openEditNews(article)} aria-label={`Edit ${article.title}`}>
                            <Edit size={12} />
                          </button>
                          <button className="yjrl-btn yjrl-btn-danger yjrl-btn-sm" onClick={() => deleteNews(article._id)} aria-label={`Remove ${article.title}`}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {news.length === 0 && !loading && emptyTable(6, <Newspaper size={34} />, 'No articles yet', 'Create a club update for the public news page.')}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'players' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase' }}>Players ({players.length})</h2>
              <span style={{ color: 'var(--yjrl-muted)', fontSize: '0.85rem' }}>Registrations are created from the public form.</span>
            </div>
            <div className="yjrl-card">
              <table className="yjrl-table">
                <thead>
                  <tr><th>Player</th><th>Age Group</th><th>Team</th><th>Guardian</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {players.map(player => {
                    const id = player._id || player.id;
                    return (
                      <tr key={id}>
                        <td style={{ fontWeight: 700 }}>{player.firstName} {player.lastName}</td>
                        <td>{player.ageGroup || '-'}</td>
                        <td style={{ color: 'var(--yjrl-muted)' }}>{player.team?.name || 'Unassigned'}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{player.guardianName || player.guardian_name || '-'}</div>
                          <div style={{ color: 'var(--yjrl-muted)', fontSize: '0.75rem' }}>{player.guardianEmail || player.guardian_email || player.guardianPhone || player.guardian_phone || ''}</div>
                        </td>
                        <td>
                          <select className="yjrl-input" style={{ minWidth: 140 }} value={player.registrationStatus || 'pending'} onChange={event => updatePlayerStatus(player, event.target.value)}>
                            {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                  {players.length === 0 && !loading && emptyTable(5, <Users size={34} />, 'No player registrations yet', 'Completed registration forms will appear here for review.')}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'moderation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="yjrl-card">
              <div className="yjrl-card-header">
                <div className="yjrl-card-title"><AlertCircle size={16} /> Safety Reports ({safetyReports.length})</div>
              </div>
              <table className="yjrl-table">
                <thead>
                  <tr><th>Reason</th><th>Category</th><th>Severity</th><th>Status</th><th>Reported</th></tr>
                </thead>
                <tbody>
                  {safetyReports.map(report => (
                    <tr key={report._id || report.id}>
                      <td style={{ fontWeight: 700 }}>{report.reason}</td>
                      <td style={{ textTransform: 'capitalize' }}>{report.category || report.entity_type || '-'}</td>
                      <td style={{ textTransform: 'capitalize', color: report.severity === 'critical' || report.severity === 'high' ? '#dc2626' : 'var(--yjrl-muted)', fontWeight: 700 }}>{report.severity}</td>
                      <td style={{ textTransform: 'capitalize' }}>{report.status}</td>
                      <td style={{ color: 'var(--yjrl-muted)', fontSize: '0.8rem' }}>{formatDate(report.created_at)}</td>
                    </tr>
                  ))}
                  {safetyReports.length === 0 && !loading && emptyTable(5, <AlertCircle size={34} />, 'No safety reports', 'Reports submitted from chat and safety tools will appear here.')}
                </tbody>
              </table>
            </div>

            <div className="yjrl-card">
              <div className="yjrl-card-header">
                <div className="yjrl-card-title"><Shield size={16} /> Active Chat Rooms ({rooms.length})</div>
              </div>
              <table className="yjrl-table">
                <thead>
                  <tr><th>Room</th><th>Type</th><th>Age Group</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {rooms.map(room => (
                    <tr key={room.id || room.room_id || room.name}>
                      <td style={{ fontWeight: 700 }}>{room.name || room.room_id || room.id}</td>
                      <td style={{ textTransform: 'capitalize' }}>{room.type || '-'}</td>
                      <td>{room.age_group || room.ageGroup || '-'}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#16a34a', fontWeight: 700, fontSize: '0.8rem' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a' }} /> Active
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rooms.length === 0 && !loading && emptyTable(4, <Shield size={34} />, 'No active chat rooms', 'Create teams to seed team and parent communication rooms.')}
                </tbody>
              </table>
            </div>

            <div className="yjrl-grid-3">
              {[
                ['Adult boundaries', 'Coaches use parent/team-adult rooms and cannot post in junior player rooms.'],
                ['Player hours', 'Player rooms accept messages from 7am to 8pm AEST.'],
                ['Launch gate', 'Blocking, takedown workflow, and formal incident escalation still require club sign-off before customer launch.']
              ].map(([title, detail]) => (
                <div key={title} className="yjrl-card" style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                    <CheckCircle size={16} style={{ color: '#16a34a' }} /> {title}
                  </div>
                  <div style={{ color: 'var(--yjrl-muted)', fontSize: '0.85rem', lineHeight: 1.6 }}>{detail}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {teamModal && (
        <div className="yjrl-modal-overlay" onClick={() => setTeamModal(false)}>
          <div className="yjrl-modal" onClick={event => event.stopPropagation()}>
            <div className="yjrl-modal-header">
              <div className="yjrl-modal-title">Add Team</div>
              <button onClick={() => setTeamModal(false)} aria-label="Close team form" style={{ background: 'none', border: 'none', color: 'var(--yjrl-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="yjrl-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Team Name</label>
                  <input className="yjrl-input" value={teamForm.name} placeholder="Yeppoon Seagulls U14" onChange={event => setTeamForm(prev => ({ ...prev, name: event.target.value }))} />
                </div>
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Age Group</label>
                  <select className="yjrl-input" value={teamForm.ageGroup} onChange={event => setTeamForm(prev => ({ ...prev, ageGroup: event.target.value }))}>
                    {AGE_GROUPS.map(age => <option key={age} value={age}>{age}</option>)}
                  </select>
                </div>
                {[
                  ['Division', 'division', 'A Grade'],
                  ['Coach Name', 'coachName', ''],
                  ['Manager Name', 'managerName', ''],
                  ['Training Days', 'trainingDay', 'Tue and Thu'],
                  ['Training Time', 'trainingTime', '5:00 PM'],
                  ['Training Venue', 'trainingVenue', 'Nev Skuse Oval']
                ].map(([label, key, placeholder]) => (
                  <div key={key} className="yjrl-form-group" style={{ marginBottom: 0 }}>
                    <label className="yjrl-label">{label}</label>
                    <input className="yjrl-input" value={teamForm[key]} placeholder={placeholder} onChange={event => setTeamForm(prev => ({ ...prev, [key]: event.target.value }))} />
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

      {fixtureModal && (
        <div className="yjrl-modal-overlay" onClick={() => setFixtureModal(false)}>
          <div className="yjrl-modal" onClick={event => event.stopPropagation()}>
            <div className="yjrl-modal-header">
              <div className="yjrl-modal-title">Add Fixture</div>
              <button onClick={() => setFixtureModal(false)} aria-label="Close fixture form" style={{ background: 'none', border: 'none', color: 'var(--yjrl-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="yjrl-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Team</label>
                  <select className="yjrl-input" value={fixtureForm.teamId} onChange={event => setFixtureForm(prev => ({ ...prev, teamId: event.target.value }))}>
                    <option value="">Unassigned</option>
                    {fixtureTeamOptions.map(team => <option key={team.id} value={team.id}>{team.label}</option>)}
                  </select>
                </div>
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Age Group</label>
                  <select className="yjrl-input" value={fixtureForm.ageGroup} onChange={event => setFixtureForm(prev => ({ ...prev, ageGroup: event.target.value }))}>
                    {AGE_GROUPS.map(age => <option key={age} value={age}>{age}</option>)}
                  </select>
                </div>
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Round</label>
                  <input type="number" min="1" className="yjrl-input" value={fixtureForm.round} onChange={event => setFixtureForm(prev => ({ ...prev, round: event.target.value }))} />
                </div>
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Date</label>
                  <input type="date" className="yjrl-input" value={fixtureForm.date} onChange={event => setFixtureForm(prev => ({ ...prev, date: event.target.value }))} />
                </div>
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Time</label>
                  <input type="time" className="yjrl-input" value={fixtureForm.time} onChange={event => setFixtureForm(prev => ({ ...prev, time: event.target.value }))} />
                </div>
                {[
                  ['Home Team', 'homeTeamName'],
                  ['Away Team', 'awayTeamName'],
                  ['Venue', 'venue']
                ].map(([label, key]) => (
                  <div key={key} className="yjrl-form-group" style={{ marginBottom: 0 }}>
                    <label className="yjrl-label">{label}</label>
                    <input className="yjrl-input" value={fixtureForm[key]} onChange={event => setFixtureForm(prev => ({ ...prev, [key]: event.target.value }))} />
                  </div>
                ))}
              </div>
            </div>
            <div className="yjrl-modal-footer">
              <button className="yjrl-btn yjrl-btn-secondary" onClick={() => setFixtureModal(false)}>Cancel</button>
              <button className="yjrl-btn yjrl-btn-primary" onClick={saveFixture} disabled={!fixtureForm.awayTeamName || !fixtureForm.date}>
                <Save size={15} /> Create Fixture
              </button>
            </div>
          </div>
        </div>
      )}

      {newsModal && (
        <div className="yjrl-modal-overlay" onClick={() => setNewsModal(false)}>
          <div className="yjrl-modal" style={{ maxWidth: 680 }} onClick={event => event.stopPropagation()}>
            <div className="yjrl-modal-header">
              <div className="yjrl-modal-title">{editingNews ? 'Edit Article' : 'New Article'}</div>
              <button onClick={() => setNewsModal(false)} aria-label="Close article form" style={{ background: 'none', border: 'none', color: 'var(--yjrl-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="yjrl-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                <label className="yjrl-label">Title</label>
                <input type="text" className="yjrl-input" value={newsForm.title} onChange={event => setNewsForm(prev => ({ ...prev, title: event.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Category</label>
                  <select className="yjrl-input" value={newsForm.category} onChange={event => setNewsForm(prev => ({ ...prev, category: event.target.value }))}>
                    {['news', 'results', 'events', 'club', 'pathways', 'community', 'sponsors'].map(category => <option key={category} value={category}>{category}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingTop: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--yjrl-muted)' }}>
                    <input type="checkbox" checked={newsForm.published} onChange={event => setNewsForm(prev => ({ ...prev, published: event.target.checked }))} />
                    Publish immediately
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--yjrl-muted)' }}>
                    <input type="checkbox" checked={newsForm.featured} onChange={event => setNewsForm(prev => ({ ...prev, featured: event.target.checked }))} />
                    Feature on homepage
                  </label>
                </div>
              </div>
              <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                <label className="yjrl-label">Excerpt</label>
                <input type="text" className="yjrl-input" value={newsForm.excerpt} onChange={event => setNewsForm(prev => ({ ...prev, excerpt: event.target.value }))} />
              </div>
              <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                <label className="yjrl-label">Content</label>
                <textarea className="yjrl-input" rows={8} style={{ resize: 'vertical' }} value={newsForm.content} onChange={event => setNewsForm(prev => ({ ...prev, content: event.target.value }))} />
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
