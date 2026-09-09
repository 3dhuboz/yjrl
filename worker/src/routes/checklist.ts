import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { IMAGE_TYPES, MAX_IMAGE_SIZE, MEDIA_PROCESSING_VERSION, processImage } from '../lib/media';
import { writeAudit } from '../lib/audit';
import sections from '../../../shared/websiteChecklist.json';

type C = Context<{ Bindings: Env; Variables: Variables }>;
const checklist = new Hono<{ Bindings: Env; Variables: Variables }>();
const validItem = (id: string) => sections.some(section => section.id === id);
export async function tokenHash(token: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))), b => b.toString(16).padStart(2, '0')).join('');
}
async function access(c: C, next: Next) {
  c.header('Cache-Control', 'no-store');
  const token = c.req.header('X-Checklist-Token');
  if (token !== undefined) {
    if (!/^[a-f0-9]{64}$/.test(token)) return c.json({ error: 'This private link is invalid or has expired.', code: 'checklist_link_invalid' }, 403);
    const row = await c.env.DB.prepare('SELECT id FROM checklist_links WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?').bind(await tokenHash(token), new Date().toISOString()).first();
    if (!row) return c.json({ error: 'This private link is invalid or has expired. Ask the club for a new link.', code: 'checklist_link_invalid' }, 403);
    c.set('checklistActor', `link:${row.id}`); c.set('checklistAdmin', false); await next(); return;
  }
  return authMiddleware(c, async () => {
    if (!requireAdmin(c)) { c.res = c.json({ error: 'Use your private checklist link or a club admin account.' }, 403); return; }
    c.set('checklistActor', `user:${c.get('user').id}`); c.set('checklistAdmin', true); await next();
  });
}
async function admin(c: C, next: Next) {
  return authMiddleware(c, async () => {
    if (!requireAdmin(c)) { c.res = c.json({ error: 'Admin only.' }, 403); return; }
    c.set('checklistActor', `user:${c.get('user').id}`); c.set('checklistAdmin', true); await next();
  });
}
const log = (c: C, action: string, itemId: string | null = null, photoId: string | null = null) => c.env.DB.prepare('INSERT INTO checklist_history(actor, action, item_id, photo_id) VALUES (?, ?, ?, ?)').bind(c.get('checklistActor'), action, itemId, photoId);

checklist.get('/', access, async c => {
  await log(c, 'checklist_viewed').run();
  const [items, photos] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM checklist_items').all(),
    c.env.DB.prepare('SELECT id, item_id, caption, byte_size, created_at, library_key FROM checklist_photos WHERE removed_at IS NULL ORDER BY created_at').all(),
  ]);
  return c.json({ canManage: c.get('checklistAdmin'), sections: sections.map(section => ({ ...section,
    notes: '', status: 'gathering', version: 0, ...(items.results || []).find(item => item.id === section.id),
    photos: (photos.results || []).filter(photo => photo.item_id === section.id).map(photo => ({ ...photo, inPhotoReview: !!photo.library_key, library_key: undefined })),
  })) });
});
checklist.put('/items/:id', access, bodyLimit({ maxSize: 24000 }), async c => {
  const id = c.req.param('id'), body = await c.req.json().catch(() => null);
  if (!validItem(id)) return c.json({ error: 'Checklist item not found.' }, 404);
  if (!body || typeof body.notes !== 'string' || body.notes.length > 10000 || !Number.isSafeInteger(body.version) || body.version < 0
    || !['gathering', 'submitted', 'complete'].includes(body.status)) return c.json({ error: 'Add notes up to 10,000 characters and choose a checklist status.' }, 400);
  if (body.status === 'complete' && !c.get('checklistAdmin')) return c.json({ error: 'The club marks items added to the website after review.' }, 403);
  if (body.status === 'submitted' && !body.notes.trim() && !await c.env.DB.prepare('SELECT id FROM checklist_photos WHERE item_id = ? AND removed_at IS NULL LIMIT 1').bind(id).first()) return c.json({ error: 'Add some notes or a photo before sending this item for review.' }, 400);
  const updated = body.version === 0
    ? await c.env.DB.prepare(`INSERT INTO checklist_items(id, notes, status, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING RETURNING version`).bind(id, body.notes.trim(), body.status, c.get('checklistActor')).first()
    : await c.env.DB.prepare(`UPDATE checklist_items SET notes = ?, status = ?, version = version + 1, updated_by = ?, updated_at = datetime('now') WHERE id = ? AND version = ? RETURNING version`).bind(body.notes.trim(), body.status, c.get('checklistActor'), id, body.version).first();
  if (!updated) return c.json({ error: 'Someone saved a newer version. Copy your notes, reload this item and try again.', code: 'checklist_conflict' }, 409);
  await log(c, `item_${body.status}`, id).run();
  return c.json({ version: updated.version, status: body.status });
});

checklist.get('/links', admin, async c => {
  const result = await c.env.DB.prepare('SELECT id, label, created_at, expires_at, revoked_at FROM checklist_links ORDER BY created_at DESC').all();
  return c.json(result.results || []);
});
checklist.post('/links', admin, async c => {
  const body = await c.req.json().catch(() => null);
  const label = typeof body?.label === 'string' ? body.label.trim() : '';
  if (!label || label.length > 80) return c.json({ error: 'Give the private link a name, such as Nathan.' }, 400);
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  const id = crypto.randomUUID(), expiresAt = new Date(Date.now() + 90 * 86400000).toISOString();
  await c.env.DB.prepare('INSERT INTO checklist_links(id, label, token_hash, created_by, expires_at) VALUES (?, ?, ?, ?, ?)').bind(id, label, await tokenHash(token), c.get('user').id, expiresAt).run();
  await writeAudit(c.env, c.get('user'), 'checklist_link_created', 'checklist_link', id, { label, expiresAt });
  return c.json({ id, token, expiresAt }, 201);
});
checklist.delete('/links/:id', admin, async c => {
  await c.env.DB.prepare("UPDATE checklist_links SET revoked_at = datetime('now') WHERE id = ?").bind(c.req.param('id')).run();
  await writeAudit(c.env, c.get('user'), 'checklist_link_revoked', 'checklist_link', c.req.param('id'));
  return c.json({ revoked: true });
});

