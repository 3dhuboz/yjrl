import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { SignJWT } from 'jose';
import adultAccount from '../../shared/adultAccount.json';

function database(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  for (const file of ['0001_schema.sql', '0003_child_safety.sql', '0004_registration_claims.sql', '0005_child_access_log.sql', '0006_reviewed_media.sql', '0007_rate_limits.sql', '0008_adult_accounts.sql', '0009_venue_maps.sql', '0010_shop.sql', '0011_shop_stock.sql', '0012_stock_ordering.sql', '0013_team_communication.sql', '0014_website_checklist.sql']) {
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
  return { DB: database(t), JWT_SECRET: 'local-test-secret-only', ENVIRONMENT: 'production',
    REGISTRATIONS_OPEN: 'true', MEMBER_ACCESS_OPEN: 'true', SEASON_DETAILS_CONFIRMED: '2027', CHILD_SAFETY_SIGNOFF: 'approved' };
}

async function actor(env, id, role) {
  env.DB.sqlite.prepare('INSERT INTO users (id, first_name, last_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, 'PrivateAdult', 'PrivateSurname', `${id}@example.test`, 'unused-test-hash', role);
  if (role !== 'player') env.DB.sqlite.prepare("UPDATE users SET adult_attested_at = datetime('now'), adult_attestation_version = ? WHERE id = ?").run(adultAccount.version, id);
  if (role === 'coach') {
    env.DB.sqlite.prepare("INSERT INTO adult_role_approvals (id, user_id, requested_role, status, blue_card_status, blue_card_expiry, identity_checked, safeguarding_training_completed) VALUES (?, ?, 'coach', 'approved', 'verified', ?, 1, 1)")
      .run(`approval-${id}`, id, new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  }
  const token = await new SignJWT({ sub: id }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode(env.JWT_SECRET));
  return { Authorization: `Bearer ${token}` };
}

export { database, environment, actor };
