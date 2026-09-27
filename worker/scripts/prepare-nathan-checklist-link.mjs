// Operator-only provisioning for Steve's explicitly requested private handover link.
// Outputs SQL with a token hash only. Never prints or commits the raw private link.
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
const directory = '/home/steve/.local/share/yjrl';
const file = `${directory}/nathan-checklist-link.json`;
mkdirSync(directory, { recursive: true, mode: 0o700 });
let invitation;
if (existsSync(file)) invitation = JSON.parse(readFileSync(file, 'utf8'));
else {
  const token = randomBytes(32).toString('hex');
  invitation = { id: randomUUID(), token, url: `https://yjrl.pages.dev/website-checklist#access=${token}`, expiresAt: new Date(Date.now() + 90 * 86400000).toISOString() };
  writeFileSync(file, JSON.stringify(invitation, null, 2), { mode: 0o600 });
}
if (!/^[a-f0-9-]{36}$/.test(invitation.id) || !/^[a-f0-9]{64}$/.test(invitation.token) || !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(invitation.expiresAt)) throw new Error('Invalid stored invite; stop and inspect without exposing its token.');
chmodSync(file, 0o600);
const digest = createHash('sha256').update(invitation.token).digest('hex');
mkdirSync('.wrangler', { recursive: true });
writeFileSync('.wrangler/nathan-checklist-invite.sql', `INSERT OR IGNORE INTO checklist_links(id, label, token_hash, expires_at) VALUES ('${invitation.id}', 'Nathan', '${digest}', '${invitation.expiresAt}');\nINSERT INTO audit_log(user_id, user_name, action, entity_type, entity_id, details) SELECT 'system', 'Website setup', 'checklist_link_created', 'checklist_link', '${invitation.id}', '{"label":"Nathan","source":"Steve requested private checklist handover"}' WHERE NOT EXISTS (SELECT 1 FROM audit_log WHERE action = 'checklist_link_created' AND entity_id = '${invitation.id}');\n`, { mode: 0o600 });
console.log(`Prepared hashed invite SQL; private link saved outside Git. Expires ${invitation.expiresAt.slice(0, 10)}.`);
