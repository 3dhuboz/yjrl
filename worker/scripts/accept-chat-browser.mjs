// Real browser acceptance, synthetic content, isolated review service only.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/opt/node-v24.18.0-linux-x64/lib/node_modules/@playwright/cli/package.json');
const { chromium } = require('playwright');
const base = 'https://yjrl-review.steve-700.workers.dev';
const secrets = JSON.parse(readFileSync('/home/steve/.local/share/yjrl/review-secrets.json', 'utf8'));
const bootstrap = await fetch(base, { headers: { Authorization: `Basic ${Buffer.from(`yjrl-review:${secrets.REVIEW_ACCESS_PASSWORD}`).toString('base64')}` } });
assert.equal(bootstrap.status, 200);
const cookie = bootstrap.headers.get('set-cookie').split(';')[0];
let token;
async function api(path, method = 'GET', body) {
  const response = await fetch(`${base}/api${path}`, { method, headers: { Cookie: cookie, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${response.ok ? '' : await response.text()}`);
  return response.json();
}
token = (await api('/auth/login', 'POST', { email: secrets.ADMIN_EMAIL, password: secrets.ADMIN_PASSWORD, adultConfirmed: true })).token;
const port = readFileSync('/srv/headsnap/browser-profiles/yjrl/DevToolsActivePort', 'utf8').split('\n')[0];
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const split = cookie.indexOf('=');
await context.addCookies([{ name: cookie.slice(0, split), value: cookie.slice(split + 1), domain: new URL(base).hostname, path: '/', secure: true, httpOnly: true, sameSite: 'Strict' }]);
await context.addInitScript(value => localStorage.setItem('yjrl_token', value), token);
const page = await context.newPage();
const errors = []; page.on('pageerror', error => errors.push(error.message));

const suffix = Date.now().toString(36), name = `Synthetic committee ${suffix}`;
const parent = await api('/auth/register', 'POST', { firstName: 'Synthetic', lastName: `Committee ${suffix}`, email: `committee-${suffix}@example.test`, password: crypto.randomUUID(), adultConfirmed: true, role: 'parent' });
let parentContext;
mkdirSync('.wrangler/chat-browser', { recursive: true });
async function acceptAgreement(p) {
  const button = p.getByRole('button', { name: 'Agree and Continue', exact: true });
  await p.waitForFunction(() => document.body.textContent.includes('Agree and Continue') || document.body.textContent.includes('Club communication'));
  if (await button.count()) { assert.equal(await button.isDisabled(), true); await p.getByRole('checkbox').check(); await button.click(); }
  await p.getByRole('heading', { name: 'Club communication', exact: true }).waitFor();
}
try {
  await page.goto(`${base}/portal/admin`); await page.getByRole('button', { name: 'Messages', exact: true }).click(); await acceptAgreement(page);
  await page.getByRole('button', { name: 'Manage Committee', exact: true }).click();
  await page.getByLabel('Find adult account').fill(suffix);
  await page.getByRole('dialog', { name: 'Committee members' }).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('navigation', { name: 'Your groups' }).getByRole('button', { name: /^Committee/ }).click();
  await page.getByLabel('Post as').selectOption('announcement');
  await page.getByLabel('Write an announcement').fill(name);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const article = page.locator('.yjrl-chat-message').filter({ has: page.getByText(name, { exact: true }) });
  await article.waitFor();
  await article.getByRole('button', { name: /^Pin message/ }).click();
  await page.getByRole('tab', { name: 'Announcements', exact: true }).click(); await article.waitFor();
  await page.reload(); await page.getByRole('button', { name: 'Messages', exact: true }).click(); await acceptAgreement(page);
  await page.getByRole('navigation', { name: 'Your groups' }).getByRole('button', { name: /^Committee/ }).click();
  await page.locator('.yjrl-chat-pins summary').waitFor();
  await page.getByRole('tab', { name: 'Schedule', exact: true }).click();
  await page.getByRole('button', { name: 'Add Activity', exact: true }).click();
  await page.getByLabel('Activity title', { exact: true }).fill(name);
  await page.getByLabel('Activity type', { exact: true }).selectOption('meeting');
  await page.getByLabel('Date (Queensland)', { exact: true }).fill('2027-04-03');
  await page.getByLabel('Time (AEST)', { exact: true }).fill('17:00');
  await page.getByLabel('Venue', { exact: true }).fill('Synthetic review oval');
  await page.getByLabel('Google Maps link', { exact: true }).fill('https://www.google.com/maps/search/?api=1&query=Nev+Skuse+Oval');
  await page.getByRole('button', { name: 'Save Activity', exact: true }).click();
  await page.getByRole('dialog', { name: 'Add activity' }).waitFor({ state: 'hidden' });
  parentContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await parentContext.addCookies(await context.cookies());
  await parentContext.addInitScript(value => localStorage.setItem('yjrl_token', value), parent.token);
  const family = await parentContext.newPage(); family.on('pageerror', error => errors.push(error.message));
  await family.goto(`${base}/portal/messages`); await acceptAgreement(family);
  await family.getByRole('navigation', { name: 'Your groups' }).getByRole('button', { name: /^Committee/ }).click();
  const familyArticle = family.locator('.yjrl-chat-message').filter({ has: family.getByText(name, { exact: true }) });
  const reaction = familyArticle.getByRole('button', { name: /^React 👍/ }); await reaction.click();
  await familyArticle.locator('button[aria-pressed=true]').waitFor();
  await family.reload(); await family.getByRole('heading', { name: 'Club communication', exact: true }).waitFor();
  await family.getByRole('navigation', { name: 'Your groups' }).getByRole('button', { name: /^Committee/ }).click();
  await familyArticle.waitFor(); assert.equal(await reaction.getAttribute('aria-pressed'), 'true');
  await familyArticle.scrollIntoViewIfNeeded();
  await family.locator('.yjrl-chat-messages').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await family.screenshot({ path: '.wrangler/chat-browser/messages-mobile.png', fullPage: true });
  assert.ok(await family.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await family.getByRole('tab', { name: 'Schedule', exact: true }).click();
  const activity = family.locator('.yjrl-group-activity').filter({ has: family.getByRole('heading', { name, exact: true }) });
  await activity.getByRole('button', { name: /^Going/ }).click(); await activity.getByText('Your reply: going', { exact: true }).waitFor();
  assert.equal(await activity.getByRole('link', { name: /Open Google Maps/ }).getAttribute('href'), 'https://www.google.com/maps/search/?api=1&query=Nev+Skuse+Oval');
  await family.reload(); await family.getByRole('tab', { name: 'Schedule', exact: true }).click(); await activity.getByText('Your reply: going', { exact: true }).waitFor();
  await family.screenshot({ path: '.wrangler/chat-browser/schedule-mobile.png', fullPage: true });
  const saved = (await api('/yjrl/chat/activities?room_id=committee-all')).find(a => a.title === name); assert.equal(saved.counts.going, 1); assert.equal(saved.replies[0].name, `Synthetic Committee ${suffix}`);
  const feed = await api('/yjrl/chat?room_id=committee-all'); const posted = feed.messages.find(m => m.text === name); assert.equal(posted.reactions['👍'], 1); assert.ok(posted.seenCount >= 1);
  await page.getByRole('tab', { name: 'Messages', exact: true }).click();
  await page.screenshot({ path: '.wrangler/chat-browser/messages-desktop.png', fullPage: true });
  await api(`/yjrl/chat/${posted.id}/pin`, 'PUT', { pinned: false });
  await api(`/yjrl/chat/activities/${saved.id}`, 'PUT', { title: saved.title, kind: saved.kind, startsAt: saved.starts_at, venue: saved.venue, mapsUrl: saved.maps_url, details: saved.details, cancelled: true });
  assert.deepEqual(errors, []);
  console.log('PASS: admin communication tab, recorded adult checkbox, committee access, announcements, pin/reload, saved reaction/reload, AEST schedule, family RSVP/reload, Maps link, mobile layout and no browser errors. Synthetic review records retained.');
} catch (error) {
  await page.screenshot({ path: '.wrangler/chat-browser/failure.png', fullPage: true });
  throw error;
} finally {
  await api(`/yjrl/chat/committee/${parent.user._id}`, 'PUT', { member: false });
  const cleanupFeed = await api('/yjrl/chat?room_id=committee-all');
  for (const m of cleanupFeed.pinned || []) if (m.text.startsWith('Synthetic committee ')) await api(`/yjrl/chat/${m.id}/pin`, 'PUT', { pinned: false });
  await context.close(); if (parentContext) await parentContext.close(); await browser.close();
}
