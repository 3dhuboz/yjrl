import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { hashPassword } from '../lib/password';

const admin = new Hono<{ Bindings: Env; Variables: Variables }>();

// All admin routes require auth + admin role
admin.use('*', authMiddleware);
admin.use('*', async (c, next) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  await next();
});

// Helper: log admin action
async function logAction(db: D1Database, userId: string, userName: string, action: string, entityType: string, entityId: string | null, details: Record<string, unknown> = {}) {
  await db.prepare(
    'INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(userId, userName, action, entityType, entityId, JSON.stringify(details)).run();
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

admin.get('/dashboard', async (c) => {
  const season = c.req.query('season') || new Date().getFullYear().toString();

  const [
    totalUsers, totalPlayers, totalTeams, totalFixtures,
    regPending, regPaid, regOffline,
    revenue, upcomingFixtures, recentRegistrations
  ] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as cnt FROM users WHERE is_active = 1').first(),
    c.env.DB.prepare('SELECT COUNT(*) as cnt FROM players WHERE is_active = 1 AND registration_year = ?').bind(season).first(),
    c.env.DB.prepare('SELECT COUNT(*) as cnt FROM teams WHERE is_active = 1 AND season = ?').bind(season).first(),
    c.env.DB.prepare('SELECT COUNT(*) as cnt FROM fixtures WHERE is_active = 1 AND season = ?').bind(season).first(),
    c.env.DB.prepare('SELECT COUNT(*) as cnt FROM registrations WHERE season = ? AND payment_status = ?').bind(season, 'pending').first(),
    c.env.DB.prepare('SELECT COUNT(*) as cnt FROM registrations WHERE season = ? AND payment_status = ?').bind(season, 'paid').first(),
    c.env.DB.prepare('SELECT COUNT(*) as cnt FROM registrations WHERE season = ? AND payment_status = ?').bind(season, 'offline').first(),
    c.env.DB.prepare('SELECT COALESCE(SUM(fee_amount), 0) as total FROM registrations WHERE season = ? AND payment_status IN (?, ?)').bind(season, 'paid', 'offline').first(),
    c.env.DB.prepare('SELECT COUNT(*) as cnt FROM fixtures WHERE is_active = 1 AND season = ? AND status = ? AND date >= ?').bind(season, 'scheduled', new Date().toISOString().split('T')[0]).first(),
    c.env.DB.prepare(
      `SELECT r.*, p.first_name, p.last_name, p.age_group FROM registrations r
       LEFT JOIN players p ON r.player_id = p.id
       WHERE r.season = ? ORDER BY r.created_at DESC LIMIT 10`
    ).bind(season).all(),
  ]);

  // Attendance rate
  const attRate = await c.env.DB.prepare(
    `SELECT COUNT(*) as total, SUM(CASE WHEN attended = 1 THEN 1 ELSE 0 END) as attended
     FROM attendance_records WHERE date >= date('now', '-90 days')`
  ).first();
  const attendanceRate = (attRate as Record<string, number>)?.total > 0
    ? Math.round(((attRate as Record<string, number>).attended / (attRate as Record<string, number>).total) * 100)
    : 0;

  // Registrations by month
  const regByMonth = await c.env.DB.prepare(
    `SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
     FROM registrations WHERE season = ? GROUP BY month ORDER BY month`
  ).bind(season).all();

  // Revenue by age group
  const revenueByAge = await c.env.DB.prepare(
    `SELECT age_group, COUNT(*) as count, SUM(fee_amount) as total
     FROM registrations WHERE season = ? AND payment_status IN ('paid', 'offline')
     GROUP BY age_group ORDER BY age_group`
  ).bind(season).all();

  // Recent audit log
  const recentActions = await c.env.DB.prepare(
    'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 20'
  ).all();

  return c.json({
    totalUsers: (totalUsers as Record<string, number>)?.cnt || 0,
    totalPlayers: (totalPlayers as Record<string, number>)?.cnt || 0,
    totalTeams: (totalTeams as Record<string, number>)?.cnt || 0,
    totalFixtures: (totalFixtures as Record<string, number>)?.cnt || 0,
    upcomingFixtures: (upcomingFixtures as Record<string, number>)?.cnt || 0,
    registrations: {
      pending: (regPending as Record<string, number>)?.cnt || 0,
      paid: (regPaid as Record<string, number>)?.cnt || 0,
      offline: (regOffline as Record<string, number>)?.cnt || 0,
    },
    revenue: (revenue as Record<string, number>)?.total || 0,
    attendanceRate,
    regByMonth: regByMonth.results || [],
    revenueByAge: revenueByAge.results || [],
    recentRegistrations: (recentRegistrations.results || []).map(r => ({
      ...r, playerName: `${r.first_name} ${r.last_name}`, ageGroup: r.age_group,
    })),
    recentActions: recentActions.results || [],
  });
});

