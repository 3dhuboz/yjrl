// Real browser acceptance, synthetic content, isolated review service only.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { deflateSync } from 'node:zlib';
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
const suffix = Date.now().toString(36), name = `Synthetic browser ${suffix}`;
const map = 'https://www.google.com/maps/search/?api=1&query=Nev+Skuse+Oval+Yeppoon';
const team = await api('/yjrl/teams', 'POST', { name, ageGroup: 'U14', trainingDay: 'Tuesday', trainingTime: '17:00', trainingVenue: 'Synthetic test venue', trainingMapsUrl: map });
const cleanup = [];
mkdirSync('.wrangler/admin-browser', { recursive: true });
async function adminTab(label) { await page.goto(`${base}/portal/admin`); await page.getByRole('button', { name: label, exact: true }).click(); }
try {
  await adminTab('Fixtures');
  await page.getByRole('button', { name: 'Add Fixture', exact: true }).click();
  await page.getByRole('button', { name: 'Create Fixture', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'away team' }).waitFor();
  const modal = page.locator('.yjrl-modal');
  await modal.locator('select').nth(0).selectOption(team.id);
  await modal.locator('input[type=date]').fill('2027-05-02');
  await modal.locator('input[type=time]').fill('11:15');
  await modal.locator('input').nth(4).fill(name);
  await modal.getByLabel('Google Maps Share link').fill(map);
  await page.getByRole('button', { name: 'Create Fixture', exact: true }).click();
  await modal.waitFor({ state: 'hidden' });
  const fixture = (await api('/yjrl/fixtures')).find(item => item.awayTeamName === name); assert.ok(fixture); cleanup.push(['/yjrl/fixtures/' + fixture.id, 'DELETE']);
  await page.locator('tr').filter({ hasText: name }).getByRole('button', { name: 'Edit fixture' }).click();
  await modal.locator('input[type=time]').fill('12:30');
  await page.getByRole('button', { name: 'Save Fixture', exact: true }).click(); await modal.waitFor({ state: 'hidden' });
  assert.equal((await api('/yjrl/fixtures/' + fixture.id)).time, '12:30');
  await page.goto(`${base}/fixtures`); const gameLink = page.getByRole('link', { name: /Open Nev Skuse Oval/ }).first(); await gameLink.waitFor(); assert.equal(await gameLink.getAttribute('href'), map);
  await page.goto(`${base}/teams`); const trainingLink = page.locator('.yjrl-card').filter({ hasText: name }).getByRole('link', { name: /Open Synthetic test venue/ }); await trainingLink.waitFor(); assert.equal(await trainingLink.getAttribute('href'), map);
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: '.wrangler/admin-browser/teams-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.setViewportSize({ width: 1280, height: 900 });
  await adminTab('Events'); await page.getByRole('button', { name: 'Add Event', exact: true }).click();
  await page.getByLabel('Event title *').fill(name); await page.getByLabel('Event date', { exact: true }).fill('2027-05-02');
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click(); await page.locator('.yjrl-modal').waitFor({ state: 'hidden' });
  const event = (await api('/yjrl/events/all')).find(item => item.title === name); assert.ok(event); cleanup.push(['/yjrl/events/' + event.id, 'DELETE']);
  assert.ok(!(await api('/yjrl/events')).some(item => item.id === event.id));
  await page.locator('.yjrl-card.admin-toolbar').filter({ hasText: name }).getByRole('button', { name: 'Edit', exact: true }).click(); await page.getByLabel('Publish on the public events calendar').check();
  await page.getByRole('button', { name: 'Publish Event', exact: true }).click(); await page.locator('.yjrl-modal').waitFor({ state: 'hidden' });
  await page.screenshot({ path: '.wrangler/admin-browser/events-calendar.png', fullPage: true });
  await page.goto(`${base}/events`); await page.getByRole('heading', { name, exact: true }).waitFor();
  await adminTab('News'); await page.getByRole('button', { name: 'Write Article', exact: true }).click();
  await page.locator('.yjrl-modal input[type=text]').first().fill(name);
  await page.locator('.yjrl-modal textarea').fill('Synthetic article for testing publication and photo upload.');
  // Tiny synthetic image, with no real people.
  function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
  function chunk(type, payload) { const data = Buffer.concat([Buffer.from(type), payload]), output = Buffer.alloc(payload.length + 12); output.writeUInt32BE(payload.length); data.copy(output, 4); output.writeUInt32BE(crc32(data), output.length - 4); return output; }
  const header = Buffer.alloc(13); header.writeUInt32BE(120); header.writeUInt32BE(80, 4); header[8] = 8; header[9] = 2;
  const pixels = Buffer.alloc(361 * 80, 220); for (let y = 0; y < 80; y++) pixels[y * 361] = 0;
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
  await page.getByLabel('Upload article photo').setInputFiles({ name: 'synthetic-pattern.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: 'Preview privately', exact: true }).click();
  await page.getByAltText('Image submitted for club review').waitFor();
  await page.getByLabel('Who is shown?').selectOption('none');
  await page.getByLabel('Photo description / review notes').fill('Synthetic grey pattern only, no people or personal information.');
  await page.getByRole('button', { name: 'Approve & use photo', exact: true }).click();
  await page.getByAltText('Selected article').waitFor();
  const image = await page.getByAltText('Selected article').getAttribute('src');
  await page.getByLabel('Publish immediately').check(); await page.getByRole('button', { name: 'Publish Article', exact: true }).click(); await page.locator('.yjrl-modal').waitFor({ state: 'hidden' });
  const article = (await api('/yjrl/news')).find(item => item.title === name); assert.ok(article); assert.equal(article.image, image); cleanup.push(['/yjrl/news/' + article.id, 'DELETE']);
  const photo = (await api('/yjrl/safety/uploads')).find(item => item.url === image); cleanup.push(['/yjrl/safety/uploads/review', 'PUT', { key: photo.key, status: 'rejected', reviewVersion: photo.reviewVersion, reviewNotes: 'Browser acceptance complete; remove synthetic image.' }]);
  await page.goto(`${base}/news`); await page.getByText(name, { exact: true }).first().waitFor();
  await adminTab('Players'); await page.getByRole('button', { name: 'Add Player', exact: true }).click();
  for (const [label, value] of [['First name', 'Synthetic'], ['Last name', suffix], ['Date of birth', '2014-03-05'], ['Guardian name', 'Synthetic Adult'], ['Guardian email', 'synthetic@example.test'], ['Guardian phone', '0400000000']]) await page.getByRole('textbox', { name: label, exact: true }).count() ? await page.getByRole('textbox', { name: label, exact: true }).fill(value) : await page.getByLabel(label, { exact: true }).fill(value);
  await page.locator('.yjrl-modal').getByRole('button', { name: 'Add Player', exact: true }).click(); await page.locator('.yjrl-modal').waitFor({ state: 'hidden' });
  const player = (await api('/yjrl/players')).find(item => item.lastName === suffix); assert.ok(player); assert.equal(player.registrationStatus, 'pending'); cleanup.push(['/yjrl/players/' + player.id, 'PUT', { registrationStatus: 'inactive' }]);
  await adminTab('Chat Safety'); await page.getByRole('textbox', { name: 'Search chat rooms' }).fill('U14');
  await page.locator('.admin-toolbar select').selectOption('name');
  assert.equal(await page.getByText('Safeguarding Audit Log', { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'passed', environment: 'isolated review', checks: ['fixture validation/create/edit', 'game and training Maps links', 'mobile Teams layout', 'event calendar draft/publish', 'real inline photo upload/preview/review', 'public news visibility', 'manual pending player', 'chat search/sort', 'no audit-log panel', 'no browser exceptions'] }));
} catch (error) {
  console.error('Browser exceptions:', errors);
  await page.screenshot({ path: '.wrangler/admin-browser/failure.png', fullPage: true });
  throw error;
} finally {
  for (const [path, method, body] of cleanup.reverse()) { try { await api(path, method, body); } catch { console.error('Synthetic cleanup failed for', path); } }
  await api('/yjrl/teams/' + team.id, 'DELETE');
  await context.close(); await browser.close();
}
