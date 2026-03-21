import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock, ArrowLeft, Eye, ChevronRight } from 'lucide-react';
import api from '../../api';
import YJRLLayout from './YJRLLayout';
import './yjrl.css';

const CATEGORY_EMOJI = { news: '📰', results: '🏆', events: '📅', club: '🏉', pathways: '⭐', community: '🤝', sponsors: '💛' };
const CATEGORIES = ['All', 'news', 'results', 'events', 'club', 'pathways', 'community'];

const DEMO_ARTICLES = [
  { _id: 'n1', title: 'Season 2026 Registration Now Open', category: 'news', published: true, featured: true, views: 241, publishDate: new Date('2026-01-15'), authorName: 'Yeppoon JRL', excerpt: 'Registration for the 2026 season is now open. All age groups from U6 through to Opens are welcome. Early bird pricing available until February 28.', content: 'Registration for the 2026 season is now open and we are excited to welcome back all our returning players and families, as well as any new families looking to join the Yeppoon Seagulls.\n\nAll age groups from U6 Mini Mod through to Opens are welcome. If you have a child aged 5 or above, we have a team for them!\n\n**Early Bird Pricing**\nRegister before February 28 and receive a $20 discount on your registration fee. This applies to all age groups.\n\n**How to Register**\nVisit our registration page or head to playhq.com to complete your online registration. Make sure to have your child\'s birth certificate ready for age verification.\n\n**What\'s Included**\n- Club jersey, shorts, and socks\n- Training sessions twice per week\n- Game day participation\n- Access to club facilities\n- Club presentation night invitation\n\nFor more information, contact us at info@yepponjrl.com.au or call (07) 4939 XXXX.' },
  { _id: 'n2', title: 'Seagulls Claim Grand Final Victory — U14s Champions!', category: 'results', published: true, featured: false, views: 583, publishDate: new Date('2025-09-20'), authorName: 'Mike Thompson', excerpt: 'What a performance! The Yeppoon Seagulls U14s fought back from a 10-point deficit in the second half to claim the 2025 Grand Final 24-16.', content: 'In one of the most thrilling Grand Finals seen at Nev Skuse Oval in years, the Yeppoon Seagulls U14s claimed the 2025 premiership with a stunning comeback victory over the Rockhampton Rockets.\n\nTrailing 0-10 at half time, the Seagulls showed incredible character and determination to claw back the deficit and run away with a 24-16 victory.\n\n**Match Summary**\n- First Half: Rockets 10-0 Bulls\n- Second Half: Bulls scored 24 unanswered points\n- Final Score: Yeppoon Seagulls 24 – Rockhampton Rockets 16\n\n**Scorers**\n- Jordan Smith (3 tries, 3 goals)\n- Riley Wilson (2 tries)\n- Ethan Williams (1 try)\n\n**Man of the Match:** Jordan Smith — an outstanding performance with 3 tries, 3 goals, and numerous tackle breaks.\n\nCoach Mike Thompson said: "I couldn\'t be prouder of this group. They never gave up and showed what it means to be a Yeppoon Bull today."\n\nThis is the club\'s 12th premiership and first since 2021. Congratulations to all players, coaches, and families!' },
  { _id: 'n3', title: 'Junior Pathway Program — Applications Open', category: 'pathways', published: true, featured: false, views: 142, publishDate: new Date('2025-11-10'), authorName: 'Yeppoon JRL', excerpt: 'The QRL RISE Program is now accepting applications for eligible U13-U15 players. This is your chance to take the next step in your rugby league journey.', content: 'The Queensland Rugby League RISE Program is now accepting applications for the 2026 season. This program is open to eligible players in the U13-U15 age groups.\n\n**What is the RISE Program?**\nThe RISE Program is the QRL\'s elite junior development pathway, designed to identify and develop the next generation of Queensland rugby league talent. Players selected will receive high-performance coaching, representative game exposure, and skills development sessions.\n\n**Eligibility Requirements**\n- Must be eligible to play in the U13, U14, or U15 age groups\n- Must be registered with an affiliated club\n- Must demonstrate commitment to training and development\n- Parent/guardian consent required for players under 18\n\n**Application Process**\nInterested players should submit an expression of interest through their club. The club will then submit nominations to the QRL for consideration.\n\nFor more information, speak to your team coach or contact the club office.' },
  { _id: 'n4', title: 'Come & Try Day — All Welcome!', category: 'events', published: true, featured: false, views: 98, publishDate: new Date('2026-02-01'), authorName: 'Yeppoon JRL', excerpt: 'Never played rugby league before? Our Come & Try Day is the perfect way to give it a go in a fun, no-pressure environment. All ages welcome.', content: 'We are hosting our annual Come & Try Day for anyone interested in giving rugby league a go!\n\n**Details**\n- Date: Saturday, March 7, 2026\n- Time: 9:00 AM – 12:00 PM\n- Venue: Nev Skuse Oval, Yeppoon\n- Cost: FREE\n\nThis is a perfect opportunity for kids who have never played before to experience the game in a fun, safe, and inclusive environment. All equipment will be provided.\n\n**What to Bring**\n- Comfortable sports clothing\n- Running shoes or footy boots\n- Water bottle\n- Sunscreen\n- Plenty of enthusiasm!\n\nFor more information, contact us at info@yepponjrl.com.au' },
];

