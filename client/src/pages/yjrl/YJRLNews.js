import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock, ArrowLeft, Eye, ChevronRight } from 'lucide-react';
import api from '../../api';
import YJRLLayout from './YJRLLayout';
import './yjrl.css';

const CATEGORY_EMOJI = { news: '📰', results: '🏆', events: '📅', club: '🏉', pathways: '⭐', community: '🤝', sponsors: '💛' };
const CATEGORIES = ['All', 'news', 'results', 'events', 'club', 'pathways', 'community'];

// Article detail view
const ArticleDetail = ({ id }) => {
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/yjrl/news/${id}`).then(res => setArticle(res.data)).catch(() => {
      setArticle(null);
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
  const [articles, setArticles] = useState([]);
  const [catFilter, setCatFilter] = useState('All');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) return;
    setLoading(true);
    api.get('/yjrl/news?published=true').then(res => {
      if (Array.isArray(res.data)) setArticles(res.data);
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
