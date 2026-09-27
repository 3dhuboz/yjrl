import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const maps = new Hono<{ Bindings: Env; Variables: Variables }>();
maps.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
// The embed key is intentionally public and must be website/API restricted in Google Cloud.
// The separate Places server key must never be returned to a browser.
maps.get('/config', c => c.json({ searchAvailable: !!c.env.GOOGLE_PLACES_API_KEY, embedKey: c.env.GOOGLE_MAPS_EMBED_KEY || '' }));
maps.use('/search', authMiddleware, async (c, next) => requireAdmin(c) ? next() : c.json({ error: 'Admin only' }, 403));
maps.post('/search', rateLimit('maps-search', 30, 60), async c => {
  const body = await c.req.json().catch(() => null);
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (query.length < 3 || query.length > 200) return c.json({ error: 'Enter a venue or address between 3 and 200 characters.' }, 400);
  if (!c.env.GOOGLE_PLACES_API_KEY) return c.json({ error: 'Venue search is awaiting the club’s Google Maps connection. You can search Google Maps in a new tab and add the Share link below.', code: 'maps_not_configured' }, 503);
  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': c.env.GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.attributions' },
      body: JSON.stringify({ textQuery: query, regionCode: 'AU', languageCode: 'en', pageSize: 6 }),
    });
    if (!response.ok) throw new Error('Provider unavailable');
    const data = await response.json() as { places?: { id: string; displayName?: { text?: string }; formattedAddress?: string; attributions?: { provider?: string; providerUri?: string }[] }[] };
    if (data.places !== undefined && !Array.isArray(data.places)) throw new Error('Invalid results');
    return c.json({ places: (data.places || []).filter(place => typeof place.id === 'string' && /^[A-Za-z0-9_-]{1,255}$/.test(place.id)).slice(0, 6).map(place => ({
      id: place.id, name: place.displayName?.text || 'Location', address: place.formattedAddress || '',
      attributions: (place.attributions || []).map(item => ({ name: item.provider || '', url: /^https:\/\//.test(item.providerUri || '') ? item.providerUri : '' })),
    })) });
  } catch { return c.json({ error: 'Google Maps search is unavailable right now. Try again or use the Google Maps link below.' }, 502); }
});
export default maps;
