import { cpSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../../client/build/', import.meta.url));
const target = fileURLToPath(new URL('../.wrangler/review-assets/', import.meta.url));
for (const file of readdirSync(`${source}/assets`).filter(file => file.endsWith('.js'))) {
  if (readFileSync(`${source}/assets/${file}`, 'utf8').includes('yjrl-api.steve-700.workers.dev')) {
    throw new Error('Refusing a review build that references the production API. Build with VITE_API_URL=/api.');
  }
}
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
// Workers Assets supplies SPA routing. The Pages wildcard rewrite loops here.
rmSync(`${target}/_redirects`, { force: true });
console.log('Staged same-origin review assets with Worker SPA routing.');
