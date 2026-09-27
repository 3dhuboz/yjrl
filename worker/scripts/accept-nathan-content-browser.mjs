// Read-only public-page acceptance. Only isolated review uses a synthetic admin login.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node-v24.18.0-linux-x64/lib/node_modules/@playwright/cli/package.json')('playwright');
const production = process.argv.includes('--production');
const base = production ? 'https://yjrl.pages.dev' : 'https://yjrl-review.steve-700.workers.dev';
const port = readFileSync('/srv/headsnap/browser-profiles/yjrl/DevToolsActivePort', 'utf8').split('\n')[0];
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const context = await browser.newContext();
const errors = [];
try {
  let secrets;
  if (!production) {
    secrets = JSON.parse(readFileSync('/home/steve/.local/share/yjrl/review-secrets.json', 'utf8'));
    const response = await fetch(base, { headers: { Authorization: `Basic ${Buffer.from(`yjrl-review:${secrets.REVIEW_ACCESS_PASSWORD}`).toString('base64')}` } });
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie').split(';')[0], split = cookie.indexOf('=');
    await context.addCookies([{ name: cookie.slice(0, split), value: cookie.slice(split + 1), domain: new URL(base).hostname, path: '/', secure: true, httpOnly: true, sameSite: 'Strict' }]);
  }
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  mkdirSync('.wrangler/nathan-content-browser', { recursive: true });
  for (const width of [390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/contact', '/register', '/teams', '/events', '/news', '/shop', '/legal/child-safety']) {
      await page.goto(base + route); await page.locator('footer').waitFor();
      await page.getByRole('link', { name: 'Follow us on Facebook', exact: true }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route}: overflow at ${width}`);
      if (route === '/') { await page.getByText('Season 2027 #UpTheGullies', { exact: true }).waitFor(); assert.ok((await page.locator('body').innerText()).includes('since 1993')); assert.ok(!(await page.locator('body').innerText()).includes('Mini Mod to Seniors')); }
      if (route === '/contact') {
        for (const email of ['admin', 'registrarmm', 'registrarint', 'girlsrego', 'sponsorship', 'accounts', 'uniforms', 'president']) assert.ok(await page.locator(`a[href="mailto:${email}@yeppoonjrl.com.au"]`).count() > 0);
        if (width === 390) await page.screenshot({ path: '.wrangler/nathan-content-browser/contact-mobile.png', fullPage: true });
      }
      if (route === '/register') { await page.getByRole('heading', { name: 'Register through Play Rugby League' }).waitFor(); assert.equal(await page.getByRole('link', { name: 'Visit Play Rugby League' }).getAttribute('href'), 'https://www.playrugbyleague.com/'); assert.equal(await page.locator('input').count(), 0); assert.ok((await page.locator('body').innerText()).includes('December 2026')); }
      if (route === '/teams') { const group = page.getByRole('region', { name: '2027 team groups' }); assert.ok((await group.innerText()).includes('U11, U13, U15 and U17')); }
      if (route === '/events') { await page.getByRole('heading', { name: 'CQ girls carnival' }).waitFor(); assert.ok((await page.getByRole('region', { name: 'Dates to be confirmed' }).innerText()).includes('Late June 2027')); }
      if (route === '/news') assert.equal(await page.getByRole('link', { name: 'Club updates on Facebook' }).getAttribute('href'), 'https://www.facebook.com/YeppoonJuniorSeagulls');
      if (route === '/shop' && production) { await page.getByRole('heading', { name: 'Our club shop is being prepared' }).waitFor(); await page.getByRole('heading', { name: 'Club polos' }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Add to Basket' }).count(), 0); }
      if (route === '/legal/child-safety') await page.getByRole('heading', { name: 'Club safety contacts' }).waitFor();
    }
  }
  if (!production) {
    const auth = await context.request.post(`${base}/api/auth/login`, { data: { email: secrets.ADMIN_EMAIL, password: secrets.ADMIN_PASSWORD, adultConfirmed: true } });
    assert.equal(auth.status(), 200); const { token } = await auth.json();
    await page.evaluate(token => localStorage.setItem('yjrl_token', token), token);
    await page.goto(base + '/portal/admin'); await page.getByRole('button', { name: 'Shop', exact: true }).click();
    await page.getByRole('heading', { name: 'Club polos', exact: true }).waitFor();
    await page.getByText('Price to confirm · Draft · Unavailable', { exact: true }).first().waitFor();
    await page.getByRole('button', { name: 'Website checklist', exact: true }).click();
    await page.locator('.website-checklist-item').first().locator('summary').click();
    await page.getByText('Website update · 27 September 2026', { exact: true }).first().waitFor();
  }
  assert.deepEqual(errors, []);
  console.log(`PASS ${production ? 'production' : 'review'}: eight public routes at phone/tablet/desktop sizes, contacts, official registration link without a duplicate form, club history, team groups, tentative events, Facebook links and safety contacts${production ? ', closed shop preview' : ', admin drafts and checklist feedback'}. No content submitted.`);
} finally { await context.close(); await browser.close(); }
