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


const suffix = Date.now().toString(36), text = `Synthetic checklist ${suffix}`;
const before = await api('/yjrl/checklist');
let linkId, guestContext, photoId;
mkdirSync('.wrangler/checklist-browser', { recursive: true });
const openItem = async item => { await item.waitFor(); if (!await item.evaluate(element => element.open)) await item.locator('summary').click(); };
try {
  await page.goto(`${base}/portal/admin`); await page.getByRole('button', { name: 'Website checklist', exact: true }).click();
  await page.getByRole('heading', { name: 'Nathan’s website checklist' }).waitFor();
  await page.locator('.checklist-link-settings summary').click();
  await page.getByRole('button', { name: 'Create private link', exact: true }).click();
  const share = page.getByRole('textbox', { name: 'Copy this link for Nathan' }); await share.waitFor();
  const privateUrl = await share.inputValue(); assert.ok(privateUrl.startsWith(`${base}/website-checklist#access=`));
  const links = await api('/yjrl/checklist/links'); linkId = links[0].id;
  guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } }); await guestContext.addCookies(await context.cookies());
  await guestContext.addInitScript(() => localStorage.setItem('yjrl_token', 'expired-session-test'));
  const guest = await guestContext.newPage(); guest.on('pageerror', e => errors.push(e.message));
  await guest.goto(privateUrl); await guest.getByText('0 of 8 items supplied', { exact: true }).waitFor();
  assert.equal(new URL(guest.url()).hash, ''); assert.equal(await guest.evaluate(() => localStorage.getItem('yjrl_token')), null);
  assert.equal(await guest.getByText('Nathan’s private link', { exact: true }).count(), 0);
  const item = guest.locator('.website-checklist-item').filter({ has: guest.getByText('2027 sign-ups', { exact: true }) });
  await openItem(item); await item.getByLabel('Your notes', { exact: true }).fill(text);
  await item.getByRole('button', { name: 'Save for later', exact: true }).click();
  await item.getByText('Unsaved notes', { exact: true }).waitFor({ state: 'hidden' });
  await guest.reload(); await openItem(item); assert.equal(await item.getByLabel('Your notes', { exact: true }).inputValue(), text);
  const canvas = await context.newPage(); await canvas.goto('about:blank');
  const png = await canvas.evaluate(() => { const c = document.createElement('canvas'); c.width = 120; c.height = 80; const x = c.getContext('2d'); x.fillStyle = '#1d4ed8'; x.fillRect(0, 0, 120, 80); x.fillStyle = '#ffe100'; x.fillRect(20, 20, 80, 40); return c.toDataURL('image/png').split(',')[1]; }); await canvas.close();
  await item.getByLabel('Choose photo', { exact: true }).setInputFiles({ name: 'synthetic-checklist.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await item.getByLabel('What is this photo for?', { exact: true }).fill(text);
  assert.equal(await item.getByRole('button', { name: 'Upload photo', exact: true }).isDisabled(), true);
  await item.getByRole('checkbox').check(); await item.getByRole('button', { name: 'Upload photo', exact: true }).click();
  await item.getByRole('img', { name: text, exact: true }).waitFor();
  assert.ok(await item.getByRole('img', { name: text, exact: true }).evaluate(img => img.complete && img.naturalWidth > 0));
  await item.getByRole('button', { name: 'Ready for review', exact: true }).click();
  await guest.getByText('1 of 8 items supplied', { exact: true }).waitFor();
  await guest.reload(); await openItem(item); await item.getByRole('img', { name: text, exact: true }).waitFor();
  assert.equal(await item.getByLabel('Your notes', { exact: true }).inputValue(), text);
  assert.equal(await guest.getByRole('button', { name: 'Mark added to website' }).count(), 0);
  assert.ok(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await guest.screenshot({ path: '.wrangler/checklist-browser/nathan-mobile.png', fullPage: true });
  await page.reload(); await page.getByRole('button', { name: 'Website checklist', exact: true }).click();
  const adminItem = page.locator('.website-checklist-item').filter({ has: page.getByText('2027 sign-ups', { exact: true }) });
  await openItem(adminItem); assert.equal(await adminItem.getByLabel('Your notes', { exact: true }).inputValue(), text);
  const saved = (await api('/yjrl/checklist')).sections[0]; photoId = saved.photos.find(p => p.caption === text).id;
  await adminItem.getByRole('button', { name: 'Send to photo review', exact: true }).click(); await adminItem.getByText('In photo review', { exact: true }).waitFor();
  const records = await api('/yjrl/safety/uploads'); const record = records.find(r => r.key.endsWith(`${photoId}.webp`)); assert.equal(record.status, 'pending_review');
  const publicPhoto = await fetch(`${base}/api/media?key=${encodeURIComponent(record.key)}`, { headers: { Cookie: cookie } }); assert.equal(publicPhoto.status, 404);
  await page.screenshot({ path: '.wrangler/checklist-browser/admin-desktop.png', fullPage: true });
  await api(`/yjrl/checklist/links/${linkId}`, 'DELETE');
  await guest.reload(); await guest.getByRole('alert').waitFor(); assert.ok((await guest.getByRole('alert').textContent()).includes('expired'));
  assert.deepEqual(errors, []);
  console.log('PASS: private link without account, fragment removed, saved notes/reload, processed private photo/upload/reload, submission progress, admin review handover, public photo blocked, mobile layout, link revocation.');
} catch (error) {
  if (guestContext?.pages()[0]) await guestContext.pages()[0].screenshot({ path: '.wrangler/checklist-browser/failure-guest.png', fullPage: true });
  throw error;
} finally {
  if (linkId) await api(`/yjrl/checklist/links/${linkId}`, 'DELETE');
  const current = await api('/yjrl/checklist');
  for (const section of current.sections) { const original = before.sections.find(s => s.id === section.id); if (section.notes === text) await api(`/yjrl/checklist/items/${section.id}`, 'PUT', { notes: original.notes, status: original.status, version: section.version }); }
  if (photoId) await api(`/yjrl/checklist/photos/${photoId}`, 'DELETE');
  await context.close(); if (guestContext) await guestContext.close(); await browser.close();
}
