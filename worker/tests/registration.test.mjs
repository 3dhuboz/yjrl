import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import register from '../src/routes/register.ts';
import players from '../src/routes/players.ts';
import { validateRegistrationFees, registrationFee } from '../../client/src/registrationFees.mjs';
import { handleUnauthorized } from '../../client/src/apiErrors.mjs';
import { checkoutFromSearch, confirmationEmailMessage } from '../../client/src/registrationCheckout.mjs';

function database(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  for (const file of ['0001_schema.sql', '0003_child_safety.sql', '0004_registration_claims.sql']) {
    sqlite.exec(readFileSync(`migrations/${file}`, 'utf8'));
  }
  function prepare(sql, args = []) {
    return {
      bind: (...values) => prepare(sql, values),
      first: async () => sqlite.prepare(sql).get(...args) ?? null,
      all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
      run: async () => ({ success: true, meta: sqlite.prepare(sql).run(...args) }),
      execute: () => ({ success: true, meta: sqlite.prepare(sql).run(...args) }),
    };
  }
  return {
    sqlite,
    prepare,
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(statement.execute());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

function environment(t) {
  return { DB: database(t), JWT_SECRET: 'local-test-secret-only', ENVIRONMENT: 'production' };
}

const form = {
  season: '2027', firstName: 'Test', lastName: 'Player', dateOfBirth: '2018-03-05',
  ageGroup: 'U9', email: 'guardian@example.test', password: 'test-password-only',
  guardianName: 'Test Guardian', guardianPhone: '0400000000', guardianEmail: 'guardian@example.test',
  emergencyContact: { name: 'Test Contact', phone: '0400000001', relationship: 'Guardian' },
  agreeToTerms: true, agreeToPhotoPolicy: false, paymentMethod: 'offline', quotedAmount: 120,
};

function submit(env, overrides = {}) {
  return register.request('/register-player', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...form, ...overrides }),
  }, env);
}

test('2027 fee quote disables the unconfirmed early-bird offer and live PayPal', async (t) => {
  const response = await register.request('/registration-fees', {}, environment(t));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const details = validateRegistrationFees(await response.json(), '2027');
  assert.equal(details.earlyBirdActive, false);
  assert.equal(details.earlyBirdCutoff, null);
  assert.equal(details.paymentOptions.paypal, false);
  assert.equal(registrationFee(details, 'U9'), 120);
  assert.equal(registrationFee(details, 'unknown'), null);
});

test('missing or old seasons and unknown age groups create no registration data', async (t) => {
  const env = environment(t);
  for (const [overrides, status] of [
    [{ season: '2026' }, 409], [{ season: undefined }, 409],
    [{ ageGroup: 'unknown' }, 400], [{ ageGroup: 'toString' }, 400],
  ]) {
    assert.equal((await submit(env, overrides)).status, status);
  }
  for (const table of ['users', 'players', 'registrations']) {
    assert.equal(env.DB.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0);
  }
});

test('offline sign-up records the 2027 season, quoted fee, guardian link and consent', async (t) => {
  const env = environment(t);
  const response = await submit(env);
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.season, '2027');
  assert.equal(body.amount, 120);
  assert.equal(body.paymentStatus, 'offline');
  const row = env.DB.sqlite.prepare('SELECT * FROM registrations').get();
  assert.equal(row.season, '2027');
  assert.equal(row.fee_amount, 120);
  assert.equal(row.discount_amount, 0);
  assert.equal(JSON.parse(row.form_data).season, '2027');
  assert.equal(env.DB.sqlite.prepare('SELECT registration_year FROM players').get().registration_year, '2027');
  assert.equal(env.DB.sqlite.prepare('SELECT status FROM parent_child_links').get().status, 'verified');
  assert.equal(env.DB.sqlite.prepare('SELECT media_consent FROM player_consents').get().media_consent, 0);
  const children = await players.request('/my-children', { headers: { Authorization: `Bearer ${body.token}` } }, env);
  assert.equal(children.status, 200);
  const [child] = await children.json();
  assert.equal(child.registrationYear, '2027');
  assert.equal(child.registrationPaymentStatus, 'offline');
  assert.equal(child.registrationFeeAmount, 120);
});

