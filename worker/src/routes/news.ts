import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { writeAudit } from '../lib/audit';

const news = new Hono<{ Bindings: Env; Variables: Variables }>();

function formatArticle(a: Record<string, unknown>, options: { includePrivate?: boolean } = {}) {
  return {
    _id: a.id,
    id: a.id,
    title: a.title,
    content: a.content,
    excerpt: a.excerpt,
    category: a.category,
    authorName: a.author_name,
    image: a.image,
    publishDate: a.publish_date,
    views: a.views,
    isActive: !!a.is_active, published: !!a.published, featured: !!a.featured,
    tags: typeof a.tags === 'string' ? JSON.parse(a.tags as string) : a.tags,
    ...(options.includePrivate ? {
      authorId: a.author_id,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    } : {}),
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
  return c.json((result.results || []).map(article => formatArticle(article)));
});

// GET /yjrl/news/all — admin: all including drafts
news.get('/all', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const result = await c.env.DB.prepare('SELECT * FROM news WHERE is_active = 1 ORDER BY created_at DESC').all();
  return c.json((result.results || []).map(article => formatArticle(article, { includePrivate: true })));
});

// GET /yjrl/news/:id
news.get('/:id', async (c) => {
  const id = c.req.param('id');
  const article = await c.env.DB.prepare('SELECT * FROM news WHERE id = ? AND is_active = 1 AND published = 1').bind(id).first();
  if (!article) return c.json({ error: 'Article not found' }, 404);
  await c.env.DB.prepare('UPDATE news SET views = views + 1 WHERE id = ?').bind(id).run();
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
  await writeAudit(c.env, user, 'news_created', 'news', id, {
    category: body.category || 'news',
    published: !!body.published,
    featured: !!body.featured,
  });
  const article = await c.env.DB.prepare('SELECT * FROM news WHERE id = ?').bind(id).first();
  return c.json(formatArticle(article!, { includePrivate: true }), 201);
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
  await writeAudit(c.env, c.get('user'), 'news_updated', 'news', id, {
    fields: Object.keys(body),
    published: body.published,
    featured: body.featured,
  });
  const article = await c.env.DB.prepare('SELECT * FROM news WHERE id = ?').bind(id).first();
  if (!article) return c.json({ error: 'Article not found' }, 404);
  return c.json(formatArticle(article, { includePrivate: true }));
});

// DELETE /yjrl/news/:id
news.delete('/:id', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE news SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').bind(id).run();
  await writeAudit(c.env, c.get('user'), 'news_removed', 'news', id);
  return c.json({ message: 'Article removed' });
});

export default news;
