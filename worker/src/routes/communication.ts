import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { isApprovedCoach } from '../lib/safeguarding';
import { roomAccess } from '../lib/chatRooms';
import { writeAudit } from '../lib/audit';
import { mapsUrl } from '../../../shared/maps';
import agreement from '../../../shared/chatAgreement.json';
import { requireChatAgreement } from '../middleware/chatAgreement';
import adultAccount from '../../../shared/adultAccount.json';

const communication = new Hono<{ Bindings: Env; Variables: Variables }>();

communication.get('/agreement', authMiddleware, async c => {
  const accepted = await c.env.DB.prepare('SELECT accepted_at FROM chat_agreements WHERE user_id = ? AND version = ?').bind(c.get('user').id, agreement.version).first();
  return c.json({ ...agreement, acceptedAt: accepted?.accepted_at || null });
});
communication.post('/agreement', authMiddleware, async c => {
  const body = await c.req.json().catch(() => null);
  if (body?.accepted !== true || body?.version !== agreement.version) return c.json({ error: 'Read and tick the current adult communication agreement.' }, 400);
  await c.env.DB.prepare('INSERT OR IGNORE INTO chat_agreements(user_id, version, agreement_json) VALUES (?, ?, ?)').bind(c.get('user').id, agreement.version, JSON.stringify(agreement)).run();
  await writeAudit(c.env, c.get('user'), 'chat_agreement_accepted', 'user', c.get('user').id, { version: agreement.version });
  return c.json({ accepted: true, version: agreement.version });
});

communication.get('/channels', authMiddleware, async c => {
  const user = c.get('user');
  const admin = requireAdmin(c), approvedCoach = isApprovedCoach(user);
  const teams = await c.env.DB.prepare(`SELECT t.id, t.name, t.coach_id, t.assistant_id, t.manager_id,
    (EXISTS(SELECT 1 FROM players p WHERE p.team_id = t.id AND p.is_active = 1 AND p.user_id = ?)
     OR EXISTS(SELECT 1 FROM parent_child_links l JOIN players p ON p.id = l.player_id WHERE p.team_id = t.id AND p.is_active = 1 AND l.parent_user_id = ? AND l.status = 'verified')) AS guardian
     FROM teams t WHERE t.is_active = 1 ORDER BY t.age_group, t.name`).bind(user.id, user.id).all();
  const channels: { id: string; name: string; type: string; canManage: boolean; unread: number }[] = [];
  if (admin || approvedCoach) channels.push({ id: 'coach-all', name: 'All coaches', type: 'coach', canManage: true, unread: 0 });
  if (admin || await c.env.DB.prepare('SELECT user_id FROM committee_members WHERE user_id = ?').bind(user.id).first()) channels.push({ id: 'committee-all', name: 'Committee', type: 'committee', canManage: true, unread: 0 });
  for (const team of teams.results || []) {
    const staff = admin || approvedCoach && [team.coach_id, team.assistant_id, team.manager_id].includes(user.id);
    if (staff || team.guardian) channels.push({ id: `parent:${team.id}`, name: `${team.name} · Team families`, type: 'parent', canManage: staff, unread: 0 });
    if (staff) channels.push({ id: `coaches:${team.id}`, name: `${team.name} · Coaching staff`, type: 'coaches', canManage: true, unread: 0 });
  }
  for (let offset = 0; offset < channels.length; offset += 80) {
    const batch = channels.slice(offset, offset + 80);
    const unread = await c.env.DB.prepare(`SELECT m.room_id, COUNT(*) AS total FROM chat_messages m
      LEFT JOIN chat_reads r ON r.room_id = m.room_id AND r.user_id = ?
      WHERE m.user_id != ? AND m.id > COALESCE(r.message_id, 0) AND m.room_id IN (${batch.map(() => '?').join(',')}) GROUP BY m.room_id`)
      .bind(user.id, user.id, ...batch.map(room => room.id)).all();
    for (const room of batch) room.unread = Number(unread.results?.find(row => row.room_id === room.id)?.total || 0);
  }
  return c.json(channels);
});

communication.put('/read', authMiddleware, async c => {
  const body = await c.req.json().catch(() => null);
  if (typeof body?.roomId !== 'string' || !Number.isSafeInteger(body?.messageId)) return c.json({ error: 'Invalid read position.' }, 400);
  if (!(await roomAccess(c, body.roomId)).allowed) return c.json({ error: 'Group access required.' }, 403);
  const message = await c.env.DB.prepare('SELECT id FROM chat_messages WHERE id = ? AND room_id = ?').bind(body.messageId, body.roomId).first();
  if (!message) return c.json({ error: 'Message not found in this group.' }, 404);
  await c.env.DB.prepare(`INSERT INTO chat_reads (room_id, user_id, message_id) VALUES (?, ?, ?)
    ON CONFLICT(room_id, user_id) DO UPDATE SET message_id = MAX(chat_reads.message_id, excluded.message_id)`)
    .bind(body.roomId, c.get('user').id, body.messageId).run();
  return c.json({ saved: true });
});

