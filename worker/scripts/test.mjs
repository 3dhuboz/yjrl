import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Reuse Wrangler's installed bundler; this does not invoke Wrangler or Cloudflare.
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('wrangler/package.json'))('esbuild');
const root = fileURLToPath(new URL('../', import.meta.url));
const outfile = `${root}.wrangler/tests/registration.test.mjs`;
await build({
  entryPoints: [`${root}tests/registration.test.mjs`],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const result = spawnSync(process.execPath, ['--test', outfile], { cwd: root, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
