import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware } from '../middleware/auth';

const chat = new Hono<{ Bindings: Env; Variables: Variables }>();

const PROFANITY_PATTERNS = /\b(shit|fuck|damn|hell|ass|bitch|crap|dick|piss)\b/gi;
const MAX_MESSAGE_LENGTH = 500;

function isWithinChatHours(): boolean {
  // AEST is UTC+10
  const now = new Date();
  const aest = new Date(now.getTime() + 10 * 60 * 60 * 1000);
  const hour = aest.getUTCHours();
  return hour >= 7 && hour < 20;
}

function sanitizeMessage(text: string): string {
  return text.replace(PROFANITY_PATTERNS, '***').trim();
}

function parseReactions(value: unknown) {
  if (!value || typeof value !== 'string') return {};
  try { return JSON.parse(value); } catch { return {}; }
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
    reactions: parseReactions(message.reactions),
    flagged: !!message.flagged,
    created_at: message.created_at,
    time: message.created_at,
    isOwn: currentUserId ? message.user_id === currentUserId : false,
  };
}

async function canAccessRoom(c: any, roomId: string): Promise<boolean> {
  const user = c.get('user');
  if (user.role === 'admin' || user.role === 'dev') return true;
  if (roomId === 'coach-all') return user.role === 'coach';

  const [type, teamId] = roomId.split(':');
  if (!teamId || !['player', 'parent'].includes(type)) return false;

  if (user.role === 'coach') {
    const team = await c.env.DB.prepare('SELECT id FROM teams WHERE id = ? AND coach_id = ? AND is_active = 1').bind(teamId, user.id).first();
    return type === 'parent' && !!team;
  }

  if (type === 'player') {
    const player = await c.env.DB.prepare('SELECT id FROM players WHERE user_id = ? AND team_id = ? AND is_active = 1').bind(user.id, teamId).first();
    if (player) return true;
    const child = await c.env.DB.prepare('SELECT id FROM players WHERE guardian_email = ? AND team_id = ? AND is_active = 1').bind(user.email, teamId).first();
    return user.role === 'parent' && !!child;
  }

  if (type === 'parent') {
    const child = await c.env.DB.prepare('SELECT id FROM players WHERE guardian_email = ? AND team_id = ? AND is_active = 1').bind(user.email, teamId).first();
    return !!child;
  }

  return false;
}

async function canPostRoom(c: any, roomId: string): Promise<boolean> {
  if (!(await canAccessRoom(c, roomId))) return false;
  const user = c.get('user');
  if (roomId === 'coach-all') return user.role === 'coach' || user.role === 'admin' || user.role === 'dev';

  const [type] = roomId.split(':');
  if (type === 'player') return user.role === 'player';
  if (type === 'parent') return ['parent', 'coach', 'admin', 'dev'].includes(user.role);
  return false;
}

// GET /yjrl/chat — fetch messages for a room
chat.get('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const roomId = c.req.query('room_id');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const after = c.req.query('after');

  if (!roomId) return c.json({ error: 'room_id required' }, 400);
  if (!(await canAccessRoom(c, roomId))) return c.json({ error: 'Not allowed to access this chat room' }, 403);

  let sql = 'SELECT * FROM chat_messages WHERE room_id = ?';
  const params: unknown[] = [roomId];
  if (after) { sql += ' AND id > ?'; params.push(parseInt(after)); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ messages: (result.results || []).reverse().map(m => formatMessage(m, user.id)), room_id: roomId });
});

// POST /yjrl/chat — send a message (requires auth)
chat.post('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { room_id, message, user_avatar } = body;

  if (!room_id || !message) {
    return c.json({ error: 'room_id and message required' }, 400);
  }
  if (!(await canPostRoom(c, room_id))) {
    return c.json({ error: 'Adults cannot post in junior player rooms. Use parent/team channels for club communication.' }, 403);
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return c.json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)` }, 400);
  }

  // Enforce chat hours for player rooms — server-side enforcement
  if (room_id.startsWith('player:') && !isWithinChatHours()) {
    return c.json({ error: 'Player chat is available between 7am and 8pm AEST' }, 403);
  }

  const sanitized = sanitizeMessage(message);
  const flagged = sanitized !== message ? 1 : 0;
  const userName = `${user.firstName} ${user.lastName}`.trim();

  const result = await c.env.DB.prepare(
    'INSERT INTO chat_messages (room_id, user_id, user_name, user_avatar, message, flagged) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(room_id, user.id, userName, user_avatar || '🦅', sanitized, flagged).run();

  return c.json({
    id: result.meta?.last_row_id,
    room_id, user_id: user.id, user_name: userName,
    user: userName,
    user_avatar: user_avatar || '🦅',
    message: sanitized, text: sanitized, flagged,
    reactions: {},
    created_at: new Date().toISOString(),
    time: new Date().toISOString(),
    isOwn: true,
  }, 201);
});

// GET /yjrl/chat/rooms — list available chat rooms
chat.get('/rooms', authMiddleware, async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM chat_rooms WHERE active = 1 ORDER BY type, age_group').all();
  return c.json(result.results || []);
});

export default chat;
