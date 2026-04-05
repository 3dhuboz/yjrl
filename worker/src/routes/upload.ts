import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireCoachOrAdmin } from '../middleware/auth';

const upload = new Hono<{ Bindings: Env; Variables: Variables }>();

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// POST /api/upload
upload.post('/', authMiddleware, async (c) => {
  if (!requireCoachOrAdmin(c)) return c.json({ error: 'Coach or admin only' }, 403);

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

  // Return the R2 public URL — requires R2.dev access or custom domain
  const url = `https://yjrl-uploads.r2.dev/${key}`;
  return c.json({ url, key }, 201);
});

export default upload;
