// Review-only gateway. Production continues to use index.ts + Cloudflare Pages.
import type { Fetcher } from '@cloudflare/workers-types';
import { SignJWT, jwtVerify } from 'jose';
import worker from './index';
import type { Env } from './types';

type ReviewEnv = Env & { ASSETS: Fetcher; REVIEW_ACCESS_PASSWORD?: string };
const cookieName = '__Host-yjrl_review';
const encoder = new TextEncoder();

async function sameSecret(value: string, expected: string) {
  const [left, right] = await Promise.all([value, expected].map(text => crypto.subtle.digest('SHA-256', encoder.encode(text))));
  const a = new Uint8Array(left), b = new Uint8Array(right);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

export default {
  async fetch(request: Request, env: ReviewEnv, ctx: ExecutionContext): Promise<Response> {
    const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' };
    const secret = env.REVIEW_ACCESS_PASSWORD;
    if (env.ENVIRONMENT !== 'review' || !secret || secret.length < 32) {
      return new Response('Review access is not configured.', { status: 503, headers });
    }
    let authorised = false;
    const cookie = request.headers.get('Cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (cookie && cookie.length < 2048) {
      try {
        const { payload } = await jwtVerify(cookie, encoder.encode(secret), { algorithms: ['HS256'], audience: 'yjrl-review' });
        authorised = payload.sub === 'review' && typeof payload.exp === 'number';
      } catch { /* Expired or forged review sessions have no access. */ }
    }
    let session = '';
    const basic = request.headers.get('Authorization');
    if (!authorised && basic?.startsWith('Basic ') && basic.length < 1024) {
      try {
        if (await sameSecret(atob(basic.slice(6)), `yjrl-review:${secret}`)) {
          authorised = true;
          session = await new SignJWT({ sub: 'review' }).setProtectedHeader({ alg: 'HS256' })
            .setAudience('yjrl-review').setIssuedAt().setExpirationTime('8h').sign(encoder.encode(secret));
        }
      } catch { /* Invalid Basic input is denied. */ }
    }
    if (!authorised) return new Response('Private YJRL review. Sign in to continue.', {
      status: 401, headers: { ...headers, 'WWW-Authenticate': 'Basic realm="YJRL private review", charset="UTF-8"' },
    });
    const path = new URL(request.url).pathname;
    let response: Response;
    if (path === '/service-worker.js') {
      // A review build must not save protected assets for later offline access.
      response = new Response("self.addEventListener('install', () => self.skipWaiting()); self.addEventListener('activate', event => event.waitUntil(self.registration.unregister()));", {
        headers: { 'Content-Type': 'application/javascript' },
      });
    } else if (path.startsWith('/api/')) {
      response = await worker.fetch(request, env, ctx);
    } else {
      response = await env.ASSETS.fetch(request);
    }
    const protectedResponse = new Response(response.body, response);
    for (const [key, value] of Object.entries(headers)) protectedResponse.headers.set(key, value);
    if (session) protectedResponse.headers.append('Set-Cookie', `${cookieName}=${session}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800`);
    return protectedResponse;
  },
};
