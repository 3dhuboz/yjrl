import React, { useState, useEffect } from 'react';
import { Heart, ExternalLink, Mail, Award, Users } from 'lucide-react';
import api from '../../api';
import YJRLLayout from './YJRLLayout';
import './yjrl.css';

const TIERS = [
  { key: 'platinum', label: 'Platinum Partners', color: '#e5e4e2', cols: 1 },
  { key: 'gold', label: 'Gold Partners', color: '#fbbf24', cols: 2 },
  { key: 'silver', label: 'Silver Partners', color: '#94a3b8', cols: 3 },
  { key: 'bronze', label: 'Bronze Partners', color: '#cd7f32', cols: 3 },
  { key: 'community', label: 'Community Partners', color: '#60a5fa', cols: 4 },
];

const SponsorCard = ({ sponsor, tier }) => {
  const isPlatinum = tier === 'platinum';
  const isGold = tier === 'gold';
  const tierDef = TIERS.find(t => t.key === tier);
  const tierColor = tierDef ? tierDef.color : '#94a3b8';

  return (
    <div
      className="yjrl-card"
      style={{
        padding: isPlatinum ? '2.5rem' : isGold ? '2rem' : '1.5rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: isPlatinum ? '1.25rem' : '0.75rem',
      }}
    >
      {/* Logo or placeholder */}
      {sponsor.logoUrl ? (
        <img
          src={sponsor.logoUrl}
          alt={sponsor.name}
          style={{
            width: isPlatinum ? 160 : isGold ? 120 : 80,
            height: isPlatinum ? 160 : isGold ? 120 : 80,
            objectFit: 'contain',
            borderRadius: 12,
          }}
        />
      ) : (
        <div
          style={{
            width: isPlatinum ? 160 : isGold ? 120 : 80,
            height: isPlatinum ? 160 : isGold ? 120 : 80,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${tierColor}22, ${tierColor}44)`,
            border: `2px solid ${tierColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isPlatinum ? '3.5rem' : isGold ? '2.5rem' : '1.75rem',
            fontWeight: 900,
            color: tierColor,
          }}
        >
          {sponsor.name.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Name */}
      <h3
        style={{
          fontSize: isPlatinum ? '1.35rem' : isGold ? '1.1rem' : '0.95rem',
          fontWeight: 800,
          color: 'var(--yjrl-text)',
          margin: 0,
        }}
      >
        {sponsor.name}
      </h3>

      {/* Description */}
      {sponsor.description && (
        <p
          style={{
            fontSize: isPlatinum ? '0.95rem' : '0.85rem',
            color: 'var(--yjrl-muted)',
            lineHeight: 1.6,
            margin: 0,
            maxWidth: isPlatinum ? 500 : 380,
          }}
        >
          {sponsor.description}
        </p>
      )}

      {/* Website link */}
      {sponsor.website && (
        <a
          href={sponsor.website}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--yjrl-blue)',
            textDecoration: 'none',
            marginTop: '0.25rem',
          }}
        >
          <ExternalLink size={13} />
          Visit Website
        </a>
      )}
    </div>
  );
};

const YJRLSponsors = () => {
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/yjrl/club/sponsors')
      .then((res) => {
        if (Array.isArray(res.data)) setSponsors(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const grouped = TIERS.reduce((acc, tier) => {
    acc[tier.key] = sponsors.filter(
      (s) => (s.tier || '').toLowerCase() === tier.key
    );
    return acc;
  }, {});

  return (
    <YJRLLayout>
      {/* Page Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #172554, #1d4ed8)',
          color: 'white',
          padding: '3.5rem 1.5rem 2rem',
          borderBottom: '1px solid var(--yjrl-border)',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#fbbf24',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              marginBottom: '0.5rem',
            }}
          >
            Community Support
          </div>
          <h1
            style={{
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 900,
              textTransform: 'uppercase',
              margin: '0 0 0.5rem',
              color: 'white',
            }}
          >
            Our Sponsors
          </h1>
          <p
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: '1rem',
              margin: 0,
            }}
          >
            Proudly supported by the Capricorn Coast community.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {loading ? (
          <div className="yjrl-loading">
            <div className="yjrl-spinner" />
          </div>
        ) : sponsors.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '5rem 1rem',
              color: 'var(--yjrl-muted)',
            }}
          >
            <Users
              size={48}
              style={{ marginBottom: '1rem', opacity: 0.4 }}
            />
            <p style={{ fontSize: '1.1rem' }}>No sponsors yet.</p>
          </div>
        ) : (
          TIERS.map((tier) => {
            const tierSponsors = grouped[tier.key];
            if (!tierSponsors || tierSponsors.length === 0) return null;

            const gridColumns =
              tier.key === 'platinum'
                ? 'repeat(auto-fit, minmax(400px, 1fr))'
                : tier.key === 'gold'
                ? 'repeat(auto-fit, minmax(320px, 1fr))'
                : 'repeat(auto-fit, minmax(220px, 1fr))';

            return (
              <div key={tier.key} style={{ marginBottom: '3rem' }}>
                {/* Tier Heading */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '1.25rem',
                    paddingBottom: '0.75rem',
                    borderBottom: `2px solid ${tier.color}`,
                  }}
                >
                  <Award size={18} style={{ color: tier.color }} />
                  <h2
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      margin: 0,
                      color: tier.color,
                    }}
                  >
                    {tier.label}
                  </h2>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--yjrl-muted)',
                      marginLeft: 'auto',
                    }}
                  >
                    {tierSponsors.length} sponsor
                    {tierSponsors.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Sponsor Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: gridColumns,
                    gap: '1.5rem',
                  }}
                >
                  {tierSponsors.map((sponsor) => (
                    <SponsorCard
                      key={sponsor._id || sponsor.name}
                      sponsor={sponsor}
                      tier={tier.key}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}

        {/* Become a Sponsor CTA */}
        <div
          style={{
            background: 'linear-gradient(135deg, #172554, #1d4ed8)',
            borderRadius: 'var(--yjrl-radius)',
            padding: '3rem 2rem',
            textAlign: 'center',
            marginTop: '2rem',
          }}
        >
          <Heart
            size={36}
            style={{ color: '#fbbf24', marginBottom: '1rem' }}
          />
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              color: 'white',
              margin: '0 0 0.75rem',
            }}
          >
            Become a Sponsor
          </h2>
          <p
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: '1rem',
              lineHeight: 1.7,
              maxWidth: 520,
              margin: '0 auto 1.5rem',
            }}
          >
            Support grassroots rugby league on the Capricorn Coast. Sponsoring
            the Yeppoon Seagulls helps keep registration fees low and gives
            every kid the chance to play.
          </p>
          <a
            href="mailto:info@yepponjrl.com.au?subject=Sponsorship%20Enquiry"
            className="yjrl-btn yjrl-btn-primary yjrl-btn-lg"
            style={{ background: '#fbbf24', color: '#172554' }}
          >
            <Mail size={18} />
            Get in Touch
          </a>
        </div>
      </div>
    </YJRLLayout>
  );
};

export default YJRLSponsors;
