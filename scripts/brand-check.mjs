#!/usr/bin/env node
/**
 * Brand check. PROTECTED FILE.
 *
 * 1. Colours and fonts may only be defined in the tokens file. Everywhere else must use var(--token).
 * 2. With --base <git ref>: no changes to protected paths, and no new page files.
 *
 * Usage:
 *   node scripts/brand-check.mjs                 # colour and font scan only
 *   node scripts/brand-check.mjs --base main     # also check what changed since main
 *
 * Settings for this site live in scripts/brand-check.config.json.
 * No dependencies, so it runs before `npm install`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const config = JSON.parse(readFileSync(new URL('./brand-check.config.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : undefined;

const SCAN_EXTENSIONS = new Set(['.astro', '.css', '.scss', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.md', '.mdx', '.html', '.svg']);

// CSS named colours (lower case). Only matched inside CSS, so words like "orange" in copy are fine.
const NAMED_COLOURS = new Set(
  ('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood ' +
    'cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray ' +
    'darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
    'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue ' +
    'firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew ' +
    'hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
    'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
    'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue ' +
    'mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred ' +
    'midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
    'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple ' +
    'rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue ' +
    'slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white ' +
    'whitesmoke yellow yellowgreen').split(' '),
);

const HEX = /(?<![\w&.])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi;
const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
const DECLARATION = /([a-z-]+)\s*:\s*([^;{}]+)/gi;
const FONT_SOURCE = /fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|@font-face|@fontsource/gi;

const problems = [];
const report = (file, line, message) => problems.push({ file, line, message });

const toPosix = (p) => p.split(path.sep).join('/');
const lineAt = (text, index) => text.slice(0, index).split('\n').length;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return SCAN_EXTENSIONS.has(path.extname(entry.name)) ? [toPosix(full)] : [];
  });
}

// Character ranges of a file that are CSS: the whole file for stylesheets,
// <style> blocks and style="" attributes for components and pages.
function cssRanges(file, text) {
  if (/\.(css|scss)$/.test(file)) return [[0, text.length]];
  const ranges = [];
  for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    ranges.push([m.index, m.index + m[0].length]);
  }
  for (const m of text.matchAll(/\bstyle\s*=\s*(?:"[^"]*"|'[^']*'|\{`[^`]*`\})/gi)) {
    ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}

const inRanges = (ranges, i) => ranges.some(([start, end]) => i >= start && i < end);

function scanFile(file) {
  const text = readFileSync(file, 'utf8');
  const colourHint = `Use a brand colour token from ${config.tokensFile} (${config.brandColours}).`;

  for (const m of text.matchAll(HEX)) {
    report(file, lineAt(text, m.index), `Colour ${m[0]} is not allowed here. ${colourHint}`);
  }
  for (const m of text.matchAll(COLOUR_FUNCTION)) {
    report(file, lineAt(text, m.index), `Colour value ${m[0]}…) is not allowed here. ${colourHint}`);
  }
  for (const m of text.matchAll(FONT_SOURCE)) {
    report(file, lineAt(text, m.index), `Fonts may only be loaded in ${config.tokensFile} (found "${m[0]}").`);
  }

  const ranges = cssRanges(file, text);
  for (const m of text.matchAll(DECLARATION)) {
    if (!inRanges(ranges, m.index)) continue;
    const [, property, value] = m;
    const line = lineAt(text, m.index);

    const named = value.toLowerCase().match(/[a-z]+/g)?.filter((word) => NAMED_COLOURS.has(word)) ?? [];
    // Skip words inside var(...) names, e.g. var(--color-navy).
    const outsideVars = value.toLowerCase().replace(/var\([^)]*\)/g, '');
    for (const word of new Set(named)) {
      if (new RegExp(`(^|[^a-z-])${word}([^a-z-]|$)`).test(outsideVars)) {
        report(file, line, `Colour "${word}" in "${property}" is not allowed. ${colourHint}`);
      }
    }

    const fontHint = `Use var(--font-…) from ${config.tokensFile} (${config.brandFonts}).`;
    if (property === 'font-family' && !/^\s*(var\(--font-[\w-]+\)|inherit)\s*$/.test(value)) {
      report(file, line, `Font "${value.trim()}" is not allowed. ${fontHint}`);
    }
    if (property === 'font' && !/^\s*inherit\s*$/.test(value) && !/var\(--font-[\w-]+\)\s*$/.test(value)) {
      report(file, line, `Font shorthand "${value.trim()}" must use a font token. ${fontHint}`);
    }
  }
}

function globToRegExp(glob) {
  const escape = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${glob.split('**').map((part) => part.split('*').map(escape).join('[^/]*')).join('.*')}$`);
}

function checkChanges(baseRef) {
  // Compare the base with the working tree, so it works on a PR checkout and on local edits.
  // --no-renames: a moved protected file shows up as a deletion.
  const output = execFileSync('git', ['diff', '--name-status', '--no-renames', baseRef], { encoding: 'utf8' });
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' });
  const changes = [
    ...output.split('\n').filter(Boolean).map((l) => l.split('\t')),
    ...untracked.split('\n').filter(Boolean).map((f) => ['A', f]),
  ];
  const protectedPatterns = config.protectedPaths.map((glob) => [glob, globToRegExp(glob)]);

  for (const [status, file] of changes) {
    const hit = protectedPatterns.find(([, re]) => re.test(file));
    if (hit) {
      report(file, 1, `This file is protected (${hit[0]}) and cannot be changed in a site edit.`);
    }
    if (status === 'A' && file.startsWith(`${config.pagesDir}/`)) {
      report(file, 1, `New page files are not allowed. ${config.newPageHint}`);
    }
  }
  return changes.length;
}

// --- run ---
const files = config.scan.flatMap((dir) => walk(dir)).filter((f) => f !== config.tokensFile);
files.forEach(scanFile);
const changed = base ? checkChanges(base) : undefined;

if (problems.length === 0) {
  console.log(`Brand check passed for ${config.site}: ${files.length} files scanned` +
    (base ? `, ${changed} changed files checked against ${base}.` : '.'));
  process.exit(0);
}

console.error(`Brand check failed for ${config.site}: ${problems.length} problem(s).\n`);
for (const { file, line, message } of problems) {
  console.error(`  ${file}:${line}  ${message}`);
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::error file=${file},line=${line},title=Brand check::${message}`);
  }
}
process.exit(1);
