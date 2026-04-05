import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Trophy, Calendar, Newspaper, Plus, Edit, Trash2, Save,
  BarChart3, Shield, Bell, Settings, DollarSign, X, CheckCircle,
  Search, Download, RefreshCw, Eye, Award, UserPlus, ChevronDown,
  AlertTriangle, FileText, TrendingUp, MapPin, Clock, Lock,
  Star, ShoppingBag, Gift, Ticket, ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';
import api from '../../api';
import toast from 'react-hot-toast';
import YJRLLayout from './YJRLLayout';
import './yjrl.css';

const SEASON = new Date().getFullYear().toString();
const AGE_GROUPS = ['U6','U7','U8','U9','U10','U11','U12','U13','U14','U15','U16','U17','U18','Womens','Mens'];
const ROLES = ['player','parent','coach','admin'];
const EMPTY_TEAM = { name:'', ageGroup:'U14', division:'', season:SEASON, coachName:'', managerName:'', trainingDay:'', trainingTime:'', trainingVenue:'Nev Skuse Oval' };
const EMPTY_FIXTURE = { ageGroup:'U14', round:1, homeTeamName:'Yeppoon Seagulls', awayTeamName:'', date:'', time:'', venue:'Nev Skuse Oval', status:'scheduled', isHomeGame:true, season:SEASON };
const EMPTY_NEWS = { title:'', content:'', excerpt:'', category:'news', published:false, featured:false };
const EMPTY_USER = { firstName:'', lastName:'', email:'', password:'', role:'coach', phone:'' };
const EMPTY_SPONSOR = { name:'', logo:'', website:'', description:'', tier:'bronze', contactName:'', contactEmail:'', contactPhone:'', sortOrder:0 };
const EMPTY_MERCH = { name:'', description:'', price:0, image:'', category:'apparel', sizes:[], inStock:true, externalUrl:'', sortOrder:0 };
const EMPTY_RAFFLE = { title:'', description:'', image:'', prizeDescription:'', ticketPrice:0, externalUrl:'', drawDate:'', status:'active' };
const EMPTY_CARNIVAL = { title:'', description:'', image:'', date:'', endDate:'', time:'', venue:'', address:'', ageGroups:[], maxTeams:'', entryFee:0, externalUrl:'', contactName:'', contactEmail:'', status:'open' };
const SPONSOR_TIERS = ['platinum','gold','silver','bronze','community'];
const MERCH_CATEGORIES = ['apparel','accessories','equipment','other'];

// Reusable Modal component
const Modal = ({ title, onClose, width, children, footer }) => (
  <div className="yjrl-modal-overlay" onClick={onClose}>
    <div className="yjrl-modal" style={{ maxWidth: width || 560 }} onClick={e => e.stopPropagation()}>
      <div className="yjrl-modal-header">
        <div className="yjrl-modal-title">{title}</div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--yjrl-muted)', cursor:'pointer' }}><X size={18} /></button>
      </div>
      <div className="yjrl-modal-body">{children}</div>
      {footer && <div className="yjrl-modal-footer">{footer}</div>}
    </div>
  </div>
);

// Reusable search/filter bar
const FilterBar = ({ search, onSearch, children }) => (
  <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1.5rem', flexWrap:'wrap', alignItems:'center' }}>
    <div style={{ position:'relative', flex:'1', minWidth:200 }}>
      <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--yjrl-muted)' }} />
      <input type="text" className="yjrl-input" style={{ paddingLeft:34, margin:0 }} placeholder="Search..." value={search} onChange={e => onSearch(e.target.value)} />
    </div>
    {children}
  </div>
);

