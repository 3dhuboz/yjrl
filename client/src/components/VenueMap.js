import React from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import { mapsUrl } from '../../../shared/maps';

export default function VenueMap({ venue, url, embedUrl, compact = false }) {
  let link = '', embed = '';
  try { link = mapsUrl(url); embed = mapsUrl(embedUrl, true); } catch { /* Leave invalid legacy data as text. */ }
  if (!link) return <span className="venue-label"><MapPin size={14} />{venue || 'Location TBC'}</span>;
  return <a className={`venue-map${compact ? ' venue-map-compact' : ''}`} href={link} target="_blank" rel="noopener noreferrer" aria-label={`Open ${venue || 'this location'} in Google Maps (new tab)`}>
    {!compact && embed && <iframe title={`Map of ${venue || 'venue'}`} src={embed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" tabIndex={-1} aria-hidden="true" />}
    <span className="venue-map-caption"><MapPin size={16} /><span>{venue || 'View location'}<small>Open in Google Maps</small></span><ExternalLink size={14} /></span>
  </a>;
}
