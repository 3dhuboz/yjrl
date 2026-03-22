// Chat API - Cloudflare Pages Function
// GET /api/chat?room_id=player-u14&limit=50
// POST /api/chat { room_id, message }

const PROFANITY_PATTERNS = /\b(shit|fuck|damn|hell|ass|bitch|crap|dick|piss)\b/gi;
const MAX_MESSAGE_LENGTH = 500;

// Player chat hours: 7am - 8pm
function isWithinChatHours() {
  const hour = new Date().getHours();
  return hour >= 7 && hour < 20;
}

function sanitizeMessage(text) {
  return text.replace(PROFANITY_PATTERNS, '***').trim();
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const roomId = url.searchParams.get('room_id');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const after = url.searchParams.get('after'); // for polling - get messages after this ID

  if (!roomId) {
    return Response.json({ error: 'room_id required' }, { status: 400 });
  }

  try {
    let query = 'SELECT * FROM chat_messages WHERE room_id = ?';
    const params = [roomId];

    if (after) {
      query += ' AND id > ?';
      params.push(parseInt(after));
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const result = await env.DB.prepare(query).bind(...params).all();

    return Response.json({
      messages: (result.results || []).reverse(),
      room_id: roomId
    });
  } catch (err) {
    return Response.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const body = await request.json();
    const { room_id, message, user_id, user_name, user_avatar } = body;

    if (!room_id || !message || !user_id || !user_name) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return Response.json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)` }, { status: 400 });
    }

    // Check chat hours for player rooms
    if (room_id.startsWith('player-') && !isWithinChatHours()) {
      return Response.json({ error: 'Player chat is available between 7am and 8pm' }, { status: 403 });
    }

    const sanitized = sanitizeMessage(message);
    const flagged = sanitized !== message ? 1 : 0;

    const result = await env.DB.prepare(
      'INSERT INTO chat_messages (room_id, user_id, user_name, user_avatar, message, flagged) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(room_id, user_id, user_name, user_avatar || '🦅', sanitized, flagged).run();

    return Response.json({
      id: result.meta?.last_row_id,
      room_id, user_id, user_name, user_avatar: user_avatar || '🦅',
      message: sanitized, flagged,
      reactions: '{}',
      created_at: new Date().toISOString()
    }, { status: 201 });
  } catch (err) {
    return Response.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
