import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';

const club = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─── SPONSORS (public read, admin write) ─────────────────────────────────────

club.get('/sponsors', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM sponsors WHERE is_active = 1 ORDER BY sort_order ASC, tier ASC, name ASC'
  ).all();
  return c.json(result.results || []);
});

club.post('/sponsors', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO sponsors (id, name, logo, website, description, tier, contact_name, contact_email, contact_phone, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, body.name, body.logo || '', body.website || '', body.description || '',
    body.tier || 'bronze', body.contactName || '', body.contactEmail || '', body.contactPhone || '',
    body.sortOrder || 0).run();
  const sponsor = await c.env.DB.prepare('SELECT * FROM sponsors WHERE id = ?').bind(id).first();
  return c.json(sponsor, 201);
});

club.put('/sponsors/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const id = c.req.param('id');
  const fields: string[] = [];
  const vals: unknown[] = [];
  const map: Record<string, string> = {
    name: 'name', logo: 'logo', website: 'website', description: 'description',
    tier: 'tier', contactName: 'contact_name', contactEmail: 'contact_email',
    contactPhone: 'contact_phone', sortOrder: 'sort_order',
  };
  for (const [k, v] of Object.entries(body)) { if (map[k]) { fields.push(`${map[k]} = ?`); vals.push(v); } }
  if (fields.length === 0) return c.json({ error: 'No fields' }, 400);
  fields.push('updated_at = datetime(\'now\')');
  vals.push(id);
  await c.env.DB.prepare(`UPDATE sponsors SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
  const sponsor = await c.env.DB.prepare('SELECT * FROM sponsors WHERE id = ?').bind(id).first();
  return c.json(sponsor);
});

club.delete('/sponsors/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  await c.env.DB.prepare('UPDATE sponsors SET is_active = 0 WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ message: 'Sponsor removed' });
});

// ─── MERCH (public read, admin write) ────────────────────────────────────────

club.get('/merch', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM merch_items WHERE is_active = 1 ORDER BY sort_order ASC, name ASC'
  ).all();
  return c.json((result.results || []).map(m => ({
    ...m, _id: m.id,
    sizes: typeof m.sizes === 'string' ? JSON.parse(m.sizes as string) : m.sizes,
    inStock: !!m.in_stock, externalUrl: m.external_url,
  })));
});

club.post('/merch', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO merch_items (id, name, description, price, image, category, sizes, in_stock, external_url, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, body.name, body.description || '', body.price || 0, body.image || '',
    body.category || 'apparel', JSON.stringify(body.sizes || []),
    body.inStock !== false ? 1 : 0, body.externalUrl || body.external_url || '',
    body.sortOrder || 0).run();
  return c.json({ _id: id, id }, 201);
});

club.put('/merch/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const id = c.req.param('id');
  const fields: string[] = [];
  const vals: unknown[] = [];
  const map: Record<string, string> = {
    name: 'name', description: 'description', price: 'price', image: 'image',
    category: 'category', externalUrl: 'external_url', external_url: 'external_url',
    sortOrder: 'sort_order',
  };
  for (const [k, v] of Object.entries(body)) { if (map[k]) { fields.push(`${map[k]} = ?`); vals.push(v); } }
  if (body.sizes) { fields.push('sizes = ?'); vals.push(JSON.stringify(body.sizes)); }
  if (body.inStock !== undefined) { fields.push('in_stock = ?'); vals.push(body.inStock ? 1 : 0); }
  if (fields.length === 0) return c.json({ error: 'No fields' }, 400);
  fields.push('updated_at = datetime(\'now\')');
  vals.push(id);
  await c.env.DB.prepare(`UPDATE merch_items SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
  return c.json({ message: 'Updated' });
});

club.delete('/merch/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  await c.env.DB.prepare('UPDATE merch_items SET is_active = 0 WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ message: 'Removed' });
});

// ─── RAFFLES (public read, admin write) ──────────────────────────────────────

club.get('/raffles', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM raffles WHERE is_active = 1 ORDER BY CASE status WHEN \'active\' THEN 0 WHEN \'drawn\' THEN 1 ELSE 2 END, draw_date ASC'
  ).all();
  return c.json((result.results || []).map(r => ({
    ...r, _id: r.id, ticketPrice: r.ticket_price, externalUrl: r.external_url,
    drawDate: r.draw_date, prizeDescription: r.prize_description, winnerName: r.winner_name,
  })));
});

club.post('/raffles', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO raffles (id, title, description, image, prize_description, ticket_price, external_url, draw_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, body.title, body.description || '', body.image || '',
    body.prizeDescription || '', body.ticketPrice || 0,
    body.externalUrl || '', body.drawDate || null, body.status || 'active').run();
  return c.json({ _id: id, id }, 201);
});

