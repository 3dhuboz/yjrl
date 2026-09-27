import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../types';

export function rateLimit(scope: string, max: number, windowSeconds: number,
  methods: string[] = ['POST']): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> {
  return async (c, next) => {
    if (!methods.includes(c.req.method)) return next();
    c.header('Cache-Control', 'no-store');
    let bucket: { request_count: number; reset_at: number } | null;
    const now = Math.floor(Date.now() / 1000);
    try {
      // Cloudflare supplies this header. Do not trust forwarded headers supplied by clients.
      // Requests without it share a conservative bucket, including local development.
      const address = c.req.header('CF-Connecting-IP') || 'unknown';
      if (!c.env.JWT_SECRET) throw new Error('Missing rate-limit key');
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(c.env.JWT_SECRET),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const digest = await crypto.subtle.sign('HMAC', key,
        new TextEncoder().encode(`yjrl-rate-limit:${scope}:${address}`));
      const bucketKey = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      // One atomic write decides admission; separate read/update queries would race.
      bucket = await c.env.DB.prepare(`
        INSERT INTO rate_limit_buckets (bucket_key, request_count, reset_at) VALUES (?, 1, ?)
        ON CONFLICT(bucket_key) DO UPDATE SET
          request_count = CASE WHEN reset_at <= ? THEN 1 ELSE MIN(request_count + 1, ?) END,
          reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END
        RETURNING request_count, reset_at
      `).bind(bucketKey, now + windowSeconds, now, max + 1, now).first<typeof bucket>();
      if (!bucket || !Number.isInteger(bucket.request_count) || !Number.isInteger(bucket.reset_at)) {
        throw new Error('Invalid rate-limit result');
      }
    } catch {
      // Do not log request addresses or silently remove protection during a database outage.
      console.error('Rate-limit storage unavailable', { scope });
      c.header('Retry-After', '60');
      return c.json({ error: 'This service is temporarily unavailable. Please try again shortly.' }, 503);
    }
    if (bucket.request_count > max) {
      const retryAfter = Math.max(1, bucket.reset_at - now);
      c.header('Retry-After', String(retryAfter));
      return c.json({ error: 'Too many requests. Please wait and try again.', retryAfter }, 429);
    }
    return next();
  };
}

export async function cleanupRateLimits(env: Env) {
  // Bound each scheduled cleanup. The expiry index keeps this independent of history size.
  await env.DB.prepare(`DELETE FROM rate_limit_buckets WHERE bucket_key IN (
    SELECT bucket_key FROM rate_limit_buckets WHERE reset_at <= ? ORDER BY reset_at LIMIT 10000
  )`).bind(Math.floor(Date.now() / 1000)).run();
}