test('the same parent can renew for 2027 and add a sibling, but cannot duplicate the same season', async (t) => {
  const env = environment(t);
  const first = await submit(env);
  assert.equal(first.status, 201);
  // Retain last season's records rather than relabelling them during rollover.
  env.DB.sqlite.exec("DELETE FROM registration_claims; UPDATE registrations SET season = '2026'; UPDATE players SET registration_year = '2026'");
  const renewal = await submit(env);
  assert.equal(renewal.status, 201);
  const { token } = await renewal.json();
  assert.equal((await submit(env)).status, 409);
  assert.equal((await submit(env, { firstName: 'Sibling', dateOfBirth: '2019-04-06', ageGroup: 'U8' })).status, 201);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM users').get().n, 1);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM registrations').get().n, 3);
  const response = await players.request('/my-children', { headers: { Authorization: `Bearer ${token}` } }, env);
  const children = await response.json();
  assert.equal(children.length, 3);
  assert.deepEqual(children.map(child => child.registrationYear).sort(), ['2026', '2027', '2027']);
  assert.ok(children.every(child => child.registrationPaymentStatus === 'offline'));
});

test('unavailable PayPal creates no customer records', async (t) => {
  const env = environment(t);
  assert.equal((await submit(env, { paymentMethod: 'paypal' })).status, 503);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM registrations').get().n, 0);
});

test('fee loading rejects stale, incomplete or invalid data instead of guessing a price', () => {
  const quote = { season: '2027', fees: { U6: 80 }, earlyBirdActive: false, earlyBirdDiscount: 20, paymentOptions: { paypal: false, offline: true } };
  for (const data of [null, { ...quote, season: '2026' }, { ...quote, fees: {} },
    { ...quote, fees: { U6: '80' } }, { ...quote, fees: { U6: -10 } },
    { ...quote, paymentOptions: {} }, { ...quote, earlyBirdActive: true, earlyBirdDiscount: 100 }]) {
    assert.throws(() => validateRegistrationFees(data, '2027'));
  }
  assert.equal(registrationFee(null, 'U6'), null);
  assert.equal(registrationFee(validateRegistrationFees({ ...quote, fees: { U6: 0 } }, '2027'), 'U6'), 0);
  assert.equal(registrationFee(validateRegistrationFees({ ...quote, earlyBirdActive: true }, '2027'), 'U6'), 60);
});

test('malformed bodies, invalid required details and non-boolean consent cannot create child records', async (t) => {
  const env = environment(t);
  for (const input of [null, [], 123, 'registration']) {
    const response = await register.request('/register-player', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }, env);
    assert.equal(response.status, 400);
  }
  for (const invalid of [
    { firstName: '   ' }, { firstName: {} }, { lastName: ['Player'] },
    { dateOfBirth: undefined }, { dateOfBirth: '2019-02-29' }, { dateOfBirth: '2030-01-01' },
    { guardianName: '' }, { guardianPhone: 'hello' }, { guardianEmail: 'invalid' },
    { guardianEmail: 'another@example.test' }, { password: { length: 20 } },
    { emergencyContact: {} }, { emergencyContact: { name: 'Contact', phone: '1' } },
    { medicalNotes: 'x'.repeat(5001) }, { agreeToTerms: false }, { agreeToTerms: 'true' },
    { agreeToPhotoPolicy: 'false' }, { paymentMethod: 'card' },
  ]) {
    const response = await submit(env, invalid);
    assert.equal(response.status, 400, JSON.stringify(invalid).slice(0, 100));
    assert.match((await response.json()).error, /Please/);
  }
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM players').get().n, 0);
});

test('valid details are trimmed, leap dates work, and omitted photo consent stays off', async (t) => {
  const env = environment(t);
  const response = await submit(env, { firstName: ' Test ', lastName: ' Player ', dateOfBirth: '2020-02-29', email: ' GUARDIAN@EXAMPLE.TEST ', guardianEmail: 'guardian@example.test', agreeToPhotoPolicy: undefined });
  assert.equal(response.status, 201);
  const player = env.DB.sqlite.prepare('SELECT first_name, last_name FROM players').get();
  assert.equal(player.first_name, 'Test');
  assert.equal(player.last_name, 'Player');
  assert.equal(env.DB.sqlite.prepare('SELECT media_consent FROM player_consents').get().media_consent, 0);
});

