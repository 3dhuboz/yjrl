import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { parseJson, writeAudit } from '../lib/audit';

const safety = new Hono<{ Bindings: Env; Variables: Variables }>();

function isAdminRole(role: string) {
  return role === 'admin' || role === 'dev';
}

function formatReport(report: Record<string, unknown>) {
  return {
    ...report,
    _id: report.id,
  };
}

function formatApproval(row: Record<string, unknown>) {
  return {
    ...row,
    _id: row.id,
    userId: row.user_id,
    requestedRole: row.requested_role,
    blueCardReference: row.blue_card_reference,
    blueCardStatus: row.blue_card_status,
    blueCardExpiry: row.blue_card_expiry,
    identityChecked: !!row.identity_checked,
    safeguardingTrainingCompleted: !!row.safeguarding_training_completed,
    approvedByUserId: row.approved_by_user_id,
    approvedAt: row.approved_at,
  };
}

// POST /yjrl/safety/reports
safety.post('/reports', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

  const reason = String(body.reason || '').trim();
  if (!reason) return c.json({ error: 'Report reason is required' }, 400);

  const id = crypto.randomUUID();
  const severity = ['low', 'medium', 'high', 'critical'].includes(body.severity) ? body.severity : 'medium';
  await c.env.DB.prepare(
    `INSERT INTO safety_reports (id, reporter_user_id, reporter_name, category, entity_type, entity_id, reason, description, severity)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    user.id,
    `${user.firstName} ${user.lastName}`.trim(),
    body.category || 'general',
    body.entityType || body.entity_type || '',
    body.entityId || body.entity_id || null,
    reason,
    body.description || '',
    severity,
  ).run();

  await writeAudit(c.env, user, 'safety_report_created', 'safety_report', id, {
    entityType: body.entityType || body.entity_type || '',
    entityId: body.entityId || body.entity_id || null,
    severity,
  });

  const report = await c.env.DB.prepare('SELECT * FROM safety_reports WHERE id = ?').bind(id).first();
  return c.json(formatReport(report!), 201);
});

// GET /yjrl/safety/reports
safety.get('/reports', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const status = c.req.query('status');
  const params: unknown[] = [];
  let sql = 'SELECT * FROM safety_reports WHERE 1=1';
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY CASE severity WHEN "critical" THEN 1 WHEN "high" THEN 2 WHEN "medium" THEN 3 ELSE 4 END, created_at DESC LIMIT 100';
  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json((result.results || []).map(formatReport));
});

// PUT /yjrl/safety/reports/:id
safety.put('/reports/:id', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

  const id = c.req.param('id');
  const status = ['open', 'triaged', 'actioned', 'closed'].includes(body.status) ? body.status : undefined;
  const fields: string[] = [];
  const values: unknown[] = [];
  if (status) {
    fields.push('status = ?');
    values.push(status);
    if (status === 'closed' || status === 'actioned') fields.push('resolved_at = datetime(\'now\')');
  }
  if (body.actionTaken !== undefined || body.action_taken !== undefined) {
    fields.push('action_taken = ?');
    values.push(body.actionTaken || body.action_taken || '');
  }
  if (body.assignedToUserId !== undefined || body.assigned_to_user_id !== undefined) {
    fields.push('assigned_to_user_id = ?');
    values.push(body.assignedToUserId || body.assigned_to_user_id || null);
  }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);

  fields.push('updated_at = datetime(\'now\')');
  values.push(id);
  await c.env.DB.prepare(`UPDATE safety_reports SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  await writeAudit(c.env, user, 'safety_report_updated', 'safety_report', id, { status, actionTaken: body.actionTaken || body.action_taken || '' });

  const report = await c.env.DB.prepare('SELECT * FROM safety_reports WHERE id = ?').bind(id).first();
  if (!report) return c.json({ error: 'Report not found' }, 404);
  return c.json(formatReport(report));
});

// GET /yjrl/safety/audit-log
safety.get('/audit-log', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 250);
  const result = await c.env.DB.prepare('SELECT * FROM audit_log ORDER BY created_at DESC, id DESC LIMIT ?').bind(limit).all();
  return c.json((result.results || []).map(row => ({ ...row, details: parseJson(row.details) })));
});

// GET /yjrl/safety/adult-approvals
safety.get('/adult-approvals', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const result = await c.env.DB.prepare(
    `SELECT ara.*, u.first_name, u.last_name, u.email, u.role
     FROM adult_role_approvals ara
     JOIN users u ON ara.user_id = u.id
     ORDER BY ara.updated_at DESC`
  ).all();
  return c.json((result.results || []).map(formatApproval));
});

// POST /yjrl/safety/adult-approvals
safety.post('/adult-approvals', authMiddleware, async (c) => {
  const admin = c.get('user');
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

  const userId = body.userId || body.user_id;
  const requestedRole = body.requestedRole || body.requested_role;
  if (!userId || !['coach', 'admin', 'dev'].includes(requestedRole)) {
    return c.json({ error: 'A valid userId and requestedRole are required' }, 400);
  }

  const status = ['pending', 'approved', 'rejected', 'suspended', 'expired'].includes(body.status) ? body.status : 'pending';
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO adult_role_approvals (
      id, user_id, requested_role, status, blue_card_reference, blue_card_status, blue_card_expiry,
      identity_checked, safeguarding_training_completed, notes, approved_by_user_id, approved_at, suspended_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'approved' THEN datetime('now') ELSE NULL END, CASE WHEN ? = 'suspended' THEN datetime('now') ELSE NULL END)
    ON CONFLICT(user_id, requested_role) DO UPDATE SET
      status = excluded.status,
      blue_card_reference = excluded.blue_card_reference,
      blue_card_status = excluded.blue_card_status,
      blue_card_expiry = excluded.blue_card_expiry,
      identity_checked = excluded.identity_checked,
      safeguarding_training_completed = excluded.safeguarding_training_completed,
      notes = excluded.notes,
      approved_by_user_id = excluded.approved_by_user_id,
      approved_at = CASE WHEN excluded.status = 'approved' THEN datetime('now') ELSE adult_role_approvals.approved_at END,
      suspended_at = CASE WHEN excluded.status = 'suspended' THEN datetime('now') ELSE adult_role_approvals.suspended_at END,
      updated_at = datetime('now')`
  ).bind(
    id,
    userId,
    requestedRole,
    status,
    body.blueCardReference || body.blue_card_reference || '',
    body.blueCardStatus || body.blue_card_status || 'not-provided',
    body.blueCardExpiry || body.blue_card_expiry || null,
    body.identityChecked || body.identity_checked ? 1 : 0,
    body.safeguardingTrainingCompleted || body.safeguarding_training_completed ? 1 : 0,
    body.notes || '',
    admin.id,
    status,
    status,
  ).run();

  if (status === 'approved') {
    await c.env.DB.prepare('UPDATE users SET role = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(requestedRole, userId).run();
  } else if (status === 'suspended') {
    await c.env.DB.prepare('UPDATE users SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').bind(userId).run();
  }

  await writeAudit(c.env, admin, 'adult_role_approval_updated', 'user', userId, { requestedRole, status });
  const row = await c.env.DB.prepare('SELECT * FROM adult_role_approvals WHERE user_id = ? AND requested_role = ?').bind(userId, requestedRole).first();
  return c.json(formatApproval(row!), 201);
});

export default safety;
