import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, Variables } from './types';
import { hashPassword } from './lib/password';
import { sendEmail, eventReminderEmail } from './lib/email';

import authRoutes from './routes/auth';
import teamsRoutes from './routes/teams';
import playersRoutes from './routes/players';
import fixturesRoutes from './routes/fixtures';
import newsRoutes from './routes/news';
import eventsRoutes from './routes/events';
import achievementsRoutes from './routes/achievements';
import statsRoutes from './routes/stats';
import chatRoutes from './routes/chat';
import adminRoutes from './routes/admin';
import clubRoutes from './routes/club';
import registerRoutes from './routes/register';
import uploadRoutes from './routes/upload';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// CORS
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return '*';
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return origin;
    if (origin.includes('.pages.dev')) return origin;
    if (origin.includes('yepponjrl.com.au')) return origin;
    return origin;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Mount routes
app.route('/api/auth', authRoutes);
app.route('/api/yjrl/teams', teamsRoutes);
// Player sub-routes need careful ordering: specific paths before :id
app.get('/api/yjrl/my-player', async (c) => {
  const playersApp = new Hono<{ Bindings: Env; Variables: Variables }>();
  playersApp.route('/', playersRoutes);
  return playersRoutes.fetch(new Request(new URL('/my-player', c.req.url), c.req.raw), c.env);
});
app.get('/api/yjrl/my-children', async (c) => {
  return playersRoutes.fetch(new Request(new URL('/my-children', c.req.url), c.req.raw), c.env);
});
app.get('/api/yjrl/my-team', async (c) => {
  return playersRoutes.fetch(new Request(new URL('/my-team', c.req.url), c.req.raw), c.env);
});
app.route('/api/yjrl/players', playersRoutes);
// Bulk attendance lives under teams path but handled by players routes
app.post('/api/yjrl/teams/:teamId/attendance', async (c) => {
  return playersRoutes.fetch(new Request(new URL(`/teams/${c.req.param('teamId')}/attendance`, c.req.url), { method: 'POST', headers: c.req.raw.headers, body: c.req.raw.body }), c.env);
});
app.route('/api/yjrl/fixtures', fixturesRoutes);
app.get('/api/yjrl/ladder', async (c) => {
  return fixturesRoutes.fetch(new Request(new URL(`/ladder?${new URL(c.req.url).searchParams}`, c.req.url), c.req.raw), c.env);
});
app.route('/api/yjrl/news', newsRoutes);
app.route('/api/yjrl/events', eventsRoutes);
app.route('/api/yjrl/achievements', achievementsRoutes);
app.route('/api/yjrl/stats', statsRoutes);
app.route('/api/yjrl/chat', chatRoutes);
app.route('/api', registerRoutes);
app.route('/api/upload', uploadRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/yjrl/club', clubRoutes);

// Auto-seed admin user on first request
let adminSeeded = false;
app.use('*', async (c, next) => {
  if (!adminSeeded) {
    adminSeeded = true;
    try {
      const existing = await c.env.DB.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').bind('admin').first();
      if (!existing && c.env.ADMIN_EMAIL && c.env.ADMIN_PASSWORD) {
        const id = crypto.randomUUID();
        const hash = await hashPassword(c.env.ADMIN_PASSWORD);
        await c.env.DB.prepare(
          'INSERT OR IGNORE INTO users (id, first_name, last_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(id, 'Admin', '', c.env.ADMIN_EMAIL.toLowerCase(), hash, 'admin').run();
        console.log('Admin user seeded');
      }
    } catch (e) {
      console.error('Admin seed error:', e);
    }
  }
  await next();
});

export default {
  fetch: app.fetch,

  // Cron trigger: daily event reminders
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (!env.RESEND_API_KEY) return;
    try {
      // Find events in the next 48 hours
      const now = new Date();
      const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const events = await env.DB.prepare(
        'SELECT * FROM events WHERE is_active = 1 AND date >= ? AND date <= ?'
      ).bind(now.toISOString().split('T')[0], in48h.toISOString().split('T')[0]).all();

      for (const event of (events.results || [])) {
        // Get RSVPed users
        const rsvps = await env.DB.prepare(
          'SELECT er.user_id, u.email FROM event_rsvps er JOIN users u ON er.user_id = u.id WHERE er.event_id = ? AND er.status = ?'
        ).bind(event.id, 'attending').all();

        const emailContent = eventReminderEmail(
          event.title as string,
          event.date as string,
          (event.venue as string) || 'TBA'
        );

        for (const rsvp of (rsvps.results || [])) {
          ctx.waitUntil(
            sendEmail(env.RESEND_API_KEY, env.FROM_EMAIL, { to: rsvp.email as string, ...emailContent })
          );
        }
      }
    } catch (e) {
      console.error('Cron event reminder error:', e);
    }
  },
};
