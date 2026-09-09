// Accept Google Maps destinations, never arbitrary external URLs or raw HTML.
export function googleMapsSearch(query: string, placeId = ''): string {
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', query.trim());
  if (placeId && /^[A-Za-z0-9_-]{1,255}$/.test(placeId)) url.searchParams.set('query_place_id', placeId);
  return url.href;
}

export function googlePlaceEmbed(link: string, key: string): string {
  if (!key || !/^[A-Za-z0-9_-]{10,200}$/.test(key)) return '';
  try {
    const id = new URL(mapsUrl(link)).searchParams.get('query_place_id');
    if (!id || !/^[A-Za-z0-9_-]{1,255}$/.test(id)) return '';
    const url = new URL('https://www.google.com/maps/embed/v1/place');
    url.searchParams.set('key', key);
    url.searchParams.set('q', `place_id:${id}`);
    return url.href;
  } catch { return ''; }
}

export function mapsUrl(value: unknown, embed = false): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || value.length > 12000) throw new Error('Use a Google Maps link.');
  let raw = value.trim();
  if (embed && raw.startsWith('<iframe')) {
    const match = raw.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (!match) throw new Error('Paste the Google Maps embed code or embed URL.');
    raw = match[1].replace(/&amp;/g, '&');
  }
  if (!raw) return '';
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Use a complete Google Maps link starting with https://.'); }
  const google = ['www.google.com', 'google.com', 'maps.google.com', 'www.google.com.au', 'google.com.au', 'maps.google.com.au'].includes(url.hostname);
  const valid = embed
    ? google && url.pathname === '/maps/embed' && !!url.searchParams.get('pb')
    : (google && /^\/maps(?:\/|$)/.test(url.pathname) && !url.pathname.startsWith('/maps/embed'))
      || (url.hostname === 'maps.app.goo.gl' && /^\/[\w-]+\/?$/.test(url.pathname))
      || (url.hostname === 'goo.gl' && /^\/maps\/[\w-]+\/?$/.test(url.pathname));
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !valid || /[\u0000-\u0020]/.test(raw)) {
    throw new Error(embed ? 'Use the embed code from Google Maps → Share → Embed a map.' : 'Use a Google Maps Share link or directions link.');
  }
  return url.href;
}

export function locationFields(body: Record<string, unknown>, existing: Record<string, unknown> = {}, training = false) {
  const linkKey = training ? 'trainingMapsUrl' : 'mapsUrl';
  const embedKey = training ? 'trainingMapsEmbedUrl' : 'mapsEmbedUrl';
  const column = training ? 'training_maps_' : 'maps_';
  const link = mapsUrl(body[linkKey] === undefined ? existing[`${column}url`] : body[linkKey]);
  const embed = mapsUrl(body[embedKey] === undefined ? existing[`${column}embed_url`] : body[embedKey], true);
  if (embed && !link) throw new Error('Add the Google Maps Share link as well, so visitors can open this location.');
  return { link, embed };
}