checklist.post('/items/:id/photos', access, bodyLimit({ maxSize: MAX_IMAGE_SIZE + 16000 }), async c => {
  const itemId = c.req.param('id');
  if (!validItem(itemId)) return c.json({ error: 'Checklist item not found.' }, 404);
  const form = await c.req.formData().catch(() => null);
  const file: unknown = form?.get('file');
  const caption = String(form?.get('caption') || '').trim();
  if (!(file instanceof File) || !IMAGE_TYPES.includes(file.type) || !file.size || file.size > MAX_IMAGE_SIZE) return c.json({ error: 'Choose a JPG, PNG or WebP photo up to 5 MB.' }, 400);
  if (!caption || caption.length > 500 || form?.get('permissionConfirmed') !== 'true') return c.json({ error: 'Add a photo description and confirm you have permission to supply it.' }, 400);
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM checklist_photos WHERE item_id = ? AND removed_at IS NULL').bind(itemId).first();
  if (Number(count?.n) >= 20) return c.json({ error: 'This item already has 20 photos. Remove one before adding another.' }, 409);
  if (!c.env.IMAGES) return c.json({ error: 'Photo uploads are temporarily unavailable.' }, 503);
  let buffer: ArrayBuffer;
  try { buffer = await processImage(c.env, file); } catch { return c.json({ error: 'This photo could not be processed. Please try another image.' }, 422); }
  const id = crypto.randomUUID(), key = `checklist/${id}.webp`;
  const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), b => b.toString(16).padStart(2, '0')).join('');
  await c.env.UPLOADS.put(key, buffer, { httpMetadata: { contentType: 'image/webp' }, customMetadata: { sha256: sha, processingVersion: MEDIA_PROCESSING_VERSION } });
  try {
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO checklist_photos(id, item_id, storage_key, caption, sha256, byte_size, supplied_by, permission_confirmed) VALUES (?, ?, ?, ?, ?, ?, ?, 1)').bind(id, itemId, key, caption, sha, buffer.byteLength, c.get('checklistActor')),
      log(c, 'photo_supplied', itemId, id),
      c.env.DB.prepare("UPDATE checklist_items SET status = 'gathering', version = version + 1, updated_by = ?, updated_at = datetime('now') WHERE id = ? AND status = 'complete'").bind(c.get('checklistActor'), itemId),
    ]);
  } catch (error) {
    await c.env.UPLOADS.delete(key);
    if (String(error).includes('checklist_photo_limit')) return c.json({ error: 'This item already has 20 photos.' }, 409);
    return c.json({ error: 'The photo could not be saved. Please try again.' }, 503);
  }
  return c.json({ id, item_id: itemId, caption, byte_size: buffer.byteLength, inPhotoReview: false }, 201);
});
checklist.get('/photos/:id', access, async c => {
  const row = await c.env.DB.prepare('SELECT * FROM checklist_photos WHERE id = ? AND removed_at IS NULL').bind(c.req.param('id')).first();
  if (!row) return c.json({ error: 'Photo not found.' }, 404);
  await log(c, 'photo_viewed', String(row.item_id), String(row.id)).run();
  const object = await c.env.UPLOADS.get(String(row.storage_key));
  if (!object || object.customMetadata?.sha256 !== row.sha256) return c.json({ error: 'Photo unavailable.' }, 404);
  return new Response(object.body, { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'no-store', 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff' } });
});
checklist.delete('/photos/:id', access, async c => {
  const row = await c.env.DB.prepare('SELECT * FROM checklist_photos WHERE id = ? AND removed_at IS NULL').bind(c.req.param('id')).first();
  if (!row) return c.json({ error: 'Photo not found.' }, 404);
  // Retain the stored object once handed to the club's media library; publication/consent stays with that review workflow.
  await c.env.DB.batch([c.env.DB.prepare("UPDATE checklist_photos SET removed_at = datetime('now') WHERE id = ?").bind(row.id), log(c, 'photo_removed', String(row.item_id), String(row.id))]);
  return c.json({ removed: true });
});
checklist.post('/photos/:id/review', admin, async c => {
  const row = await c.env.DB.prepare('SELECT * FROM checklist_photos WHERE id = ? AND removed_at IS NULL').bind(c.req.param('id')).first();
  if (!row) return c.json({ error: 'Photo not found.' }, 404);
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT OR IGNORE INTO upload_records(key, uploader_user_id, category, status, mime_type, byte_size, sha256, processing_version, review_notes)
      VALUES (?, ?, 'checklist', 'pending_review', 'image/webp', ?, ?, ?, ?)`)
      .bind(row.storage_key, c.get('user').id, row.byte_size, row.sha256, MEDIA_PROCESSING_VERSION, row.caption),
    c.env.DB.prepare('UPDATE checklist_photos SET library_key = storage_key WHERE id = ?').bind(row.id),
    log(c, 'photo_sent_for_review', String(row.item_id), String(row.id)),
  ]);
  return c.json({ inPhotoReview: true });
});
export default checklist;
