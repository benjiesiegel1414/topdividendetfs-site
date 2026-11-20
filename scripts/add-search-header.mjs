// Adds the site-wide search header (site-search.js) to every page that doesn't have it yet.
// The tag goes right after the page's own </header> (or after <body> if it has none),
// so the old header is swapped out before the rest of the page draws.
import fs from 'fs';
import path from 'path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', '.github', 'etf-images', 'images', 'topdividendetfs.com']);
const SKIP_FILES = new Set(['x-queue.html']);
const TAG = '<script src="/site-search.js"></script>';
let added = 0;
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p); continue; }
    if (!e.name.endsWith('.html') || SKIP_FILES.has(e.name)) continue;
    let h = fs.readFileSync(p, 'utf8');
    if (h.includes('/site-search.js')) continue;
    if (h.includes('</header>')) h = h.replace('</header>', '</header>\n' + TAG);
    else if (/<body[^>]*>/.test(h)) h = h.replace(/<body[^>]*>/, m => m + '\n' + TAG);
    else continue;
    fs.writeFileSync(p, h); added++;
  }
}
walk(ROOT);
console.log('search header added to', added, 'pages');
