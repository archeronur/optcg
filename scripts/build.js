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
  /**
   * next-on-pages internally runs `vercel build`, which in turn executes `npm run build`.
   * If our build script itself calls next-on-pages, that becomes recursive and fails with:
   *   "vercel build must not recursively invoke itself"
   *
   * We avoid that by:
   * - outer Cloudflare build: run next-on-pages and set an env marker
   * - inner build (triggered by vercel build): run plain next build
   */
  if (process.env.NEXT_ON_PAGES_INNER_BUILD === '1') {
    console.log('[build] Cloudflare inner build detected. Running `next build`...');
    run('next', ['build']);
  } else {
    console.log('[build] Detected Cloudflare Pages environment. Running `next-on-pages`...');
    // Re-run this same build script as part of `vercel build`, but in "inner build" mode.
    process.env.NEXT_ON_PAGES_INNER_BUILD = '1';
    run('next-on-pages', []);
  }
} else {
  console.log('[build] Non-Cloudflare environment. Running `next build`...');
  run('next', ['build']);
}

