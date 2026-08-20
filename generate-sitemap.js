#!/usr/bin/env node
/**
 * generate-sitemap.js — TopDividendETFs.com
 *
 * Scans the repo for .html files and writes sitemap.xml.
 *
 * The important part: for each page it reads that page's OWN <link rel="canonical">
 * and puts THAT url in the sitemap. A sitemap that lists a url the page itself
 * canonicals away from is worse than no sitemap at all — it tells Google to crawl
 * a url that then says "actually, index a different one."
 *
 * Pages with no canonical tag fall back to the extensionless path.
 * Pages marked noindex are skipped.
 *
 * Run:  node generate-sitemap.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SITE = 'https://topdividendetfs.com';
const ROOT = process.cwd();
const OUT = path.join(ROOT, 'sitemap.xml');

// Files/directories never included in the sitemap.
const EXCLUDE_FILES = new Set([
  '404.html',
  'google-verification.html',
]);
const EXCLUDE_DIRS = new Set([
  '.git', '.github', 'node_modules', 'assets', 'img', 'images', 'css', 'js', 'scripts',
]);

// Thin/legal pages still get indexed but shouldn't outrank content.
const LOW_PRIORITY = /(privacy-policy|terms-of-use|thank-you|contact)/i;

function walk(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(full, found);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      if (EXCLUDE_FILES.has(entry.name)) continue;
      found.push(full);
    }
  }
  return found;
}

function readCanonical(html) {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i);
  if (!m) return null;
  const href = m[0].match(/href=["']([^"']+)["']/i);
  return href ? href[1].trim() : null;
}

function isNoIndex(html) {
  const m = html.match(/<meta[^>]+name=["']robots["'][^>]*>/i);
  return !!(m && /noindex/i.test(m[0]));
}

// Extensionless url, matching GitHub Pages' clean-url serving.
function fallbackUrl(file) {
  let rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (rel === 'index.html') return SITE + '/';
  rel = rel.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  return SITE + '/' + rel;
}

function lastModified(file) {
  try {
    const d = execSync(`git log -1 --format=%cI -- "${file}"`, {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
    if (d) return d.slice(0, 10);
  } catch (_) { /* not a git checkout, or file untracked */ }
  return fs.statSync(file).mtime.toISOString().slice(0, 10);
}

function priorityFor(url, file) {
  if (url === SITE + '/' || url === SITE) return '1.0';
  if (LOW_PRIORITY.test(url)) return '0.3';
  if (/blog\/?$/.test(url)) return '0.8';
  return '0.7';
}

function changefreqFor(url) {
  if (url === SITE + '/' || url === SITE) return 'daily';
  if (LOW_PRIORITY.test(url)) return 'yearly';
  return 'weekly';
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function main() {
  const files = walk(ROOT).sort();
  const bySeen = new Map();      // canonical url -> entry (dedupes .html + extensionless)
  const skipped = [];
  const noCanonical = [];

  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).split(path.sep).join('/');

    if (isNoIndex(html)) { skipped.push(`${rel} (noindex)`); continue; }

    let url = readCanonical(html);
    if (!url) { url = fallbackUrl(file); noCanonical.push(rel); }

    url = url.replace(/\/+$/, m => (url === SITE + '/' ? m : '')); // trim trailing slash except root
    if (url === SITE) url = SITE + '/';

    const entry = {
      url,
      lastmod: lastModified(file),
      changefreq: changefreqFor(url),
      priority: priorityFor(url, file),
      source: rel,
    };

    // If two files canonical to the same url, keep the most recently modified.
    const prev = bySeen.get(url);
    if (!prev || entry.lastmod > prev.lastmod) bySeen.set(url, entry);
  }

  const entries = [...bySeen.values()].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority.localeCompare(a.priority);
    return a.url.localeCompare(b.url);
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(e => [
      '  <url>',
      `    <loc>${esc(e.url)}</loc>`,
      `    <lastmod>${e.lastmod}</lastmod>`,
      `    <changefreq>${e.changefreq}</changefreq>`,
      `    <priority>${e.priority}</priority>`,
      '  </url>',
    ].join('\n')),
    '</urlset>',
    '',
  ].join('\n');

  fs.writeFileSync(OUT, xml, 'utf8');

  console.log(`sitemap.xml written — ${entries.length} urls from ${files.length} html files`);
  if (noCanonical.length) {
    console.log(`\n  ${noCanonical.length} page(s) had NO canonical tag (used extensionless fallback):`);
    noCanonical.forEach(f => console.log(`    - ${f}`));
    console.log('  Add a <link rel="canonical"> to these so the sitemap stops guessing.');
  }
  if (skipped.length) {
    console.log(`\n  Skipped ${skipped.length}:`);
    skipped.forEach(f => console.log(`    - ${f}`));
  }
}

main();
