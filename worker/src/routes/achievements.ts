import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';

const achievements = new Hono<{ Bindings: Env; Variables: Variables }>();

function format(a: Record<string, unknown>) {
  return { ...a, _id: a.id, xpValue: a.xp_value, isActive: !!a.is_active };
}

// GET /yjrl/achievements
achievements.get('/', async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM achievements WHERE is_active = 1 ORDER BY rarity ASC, name ASC').all();
  return c.json((result.results || []).map(format));
});

// POST /yjrl/achievements
achievements.post('/', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO achievements (id, name, description, icon, category, criteria, rarity, color, xp_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id, body.name, body.description || '', body.icon || '🏆',
    body.category || 'milestone', body.criteria || '',
    body.rarity || 'common', body.color || '#f0a500',
    body.xpValue || body.xp_value || 10
  ).run();
  const a = await c.env.DB.prepare('SELECT * FROM achievements WHERE id = ?').bind(id).first();
  return c.json(format(a!), 201);
});

// PUT /yjrl/achievements/:id
achievements.put('/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const id = c.req.param('id');
  const fields: string[] = [];
  const vals: unknown[] = [];
  const map: Record<string, string> = {
    name: 'name', description: 'description', icon: 'icon', category: 'category',
    criteria: 'criteria', rarity: 'rarity', color: 'color', xpValue: 'xp_value', xp_value: 'xp_value',
  };
  for (const [k, v] of Object.entries(body)) {
    if (map[k]) { fields.push(`${map[k]} = ?`); vals.push(v); }
  }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);
  fields.push('updated_at = datetime(\'now\')');
  vals.push(id);
  await c.env.DB.prepare(`UPDATE achievements SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
  const a = await c.env.DB.prepare('SELECT * FROM achievements WHERE id = ?').bind(id).first();
  if (!a) return c.json({ error: 'Achievement not found' }, 404);
  return c.json(format(a));
});

export default achievements;
