import { environment, actor } from './support.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import register from '../src/routes/register.ts';
import players from '../src/routes/players.ts';
import chat from '../src/routes/chat.ts';
import admin from '../src/routes/admin.ts';
import fixtures from '../src/routes/fixtures.ts';
import upload from '../src/routes/upload.ts';
import { validateRegistrationFees, registrationFee } from '../../client/src/registrationFees.mjs';
import { handleUnauthorized } from '../../client/src/apiErrors.mjs';
import { checkoutFromSearch, confirmationEmailMessage } from '../../client/src/registrationCheckout.mjs';

const form = {
  season: '2027', firstName: 'Test', lastName: 'Player', dateOfBirth: '2018-03-05',
  ageGroup: 'U9', email: 'guardian@example.test', password: 'test-password-only',
  adultConfirmed: true,
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

test('photo consent does not also create public profile or public statistics consent', async (t) => {
  const env = environment(t);
  assert.equal((await submit(env, { agreeToPhotoPolicy: true })).status, 201);
  const row = env.DB.sqlite.prepare('SELECT media_consent, public_profile_consent, stats_public_consent FROM player_consents').get();
  assert.equal(row.media_consent, 1);
  assert.equal(row.public_profile_consent, 0);
  assert.equal(row.stats_public_consent, 0);
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
  const failures = JSON.stringify(env.DB.sqlite.prepare("SELECT details FROM audit_log WHERE action = 'email_failed'").all());
  assert.ok(!failures.includes(form.email));
  assert.ok(!failures.includes(env.ADMIN_EMAIL));
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

test('offline registration notices use references without child or guardian details', async (t) => {
  const env = { ...environment(t), RESEND_API_KEY: 'test-only', FROM_EMAIL: 'club@example.test', ADMIN_EMAIL: 'admin@example.test' };
  const notices = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://api.resend.com/emails');
    notices.push(JSON.parse(init.body));
    return Response.json({ id: 'fake-email' });
  });
  const body = await (await submit(env, { firstName: 'PrivateJunior', lastName: 'ConfidentialFamily', medicalNotes: 'Private medical note' })).json();
  assert.equal(body.emailStatus, 'sent');
  assert.equal(notices.length, 2);
  for (const notice of notices) {
    const content = notice.subject + notice.html;
    assert.ok(content.includes(body.registrationId));
    assert.match(content, /2027/);
    for (const privateValue of ['PrivateJunior', 'ConfidentialFamily', form.ageGroup, form.dateOfBirth, form.guardianName, form.guardianPhone, form.emergencyContact.name, 'Private medical note']) {
      assert.ok(!content.includes(privateValue), privateValue);
    }
  }
});

test('PayPal orders and paid email content contain a reference, not child details', async (t) => {
  const { env, mock, body, post } = await paypalRegistration(t);
  const checkout = JSON.stringify(mock.checkout());
  assert.ok(checkout.includes(body.registrationId));
  for (const privateValue of [form.firstName, form.lastName, form.ageGroup, form.dateOfBirth, form.guardianName, form.guardianPhone]) {
    assert.ok(!checkout.includes(privateValue), privateValue);
  }
  env.RESEND_API_KEY = 'test-only'; env.FROM_EMAIL = 'club@example.test'; env.ADMIN_EMAIL = 'admin@example.test';
  assert.equal((await post('capture')).status, 200);
  const notices = mock.calls.filter(call => call.url === 'https://api.resend.com/emails');
  assert.equal(notices.length, 2);
  for (const { init } of notices) {
    const notice = JSON.parse(init.body);
    const content = notice.subject + notice.html;
    assert.ok(content.includes(body.registrationId));
    for (const privateValue of [`${form.firstName} ${form.lastName}`, form.ageGroup, form.dateOfBirth, form.guardianName, form.guardianPhone]) {
      assert.ok(!content.includes(privateValue), privateValue);
    }
  }
});

async function privatePlayer(t) {
  const env = environment(t);
  const saved = await (await submit(env, { medicalNotes: 'Private medical note' })).json();
  const player = env.DB.sqlite.prepare('SELECT * FROM players').get();
  return { env, player, parent: { Authorization: `Bearer ${saved.token}` } };
}

test('player accounts cannot use direct ownership or a stored link to read parent details or parent chat', async (t) => {
  const { env, player, parent } = await privatePlayer(t);
  const junior = await actor(env, 'junior', 'player');
  env.DB.sqlite.exec("INSERT INTO teams (id, name, age_group) VALUES ('team-test', 'Team', 'U9')");
  env.DB.sqlite.prepare("UPDATE players SET user_id = 'junior', team_id = 'team-test' WHERE id = ?").run(player.id);
  env.DB.sqlite.prepare("INSERT INTO parent_child_links (id, parent_user_id, player_id, status) VALUES ('invalid-link', 'junior', ?, 'verified')").run(player.id);
  const denied = await players.request('/my-children', { headers: junior }, env);
  assert.equal(denied.status, 403);
  assert.ok(!(await denied.text()).includes('Private medical note'));
  assert.equal((await chat.request('/?room_id=parent:team-test', { headers: junior }, env)).status, 403);
  assert.equal((await chat.request('/?room_id=parent:team-test', { headers: parent }, env)).status, 200);
  for (const path of ['/my-player', `/${player.id}`]) {
    const response = await players.request(path, { headers: junior }, env);
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const profile = await response.json();
    assert.equal(profile.firstName, undefined);
    for (const field of ['medicalNotes', 'dateOfBirth', 'guardianEmail', 'emergencyContact']) assert.equal(profile[field], undefined);
  }
});

test('verified guardians can read their children, and unrelated or revoked links cannot', async (t) => {
  const { env, player, parent } = await privatePlayer(t);
  const stranger = await actor(env, 'unrelated-parent', 'parent');
  for (const path of ['/my-children', `/${player.id}`]) {
    const response = await players.request(path, { headers: parent }, env);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal((Array.isArray(body) ? body[0] : body).medicalNotes, 'Private medical note');
  }
  assert.equal((await players.request(`/${player.id}`, { headers: stranger }, env)).status, 403);
  assert.deepEqual(await (await players.request('/my-children', { headers: stranger }, env)).json(), []);
  env.DB.sqlite.prepare("INSERT INTO parent_child_links (id, parent_user_id, player_id, status) VALUES ('revoked-link', 'unrelated-parent', ?, 'revoked')").run(player.id);
  assert.equal((await players.request(`/${player.id}`, { headers: stranger }, env)).status, 403);
  assert.equal((await players.request(`/${player.id}`, {}, env)).status, 401);
});

test('coach reads stay within the assigned team and medical notes stay out of bulk admin rosters', async (t) => {
  const { env, player } = await privatePlayer(t);
  const coach = await actor(env, 'coach-one', 'coach');
  const anotherCoach = await actor(env, 'coach-two', 'coach');
  const administrator = await actor(env, 'admin', 'admin');
  env.DB.sqlite.exec("INSERT INTO teams (id, name, age_group, coach_id) VALUES ('team-test', 'Team', 'U9', 'coach-one')");
  env.DB.sqlite.prepare("UPDATE players SET team_id = 'team-test', coach_notes = 'Coach test note' WHERE id = ?").run(player.id);
  for (const path of ['/', '/my-team', `/${player.id}`]) {
    const response = await players.request(path, { headers: coach }, env);
    assert.equal(response.status, 200);
    const body = await response.json();
    const profile = Array.isArray(body) ? body[0] : body.players ? body.players[0] : body;
    assert.equal(profile.id, player.id);
    assert.equal(profile.medicalNotes, undefined);
    assert.equal(profile.guardianPhone, undefined);
  }
  assert.equal((await players.request(`/${player.id}`, { headers: anotherCoach }, env)).status, 403);
  assert.deepEqual(await (await players.request('/', { headers: anotherCoach }, env)).json(), []);
  const roster = await (await players.request('/', { headers: administrator }, env)).json();
  assert.equal(roster[0].medicalNotes, undefined);
  const detail = await (await players.request(`/${player.id}`, { headers: administrator }, env)).json();
  assert.equal(detail.medicalNotes, 'Private medical note');
  const events = env.DB.sqlite.prepare('SELECT * FROM child_access_log').all();
  assert.deepEqual(events.map(event => event.action), ['player_list', 'coach_team', 'player_detail', 'player_list', 'player_list', 'player_detail']);
  assert.deepEqual(events.map(event => event.data_scope), ['coach', 'coach', 'coach', 'coach', 'admin_roster', 'admin']);
  assert.deepEqual(JSON.parse(events[0].player_ids), [player.id]);
  const logged = JSON.stringify(events);
  for (const privateValue of ['Private medical note', 'PrivateAdult', 'PrivateSurname', form.guardianEmail, form.guardianPhone, form.dateOfBirth, 'Coach test note']) assert.ok(!logged.includes(privateValue), privateValue);
});

test('every player read withholds details when its access record cannot be saved', async (t) => {
  const { env, player, parent } = await privatePlayer(t);
  const coach = await actor(env, 'coach', 'coach');
  const administrator = await actor(env, 'admin', 'admin');
  env.DB.sqlite.exec("INSERT INTO teams (id, name, age_group, coach_id) VALUES ('team-test', 'Team', 'U9', 'coach')");
  env.DB.sqlite.prepare("UPDATE players SET team_id = 'team-test' WHERE id = ?").run(player.id);
  env.DB.sqlite.exec("CREATE TRIGGER reject_access_insert BEFORE INSERT ON child_access_log BEGIN SELECT RAISE(ABORT, 'Simulated write failure'); END");
  for (const [path, headers] of [['/', administrator], ['/my-player', parent], ['/my-children', parent], ['/my-team', coach], [`/${player.id}`, parent]]) {
    const response = await players.request(path, { headers }, env);
    assert.equal(response.status, 503, path);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const content = await response.text();
    assert.ok(!content.includes(player.id));
    assert.ok(!content.includes('Private medical note'));
  }
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM child_access_log').get().n, 0);
  env.DB.sqlite.exec('DROP TRIGGER reject_access_insert');
  assert.equal((await players.request('/my-children', { headers: parent }, env)).status, 200);
});

test('access events survive attempted update, deletion and replacement', async (t) => {
  const { env, parent } = await privatePlayer(t);
  assert.equal((await players.request('/my-children', { headers: parent }, env)).status, 200);
  const original = env.DB.sqlite.prepare('SELECT * FROM child_access_log').get();
  for (const sql of [
    "UPDATE child_access_log SET actor_user_id = 'changed'",
    'DELETE FROM child_access_log',
    "INSERT OR REPLACE INTO child_access_log (id, actor_user_id, actor_role, action, player_ids, data_scope) VALUES (1, 'changed', 'admin', 'player_list', '[]', 'admin')",
  ]) assert.throws(() => env.DB.sqlite.exec(sql), /append-only/);
  assert.deepEqual(env.DB.sqlite.prepare('SELECT * FROM child_access_log').get(), original);
});

test('readiness requires the access log and each append-only guard', async (t) => {
  const env = { ...environment(t), UPLOADS: { list: async () => ({ objects: [] }) } };
  const headers = await actor(env, 'admin', 'admin');
  const accessCheck = async () => {
    const response = await admin.request('/readiness', { headers }, env);
    assert.equal(response.status, 200);
    return (await response.json()).checks.find(check => check.id === 'child_access_log');
  };
  assert.equal((await accessCheck()).status, 'pass');
  env.DB.sqlite.exec('DROP TRIGGER child_access_log_no_replace');
  assert.equal((await accessCheck()).status, 'fail');
  env.DB.sqlite.exec('DROP TABLE child_access_log');
  assert.equal((await accessCheck()).status, 'fail');
});

test('existing coach sessions lose team privileges when approval expires or becomes incomplete', async (t) => {
  const { env, player } = await privatePlayer(t);
  const headers = await actor(env, 'coach', 'coach');
  env.DB.sqlite.exec("INSERT INTO teams (id, name, age_group, coach_id) VALUES ('team-test', 'Team', 'U9', 'coach')");
  env.DB.sqlite.prepare("UPDATE players SET team_id = 'team-test' WHERE id = ?").run(player.id);
  env.DB.sqlite.exec("INSERT INTO fixtures (id, team_id, age_group, season, round, home_team_name, away_team_name, date) VALUES ('fixture-test', 'team-test', 'U9', '2027', 1, 'Test club', 'Test opposition', '2027-05-01')");
  assert.equal((await players.request('/my-team', { headers }, env)).status, 200);
  assert.equal((await chat.request('/?room_id=coach-all', { headers }, env)).status, 200);
  for (const invalid of [
    "status = 'suspended'", "status = 'pending'", "status = 'expired'",
    "blue_card_status = 'not-provided'", "blue_card_expiry = '2000-01-01'", 'blue_card_expiry = NULL',
    'identity_checked = 0', 'safeguarding_training_completed = 0',
  ]) {
    env.DB.sqlite.exec("UPDATE adult_role_approvals SET status = 'approved', blue_card_status = 'verified', blue_card_expiry = '2099-01-01', identity_checked = 1, safeguarding_training_completed = 1");
    env.DB.sqlite.exec(`UPDATE adult_role_approvals SET ${invalid}`);
    for (const path of ['/', '/my-team', `/${player.id}`]) assert.equal((await players.request(path, { headers }, env)).status, 403, `${invalid}: ${path}`);
    for (const room of ['coach-all', 'parent:team-test']) assert.equal((await chat.request(`/?room_id=${room}`, { headers }, env)).status, 403, `${invalid}: ${room}`);
    assert.equal((await players.request(`/${player.id}`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ coachNotes: 'Unauthorised change' }) }, env)).status, 403);
    assert.equal((await fixtures.request('/fixture-test', { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: 'Unauthorised change' }) }, env)).status, 403);
    assert.equal((await upload.request('/', { method: 'POST', headers }, env)).status, 403);
  }
  env.DB.sqlite.exec('DELETE FROM adult_role_approvals');
  assert.equal((await players.request('/my-team', { headers }, env)).status, 403);
  assert.notEqual(env.DB.sqlite.prepare('SELECT coach_notes FROM players').get().coach_notes, 'Unauthorised change');
  // An independently verified guardian link still permits access to their own child.
  env.DB.sqlite.prepare("INSERT INTO parent_child_links (id, parent_user_id, player_id, status) VALUES ('coach-parent', 'coach', ?, 'verified')").run(player.id);
  const children = await players.request('/my-children', { headers }, env);
  assert.equal(children.status, 200);
  assert.equal((await children.json())[0].medicalNotes, 'Private medical note');
  assert.equal((await chat.request('/?room_id=parent:team-test', { headers }, env)).status, 200);
  assert.equal((await chat.request('/?room_id=coach-all', { headers }, env)).status, 403);
});
