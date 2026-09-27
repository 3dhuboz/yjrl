import { locationFields } from '../../../shared/maps';
import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { approvedMediaUrl } from '../lib/media';

const events = new Hono<{ Bindings: Env; Variables: Variables }>();

function formatEvent(e: Record<string, unknown>, rsvps?: Record<string, unknown>[], includeRsvps = false, image = '') {
  const rsvpList = rsvps || [];
  return {
    _id: e.id,
    id: e.id,
    title: e.title,
    description: e.description,
    type: e.type,
    date: e.date,
    time: e.time,
    venue: e.venue,
    mapsUrl: e.maps_url || '', mapsEmbedUrl: e.maps_embed_url || '',
    address: e.address,
    capacity: e.capacity,
    image,
    color: e.color,
    endDate: e.end_date, endTime: e.end_time,
    ageGroups: typeof e.age_groups === 'string' ? JSON.parse(e.age_groups as string) : e.age_groups,
    isPublic: !!e.is_public, isActive: !!e.is_active,
    rsvps: includeRsvps ? rsvpList.map(r => ({
      userId: r.user_id, name: r.name, status: r.status,
      adults: r.adults, children: r.children, notes: r.notes,
    })) : undefined,
    attendingCount: rsvpList.filter(r => r.status === 'attending').length,
  };
}

// GET /yjrl/events
events.get('/', async (c) => {
  let sql = 'SELECT * FROM events WHERE is_active = 1 AND is_public = 1';
  const params: unknown[] = [];
  if (c.req.query('upcoming') === 'true') {
    sql += " AND COALESCE(NULLIF(end_date, ''), date) >= ?"; params.push(new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' }));
  }
  if (c.req.query('type')) { sql += ' AND type = ?'; params.push(c.req.query('type')!); }
  const limit = c.req.query('limit');
  sql += ' ORDER BY date ASC';
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }
  const result = await c.env.DB.prepare(sql).bind(...params).all();
  // Fetch RSVPs for each event
  const eventsWithRsvps = [];
  for (const e of (result.results || [])) {
    const rsvps = await c.env.DB.prepare('SELECT * FROM event_rsvps WHERE event_id = ?').bind(e.id).all();
    eventsWithRsvps.push(formatEvent(e, rsvps.results || [], false, await approvedMediaUrl(c.env, c.req.url, e.image)));
  }
  return c.json(eventsWithRsvps);
});

events.get('/all', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const result = await c.env.DB.prepare('SELECT * FROM events WHERE is_active = 1 ORDER BY date ASC').all();
  return c.json(await Promise.all((result.results || []).map(async e => formatEvent(e, [], false, await approvedMediaUrl(c.env, c.req.url, e.image)))));
});

// GET /yjrl/events/:id
events.get('/:id', async (c) => {
  const e = await c.env.DB.prepare('SELECT * FROM events WHERE id = ? AND is_public = 1 AND is_active = 1').bind(c.req.param('id')).first();
  if (!e) return c.json({ error: 'Event not found' }, 404);
  const rsvps = await c.env.DB.prepare('SELECT * FROM event_rsvps WHERE event_id = ?').bind(e.id).all();
  return c.json(formatEvent(e, rsvps.results || [], false, await approvedMediaUrl(c.env, c.req.url, e.image)));
});

function eventError(body: Record<string, unknown>, partial: boolean) {
  if ((!partial || body.title !== undefined) && (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 150)) return 'Enter an event title (up to 150 characters).';
  for (const key of ['date', 'endDate']) {
    if (key === 'endDate' && !body[key]) continue;
    if (partial && body[key] === undefined) continue;
    const value = String(body[key] || '');
    const date = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return 'Choose a valid event date.';
  }
  if (body.endDate && body.date && String(body.endDate) < String(body.date)) return 'The end date must be on or after the start date.';
  if (body.type !== undefined && !['training', 'game', 'fundraiser', 'social', 'presentation', 'registration', 'photo-day', 'gala-day', 'other'].includes(String(body.type))) return 'Choose a valid event type.';
  return '';
}

// POST /yjrl/events
events.post('/', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const validation = eventError(body, c.req.method === 'PUT');
  if (validation) return c.json({ error: validation }, 400);
  const image = await approvedMediaUrl(c.env, c.req.url, body.image);
  if (body.image && !image) return c.json({ error: 'Choose an approved reviewed image' }, 400);
  let location;
  try { location = locationFields(body, {}, false); } catch (error) { return c.json({ error: (error as Error).message }, 400); }
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO events (id, title, description, type, date, end_date, time, end_time, venue, address, age_groups, is_public, capacity, image, color, maps_url, maps_embed_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.title, body.description || '', body.type || 'other',
    body.date, body.endDate || body.end_date || null,
    body.time || '', body.endTime || body.end_time || '',
    body.venue || '', body.address || '',
    JSON.stringify(body.ageGroups || body.age_groups || []),
    body.isPublic !== false ? 1 : 0, body.capacity || null,
    image, body.color || '#f0a500', location.link, location.embed
  ).run();
  await writeAudit(c.env, c.get('user'), 'event_created', 'event', id, {
    type: body.type || 'other',
    date: body.date,
    isPublic: body.isPublic !== false,
  });
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first();
  return c.json(formatEvent(event!, [], false, image), 201);
});

