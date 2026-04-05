import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';

const news = new Hono<{ Bindings: Env; Variables: Variables }>();

function formatArticle(a: Record<string, unknown>) {
  return {
    ...a, _id: a.id,
    authorName: a.author_name, publishDate: a.publish_date,
    isActive: !!a.is_active, published: !!a.published, featured: !!a.featured,
    tags: typeof a.tags === 'string' ? JSON.parse(a.tags as string) : a.tags,
  };
}

// GET /yjrl/news — published articles
news.get('/', async (c) => {
  let sql = 'SELECT * FROM news WHERE is_active = 1 AND published = 1';
  const params: unknown[] = [];
  const category = c.req.query('category');
  const featured = c.req.query('featured');
  const limit = c.req.query('limit');
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (featured === 'true') { sql += ' AND featured = 1'; }
  sql += ' ORDER BY publish_date DESC, created_at DESC';
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }
  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json((result.results || []).map(formatArticle));
});

// GET /yjrl/news/all — admin: all including drafts
news.get('/all', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const result = await c.env.DB.prepare('SELECT * FROM news WHERE is_active = 1 ORDER BY created_at DESC').all();
  return c.json((result.results || []).map(formatArticle));
});

// GET /yjrl/news/:id
news.get('/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE news SET views = views + 1 WHERE id = ?').bind(id).run();
  const article = await c.env.DB.prepare('SELECT * FROM news WHERE id = ?').bind(id).first();
  if (!article) return c.json({ error: 'Article not found' }, 404);
  return c.json(formatArticle(article));
});

// POST /yjrl/news
news.post('/', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const user = c.get('user');
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO news (id, title, content, excerpt, category, author_id, author_name, image, published, featured, tags, publish_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.title, body.content, body.excerpt || '',
    body.category || 'news', user.id,
    body.authorName || body.author_name || `${user.firstName} ${user.lastName}`.trim() || 'Yeppoon JRL',
    body.image || '', body.published ? 1 : 0, body.featured ? 1 : 0,
    JSON.stringify(body.tags || []),
    body.publishDate || body.publish_date || new Date().toISOString()
  ).run();
  const article = await c.env.DB.prepare('SELECT * FROM news WHERE id = ?').bind(id).first();
  return c.json(formatArticle(article!), 201);
});

// PUT /yjrl/news/:id
news.put('/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json();
  const id = c.req.param('id');
  const fields: string[] = [];
  const vals: unknown[] = [];
  const map: Record<string, string> = {
    title: 'title', content: 'content', excerpt: 'excerpt', category: 'category',
    image: 'image', authorName: 'author_name', author_name: 'author_name',
    publishDate: 'publish_date', publish_date: 'publish_date',
  };
  for (const [k, v] of Object.entries(body)) {
    if (map[k]) { fields.push(`${map[k]} = ?`); vals.push(v); }
  }
  if (body.published !== undefined) { fields.push('published = ?'); vals.push(body.published ? 1 : 0); }
  if (body.featured !== undefined) { fields.push('featured = ?'); vals.push(body.featured ? 1 : 0); }
  if (body.tags) { fields.push('tags = ?'); vals.push(JSON.stringify(body.tags)); }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);
  fields.push('updated_at = datetime(\'now\')');
  vals.push(id);
  await c.env.DB.prepare(`UPDATE news SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
  const article = await c.env.DB.prepare('SELECT * FROM news WHERE id = ?').bind(id).first();
  if (!article) return c.json({ error: 'Article not found' }, 404);
  return c.json(formatArticle(article));
});

// DELETE /yjrl/news/:id
news.delete('/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  await c.env.DB.prepare('UPDATE news SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ message: 'Article removed' });
});

export default news;
