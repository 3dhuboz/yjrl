import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireCoachOrAdmin } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { coachOwnsPlayer, isAdminRole } from '../lib/safeguarding';

const upload = new Hono<{ Bindings: Env; Variables: Variables }>();

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const PUBLIC_CHILD_CATEGORIES = new Set(['player', 'player-photo', 'team', 'news', 'fixture', 'achievement']);

function safeCategory(value: unknown) {
  const raw = String(value || 'general').toLowerCase().trim();
  return raw.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'general';
}

function hasValidImageSignature(bytes: Uint8Array, type: string) {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  if (type === 'image/webp') {
    return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  return false;
}

async function sha256Hex(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function playerHasMediaConsent(env: Env, playerId: string) {
  const consent = await env.DB.prepare(
    'SELECT media_consent FROM player_consents WHERE player_id = ?'
  ).bind(playerId).first();
  return !!consent?.media_consent;
}

// POST /api/upload
upload.post('/', authMiddleware, async (c) => {
  const user = c.get('user');
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

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (!hasValidImageSignature(bytes, file.type)) {
    return c.json({ error: 'File content does not match the declared image type' }, 400);
  }

  const category = safeCategory(formData.get('category'));
  const playerId = String(formData.get('playerId') || formData.get('player_id') || '').trim();
  if (playerId && !isAdminRole(user.role) && !(await coachOwnsPlayer(c.env.DB, user, playerId))) {
    return c.json({ error: 'Not allowed to upload media for this player' }, 403);
  }

  const consentRequired = !!playerId || PUBLIC_CHILD_CATEGORIES.has(category);
  if (consentRequired) {
    if (!playerId) return c.json({ error: 'A playerId is required for child-related public media uploads' }, 400);
    if (!(await playerHasMediaConsent(c.env, playerId))) {
      return c.json({ error: 'Media consent is required before uploading child-related public media' }, 403);
    }
  }

  const ext = EXT_BY_TYPE[file.type];
  const key = `${category}/${crypto.randomUUID()}.${ext}`;
  const hash = await sha256Hex(buffer);

  await c.env.UPLOADS.put(key, buffer, {
    httpMetadata: { contentType: file.type },
  });

  const publicBase = c.env.UPLOADS_PUBLIC_URL?.replace(/\/+$/, '');
  const url = publicBase ? `${publicBase}/${key}` : null;
  await c.env.DB.prepare(
    `INSERT INTO upload_records
     (key, url, uploader_user_id, category, player_id, consent_required, consent_granted, status, mime_type, byte_size, sha256)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    key,
    url,
    user.id,
    category,
    playerId || null,
    consentRequired ? 1 : 0,
    consentRequired ? 1 : 0,
    consentRequired ? 'pending_review' : 'approved',
    file.type,
    file.size,
    hash,
  ).run();

  await writeAudit(c.env, user, 'upload_created', 'upload', key, { category, playerId: playerId || null, consentRequired });
  return c.json({ url, key, status: consentRequired ? 'pending_review' : 'approved' }, 201);
});

export default upload;