test('simultaneous submissions create only one player, registration and guardian link', async (t) => {
  const env = environment(t);
  // Establish a parent first, then race a second child's submissions past the read check.
  assert.equal((await submit(env, { firstName: 'First' })).status, 201);
  const responses = await Promise.all([submit(env), submit(env)]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  for (const table of ['players', 'registrations', 'parent_child_links', 'registration_claims']) {
    assert.equal(env.DB.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 2, table);
  }
});

test('simultaneous first-account submissions roll back the losing registration', async (t) => {
  const env = environment(t);
  const responses = await Promise.all([submit(env), submit(env)]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  for (const table of ['users', 'players', 'registrations', 'parent_child_links']) {
    assert.equal(env.DB.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 1, table);
  }
});

test('a retry after a lost response returns the saved receipt after password verification', async (t) => {
  const env = environment(t);
  const saved = await (await submit(env)).json();
  const duplicate = await submit(env);
  assert.equal(duplicate.status, 409);
  const body = await duplicate.json();
  assert.equal(body.registration.registrationId, saved.registrationId);
  assert.equal(body.registration.alreadyReceived, true);
  assert.equal(body.registration.emailStatus, 'not_attempted');
  const wrongPassword = await submit(env, { password: 'wrong-password' });
  assert.equal(wrongPassword.status, 401);
  assert.equal((await wrongPassword.json()).registration, undefined);
});

test('password errors stay on the form while expired portal sessions still redirect', () => {
  const removed = [];
  const storage = { removeItem: key => removed.push(key) };
  const location = { pathname: '/register', href: '/register' };
  handleUnauthorized({ response: { status: 401 }, config: { skipAuthRedirect: true } }, storage, location);
  assert.equal(location.href, '/register');
  assert.deepEqual(removed, []);
  handleUnauthorized({ response: { status: 401 }, config: {} }, storage, location);
  assert.equal(location.href, '/login');
  assert.deepEqual(removed, ['yjrl_token']);
});

test('email failures preserve registration and report a truthful receipt', async (t) => {
  const env = environment(t);
  env.RESEND_API_KEY = 'test-only';
  env.FROM_EMAIL = 'club@example.test';
  env.ADMIN_EMAIL = 'admin@example.test';
  const keys = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://api.resend.com/emails');
    keys.push(init.headers['Idempotency-Key']);
    return new Response('{}', { status: 503 });
  });
  const response = await submit(env);
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.emailStatus, 'failed');
  assert.equal(keys.length, 2);
  assert.notEqual(keys[0], keys[1]);
  assert.match(confirmationEmailMessage(body.emailStatus, form.email), /could not send/);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM registrations').get().n, 1);
});

test('unconfigured email and replayed receipts do not claim that email was sent', async (t) => {
  const body = await (await submit(environment(t))).json();
  assert.equal(body.emailStatus, 'unavailable');
  assert.match(confirmationEmailMessage(body.emailStatus, form.email), /could not send/);
  assert.doesNotMatch(confirmationEmailMessage('not_attempted', form.email), /has been sent/);
  assert.match(confirmationEmailMessage('sent', form.email), /has been sent/);
});

function mockPaypal(t, options = {}) {
  let checkout;
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    calls.push({ url, init });
    assert.ok(url.startsWith('https://api-m.sandbox.paypal.com/') || url === 'https://api.resend.com/emails', 'No real external request is permitted');
    if (url.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'fake-token' });
    if (url === 'https://api.resend.com/emails') return Response.json({ id: 'fake-email' });
    if (url.endsWith('/v2/checkout/orders')) {
      checkout = JSON.parse(init.body);
      return Response.json({ id: 'TEST-ORDER', links: [{ rel: 'approve', href: options.approvalUrl || 'https://www.sandbox.paypal.com/checkoutnow?token=TEST-ORDER' }] });
    }
    if (url.endsWith('/capture')) {
      options.onCapture?.();
      if (options.failCapture) return new Response('{}', { status: 503 });
      if (options.alreadyCaptured) return new Response('ORDER_ALREADY_CAPTURED', { status: 422 });
      return Response.json(captureResponse(options));
    }
    return Response.json(options.alreadyCaptured ? captureResponse(options) : {
      id: 'TEST-ORDER', status: 'CREATED', links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=TEST-ORDER' }],
    });
  });
  return { calls, checkout: () => checkout };
}

function captureResponse(options) {
  return { status: 'COMPLETED', purchase_units: [{ payments: { captures: [{
    id: 'TEST-CAPTURE', status: options.captureStatus || 'COMPLETED', amount: { currency_code: options.currency || 'AUD', value: options.amount || '120.00' },
  }] } }] };
}

