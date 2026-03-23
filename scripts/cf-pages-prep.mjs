import { copyFileSync, cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const openNext = join(root, ".open-next");
const worker = join(openNext, "worker.js");
const target = join(openNext, "_worker.js");
const assets = join(openNext, "assets");

if (!existsSync(worker)) {
  console.error("cf-pages-prep: missing .open-next/worker.js (run opennext build first)");
  process.exit(1);
}

copyFileSync(worker, target);
console.log("cf-pages-prep: copied .open-next/worker.js → .open-next/_worker.js (Cloudflare Pages advanced mode)");

/**
 * With `_worker.js`, Cloudflare Pages invokes the Worker on **every** route by default, so
 * `/_next/static/*` never hits plain static files and the UI is blank unless the Worker serves ASSETS.
 * Excluding static paths lets Pages serve hashed JS/CSS from the upload (mirrored under `.open-next/`).
 * @see https://developers.cloudflare.com/pages/functions/routing/
 */
const routesPath = join(openNext, "_routes.json");
const routes = {
  version: 1,
  include: ["/*"],
  exclude: [
    "/_next/static/*",
    "/_next/image*",
    "/images/*",
    "/data/*",
    "/favicon.ico",
    "/sw.js",
    "/offline.html",
  ],
};
writeFileSync(routesPath, `${JSON.stringify(routes, null, 2)}\n`);
console.log("cf-pages-prep: wrote _routes.json (static assets bypass Worker)");

/**
 * Backup: when a request still hits the Worker, OpenNext must call `env.ASSETS.fetch()`.
 * Default `run_worker_first` is false, which skips that path on Pages. Force true if still false.
 */
const initPath = join(openNext, "cloudflare", "init.js");
if (!existsSync(initPath)) {
  console.error("cf-pages-prep: missing .open-next/cloudflare/init.js");
  process.exit(1);
}
let initSrc = readFileSync(initPath, "utf8");
if (/\b__ASSETS_RUN_WORKER_FIRST__\s*:\s*true\b/.test(initSrc)) {
  console.log("cf-pages-prep: __ASSETS_RUN_WORKER_FIRST__ already true");
} else if (/\b__ASSETS_RUN_WORKER_FIRST__\s*:\s*false\b/.test(initSrc)) {
  initSrc = initSrc.replace(
    /\b__ASSETS_RUN_WORKER_FIRST__\s*:\s*false\b/g,
    "__ASSETS_RUN_WORKER_FIRST__: true",
  );
  writeFileSync(initPath, initSrc);
  console.log(
    "cf-pages-prep: __ASSETS_RUN_WORKER_FIRST__ → true (OpenNext ASSETS.fetch fallback)",
  );
} else {
  console.error(
    "cf-pages-prep: could not find __ASSETS_RUN_WORKER_FIRST__ in cloudflare/init.js — OpenNext changed; fix cf-pages-prep.mjs",
  );
  process.exit(1);
}

/**
 * Cloudflare Pages serves static files from the *root* of `pages_build_output_dir`.
 * OpenNext puts hashed JS/CSS under `.open-next/assets/_next/`, which maps to URL
 * `/assets/_next/...` — but the HTML references `/_next/static/...`, so the UI breaks.
 * Copy public build output to `.open-next/` root so `/_next/static/*` and `/images/*` resolve.
 * (Workers deploy only bundles `.open-next/assets`; extra files under `.open-next/` are ignored.)
 */
/** Tracker + proxy-print: JSON served as static files (Workers have no real filesystem). */
const dataSrc = join(root, "data");
if (existsSync(dataSrc)) {
  cpSync(dataSrc, join(openNext, "data"), { recursive: true });
  console.log("cf-pages-prep: copied data/ → .open-next/data (static JSON for edge)");
}

if (existsSync(assets)) {
  const copyDir = (from, to) => {
    if (!existsSync(from)) return;
    cpSync(from, to, { recursive: true });
  };
  copyDir(join(assets, "_next"), join(openNext, "_next"));
  copyDir(join(assets, "images"), join(openNext, "images"));
  for (const file of ["BUILD_ID", "_headers", "sw.js", "offline.html"]) {
    const src = join(assets, file);
    if (existsSync(src)) {
      copyFileSync(src, join(openNext, file));
    }
  }
  console.log(
    "cf-pages-prep: mirrored assets → .open-next root (/_next/static, /images, _headers for Pages)",
  );
}
