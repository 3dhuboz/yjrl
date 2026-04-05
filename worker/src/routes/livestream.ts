import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireBroadcaster } from '../middleware/auth';

const livestream = new Hono<{ Bindings: Env; Variables: Variables }>();

const CF_CALLS_BASE = 'https://rtc.live.cloudflare.com/v1/apps';

// ─── PUBLIC: Get stream status ───────────────────────────────────────────────
livestream.get('/status', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM livestream WHERE id = 1').first();
  return c.json(row || { id: 1, is_live: 0 });
});

// ─── BROADCASTER: Go Live ────────────────────────────────────────────────────
livestream.post('/go-live', authMiddleware, async (c) => {
  if (!requireBroadcaster(c)) return c.json({ error: 'Admin or videographer only' }, 403);
  const body = await c.req.json();
  await c.env.DB.prepare(
    `UPDATE livestream SET is_live = 1, title = ?, message = ?, session_id = ?,
     sponsor_text = ?, sponsor_logo = ?, started_at = datetime('now'), ended_at = NULL WHERE id = 1`
  ).bind(
    body.title || 'Live from Yeppoon Seagulls',
    body.message || '',
    body.session_id || null,
    body.sponsor_text || '',
    body.sponsor_logo || ''
  ).run();
  // Clear previous live chat
  await c.env.DB.prepare('DELETE FROM live_chat').run();
  return c.json({ status: 'live' });
});

// ─── BROADCASTER: Go Offline ─────────────────────────────────────────────────
livestream.post('/go-offline', authMiddleware, async (c) => {
  if (!requireBroadcaster(c)) return c.json({ error: 'Admin or videographer only' }, 403);
  await c.env.DB.prepare(
    `UPDATE livestream SET is_live = 0, session_id = NULL, ended_at = datetime('now') WHERE id = 1`
  ).run();
  return c.json({ status: 'offline' });
});

// ─── CF CALLS PROXY: Create Session ──────────────────────────────────────────
livestream.post('/calls/sessions/new', authMiddleware, async (c) => {
  const body = await c.req.json();
  const appId = c.env.CF_CALLS_APP_ID;
  const secret = c.env.CF_CALLS_APP_SECRET;
  if (!appId || !secret) return c.json({ error: 'Cloudflare Calls not configured' }, 500);

  const res = await fetch(`${CF_CALLS_BASE}/${appId}/sessions/new`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return c.json(data, res.status as 200);
});

// ─── CF CALLS PROXY: Publish Tracks ──────────────────────────────────────────
livestream.post('/calls/sessions/:sessionId/tracks/new', authMiddleware, async (c) => {
  const sessionId = c.req.param('sessionId');
  const body = await c.req.json();
  const res = await fetch(`${CF_CALLS_BASE}/${c.env.CF_CALLS_APP_ID}/sessions/${sessionId}/tracks/new`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.env.CF_CALLS_APP_SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return c.json(data, res.status as 200);
});

// ─── CF CALLS PROXY: Subscribe (public — viewers connect here) ───────────────
livestream.post('/calls/subscribe', async (c) => {
  const body = await c.req.json();
  const { broadcasterSessionId, sdp } = body;
  const appId = c.env.CF_CALLS_APP_ID;
  const secret = c.env.CF_CALLS_APP_SECRET;
  if (!appId || !secret) return c.json({ error: 'Cloudflare Calls not configured' }, 500);

  // Create a new subscriber session
  const sessRes = await fetch(`${CF_CALLS_BASE}/${appId}/sessions/new`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionDescription: { type: 'offer', sdp } }),
  });
  const sessData = await sessRes.json() as { sessionId: string; sessionDescription: { sdp: string } };

  // Pull tracks from the broadcaster's session
  const tracksRes = await fetch(`${CF_CALLS_BASE}/${appId}/sessions/${sessData.sessionId}/tracks/new`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tracks: [
        { location: 'remote', sessionId: broadcasterSessionId, trackName: 'camera' },
        { location: 'remote', sessionId: broadcasterSessionId, trackName: 'mic' },
      ],
    }),
  });
  const tracksData = await tracksRes.json();

  return c.json({ ...sessData, tracks: tracksData });
});

// ─── LIVE CHAT: Get Messages ─────────────────────────────────────────────────
livestream.get('/chat', async (c) => {
  const after = c.req.query('after');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
  let sql = 'SELECT * FROM live_chat WHERE is_deleted = 0';
  const params: unknown[] = [];
  if (after) { sql += ' AND id > ?'; params.push(parseInt(after)); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({ messages: (result.results || []).reverse() });
});

// ─── LIVE CHAT: Send Message ─────────────────────────────────────────────────
const PROFANITY = /\b(shit|fuck|damn|hell|ass|bitch|crap|dick|piss)\b/gi;

livestream.post('/chat', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { message } = body;
  if (!message || message.length > 300) return c.json({ error: 'Message required (max 300 chars)' }, 400);

  const clean = message.replace(PROFANITY, '***').trim();
  const isMod = user.role === 'admin' || user.role === 'dev' || user.role === 'videographer';
  const userName = `${user.firstName} ${user.lastName}`.trim();

  const result = await c.env.DB.prepare(
    'INSERT INTO live_chat (user_id, user_name, message, is_mod) VALUES (?, ?, ?, ?)'
  ).bind(user.id, userName, clean, isMod ? 1 : 0).run();

  return c.json({
    id: result.meta?.last_row_id,
    user_id: user.id, user_name: userName,
    message: clean, is_mod: isMod ? 1 : 0, is_pinned: 0, is_deleted: 0,
    created_at: new Date().toISOString(),
  }, 201);
});

// ─── LIVE CHAT: Moderate (delete/pin) ────────────────────────────────────────
livestream.delete('/chat/:id', authMiddleware, async (c) => {
  if (!requireBroadcaster(c)) return c.json({ error: 'Moderator only' }, 403);
  await c.env.DB.prepare('UPDATE live_chat SET is_deleted = 1 WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ message: 'Deleted' });
});

livestream.post('/chat/:id/pin', authMiddleware, async (c) => {
  if (!requireBroadcaster(c)) return c.json({ error: 'Moderator only' }, 403);
  // Unpin all first, then pin this one
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE live_chat SET is_pinned = 0'),
    c.env.DB.prepare('UPDATE live_chat SET is_pinned = 1 WHERE id = ?').bind(c.req.param('id')),
  ]);
  return c.json({ message: 'Pinned' });
});

export default livestream;
