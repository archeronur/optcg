/* eslint-disable no-console */
const { spawnSync } = require('node:child_process');

/**
 * Cloudflare Pages by default runs `npm run build`.
 * This project requires `next-on-pages` to generate `.vercel/output/static`.
 *
 * Locally (and for non-CF environments), we keep `next build` behaviour intact.
 */
function isCloudflarePages() {
  // Cloudflare Pages provides these in CI
  return Boolean(process.env.CF_PAGES || process.env.CF_PAGES_URL || process.env.CF_PAGES_COMMIT_SHA);
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (isCloudflarePages()) {
  console.log('[build] Detected Cloudflare Pages environment. Running `next-on-pages`...');
  run('next-on-pages', []);
} else {
  console.log('[build] Non-Cloudflare environment. Running `next build`...');
  run('next', ['build']);
}

