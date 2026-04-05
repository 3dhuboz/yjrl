import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Home, Calendar, Trophy, Newspaper, Users, LogIn, LogOut,
  Menu, X, ChevronDown, User, Shield, Heart, Zap, Mail,
  ShoppingBag, Gift, Star, ExternalLink, MapPin
} from 'lucide-react';
import './yjrl.css';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/fixtures', label: 'Fixtures', icon: Calendar },
  { to: '/news', label: 'News', icon: Newspaper },
  { to: '/sponsors', label: 'Sponsors', icon: Star },
  { to: '/store', label: 'Store', icon: ShoppingBag },
];

const PORTAL_ITEMS = [
  { to: '/portal/player', label: 'Player Portal', icon: Zap, roles: ['all'] },
  { to: '/portal/parent', label: 'Parent Portal', icon: Heart, roles: ['all'] },
  { to: '/portal/coach', label: 'Coach Portal', icon: Shield, roles: ['all'] },
  { to: '/portal/admin', label: 'Club Admin', icon: Trophy, roles: ['admin', 'dev'] },
];

const YJRLLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isAdmin = user && (user.role === 'admin' || user.role === 'dev');

  return (
    <div className="yjrl-page">
      {/* ── Navbar ── */}
      <nav className="yjrl-nav">
        <div className="yjrl-nav-inner">
          {/* Logo */}
          <Link to="/" className="yjrl-logo">
            <div className="yjrl-logo-badge">
              <img src="/images/logo.png" alt="Yeppoon Seagulls JRL" />
            </div>
            <div className="yjrl-logo-text">
              <strong>Yeppoon Seagulls</strong>
              <span>Junior Rugby League</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <ul className="yjrl-nav-links">
            {NAV_ITEMS.map(item => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={isActive(item.to) && item.to !== '/' ? 'active' : (location.pathname === '/' && item.to === '/' ? 'active' : '')}
                >
                  {item.label}
                </Link>
              </li>
            ))}

            {/* More dropdown */}
            <li style={{ position: 'relative' }}>
              <button
                onClick={() => setPortalOpen(!portalOpen)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                More <ChevronDown size={14} />
              </button>
              {portalOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '0.5rem',
                  minWidth: '200px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                  zIndex: 999
                }}>
                  <div style={{ padding: '0.3rem 0.75rem', fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Club</div>
                  {[
                    { to: '/raffles', label: 'Raffles', icon: Gift },
                    { to: '/carnivals', label: 'Carnivals', icon: MapPin },
                    { to: '/events', label: 'Events', icon: Calendar },
                  ].map(item => (
                    <Link key={item.to} to={item.to} onClick={() => setPortalOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '7px', color: isActive(item.to) ? '#1d4ed8' : '#64748b', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.15s' }}>
                      <item.icon size={15} /> {item.label}
                    </Link>
                  ))}
                  <div style={{ borderTop: '1px solid #e2e8f0', margin: '0.4rem 0' }} />
                  <div style={{ padding: '0.3rem 0.75rem', fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>External</div>
                  <a href="https://clubhouse.qrl.com.au" target="_blank" rel="noopener noreferrer" onClick={() => setPortalOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '7px', color: '#64748b', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 500 }}>
                    <ExternalLink size={15} /> QRL Clubhouse
                  </a>
                  <a href="https://www.playrugbyleague.com" target="_blank" rel="noopener noreferrer" onClick={() => setPortalOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '7px', color: '#64748b', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 500 }}>
                    <ExternalLink size={15} /> Play NRL
                  </a>
                  <div style={{ borderTop: '1px solid #e2e8f0', margin: '0.4rem 0' }} />
                  <div style={{ padding: '0.3rem 0.75rem', fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Portals</div>
                  {PORTAL_ITEMS.filter(p => p.roles.includes('all') || (isAdmin && p.roles.includes('admin'))).map(item => (
                    <Link key={item.to} to={item.to} onClick={() => setPortalOpen(false)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '7px', color: isActive(item.to) ? '#1d4ed8' : '#64748b', textDecoration: 'none', fontSize: '0.85rem', fontWeight: isActive(item.to) ? 600 : 500, background: isActive(item.to) ? 'rgba(29,78,216,0.06)' : 'transparent', transition: 'all 0.15s' }}>
                      <item.icon size={15} /> {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </li>

            {/* Auth */}
            {user ? (
              <>
                <li>
                  <Link to={isAdmin ? '/portal/admin' : '/portal/player'} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {isAdmin ? <Shield size={14} /> : <User size={14} />} {isAdmin ? 'Admin' : user.firstName || 'My Portal'}
                  </Link>
                </li>
                <li>
                  <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <LogOut size={14} /> Sign Out
                  </button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
                    <LogIn size={14} />Sign In
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="yjrl-nav-cta">Join the Club</Link>
                </li>
              </>
            )}
          </ul>

          {/* Mobile toggle */}
          <button className="yjrl-mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div style={{
            borderTop: '1px solid var(--yjrl-border)',
            padding: '1rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem'
          }}>
            {NAV_ITEMS.map(item => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '8px',
                  color: isActive(item.to) ? 'var(--yjrl-gold)' : 'var(--yjrl-muted)',
                  textDecoration: 'none',
                  fontWeight: 500,
                  fontSize: '0.9rem'
                }}
              >
                <item.icon size={16} /> {item.label}
              </Link>
            ))}
            <hr style={{ border: 'none', borderTop: '1px solid var(--yjrl-border)', margin: '0.5rem 0' }} />
            {[
              { to: '/raffles', label: 'Raffles', icon: Gift },
              { to: '/carnivals', label: 'Carnivals', icon: MapPin },
              { to: '/events', label: 'Events', icon: Calendar },
            ].map(item => (
              <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.75rem', borderRadius: '8px', color: 'var(--yjrl-muted)', textDecoration: 'none', fontWeight: 500, fontSize: '0.9rem' }}>
                <item.icon size={16} /> {item.label}
              </Link>
            ))}
            <a href="https://clubhouse.qrl.com.au" target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.75rem', borderRadius: '8px', color: 'var(--yjrl-muted)', textDecoration: 'none', fontWeight: 500, fontSize: '0.9rem' }}>
              <ExternalLink size={16} /> QRL Clubhouse
            </a>
            <a href="https://www.playrugbyleague.com" target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.75rem', borderRadius: '8px', color: 'var(--yjrl-muted)', textDecoration: 'none', fontWeight: 500, fontSize: '0.9rem' }}>
              <ExternalLink size={16} /> Play NRL
            </a>
            <hr style={{ border: 'none', borderTop: '1px solid var(--yjrl-border)', margin: '0.5rem 0' }} />
            {PORTAL_ITEMS.filter(p => p.roles.includes('all') || (isAdmin && p.roles.includes('admin'))).map(item => (
              <Link key={item.to} to={item.to} onClick={() => setMobileOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 0.75rem', borderRadius: '8px', color: 'var(--yjrl-muted)', textDecoration: 'none', fontWeight: 500, fontSize: '0.9rem' }}>
                <item.icon size={16} /> {item.label}
              </Link>
            ))}
            <hr style={{ border: 'none', borderTop: '1px solid var(--yjrl-border)', margin: '0.5rem 0' }} />
            {user ? (
              <button
                onClick={() => { handleLogout(); setMobileOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.65rem 0.75rem', borderRadius: '8px',
                  color: 'var(--yjrl-muted)', background: 'none', border: 'none',
                  fontWeight: 500, fontSize: '0.9rem', cursor: 'pointer'
                }}
              >
                <LogOut size={16} /> Sign Out
              </button>
            ) : (
              <Link
                to="/register"
                onClick={() => setMobileOpen(false)}
                className="yjrl-btn yjrl-btn-primary"
                style={{ marginTop: '0.5rem', justifyContent: 'center' }}
              >
                Join the Club
              </Link>
            )}
          </div>
        )}
      </nav>

      {/* Page content */}
      <div onClick={() => { setPortalOpen(false); }}>
        {children}
      </div>

      {/* ── Footer ── */}
      <footer className="yjrl-footer">
        <div className="yjrl-footer-inner">
          <div className="yjrl-footer-grid">
            <div className="yjrl-footer-brand">
              <Link to="/" className="yjrl-logo">
                <div className="yjrl-logo-badge">🏉</div>
                <div className="yjrl-logo-text">
                  <strong>Yeppoon JRL</strong>
                  <span>Junior Rugby League</span>
                </div>
              </Link>
              <p style={{ marginTop: '1rem' }}>
                Building champions on and off the field. Proudly serving the Capricorn Coast community since 1965.
                Home of the mighty Yeppoon Seagulls.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                {['facebook', 'instagram', 'youtube'].map(s => (
                  <div key={s} style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: 'rgba(240,165,0,0.1)', border: '1px solid rgba(240,165,0,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--yjrl-gold)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700
                  }}>
                    {s[0].toUpperCase()}
                  </div>
                ))}
              </div>
            </div>

            <div className="yjrl-footer-col">
              <h4>Club</h4>
              <ul>
                <li><Link to="/sponsors">Sponsors</Link></li>
                <li><Link to="/store">Store</Link></li>
                <li><Link to="/raffles">Raffles</Link></li>
                <li><Link to="/carnivals">Carnivals</Link></li>
                <li><Link to="/news">News</Link></li>
              </ul>
            </div>

            <div className="yjrl-footer-col">
              <h4>Competition</h4>
              <ul>
                <li><Link to="/fixtures">Fixtures</Link></li>
                <li><Link to="/fixtures">Results</Link></li>
                <li><Link to="/fixtures">Ladder</Link></li>
                <li><a href="https://www.playrugbyleague.com" target="_blank" rel="noopener noreferrer">Play NRL</a></li>
                <li><a href="https://clubhouse.qrl.com.au" target="_blank" rel="noopener noreferrer">QRL Clubhouse</a></li>
              </ul>
            </div>

            <div className="yjrl-footer-col">
              <h4>Community</h4>
              <ul>
                <li><Link to="/register">Join the Club</Link></li>
                <li><Link to="/events">Events</Link></li>
                <li><Link to="/carnivals">Carnivals</Link></li>
                <li><Link to="/sponsors">Our Sponsors</Link></li>
                <li><a href="mailto:info@yepponjrl.com.au">Contact Us</a></li>
              </ul>
            </div>
          </div>

          <div className="yjrl-footer-bottom">
            <span>© {new Date().getFullYear()} Yeppoon Junior Rugby League. All rights reserved.</span>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Use</a>
              <a href="#">Child Safety</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default YJRLLayout;