// ─── USER MANAGEMENT ──────────────────────────────────────────────────────────

admin.get('/users', async (c) => {
  let sql = 'SELECT id, first_name, last_name, email, role, phone, is_active, created_at FROM users WHERE 1=1';
  const params: unknown[] = [];
  const role = c.req.query('role');
  const active = c.req.query('active');
  const search = c.req.query('search');
  if (role) { sql += ' AND role = ?'; params.push(role); }
  if (active === 'true') { sql += ' AND is_active = 1'; }
  if (active === 'false') { sql += ' AND is_active = 0'; }
  if (search) { sql += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');
  const countSql = sql.replace('SELECT id, first_name, last_name, email, role, phone, is_active, created_at', 'SELECT COUNT(*) as cnt');
  const total = await c.env.DB.prepare(countSql).bind(...params).first();
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, (page - 1) * limit);
  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json({
    users: (result.results || []).map(u => ({ ...u, _id: u.id, firstName: u.first_name, lastName: u.last_name, isActive: !!u.is_active })),
    total: (total as Record<string, number>)?.cnt || 0,
    page, limit,
  });
});

admin.post('/users', async (c) => {
  const body = await c.req.json();
  const { firstName, lastName, email, password, role, phone } = body;
  if (!firstName || !email || !password) return c.json({ error: 'First name, email, and password required' }, 400);
  const emailNorm = email.toLowerCase().trim();
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(emailNorm).first();
  if (existing) return c.json({ error: 'Email already registered' }, 400);
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  await c.env.DB.prepare(
    'INSERT INTO users (id, first_name, last_name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, firstName, lastName || '', emailNorm, passwordHash, role || 'player', phone || '').run();
  const user = c.get('user');
  await logAction(c.env.DB, user.id, `${user.firstName} ${user.lastName}`, 'create_user', 'user', id, { email: emailNorm, role: role || 'player' });
  return c.json({ _id: id, firstName, lastName: lastName || '', email: emailNorm, role: role || 'player' }, 201);
});

admin.put('/users/:id', async (c) => {
  const body = await c.req.json();
  const id = c.req.param('id');
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (body.firstName !== undefined) { fields.push('first_name = ?'); vals.push(body.firstName); }
  if (body.lastName !== undefined) { fields.push('last_name = ?'); vals.push(body.lastName); }
  if (body.email !== undefined) { fields.push('email = ?'); vals.push(body.email.toLowerCase().trim()); }
  if (body.role !== undefined) { fields.push('role = ?'); vals.push(body.role); }
  if (body.phone !== undefined) { fields.push('phone = ?'); vals.push(body.phone); }
  if (body.isActive !== undefined) { fields.push('is_active = ?'); vals.push(body.isActive ? 1 : 0); }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);
  fields.push('updated_at = datetime(\'now\')');
  vals.push(id);
  await c.env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
  const user = c.get('user');
  await logAction(c.env.DB, user.id, `${user.firstName} ${user.lastName}`, 'update_user', 'user', id, body);
  const updated = await c.env.DB.prepare('SELECT id, first_name, last_name, email, role, phone, is_active FROM users WHERE id = ?').bind(id).first();
  if (!updated) return c.json({ error: 'User not found' }, 404);
  return c.json({ ...updated, _id: updated.id, firstName: updated.first_name, lastName: updated.last_name, isActive: !!updated.is_active });
});

admin.delete('/users/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE users SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').bind(id).run();
  const user = c.get('user');
  await logAction(c.env.DB, user.id, `${user.firstName} ${user.lastName}`, 'deactivate_user', 'user', id, {});
  return c.json({ message: 'User deactivated' });
});

admin.post('/users/:id/reset-password', async (c) => {
  const body = await c.req.json();
  const { newPassword } = body;
  if (!newPassword || newPassword.length < 6) return c.json({ error: 'Password must be at least 6 characters' }, 400);
  const id = c.req.param('id');
  const hash = await hashPassword(newPassword);
  await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(hash, id).run();
  const user = c.get('user');
  await logAction(c.env.DB, user.id, `${user.firstName} ${user.lastName}`, 'reset_password', 'user', id, {});
  return c.json({ message: 'Password reset successfully' });
});