club.put('/raffles/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const id = c.req.param('id');
  const fields: string[] = [];
  const vals: unknown[] = [];
  const map: Record<string, string> = {
    title: 'title', description: 'description', image: 'image',
    prizeDescription: 'prize_description', ticketPrice: 'ticket_price',
    externalUrl: 'external_url', drawDate: 'draw_date', status: 'status',
    winnerName: 'winner_name',
  };
  for (const [k, v] of Object.entries(body)) { if (map[k]) { fields.push(`${map[k]} = ?`); vals.push(v); } }
  if (fields.length === 0) return c.json({ error: 'No fields' }, 400);
  fields.push('updated_at = datetime(\'now\')');
  vals.push(id);
  await c.env.DB.prepare(`UPDATE raffles SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
  return c.json({ message: 'Updated' });
});

club.delete('/raffles/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  await c.env.DB.prepare('UPDATE raffles SET is_active = 0 WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ message: 'Removed' });
});

// ─── CARNIVALS (public read, admin write, public registration) ───────────────

club.get('/carnivals', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM carnivals WHERE is_active = 1 ORDER BY date ASC'
  ).all();
  const carnivals = [];
  for (const car of (result.results || [])) {
    const regs = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM carnival_registrations WHERE carnival_id = ?').bind(car.id).first();
    carnivals.push({
      ...car, _id: car.id,
      ageGroups: typeof car.age_groups === 'string' ? JSON.parse(car.age_groups as string) : car.age_groups,
      entryFee: car.entry_fee, maxTeams: car.max_teams, externalUrl: car.external_url,
      endDate: car.end_date, contactName: car.contact_name, contactEmail: car.contact_email,
      registrationCount: (regs as Record<string, number>)?.cnt || 0,
    });
  }
  return c.json(carnivals);
});

club.get('/carnivals/:id', async (c) => {
  const car = await c.env.DB.prepare('SELECT * FROM carnivals WHERE id = ?').bind(c.req.param('id')).first();
  if (!car) return c.json({ error: 'Not found' }, 404);
  const regs = await c.env.DB.prepare('SELECT * FROM carnival_registrations WHERE carnival_id = ? ORDER BY created_at DESC').bind(car.id).all();
  return c.json({
    ...car, _id: car.id,
    ageGroups: typeof car.age_groups === 'string' ? JSON.parse(car.age_groups as string) : car.age_groups,
    registrations: regs.results || [],
  });
});

club.post('/carnivals', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO carnivals (id, title, description, image, date, end_date, time, venue, address, age_groups, max_teams, entry_fee, external_url, contact_name, contact_email, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, body.title, body.description || '', body.image || '',
    body.date, body.endDate || null, body.time || '', body.venue || '', body.address || '',
    JSON.stringify(body.ageGroups || []), body.maxTeams || null, body.entryFee || 0,
    body.externalUrl || '', body.contactName || '', body.contactEmail || '',
    body.status || 'open').run();
  return c.json({ _id: id, id }, 201);
});

club.put('/carnivals/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const id = c.req.param('id');
  const fields: string[] = [];
  const vals: unknown[] = [];
  const map: Record<string, string> = {
    title: 'title', description: 'description', image: 'image',
    date: 'date', endDate: 'end_date', time: 'time', venue: 'venue', address: 'address',
    maxTeams: 'max_teams', entryFee: 'entry_fee', externalUrl: 'external_url',
    contactName: 'contact_name', contactEmail: 'contact_email', status: 'status',
  };
  for (const [k, v] of Object.entries(body)) { if (map[k]) { fields.push(`${map[k]} = ?`); vals.push(v); } }
  if (body.ageGroups) { fields.push('age_groups = ?'); vals.push(JSON.stringify(body.ageGroups)); }
  if (fields.length === 0) return c.json({ error: 'No fields' }, 400);
  fields.push('updated_at = datetime(\'now\')');
  vals.push(id);
  await c.env.DB.prepare(`UPDATE carnivals SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
  return c.json({ message: 'Updated' });
});

club.delete('/carnivals/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  await c.env.DB.prepare('UPDATE carnivals SET is_active = 0 WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ message: 'Removed' });
});

// POST register for a carnival (public — no auth needed)
club.post('/carnivals/:id/register', async (c) => {
  const body = await c.req.json();
  const carnivalId = c.req.param('id');
  const { teamName, ageGroup, contactName, contactEmail, contactPhone, playersCount, notes } = body;
  if (!teamName || !contactName || !contactEmail) {
    return c.json({ error: 'Team name, contact name, and email are required' }, 400);
  }
  await c.env.DB.prepare(
    `INSERT INTO carnival_registrations (carnival_id, team_name, age_group, contact_name, contact_email, contact_phone, players_count, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(carnivalId, teamName, ageGroup || '', contactName, contactEmail, contactPhone || '', playersCount || 0, notes || '').run();
  return c.json({ message: 'Registration submitted' }, 201);
});

export default club;
