import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import register from '../src/routes/register.ts';
import players from '../src/routes/players.ts';
import { validateRegistrationFees, registrationFee } from '../../client/src/registrationFees.mjs';

function database(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  for (const file of ['0001_schema.sql', '0003_child_safety.sql']) {
    sqlite.exec(readFileSync(`migrations/${file}`, 'utf8'));
  }
  function prepare(sql, args = []) {
    return {
      bind: (...values) => prepare(sql, values),
      first: async () => sqlite.prepare(sql).get(...args) ?? null,
      all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
      run: async () => ({ success: true, meta: sqlite.prepare(sql).run(...args) }),
    };
  }
  return {
    sqlite,
    prepare,
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
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
  agreeToTerms: true, agreeToPhotoPolicy: false, paymentMethod: 'offline',
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
  env.DB.sqlite.exec("UPDATE registrations SET season = '2026'; UPDATE players SET registration_year = '2026'");
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
