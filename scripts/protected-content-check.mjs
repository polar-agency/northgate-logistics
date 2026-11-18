#!/usr/bin/env node
/**
 * Protected content check. PROTECTED FILE.
 *
 * Runs on the built site (dist/) and makes sure required content is still on the right pages,
 * e.g. a legal footer on every page. Rules live in scripts/brand-check.config.json > requiredContent.
 *
 * Usage: npm run build && node scripts/protected-content-check.mjs
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const config = JSON.parse(readFileSync(new URL('./brand-check.config.json', import.meta.url), 'utf8'));

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

// dist/about/index.html -> /about ; dist/index.html -> /
const urlFor = (file) =>
  '/' + path.relative(DIST, file).split(path.sep).join('/').replace(/(^|\/)index\.html$/, '').replace(/\.html$/, '');

const pages = new Map(htmlFiles(DIST).map((file) => [urlFor(file), readFileSync(file, 'utf8')]));
const problems = [];

for (const rule of config.requiredContent ?? []) {
  const targets = rule.pages === 'all' ? [...pages.keys()] : rule.pages;
  for (const url of targets) {
    const html = pages.get(url);
    if (html === undefined) {
      problems.push(`${rule.name}: page ${url} is missing from the site.`);
    } else if (!html.includes(rule.contains)) {
      problems.push(`${rule.name}: missing or changed on ${url}.`);
    }
  }
}

if (problems.length === 0) {
  const rules = (config.requiredContent ?? []).map((r) => r.name).join(', ') || 'none';
  console.log(`Protected content check passed: ${pages.size} pages checked (${rules}).`);
  process.exit(0);
}

console.error(`Protected content check failed: ${problems.length} problem(s).\n`);
for (const problem of problems) {
  console.error(`  ${problem}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=Protected content::${problem}`);
}
process.exit(1);