communication.put('/:id/reaction', authMiddleware, requireChatAgreement, async c => {
  const body = await c.req.json().catch(() => null);
  if (!['👍', '❤️', '👏', '✅'].includes(body?.emoji) || typeof body?.active !== 'boolean') return c.json({ error: 'Choose a supported reaction.' }, 400);
  const message = await c.env.DB.prepare('SELECT room_id FROM chat_messages WHERE id = ?').bind(c.req.param('id')).first();
  if (!message) return c.json({ error: 'Message not found.' }, 404);
  if (!(await roomAccess(c, String(message.room_id))).allowed) return c.json({ error: 'Group access required.' }, 403);
  const sql = body.active ? 'INSERT OR IGNORE INTO chat_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)'
    : 'DELETE FROM chat_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?';
  await c.env.DB.prepare(sql).bind(c.req.param('id'), c.get('user').id, body.emoji).run();
  return c.json({ saved: true });
});

communication.put('/:id/pin', authMiddleware, requireChatAgreement, async c => {
  const body = await c.req.json().catch(() => null);
  if (typeof body?.pinned !== 'boolean') return c.json({ error: 'Choose whether to pin this update.' }, 400);
  const message = await c.env.DB.prepare('SELECT room_id FROM chat_messages WHERE id = ?').bind(c.req.param('id')).first();
  if (!message) return c.json({ error: 'Message not found.' }, 404);
  if (!(await roomAccess(c, String(message.room_id))).manage) return c.json({ error: 'Only group organisers can pin updates.' }, 403);
  await c.env.DB.prepare('UPDATE chat_messages SET pinned = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(body.pinned ? 1 : 0, c.req.param('id')).run();
  await writeAudit(c.env, c.get('user'), 'chat_pin_changed', 'chat_message', c.req.param('id'), { pinned: body.pinned });
  return c.json({ saved: true });
});

communication.get('/committee', authMiddleware, async c => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only.' }, 403);
  const rows = await c.env.DB.prepare(`SELECT u.id, u.first_name, u.last_name, u.role,
    EXISTS(SELECT 1 FROM committee_members cm WHERE cm.user_id = u.id) AS member
    FROM users u WHERE u.is_active = 1 AND u.role IN ('parent', 'coach', 'admin', 'dev') AND u.adult_attestation_version = ?
    ORDER BY u.first_name, u.last_name`).bind(adultAccount.version).all();
  return c.json(rows.results || []);
});
communication.put('/committee/:userId', authMiddleware, async c => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only.' }, 403);
  const body = await c.req.json().catch(() => null);
  if (typeof body?.member !== 'boolean') return c.json({ error: 'Choose group membership.' }, 400);
  const userId = c.req.param('userId');
  if (body.member) {
    const adult = await c.env.DB.prepare(`SELECT id FROM users WHERE id = ? AND is_active = 1 AND role IN ('parent', 'coach', 'admin', 'dev') AND adult_attestation_version = ?`).bind(userId, adultAccount.version).first();
    if (!adult) return c.json({ error: 'Choose an active adult account that has confirmed the adult declaration.' }, 400);
    await c.env.DB.prepare('INSERT OR IGNORE INTO committee_members(user_id, added_by) VALUES (?, ?)').bind(userId, c.get('user').id).run();
  } else await c.env.DB.prepare('DELETE FROM committee_members WHERE user_id = ?').bind(userId).run();
  await writeAudit(c.env, c.get('user'), 'committee_membership_changed', 'user', userId, { member: body.member });
  return c.json({ saved: true });
});

communication.get('/activities', authMiddleware, async c => {
  const roomId = c.req.query('room_id') || '';
  const access = await roomAccess(c, roomId);
  if (!access.allowed) return c.json({ error: 'Group access required.' }, 403);
  const rows = await c.env.DB.prepare(`SELECT a.*, (SELECT status FROM chat_attendance WHERE activity_id = a.id AND user_id = ?) AS my_status
    FROM chat_activities a WHERE a.room_id = ? ORDER BY starts_at DESC LIMIT 100`).bind(c.get('user').id, roomId).all();
  const attendance = await c.env.DB.prepare(`SELECT r.activity_id, r.status, u.first_name, u.last_name FROM chat_attendance r
    JOIN chat_activities a ON a.id = r.activity_id JOIN users u ON u.id = r.user_id WHERE a.room_id = ?`).bind(roomId).all();
  return c.json((rows.results || []).map(a => {
    const replies = (attendance.results || []).filter(r => r.activity_id === a.id);
    return { ...a, counts: Object.fromEntries(['going', 'maybe', 'unavailable'].map(status => [status, replies.filter(r => r.status === status).length])),
      replies: access.manage ? replies.map(r => ({ name: `${r.first_name} ${r.last_name}`, status: r.status })) : undefined };
  }));
});

