import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';

const events = new Hono<{ Bindings: Env; Variables: Variables }>();

function formatEvent(e: Record<string, unknown>, rsvps?: Record<string, unknown>[]) {
  const rsvpList = rsvps || [];
  return {
    ...e, _id: e.id,
    endDate: e.end_date, endTime: e.end_time,
    ageGroups: typeof e.age_groups === 'string' ? JSON.parse(e.age_groups as string) : e.age_groups,
    isPublic: !!e.is_public, isActive: !!e.is_active,
    rsvps: rsvpList.map(r => ({
      userId: r.user_id, name: r.name, status: r.status,
      adults: r.adults, children: r.children, notes: r.notes,
    })),
    attendingCount: rsvpList.filter(r => r.status === 'attending').length,
  };
}

// GET /yjrl/events
events.get('/', async (c) => {
  let sql = 'SELECT * FROM events WHERE is_active = 1';
  const params: unknown[] = [];
  if (c.req.query('upcoming') === 'true') {
    sql += ' AND date >= ?'; params.push(new Date().toISOString().split('T')[0]);
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
    eventsWithRsvps.push(formatEvent(e, rsvps.results || []));
  }
  return c.json(eventsWithRsvps);
});

// GET /yjrl/events/:id
events.get('/:id', async (c) => {
  const e = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(c.req.param('id')).first();
  if (!e) return c.json({ error: 'Event not found' }, 404);
  const rsvps = await c.env.DB.prepare('SELECT * FROM event_rsvps WHERE event_id = ?').bind(e.id).all();
  return c.json(formatEvent(e, rsvps.results || []));
});

// POST /yjrl/events
events.post('/', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO events (id, title, description, type, date, end_date, time, end_time, venue, address, age_groups, is_public, capacity, image, color)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.title, body.description || '', body.type || 'other',
    body.date, body.endDate || body.end_date || null,
    body.time || '', body.endTime || body.end_time || '',
    body.venue || '', body.address || '',
    JSON.stringify(body.ageGroups || body.age_groups || []),
    body.isPublic !== false ? 1 : 0, body.capacity || null,
    body.image || '', body.color || '#f0a500'
  ).run();
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first();
  return c.json(formatEvent(event!), 201);
});

// PUT /yjrl/events/:id
events.put('/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const id = c.req.param('id');
  const fields: string[] = [];
  const vals: unknown[] = [];
  const map: Record<string, string> = {
    title: 'title', description: 'description', type: 'type',
    date: 'date', endDate: 'end_date', end_date: 'end_date',
    time: 'time', endTime: 'end_time', end_time: 'end_time',
    venue: 'venue', address: 'address', capacity: 'capacity',
    image: 'image', color: 'color',
  };
  for (const [k, v] of Object.entries(body)) {
    if (map[k]) { fields.push(`${map[k]} = ?`); vals.push(v); }
  }
  if (body.ageGroups || body.age_groups) { fields.push('age_groups = ?'); vals.push(JSON.stringify(body.ageGroups || body.age_groups)); }
  if (body.isPublic !== undefined) { fields.push('is_public = ?'); vals.push(body.isPublic ? 1 : 0); }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);
  fields.push('updated_at = datetime(\'now\')');
  vals.push(id);
  await c.env.DB.prepare(`UPDATE events SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first();
  if (!event) return c.json({ error: 'Event not found' }, 404);
  return c.json(formatEvent(event));
});

// POST /yjrl/events/:id/rsvp
events.post('/:id/rsvp', authMiddleware, async (c) => {
  const body = await c.req.json();
  const eventId = c.req.param('id');
  const user = c.get('user');
  const name = `${user.firstName} ${user.lastName}`.trim();
  await c.env.DB.prepare(
    `INSERT INTO event_rsvps (event_id, user_id, name, status, adults, children, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(event_id, user_id) DO UPDATE SET status = ?, adults = ?, children = ?, notes = ?, rsvp_date = datetime('now')`
  ).bind(
    eventId, user.id, name, body.status || 'attending', body.adults || 1, body.children || 0, body.notes || '',
    body.status || 'attending', body.adults || 1, body.children || 0, body.notes || ''
  ).run();
  // Return updated event
  const event = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(eventId).first();
  const rsvps = await c.env.DB.prepare('SELECT * FROM event_rsvps WHERE event_id = ?').bind(eventId).all();
  return c.json(formatEvent(event!, rsvps.results || []));
});

// DELETE /yjrl/events/:id
events.delete('/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  await c.env.DB.prepare('UPDATE events SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ message: 'Event removed' });
});

export default events;
