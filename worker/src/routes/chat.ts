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

// GET /yjrl/chat — fetch messages for a room
chat.get('/', async (c) => {
  const roomId = c.req.query('room_id');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const after = c.req.query('after');

  if (!roomId) return c.json({ error: 'room_id required' }, 400);

  let sql = 'SELECT * FROM chat_messages WHERE room_id = ?';
  const params: unknown[] = [roomId];
  if (after) { sql += ' AND id > ?'; params.push(parseInt(after)); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ messages: (result.results || []).reverse(), room_id: roomId });
});

// POST /yjrl/chat — send a message (requires auth)
chat.post('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { room_id, message, user_avatar } = body;

  if (!room_id || !message) {
    return c.json({ error: 'room_id and message required' }, 400);
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return c.json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)` }, 400);
  }

  // Enforce chat hours for player rooms — server-side enforcement
  if (room_id.startsWith('player-') && !isWithinChatHours()) {
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
    user_avatar: user_avatar || '🦅',
    message: sanitized, flagged,
    reactions: '{}',
    created_at: new Date().toISOString(),
  }, 201);
});

// GET /yjrl/chat/rooms — list available chat rooms
chat.get('/rooms', async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM chat_rooms WHERE active = 1 ORDER BY type, age_group').all();
  return c.json(result.results || []);
});

export default chat;
