import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Clock, Filter, ChevronUp, ChevronDown, TrendingUp } from 'lucide-react';
import api from '../../api';
import YJRLLayout from './YJRLLayout';
import './yjrl.css';

const AGE_GROUPS = ['All', 'U6', 'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'Womens'];
const SEASON = new Date().getFullYear().toString();

// Demo data
const DEMO_FIXTURES = [
  { _id: 'f1', ageGroup: 'U14', round: 5, homeTeamName: 'Yeppoon Bulls', awayTeamName: 'Rockhampton Rockets', date: new Date(Date.now() + 7 * 86400000), time: '10:00 AM', venue: 'Nev Skuse Oval', status: 'scheduled', isHomeGame: true },
  { _id: 'f2', ageGroup: 'U12', round: 5, homeTeamName: 'Capricorn Cobras', awayTeamName: 'Yeppoon Bulls', date: new Date(Date.now() + 7 * 86400000), time: '11:30 AM', venue: 'Gangwon Park', status: 'scheduled', isHomeGame: false },
  { _id: 'f3', ageGroup: 'U16', round: 5, homeTeamName: 'Yeppoon Bulls', awayTeamName: 'Gladstone Warriors', date: new Date(Date.now() + 14 * 86400000), time: '2:00 PM', venue: 'Nev Skuse Oval', status: 'scheduled', isHomeGame: true },
  { _id: 'f4', ageGroup: 'U14', round: 4, homeTeamName: 'Yeppoon Bulls', awayTeamName: 'Gladstone Warriors', date: new Date(Date.now() - 7 * 86400000), time: '10:00 AM', venue: 'Nev Skuse Oval', status: 'completed', homeScore: 26, awayScore: 14, isHomeGame: true },
  { _id: 'f5', ageGroup: 'U12', round: 4, homeTeamName: 'Yeppoon Bulls', awayTeamName: 'CQ Bulldogs', date: new Date(Date.now() - 7 * 86400000), time: '11:30 AM', venue: 'Nev Skuse Oval', status: 'completed', homeScore: 18, awayScore: 22, isHomeGame: true },
  { _id: 'f6', ageGroup: 'U16', round: 4, homeTeamName: 'Capricorn Wildcats', awayTeamName: 'Yeppoon Bulls', date: new Date(Date.now() - 7 * 86400000), time: '2:00 PM', venue: 'Rockhampton Leagues', status: 'completed', homeScore: 10, awayScore: 30, isHomeGame: false },
  { _id: 'f7', ageGroup: 'U10', round: 4, homeTeamName: 'Yeppoon Bulls', awayTeamName: 'Emu Park Eagles', date: new Date(Date.now() - 7 * 86400000), time: '9:00 AM', venue: 'Nev Skuse Oval', status: 'completed', homeScore: 14, awayScore: 14, isHomeGame: true },
];

const DEMO_LADDER = [
  { _id: 't1', ageGroup: 'U14', name: 'Yeppoon Bulls', wins: 4, losses: 0, draws: 0, pointsFor: 96, pointsAgainst: 38 },
  { _id: 't2', ageGroup: 'U14', name: 'Rockhampton Rockets', wins: 3, losses: 1, draws: 0, pointsFor: 72, pointsAgainst: 52 },
  { _id: 't3', ageGroup: 'U14', name: 'Gladstone Warriors', wins: 2, losses: 2, draws: 0, pointsFor: 56, pointsAgainst: 60 },
  { _id: 't4', ageGroup: 'U14', name: 'CQ Bulldogs', wins: 1, losses: 3, draws: 0, pointsFor: 44, pointsAgainst: 76 },
  { _id: 't5', ageGroup: 'U14', name: 'Capricorn Wildcats', wins: 0, losses: 4, draws: 0, pointsFor: 28, pointsAgainst: 92 },
];

const ResultBadge = ({ fixture }) => {
  if (fixture.status !== 'completed') return null;
  const yjrlScore = fixture.isHomeGame ? fixture.homeScore : fixture.awayScore;
  const oppScore = fixture.isHomeGame ? fixture.awayScore : fixture.homeScore;
  const result = yjrlScore > oppScore ? 'win' : yjrlScore < oppScore ? 'loss' : 'draw';
  const classes = { win: 'yjrl-result-win', loss: 'yjrl-result-loss', draw: 'yjrl-result-draw' };
  return (
    <span className={`yjrl-fixture-score ${classes[result]}`}>
      {fixture.homeScore} – {fixture.awayScore}
    </span>
  );
};

const YJRLFixtures = () => {
  const [tab, setTab] = useState('upcoming');
  const [ageFilter, setAgeFilter] = useState('All');
  const [fixtures, setFixtures] = useState(DEMO_FIXTURES);
  const [ladder, setLadder] = useState(DEMO_LADDER);
  const [ladderAge, setLadderAge] = useState('U14');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/yjrl/fixtures?season=${SEASON}`).catch(() => ({ data: [] })),
      api.get(`/yjrl/ladder?season=${SEASON}`).catch(() => ({ data: [] }))
    ]).then(([fRes, lRes]) => {
      if (fRes.data.length) setFixtures(fRes.data);
      if (lRes.data.length) setLadder(lRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const upcoming = fixtures
    .filter(f => f.status === 'scheduled' && new Date(f.date) >= now)
    .filter(f => ageFilter === 'All' || f.ageGroup === ageFilter)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const results = fixtures
    .filter(f => f.status === 'completed')
    .filter(f => ageFilter === 'All' || f.ageGroup === ageFilter)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const ladderTeams = ladder
    .filter(t => ladderAge === 'All' || t.ageGroup === ladderAge)
    .map(t => ({ ...t, played: t.wins + t.losses + t.draws, points: t.wins * 2 + t.draws, diff: t.pointsFor - t.pointsAgainst }))
    .sort((a, b) => b.points - a.points || b.diff - a.diff);

  const groupByDate = (arr) => {
    const groups = {};
    arr.forEach(f => {
      const key = new Date(f.date).toDateString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    return Object.entries(groups);
  };

  const FixtureCard = ({ fixture }) => (
    <div className="yjrl-fixture-card">
      <div style={{ textAlign: 'center', minWidth: 60 }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--yjrl-gold)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Rnd {fixture.round}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--yjrl-muted)', marginTop: '0.15rem' }}>{fixture.ageGroup}</div>
      </div>

      <div className="yjrl-fixture-vs">
        <div className="yjrl-fixture-teams">
          <span style={{ fontWeight: fixture.isHomeGame ? 800 : 400 }}>{fixture.homeTeamName}</span>
          {fixture.status === 'completed' ? (
            <ResultBadge fixture={fixture} />
          ) : (
            <span style={{ fontSize: '0.75rem', color: 'var(--yjrl-muted)', background: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>vs</span>
          )}
          <span style={{ fontWeight: !fixture.isHomeGame ? 800 : 400 }}>{fixture.awayTeamName}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--yjrl-muted)' }}>
            <Clock size={11} />
            {fixture.time || 'TBC'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--yjrl-muted)' }}>
            <MapPin size={11} />
            {fixture.venue}
          </div>
        </div>
      </div>

      <div>
        {fixture.status === 'scheduled' && (
          <span style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', borderRadius: '100px', background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)', fontWeight: 700 }}>
            UPCOMING
          </span>
        )}
        {fixture.status === 'cancelled' && (
          <span style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', borderRadius: '100px', background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)', fontWeight: 700 }}>
            CANCELLED
          </span>
        )}
      </div>
    </div>
  );

  return (
    <YJRLLayout>
      {/* Page Header */}
      <div style={{ background: 'linear-gradient(135deg, var(--yjrl-dark), var(--yjrl-navy))', padding: '3.5rem 1.5rem 2rem', borderBottom: '1px solid var(--yjrl-border)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--yjrl-gold)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
            {SEASON} Season
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 0.5rem' }}>
            Fixtures & Results
          </h1>
          <p style={{ color: 'var(--yjrl-muted)', fontSize: '1rem', margin: 0 }}>
            Upcoming games, match results, and competition ladder for all age groups.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Age Group Filter */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {AGE_GROUPS.map(ag => (
            <button
              key={ag}
              onClick={() => setAgeFilter(ag)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '100px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: ageFilter === ag ? 'var(--yjrl-gold)' : 'rgba(255,255,255,0.12)',
                background: ageFilter === ag ? 'rgba(240,165,0,0.15)' : 'transparent',
                color: ageFilter === ag ? 'var(--yjrl-gold)' : 'var(--yjrl-muted)',
                transition: 'all 0.15s'
              }}
            >
              {ag}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="yjrl-tabs">
          {[['upcoming', 'Upcoming'], ['results', 'Results'], ['ladder', 'Ladder']].map(([key, label]) => (
            <button key={key} className={`yjrl-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>

        {/* ── UPCOMING ── */}
        {tab === 'upcoming' && (
          <div>
            {upcoming.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--yjrl-muted)' }}>
                <Calendar size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
                <p>No upcoming fixtures for {ageFilter === 'All' ? 'any team' : ageFilter}.</p>
              </div>
            ) : (
              groupByDate(upcoming).map(([dateStr, dayFixtures]) => (
                <div key={dateStr} style={{ marginBottom: '2rem' }}>
                  <div style={{
                    fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                    color: 'var(--yjrl-gold)', padding: '0.75rem 0', borderBottom: '1px solid var(--yjrl-border)',
                    marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
                  }}>
                    <Calendar size={14} />
                    {new Date(dateStr).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    <span style={{ marginLeft: 'auto', color: 'var(--yjrl-muted)', fontSize: '0.72rem' }}>
                      {dayFixtures.length} game{dayFixtures.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {dayFixtures.map(f => <FixtureCard key={f._id} fixture={f} />)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── RESULTS ── */}
        {tab === 'results' && (
          <div>
            {results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--yjrl-muted)' }}>
                <TrendingUp size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
                <p>No results yet for {ageFilter === 'All' ? 'any team' : ageFilter}.</p>
              </div>
            ) : (
              groupByDate(results).map(([dateStr, dayFixtures]) => (
                <div key={dateStr} style={{ marginBottom: '2rem' }}>
                  <div style={{
                    fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                    color: 'var(--yjrl-muted)', padding: '0.75rem 0', borderBottom: '1px solid var(--yjrl-border)',
                    marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
                  }}>
                    <Clock size={14} />
                    {new Date(dateStr).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {dayFixtures.map(f => <FixtureCard key={f._id} fixture={f} />)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── LADDER ── */}
        {tab === 'ladder' && (
          <div>
            {/* Age group select for ladder */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {AGE_GROUPS.filter(ag => ag !== 'All').map(ag => (
                <button
                  key={ag}
                  onClick={() => setLadderAge(ag)}
                  style={{
                    padding: '0.35rem 0.75rem', borderRadius: '100px', fontSize: '0.78rem', fontWeight: 600,
                    cursor: 'pointer', border: '1px solid',
                    borderColor: ladderAge === ag ? 'var(--yjrl-gold)' : 'rgba(255,255,255,0.12)',
                    background: ladderAge === ag ? 'rgba(240,165,0,0.15)' : 'transparent',
                    color: ladderAge === ag ? 'var(--yjrl-gold)' : 'var(--yjrl-muted)',
                    transition: 'all 0.15s'
                  }}
                >
                  {ag}
                </button>
              ))}
            </div>

            {ladderTeams.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--yjrl-muted)' }}>
                <p>No ladder data for {ladderAge}.</p>
              </div>
            ) : (
              <div className="yjrl-card">
                <div className="yjrl-card-header">
                  <div className="yjrl-card-title">
                    <TrendingUp size={16} /> {ladderAge} — {SEASON} Ladder
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="yjrl-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Team</th>
                        <th>P</th>
                        <th>W</th>
                        <th>L</th>
                        <th>D</th>
                        <th>PF</th>
                        <th>PA</th>
                        <th>+/-</th>
                        <th>Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ladderTeams.map((team, idx) => {
                        const isYeppoon = team.name.toLowerCase().includes('yeppoon');
                        return (
                          <tr key={team._id} style={isYeppoon ? { background: 'rgba(240,165,0,0.06)' } : {}}>
                            <td style={{ fontWeight: 800, color: idx === 0 ? 'var(--yjrl-gold)' : 'var(--yjrl-muted)' }}>
                              {idx + 1}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {isYeppoon && <span style={{ fontSize: '0.65rem', background: 'rgba(240,165,0,0.2)', color: 'var(--yjrl-gold)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>US</span>}
                                <span style={{ fontWeight: isYeppoon ? 700 : 400 }}>{team.name}</span>
                              </div>
                            </td>
                            <td>{team.played}</td>
                            <td style={{ color: '#4ade80', fontWeight: 600 }}>{team.wins}</td>
                            <td style={{ color: '#f87171', fontWeight: 600 }}>{team.losses}</td>
                            <td>{team.draws}</td>
                            <td>{team.pointsFor}</td>
                            <td>{team.pointsAgainst}</td>
                            <td style={{ color: team.diff >= 0 ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                              {team.diff >= 0 ? '+' : ''}{team.diff}
                            </td>
                            <td style={{ fontWeight: 900, color: isYeppoon ? 'var(--yjrl-gold)' : 'var(--yjrl-text)' }}>
                              {team.points}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--yjrl-muted)', borderTop: '1px solid var(--yjrl-border)' }}>
                  P = Played · W = Win · L = Loss · D = Draw · PF = Points For · PA = Points Against · +/- = Diff · Pts = Competition Points (Win = 2, Draw = 1)
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </YJRLLayout>
  );
};

export default YJRLFixtures;
