import React, { useState, useEffect } from 'react';
import { ShoppingBag, ExternalLink, Mail, Package, Filter } from 'lucide-react';
import api from '../../api';
import YJRLLayout from './YJRLLayout';
import './yjrl.css';

const CATEGORIES = ['All', 'Apparel', 'Accessories', 'Equipment'];

const ProductCard = ({ item }) => {
  const outOfStock = item.inStock === false;

  return (
    <div
      className="yjrl-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        opacity: outOfStock ? 0.7 : 1,
      }}
    >
      {/* Image or placeholder */}
      <div style={{ position: 'relative' }}>
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            style={{
              width: '100%',
              height: 220,
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: 220,
              background:
                'linear-gradient(135deg, var(--yjrl-blue), var(--yjrl-sky))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShoppingBag size={48} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </div>
        )}

        {/* Out of Stock badge */}
        {outOfStock && (
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'rgba(220, 38, 38, 0.9)',
              color: 'white',
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '0.3rem 0.7rem',
              borderRadius: '100px',
            }}
          >
            Out of Stock
          </div>
        )}
      </div>

      {/* Body */}
      <div
        style={{
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        }}
      >
        {/* Category */}
        {item.category && (
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--yjrl-sky)',
              marginBottom: '0.4rem',
            }}
          >
            {item.category}
          </div>
        )}

        {/* Name */}
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--yjrl-text)',
            margin: '0 0 0.5rem',
            lineHeight: 1.4,
          }}
        >
          {item.name}
        </h3>

        {/* Price */}
        <div
          style={{
            fontSize: '1.25rem',
            fontWeight: 900,
            color: 'var(--yjrl-blue)',
            marginBottom: '0.5rem',
          }}
        >
          ${Number(item.price).toFixed(2)}
        </div>

        {/* Sizes */}
        {item.sizes && item.sizes.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '0.3rem',
              flexWrap: 'wrap',
              marginBottom: '1rem',
            }}
          >
            {item.sizes.map((size) => (
              <span
                key={size}
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  background: 'rgba(14, 165, 233, 0.08)',
                  color: 'var(--yjrl-muted)',
                  border: '1px solid var(--yjrl-border)',
                }}
              >
                {size}
              </span>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Action button */}
        {outOfStock ? (
          <button
            disabled
            className="yjrl-btn"
            style={{
              width: '100%',
              justifyContent: 'center',
              background: 'var(--yjrl-border)',
              color: 'var(--yjrl-muted)',
              cursor: 'not-allowed',
            }}
          >
            Out of Stock
          </button>
        ) : item.externalUrl ? (
          <a
            href={item.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="yjrl-btn yjrl-btn-primary"
            style={{ width: '100%', justifyContent: 'center', boxSizing: 'border-box' }}
          >
            <ExternalLink size={15} />
            Buy Now
          </a>
        ) : (
          <a
            href={`mailto:info@yepponjrl.com.au?subject=Enquiry%20—%20${encodeURIComponent(item.name)}`}
            className="yjrl-btn yjrl-btn-secondary"
            style={{ width: '100%', justifyContent: 'center', boxSizing: 'border-box' }}
          >
            <Mail size={15} />
            Enquire
          </a>
        )}
      </div>
    </div>
  );
};

const YJRLStore = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');

  useEffect(() => {
    api
      .get('/yjrl/club/merch')
      .then((res) => {
        if (Array.isArray(res.data)) setItems(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(
    (item) => category === 'All' || item.category === category
  );

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
            Official Merchandise
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
            Seagulls Store
          </h1>
          <p
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: '1rem',
              margin: 0,
            }}
          >
            Wear the blue and gold with pride.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Category Filter Pills */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            marginBottom: '2rem',
            alignItems: 'center',
          }}
        >
          <Filter
            size={15}
            style={{ color: 'var(--yjrl-muted)', marginRight: '0.25rem' }}
          />
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: '0.35rem 0.9rem',
                borderRadius: '100px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid',
                borderColor:
                  category === cat
                    ? 'var(--yjrl-gold)'
                    : 'rgba(255,255,255,0.12)',
                background:
                  category === cat ? 'rgba(240,165,0,0.15)' : 'transparent',
                color:
                  category === cat ? 'var(--yjrl-gold)' : 'var(--yjrl-muted)',
                transition: 'all 0.15s',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="yjrl-loading">
            <div className="yjrl-spinner" />
          </div>
        ) : filtered.length === 0 && items.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '5rem 1rem',
              color: 'var(--yjrl-muted)',
            }}
          >
            <ShoppingBag
              size={48}
              style={{ marginBottom: '1rem', opacity: 0.4 }}
            />
            <p style={{ fontSize: '1.1rem' }}>
              Store coming soon! Check back for merchandise.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '4rem',
              color: 'var(--yjrl-muted)',
            }}
          >
            <Package
              size={40}
              style={{ marginBottom: '1rem', opacity: 0.4 }}
            />
            <p>No items in this category.</p>
          </div>
        ) : (
          <div className="yjrl-grid-3">
            {filtered.map((item) => (
              <ProductCard key={item._id || item.name} item={item} />
            ))}
          </div>
        )}

        {/* Game Day Note */}
        <div
          style={{
            marginTop: '3rem',
            padding: '1.25rem 1.5rem',
            background: 'rgba(14, 165, 233, 0.06)',
            border: '1px solid rgba(14, 165, 233, 0.15)',
            borderRadius: 'var(--yjrl-radius)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.9rem',
            color: 'var(--yjrl-text-light)',
          }}
        >
          <Package size={20} style={{ color: 'var(--yjrl-sky)', flexShrink: 0 }} />
          <span>
            Items can also be purchased at the canteen on game days at Nev Skuse
            Oval.
          </span>
        </div>
      </div>
    </YJRLLayout>
  );
};

export default YJRLStore;
