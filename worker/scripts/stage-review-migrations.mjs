import { mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../migrations/', import.meta.url));
const target = fileURLToPath(new URL('../.wrangler/review-migrations/', import.meta.url));
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
const files = readdirSync(source).filter(file => file.endsWith('.sql') && file !== '0002_seed.sql').sort();
for (const file of files) copyFileSync(`${source}/${file}`, `${target}/${file}`);
console.log(`Staged ${files.length} schema migrations without the production seed.`);
