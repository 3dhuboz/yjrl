// Reviewed club information supplied through Nathan's private checklist on 15 September.
// Produces idempotent SQL: new unpublished drafts only, no guessed prices/stock or account grants.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const club = JSON.parse(readFileSync('../shared/club.json', 'utf8'));
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const products = [
  ['f5a6f34d-691f-4e4c-9af3-a67f74b4b3a1', 'Club polos', 'uniform', 'Kids size 4 through to adult 7XL. Exact supplier sizes, price, photo and stock counts to be confirmed.', ['Sizes to confirm']],
  ['f5a6f34d-691f-4e4c-9af3-a67f74b4b3a2', 'Training shorts', 'uniform', 'Kids size 4 through to adult 3XL. Exact supplier sizes, price, photo and stock counts to be confirmed.', ['Sizes to confirm']],
  ['f5a6f34d-691f-4e4c-9af3-a67f74b4b3a3', 'CTC trucker caps', 'merchandise', 'Price, photo, size details and stock count to be confirmed.', ['Sizes to confirm']],
  ['f5a6f34d-691f-4e4c-9af3-a67f74b4b3a4', 'Bucket hats', 'merchandise', 'Kids and adult sizes. Price, photos and stock counts to be confirmed.', ['Kids', 'Adult']],
];
const sql = products.flatMap(([id, name, category, description, options]) => [
  `INSERT INTO shop_products(id, name, category, description, options, price_cents, available, published) SELECT ${[id, name, category, description, JSON.stringify(options)].map(quote).join(', ')}, 0, 0, 0 WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE id = ${quote(id)} OR (lower(trim(name)) = ${quote(name.toLowerCase())} AND is_active = 1));`,
  `INSERT INTO audit_log(user_id, user_name, action, entity_type, entity_id, details) SELECT 'system', 'Website setup', 'nathan_product_draft_added', 'shop_product', ${quote(id)}, '{"source":"Nathan checklist 15 September; Steve authorised application 27 September"}' WHERE EXISTS (SELECT 1 FROM shop_products WHERE id = ${quote(id)}) AND NOT EXISTS (SELECT 1 FROM audit_log WHERE action = 'nathan_product_draft_added' AND entity_id = ${quote(id)});`,
]);
sql.push(`UPDATE shop_settings SET policies = ${quote(club.exchangePolicy)} WHERE id = 1 AND trim(policies) = '';`);
sql.push(`UPDATE shop_settings SET online_enabled = 0 WHERE id = 1 AND orders_open = 0 AND NOT EXISTS (SELECT 1 FROM shop_orders WHERE status = 'placed');`);
sql.push(`INSERT INTO audit_log(user_id, user_name, action, entity_type, entity_id, details) SELECT 'system', 'Website setup', 'nathan_content_applied', 'club', '2027-checklist-september', '{"source":"Steve authorised application 27 September","square":"requested; connection pending","publicOrdering":"kept closed","executiveAdmins":"Secretary, President, Treasurer; named accounts/access checks pending"}' WHERE NOT EXISTS (SELECT 1 FROM audit_log WHERE action = 'nathan_content_applied' AND entity_id = '2027-checklist-september');`);
mkdirSync('.wrangler', { recursive: true });
writeFileSync('.wrangler/nathan-content.sql', sql.join('\n') + '\n');
console.log('Prepared four unpublished drafts, exchange guidance and audit entries. No prices, stock quantities, accounts or opening flags invented.');
