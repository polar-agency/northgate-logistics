#!/usr/bin/env node
/**
 * Link check. PROTECTED FILE.
 *
 * Runs on the built site (dist/). Every internal link and asset (href/src) must point to a file
 * that exists, and every #anchor must match an id on the target page.
 * External links (https://, mailto:, tel:) are not fetched, to keep CI fast and reliable.
 *
 * Usage: npm run build && node scripts/link-check.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const DIST = 'dist';

if (!existsSync(DIST)) {
  console.error('No dist/ folder. Run `npm run build` first.');
  process.exit(1);
}

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

const urlFor = (file) =>
  '/' + path.relative(DIST, file).split(path.sep).join('/').replace(/(^|\/)index\.html$/, '').replace(/\.html$/, '');

// Find the file a URL path points to, the way a static host would.
function resolve(urlPath) {
  const clean = decodeURIComponent(urlPath).replace(/^\/+/, '');
  const candidates = [clean, path.join(clean, 'index.html'), `${clean}.html`];
  for (const candidate of candidates) {
    const full = path.join(DIST, candidate);
    if (existsSync(full) && statSync(full).isFile()) return full;
  }
  return undefined;
}

const idsCache = new Map();
function idsIn(file) {
  if (!idsCache.has(file)) {
    const html = readFileSync(file, 'utf8');
    idsCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idsCache.get(file);
}

const SKIP = /^(https?:|mailto:|tel:|data:|javascript:|\/\/)/i;
const problems = [];
const files = htmlFiles(DIST);
let checked = 0;

for (const file of files) {
  const page = urlFor(file);
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(/\s(href|src)="([^"]*)"/g)) {
    const value = m[2].trim();
    if (SKIP.test(value)) continue;
    checked++;
    if (value === '' || value === '#') {
      problems.push(`${page}: empty ${m[1]} ("${value}")`);
      continue;
    }
    const [target, fragment] = value.split('#');
    const absolute = target === '' ? page : new URL(target, `https://site${page.endsWith('/') ? page : `${page}/`}`).pathname;
    const targetFile = resolve(absolute);
    if (!targetFile) {
      problems.push(`${page}: broken link to ${value}`);
    } else if (fragment && targetFile.endsWith('.html') && !idsIn(targetFile).has(fragment)) {
      problems.push(`${page}: link to ${value} but there is no #${fragment} on that page`);
    }
  }
}

if (problems.length === 0) {
  console.log(`Link check passed: ${checked} internal links checked across ${files.length} pages.`);
  process.exit(0);
}

console.error(`Link check failed: ${problems.length} problem(s).\n`);
for (const problem of problems) {
  console.error(`  ${problem}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=Link check::${problem}`);
}
process.exit(1);
