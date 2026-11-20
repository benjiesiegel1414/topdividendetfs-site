// Builds /data/search-index.json for the site-wide search bar (site-search.js).
// ETFs (ticker, name, yield, grade, issuer), issuer pages, category and grade lists, and articles.
import fs from 'fs';
import path from 'path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = p => fs.readFileSync(p, 'utf8');
const unesc = s => s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
const title = h => { const m = h.match(/<title>([\s\S]*?)<\/title>/); return m ? unesc(m[1]).trim() : ''; };
const list = d => fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.html')).sort() : [];
const items = [], issuerOf = {};

for (const f of list(path.join(ROOT, 'etfs/issuer'))) {
  const h = read(path.join(ROOT, 'etfs/issuer', f)), slug = f.slice(0, -5), t = title(h);
  const m = t.match(/^(.*?) Dividend ETFs \((\d+)\)/);
  const name = m ? m[1] : slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  items.push({ t: 'i', n: name, u: '/etfs/issuer/' + slug, c: m ? +m[2] : 0 });
  for (const s of new Set([...h.matchAll(/href="\/etfs\/([a-z0-9]+)"/g)].map(x => x[1]))) if (!issuerOf[s]) issuerOf[s] = name;
}
for (const f of list(path.join(ROOT, 'etfs'))) {
  const b = f.slice(0, -5);
  if (b === 'index' || b === 'highest-yield' || b.endsWith('dividend-dates')) continue;
  const h = read(path.join(ROOT, 'etfs', f)), t = title(h);
  const m = t.match(/^([A-Z0-9.]+) ETF: ([\d.]+%) Yield, ([A-F][+-]?) Grade/);
  if (!m) continue;
  const h1 = h.match(/<h1[^>]*>([\s\S]*?)\(/);
  items.push({ t: 'e', s: m[1], n: h1 ? unesc(h1[1].replace(/<[^>]+>/g, '')).trim() : '', y: m[2], g: m[3], is: issuerOf[b] || '', u: '/etfs/' + b });
}
for (const d of ['category', 'grade']) for (const f of list(path.join(ROOT, 'etfs', d)))
  items.push({ t: 'l', n: title(read(path.join(ROOT, 'etfs', d, f))).split('|')[0].trim(), u: `/etfs/${d}/` + f.slice(0, -5) });
const SKIP = new Set(['index', '404', 'FAQ', 'advertise', 'blog', 'privacy', 'terms', 'x-queue', 'match']);
for (const f of list(ROOT)) {
  const b = f.slice(0, -5); if (SKIP.has(b)) continue;
  const t = title(read(path.join(ROOT, f))); if (!t) continue;
  items.push({ t: 'b', n: t.replace(/\s*\|\s*TopDividendETFs(\.com)?\s*$/, ''), u: '/' + b });
}
fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data/search-index.json'), JSON.stringify(items));
console.log('search index:', items.length, 'entries');
