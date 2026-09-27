import { mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../migrations/', import.meta.url));
const target = fileURLToPath(new URL('../.wrangler/production-migrations/', import.meta.url));
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
// Production already has 0001/0003's schema but its historical journal is empty.
const files = readdirSync(source).filter(file => /^\d{4}_.*\.sql$/.test(file) && Number(file.slice(0, 4)) >= 4).sort();
for (const file of files) copyFileSync(`${source}/${file}`, `${target}/${file}`);
console.log(`Staged ${files.length} incremental migrations, excluding historical schema and seed.`);