// Article detail view
const ArticleDetail = ({ id }) => {
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/yjrl/news/${id}`).then(res => setArticle(res.data)).catch(() => {
      setArticle(DEMO_ARTICLES.find(a => a._id === id) || null);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="yjrl-loading"><div className="yjrl-spinner" /></div>;
  if (!article) return (
    <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--yjrl-muted)' }}>
      <p>Article not found.</p>
      <Link to="/news" className="yjrl-btn yjrl-btn-secondary" style={{ marginTop: '1rem' }}>Back to News</Link>
    </div>
  );

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
      <Link to="/news" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--yjrl-muted)', textDecoration: 'none', fontSize: '0.875rem', marginBottom: '1.5rem', fontWeight: 500 }}>
        <ArrowLeft size={14} /> Back to News
      </Link>
      <div style={{ marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--yjrl-gold)' }}>
          {CATEGORY_EMOJI[article.category]} {article.category}
        </span>
      </div>
      <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', fontWeight: 900, lineHeight: 1.2, marginBottom: '1rem' }}>
        {article.title}
      </h1>
      <div style={{ display: 'flex', gap: '1.25rem', color: 'var(--yjrl-muted)', fontSize: '0.85rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Clock size={13} />
          {new Date(article.publishDate).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
        <span>By {article.authorName || 'Yeppoon JRL'}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Eye size={13} /> {article.views || 0} views</span>
      </div>
      <div style={{ borderTop: '1px solid var(--yjrl-border)', paddingTop: '2rem' }}>
        {article.content.split('\n').map((para, i) => {
          if (!para.trim()) return <br key={i} />;
          if (para.startsWith('**') && para.endsWith('**')) {
            return <h3 key={i} style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--yjrl-gold)', margin: '1.5rem 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{para.replace(/\*\*/g, '')}</h3>;
          }
          if (para.startsWith('- ')) {
            return <li key={i} style={{ color: 'var(--yjrl-muted)', lineHeight: 1.7, fontSize: '1rem', marginLeft: '1.25rem' }}>{para.slice(2)}</li>;
          }
          return <p key={i} style={{ color: 'var(--yjrl-muted)', lineHeight: 1.8, marginBottom: '1rem', fontSize: '1rem' }}>{para}</p>;
        })}
      </div>
    </div>
  );
};

const YJRLNews = () => {
  const { id } = useParams();
  const [articles, setArticles] = useState(DEMO_ARTICLES);
  const [catFilter, setCatFilter] = useState('All');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) return;
    setLoading(true);
    api.get('/news?published=true').then(res => {
      if (Array.isArray(res.data) && res.data.length) setArticles(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (id) return <YJRLLayout><ArticleDetail id={id} /></YJRLLayout>;

  const filtered = articles.filter(a => catFilter === 'All' || a.category === catFilter);
  const featured = filtered.find(a => a.featured);
  const rest = filtered.filter(a => !a.featured || a._id !== featured?._id);

  return (
    <YJRLLayout>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #172554, #1d4ed8)', color: 'white', padding: '3.5rem 1.5rem 2rem', borderBottom: '1px solid var(--yjrl-border)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
            Club Updates
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 0.5rem', color: 'white' }}>
            News & Stories
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', margin: 0 }}>
            Results, events, player news, and everything happening at Yeppoon JRL.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Category filters */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)}
              style={{
                padding: '0.35rem 0.9rem', borderRadius: '100px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', border: '1px solid',
                borderColor: catFilter === cat ? 'var(--yjrl-gold)' : 'rgba(255,255,255,0.12)',
                background: catFilter === cat ? 'rgba(240,165,0,0.15)' : 'transparent',
                color: catFilter === cat ? 'var(--yjrl-gold)' : 'var(--yjrl-muted)',
                transition: 'all 0.15s'
              }}>
              {cat === 'All' ? 'All' : `${CATEGORY_EMOJI[cat]} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`}
            </button>
          ))}
        </div>

        {/* Featured article */}
        {featured && (
          <Link to={`/news/${featured._id}`} style={{ textDecoration: 'none', display: 'block', marginBottom: '2rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, #172554, #1d4ed8)', color: 'white',
              border: '1px solid rgba(251,191,36,0.25)', borderRadius: '16px', overflow: 'hidden',
              display: 'grid', gridTemplateColumns: '1fr 2fr', transition: 'all 0.2s'
            }} className="yjrl-card">
              <div style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6rem', padding: '2rem', minHeight: 200 }}>
                {CATEGORY_EMOJI[featured.category] || '📰'}
              </div>
              <div style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.7rem', background: 'rgba(251,191,36,0.2)', color: '#fbbf24', padding: '0.2rem 0.6rem', borderRadius: '100px', fontWeight: 700 }}>FEATURED</span>
                  <span style={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{featured.category}</span>
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: '0 0 0.75rem', lineHeight: 1.2, color: 'white' }}>{featured.title}</h2>
                <p style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, margin: '0 0 1rem', fontSize: '0.95rem' }}>{featured.excerpt}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Clock size={12} />
                    {new Date(featured.publishDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#fbbf24', fontWeight: 600 }}>
                    Read more <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Article grid */}
        <div className="yjrl-grid-3">
          {rest.map(article => (
            <Link key={article._id} to={`/news/${article._id}`} className="yjrl-news-card">
              <div className="yjrl-news-img-placeholder">
                <span>{CATEGORY_EMOJI[article.category] || '📰'}</span>
              </div>
              <div className="yjrl-news-body">
                <div className="yjrl-news-cat">{article.category}</div>
                <h3 className="yjrl-news-title">{article.title}</h3>
                <p className="yjrl-news-excerpt">{article.excerpt}</p>
                <div className="yjrl-news-meta">
                  <Clock size={11} />
                  {new Date(article.publishDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  <Eye size={11} style={{ marginLeft: '0.5rem' }} /> {article.views || 0}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--yjrl-muted)' }}>
            <p>No articles found in this category.</p>
          </div>
        )}
      </div>
    </YJRLLayout>
  );
};

export default YJRLNews;