// ─── REGISTRATION MANAGEMENT ─────────────────────────────────────────────────

admin.get('/registrations', async (c) => {
  let sql = `SELECT r.*, p.first_name, p.last_name, p.age_group, p.guardian_name, p.guardian_email, u.email as user_email
             FROM registrations r
             LEFT JOIN players p ON r.player_id = p.id
             LEFT JOIN users u ON r.user_id = u.id WHERE 1=1`;
  const params: unknown[] = [];
  const status = c.req.query('status');
  const season = c.req.query('season');
  const ageGroup = c.req.query('ageGroup');
  if (status) { sql += ' AND r.payment_status = ?'; params.push(status); }
  if (season) { sql += ' AND r.season = ?'; params.push(season); }
  if (ageGroup) { sql += ' AND p.age_group = ?'; params.push(ageGroup); }
  sql += ' ORDER BY r.created_at DESC';
  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json((result.results || []).map(r => ({
    ...r, _id: r.id, playerName: `${r.first_name} ${r.last_name}`, ageGroup: r.age_group,
    guardianName: r.guardian_name, guardianEmail: r.guardian_email, userEmail: r.user_email,
    feeAmount: r.fee_amount, discountAmount: r.discount_amount, paymentStatus: r.payment_status,
    paypalOrderId: r.paypal_order_id, paidAt: r.paid_at,
  })));
});

admin.put('/registrations/:id', async (c) => {
  const body = await c.req.json();
  const id = c.req.param('id');
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (body.paymentStatus || body.payment_status) {
    fields.push('payment_status = ?');
    vals.push(body.paymentStatus || body.payment_status);
    if ((body.paymentStatus || body.payment_status) === 'paid') {
      fields.push('paid_at = datetime(\'now\')');
    }
  }
  if (body.feeAmount !== undefined) { fields.push('fee_amount = ?'); vals.push(body.feeAmount); }
  if (body.discountAmount !== undefined) { fields.push('discount_amount = ?'); vals.push(body.discountAmount); }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);
  fields.push('updated_at = datetime(\'now\')');
  vals.push(id);
  await c.env.DB.prepare(`UPDATE registrations SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();

  // If marking as paid, activate the player
  if ((body.paymentStatus || body.payment_status) === 'paid') {
    const reg = await c.env.DB.prepare('SELECT player_id FROM registrations WHERE id = ?').bind(id).first();
    if (reg?.player_id) {
      await c.env.DB.prepare('UPDATE players SET registration_status = ? WHERE id = ?').bind('active', reg.player_id).run();
    }
  }

  const user = c.get('user');
  await logAction(c.env.DB, user.id, `${user.firstName} ${user.lastName}`, 'update_registration', 'registration', id, body);
  return c.json({ message: 'Registration updated' });
});

// ─── CSV EXPORT ───────────────────────────────────────────────────────────────

admin.get('/export/:type', async (c) => {
  const type = c.req.param('type');
  const season = c.req.query('season') || new Date().getFullYear().toString();
  let csv = '';
  let filename = '';

  if (type === 'players') {
    filename = `players_${season}.csv`;
    const result = await c.env.DB.prepare(
      `SELECT p.*, t.name as team_name FROM players p LEFT JOIN teams t ON p.team_id = t.id
       WHERE p.is_active = 1 AND p.registration_year = ? ORDER BY p.last_name`
    ).bind(season).all();
    csv = 'First Name,Last Name,Age Group,Team,Position,Jersey,Guardian,Guardian Phone,Guardian Email,Registration Status,Medical Notes\n';
    for (const p of (result.results || [])) {
      csv += `"${p.first_name}","${p.last_name}","${p.age_group}","${p.team_name || ''}","${p.position}","${p.jersey_number || ''}","${p.guardian_name}","${p.guardian_phone}","${p.guardian_email}","${p.registration_status}","${(p.medical_notes as string || '').replace(/"/g, '""')}"\n`;
    }
  } else if (type === 'teams') {
    filename = `teams_${season}.csv`;
    const result = await c.env.DB.prepare('SELECT * FROM teams WHERE is_active = 1 AND season = ? ORDER BY age_group').bind(season).all();
    csv = 'Name,Age Group,Division,Coach,Manager,W,L,D,PF,PA,Training Day,Training Time,Venue\n';
    for (const t of (result.results || [])) {
      csv += `"${t.name}","${t.age_group}","${t.division}","${t.coach_name}","${t.manager_name}",${t.wins},${t.losses},${t.draws},${t.points_for},${t.points_against},"${t.training_day}","${t.training_time}","${t.training_venue}"\n`;
    }
  } else if (type === 'registrations') {
    filename = `registrations_${season}.csv`;
    const result = await c.env.DB.prepare(
      `SELECT r.*, p.first_name, p.last_name, p.age_group, p.guardian_name, p.guardian_email
       FROM registrations r LEFT JOIN players p ON r.player_id = p.id WHERE r.season = ? ORDER BY r.created_at DESC`
    ).bind(season).all();
    csv = 'Player,Age Group,Guardian,Guardian Email,Fee,Discount,Payment Status,PayPal Order,Paid At,Created\n';
    for (const r of (result.results || [])) {
      csv += `"${r.first_name} ${r.last_name}","${r.age_group}","${r.guardian_name}","${r.guardian_email}",${r.fee_amount},${r.discount_amount},"${r.payment_status}","${r.paypal_order_id || ''}","${r.paid_at || ''}","${r.created_at}"\n`;
    }
  } else if (type === 'fixtures') {
    filename = `fixtures_${season}.csv`;
    const result = await c.env.DB.prepare('SELECT * FROM fixtures WHERE is_active = 1 AND season = ? ORDER BY date').bind(season).all();
    csv = 'Round,Age Group,Home Team,Away Team,Date,Time,Venue,Status,Home Score,Away Score,MOM\n';
    for (const f of (result.results || [])) {
      csv += `${f.round},"${f.age_group}","${f.home_team_name}","${f.away_team_name}","${f.date}","${f.time}","${f.venue}","${f.status}",${f.home_score ?? ''},${f.away_score ?? ''},"${f.man_of_match_name}"\n`;
    }
  } else if (type === 'financials') {
    filename = `financials_${season}.csv`;
    const result = await c.env.DB.prepare(
      `SELECT r.*, p.first_name, p.last_name, p.age_group
       FROM registrations r LEFT JOIN players p ON r.player_id = p.id
       WHERE r.season = ? AND r.payment_status IN ('paid', 'offline') ORDER BY r.paid_at DESC`
    ).bind(season).all();
    csv = 'Player,Age Group,Fee,Discount,Net Amount,Payment Method,PayPal Capture,Paid At\n';
    for (const r of (result.results || [])) {
      const method = r.paypal_capture_id ? 'PayPal' : 'Offline';
      csv += `"${r.first_name} ${r.last_name}","${r.age_group}",${r.fee_amount},${r.discount_amount},${(r.fee_amount as number) - (r.discount_amount as number)},"${method}","${r.paypal_capture_id || ''}","${r.paid_at || ''}"\n`;
    }
  } else {
    return c.json({ error: 'Invalid export type. Use: players, teams, registrations, fixtures, financials' }, 400);
  }

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

