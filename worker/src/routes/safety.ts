import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { parseJson, writeAudit } from '../lib/audit';
import { hashPassword } from '../lib/password';

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

function formatUpload(row: Record<string, unknown>) {
  return {
    ...row,
    uploaderName: [row.uploader_first_name, row.uploader_last_name].filter(Boolean).join(' '),
    playerName: [row.player_first_name, row.player_last_name].filter(Boolean).join(' '),
    playerId: row.player_id,
    consentRequired: !!row.consent_required,
    consentGranted: !!row.consent_granted,
    byteSize: row.byte_size,
    mimeType: row.mime_type,
  };
}

function isFutureDate(value: unknown) {
  if (!value) return false;
  const expiry = new Date(`${value}T23:59:59+10:00`);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() > Date.now();
}

function randomTemporaryPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return `YJRL-${[...bytes].map(byte => byte.toString(36).padStart(2, '0')).join('').slice(0, 18)}!`;
}

function reviewedMediaUrl(requestUrl: string, key: string) {
  const url = new URL(requestUrl);
  return `${url.origin}/api/media?key=${encodeURIComponent(key)}`;
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
  const existing = await c.env.DB.prepare('SELECT * FROM safety_reports WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ error: 'Report not found' }, 404);

  const status = ['open', 'triaged', 'actioned', 'closed'].includes(body.status) ? body.status : undefined;
  const requestedActionTaken = body.actionTaken !== undefined || body.action_taken !== undefined;
  const actionTaken = String(
    requestedActionTaken ? (body.actionTaken || body.action_taken || '') : (existing.action_taken || '')
  ).trim();
  const assignedToUserId = body.assignedToUserId || body.assigned_to_user_id || existing.assigned_to_user_id || user.id;
  if ((status === 'actioned' || status === 'closed') && actionTaken.length < 20) {
    return c.json({ error: 'Action notes of at least 20 characters are required before a safety report can be actioned or closed' }, 400);
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  if (status) {
    fields.push('status = ?');
    values.push(status);
    if (status === 'closed' || status === 'actioned') fields.push('resolved_at = datetime(\'now\')');
  }
  if (requestedActionTaken) {
    fields.push('action_taken = ?');
    values.push(actionTaken);
  }
  if (body.assignedToUserId !== undefined || body.assigned_to_user_id !== undefined || status === 'actioned' || status === 'closed') {
    fields.push('assigned_to_user_id = ?');
    values.push(assignedToUserId || null);
  }
  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);

  fields.push('updated_at = datetime(\'now\')');
  values.push(id);
  await c.env.DB.prepare(`UPDATE safety_reports SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  await writeAudit(c.env, user, 'safety_report_updated', 'safety_report', id, { status, actionTaken, assignedToUserId });

  const report = await c.env.DB.prepare('SELECT * FROM safety_reports WHERE id = ?').bind(id).first();
  return c.json(formatReport(report!));
});

// GET /yjrl/safety/audit-log
safety.get('/audit-log', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 250);
  const result = await c.env.DB.prepare('SELECT * FROM audit_log ORDER BY created_at DESC, id DESC LIMIT ?').bind(limit).all();
  return c.json((result.results || []).map(row => ({ ...row, details: parseJson(row.details) })));
});

// GET /yjrl/safety/uploads
safety.get('/uploads', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const status = c.req.query('status');
  const params: unknown[] = [];
  let sql = `
    SELECT ur.*, u.first_name AS uploader_first_name, u.last_name AS uploader_last_name,
           p.first_name AS player_first_name, p.last_name AS player_last_name
    FROM upload_records ur
    LEFT JOIN users u ON ur.uploader_user_id = u.id
    LEFT JOIN players p ON ur.player_id = p.id
    WHERE 1=1`;
  if (status) {
    sql += ' AND ur.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY CASE ur.status WHEN "pending_review" THEN 1 WHEN "approved" THEN 2 ELSE 3 END, ur.created_at DESC LIMIT 100';
  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json((result.results || []).map(formatUpload));
});

// PUT /yjrl/safety/uploads/review
safety.put('/uploads/review', authMiddleware, async (c) => {
  const admin = c.get('user');
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

  const key = String(body.key || '').trim();
  const status = String(body.status || '').trim();
  if (!key || !['pending_review', 'approved', 'rejected'].includes(status)) {
    return c.json({ error: 'A valid key and review status are required' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT * FROM upload_records WHERE key = ?').bind(key).first();
  if (!existing) return c.json({ error: 'Upload record not found' }, 404);

  const reviewNotes = String(body.reviewNotes || body.review_notes || '').trim();
  if (status === 'approved' && existing.player_id) {
    if (reviewNotes.length < 10) {
      return c.json({ error: 'Reviewer notes are required before approving child-related media' }, 400);
    }
    const consent = await c.env.DB.prepare(
      'SELECT media_consent FROM player_consents WHERE player_id = ?'
    ).bind(existing.player_id).first();
    if (!consent?.media_consent) {
      return c.json({ error: 'Current media consent is not recorded for this player' }, 400);
    }
  }

  const approvedUrl = status === 'approved' ? reviewedMediaUrl(c.req.url, key) : null;
  if (status === 'rejected') {
    await c.env.UPLOADS.delete(key);
  }
  await c.env.DB.prepare(
    'UPDATE upload_records SET status = ?, url = ?, updated_at = datetime(\'now\') WHERE key = ?'
  ).bind(status, approvedUrl, key).run();
  await writeAudit(c.env, admin, 'upload_reviewed', 'upload', key, {
    status,
    previousStatus: existing.status,
    category: existing.category,
    playerId: existing.player_id || null,
    reviewNotes,
  });

  const row = await c.env.DB.prepare(
    `SELECT ur.*, u.first_name AS uploader_first_name, u.last_name AS uploader_last_name,
            p.first_name AS player_first_name, p.last_name AS player_last_name
     FROM upload_records ur
     LEFT JOIN users u ON ur.uploader_user_id = u.id
     LEFT JOIN players p ON ur.player_id = p.id
     WHERE ur.key = ?`
  ).bind(key).first();
  return c.json(formatUpload(row!));
});

// POST /yjrl/safety/adult-approvals/invite
safety.post('/adult-approvals/invite', authMiddleware, async (c) => {
  const admin = c.get('user');
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400);

  const email = String(body.email || '').toLowerCase().trim();
  const firstName = String(body.firstName || body.first_name || '').trim();
  const lastName = String(body.lastName || body.last_name || '').trim();
  const requestedRole = String(body.requestedRole || body.requested_role || 'coach').trim();
  if (!email || !firstName || !['coach', 'admin', 'dev'].includes(requestedRole)) {
    return c.json({ error: 'First name, email, and a valid requestedRole are required' }, 400);
  }

  let temporaryPassword = '';
  let user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!user) {
    const userId = crypto.randomUUID();
    temporaryPassword = randomTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    await c.env.DB.prepare(
      'INSERT INTO users (id, first_name, last_name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(userId, firstName, lastName, email, passwordHash, 'parent', body.phone || '').run();
    user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  } else if (!user.is_active) {
    return c.json({ error: 'This user account is suspended and cannot receive a new adult role request' }, 400);
  }

  const approvalId = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO adult_role_approvals (id, user_id, requested_role, status, notes)
     VALUES (?, ?, ?, 'pending', ?)
     ON CONFLICT(user_id, requested_role) DO UPDATE SET
      status = 'pending',
      notes = excluded.notes,
      updated_at = datetime('now')`
  ).bind(approvalId, user!.id, requestedRole, body.notes || '').run();

  await writeAudit(c.env, admin, 'adult_role_invited', 'user', user!.id as string, { requestedRole, email });
  const row = await c.env.DB.prepare(
    `SELECT ara.*, u.first_name, u.last_name, u.email, u.role
     FROM adult_role_approvals ara
     JOIN users u ON ara.user_id = u.id
     WHERE ara.user_id = ? AND ara.requested_role = ?`
  ).bind(user!.id, requestedRole).first();
  return c.json({ approval: formatApproval(row!), temporaryPassword }, 201);
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
  if (status === 'approved') {
    const blueCardStatus = body.blueCardStatus || body.blue_card_status;
    const identityChecked = !!(body.identityChecked || body.identity_checked);
    const trainingCompleted = !!(body.safeguardingTrainingCompleted || body.safeguarding_training_completed);
    const expiry = body.blueCardExpiry || body.blue_card_expiry;
    if (blueCardStatus !== 'verified' || !identityChecked || !trainingCompleted || !isFutureDate(expiry)) {
      return c.json({ error: 'Verified Blue Card, future expiry, identity check, and safeguarding training are required before approval' }, 400);
    }
  }
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
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE users SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').bind(userId),
      c.env.DB.prepare('UPDATE teams SET coach_id = NULL, updated_at = datetime(\'now\') WHERE coach_id = ?').bind(userId),
    ]);
  } else if (status === 'rejected' || status === 'expired') {
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE users SET role = CASE WHEN role = ? THEN ? ELSE role END, updated_at = datetime(\'now\') WHERE id = ?').bind(requestedRole, 'parent', userId),
      c.env.DB.prepare('UPDATE teams SET coach_id = NULL, updated_at = datetime(\'now\') WHERE coach_id = ?').bind(userId),
    ]);
  }

  await writeAudit(c.env, admin, 'adult_role_approval_updated', 'user', userId, { requestedRole, status });
  const row = await c.env.DB.prepare(
    `SELECT ara.*, u.first_name, u.last_name, u.email, u.role
     FROM adult_role_approvals ara
     JOIN users u ON ara.user_id = u.id
     WHERE ara.user_id = ? AND ara.requested_role = ?`
  ).bind(userId, requestedRole).first();
  return c.json(formatApproval(row!), 201);
});

export default safety;