const YJRLAdminPortal = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);

  // Dashboard
  const [dashboard, setDashboard] = useState(null);

  // Users
  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userModal, setUserModal] = useState(false);
  const [userForm, setUserForm] = useState(EMPTY_USER);
  const [editingUser, setEditingUser] = useState(null);
  const [resetPwModal, setResetPwModal] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  // Players
  const [players, setPlayers] = useState([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [playerAgeFilter, setPlayerAgeFilter] = useState('');
  const [playerTeamFilter, setPlayerTeamFilter] = useState('');
  const [playerModal, setPlayerModal] = useState(null); // player object or null
  const [awardModal, setAwardModal] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [selectedAchievement, setSelectedAchievement] = useState('');

  // Teams
  const [teams, setTeams] = useState([]);
  const [teamModal, setTeamModal] = useState(false);
  const [teamForm, setTeamForm] = useState(EMPTY_TEAM);
  const [editingTeam, setEditingTeam] = useState(null);
  const [coaches, setCoaches] = useState([]);

  // Fixtures
  const [fixtures, setFixtures] = useState([]);
  const [fixtureModal, setFixtureModal] = useState(false);
  const [fixtureForm, setFixtureForm] = useState(EMPTY_FIXTURE);
  const [resultModal, setResultModal] = useState(null);
  const [resultForm, setResultForm] = useState({ homeScore:0, awayScore:0, manOfMatchName:'' });
  const [fixtureAgeFilter, setFixtureAgeFilter] = useState('');

  // News
  const [news, setNews] = useState([]);
  const [newsModal, setNewsModal] = useState(false);
  const [newsForm, setNewsForm] = useState(EMPTY_NEWS);
  const [editingNews, setEditingNews] = useState(null);

  // Registrations
  const [registrations, setRegistrations] = useState([]);
  const [regStatusFilter, setRegStatusFilter] = useState('');

  // Settings & Moderation
  const [settings, setSettings] = useState({});
  const [flaggedMessages, setFlaggedMessages] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [chatRooms, setChatRooms] = useState([]);

  // Sponsors
  const [sponsors, setSponsors] = useState([]);
  const [sponsorModal, setSponsorModal] = useState(false);
  const [sponsorForm, setSponsorForm] = useState(EMPTY_SPONSOR);
  const [editingSponsor, setEditingSponsor] = useState(null);

  // Merch
  const [merch, setMerch] = useState([]);
  const [merchModal, setMerchModal] = useState(false);
  const [merchForm, setMerchForm] = useState(EMPTY_MERCH);
  const [editingMerch, setEditingMerch] = useState(null);

  // Raffles
  const [raffles, setRaffles] = useState([]);
  const [raffleModal, setRaffleModal] = useState(false);
  const [raffleForm, setRaffleForm] = useState(EMPTY_RAFFLE);
  const [editingRaffle, setEditingRaffle] = useState(null);

  // Carnivals
  const [carnivals, setCarnivals] = useState([]);
  const [carnivalModal, setCarnivalModal] = useState(false);
  const [carnivalForm, setCarnivalForm] = useState(EMPTY_CARNIVAL);
  const [editingCarnival, setEditingCarnival] = useState(null);
  const [carnivalRegs, setCarnivalRegs] = useState(null); // viewing registrations

  const isAdmin = user && (user.role === 'admin' || user.role === 'dev');

  // ─── DATA LOADING ──────────────────────────────────────────────────────────

  const loadDashboard = useCallback(() => {
    api.get(`/admin/dashboard?season=${SEASON}`).then(r => setDashboard(r.data)).catch(() => {});
  }, []);

  const loadUsers = useCallback(() => {
    let url = `/admin/users?limit=100`;
    if (userSearch) url += `&search=${encodeURIComponent(userSearch)}`;
    if (userRoleFilter) url += `&role=${userRoleFilter}`;
    api.get(url).then(r => { setUsers(r.data.users || []); setUsersTotal(r.data.total || 0); }).catch(() => {});
  }, [userSearch, userRoleFilter]);

  const loadPlayers = useCallback(() => {
    let url = '/yjrl/players?';
    if (playerAgeFilter) url += `ageGroup=${playerAgeFilter}&`;
    if (playerTeamFilter) url += `teamId=${playerTeamFilter}&`;
    api.get(url).then(r => setPlayers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [playerAgeFilter, playerTeamFilter]);

  const loadTeams = useCallback(() => {
    api.get(`/yjrl/teams?season=${SEASON}`).then(r => setTeams(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const loadFixtures = useCallback(() => {
    let url = `/yjrl/fixtures?season=${SEASON}`;
    if (fixtureAgeFilter) url += `&ageGroup=${fixtureAgeFilter}`;
    api.get(url).then(r => setFixtures(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [fixtureAgeFilter]);

  const loadNews = useCallback(() => {
    api.get('/yjrl/news/all').then(r => setNews(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const loadRegistrations = useCallback(() => {
    let url = `/admin/registrations?season=${SEASON}`;
    if (regStatusFilter) url += `&status=${regStatusFilter}`;
    api.get(url).then(r => setRegistrations(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [regStatusFilter]);

  const loadSettings = useCallback(() => {
    Promise.all([
      api.get('/admin/settings').catch(() => ({ data: {} })),
      api.get('/admin/chat/flagged').catch(() => ({ data: [] })),
      api.get('/admin/audit-log?limit=30').catch(() => ({ data: [] })),
      api.get('/yjrl/chat/rooms').catch(() => ({ data: [] })),
    ]).then(([sRes, fRes, aRes, cRes]) => {
      setSettings(sRes.data || {});
      setFlaggedMessages(Array.isArray(fRes.data) ? fRes.data : []);
      setAuditLog(Array.isArray(aRes.data) ? aRes.data : []);
      setChatRooms(Array.isArray(cRes.data) ? cRes.data : []);
    });
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    Promise.all([
      api.get(`/admin/dashboard?season=${SEASON}`).catch(() => ({ data: null })),
      api.get('/yjrl/achievements').catch(() => ({ data: [] })),
      api.get('/admin/users?role=coach&limit=100').catch(() => ({ data: { users: [] } })),
    ]).then(([dRes, achRes, coachRes]) => {
      if (dRes.data) setDashboard(dRes.data);
      if (Array.isArray(achRes.data)) setAchievements(achRes.data);
      if (coachRes.data?.users) setCoaches(coachRes.data.users);
    }).finally(() => setLoading(false));
  }, [isAdmin]);

  useEffect(() => { if (tab === 'dashboard' && isAdmin) loadDashboard(); }, [tab, isAdmin, loadDashboard]);
  useEffect(() => { if (tab === 'users' && isAdmin) loadUsers(); }, [tab, isAdmin, loadUsers]);
  useEffect(() => { if (tab === 'players' && isAdmin) loadPlayers(); }, [tab, isAdmin, loadPlayers]);
  useEffect(() => { if (tab === 'teams' && isAdmin) loadTeams(); }, [tab, isAdmin, loadTeams]);
  useEffect(() => { if (tab === 'fixtures' && isAdmin) loadFixtures(); }, [tab, isAdmin, loadFixtures]);
  useEffect(() => { if (tab === 'news' && isAdmin) loadNews(); }, [tab, isAdmin, loadNews]);
  useEffect(() => { if (tab === 'registrations' && isAdmin) loadRegistrations(); }, [tab, isAdmin, loadRegistrations]);
  useEffect(() => { if (tab === 'settings' && isAdmin) loadSettings(); }, [tab, isAdmin, loadSettings]);

  const loadSponsors = useCallback(() => { api.get('/yjrl/club/sponsors').then(r => setSponsors(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, []);
  const loadMerch = useCallback(() => { api.get('/yjrl/club/merch').then(r => setMerch(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, []);
  const loadRaffles = useCallback(() => { api.get('/yjrl/club/raffles').then(r => setRaffles(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, []);
  const loadCarnivals = useCallback(() => { api.get('/yjrl/club/carnivals').then(r => setCarnivals(Array.isArray(r.data) ? r.data : [])).catch(() => {}); }, []);
  useEffect(() => { if (tab === 'sponsors' && isAdmin) loadSponsors(); }, [tab, isAdmin, loadSponsors]);
  useEffect(() => { if (tab === 'merch' && isAdmin) loadMerch(); }, [tab, isAdmin, loadMerch]);
  useEffect(() => { if (tab === 'raffles' && isAdmin) loadRaffles(); }, [tab, isAdmin, loadRaffles]);
  useEffect(() => { if (tab === 'carnivals' && isAdmin) loadCarnivals(); }, [tab, isAdmin, loadCarnivals]);

  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/portal/player" />;

  // ─── ACTIONS ───────────────────────────────────────────────────────────────

  const exportCSV = (type) => {
    window.open(`${api.defaults.baseURL}/admin/export/${type}?season=${SEASON}`, '_blank');
  };

  // User actions
  const saveUser = async () => {
    try {
      if (editingUser) {
        const res = await api.put(`/admin/users/${editingUser}`, userForm);
        setUsers(prev => prev.map(u => u._id === editingUser ? res.data : u));
        toast.success('User updated');
      } else {
        await api.post('/admin/users', userForm);
        toast.success('User created');
        loadUsers();
      }
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); return; }
    setUserModal(false); setUserForm(EMPTY_USER); setEditingUser(null);
  };

  const toggleUserActive = async (u) => {
    try {
      await api.put(`/admin/users/${u._id}`, { isActive: !u.isActive });
      setUsers(prev => prev.map(x => x._id === u._id ? { ...x, isActive: !x.isActive, is_active: !x.isActive ? 1 : 0 } : x));
      toast.success(u.isActive ? 'User deactivated' : 'User activated');
    } catch { toast.error('Failed'); }
  };

  const changeUserRole = async (u, role) => {
    try {
      await api.put(`/admin/users/${u._id}`, { role });
      setUsers(prev => prev.map(x => x._id === u._id ? { ...x, role } : x));
      toast.success(`Role changed to ${role}`);
    } catch { toast.error('Failed'); }
  };

  const resetPassword = async () => {
    if (!newPassword || newPassword.length < 6) { toast.error('Min 6 characters'); return; }
    try {
      await api.post(`/admin/users/${resetPwModal}/reset-password`, { newPassword });
      toast.success('Password reset');
    } catch { toast.error('Failed'); }
    setResetPwModal(null); setNewPassword('');
  };

  // Team actions
  const saveTeam = async () => {
    try {
      if (editingTeam) {
        const res = await api.put(`/yjrl/teams/${editingTeam}`, teamForm);
        setTeams(prev => prev.map(t => t._id === editingTeam ? res.data : t));
        toast.success('Team updated');
      } else {
        const res = await api.post('/yjrl/teams', teamForm);
        setTeams(prev => [...prev, res.data]);
        toast.success('Team created');
      }
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); return; }
    setTeamModal(false); setTeamForm(EMPTY_TEAM); setEditingTeam(null);
  };

  const deleteTeam = async (id) => {
    if (!window.confirm('Deactivate this team?')) return;
    try { await api.delete(`/yjrl/teams/${id}`); setTeams(prev => prev.filter(t => t._id !== id)); toast.success('Team deactivated'); } catch { toast.error('Failed'); }
  };

  const openEditTeam = (t) => {
    setEditingTeam(t._id);
    setTeamForm({ name:t.name, ageGroup:t.ageGroup, division:t.division||'', season:t.season||SEASON, coachName:t.coachName||'', managerName:t.managerName||'', trainingDay:t.trainingDay||'', trainingTime:t.trainingTime||'', trainingVenue:t.trainingVenue||'Nev Skuse Oval', coach_id:t.coach_id||'' });
    setTeamModal(true);
  };

  // Fixture actions
  const saveFixture = async () => {
    try {
      const res = await api.post('/yjrl/fixtures', fixtureForm);
      setFixtures(prev => [res.data, ...prev]);
      toast.success('Fixture created');
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); return; }
    setFixtureModal(false); setFixtureForm(EMPTY_FIXTURE);
  };

  const saveResult = async () => {
    try {
      await api.put(`/yjrl/fixtures/${resultModal._id}`, { ...resultForm, status:'completed' });
      toast.success('Result saved');
      loadFixtures();
    } catch (e) { toast.error('Failed'); }
    setResultModal(null);
  };

  const deleteFixture = async (id) => {
    if (!window.confirm('Remove this fixture?')) return;
    try { await api.delete(`/yjrl/fixtures/${id}`); setFixtures(prev => prev.filter(f => f._id !== id)); toast.success('Removed'); } catch { toast.error('Failed'); }
  };

  // News actions
  const saveNews = async () => {
    try {
      if (editingNews) {
        const res = await api.put(`/yjrl/news/${editingNews}`, newsForm);
        setNews(prev => prev.map(n => n._id === editingNews ? res.data : n));
      } else {
        const res = await api.post('/yjrl/news', newsForm);
        setNews(prev => [res.data, ...prev]);
      }
      toast.success(editingNews ? 'Updated' : 'Created');
    } catch (e) { toast.error('Failed'); return; }
    setNewsModal(false); setNewsForm(EMPTY_NEWS); setEditingNews(null);
  };

  const deleteNews = async (id) => {
    if (!window.confirm('Remove this article?')) return;
    try { await api.delete(`/yjrl/news/${id}`); setNews(prev => prev.filter(n => n._id !== id)); toast.success('Removed'); } catch { toast.error('Failed'); }
  };

  // Registration actions
  const updateRegStatus = async (id, status) => {
    try {
      await api.put(`/admin/registrations/${id}`, { paymentStatus: status });
      toast.success(`Registration marked as ${status}`);
      loadRegistrations();
    } catch { toast.error('Failed'); }
  };

  // Player actions
  const assignTeam = async (playerId, teamId) => {
    try {
      await api.put(`/yjrl/players/${playerId}`, { teamId });
      toast.success('Team assigned');
      loadPlayers();
    } catch { toast.error('Failed'); }
  };

  const awardAchievement = async () => {
    if (!selectedAchievement || !awardModal) return;
    try {
      await api.post(`/yjrl/players/${awardModal}/achievements`, { achievementId: selectedAchievement, season: SEASON });
      toast.success('Achievement awarded!');
    } catch { toast.error('Failed'); }
    setAwardModal(null); setSelectedAchievement('');
  };

  // Settings
  const saveSetting = async (key, value) => {
    try {
      await api.put('/admin/settings', { [key]: value });
      setSettings(prev => ({ ...prev, [key]: value }));
      toast.success('Setting saved');
    } catch { toast.error('Failed'); }
  };

  // Chat moderation
  const deleteChatMsg = async (id) => {
    try { await api.delete(`/admin/chat/${id}`); setFlaggedMessages(prev => prev.filter(m => m.id !== id)); toast.success('Message deleted'); } catch { toast.error('Failed'); }
  };

  // Sponsor CRUD
  const saveSponsor = async () => {
    try {
      if (editingSponsor) { await api.put(`/yjrl/club/sponsors/${editingSponsor}`, sponsorForm); toast.success('Sponsor updated'); }
      else { await api.post('/yjrl/club/sponsors', sponsorForm); toast.success('Sponsor added'); }
      loadSponsors();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); return; }
    setSponsorModal(false); setSponsorForm(EMPTY_SPONSOR); setEditingSponsor(null);
  };
  const deleteSponsor = async (id) => { if (!window.confirm('Remove sponsor?')) return; try { await api.delete(`/yjrl/club/sponsors/${id}`); loadSponsors(); toast.success('Removed'); } catch { toast.error('Failed'); } };

  // Merch CRUD
  const saveMerchItem = async () => {
    try {
      if (editingMerch) { await api.put(`/yjrl/club/merch/${editingMerch}`, merchForm); toast.success('Item updated'); }
      else { await api.post('/yjrl/club/merch', merchForm); toast.success('Item added'); }
      loadMerch();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); return; }
    setMerchModal(false); setMerchForm(EMPTY_MERCH); setEditingMerch(null);
  };
  const deleteMerchItem = async (id) => { if (!window.confirm('Remove item?')) return; try { await api.delete(`/yjrl/club/merch/${id}`); loadMerch(); toast.success('Removed'); } catch { toast.error('Failed'); } };

  // Raffle CRUD
  const saveRaffle = async () => {
    try {
      if (editingRaffle) { await api.put(`/yjrl/club/raffles/${editingRaffle}`, raffleForm); toast.success('Raffle updated'); }
      else { await api.post('/yjrl/club/raffles', raffleForm); toast.success('Raffle created'); }
      loadRaffles();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); return; }
    setRaffleModal(false); setRaffleForm(EMPTY_RAFFLE); setEditingRaffle(null);
  };
  const deleteRaffle = async (id) => { if (!window.confirm('Remove raffle?')) return; try { await api.delete(`/yjrl/club/raffles/${id}`); loadRaffles(); toast.success('Removed'); } catch { toast.error('Failed'); } };

  // Carnival CRUD
  const saveCarnival = async () => {
    try {
      if (editingCarnival) { await api.put(`/yjrl/club/carnivals/${editingCarnival}`, carnivalForm); toast.success('Carnival updated'); }
      else { await api.post('/yjrl/club/carnivals', carnivalForm); toast.success('Carnival created'); }
      loadCarnivals();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); return; }
    setCarnivalModal(false); setCarnivalForm(EMPTY_CARNIVAL); setEditingCarnival(null);
  };
  const deleteCarnival = async (id) => { if (!window.confirm('Remove carnival?')) return; try { await api.delete(`/yjrl/club/carnivals/${id}`); loadCarnivals(); toast.success('Removed'); } catch { toast.error('Failed'); } };
  const viewCarnivalRegs = async (id) => {
    try { const res = await api.get(`/yjrl/club/carnivals/${id}`); setCarnivalRegs(res.data); } catch { toast.error('Failed'); }
  };

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  const filteredPlayers = players.filter(p => {
    if (playerSearch) {
      const s = playerSearch.toLowerCase();
      if (!(p.firstName?.toLowerCase().includes(s) || p.lastName?.toLowerCase().includes(s) || p.guardianName?.toLowerCase().includes(s))) return false;
    }
    return true;
  });

  const d = dashboard || {};
  const totalRevenue = d.revenue || 0;
  const regPending = d.registrations?.pending || 0;
  const regPaid = d.registrations?.paid || 0;
  const regOffline = d.registrations?.offline || 0;

  // ─── RENDER ────────────────────────────────────────────────────────────────

  const TABS = [
    ['dashboard','Dashboard'],['users','Users'],['players','Players'],['teams','Teams'],
    ['fixtures','Fixtures'],['news','News'],['registrations','Registrations'],
    ['sponsors','Sponsors'],['merch','Store'],['raffles','Raffles'],['carnivals','Carnivals'],
    ['settings','Settings']
  ];

  return (
    <YJRLLayout>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg, #172554, #1d4ed8)', color:'white', padding:'3rem 1.5rem 0', borderBottom:'1px solid var(--yjrl-border)' }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'1rem', paddingBottom:'1.5rem', flexWrap:'wrap' }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg, var(--yjrl-gold), #d4840a)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem' }}>🏆</div>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.25rem' }}>
                <h1 style={{ fontSize:'1.6rem', fontWeight:900, margin:0, textTransform:'uppercase' }}>Club Admin</h1>
                <span className="yjrl-role-badge admin">Admin</span>
              </div>
              <div style={{ color:'rgba(255,255,255,0.7)', fontSize:'0.875rem' }}>Yeppoon Junior Rugby League · {SEASON} Season</div>
            </div>
          </div>
          <div className="yjrl-tabs yjrl-tabs-dark" style={{ overflowX:'auto' }}>
            {TABS.map(([k, l]) => (
              <button key={k} className={`yjrl-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1280, margin:'0 auto', padding:'2rem 1.5rem' }}>

        {/* ═══════════════ DASHBOARD ═══════════════ */}
        {tab === 'dashboard' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
            <div className="yjrl-grid-4">
              {[
                { icon:DollarSign, value:`$${totalRevenue.toLocaleString()}`, label:'Revenue', color:'#10b981' },
                { icon:Users, value:d.totalPlayers||0, label:'Players Registered', color:'#60a5fa' },
                { icon:Trophy, value:d.totalTeams||0, label:'Active Teams', color:'var(--yjrl-gold)' },
                { icon:Calendar, value:d.upcomingFixtures||0, label:'Upcoming Games', color:'#a78bfa' },
              ].map((item, i) => (
                <div key={i} className="yjrl-stat-card">
                  <div className="yjrl-stat-icon" style={{ color:item.color }}><item.icon size={20} /></div>
                  <span className="yjrl-stat-value" style={{ color:item.color }}>{item.value}</span>
                  <span className="yjrl-stat-label">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Registration Pipeline */}
            <div className="yjrl-card">
              <div className="yjrl-card-header"><div className="yjrl-card-title"><TrendingUp size={16} /> Registration Pipeline</div></div>
              <div style={{ padding:'1.25rem', display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'1rem' }}>
                {[
                  { label:'Pending', value:regPending, color:'#f59e0b', bg:'rgba(245,158,11,0.1)' },
                  { label:'Paid (PayPal)', value:regPaid, color:'#10b981', bg:'rgba(16,185,129,0.1)' },
                  { label:'Offline Payment', value:regOffline, color:'#60a5fa', bg:'rgba(96,165,250,0.1)' },
                ].map((s, i) => (
                  <div key={i} style={{ background:s.bg, borderRadius:'10px', padding:'1.25rem', textAlign:'center' }}>
                    <div style={{ fontSize:'2rem', fontWeight:900, color:s.color }}>{s.value}</div>
                    <div style={{ fontSize:'0.8rem', color:'var(--yjrl-muted)', fontWeight:600 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue by Age Group */}
            {d.revenueByAge?.length > 0 && (
              <div className="yjrl-card">
                <div className="yjrl-card-header"><div className="yjrl-card-title"><DollarSign size={16} /> Revenue by Age Group</div></div>
                <table className="yjrl-table">
                  <thead><tr><th>Age Group</th><th>Registrations</th><th>Revenue</th></tr></thead>
                  <tbody>
                    {d.revenueByAge.map((r, i) => (
                      <tr key={i}><td style={{ fontWeight:600 }}>{r.age_group}</td><td>{r.count}</td><td style={{ color:'#10b981', fontWeight:700 }}>${r.total}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Attendance + Quick Actions */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>
              <div className="yjrl-card" style={{ padding:'1.5rem', textAlign:'center' }}>
                <div style={{ fontSize:'0.8rem', color:'var(--yjrl-muted)', fontWeight:600, marginBottom:'0.5rem' }}>Attendance Rate (90 days)</div>
                <div style={{ fontSize:'3rem', fontWeight:900, color: (d.attendanceRate||0) >= 80 ? '#10b981' : '#f59e0b' }}>{d.attendanceRate||0}%</div>
              </div>
              <div className="yjrl-card" style={{ padding:'1.5rem' }}>
                <div style={{ fontSize:'0.8rem', color:'var(--yjrl-muted)', fontWeight:600, marginBottom:'0.75rem' }}>Quick Actions</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
                  {[
                    { label:'Add Team', onClick:() => { setTeamForm(EMPTY_TEAM); setEditingTeam(null); setTeamModal(true); setTab('teams'); } },
                    { label:'Add Fixture', onClick:() => { setFixtureForm(EMPTY_FIXTURE); setFixtureModal(true); setTab('fixtures'); } },
                    { label:'Write News', onClick:() => { setNewsForm(EMPTY_NEWS); setEditingNews(null); setNewsModal(true); setTab('news'); } },
                    { label:'Export Data', onClick:() => setTab('settings') },
                  ].map((a, i) => (
                    <button key={i} className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" onClick={a.onClick} style={{ justifyContent:'center' }}>{a.label}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            {d.recentActions?.length > 0 && (
              <div className="yjrl-card">
                <div className="yjrl-card-header"><div className="yjrl-card-title"><FileText size={16} /> Recent Activity</div></div>
                <div style={{ maxHeight:250, overflow:'auto' }}>
                  {d.recentActions.slice(0, 10).map((a, i) => (
                    <div key={i} style={{ padding:'0.75rem 1.25rem', borderBottom:'1px solid var(--yjrl-border)', fontSize:'0.85rem', display:'flex', justifyContent:'space-between' }}>
                      <span><strong>{a.user_name}</strong> {a.action.replace(/_/g, ' ')} <span style={{ color:'var(--yjrl-muted)' }}>({a.entity_type})</span></span>
                      <span style={{ color:'var(--yjrl-muted)', fontSize:'0.75rem' }}>{new Date(a.created_at).toLocaleString('en-AU')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ USERS ═══════════════ */}
        {tab === 'users' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:800, textTransform:'uppercase' }}>Users ({usersTotal})</h2>
              <button className="yjrl-btn yjrl-btn-primary" onClick={() => { setUserForm(EMPTY_USER); setEditingUser(null); setUserModal(true); }}><UserPlus size={15} /> Create User</button>
            </div>
            <FilterBar search={userSearch} onSearch={setUserSearch}>
              <select className="yjrl-input" style={{ width:'auto', margin:0 }} value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)}>
                <option value="">All Roles</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </FilterBar>
            <div className="yjrl-card">
              <table className="yjrl-table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id}>
                      <td style={{ fontWeight:600 }}>{u.firstName} {u.lastName}</td>
                      <td style={{ color:'var(--yjrl-muted)', fontSize:'0.85rem' }}>{u.email}</td>
                      <td>
                        <select className="yjrl-input" style={{ width:'auto', margin:0, padding:'0.2rem 0.4rem', fontSize:'0.75rem' }}
                          value={u.role} onChange={e => changeUserRole(u, e.target.value)}>
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td>
                        <button onClick={() => toggleUserActive(u)} style={{
                          background:'none', border:'none', cursor:'pointer', fontSize:'0.75rem', fontWeight:700,
                          color: u.isActive ? '#10b981' : '#f87171'
                        }}>{u.isActive ? 'Active' : 'Inactive'}</button>
                      </td>
                      <td style={{ color:'var(--yjrl-muted)', fontSize:'0.8rem' }}>{new Date(u.created_at).toLocaleDateString('en-AU')}</td>
                      <td>
                        <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" onClick={() => { setResetPwModal(u._id); setNewPassword(''); }} title="Reset password"><Lock size={12} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && <div style={{ padding:'3rem', textAlign:'center', color:'var(--yjrl-muted)' }}>No users found.</div>}
            </div>
          </div>
        )}

        {/* ═══════════════ PLAYERS ═══════════════ */}
        {tab === 'players' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:800, textTransform:'uppercase' }}>Players ({filteredPlayers.length})</h2>
              <button className="yjrl-btn yjrl-btn-secondary" onClick={() => exportCSV('players')}><Download size={14} /> Export CSV</button>
            </div>
            <FilterBar search={playerSearch} onSearch={setPlayerSearch}>
              <select className="yjrl-input" style={{ width:'auto', margin:0 }} value={playerAgeFilter} onChange={e => setPlayerAgeFilter(e.target.value)}>
                <option value="">All Ages</option>
                {AGE_GROUPS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select className="yjrl-input" style={{ width:'auto', margin:0 }} value={playerTeamFilter} onChange={e => setPlayerTeamFilter(e.target.value)}>
                <option value="">All Teams</option>
                {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            </FilterBar>
            <div className="yjrl-card">
              <table className="yjrl-table">
                <thead><tr><th>Name</th><th>Age</th><th>Team</th><th>#</th><th>Status</th><th>Guardian</th><th></th></tr></thead>
                <tbody>
                  {filteredPlayers.map(p => (
                    <tr key={p._id}>
                      <td style={{ fontWeight:600 }}>{p.firstName} {p.lastName}</td>
                      <td>{p.ageGroup}</td>
                      <td>
                        <select className="yjrl-input" style={{ width:'auto', margin:0, padding:'0.2rem 0.4rem', fontSize:'0.75rem' }}
                          value={p.teamId || p.team_id || ''} onChange={e => assignTeam(p._id, e.target.value)}>
                          <option value="">Unassigned</option>
                          {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                        </select>
                      </td>
                      <td style={{ color:'var(--yjrl-muted)' }}>{p.jerseyNumber || '—'}</td>
                      <td>
                        <span style={{ fontSize:'0.7rem', padding:'0.15rem 0.5rem', borderRadius:'100px', fontWeight:600,
                          background: p.registrationStatus === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                          color: p.registrationStatus === 'active' ? '#10b981' : '#f59e0b'
                        }}>{p.registrationStatus || 'pending'}</span>
                      </td>
                      <td style={{ fontSize:'0.8rem', color:'var(--yjrl-muted)' }}>{p.guardianName || '—'}</td>
                      <td>
                        <div style={{ display:'flex', gap:'0.3rem' }}>
                          <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" onClick={() => setPlayerModal(p)} title="View/Edit"><Edit size={12} /></button>
                          <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" onClick={() => { setAwardModal(p._id); setSelectedAchievement(''); }} title="Award achievement"><Award size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredPlayers.length === 0 && <div style={{ padding:'3rem', textAlign:'center', color:'var(--yjrl-muted)' }}>No players found.</div>}
            </div>
          </div>
        )}

        {/* ═══════════════ TEAMS ═══════════════ */}
        {tab === 'teams' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
              <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:800, textTransform:'uppercase' }}>Teams ({teams.length})</h2>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button className="yjrl-btn yjrl-btn-secondary" onClick={() => exportCSV('teams')}><Download size={14} /> Export</button>
                <button className="yjrl-btn yjrl-btn-primary" onClick={() => { setTeamForm(EMPTY_TEAM); setEditingTeam(null); setTeamModal(true); }}><Plus size={15} /> Add Team</button>
              </div>
            </div>
            <div className="yjrl-grid-3">
              {teams.map(team => (
                <div key={team._id} className="yjrl-card">
                  <div className="yjrl-card-header">
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg, var(--yjrl-gold), #d4840a)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'var(--yjrl-navy)', fontSize:'0.8rem' }}>
                        {(team.ageGroup||'').replace('U','').substring(0,2)}
                      </div>
                      <div>
                        <div style={{ fontWeight:700, fontSize:'0.9rem' }}>{team.name}</div>
                        <div style={{ fontSize:'0.75rem', color:'var(--yjrl-muted)' }}>{team.ageGroup}</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'0.3rem' }}>
                      <button onClick={() => openEditTeam(team)} style={{ background:'none', border:'none', color:'#60a5fa', cursor:'pointer' }}><Edit size={14} /></button>
                      <button onClick={() => deleteTeam(team._id)} style={{ background:'none', border:'none', color:'#f87171', cursor:'pointer' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="yjrl-card-body" style={{ padding:'1rem 1.25rem' }}>
                    <div style={{ fontSize:'0.825rem', color:'var(--yjrl-muted)', marginBottom:'0.5rem' }}>
                      Coach: <strong style={{ color:'var(--yjrl-text)' }}>{team.coachName || '—'}</strong>
                    </div>
                    <div style={{ fontSize:'0.825rem', color:'var(--yjrl-muted)', marginBottom:'0.75rem' }}>
                      {team.trainingDay && <span><Clock size={11} /> {team.trainingDay} {team.trainingTime}</span>}
                    </div>
                    <div style={{ display:'flex', gap:'0.75rem', fontSize:'0.85rem' }}>
                      <span style={{ color:'#4ade80', fontWeight:700 }}>{team.wins}W</span>
                      <span style={{ color:'var(--yjrl-muted)' }}>–</span>
                      <span style={{ color:'#f87171', fontWeight:700 }}>{team.losses}L</span>
                      <span style={{ color:'var(--yjrl-muted)' }}>–</span>
                      <span>{team.draws}D</span>
                      <span style={{ marginLeft:'auto', color:'var(--yjrl-muted)' }}>{team.players?.length || 0} players</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════ FIXTURES ═══════════════ */}
        {tab === 'fixtures' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:800, textTransform:'uppercase' }}>Fixtures ({fixtures.length})</h2>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button className="yjrl-btn yjrl-btn-secondary" onClick={() => exportCSV('fixtures')}><Download size={14} /> Export</button>
                <button className="yjrl-btn yjrl-btn-primary" onClick={() => { setFixtureForm(EMPTY_FIXTURE); setFixtureModal(true); }}><Plus size={15} /> Add Fixture</button>
              </div>
            </div>
            <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'1.5rem' }}>
              <button onClick={() => setFixtureAgeFilter('')} className={`yjrl-btn yjrl-btn-sm ${!fixtureAgeFilter ? 'yjrl-btn-primary' : 'yjrl-btn-secondary'}`}>All</button>
              {AGE_GROUPS.map(ag => (
                <button key={ag} onClick={() => setFixtureAgeFilter(ag)} className={`yjrl-btn yjrl-btn-sm ${fixtureAgeFilter === ag ? 'yjrl-btn-primary' : 'yjrl-btn-secondary'}`}>{ag}</button>
              ))}
            </div>
            <div className="yjrl-card">
              <table className="yjrl-table">
                <thead><tr><th>Rnd</th><th>Age</th><th>Home</th><th>Score</th><th>Away</th><th>Date</th><th>Venue</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {fixtures.map(f => (
                    <tr key={f._id}>
                      <td style={{ fontWeight:800 }}>{f.round}</td>
                      <td>{f.ageGroup}</td>
                      <td style={{ fontWeight: f.isHomeGame ? 700 : 400 }}>{f.homeTeamName}</td>
                      <td style={{ fontWeight:900, color:'var(--yjrl-gold)', textAlign:'center' }}>
                        {f.status === 'completed' ? `${f.homeScore} – ${f.awayScore}` : 'vs'}
                      </td>
                      <td style={{ fontWeight: !f.isHomeGame ? 700 : 400 }}>{f.awayTeamName}</td>
                      <td style={{ fontSize:'0.8rem', color:'var(--yjrl-muted)' }}>{new Date(f.date).toLocaleDateString('en-AU')} {f.time}</td>
                      <td style={{ fontSize:'0.8rem', color:'var(--yjrl-muted)' }}>{f.venue}</td>
                      <td>
                        <span style={{ fontSize:'0.7rem', padding:'0.15rem 0.5rem', borderRadius:'100px', fontWeight:600,
                          background: f.status === 'completed' ? 'rgba(16,185,129,0.1)' : f.status === 'scheduled' ? 'rgba(96,165,250,0.1)' : 'rgba(248,113,113,0.1)',
                          color: f.status === 'completed' ? '#10b981' : f.status === 'scheduled' ? '#60a5fa' : '#f87171'
                        }}>{f.status}</span>
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:'0.3rem' }}>
                          {f.status === 'scheduled' && (
                            <button className="yjrl-btn yjrl-btn-primary yjrl-btn-sm" onClick={() => { setResultModal(f); setResultForm({ homeScore:0, awayScore:0, manOfMatchName:'' }); }}>
                              Enter Result
                            </button>
                          )}
                          <button className="yjrl-btn yjrl-btn-danger yjrl-btn-sm" onClick={() => deleteFixture(f._id)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {fixtures.length === 0 && <div style={{ padding:'3rem', textAlign:'center', color:'var(--yjrl-muted)' }}>No fixtures found. Create your first fixture!</div>}
            </div>
          </div>
        )}

        {/* ═══════════════ NEWS ═══════════════ */}
        {tab === 'news' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1.5rem' }}>
              <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:800, textTransform:'uppercase' }}>News ({news.length})</h2>
              <button className="yjrl-btn yjrl-btn-primary" onClick={() => { setNewsForm(EMPTY_NEWS); setEditingNews(null); setNewsModal(true); }}><Plus size={15} /> Write Article</button>
            </div>
            <div className="yjrl-card">
              <table className="yjrl-table">
                <thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Views</th><th>Date</th><th></th></tr></thead>
                <tbody>
                  {news.map(a => (
                    <tr key={a._id}>
                      <td style={{ fontWeight:600, maxWidth:300 }}>{a.title}</td>
                      <td><span style={{ fontSize:'0.75rem', padding:'0.2rem 0.5rem', borderRadius:'100px', background:'rgba(240,165,0,0.1)', color:'var(--yjrl-gold)', fontWeight:600 }}>{a.category}</span></td>
                      <td><span style={{ fontSize:'0.75rem', padding:'0.2rem 0.5rem', borderRadius:'100px', background: a.published ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.07)', color: a.published ? '#4ade80' : 'var(--yjrl-muted)', fontWeight:600 }}>{a.published ? 'Published' : 'Draft'}</span></td>
                      <td style={{ color:'var(--yjrl-muted)' }}>{a.views || 0}</td>
                      <td style={{ color:'var(--yjrl-muted)', fontSize:'0.8rem' }}>{new Date(a.publishDate || a.publish_date).toLocaleDateString('en-AU')}</td>
                      <td>
                        <div style={{ display:'flex', gap:'0.3rem' }}>
                          <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" onClick={() => { setEditingNews(a._id); setNewsForm({ title:a.title, content:a.content, excerpt:a.excerpt, category:a.category, published:a.published, featured:a.featured }); setNewsModal(true); }}><Edit size={12} /></button>
                          <button className="yjrl-btn yjrl-btn-danger yjrl-btn-sm" onClick={() => deleteNews(a._id)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {news.length === 0 && <div style={{ padding:'3rem', textAlign:'center', color:'var(--yjrl-muted)' }}>No articles yet.</div>}
            </div>
          </div>
        )}

        {/* ═══════════════ REGISTRATIONS ═══════════════ */}
        {tab === 'registrations' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:800, textTransform:'uppercase' }}>Registrations</h2>
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button className="yjrl-btn yjrl-btn-secondary" onClick={() => exportCSV('registrations')}><Download size={14} /> Export</button>
                <button className="yjrl-btn yjrl-btn-secondary" onClick={() => exportCSV('financials')}><DollarSign size={14} /> Financials</button>
              </div>
            </div>
            <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.5rem', flexWrap:'wrap' }}>
              {['','pending','paid','offline','refunded'].map(s => (
                <button key={s} onClick={() => setRegStatusFilter(s)} className={`yjrl-btn yjrl-btn-sm ${regStatusFilter === s ? 'yjrl-btn-primary' : 'yjrl-btn-secondary'}`}>
                  {s || 'All'}
                </button>
              ))}
            </div>
            <div className="yjrl-card">
              <table className="yjrl-table">
                <thead><tr><th>Player</th><th>Age</th><th>Guardian</th><th>Fee</th><th>Status</th><th>Date</th><th></th></tr></thead>
                <tbody>
                  {registrations.map(r => (
                    <tr key={r._id}>
                      <td style={{ fontWeight:600 }}>{r.playerName}</td>
                      <td>{r.ageGroup}</td>
                      <td style={{ fontSize:'0.8rem', color:'var(--yjrl-muted)' }}>{r.guardianName || '—'}</td>
                      <td style={{ fontWeight:700 }}>${r.feeAmount}{r.discountAmount > 0 && <span style={{ color:'#10b981', fontSize:'0.75rem' }}> (-${r.discountAmount})</span>}</td>
                      <td>
                        <span style={{ fontSize:'0.7rem', padding:'0.15rem 0.5rem', borderRadius:'100px', fontWeight:600,
                          background: r.paymentStatus === 'paid' ? 'rgba(16,185,129,0.1)' : r.paymentStatus === 'pending' ? 'rgba(245,158,11,0.1)' : 'rgba(96,165,250,0.1)',
                          color: r.paymentStatus === 'paid' ? '#10b981' : r.paymentStatus === 'pending' ? '#f59e0b' : '#60a5fa'
                        }}>{r.paymentStatus}</span>
                      </td>
                      <td style={{ fontSize:'0.8rem', color:'var(--yjrl-muted)' }}>{new Date(r.created_at).toLocaleDateString('en-AU')}</td>
                      <td>
                        <div style={{ display:'flex', gap:'0.3rem' }}>
                          {r.paymentStatus !== 'paid' && (
                            <button className="yjrl-btn yjrl-btn-primary yjrl-btn-sm" onClick={() => updateRegStatus(r._id, 'paid')}>Mark Paid</button>
                          )}
                          {r.paymentStatus === 'paid' && (
                            <button className="yjrl-btn yjrl-btn-danger yjrl-btn-sm" onClick={() => updateRegStatus(r._id, 'refunded')}>Refund</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {registrations.length === 0 && <div style={{ padding:'3rem', textAlign:'center', color:'var(--yjrl-muted)' }}>No registrations found.</div>}
            </div>
          </div>
        )}

        {/* ═══════════════ SETTINGS & MODERATION ═══════════════ */}
        {tab === 'settings' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
            {/* Season & Registration */}
            <div className="yjrl-card">
              <div className="yjrl-card-header"><div className="yjrl-card-title"><Settings size={16} /> Season Settings</div></div>
              <div style={{ padding:'1.25rem', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem' }}>
                <div className="yjrl-form-group" style={{ margin:0 }}>
                  <label className="yjrl-label">Current Season</label>
                  <input className="yjrl-input" value={settings.current_season || SEASON} onChange={e => setSettings(p => ({ ...p, current_season: e.target.value }))} onBlur={e => saveSetting('current_season', e.target.value)} />
                </div>
                <div className="yjrl-form-group" style={{ margin:0 }}>
                  <label className="yjrl-label">Early Bird Cutoff</label>
                  <input type="date" className="yjrl-input" value={settings.early_bird_cutoff || '2026-02-28'} onChange={e => { setSettings(p => ({ ...p, early_bird_cutoff: e.target.value })); saveSetting('early_bird_cutoff', e.target.value); }} />
                </div>
                <div className="yjrl-form-group" style={{ margin:0 }}>
                  <label className="yjrl-label">Early Bird Discount ($)</label>
                  <input className="yjrl-input" value={settings.early_bird_discount || '20'} onChange={e => setSettings(p => ({ ...p, early_bird_discount: e.target.value }))} onBlur={e => saveSetting('early_bird_discount', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Fee Schedule */}
            <div className="yjrl-card">
              <div className="yjrl-card-header"><div className="yjrl-card-title"><DollarSign size={16} /> Fee Schedule</div></div>
              <div style={{ padding:'1.25rem', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))', gap:'0.75rem' }}>
                {AGE_GROUPS.map(ag => (
                  <div key={ag} className="yjrl-form-group" style={{ margin:0 }}>
                    <label className="yjrl-label">{ag}</label>
                    <input className="yjrl-input" type="number" value={settings[`fees_${ag}`] || ''} onChange={e => setSettings(p => ({ ...p, [`fees_${ag}`]: e.target.value }))} onBlur={e => saveSetting(`fees_${ag}`, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>

            {/* Chat Moderation */}
            <div className="yjrl-card">
              <div className="yjrl-card-header">
                <div className="yjrl-card-title"><Shield size={16} /> Chat Moderation</div>
                <span style={{ fontSize:'0.8rem', color:'var(--yjrl-muted)' }}>{chatRooms.length} rooms · {flaggedMessages.length} flagged</span>
              </div>
              {flaggedMessages.length > 0 ? (
                <table className="yjrl-table">
                  <thead><tr><th>Room</th><th>User</th><th>Message</th><th>Time</th><th></th></tr></thead>
                  <tbody>
                    {flaggedMessages.map(m => (
                      <tr key={m.id}>
                        <td style={{ fontSize:'0.8rem' }}>{m.room_id}</td>
                        <td style={{ fontWeight:600 }}>{m.user_name}</td>
                        <td style={{ maxWidth:300, color:'#f87171' }}>{m.message}</td>
                        <td style={{ fontSize:'0.75rem', color:'var(--yjrl-muted)' }}>{new Date(m.created_at).toLocaleString('en-AU')}</td>
                        <td><button className="yjrl-btn yjrl-btn-danger yjrl-btn-sm" onClick={() => deleteChatMsg(m.id)}><Trash2 size={12} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding:'2rem', textAlign:'center', color:'var(--yjrl-muted)' }}>
                  <CheckCircle size={28} style={{ color:'#10b981', marginBottom:'0.5rem' }} />
                  <div style={{ fontWeight:600 }}>All Clear — No flagged messages</div>
                </div>
              )}
            </div>

            {/* Data Export */}
            <div className="yjrl-card">
              <div className="yjrl-card-header"><div className="yjrl-card-title"><Download size={16} /> Data Export</div></div>
              <div style={{ padding:'1.25rem', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:'0.75rem' }}>
                {[
                  { type:'players', label:'Players', icon:Users },
                  { type:'teams', label:'Teams', icon:Shield },
                  { type:'fixtures', label:'Fixtures', icon:Calendar },
                  { type:'registrations', label:'Registrations', icon:FileText },
                  { type:'financials', label:'Financials', icon:DollarSign },
                ].map(e => (
                  <button key={e.type} className="yjrl-btn yjrl-btn-secondary" onClick={() => exportCSV(e.type)} style={{ justifyContent:'center' }}>
                    <e.icon size={14} /> {e.label} CSV
                  </button>
                ))}
              </div>
            </div>

            {/* Audit Log */}
            <div className="yjrl-card">
              <div className="yjrl-card-header"><div className="yjrl-card-title"><FileText size={16} /> Audit Log</div></div>
              <div style={{ maxHeight:300, overflow:'auto' }}>
                {auditLog.length > 0 ? auditLog.map((a, i) => (
                  <div key={i} style={{ padding:'0.65rem 1.25rem', borderBottom:'1px solid var(--yjrl-border)', fontSize:'0.825rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span><strong>{a.user_name}</strong> — {a.action.replace(/_/g, ' ')} <span style={{ color:'var(--yjrl-muted)' }}>({a.entity_type})</span></span>
                    <span style={{ color:'var(--yjrl-muted)', fontSize:'0.72rem', whiteSpace:'nowrap', marginLeft:'1rem' }}>{new Date(a.created_at).toLocaleString('en-AU')}</span>
                  </div>
                )) : (
                  <div style={{ padding:'2rem', textAlign:'center', color:'var(--yjrl-muted)' }}>No activity yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* ═══════════════ SPONSORS ═══════════════ */}
        {tab === 'sponsors' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
              <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:800, textTransform:'uppercase' }}>Sponsors ({sponsors.length})</h2>
              <button className="yjrl-btn yjrl-btn-primary" onClick={() => { setSponsorForm(EMPTY_SPONSOR); setEditingSponsor(null); setSponsorModal(true); }}><Plus size={15} /> Add Sponsor</button>
            </div>
            <div className="yjrl-card">
              <table className="yjrl-table">
                <thead><tr><th>Name</th><th>Tier</th><th>Website</th><th>Contact</th><th></th></tr></thead>
                <tbody>
                  {sponsors.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight:600 }}>{s.logo ? <img src={s.logo} alt="" style={{ width:24, height:24, borderRadius:4, objectFit:'contain', marginRight:8, verticalAlign:'middle' }} /> : null}{s.name}</td>
                      <td><span style={{ fontSize:'0.7rem', padding:'0.15rem 0.5rem', borderRadius:'100px', fontWeight:700, textTransform:'capitalize',
                        background: s.tier === 'platinum' ? '#f3f4f6' : s.tier === 'gold' ? 'rgba(251,191,36,0.15)' : s.tier === 'silver' ? 'rgba(148,163,184,0.15)' : s.tier === 'bronze' ? 'rgba(205,127,50,0.15)' : 'rgba(96,165,250,0.15)',
                        color: s.tier === 'gold' ? '#b45309' : s.tier === 'platinum' ? '#374151' : s.tier === 'bronze' ? '#92400e' : '#3b82f6'
                      }}>{s.tier}</span></td>
                      <td style={{ fontSize:'0.8rem', color:'var(--yjrl-muted)' }}>{s.website ? <a href={s.website} target="_blank" rel="noopener noreferrer" style={{ color:'#60a5fa' }}>{s.website.replace(/https?:\/\//, '').slice(0,30)}</a> : '—'}</td>
                      <td style={{ fontSize:'0.8rem', color:'var(--yjrl-muted)' }}>{s.contact_name || '—'}</td>
                      <td>
                        <div style={{ display:'flex', gap:'0.3rem' }}>
                          <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" onClick={() => { setEditingSponsor(s.id); setSponsorForm({ name:s.name, logo:s.logo, website:s.website, description:s.description, tier:s.tier, contactName:s.contact_name, contactEmail:s.contact_email, contactPhone:s.contact_phone, sortOrder:s.sort_order||0 }); setSponsorModal(true); }}><Edit size={12} /></button>
                          <button className="yjrl-btn yjrl-btn-danger yjrl-btn-sm" onClick={() => deleteSponsor(s.id)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sponsors.length === 0 && <div style={{ padding:'3rem', textAlign:'center', color:'var(--yjrl-muted)' }}>No sponsors yet. Add your first sponsor!</div>}
            </div>
          </div>
        )}

        {/* ═══════════════ MERCH STORE ═══════════════ */}
        {tab === 'merch' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
              <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:800, textTransform:'uppercase' }}>Store Items ({merch.length})</h2>
              <button className="yjrl-btn yjrl-btn-primary" onClick={() => { setMerchForm(EMPTY_MERCH); setEditingMerch(null); setMerchModal(true); }}><Plus size={15} /> Add Item</button>
            </div>
            <div className="yjrl-card">
              <table className="yjrl-table">
                <thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Sizes</th><th>Stock</th><th>Link</th><th></th></tr></thead>
                <tbody>
                  {merch.map(m => (
                    <tr key={m.id || m._id}>
                      <td style={{ fontWeight:600 }}>{m.name}</td>
                      <td style={{ textTransform:'capitalize', fontSize:'0.8rem' }}>{m.category}</td>
                      <td style={{ fontWeight:700, color:'#10b981' }}>${m.price}</td>
                      <td style={{ fontSize:'0.75rem', color:'var(--yjrl-muted)' }}>{(m.sizes || []).join(', ') || '—'}</td>
                      <td>{m.inStock || m.in_stock ? <span style={{ color:'#10b981', fontWeight:600, fontSize:'0.8rem' }}>In Stock</span> : <span style={{ color:'#f87171', fontWeight:600, fontSize:'0.8rem' }}>Out</span>}</td>
                      <td style={{ fontSize:'0.75rem' }}>{(m.externalUrl || m.external_url) ? <a href={m.externalUrl || m.external_url} target="_blank" rel="noopener noreferrer" style={{ color:'#60a5fa' }}>Link</a> : '—'}</td>
                      <td>
                        <div style={{ display:'flex', gap:'0.3rem' }}>
                          <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" onClick={() => { setEditingMerch(m.id || m._id); setMerchForm({ name:m.name, description:m.description, price:m.price, image:m.image, category:m.category, sizes:m.sizes||[], inStock:!!(m.inStock||m.in_stock), externalUrl:m.externalUrl||m.external_url||'', sortOrder:m.sort_order||0 }); setMerchModal(true); }}><Edit size={12} /></button>
                          <button className="yjrl-btn yjrl-btn-danger yjrl-btn-sm" onClick={() => deleteMerchItem(m.id || m._id)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {merch.length === 0 && <div style={{ padding:'3rem', textAlign:'center', color:'var(--yjrl-muted)' }}>No store items yet. Add your first product!</div>}
            </div>
          </div>
        )}

        {/* ═══════════════ RAFFLES ═══════════════ */}
        {tab === 'raffles' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
              <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:800, textTransform:'uppercase' }}>Raffles ({raffles.length})</h2>
              <button className="yjrl-btn yjrl-btn-primary" onClick={() => { setRaffleForm(EMPTY_RAFFLE); setEditingRaffle(null); setRaffleModal(true); }}><Plus size={15} /> Create Raffle</button>
            </div>
            <div className="yjrl-card">
              <table className="yjrl-table">
                <thead><tr><th>Title</th><th>Prize</th><th>Ticket $</th><th>Draw Date</th><th>Status</th><th>Winner</th><th></th></tr></thead>
                <tbody>
                  {raffles.map(r => (
                    <tr key={r.id || r._id}>
                      <td style={{ fontWeight:600 }}>{r.title}</td>
                      <td style={{ fontSize:'0.8rem', maxWidth:200, color:'var(--yjrl-muted)' }}>{r.prizeDescription || r.prize_description || '—'}</td>
                      <td style={{ fontWeight:700 }}>${r.ticketPrice || r.ticket_price || 0}</td>
                      <td style={{ fontSize:'0.8rem', color:'var(--yjrl-muted)' }}>{(r.drawDate || r.draw_date) ? new Date(r.drawDate || r.draw_date).toLocaleDateString('en-AU') : '—'}</td>
                      <td><span style={{ fontSize:'0.7rem', padding:'0.15rem 0.5rem', borderRadius:'100px', fontWeight:600, textTransform:'capitalize',
                        background: r.status === 'active' ? 'rgba(16,185,129,0.1)' : r.status === 'drawn' ? 'rgba(245,158,11,0.1)' : 'rgba(148,163,184,0.1)',
                        color: r.status === 'active' ? '#10b981' : r.status === 'drawn' ? '#f59e0b' : '#94a3b8'
                      }}>{r.status}</span></td>
                      <td style={{ fontWeight:600, color:'var(--yjrl-gold)' }}>{r.winnerName || r.winner_name || '—'}</td>
                      <td>
                        <div style={{ display:'flex', gap:'0.3rem' }}>
                          <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" onClick={() => { setEditingRaffle(r.id || r._id); setRaffleForm({ title:r.title, description:r.description, image:r.image, prizeDescription:r.prizeDescription||r.prize_description||'', ticketPrice:r.ticketPrice||r.ticket_price||0, externalUrl:r.externalUrl||r.external_url||'', drawDate:r.drawDate||r.draw_date||'', status:r.status, winnerName:r.winnerName||r.winner_name||'' }); setRaffleModal(true); }}><Edit size={12} /></button>
                          <button className="yjrl-btn yjrl-btn-danger yjrl-btn-sm" onClick={() => deleteRaffle(r.id || r._id)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {raffles.length === 0 && <div style={{ padding:'3rem', textAlign:'center', color:'var(--yjrl-muted)' }}>No raffles yet. Create your first raffle!</div>}
            </div>
          </div>
        )}

        {/* ═══════════════ CARNIVALS ═══════════════ */}
        {tab === 'carnivals' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem' }}>
              <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:800, textTransform:'uppercase' }}>Carnivals ({carnivals.length})</h2>
              <button className="yjrl-btn yjrl-btn-primary" onClick={() => { setCarnivalForm(EMPTY_CARNIVAL); setEditingCarnival(null); setCarnivalModal(true); }}><Plus size={15} /> Create Carnival</button>
            </div>
            <div className="yjrl-card">
              <table className="yjrl-table">
                <thead><tr><th>Title</th><th>Date</th><th>Venue</th><th>Fee</th><th>Teams</th><th>Regs</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {carnivals.map(car => (
                    <tr key={car.id || car._id}>
                      <td style={{ fontWeight:600 }}>{car.title}</td>
                      <td style={{ fontSize:'0.8rem', color:'var(--yjrl-muted)' }}>{new Date(car.date).toLocaleDateString('en-AU')}</td>
                      <td style={{ fontSize:'0.8rem', color:'var(--yjrl-muted)' }}>{car.venue || '—'}</td>
                      <td style={{ fontWeight:700 }}>{(car.entryFee || car.entry_fee) > 0 ? `$${car.entryFee || car.entry_fee}` : 'Free'}</td>
                      <td style={{ color:'var(--yjrl-muted)' }}>{car.maxTeams || car.max_teams || '—'}</td>
                      <td style={{ fontWeight:700, color:'#60a5fa', cursor:'pointer' }} onClick={() => viewCarnivalRegs(car.id || car._id)}>{car.registrationCount ?? 0}</td>
                      <td><span style={{ fontSize:'0.7rem', padding:'0.15rem 0.5rem', borderRadius:'100px', fontWeight:600, textTransform:'capitalize',
                        background: car.status === 'open' ? 'rgba(16,185,129,0.1)' : car.status === 'closed' ? 'rgba(245,158,11,0.1)' : 'rgba(148,163,184,0.1)',
                        color: car.status === 'open' ? '#10b981' : car.status === 'closed' ? '#f59e0b' : '#94a3b8'
                      }}>{car.status}</span></td>
                      <td>
                        <div style={{ display:'flex', gap:'0.3rem' }}>
                          <button className="yjrl-btn yjrl-btn-secondary yjrl-btn-sm" onClick={() => { setEditingCarnival(car.id || car._id); setCarnivalForm({ title:car.title, description:car.description, image:car.image||'', date:car.date, endDate:car.endDate||car.end_date||'', time:car.time||'', venue:car.venue||'', address:car.address||'', ageGroups:car.ageGroups||[], maxTeams:car.maxTeams||car.max_teams||'', entryFee:car.entryFee||car.entry_fee||0, externalUrl:car.externalUrl||car.external_url||'', contactName:car.contactName||car.contact_name||'', contactEmail:car.contactEmail||car.contact_email||'', status:car.status }); setCarnivalModal(true); }}><Edit size={12} /></button>
                          <button className="yjrl-btn yjrl-btn-danger yjrl-btn-sm" onClick={() => deleteCarnival(car.id || car._id)}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {carnivals.length === 0 && <div style={{ padding:'3rem', textAlign:'center', color:'var(--yjrl-muted)' }}>No carnivals yet. Create your first tournament!</div>}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════ MODALS ═══════════════ */}

      {/* Create/Edit User Modal */}
      {userModal && (
        <Modal title={editingUser ? 'Edit User' : 'Create User'} onClose={() => setUserModal(false)} footer={
          <><button className="yjrl-btn yjrl-btn-secondary" onClick={() => setUserModal(false)}>Cancel</button>
          <button className="yjrl-btn yjrl-btn-primary" onClick={saveUser} disabled={!userForm.firstName || !userForm.email || (!editingUser && !userForm.password)}>
            <Save size={15} /> {editingUser ? 'Update' : 'Create'}
          </button></>
        }>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">First Name</label><input className="yjrl-input" value={userForm.firstName} onChange={e => setUserForm(p => ({ ...p, firstName:e.target.value }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Last Name</label><input className="yjrl-input" value={userForm.lastName} onChange={e => setUserForm(p => ({ ...p, lastName:e.target.value }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Email</label><input className="yjrl-input" type="email" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email:e.target.value }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Role</label>
              <select className="yjrl-input" value={userForm.role} onChange={e => setUserForm(p => ({ ...p, role:e.target.value }))}>{ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select>
            </div>
            {!editingUser && <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Password</label><input className="yjrl-input" type="password" value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password:e.target.value }))} /></div>}
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Phone</label><input className="yjrl-input" value={userForm.phone} onChange={e => setUserForm(p => ({ ...p, phone:e.target.value }))} /></div>
          </div>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {resetPwModal && (
        <Modal title="Reset Password" onClose={() => setResetPwModal(null)} footer={
          <><button className="yjrl-btn yjrl-btn-secondary" onClick={() => setResetPwModal(null)}>Cancel</button>
          <button className="yjrl-btn yjrl-btn-primary" onClick={resetPassword} disabled={!newPassword || newPassword.length < 6}><Lock size={15} /> Reset</button></>
        }>
          <div className="yjrl-form-group" style={{ margin:0 }}>
            <label className="yjrl-label">New Password (min 6 chars)</label>
            <input className="yjrl-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password..." />
          </div>
        </Modal>
      )}

      {/* Team Modal */}
      {teamModal && (
        <Modal title={editingTeam ? 'Edit Team' : 'Add Team'} onClose={() => setTeamModal(false)} footer={
          <><button className="yjrl-btn yjrl-btn-secondary" onClick={() => setTeamModal(false)}>Cancel</button>
          <button className="yjrl-btn yjrl-btn-primary" onClick={saveTeam} disabled={!teamForm.name}><Save size={15} /> {editingTeam ? 'Update' : 'Create'}</button></>
        }>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            {[
              ['Team Name','name','text','e.g. Yeppoon Seagulls U14'],
              ['Age Group','ageGroup','select',AGE_GROUPS],
              ['Division','division','text','e.g. A Grade'],
              ['Coach Name','coachName','text',''],
              ['Manager Name','managerName','text',''],
              ['Training Days','trainingDay','text','e.g. Tue & Thu'],
              ['Training Time','trainingTime','text','e.g. 5:00 PM'],
              ['Training Venue','trainingVenue','text',''],
            ].map(([label, key, type, placeholder]) => (
              <div key={key} className="yjrl-form-group" style={{ margin:0 }}>
                <label className="yjrl-label">{label}</label>
                {type === 'select' ? (
                  <select className="yjrl-input" value={teamForm[key]} onChange={e => setTeamForm(p => ({ ...p, [key]:e.target.value }))}>{placeholder.map(o => <option key={o} value={o}>{o}</option>)}</select>
                ) : (
                  <input className="yjrl-input" value={teamForm[key]} placeholder={placeholder} onChange={e => setTeamForm(p => ({ ...p, [key]:e.target.value }))} />
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Fixture Modal */}
      {fixtureModal && (
        <Modal title="Add Fixture" onClose={() => setFixtureModal(false)} footer={
          <><button className="yjrl-btn yjrl-btn-secondary" onClick={() => setFixtureModal(false)}>Cancel</button>
          <button className="yjrl-btn yjrl-btn-primary" onClick={saveFixture} disabled={!fixtureForm.awayTeamName || !fixtureForm.date}><Save size={15} /> Create</button></>
        }>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Age Group</label>
              <select className="yjrl-input" value={fixtureForm.ageGroup} onChange={e => setFixtureForm(p => ({ ...p, ageGroup:e.target.value }))}>{AGE_GROUPS.map(a => <option key={a} value={a}>{a}</option>)}</select>
            </div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Round</label>
              <input className="yjrl-input" type="number" value={fixtureForm.round} onChange={e => setFixtureForm(p => ({ ...p, round:parseInt(e.target.value)||1 }))} />
            </div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Home Team</label>
              <input className="yjrl-input" value={fixtureForm.homeTeamName} onChange={e => setFixtureForm(p => ({ ...p, homeTeamName:e.target.value }))} />
            </div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Away Team</label>
              <input className="yjrl-input" value={fixtureForm.awayTeamName} onChange={e => setFixtureForm(p => ({ ...p, awayTeamName:e.target.value }))} placeholder="Opposition team..." />
            </div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Date</label>
              <input className="yjrl-input" type="date" value={fixtureForm.date} onChange={e => setFixtureForm(p => ({ ...p, date:e.target.value }))} />
            </div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Time</label>
              <input className="yjrl-input" value={fixtureForm.time} placeholder="e.g. 10:00 AM" onChange={e => setFixtureForm(p => ({ ...p, time:e.target.value }))} />
            </div>
            <div className="yjrl-form-group" style={{ margin:0, gridColumn:'1/-1' }}><label className="yjrl-label">Venue</label>
              <input className="yjrl-input" value={fixtureForm.venue} onChange={e => setFixtureForm(p => ({ ...p, venue:e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}

      {/* Enter Result Modal */}
      {resultModal && (
        <Modal title={`Enter Result — ${resultModal.homeTeamName} vs ${resultModal.awayTeamName}`} onClose={() => setResultModal(null)} footer={
          <><button className="yjrl-btn yjrl-btn-secondary" onClick={() => setResultModal(null)}>Cancel</button>
          <button className="yjrl-btn yjrl-btn-primary" onClick={saveResult}><Save size={15} /> Save Result</button></>
        }>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">{resultModal.homeTeamName} Score</label>
              <input className="yjrl-input" type="number" value={resultForm.homeScore} onChange={e => setResultForm(p => ({ ...p, homeScore:parseInt(e.target.value)||0 }))} />
            </div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">{resultModal.awayTeamName} Score</label>
              <input className="yjrl-input" type="number" value={resultForm.awayScore} onChange={e => setResultForm(p => ({ ...p, awayScore:parseInt(e.target.value)||0 }))} />
            </div>
            <div className="yjrl-form-group" style={{ margin:0, gridColumn:'1/-1' }}><label className="yjrl-label">Man of the Match</label>
              <input className="yjrl-input" value={resultForm.manOfMatchName} placeholder="Player name..." onChange={e => setResultForm(p => ({ ...p, manOfMatchName:e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}

      {/* News Modal */}
      {newsModal && (
        <Modal title={editingNews ? 'Edit Article' : 'New Article'} width={680} onClose={() => setNewsModal(false)} footer={
          <><button className="yjrl-btn yjrl-btn-secondary" onClick={() => setNewsModal(false)}>Cancel</button>
          <button className="yjrl-btn yjrl-btn-primary" onClick={saveNews} disabled={!newsForm.title || !newsForm.content}><Save size={15} /> {editingNews ? 'Update' : 'Publish'}</button></>
        }>
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Title</label><input className="yjrl-input" value={newsForm.title} onChange={e => setNewsForm(p => ({ ...p, title:e.target.value }))} /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Category</label>
                <select className="yjrl-input" value={newsForm.category} onChange={e => setNewsForm(p => ({ ...p, category:e.target.value }))}>{['news','results','events','club','pathways','community','sponsors'].map(c => <option key={c} value={c}>{c}</option>)}</select>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem', paddingTop:'1.5rem' }}>
                <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', cursor:'pointer', fontSize:'0.85rem', color:'var(--yjrl-muted)' }}>
                  <input type="checkbox" checked={newsForm.published} onChange={e => setNewsForm(p => ({ ...p, published:e.target.checked }))} /> Publish
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', cursor:'pointer', fontSize:'0.85rem', color:'var(--yjrl-muted)' }}>
                  <input type="checkbox" checked={newsForm.featured} onChange={e => setNewsForm(p => ({ ...p, featured:e.target.checked }))} /> Featured
                </label>
              </div>
            </div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Excerpt</label><input className="yjrl-input" value={newsForm.excerpt} onChange={e => setNewsForm(p => ({ ...p, excerpt:e.target.value }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Content</label><textarea className="yjrl-input" rows={8} style={{ resize:'vertical' }} value={newsForm.content} onChange={e => setNewsForm(p => ({ ...p, content:e.target.value }))} /></div>
          </div>
        </Modal>
      )}

      {/* Player Detail Modal */}
      {playerModal && (
        <Modal title={`${playerModal.firstName} ${playerModal.lastName}`} width={600} onClose={() => setPlayerModal(null)} footer={
          <button className="yjrl-btn yjrl-btn-secondary" onClick={() => setPlayerModal(null)}>Close</button>
        }>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', fontSize:'0.875rem' }}>
            {[
              ['Age Group', playerModal.ageGroup],
              ['Position', playerModal.position || '—'],
              ['Jersey #', playerModal.jerseyNumber || '—'],
              ['Status', playerModal.registrationStatus],
              ['Guardian', playerModal.guardianName || '—'],
              ['Guardian Phone', playerModal.guardianPhone || playerModal.guardian_phone || '—'],
              ['Guardian Email', playerModal.guardianEmail || playerModal.guardian_email || '—'],
              ['Medical Notes', playerModal.medicalNotes || playerModal.medical_notes || 'None'],
              ['Pathway', playerModal.pathwayProgress?.level || playerModal.pathway_level || 'grassroots'],
              ['Team', playerModal.team?.name || playerModal.team_name || 'Unassigned'],
            ].map(([label, value]) => (
              <div key={label}><div style={{ color:'var(--yjrl-muted)', fontSize:'0.75rem', fontWeight:600, marginBottom:'0.15rem' }}>{label}</div><div style={{ fontWeight:600 }}>{value}</div></div>
            ))}
          </div>
        </Modal>
      )}

      {/* Award Achievement Modal */}
      {awardModal && (
        <Modal title="Award Achievement" onClose={() => setAwardModal(null)} footer={
          <><button className="yjrl-btn yjrl-btn-secondary" onClick={() => setAwardModal(null)}>Cancel</button>
          <button className="yjrl-btn yjrl-btn-primary" onClick={awardAchievement} disabled={!selectedAchievement}><Award size={15} /> Award</button></>
        }>
          <div className="yjrl-form-group" style={{ margin:0 }}>
            <label className="yjrl-label">Select Achievement</label>
            <select className="yjrl-input" value={selectedAchievement} onChange={e => setSelectedAchievement(e.target.value)}>
              <option value="">Choose...</option>
              {achievements.map(a => <option key={a._id} value={a._id}>{a.icon} {a.name} ({a.rarity} — {a.xpValue || a.xp_value}xp)</option>)}
            </select>
          </div>
        </Modal>
      )}

      {/* Sponsor Modal */}
      {sponsorModal && (
        <Modal title={editingSponsor ? 'Edit Sponsor' : 'Add Sponsor'} onClose={() => setSponsorModal(false)} footer={
          <><button className="yjrl-btn yjrl-btn-secondary" onClick={() => setSponsorModal(false)}>Cancel</button>
          <button className="yjrl-btn yjrl-btn-primary" onClick={saveSponsor} disabled={!sponsorForm.name}><Save size={15} /> {editingSponsor ? 'Update' : 'Add'}</button></>
        }>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Name *</label><input className="yjrl-input" value={sponsorForm.name} onChange={e => setSponsorForm(p => ({ ...p, name:e.target.value }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Tier</label>
              <select className="yjrl-input" value={sponsorForm.tier} onChange={e => setSponsorForm(p => ({ ...p, tier:e.target.value }))}>{SPONSOR_TIERS.map(t => <option key={t} value={t}>{t}</option>)}</select>
            </div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Logo URL</label><input className="yjrl-input" value={sponsorForm.logo} onChange={e => setSponsorForm(p => ({ ...p, logo:e.target.value }))} placeholder="https://..." /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Website</label><input className="yjrl-input" value={sponsorForm.website} onChange={e => setSponsorForm(p => ({ ...p, website:e.target.value }))} placeholder="https://..." /></div>
            <div className="yjrl-form-group" style={{ margin:0, gridColumn:'1/-1' }}><label className="yjrl-label">Description</label><textarea className="yjrl-input" rows={2} value={sponsorForm.description} onChange={e => setSponsorForm(p => ({ ...p, description:e.target.value }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Contact Name</label><input className="yjrl-input" value={sponsorForm.contactName} onChange={e => setSponsorForm(p => ({ ...p, contactName:e.target.value }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Contact Email</label><input className="yjrl-input" value={sponsorForm.contactEmail} onChange={e => setSponsorForm(p => ({ ...p, contactEmail:e.target.value }))} /></div>
          </div>
        </Modal>
      )}

      {/* Merch Modal */}
      {merchModal && (
        <Modal title={editingMerch ? 'Edit Item' : 'Add Store Item'} onClose={() => setMerchModal(false)} footer={
          <><button className="yjrl-btn yjrl-btn-secondary" onClick={() => setMerchModal(false)}>Cancel</button>
          <button className="yjrl-btn yjrl-btn-primary" onClick={saveMerchItem} disabled={!merchForm.name}><Save size={15} /> {editingMerch ? 'Update' : 'Add'}</button></>
        }>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Name *</label><input className="yjrl-input" value={merchForm.name} onChange={e => setMerchForm(p => ({ ...p, name:e.target.value }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Category</label>
              <select className="yjrl-input" value={merchForm.category} onChange={e => setMerchForm(p => ({ ...p, category:e.target.value }))}>{MERCH_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
            </div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Price ($)</label><input className="yjrl-input" type="number" value={merchForm.price} onChange={e => setMerchForm(p => ({ ...p, price:parseFloat(e.target.value)||0 }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Image URL</label><input className="yjrl-input" value={merchForm.image} onChange={e => setMerchForm(p => ({ ...p, image:e.target.value }))} placeholder="https://..." /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Sizes (comma separated)</label><input className="yjrl-input" value={(merchForm.sizes||[]).join(', ')} onChange={e => setMerchForm(p => ({ ...p, sizes:e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} placeholder="S, M, L, XL" /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Buy Link (external)</label><input className="yjrl-input" value={merchForm.externalUrl} onChange={e => setMerchForm(p => ({ ...p, externalUrl:e.target.value }))} placeholder="https://..." /></div>
            <div className="yjrl-form-group" style={{ margin:0, gridColumn:'1/-1' }}><label className="yjrl-label">Description</label><textarea className="yjrl-input" rows={2} value={merchForm.description} onChange={e => setMerchForm(p => ({ ...p, description:e.target.value }))} /></div>
            <label style={{ display:'flex', alignItems:'center', gap:'0.5rem', cursor:'pointer', fontSize:'0.85rem', color:'var(--yjrl-muted)' }}>
              <input type="checkbox" checked={merchForm.inStock} onChange={e => setMerchForm(p => ({ ...p, inStock:e.target.checked }))} /> In Stock
            </label>
          </div>
        </Modal>
      )}

      {/* Raffle Modal */}
      {raffleModal && (
        <Modal title={editingRaffle ? 'Edit Raffle' : 'Create Raffle'} onClose={() => setRaffleModal(false)} footer={
          <><button className="yjrl-btn yjrl-btn-secondary" onClick={() => setRaffleModal(false)}>Cancel</button>
          <button className="yjrl-btn yjrl-btn-primary" onClick={saveRaffle} disabled={!raffleForm.title}><Save size={15} /> {editingRaffle ? 'Update' : 'Create'}</button></>
        }>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <div className="yjrl-form-group" style={{ margin:0, gridColumn:'1/-1' }}><label className="yjrl-label">Title *</label><input className="yjrl-input" value={raffleForm.title} onChange={e => setRaffleForm(p => ({ ...p, title:e.target.value }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0, gridColumn:'1/-1' }}><label className="yjrl-label">Prize Description</label><textarea className="yjrl-input" rows={2} value={raffleForm.prizeDescription} onChange={e => setRaffleForm(p => ({ ...p, prizeDescription:e.target.value }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Ticket Price ($)</label><input className="yjrl-input" type="number" value={raffleForm.ticketPrice} onChange={e => setRaffleForm(p => ({ ...p, ticketPrice:parseFloat(e.target.value)||0 }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Draw Date</label><input className="yjrl-input" type="date" value={raffleForm.drawDate} onChange={e => setRaffleForm(p => ({ ...p, drawDate:e.target.value }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Ticket Link (external)</label><input className="yjrl-input" value={raffleForm.externalUrl} onChange={e => setRaffleForm(p => ({ ...p, externalUrl:e.target.value }))} placeholder="https://..." /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Status</label>
              <select className="yjrl-input" value={raffleForm.status} onChange={e => setRaffleForm(p => ({ ...p, status:e.target.value }))}>{['active','closed','drawn'].map(s => <option key={s} value={s}>{s}</option>)}</select>
            </div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Image URL</label><input className="yjrl-input" value={raffleForm.image} onChange={e => setRaffleForm(p => ({ ...p, image:e.target.value }))} /></div>
            {raffleForm.status === 'drawn' && <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Winner Name</label><input className="yjrl-input" value={raffleForm.winnerName || ''} onChange={e => setRaffleForm(p => ({ ...p, winnerName:e.target.value }))} /></div>}
            <div className="yjrl-form-group" style={{ margin:0, gridColumn:'1/-1' }}><label className="yjrl-label">Description</label><textarea className="yjrl-input" rows={2} value={raffleForm.description} onChange={e => setRaffleForm(p => ({ ...p, description:e.target.value }))} /></div>
          </div>
        </Modal>
      )}

      {/* Carnival Modal */}
      {carnivalModal && (
        <Modal title={editingCarnival ? 'Edit Carnival' : 'Create Carnival'} width={640} onClose={() => setCarnivalModal(false)} footer={
          <><button className="yjrl-btn yjrl-btn-secondary" onClick={() => setCarnivalModal(false)}>Cancel</button>
          <button className="yjrl-btn yjrl-btn-primary" onClick={saveCarnival} disabled={!carnivalForm.title || !carnivalForm.date}><Save size={15} /> {editingCarnival ? 'Update' : 'Create'}</button></>
        }>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <div className="yjrl-form-group" style={{ margin:0, gridColumn:'1/-1' }}><label className="yjrl-label">Title *</label><input className="yjrl-input" value={carnivalForm.title} onChange={e => setCarnivalForm(p => ({ ...p, title:e.target.value }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Date *</label><input className="yjrl-input" type="date" value={carnivalForm.date} onChange={e => setCarnivalForm(p => ({ ...p, date:e.target.value }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Time</label><input className="yjrl-input" value={carnivalForm.time} onChange={e => setCarnivalForm(p => ({ ...p, time:e.target.value }))} placeholder="e.g. 8:00 AM" /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Venue</label><input className="yjrl-input" value={carnivalForm.venue} onChange={e => setCarnivalForm(p => ({ ...p, venue:e.target.value }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Address</label><input className="yjrl-input" value={carnivalForm.address} onChange={e => setCarnivalForm(p => ({ ...p, address:e.target.value }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Entry Fee ($)</label><input className="yjrl-input" type="number" value={carnivalForm.entryFee} onChange={e => setCarnivalForm(p => ({ ...p, entryFee:parseFloat(e.target.value)||0 }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Max Teams</label><input className="yjrl-input" type="number" value={carnivalForm.maxTeams} onChange={e => setCarnivalForm(p => ({ ...p, maxTeams:parseInt(e.target.value)||'' }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Age Groups (comma separated)</label><input className="yjrl-input" value={(carnivalForm.ageGroups||[]).join(', ')} onChange={e => setCarnivalForm(p => ({ ...p, ageGroups:e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} placeholder="U10, U12, U14" /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">External Registration Link</label><input className="yjrl-input" value={carnivalForm.externalUrl} onChange={e => setCarnivalForm(p => ({ ...p, externalUrl:e.target.value }))} placeholder="https://..." /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Contact Name</label><input className="yjrl-input" value={carnivalForm.contactName} onChange={e => setCarnivalForm(p => ({ ...p, contactName:e.target.value }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Contact Email</label><input className="yjrl-input" value={carnivalForm.contactEmail} onChange={e => setCarnivalForm(p => ({ ...p, contactEmail:e.target.value }))} /></div>
            <div className="yjrl-form-group" style={{ margin:0 }}><label className="yjrl-label">Status</label>
              <select className="yjrl-input" value={carnivalForm.status} onChange={e => setCarnivalForm(p => ({ ...p, status:e.target.value }))}>{['open','closed','completed'].map(s => <option key={s} value={s}>{s}</option>)}</select>
            </div>
            <div className="yjrl-form-group" style={{ margin:0, gridColumn:'1/-1' }}><label className="yjrl-label">Description</label><textarea className="yjrl-input" rows={3} value={carnivalForm.description} onChange={e => setCarnivalForm(p => ({ ...p, description:e.target.value }))} /></div>
          </div>
        </Modal>
      )}

      {/* Carnival Registrations Viewer */}
      {carnivalRegs && (
        <Modal title={`Registrations — ${carnivalRegs.title}`} width={700} onClose={() => setCarnivalRegs(null)} footer={
          <button className="yjrl-btn yjrl-btn-secondary" onClick={() => setCarnivalRegs(null)}>Close</button>
        }>
          {(carnivalRegs.registrations || []).length > 0 ? (
            <table className="yjrl-table">
              <thead><tr><th>Team</th><th>Age</th><th>Contact</th><th>Email</th><th>Players</th><th>Status</th></tr></thead>
              <tbody>
                {(carnivalRegs.registrations || []).map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight:600 }}>{r.team_name}</td>
                    <td>{r.age_group}</td>
                    <td>{r.contact_name}</td>
                    <td style={{ fontSize:'0.8rem', color:'var(--yjrl-muted)' }}>{r.contact_email}</td>
                    <td>{r.players_count}</td>
                    <td><span style={{ fontSize:'0.7rem', padding:'0.15rem 0.5rem', borderRadius:'100px', fontWeight:600, textTransform:'capitalize',
                      background: r.status === 'confirmed' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                      color: r.status === 'confirmed' ? '#10b981' : '#f59e0b'
                    }}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding:'2rem', textAlign:'center', color:'var(--yjrl-muted)' }}>No registrations yet.</div>
          )}
        </Modal>
      )}
    </YJRLLayout>
  );
};

export default YJRLAdminPortal;
