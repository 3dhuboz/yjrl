import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { writeAudit } from '../lib/audit';
import { roomAccess } from '../lib/chatRooms';
import { requireChatAgreement } from '../middleware/chatAgreement';
import communication from './communication';

const chat = new Hono<{ Bindings: Env; Variables: Variables }>();

const PROFANITY_PATTERNS = /\b(shit|fuck|damn|hell|ass|bitch|crap|dick|piss)\b/gi;
const MAX_MESSAGE_LENGTH = 500;

function sanitizeMessage(text: string): string {
  return text.replace(PROFANITY_PATTERNS, '***').trim();
}

function formatMessage(message: Record<string, unknown>, currentUserId?: string) {
  return {
    id: message.id,
    room_id: message.room_id,
    user_id: message.user_id,
    user_name: message.user_name,
    user: message.user_name,
    user_avatar: message.user_avatar,
    avatar: message.user_avatar,
    message: message.message,
    text: message.message,
    reactions: {},
    myReactions: [],
    kind: message.kind || 'message',
    pinned: !!message.pinned,
    seenCount: Number(message.seen_count || 0),
    flagged: !!message.flagged,
    created_at: message.created_at,
    time: message.created_at,
    isOwn: currentUserId ? message.user_id === currentUserId : false,
  };
}

async function decorateMessages(c: any, rows: Record<string, unknown>[], userId: string) {
  if (!rows.length) return [];
  const placeholders = rows.map(() => '?').join(',');
  const [reactions, reads] = await Promise.all([
    c.env.DB.prepare(`SELECT message_id, emoji, COUNT(*) AS total, MAX(user_id = ?) AS mine FROM chat_reactions WHERE message_id IN (${placeholders}) GROUP BY message_id, emoji`).bind(userId, ...rows.map(row => row.id)).all(),
    c.env.DB.prepare('SELECT user_id, message_id FROM chat_reads WHERE room_id = ?').bind(rows[0].room_id).all(),
  ]);
  return rows.map(row => ({ ...formatMessage(row, userId),
    reactions: Object.fromEntries(reactions.results.filter((r: any) => r.message_id === row.id).map((r: any) => [r.emoji, r.total])),
    myReactions: reactions.results.filter((r: any) => r.message_id === row.id && r.mine).map((r: any) => r.emoji),
    seenCount: reads.results.filter((r: any) => r.user_id !== row.user_id && r.message_id >= Number(row.id)).length,
  }));
}

async function canAccessRoom(c: any, roomId: string) {
  return (await roomAccess(c, roomId)).allowed;
}
async function canPostRoom(c: any, roomId: string) {
  return !roomId.startsWith('player:') && (await roomAccess(c, roomId)).allowed;
}

chat.route('/', communication);

// GET /yjrl/chat — fetch messages for a room
chat.get('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const roomId = c.req.query('room_id');
  const limit = Math.max(1, Math.min(Math.trunc(Number(c.req.query('limit'))) || 50, 80));
  const after = c.req.query('after');
  const before = c.req.query('before');

  if (!roomId) return c.json({ error: 'room_id required' }, 400);
  if (!(await canAccessRoom(c, roomId))) return c.json({ error: 'Not allowed to access this chat room' }, 403);

  let sql = 'SELECT * FROM chat_messages WHERE room_id = ?';
  const params: unknown[] = [roomId];
  if (c.req.query('kind') === 'announcement') { sql += ' AND kind = ?'; params.push('announcement'); }
  if (after && Number.isSafeInteger(Number(after))) { sql += ' AND id > ?'; params.push(Number(after)); }
  if (before && Number.isSafeInteger(Number(before))) { sql += ' AND id < ?'; params.push(Number(before)); }
  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(limit);

  const result = await c.env.DB.prepare(sql).bind(...params).all();
  const rows = (result.results || []).reverse();
  const decorated = await decorateMessages(c, rows, user.id);
  const pins = await c.env.DB.prepare('SELECT * FROM chat_messages WHERE room_id = ? AND pinned = 1 ORDER BY id DESC LIMIT 20').bind(roomId).all();
  return c.json({ messages: decorated, pinned: await decorateMessages(c, pins.results || [], user.id), room_id: roomId,
    canManage: (await roomAccess(c, roomId)).manage, hasMore: rows.length === limit });
});

