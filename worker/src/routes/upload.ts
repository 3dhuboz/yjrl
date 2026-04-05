import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireCoachOrAdmin, requireBroadcaster } from '../middleware/auth';

const upload = new Hono<{ Bindings: Env; Variables: Variables }>();

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// POST /api/upload
upload.post('/', authMiddleware, async (c) => {
  if (!requireCoachOrAdmin(c) && !requireBroadcaster(c)) return c.json({ error: 'Not authorized' }, 403);

  const contentType = c.req.header('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return c.json({ error: 'Multipart form data required' }, 400);
  }

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return c.json({ error: 'No file provided' }, 400);

  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({ error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}` }, 400);
  }
  if (file.size > MAX_SIZE) {
    return c.json({ error: 'File too large (max 5MB)' }, 400);
  }

  const category = (formData.get('category') as string) || 'general';
  const ext = file.name.split('.').pop() || 'jpg';
  const key = `${category}/${crypto.randomUUID()}.${ext}`;

  await c.env.UPLOADS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  // Return URL served via our own Worker (no R2.dev needed)
  const baseUrl = new URL(c.req.url).origin;
  const url = `${baseUrl}/api/uploads/${key}`;
  return c.json({ url, key }, 201);
});

// GET /api/uploads/:path+ — serve R2 files publicly
upload.get('/:path{.+}', async (c) => {
  const key = c.req.param('path');
  const obj = await c.env.UPLOADS.get(key);
  if (!obj) return c.json({ error: 'Not found' }, 404);
  const headers = new Headers();
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { headers });
});

export default upload;
