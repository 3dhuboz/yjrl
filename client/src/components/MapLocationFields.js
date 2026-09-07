import React, { useId, useRef, useState } from 'react';
import VenueMap from './VenueMap';
import { locationFields, googleMapsSearch } from '../../../shared/maps';
import api from '../api';
import useMapsConfig from '../useMapsConfig';

export default function MapLocationFields({ form, setForm, training = false }) {
  const id = useId();
  const linkKey = training ? 'trainingMapsUrl' : 'mapsUrl';
  const embedKey = training ? 'trainingMapsEmbedUrl' : 'mapsEmbedUrl';
  const venueKey = training ? 'trainingVenue' : 'venue';
  const config = useMapsConfig();
  const [query, setQuery] = useState(form[venueKey] || ''), [results, setResults] = useState(null), [busy, setBusy] = useState(false), [searchError, setSearchError] = useState('');
  const generation = useRef(0);
  const changeQuery = value => { generation.current++; setQuery(value); setResults(null); setSearchError(''); setBusy(false); };
  const search = async () => {
    if (query.trim().length < 3) { setSearchError('Enter at least 3 characters to search.'); return; }
    const current = ++generation.current;
    setBusy(true); setSearchError(''); setResults(null);
    try {
      const res = await api.post('/yjrl/maps/search', { query: query.trim() });
      if (current === generation.current) setResults(res.data.places);
    } catch (e) { if (current === generation.current) setSearchError(e.response?.data?.error || 'Could not search Google Maps. Please try again.'); }
    finally { if (current === generation.current) setBusy(false); }
  };
  const choose = place => {
    // Persist the Place ID and admin-entered label/query, not cached Google result details.
    setForm(prev => ({ ...prev, [venueKey]: query.trim(), [linkKey]: googleMapsSearch(query, place.id), [embedKey]: '' }));
    setResults(null);
  };
  let error = '';
  try { locationFields(form, {}, training); } catch (e) { error = e.message; }
  return <fieldset className="venue-map-fields">
    <legend>{training ? 'Training location' : 'Venue location'} on Google Maps</legend>
    <label className="yjrl-label" htmlFor={`${id}-search`}>Search for a venue or address</label>
    <div className="map-search-controls">
      <input id={`${id}-search`} className="yjrl-input" maxLength={200} value={query} placeholder="e.g. Nev Skuse Oval, Yeppoon" onChange={e => changeQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (config?.searchAvailable) search(); } }} />
      {config?.searchAvailable && <button type="button" className="yjrl-btn yjrl-btn-primary" disabled={busy} onClick={search}>{busy ? 'Searching…' : 'Search venues'}</button>}
    </div>
    <p>{config?.searchAvailable ? 'Choose the correct result, then save this form to link the public map.' : 'Search in Google Maps, then copy the chosen place’s Share link below. Results inside this form are awaiting the club’s Google Maps connection.'}</p>
    {query.trim() && <a className="yjrl-btn yjrl-btn-secondary" href={googleMapsSearch(query)} target="_blank" rel="noopener noreferrer">Search Google Maps (new tab)</a>}
    {searchError && <p role="alert" className="yjrl-form-error">{searchError}</p>}
    {results && <div className="map-search-results" aria-live="polite">
      <p className="google-maps-attribution" translate="no">Google Maps</p>
      {!results.length && <p>No locations found. Include the suburb or street address and try again.</p>}
      {results.map(place => <div className="map-search-result" key={place.id}>
        <strong>{place.name}</strong><p>{place.address}</p>
        <div className="admin-toolbar"><button type="button" className="yjrl-btn yjrl-btn-primary" aria-label={`Use ${place.name}, ${place.address}`} onClick={() => choose(place)}>Use this location</button><a href={googleMapsSearch(query, place.id)} target="_blank" rel="noopener noreferrer">Check map</a></div>
        {place.attributions?.map((item, index) => <small key={index}>{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.name}</a> : item.name}</small>)}
      </div>)}
    </div>}
    {form[linkKey]?.includes('query_place_id=') && <p role="status">Location selected. Save this form to update the public map.</p>}
    <label className="yjrl-label" htmlFor={`${id}-link`}>Google Maps Share link</label>
    <input id={`${id}-link`} className="yjrl-input" placeholder="https://maps.app.goo.gl/…" value={form[linkKey] || ''} onChange={e => setForm(prev => ({ ...prev, [linkKey]: e.target.value, [embedKey]: '' }))} />
    <p>Filled when you choose a search result. You can also paste a Share link for an exact entrance.</p>
    <label className="yjrl-label" htmlFor={`${id}-embed`}>Map preview (optional)</label>
    <textarea id={`${id}-embed`} className="yjrl-input" rows={2} placeholder="Paste the Google Maps embed code" value={form[embedKey] || ''} onChange={e => setForm(prev => ({ ...prev, [embedKey]: e.target.value }))} />
    <p>On Google Maps on a computer, choose Share → Embed a map → Copy HTML. Use the same location as the Share link. Visitors can click the preview to open the location.</p>
    {error ? <p role="alert" style={{ color: '#b91c1c' }}>{error}</p> : form[linkKey] && <VenueMap venue={form[training ? 'trainingVenue' : 'venue']} url={form[linkKey]} embedUrl={form[embedKey]} />}
  </fieldset>;
}
