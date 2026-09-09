import CommunicationHub from '../../components/CommunicationHub';
import AdminShop from '../../components/AdminShop';
import AdminStocktake from '../../components/AdminStocktake';
import AdminAddPlayer from '../../components/AdminAddPlayer';
import ArticlePhotoUpload from '../../components/ArticlePhotoUpload';
import { fixtureError } from '../../../../shared/fixture';
import { locationFields } from '../../../../shared/maps';
import MapLocationFields from '../../components/MapLocationFields';
import AdminEvents from '../../components/AdminEvents';
import seasonConfig from '../../../../shared/season.json';
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
import MediaReviewPreview from '../../components/MediaReviewPreview';
import './yjrl.css';

const SEASON = seasonConfig.season;

const AGE_GROUPS = ['U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'Womens', 'Mens'];
const STATUS_OPTIONS = ['pending', 'active', 'inactive', 'transferred'];

const EMPTY_TEAM = {
  name: '',
  ageGroup: 'U14',
  division: '',
  season: SEASON,
  coachName: '',
  coachId: '',
  managerName: '',
  trainingDay: '',
  trainingTime: '',
  trainingVenue: 'Nev Skuse Oval', trainingMapsUrl: '', trainingMapsEmbedUrl: ''
};

const EMPTY_FIXTURE = {
  teamId: '',
  ageGroup: 'U14',
  round: 1,
  homeTeamName: 'Yeppoon Seagulls',
  awayTeamName: '',
  date: '',
  time: '',
  venue: 'Nev Skuse Oval', mapsUrl: '', mapsEmbedUrl: '',
  status: 'scheduled',
  isHomeGame: true,
  season: SEASON
};

const EMPTY_NEWS = {
  title: '',
  content: '',
  excerpt: '',
  image: '',
  category: 'news',
  published: false,
  featured: false
};

const EMPTY_ADULT_INVITE = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  requestedRole: 'coach',
  notes: ''
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
  const [stockProduct, setStockProduct] = useState('');
  const [stats, setStats] = useState({ teamCount: 0, playerCount: 0, fixtureCount: 0, upcomingCount: 0 });
  const [teams, setTeams] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [players, setPlayers] = useState([]);
  const [news, setNews] = useState([]);
  const [roomSort, setRoomSort] = useState('age');
  const [roomSearch, setRoomSearch] = useState('');
  const [rooms, setRooms] = useState([]);
  const [safetyReports, setSafetyReports] = useState([]);
  const [adultApprovals, setAdultApprovals] = useState([]);
  const [approvalDrafts, setApprovalDrafts] = useState({});
  const [adultInviteForm, setAdultInviteForm] = useState(EMPTY_ADULT_INVITE);
  const [lastInvite, setLastInvite] = useState(null);
  const [uploadRecords, setUploadRecords] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [readinessError, setReadinessError] = useState('');
  const [safetyActionNotes, setSafetyActionNotes] = useState({});
  const [uploadReviewNotes, setUploadReviewNotes] = useState({});
  const [uploadReviewSubjects, setUploadReviewSubjects] = useState({});
  const [viewedUploads, setViewedUploads] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teamModal, setTeamModal] = useState(false);
  const [teamForm, setTeamForm] = useState(EMPTY_TEAM);
  const [fixtureModal, setFixtureModal] = useState(false);
  const [editingFixture, setEditingFixture] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [fixtureErrorMessage, setFixtureErrorMessage] = useState('');
  const [savingFixture, setSavingFixture] = useState(false);
  const [fixtureForm, setFixtureForm] = useState(EMPTY_FIXTURE);
  const [newsModal, setNewsModal] = useState(false);
  const [newsForm, setNewsForm] = useState(EMPTY_NEWS);
  const [articlePhotoBusy, setArticlePhotoBusy] = useState(false);
  const [editingNews, setEditingNews] = useState(null);

  const fixtureTeamOptions = useMemo(() => teams.map(team => ({
    id: team._id || team.id,
    label: `${team.name || team.ageGroup} (${team.ageGroup || 'Team'})`
  })), [teams]);

  const approvedCoaches = useMemo(() => adultApprovals
    .filter(approval => (approval.requestedRole || approval.requested_role) === 'coach' && approval.status === 'approved')
    .map(approval => ({
      id: approval.userId || approval.user_id,
      label: `${approval.first_name || ''} ${approval.last_name || ''}`.trim() || approval.email || 'Approved coach',
      email: approval.email
    }))
    .filter(coach => coach.id), [adultApprovals]);

  const visibleRooms = [...rooms].filter(room => `${room.name || ''} ${room.type || ''} ${room.age_group || room.ageGroup || ''}`.toLowerCase().includes(roomSearch.trim().toLowerCase())).sort((a, b) => {
    const value = room => roomSort === 'age' ? (room.age_group || room.ageGroup || 'ZZ') : roomSort === 'type' ? room.type || '' : room.name || '';
    return value(a).localeCompare(value(b), 'en', { numeric: true }) || (a.name || '').localeCompare(b.name || '', 'en', { numeric: true });
  });

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
      api.get('/yjrl/safety/reports').catch(() => ({ data: [] })),
      api.get('/yjrl/safety/adult-approvals').catch(() => ({ data: [] })),
      api.get('/yjrl/safety/uploads').catch(() => ({ data: [] })),
      api.get('/admin/readiness').catch(error => ({ data: null, error }))
    ]).then(([sRes, tRes, fRes, pRes, nRes, rRes, srRes, aaRes, uRes, readyRes]) => {
      if (!alive) return;
      if (sRes.data && typeof sRes.data === 'object' && !Array.isArray(sRes.data)) setStats(sRes.data);
      setTeams(Array.isArray(tRes.data) ? tRes.data : []);
      setFixtures(Array.isArray(fRes.data) ? fRes.data : []);
      setPlayers(Array.isArray(pRes.data) ? pRes.data : []);
      setNews(Array.isArray(nRes.data) ? nRes.data : []);
      setRooms(Array.isArray(rRes.data) ? rRes.data : []);
      setSafetyReports(Array.isArray(srRes.data) ? srRes.data : []);
      setAdultApprovals(Array.isArray(aaRes.data) ? aaRes.data : []);
      setUploadRecords(Array.isArray(uRes.data) ? uRes.data : []);
      setReadiness(readyRes.data || null);
      setReadinessError(readyRes.error ? 'Launch readiness check could not be loaded.' : '');
    }).finally(() => {
      if (alive) setLoading(false);
    });

    return () => { alive = false; };
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/login" replace />;

  const saveTeam = async () => {
    try {
      locationFields(teamForm, {}, true);
      const selectedCoach = approvedCoaches.find(coach => coach.id === teamForm.coachId);
      const payload = {
        ...Object.fromEntries(Object.keys(EMPTY_TEAM).map(key => [key, teamForm[key]])),
        coachName: teamForm.coachName || selectedCoach?.label || '',
        ...(editingTeam ? {} : { coachId: teamForm.coachId || null })
      };
      if (editingTeam && payload.coachId === '__unchanged') delete payload.coachId;
      const res = editingTeam ? await api.put(`/yjrl/teams/${editingTeam}`, payload) : await api.post('/yjrl/teams', payload);
      setTeams(prev => editingTeam ? prev.map(t => t._id === editingTeam ? res.data : t) : [...prev, res.data]);
      setStats(prev => ({ ...prev, teamCount: (prev.teamCount || 0) + (editingTeam ? 0 : 1) }));
      setTeamModal(false);
      setTeamForm(EMPTY_TEAM);
      setEditingTeam(null);
      toast.success(editingTeam ? 'Team updated' : 'Team created');
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'Failed to save team');
    }
  };

  const deleteTeam = async (id) => {
    if (!window.confirm('Deactivate this team? Existing records stay in the system.')) return;
    try {
      await api.delete(`/yjrl/teams/${id}`);
      setTeams(prev => prev.filter(team => (team._id || team.id) !== id));
      setStats(prev => ({ ...prev, teamCount: Math.max((prev.teamCount || 1) - 1, 0) }));
      toast.success('Team deactivated');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to remove team');
    }
  };

  const updateTeamCoach = async (team, coachId) => {
    try {
      const id = team._id || team.id;
      const selectedCoach = approvedCoaches.find(coach => coach.id === coachId);
      const res = await api.put(`/yjrl/teams/${id}`, {
        coachId: coachId || null,
        coachName: selectedCoach?.label || ''
      });
      setTeams(prev => prev.map(item => ((item._id || item.id) === id ? { ...item, ...res.data } : item)));
      toast.success(selectedCoach ? `Coach assigned to ${team.name || team.ageGroup}` : 'Coach assignment cleared');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update team coach');
    }
  };

  const saveFixture = async () => {
    const validation = fixtureError(fixtureForm);
    if (validation) { setFixtureErrorMessage(validation); return; }
    setSavingFixture(true); setFixtureErrorMessage('');
    try {
      locationFields(fixtureForm);
      const payload = { ...Object.fromEntries(Object.keys(EMPTY_FIXTURE).map(key => [key, fixtureForm[key]])), round: Number(fixtureForm.round) };
      if (editingFixture) { delete payload.status; delete payload.teamId; }
      // Team assignment is fixed once results exist; other fixture details remain editable.
      const res = editingFixture ? await api.put(`/yjrl/fixtures/${editingFixture}`, payload) : await api.post('/yjrl/fixtures', payload);
      setFixtures(prev => editingFixture ? prev.map(f => f._id === editingFixture ? res.data : f) : [res.data, ...prev]);
      setStats(prev => ({ ...prev, fixtureCount: (prev.fixtureCount || 0) + (editingFixture ? 0 : 1) }));
      setFixtureModal(false); setFixtureForm(EMPTY_FIXTURE); setEditingFixture(null);
      toast.success(editingFixture ? 'Fixture updated' : 'Fixture created');
    } catch (error) {
      setFixtureErrorMessage(error.response?.data?.error || error.message || 'Failed to save fixture');
    } finally { setSavingFixture(false); }
  };

  const deleteFixture = async (id) => {
    if (!window.confirm('Remove this fixture from the schedule?')) return;
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

  const updatePlayerTeam = async (player, teamId) => {
    try {
      const id = player._id || player.id;
      const res = await api.put(`/yjrl/players/${id}`, { teamId: teamId || null });
      const team = teams.find(item => (item._id || item.id) === teamId);
      setPlayers(prev => prev.map(item => ((item._id || item.id) === id ? {
        ...item,
        ...res.data,
        teamId: teamId || null,
        team: team ? { _id: team._id || team.id, name: team.name, ageGroup: team.ageGroup } : null
      } : item)));
      toast.success(team ? `Assigned to ${team.name || team.ageGroup}` : 'Team assignment cleared');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update player team');
    }
  };

  const saveNews = async () => {
    try {
      if (editingNews) {
        const res = await api.put(`/yjrl/news/${editingNews}`, newsForm);
        setNews(prev => prev.map(article => (article._id === editingNews ? res.data : article)));
        toast.success(newsForm.published ? 'Article published on the website' : 'Draft saved — visible in admin only');
      } else {
        const res = await api.post('/yjrl/news', newsForm);
        setNews(prev => [res.data, ...prev]);
        toast.success(newsForm.published ? 'Article published on the website' : 'Draft saved — visible in admin only');
      }
      setNewsModal(false);
      setNewsForm(EMPTY_NEWS);
      setEditingNews(null);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save article');
    }
  };

  const deleteNews = async (id) => {
    if (!window.confirm('Remove this news article from the public site?')) return;
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
      image: article.image || '',
      category: article.category || 'news',
      published: !!article.published,
      featured: !!article.featured
    });
    setNewsModal(true);
  };

  const updateSafetyReport = async (report, status) => {
    try {
      const id = report._id || report.id;
      const note = (safetyActionNotes[id] || report.action_taken || '').trim();
      if ((status === 'actioned' || status === 'closed') && note.length < 20) {
        toast.error('Add action notes before marking a report actioned or closed');
        return;
      }
      const actionTaken = status === 'triaged' && !note ? 'Report triaged for review by club admin.' : note;
      const res = await api.put(`/yjrl/safety/reports/${id}`, {
        status,
        actionTaken,
        assignedToUserId: user?._id || user?.id
      });
      setSafetyReports(prev => prev.map(item => ((item._id || item.id) === id ? res.data : item)));
      setSafetyActionNotes(prev => ({ ...prev, [id]: '' }));
      toast.success(`Report marked ${status}`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update safety report');
    }
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Choose a photo smaller than 5MB'); return; }
    setUploadingPhoto(true);
    try {
      const data = new FormData();
      data.set('file', file);
      data.set('category', 'general');
      await api.post('/upload', data, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 });
      toast.success('Photo saved for private review');
      try {
        const response = await api.get('/yjrl/safety/uploads');
        setUploadRecords(response.data);
      } catch { toast.error('Refresh the review list to see the saved photo'); }
    } catch (error) { toast.error(error.response?.data?.error || 'The upload could not be confirmed. Refresh the list before retrying.'); }
    finally { setUploadingPhoto(false); }
  };

  const reviewUpload = async (record, status) => {
    try {
      const note = (uploadReviewNotes[record.key] || '').trim();
      const subjects = uploadReviewSubjects[record.key] || {};
      if (status === 'approved' && (note.length < 10 || !subjects.classification || viewedUploads[record.key] !== record.sha256)) {
        toast.error('Preview the image, confirm who is shown and add reviewer notes');
        return;
      }
      const res = await api.put('/yjrl/safety/uploads/review', {
        key: record.key, status, reviewNotes: note, reviewVersion: record.reviewVersion,
        expectedSha256: record.sha256, containsChildren: subjects.classification === 'children',
        playerIds: [...new Set([...(record.playerIds || []), ...(subjects.playerIds || [])])],
        allChildrenIdentified: subjects.confirmed === true
      });
      setUploadRecords(prev => prev.map(item => (item.key === record.key ? res.data : item)));
      setUploadReviewNotes(prev => ({ ...prev, [record.key]: '' }));
      toast.success(res.data.cleanupPending ? 'Upload rejected. Storage cleanup is pending.' : `Upload ${status.replace('_', ' ')}`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to review upload');
    }
  };

  const approvalKey = (approval) => `${approval.userId || approval.user_id}:${approval.requestedRole || approval.requested_role}`;
  const getApprovalDraft = (approval) => approvalDrafts[approvalKey(approval)] || {
    blueCardReference: approval.blueCardReference || approval.blue_card_reference || '',
    blueCardStatus: approval.blueCardStatus || approval.blue_card_status || 'not-provided',
    blueCardExpiry: approval.blueCardExpiry || approval.blue_card_expiry || '',
    identityChecked: !!(approval.identityChecked || approval.identity_checked),
    safeguardingTrainingCompleted: !!(approval.safeguardingTrainingCompleted || approval.safeguarding_training_completed),
    notes: approval.notes || ''
  };
  const setApprovalDraft = (approval, field, value) => {
    const key = approvalKey(approval);
    setApprovalDrafts(prev => ({ ...prev, [key]: { ...getApprovalDraft(approval), ...prev[key], [field]: value } }));
  };

  const saveAdultApproval = async (approval, status) => {
    const draft = getApprovalDraft(approval);
    if (status === 'approved' && (!draft.blueCardReference || draft.blueCardStatus !== 'verified' || !draft.identityChecked || !draft.safeguardingTrainingCompleted)) {
      toast.error('Verified Blue Card, identity check, and safeguarding training are required');
      return;
    }
    try {
      const payload = {
        userId: approval.userId || approval.user_id,
        requestedRole: approval.requestedRole || approval.requested_role,
        status,
        ...draft
      };
      const res = await api.post('/yjrl/safety/adult-approvals', payload);
      setAdultApprovals(prev => prev.map(item => (approvalKey(item) === approvalKey(res.data) ? res.data : item)));
      toast.success(`Adult role ${status}`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update adult approval');
    }
  };

  const createAdultInvite = async () => {
    try {
      const res = await api.post('/yjrl/safety/adult-approvals/invite', adultInviteForm);
      const approval = res.data.approval;
      setAdultApprovals(prev => {
        const existing = prev.some(item => approvalKey(item) === approvalKey(approval));
        return existing ? prev.map(item => (approvalKey(item) === approvalKey(approval) ? approval : item)) : [approval, ...prev];
      });
      setLastInvite(res.data.temporaryPassword ? { email: adultInviteForm.email, temporaryPassword: res.data.temporaryPassword } : null);
      setAdultInviteForm(EMPTY_ADULT_INVITE);
      toast.success('Adult role request created');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create adult role request');
    }
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
              ['events', 'Events'],
              ['shop', 'Shop'],
              ['stocktake', 'Stocktake'],
              ['news', 'News'],
              ['players', 'Players'],
              ['communication', 'Messages'],
              ['moderation', 'Chat Safety']
            ].map(([key, label]) => (
              <button key={key} className={`yjrl-tab ${tab === key ? 'active' : ''}`} onClick={() => { if (key === 'stocktake') setStockProduct(''); setTab(key); }}>{label}</button>
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

            <div className="yjrl-card">
              <div className="yjrl-card-header">
                <div className="yjrl-card-title"><Shield size={16} /> Customer Launch Readiness</div>
                {readiness && (
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: readiness.readyForPaidLaunch ? '#166534' : '#991b1b',
                    background: readiness.readyForPaidLaunch ? '#dcfce7' : '#fee2e2',
                    border: `1px solid ${readiness.readyForPaidLaunch ? '#86efac' : '#fecaca'}`,
                    borderRadius: 999,
                    padding: '0.25rem 0.65rem'
                  }}>
                    {readiness.readyForPaidLaunch ? 'Ready' : `${readiness.blockingCount || 0} blocker${readiness.blockingCount === 1 ? '' : 's'}`}
                  </span>
                )}
              </div>
              <div className="yjrl-card-body" style={{ display: 'grid', gap: '0.75rem' }}>
                {readinessError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{readinessError}</div>}
                {readiness?.checks?.map(item => {
                  const color = item.status === 'pass' ? '#166534' : item.status === 'warn' ? '#92400e' : item.status === 'not_required' ? '#475569' : '#991b1b';
                  const bg = item.status === 'pass' ? '#dcfce7' : item.status === 'warn' ? '#fef3c7' : item.status === 'not_required' ? '#f1f5f9' : '#fee2e2';
                  return (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'center', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{item.label}</div>
                      <span style={{ justifySelf: 'start', color, background: bg, borderRadius: 999, padding: '0.2rem 0.55rem', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase' }}>{String(item.status).replace('_', ' ')}</span>
                      <div style={{ color: 'var(--yjrl-muted)', fontSize: '0.82rem', lineHeight: 1.5 }}>{item.detail}</div>
                    </div>
                  );
                })}
                {!readiness && !readinessError && <div style={{ color: 'var(--yjrl-muted)' }}>Readiness checks are loading.</div>}
              </div>
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
              <button className="yjrl-btn yjrl-btn-primary" onClick={() => { setTeamForm(EMPTY_TEAM); setEditingTeam(null); setTeamModal(true); }}>
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
                    <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" onClick={() => { setTeamForm({ ...EMPTY_TEAM, ...team, coachId: '__unchanged' }); setEditingTeam(team._id); setTeamModal(true); }} aria-label={`Edit ${team.name}`}><Edit size={14} /> Edit</button>
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
                    <div style={{ marginTop: '0.75rem' }}>
                      <select className="yjrl-input" value={team.coachId || ''} onChange={event => updateTeamCoach(team, event.target.value)}>
                        <option value="">Assign approved coach</option>
                        {approvedCoaches.map(coach => <option key={coach.id} value={coach.id}>{coach.label}</option>)}
                      </select>
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
              <button className="yjrl-btn yjrl-btn-primary" onClick={() => { setFixtureForm(EMPTY_FIXTURE); setEditingFixture(null); setFixtureErrorMessage(''); setFixtureModal(true); }}>
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
                          <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" onClick={() => { setFixtureForm({ ...EMPTY_FIXTURE, ...fixture, date: fixture.date?.slice(0, 10) || '' }); setEditingFixture(id); setFixtureErrorMessage(''); setFixtureModal(true); }} aria-label="Edit fixture"><Edit size={12} /> Edit</button>
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

        {tab === 'events' && <AdminEvents />}
        {tab === 'shop' && <AdminShop players={players} onStocktake={id => { setStockProduct(id || ''); setTab('stocktake'); }} />}
        {tab === 'stocktake' && <AdminStocktake productId={stockProduct} onShop={() => setTab('shop')} />}
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
                          {!article.published && <button className="yjrl-btn yjrl-btn-primary yjrl-btn-sm" onClick={async () => {
                            try { const res = await api.put(`/yjrl/news/${article._id}`, { published: true }); setNews(prev => prev.map(n => n._id === article._id ? res.data : n)); toast.success('Article published on the website'); }
                            catch (error) { toast.error(error.response?.data?.error || 'Could not publish article'); }
                          }}>Publish</button>}
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
              <AdminAddPlayer teams={teams} onCreated={player => setPlayers(prev => [...prev, player])} />
            </div>
            <div className="yjrl-card">
              <table className="yjrl-table">
                <thead>
                  <tr><th>Player</th><th>Age Group</th><th>Team</th><th>Guardian</th><th>Status</th><th>Assign</th></tr>
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
                        <td>
                          <select className="yjrl-input" style={{ minWidth: 180 }} value={player.teamId || player.team?._id || ''} onChange={event => updatePlayerTeam(player, event.target.value)}>
                            <option value="">Unassigned</option>
                            {fixtureTeamOptions.map(team => <option key={team.id} value={team.id}>{team.label}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                  {players.length === 0 && !loading && emptyTable(6, <Users size={34} />, 'No player registrations yet', 'Completed registration forms will appear here for review.')}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'communication' && <CommunicationHub />}
        {tab === 'moderation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="yjrl-card">
              <div className="yjrl-card-header">
                <div className="yjrl-card-title"><AlertCircle size={16} /> Safety Reports ({safetyReports.length})</div>
              </div>
              <table className="yjrl-table">
                <thead>
                  <tr><th>Report</th><th>Reporter</th><th>Entity</th><th>Severity</th><th>Status</th><th>Reported</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {safetyReports.map(report => (
                    <tr key={report._id || report.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{report.reason}</div>
                        {report.description && <div style={{ color: 'var(--yjrl-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{report.description}</div>}
                        {report.action_taken && <div style={{ color: '#166534', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: 700 }}>Action: {report.action_taken}</div>}
                      </td>
                      <td>{report.reporter_name || report.reporter_user_id || '-'}</td>
                      <td>
                        <div style={{ textTransform: 'capitalize' }}>{report.category || '-'}</div>
                        <div style={{ color: 'var(--yjrl-muted)', fontSize: '0.75rem' }}>{report.entity_type || 'general'}{report.entity_id ? `:${report.entity_id}` : ''}</div>
                      </td>
                      <td style={{ textTransform: 'capitalize', color: report.severity === 'critical' || report.severity === 'high' ? '#dc2626' : 'var(--yjrl-muted)', fontWeight: 700 }}>{report.severity}</td>
                      <td style={{ textTransform: 'capitalize' }}>{report.status}</td>
                      <td style={{ color: 'var(--yjrl-muted)', fontSize: '0.8rem' }}>{formatDate(report.created_at)}</td>
                      <td>
                        <div style={{ display: 'grid', gap: '0.45rem', minWidth: 220 }}>
                          <textarea
                            className="yjrl-input"
                            rows={2}
                            value={safetyActionNotes[report._id || report.id] ?? ''}
                            placeholder="Action notes required before actioning or closing"
                            onChange={event => setSafetyActionNotes(prev => ({ ...prev, [report._id || report.id]: event.target.value }))}
                            style={{ resize: 'vertical', fontSize: '0.78rem' }}
                          />
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {report.status === 'open' && <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" onClick={() => updateSafetyReport(report, 'triaged')}>Triage</button>}
                          {report.status !== 'actioned' && report.status !== 'closed' && <button className="yjrl-btn yjrl-btn-primary yjrl-btn-sm" onClick={() => updateSafetyReport(report, 'actioned')}>Actioned</button>}
                          {report.status !== 'closed' && <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" onClick={() => updateSafetyReport(report, 'closed')}>Close</button>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {safetyReports.length === 0 && !loading && emptyTable(7, <AlertCircle size={34} />, 'No safety reports', 'Reports submitted from chat and safety tools will appear here.')}
                </tbody>
              </table>
            </div>

            <div className="yjrl-card">
              <div className="yjrl-card-header">
                <div className="yjrl-card-title"><Shield size={16} /> Adult Role Approvals ({adultApprovals.length})</div>
              </div>
              <div className="yjrl-card-body" style={{ display: 'grid', gap: '1rem', borderBottom: '1px solid var(--yjrl-border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <input className="yjrl-input" value={adultInviteForm.firstName} placeholder="First name" onChange={event => setAdultInviteForm(prev => ({ ...prev, firstName: event.target.value }))} />
                  <input className="yjrl-input" value={adultInviteForm.lastName} placeholder="Last name" onChange={event => setAdultInviteForm(prev => ({ ...prev, lastName: event.target.value }))} />
                  <input className="yjrl-input" type="email" value={adultInviteForm.email} placeholder="Email" onChange={event => setAdultInviteForm(prev => ({ ...prev, email: event.target.value }))} />
                  <input className="yjrl-input" value={adultInviteForm.phone} placeholder="Phone" onChange={event => setAdultInviteForm(prev => ({ ...prev, phone: event.target.value }))} />
                  <select className="yjrl-input" value={adultInviteForm.requestedRole} onChange={event => setAdultInviteForm(prev => ({ ...prev, requestedRole: event.target.value }))}>
                    {['coach', 'admin', 'dev'].map(role => <option key={role} value={role}>{role}</option>)}
                  </select>
                  <button className="yjrl-btn yjrl-btn-primary" onClick={createAdultInvite} disabled={!adultInviteForm.firstName || !adultInviteForm.email}>
                    <Plus size={15} /> Create Request
                  </button>
                </div>
                {lastInvite && (
                  <div style={{ padding: '0.75rem', borderRadius: 8, border: '1px solid #facc15', background: '#fefce8', color: '#854d0e', fontSize: '0.85rem', fontWeight: 700 }}>
                    Temporary password for {lastInvite.email}: {lastInvite.temporaryPassword}
                  </div>
                )}
              </div>
              <table className="yjrl-table">
                <thead>
                  <tr><th>Person</th><th>Role</th><th>Blue Card</th><th>Checks</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {adultApprovals.map(approval => {
                    const draft = getApprovalDraft(approval);
                    const name = `${approval.first_name || ''} ${approval.last_name || ''}`.trim() || approval.email || 'Adult account';
                    return (
                      <tr key={approvalKey(approval)}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{name}</div>
                          <div style={{ color: 'var(--yjrl-muted)', fontSize: '0.75rem' }}>{approval.email}</div>
                        </td>
                        <td style={{ textTransform: 'capitalize' }}>{approval.requestedRole || approval.requested_role}</td>
                        <td>
                          <div style={{ display: 'grid', gap: '0.35rem', minWidth: 180 }}>
                            <input className="yjrl-input" value={draft.blueCardReference} placeholder="Reference" onChange={event => setApprovalDraft(approval, 'blueCardReference', event.target.value)} />
                            <select className="yjrl-input" value={draft.blueCardStatus} onChange={event => setApprovalDraft(approval, 'blueCardStatus', event.target.value)}>
                              {['not-provided', 'pending', 'verified', 'expired'].map(status => <option key={status} value={status}>{status}</option>)}
                            </select>
                            <input type="date" className="yjrl-input" value={draft.blueCardExpiry || ''} onChange={event => setApprovalDraft(approval, 'blueCardExpiry', event.target.value)} />
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--yjrl-muted)' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <input type="checkbox" checked={draft.identityChecked} onChange={event => setApprovalDraft(approval, 'identityChecked', event.target.checked)} /> Identity
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <input type="checkbox" checked={draft.safeguardingTrainingCompleted} onChange={event => setApprovalDraft(approval, 'safeguardingTrainingCompleted', event.target.checked)} /> Training
                            </label>
                          </div>
                        </td>
                        <td style={{ textTransform: 'capitalize', fontWeight: 700 }}>{approval.status}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button className="yjrl-btn yjrl-btn-primary yjrl-btn-sm" onClick={() => saveAdultApproval(approval, 'approved')}>Approve</button>
                            <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" onClick={() => saveAdultApproval(approval, 'rejected')}>Reject</button>
                            <button className="yjrl-btn yjrl-btn-danger yjrl-btn-sm" onClick={() => saveAdultApproval(approval, 'suspended')}>Suspend</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {adultApprovals.length === 0 && !loading && emptyTable(6, <Shield size={34} />, 'No adult role requests', 'Coach and staff approvals will appear here before any adult role is activated.')}
                </tbody>
              </table>
            </div>

            <div className="yjrl-card">
              <div className="yjrl-card-header">
                <div className="yjrl-card-title"><Newspaper size={16} /> Upload Review ({uploadRecords.filter(record => record.status === 'pending_review').length})</div>
                <label style={{ fontSize: '0.85rem' }}>
                  {uploadingPhoto ? 'Uploading photo…' : 'Upload a photo for private review'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingPhoto} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; uploadPhoto(file); }} />
                </label>
              </div>
              <table className="yjrl-table">
                <thead>
                  <tr><th>Upload</th><th>Player</th><th>Category</th><th>Consent</th><th>Status</th><th>Uploaded</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {uploadRecords.map(record => (
                    <tr key={record.key}>
                      <td style={{ maxWidth: 260, wordBreak: 'break-word' }}>
                        {record.url ? <a href={record.url} target="_blank" rel="noreferrer" style={{ color: 'var(--yjrl-blue)' }}>{record.key}</a> : record.key}
                        <div style={{ color: 'var(--yjrl-muted)', fontSize: '0.75rem' }}>{record.mimeType || record.mime_type} · {Math.round((record.byteSize || record.byte_size || 0) / 1024)} KB</div>
                        <MediaReviewPreview record={record} onViewed={(key, sha) => setViewedUploads(prev => ({ ...prev, [key]: sha }))} />
                      </td>
                      <td>{(record.playerIds || []).map(id => { const player = players.find(p => (p.id || p._id) === id); return player ? `${player.firstName} ${player.lastName}` : id; }).join(', ') || 'No players identified'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{record.category}</td>
                      <td>{record.consentGranted || record.consent_granted ? 'Granted' : record.consentRequired || record.consent_required ? 'Required' : 'Not required'}</td>
                      <td style={{ textTransform: 'capitalize', fontWeight: 700 }}>{String(record.status || '').replace('_', ' ')}</td>
                      <td style={{ color: 'var(--yjrl-muted)', fontSize: '0.8rem' }}>{formatDate(record.created_at)}</td>
                      <td>
                        <div style={{ display: 'grid', gap: '0.45rem', minWidth: 220 }}>
                          <input
                            className="yjrl-input"
                            value={uploadReviewNotes[record.key] || ''}
                            aria-label="Photo review notes"
                            placeholder="Reviewer notes"
                            onChange={event => setUploadReviewNotes(prev => ({ ...prev, [record.key]: event.target.value }))}
                            style={{ fontSize: '0.78rem' }}
                          />
                          <select className="yjrl-input" aria-label="Who is shown in the photo" value={uploadReviewSubjects[record.key]?.classification || ''} onChange={event => setUploadReviewSubjects(prev => ({ ...prev, [record.key]: { ...prev[record.key], classification: event.target.value, confirmed: false } }))}>
                            <option value="">Who is shown?</option>
                            <option value="children">Children are shown</option>
                            <option value="no-children">No children are shown</option>
                          </select>
                          {uploadReviewSubjects[record.key]?.classification === 'children' && <>
                            <label>Add any other players shown
                              <select multiple className="yjrl-input" value={uploadReviewSubjects[record.key]?.playerIds || []} onChange={event => setUploadReviewSubjects(prev => ({ ...prev, [record.key]: { ...prev[record.key], playerIds: Array.from(event.target.selectedOptions, option => option.value), confirmed: false } }))}>
                                {players.map(player => <option key={player.id || player._id} value={player.id || player._id}>{player.firstName} {player.lastName} ({player.ageGroup})</option>)}
                              </select>
                            </label>
                            <label><input type="checkbox" checked={uploadReviewSubjects[record.key]?.confirmed === true} onChange={event => setUploadReviewSubjects(prev => ({ ...prev, [record.key]: { ...prev[record.key], confirmed: event.target.checked } }))} /> Every child shown is identified above. Reject the image if anyone cannot be identified.</label>
                          </>}
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {record.status === 'pending_review' && <button className="yjrl-btn yjrl-btn-primary yjrl-btn-sm" disabled={viewedUploads[record.key] !== record.sha256} onClick={() => reviewUpload(record, 'approved')}>Approve</button>}
                            {(record.status !== 'rejected' || record.cleanupPending) && <button className="yjrl-btn yjrl-btn-danger yjrl-btn-sm" onClick={() => reviewUpload(record, 'rejected')}>{record.cleanupPending ? 'Retry removal' : 'Reject'}</button>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {uploadRecords.length === 0 && !loading && emptyTable(7, <Newspaper size={34} />, 'No uploads to review', 'Child-related public media uploads will be held here before use.')}
                </tbody>
              </table>
            </div>

            <div className="yjrl-card">
              <div className="yjrl-card-header">
                <div className="yjrl-card-title"><Shield size={16} /> Active Chat Rooms ({visibleRooms.length})</div>
                <div className="admin-toolbar"><input aria-label="Search chat rooms" className="yjrl-input" placeholder="Search team or room" value={roomSearch} onChange={e => setRoomSearch(e.target.value)} />
                  <label>Sort by <select className="yjrl-input" value={roomSort} onChange={e => setRoomSort(e.target.value)}><option value="age">Age group</option><option value="name">Room name</option><option value="type">Room type</option></select></label></div>
              </div>
              <table className="yjrl-table">
                <thead>
                  <tr><th>Room</th><th>Type</th><th>Age Group</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {visibleRooms.map(room => (
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
                  {visibleRooms.length === 0 && !loading && emptyTable(4, <Shield size={34} />, 'No matching chat rooms', 'Try another search or add a team.')}
                </tbody>
              </table>
            </div>

          </div>
        )}
      </div>

      {teamModal && (
        <div className="yjrl-modal-overlay" onClick={() => setTeamModal(false)}>
          <div className="yjrl-modal" onClick={event => event.stopPropagation()}>
            <div className="yjrl-modal-header">
              <div className="yjrl-modal-title">{editingTeam ? 'Edit Team' : 'Add Team'}</div>
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
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Approved Coach Account</label>
                  <select className="yjrl-input" value={teamForm.coachId} onChange={event => {
                    const selected = approvedCoaches.find(coach => coach.id === event.target.value);
                    setTeamForm(prev => ({ ...prev, coachId: event.target.value, coachName: selected?.label || prev.coachName }));
                  }}>
                    <option value="">Unassigned</option>
                    {editingTeam && <option value="__unchanged">Keep current coach</option>}
                    {approvedCoaches.map(coach => <option key={coach.id} value={coach.id}>{coach.label}{coach.email ? ` - ${coach.email}` : ''}</option>)}
                  </select>
                </div>
                {[
                  ['Division', 'division', 'A Grade'],
                  ['Coach Display Name', 'coachName', ''],
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
              <MapLocationFields form={teamForm} setForm={setTeamForm} training />
            </div>
            <div className="yjrl-modal-footer">
              <button className="yjrl-btn yjrl-btn-secondary" onClick={() => setTeamModal(false)}>Cancel</button>
              <button className="yjrl-btn yjrl-btn-primary" onClick={saveTeam} disabled={!teamForm.name}>
                <Save size={15} /> {editingTeam ? 'Save Team' : 'Create Team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {fixtureModal && (
        <div className="yjrl-modal-overlay" onClick={() => setFixtureModal(false)}>
          <div className="yjrl-modal" onClick={event => event.stopPropagation()}>
            <div className="yjrl-modal-header">
              <div className="yjrl-modal-title">{editingFixture ? 'Edit Fixture' : 'Add Fixture'}</div>
              <button onClick={() => setFixtureModal(false)} aria-label="Close fixture form" style={{ background: 'none', border: 'none', color: 'var(--yjrl-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div className="yjrl-modal-body">
              <p>Enter both teams and the date. Use TBC for an unconfirmed opponent.</p>
              {fixtureErrorMessage && <p role="alert" className="yjrl-form-error">{fixtureErrorMessage}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                  <label className="yjrl-label">Team</label>
                  <select disabled={!!editingFixture} className="yjrl-input" value={fixtureForm.teamId || ''} onChange={event => setFixtureForm(prev => ({ ...prev, teamId: event.target.value }))}>
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
              <label className="admin-check"><input type="checkbox" checked={fixtureForm.isHomeGame} onChange={event => setFixtureForm(prev => ({ ...prev, isHomeGame: event.target.checked }))} />Yeppoon is the home team</label>
              <MapLocationFields form={fixtureForm} setForm={setFixtureForm} />
            </div>
            <div className="yjrl-modal-footer">
              <button className="yjrl-btn yjrl-btn-secondary" onClick={() => setFixtureModal(false)}>Cancel</button>
              <button className="yjrl-btn yjrl-btn-primary" onClick={saveFixture} disabled={savingFixture}>
                <Save size={15} /> {savingFixture ? 'Saving…' : editingFixture ? 'Save Fixture' : 'Create Fixture'}
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
                    Feature on homepage when published
                  </label>
                </div>
              </div>
              <p role="status" style={{ margin: 0 }}>{newsForm.published ? 'Saving will publish this article on the public News page.' : 'This is a draft. Tick Publish immediately to show it on the website.'}</p>
              <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                <label className="yjrl-label">Excerpt</label>
                <input type="text" className="yjrl-input" value={newsForm.excerpt} onChange={event => setNewsForm(prev => ({ ...prev, excerpt: event.target.value }))} />
              </div>
              <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                <label className="yjrl-label" htmlFor="news-reviewed-image">Reviewed photo (optional)</label>
                <select id="news-reviewed-image" className="yjrl-input" value={newsForm.image || ''} onChange={event => setNewsForm(prev => ({ ...prev, image: event.target.value }))}>
                  <option value="">No photo</option>
                  {uploadRecords.filter(record => record.status === 'approved' && record.url).map(record => <option key={record.key} value={record.url}>{record.reviewNotes || record.key}</option>)}
                </select>
                {newsForm.image && <img src={newsForm.image} alt="Selected article" style={{ display: 'block', maxWidth: '100%', maxHeight: 200, marginTop: 12 }} />}
                <ArticlePhotoUpload players={players} onRecords={setUploadRecords} onBusy={setArticlePhotoBusy} onApproved={record => { setNewsForm(prev => ({ ...prev, image: record.url })); setUploadRecords(prev => prev.map(item => item.key === record.key ? record : item)); toast.success('Photo added to article'); }} />
              </div>
              <div className="yjrl-form-group" style={{ marginBottom: 0 }}>
                <label className="yjrl-label">Content</label>
                <textarea className="yjrl-input" rows={8} style={{ resize: 'vertical' }} value={newsForm.content} onChange={event => setNewsForm(prev => ({ ...prev, content: event.target.value }))} />
              </div>
            </div>
            <div className="yjrl-modal-footer">
              <button className="yjrl-btn yjrl-btn-secondary" onClick={() => setNewsModal(false)}>Cancel</button>
              <button className="yjrl-btn yjrl-btn-primary" onClick={saveNews} disabled={articlePhotoBusy || !newsForm.title.trim() || !newsForm.content.trim()}>
                <Save size={15} /> {newsForm.published ? 'Publish Article' : 'Save Draft'}
              </button>
            </div>
          </div>
        </div>
      )}
    </YJRLLayout>
  );
};

export default YJRLAdminPortal;
