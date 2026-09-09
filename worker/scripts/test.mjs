import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Reuse Wrangler's installed bundler; this does not invoke Wrangler or Cloudflare.
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('wrangler/package.json'))('esbuild');
const root = fileURLToPath(new URL('../', import.meta.url));
const entries = ['registration.test.mjs', 'media.test.mjs', 'rateLimit.test.mjs', 'adultAccounts.test.mjs', 'launch.test.mjs', 'review.test.mjs', 'adminContent.test.mjs', 'shop.test.mjs', 'maps.test.mjs', 'stock.test.mjs', 'communication.test.mjs', 'checklist.test.mjs'];
const outdir = `${root}.wrangler/tests`;
await build({
  entryPoints: entries.map(file => `${root}tests/${file}`),
  outdir,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const result = spawnSync(process.execPath, ['--test', ...entries.map(file => `${outdir}/${file}`)], { cwd: root, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
