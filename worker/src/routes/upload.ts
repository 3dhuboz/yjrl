import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { Env, Variables } from '../types';
import { authMiddleware, requireCoachOrAdmin } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { coachOwnsPlayer, isAdminRole } from '../lib/safeguarding';
import { allPlayersConsent, IMAGE_TYPES, MAX_IMAGE_SIZE, MEDIA_PROCESSING_VERSION, playerIdsFrom, processImage } from '../lib/media';

const upload = new Hono<{ Bindings: Env; Variables: Variables }>();
const CHILD_CATEGORIES = new Set(['player', 'player-photo', 'team', 'news', 'fixture', 'achievement', 'event']);

upload.post('/', authMiddleware, bodyLimit({ maxSize: MAX_IMAGE_SIZE + 64 * 1024 }), async (c) => {
  const user = c.get('user');
  if (!requireCoachOrAdmin(c)) return c.json({ error: 'Coach or admin only' }, 403);
  const data = await c.req.formData().catch(() => null);
  const file: unknown = data?.get('file');
  if (!(file instanceof File) || !IMAGE_TYPES.includes(file.type) || file.size === 0) return c.json({ error: 'Choose a JPEG, PNG or WebP image' }, 400);
  if (file.size > MAX_IMAGE_SIZE) return c.json({ error: 'File too large (max 5MB)' }, 400);

  const category = String(data!.get('category') || 'general').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40) || 'general';
  let submitted: unknown = [];
  try { submitted = JSON.parse(String(data!.get('playerIds') || '[]')); } catch { return c.json({ error: 'Choose the players shown in this image' }, 400); }
  const legacyId = String(data!.get('playerId') || data!.get('player_id') || '').trim();
  const ids = playerIdsFrom(Array.isArray(submitted) && legacyId ? [...submitted, legacyId] : submitted);
  if (!ids || (CHILD_CATEGORIES.has(category) && !ids.length)) return c.json({ error: 'Choose the players shown in this image' }, 400);
  for (const id of ids) {
    if (!isAdminRole(user.role) && !(await coachOwnsPlayer(c.env.DB, user, id))) return c.json({ error: 'Not allowed to upload media for this player' }, 403);
  }
  if (ids.length && !(await allPlayersConsent(c.env, ids))) return c.json({ error: 'Current media consent is required for every player shown' }, 403);
  if (!c.env.IMAGES) return c.json({ error: 'Image uploads are temporarily unavailable. Please try again later.' }, 503);

  let buffer: ArrayBuffer;
  try { buffer = await processImage(c.env, file); } catch {
    return c.json({ error: 'This image could not be processed. Try a different image or try again later.' }, 422);
  }
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const key = `${category}/${crypto.randomUUID()}.webp`;
  await c.env.UPLOADS.put(key, buffer, { httpMetadata: { contentType: 'image/webp' }, customMetadata: { sha256: hash, processingVersion: MEDIA_PROCESSING_VERSION } });
  try {
    await c.env.DB.prepare(
      `INSERT INTO upload_records (key, uploader_user_id, category, player_id, consent_required, consent_granted, status, mime_type, byte_size, sha256, processing_version, player_ids)
       VALUES (?, ?, ?, ?, ?, ?, 'pending_review', 'image/webp', ?, ?, ?, ?)`
    ).bind(key, user.id, category, ids[0] || null, ids.length ? 1 : 0, ids.length ? 1 : 0, buffer.byteLength, hash, MEDIA_PROCESSING_VERSION, JSON.stringify(ids)).run();
  } catch {
    await c.env.UPLOADS.delete(key);
    return c.json({ error: 'The upload could not be saved. Please try again.' }, 503);
  }
  await writeAudit(c.env, user, 'upload_created', 'upload', key, { category, playerIds: ids, processingVersion: MEDIA_PROCESSING_VERSION });
  return c.json({ url: null, status: 'pending_review' }, 201);
});

export default upload;