async function paypalRegistration(t, options = {}) {
  const env = { ...environment(t), ENVIRONMENT: 'test', PAYPAL_CLIENT_ID: 'test-id', PAYPAL_CLIENT_SECRET: 'test-secret', PAYPAL_MODE: 'sandbox' };
  const mock = mockPaypal(t, options);
  const response = await submit(env, { paymentMethod: 'paypal' });
  const body = await response.json();
  assert.equal(response.status, 201, body.error);
  const state = new URL(mock.checkout().application_context.return_url).searchParams.get('state');
  const post = (action, submittedState = state) => register.request(`/register-player/${body.registrationId}/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: submittedState }),
  }, env);
  return { env, mock, body, state, post };
}

test('cancelled PayPal returns can resume the existing order without another registration', async (t) => {
  const { env, mock, body, state, post } = await paypalRegistration(t);
  const cancelled = checkoutFromSearch(new URL(mock.checkout().application_context.cancel_url).search);
  assert.equal(cancelled.action, 'resume');
  assert.equal(cancelled.registrationId, body.registrationId);
  assert.equal(cancelled.state, state);
  const resumed = await post('resume');
  assert.equal(resumed.status, 200);
  assert.match((await resumed.json()).approvalUrl, /^https:\/\/www.sandbox.paypal.com\//);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM registrations').get().n, 1);
  assert.equal((await post('resume', 'invalid')).status, 403);
  const duplicate = await (await submit(env, { paymentMethod: 'paypal' })).json();
  assert.equal(duplicate.registrationId, body.registrationId);
  assert.ok(duplicate.checkoutState);
});

test('capture records payment once, leaves club approval pending, and repeated confirmation is safe', async (t) => {
  const { env, mock, post } = await paypalRegistration(t);
  env.RESEND_API_KEY = 'test-only'; env.FROM_EMAIL = 'club@example.test'; env.ADMIN_EMAIL = 'admin@example.test';
  const paid = await post('capture');
  assert.equal(paid.status, 200);
  assert.equal((await paid.json()).paymentStatus, 'paid');
  assert.equal(env.DB.sqlite.prepare('SELECT registration_status FROM players').get().registration_status, 'pending');
  const replay = await post('capture');
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).emailStatus, 'not_attempted');
  assert.equal(mock.calls.filter(call => call.url.endsWith('/capture')).length, 1);
  assert.equal(mock.calls.filter(call => call.url === 'https://api.resend.com/emails').length, 2);
  assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'registration_paid'").get().n, 1);
});

test('provider-confirmed previous captures reconcile after a lost response', async (t) => {
  const { post } = await paypalRegistration(t, { alreadyCaptured: true });
  assert.equal((await post('capture')).status, 200);
});

for (const [name, options, status] of [
  ['provider failure', { failCapture: true }, 502],
  ['pending capture', { captureStatus: 'PENDING' }, 409],
  ['wrong amount', { amount: '1.00' }, 409],
  ['wrong currency', { currency: 'USD' }, 409],
]) test(`${name} never marks a registration paid`, async (t) => {
  const { env, post } = await paypalRegistration(t, options);
  assert.equal((await post('capture')).status, status);
  assert.equal(env.DB.sqlite.prepare('SELECT payment_status FROM registrations').get().payment_status, 'pending');
});

test('checkout cannot grant a session to a disabled account', async (t) => {
  const { env, post } = await paypalRegistration(t);
  env.DB.sqlite.exec('UPDATE users SET is_active = 0');
  assert.equal((await post('resume')).status, 403);
  assert.equal((await post('capture')).status, 403);
});

test('untrusted approval URLs never redirect parents or create registration records', async (t) => {
  const env = { ...environment(t), ENVIRONMENT: 'test', PAYPAL_CLIENT_ID: 'test-id', PAYPAL_CLIENT_SECRET: 'test-secret', PAYPAL_MODE: 'sandbox' };
  mockPaypal(t, { approvalUrl: 'https://paypal.com.attacker.example/checkout' });
  assert.equal((await submit(env, { paymentMethod: 'paypal' })).status, 502);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM registrations').get().n, 0);
});

test('a changed fee requires confirmation before any registration or payment is created', async (t) => {
  const env = environment(t);
  const response = await submit(env, { quotedAmount: 100 });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'fees_changed');
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM users').get().n, 0);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM registrations').get().n, 0);
});

test('capture does not overwrite a concurrent refund or administrative status change', async (t) => {
  let updateStatus;
  const { env, post } = await paypalRegistration(t, { onCapture: () => updateStatus() });
  updateStatus = () => env.DB.sqlite.exec("UPDATE registrations SET payment_status = 'refunded'");
  assert.equal((await post('capture')).status, 409);
  assert.equal(env.DB.sqlite.prepare('SELECT payment_status FROM registrations').get().payment_status, 'refunded');
});
