import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { authMiddleware, requireAdmin } from '../middleware/auth';

const admin = new Hono<{ Bindings: Env; Variables: Variables }>();

type ReadinessStatus = 'pass' | 'warn' | 'fail' | 'not_required';

type ReadinessCheck = {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
  blocksLaunch: boolean;
};

function check(id: string, label: string, status: ReadinessStatus, detail: string, blocksLaunch = true): ReadinessCheck {
  return { id, label, status, detail, blocksLaunch };
}

function truthy(value: unknown) {
  return ['1', 'true', 'yes', 'required', 'on'].includes(String(value || '').toLowerCase());
}

function paypalReady(env: Env) {
  return !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.PAYPAL_MODE === 'live');
}

async function frontendReachable(url: string) {
  if (!url) return false;
  try {
    const target = new URL('/register', url);
    const response = await fetch(target.toString(), { method: 'GET', redirect: 'follow' });
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}

admin.get('/readiness', authMiddleware, async (c) => {
  if (!requireAdmin(c)) return c.json({ error: 'Admin only' }, 403);

  const checks: ReadinessCheck[] = [];

  try {
    await c.env.DB.prepare('SELECT 1 AS ok').first();
    checks.push(check('d1', 'D1 database', 'pass', 'Database query succeeded.'));
  } catch {
    checks.push(check('d1', 'D1 database', 'fail', 'Database query failed.'));
  }

  try {
    await c.env.UPLOADS.list({ limit: 1 });
    checks.push(check('r2', 'R2 uploads bucket', 'pass', 'Uploads bucket is bound and reachable.'));
  } catch {
    checks.push(check('r2', 'R2 uploads bucket', 'fail', 'Uploads bucket probe failed.'));
  }

  checks.push(paypalReady(c.env)
    ? check('paypal', 'PayPal live payments', 'pass', 'Live PayPal credentials are configured.')
    : check('paypal', 'PayPal live payments', 'fail', 'PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and PAYPAL_MODE=live are required before online payments.'));

  checks.push(c.env.RESEND_API_KEY && c.env.FROM_EMAIL
    ? check('resend', 'Resend email', 'pass', `Email sending configured from ${c.env.FROM_EMAIL}.`)
    : check('resend', 'Resend email', 'fail', 'RESEND_API_KEY and FROM_EMAIL are required so parents and admins receive registration notices.'));

  const frontendUrl = (c.env.FRONTEND_URL || '').trim();
  const frontendOk = frontendUrl ? await frontendReachable(frontendUrl) : false;
  checks.push(frontendOk
    ? check('frontend_domain', 'Branded frontend domain', 'pass', `${frontendUrl}/register is reachable.`)
    : check('frontend_domain', 'Branded frontend domain', 'fail', 'FRONTEND_URL must point at the live customer site and /register must return successfully.'));

  const apiUrl = (c.env.API_PUBLIC_URL || '').trim();
  checks.push(apiUrl
    ? check('api_domain', 'Public API domain', 'pass', `Configured as ${apiUrl}.`)
    : check('api_domain', 'Public API domain', 'warn', 'API_PUBLIC_URL is not set; the app may still be using the raw Worker URL.', false));

  checks.push(String(c.env.CHILD_SAFETY_SIGNOFF || '').toLowerCase() === 'approved'
    ? check('child_safety_signoff', 'Child safety sign-off', 'pass', 'Club child-safety launch sign-off is recorded.')
    : check('child_safety_signoff', 'Child safety sign-off', 'fail', 'Set CHILD_SAFETY_SIGNOFF=approved only after the club signs off incident escalation and safeguarding operations.'));

  const criticalReports = await c.env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM safety_reports
     WHERE severity IN ('high', 'critical') AND status <> 'closed'`
  ).first<{ count: number }>();
  const criticalCount = Number(criticalReports?.count || 0);
  checks.push(criticalCount === 0
    ? check('critical_reports', 'High/critical safety reports', 'pass', 'No unresolved high or critical safety reports.')
    : check('critical_reports', 'High/critical safety reports', 'fail', `${criticalCount} high or critical safety report(s) must be resolved before launch.`));

  const pendingUploads = await c.env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM upload_records
     WHERE status = 'pending_review'`
  ).first<{ count: number }>();
  const uploadCount = Number(pendingUploads?.count || 0);
  checks.push(uploadCount === 0
    ? check('media_review', 'Media review queue', 'pass', 'No child media is waiting for review.', false)
    : check('media_review', 'Media review queue', 'warn', `${uploadCount} upload(s) are waiting for media review.`, false));

  if (truthy(c.env.CLICKSEND_REQUIRED)) {
    checks.push(c.env.CLICKSEND_USERNAME && c.env.CLICKSEND_API_KEY
      ? check('clicksend', 'ClickSend SMS', 'pass', 'ClickSend credentials are configured.')
      : check('clicksend', 'ClickSend SMS', 'fail', 'ClickSend is marked required but credentials are missing.'));
  } else {
    checks.push(check('clicksend', 'ClickSend SMS', 'not_required', 'No YJRL launch workflow currently requires SMS; set CLICKSEND_REQUIRED=true to enforce.', false));
  }

  if (truthy(c.env.OPENROUTER_REQUIRED)) {
    checks.push(c.env.OPENROUTER_API_KEY
      ? check('openrouter', 'OpenRouter AI', 'pass', 'OpenRouter API key is configured.')
      : check('openrouter', 'OpenRouter AI', 'fail', 'OpenRouter is marked required but OPENROUTER_API_KEY is missing.'));
  } else {
    checks.push(check('openrouter', 'OpenRouter AI', 'not_required', 'No YJRL launch workflow currently requires AI; set OPENROUTER_REQUIRED=true to enforce.', false));
  }

  const blocking = checks.filter(item => item.blocksLaunch && item.status !== 'pass' && item.status !== 'not_required');
  return c.json({
    readyForPaidLaunch: blocking.length === 0,
    checkedAt: new Date().toISOString(),
    blockingCount: blocking.length,
    checks,
  });
});

export default admin;
