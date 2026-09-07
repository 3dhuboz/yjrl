import React, { useId } from 'react';
import VenueMap from './VenueMap';
import { locationFields } from '../../../shared/maps';

export default function MapLocationFields({ form, setForm, training = false }) {
  const id = useId();
  const linkKey = training ? 'trainingMapsUrl' : 'mapsUrl';
  const embedKey = training ? 'trainingMapsEmbedUrl' : 'mapsEmbedUrl';
  let error = '';
  try { locationFields(form, {}, training); } catch (e) { error = e.message; }
  return <fieldset className="venue-map-fields">
    <legend>{training ? 'Training location' : 'Venue location'} on Google Maps</legend>
    <label className="yjrl-label" htmlFor={`${id}-link`}>Google Maps Share link</label>
    <input id={`${id}-link`} className="yjrl-input" placeholder="https://maps.app.goo.gl/…" value={form[linkKey] || ''} onChange={e => setForm(prev => ({ ...prev, [linkKey]: e.target.value }))} />
    <p>Find the venue or exact entrance in Google Maps, choose Share, then Copy link.</p>
    <label className="yjrl-label" htmlFor={`${id}-embed`}>Map preview (optional)</label>
    <textarea id={`${id}-embed`} className="yjrl-input" rows={2} placeholder="Paste the Google Maps embed code" value={form[embedKey] || ''} onChange={e => setForm(prev => ({ ...prev, [embedKey]: e.target.value }))} />
    <p>On Google Maps on a computer, choose Share → Embed a map → Copy HTML. Use the same location as the Share link. Visitors can click the preview to open the location.</p>
    {error ? <p role="alert" style={{ color: '#b91c1c' }}>{error}</p> : form[linkKey] && <VenueMap venue={form[training ? 'trainingVenue' : 'venue']} url={form[linkKey]} embedUrl={form[embedKey]} />}
  </fieldset>;
}