// POST /yjrl/chat — send a message (requires auth)
chat.post('/', authMiddleware, requireChatAgreement, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
  const { room_id, message } = body;
  if (typeof room_id !== 'string' || typeof message !== 'string' || !message.trim()) return c.json({ error: 'Write a message first.' }, 400);

  if (!room_id || !message) {
    return c.json({ error: 'room_id and message required' }, 400);
  }
  if (!(await canPostRoom(c, room_id))) {
    return c.json({ error: 'Adults cannot post in junior player rooms. Use parent/team channels for club communication.' }, 403);
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return c.json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)` }, 400);
  }

  const kind = body.kind === 'announcement' ? 'announcement' : 'message';
  if (kind === 'announcement' && !(await roomAccess(c, room_id)).manage) return c.json({ error: 'Only group organisers can post announcements.' }, 403);
  const requestId = body.requestId ?? crypto.randomUUID();
  if (requestId !== undefined && (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId))) return c.json({ error: 'Invalid message request.' }, 400);
  const sanitized = sanitizeMessage(message);
  const flagged = sanitized !== message ? 1 : 0;
  const userName = `${user.firstName} ${user.lastName}`.trim();

  await c.env.DB.prepare(
    `INSERT INTO chat_messages (room_id, user_id, user_name, user_avatar, message, flagged, kind, request_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`
  ).bind(room_id, user.id, userName, '🏉', sanitized, flagged, kind, requestId || null).run();
  const saved = await c.env.DB.prepare('SELECT * FROM chat_messages WHERE user_id = ? AND room_id = ? AND request_id = ?').bind(user.id, room_id, requestId).first();
  await writeAudit(c.env, user, 'chat_message_sent', 'chat_message', saved!.id as number, { roomId: room_id, flagged: !!flagged });
  return c.json(formatMessage(saved!, user.id), 201);
});

// POST /yjrl/chat/:id/report
chat.post('/:id/report', authMiddleware, async (c) => {
  const user = c.get('user');
  const messageId = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

  const message = await c.env.DB.prepare('SELECT * FROM chat_messages WHERE id = ?').bind(messageId).first();
  if (!message) return c.json({ error: 'Message not found' }, 404);
  if (!(await canAccessRoom(c, message.room_id as string))) return c.json({ error: 'Not allowed to report this message' }, 403);

  const reason = String(body.reason || '').trim();
  if (!reason || reason.length > 500 || String(body.description || '').length > 2000) return c.json({ error: 'Add a reason (up to 500 characters) and details (up to 2,000 characters).' }, 400);

  const reportId = crypto.randomUUID();
  const severity = ['low', 'medium', 'high', 'critical'].includes(body.severity) ? body.severity : 'medium';
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO safety_reports (id, reporter_user_id, reporter_name, category, entity_type, entity_id, reason, description, severity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(reportId, user.id, `${user.firstName} ${user.lastName}`.trim(), 'chat', 'chat_message', messageId, reason, body.description || '', severity),
    c.env.DB.prepare('UPDATE chat_messages SET flagged = 1, updated_at = datetime(\'now\') WHERE id = ?').bind(messageId),
  ]);
  await writeAudit(c.env, user, 'chat_message_reported', 'chat_message', messageId, { reportId, severity });
  return c.json({ id: reportId, _id: reportId, status: 'open' }, 201);
});

// GET /yjrl/chat/rooms — list available chat rooms
chat.get('/rooms', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const [seeded, dynamic] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM chat_rooms WHERE active = 1 ORDER BY type, age_group').all(),
    c.env.DB.prepare(
      `SELECT room_id, COUNT(*) AS message_count, MAX(created_at) AS last_message_at
       FROM chat_messages
       GROUP BY room_id
       ORDER BY last_message_at DESC`
    ).all(),
  ]);
  const rooms = [...(seeded.results || [])];
  const known = new Set(rooms.map(room => room.room_id || room.id || room.name));
  for (const row of (dynamic.results || [])) {
    if (known.has(row.room_id)) continue;
    const [type, teamId] = String(row.room_id || '').split(':');
    let team: Record<string, unknown> | null = null;
    if (teamId) {
      team = await c.env.DB.prepare('SELECT name, age_group FROM teams WHERE id = ?').bind(teamId).first();
    }
    rooms.push({
      id: row.room_id,
      room_id: row.room_id,
      name: team ? `${team.name} ${type} room` : row.room_id,
      type,
      team_id: teamId || null,
      age_group: team?.age_group || null,
      active: 1,
      message_count: row.message_count,
      last_message_at: row.last_message_at,
    });
  }
  return c.json(rooms);
});

export default chat;