function activityFields(body: any) {
  if (!body || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 150) throw new Error('Add a title (up to 150 characters).');
  if (!['training', 'game', 'meeting', 'event'].includes(body.kind)) throw new Error('Choose an activity type.');
  if (typeof body.startsAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(body.startsAt) || !Number.isFinite(Date.parse(body.startsAt))) throw new Error('Set the activity date and time.');
  if (typeof body.venue !== 'string' || body.venue.length > 200 || typeof body.details !== 'string' || body.details.length > 2000) throw new Error('Use a venue up to 200 characters and details up to 2,000 characters.');
  return { title: body.title.trim(), kind: body.kind, startsAt: new Date(body.startsAt).toISOString(), venue: body.venue.trim(), details: body.details.trim(), mapsUrl: mapsUrl(body.mapsUrl) };
}
communication.post('/activities', authMiddleware, requireChatAgreement, async c => {
  const body = await c.req.json().catch(() => null);
  if (typeof body?.roomId !== 'string' || !(await roomAccess(c, body.roomId)).manage) return c.json({ error: 'Only group organisers can add activities.' }, 403);
  let fields;
  try { fields = activityFields(body); } catch (error) { return c.json({ error: (error as Error).message }, 400); }
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO chat_activities(id, room_id, title, kind, starts_at, venue, maps_url, details, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, body.roomId, fields.title, fields.kind, fields.startsAt, fields.venue, fields.mapsUrl, fields.details, c.get('user').id).run();
  await writeAudit(c.env, c.get('user'), 'group_activity_created', 'chat_activity', id, { roomId: body.roomId });
  return c.json({ id }, 201);
});
communication.put('/activities/:id', authMiddleware, requireChatAgreement, async c => {
  const existing = await c.env.DB.prepare('SELECT * FROM chat_activities WHERE id = ?').bind(c.req.param('id')).first();
  if (!existing) return c.json({ error: 'Activity not found.' }, 404);
  if (!(await roomAccess(c, String(existing.room_id))).manage) return c.json({ error: 'Only group organisers can edit activities.' }, 403);
  const body = await c.req.json().catch(() => null);
  let fields;
  try { fields = activityFields(body); } catch (error) { return c.json({ error: (error as Error).message }, 400); }
  if (typeof body.cancelled !== 'boolean') return c.json({ error: 'Set the activity status.' }, 400);
  await c.env.DB.prepare(`UPDATE chat_activities SET title = ?, kind = ?, starts_at = ?, venue = ?, maps_url = ?, details = ?, cancelled = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(fields.title, fields.kind, fields.startsAt, fields.venue, fields.mapsUrl, fields.details, body.cancelled ? 1 : 0, existing.id).run();
  await writeAudit(c.env, c.get('user'), 'group_activity_updated', 'chat_activity', String(existing.id), { cancelled: body.cancelled });
  return c.json({ saved: true });
});
communication.put('/activities/:id/attendance', authMiddleware, requireChatAgreement, async c => {
  const body = await c.req.json().catch(() => null);
  if (!['going', 'maybe', 'unavailable'].includes(body?.status)) return c.json({ error: 'Choose Going, Maybe or Unavailable.' }, 400);
  const activity = await c.env.DB.prepare('SELECT * FROM chat_activities WHERE id = ?').bind(c.req.param('id')).first();
  if (!activity) return c.json({ error: 'Activity not found.' }, 404);
  if (!(await roomAccess(c, String(activity.room_id))).allowed) return c.json({ error: 'Group access required.' }, 403);
  if (activity.cancelled || String(activity.starts_at) < new Date().toISOString()) return c.json({ error: 'Attendance is closed for this activity.' }, 409);
  await c.env.DB.prepare(`INSERT INTO chat_attendance(activity_id, user_id, status) VALUES (?, ?, ?)
    ON CONFLICT(activity_id, user_id) DO UPDATE SET status = excluded.status, updated_at = datetime('now')`)
    .bind(activity.id, c.get('user').id, body.status).run();
  return c.json({ saved: true });
});
export default communication;