// PUT /yjrl/events/:id
events.put('/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const validation = eventError(body, c.req.method === 'PUT');
  if (validation) return c.json({ error: validation }, 400);
  const image = await approvedMediaUrl(c.env, c.req.url, body.image);
  if (body.image && !image) return c.json({ error: 'Choose an approved reviewed image' }, 400);
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT * FROM events WHERE id = ? AND is_active = 1').bind(id).first();
  if (!existing) return c.json({ error: 'Event not found' }, 404);
  try {
    const location = locationFields(body, existing, false);
    body.mapsUrl = location.link; body.mapsEmbedUrl = location.embed;
  } catch (error) { return c.json({ error: (error as Error).message }, 400); }
  const fields: string[] = [];
  const vals: unknown[] = [];
  const map: Record<string, string> = {
    mapsUrl: 'maps_url', mapsEmbedUrl: 'maps_embed_url',
    title: 'title', description: 'description', type: 'type',
    date: 'date', endDate: 'end_date', end_date: 'end_date',
    time: 'time', endTime: 'end_time', end_time: 'end_time',
    venue: 'venue', address: 'address', capacity: 'capacity',
    image: 'image', color: 'color',
  };
  for (const [k, v] of Object.entries(body)) {
    if (map[k]) { fields.push(`${map[k]} = ?`); vals.push(k === 'image' ? image : v); }
  }
  if (body.ageGroups || body.age_groups) { fields.push('age_groups = ?'); vals.push(JSON.stringify(body.ageGroups || body.age_groups)); }
  if (body.isPublic !== undefined) { fields.push('is_public = ?'); vals.push(body.isPublic ? 1 : 0); }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);
  fields.push('updated_at = datetime(\'now\')');
  vals.push(id);
  await c.env.DB.prepare(`UPDATE events SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
  await writeAudit(c.env, c.get('user'), 'event_updated', 'event', id, {
    fields: Object.keys(body),
    isPublic: body.isPublic,
  });
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first();
  if (!event) return c.json({ error: 'Event not found' }, 404);
  return c.json(formatEvent(event, [], false, await approvedMediaUrl(c.env, c.req.url, event.image)));
});

// POST /yjrl/events/:id/rsvp
events.post('/:id/rsvp', authMiddleware, async (c) => {
  const body = await c.req.json();
  const eventId = c.req.param('id');
  const user = c.get('user');
  const name = `${user.firstName} ${user.lastName}`.trim();
  const previousRsvp = await c.env.DB.prepare(
    'SELECT status, adults, children, notes FROM event_rsvps WHERE event_id = ? AND user_id = ?'
  ).bind(eventId, user.id).first();
  await c.env.DB.prepare(
    `INSERT INTO event_rsvps (event_id, user_id, name, status, adults, children, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(event_id, user_id) DO UPDATE SET status = ?, adults = ?, children = ?, notes = ?, rsvp_date = datetime('now')`
  ).bind(
    eventId, user.id, name, body.status || 'attending', body.adults || 1, body.children || 0, body.notes || '',
    body.status || 'attending', body.adults || 1, body.children || 0, body.notes || ''
  ).run();
  await writeAudit(c.env, user, 'event_rsvp_saved', 'event', eventId, {
    previousStatus: previousRsvp?.status || null,
    status: body.status || 'attending',
    changed: !previousRsvp || previousRsvp.status !== (body.status || 'attending'),
    adults: body.adults || 1,
    children: body.children || 0,
    notesChanged: previousRsvp ? previousRsvp.notes !== (body.notes || '') : !!body.notes,
  });
  // Return updated event
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(eventId).first();
  const rsvps = await c.env.DB.prepare('SELECT * FROM event_rsvps WHERE event_id = ?').bind(eventId).all();
  return c.json(formatEvent(event!, rsvps.results || [], false, await approvedMediaUrl(c.env, c.req.url, event!.image)));
});

// DELETE /yjrl/events/:id
events.delete('/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE events SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').bind(id).run();
  await writeAudit(c.env, c.get('user'), 'event_removed', 'event', id);
  return c.json({ message: 'Event removed' });
});

export default events;
