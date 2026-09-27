import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { recordChildAccess } from '../lib/childAccess';
import { isPublicMedia, mediaPlayerIds, MEDIA_PROCESSING_VERSION } from '../lib/media';

const media = new Hono<{ Bindings: Env; Variables: Variables }>();
const imageHeaders = { 'Content-Type': 'image/webp', 'Cache-Control': 'no-store', 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' };

media.get('/', async (c) => {
  c.header('Cache-Control', 'no-store');
  const record = await c.env.DB.prepare('SELECT * FROM upload_records WHERE key = ?').bind(c.req.query('key') || '').first();
  if (!record || !(await isPublicMedia(c.env, record))) return c.json({ error: 'Media not found' }, 404);
  const object = await c.env.UPLOADS.get(String(record.key));
  if (!object || object.customMetadata?.sha256 !== record.sha256) return c.json({ error: 'Media not found' }, 404);
  return new Response(object.body, { headers: imageHeaders });
});

media.get('/preview', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const record = await c.env.DB.prepare('SELECT * FROM upload_records WHERE key = ?').bind(c.req.query('key') || '').first();
  if (!record || record.status === 'rejected') return c.json({ error: 'Media not found' }, 404);
  if (record.processing_version !== MEDIA_PROCESSING_VERSION) return c.json({ error: 'Re-upload this image so it can be processed before review' }, 409);
  const object = await c.env.UPLOADS.get(String(record.key));
  if (!object || object.customMetadata?.sha256 !== record.sha256) return c.json({ error: 'Media not found' }, 404);
  try {
    await recordChildAccess(c.env, c.get('user'), 'media_preview', await mediaPlayerIds(c.env, String(record.key)), 'admin', { key: String(record.key), sha256: String(record.sha256) });
  } catch { return c.json({ error: 'Preview temporarily unavailable' }, 503); }
  return new Response(object.body, { headers: imageHeaders });
});

export default media;