admin.get('/settings', async (c) => {
  const result = await c.env.DB.prepare('SELECT key, value FROM settings').all();
  const settings: Record<string, string> = {};
  for (const row of (result.results || [])) {
    settings[row.key as string] = row.value as string;
  }
  return c.json(settings);
});

admin.put('/settings', async (c) => {
  const body = await c.req.json();
  const batch = [];
  for (const [key, value] of Object.entries(body)) {
    batch.push(
      c.env.DB.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime(\'now\')')
        .bind(key, String(value), String(value))
    );
  }
  if (batch.length > 0) await c.env.DB.batch(batch);
  const user = c.get('user');
  await logAction(c.env.DB, user.id, `${user.firstName} ${user.lastName}`, 'update_settings', 'settings', null, body);
  return c.json({ message: 'Settings updated' });
});

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────

admin.get('/audit-log', async (c) => {
  const limit = parseInt(c.req.query('limit') || '50');
  const result = await c.env.DB.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?').bind(limit).all();
  return c.json(result.results || []);
});

// ─── CHAT MODERATION ──────────────────────────────────────────────────────────

admin.get('/chat/flagged', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM chat_messages WHERE flagged = 1 ORDER BY created_at DESC LIMIT 100'
  ).all();
  return c.json(result.results || []);
});

admin.delete('/chat/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM chat_messages WHERE id = ?').bind(id).run();
  const user = c.get('user');
  await logAction(c.env.DB, user.id, `${user.firstName} ${user.lastName}`, 'delete_chat_message', 'chat', id, {});
  return c.json({ message: 'Message deleted' });
});

export default admin;
