// Keeps the hand-written QQQI and SPYI dividend dates posts current.
// NEOS publishes the whole year's ex/pay dates in advance (same calendar for QQQI, SPYI and the other
// NEOS income ETFs). This rewrites the "next dividend" parts of each post, the page title and the
// search snippet from that calendar plus the latest paid amounts, so the pages never go stale.
// Run after scripts/build-etf-pages.mjs (it reads the dividend data that script caches).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// [declaration, ex-dividend, pay] for 2026, as published by NEOS.
export const NEOS_2026 = [
  ['2026-01-20', '2026-01-21', '2026-01-23'], ['2026-02-17', '2026-02-18', '2026-02-20'], ['2026-03-17', '2026-03-18', '2026-03-20'],
  ['2026-04-21', '2026-04-22', '2026-04-24'], ['2026-05-19', '2026-05-20', '2026-05-22'], ['2026-06-15', '2026-06-16', '2026-06-18'],
  ['2026-07-21', '2026-07-22', '2026-07-24'], ['2026-08-18', '2026-08-19', '2026-08-21'], ['2026-09-15', '2026-09-16', '2026-09-18'],
  ['2026-10-20', '2026-10-21', '2026-10-23'], ['2026-11-17', '2026-11-18', '2026-11-20'], ['2026-12-15', '2026-12-16', '2026-12-18']
];
const today = new Date().toISOString().slice(0, 10);
const d = s => new Date(s + 'T12:00:00Z');
const long = s => d(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const short = s => d(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const md = s => d(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const mdLong = s => d(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
// Month name of a date, for titles that match searches like "qqqi dividend october 2026"
const mon = s => d(s).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
const amt = v => { let x = v.toFixed(v < 1 ? 4 : 3).replace(/0+$/, ''); if (!/\.\d\d/.test(x)) x = (+x).toFixed(2); return '$' + x; };
const fromShort = s => { const t = new Date(s + ' 12:00 UTC'); return isNaN(t) ? null : t.toISOString().slice(0, 10); };
const escAttr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const next = NEOS_2026.find(r => r[1] >= today);
if (!next) { console.log('NEOS 2026 calendar is over; add the next year\'s dates to update-neos-pages.mjs'); process.exit(0); }
let DIVS = { funds: {} };
try { DIVS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'dividends-cache.json'), 'utf8')); } catch {}
// Amounts NEOS has posted on its fund pages (they appear on the declaration date, a day or more
// before the dividend data feeds catch up). Map of ex-date (YYYY-MM-DD) -> amount per share.
async function neosAmounts(sym) {
  try {
    const r = await fetch(`https://neosfunds.com/${sym.toLowerCase()}/`, { headers: { 'User-Agent': 'Mozilla/5.0 (TopDividendETFs page updater)' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const html = await r.text(), out = {};
    const iso = s => { const m = s.match(/^(\d\d)\/(\d\d)\/(\d{4})$/); return m ? `${m[3]}-${m[1]}-${m[2]}` : null; };
    // Distribution history rows: declaration, ex-date, record, pay, amount
    for (const row of html.split(/<tr[\s>]/).slice(1)) {
      const cells = [...row.split('</tr>')[0].matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map(x => x[1].trim());
      if (cells.length !== 5) continue;
      const ex = iso(cells[1]), v = parseFloat(cells[4].replace(/[$,]/g, ''));
      if (ex && v > 0) out[ex] = v;
    }
    console.log(`${sym}: ${Object.keys(out).length} amounts from neosfunds.com`);
    return out;
  } catch (e) { console.log(`${sym}: could not read neosfunds.com (${e.message}), using cached data only`); return {}; }
}
const NEOS_AMT = { QQQI: await neosAmounts('QQQI'), SPYI: await neosAmounts('SPYI') };
// Paid rows from the dividend cache, plus any newer paid amounts NEOS has posted that the cache doesn't have yet.
const paid = sym => {
  // NEOS's own figure wins when both exist (feeds sometimes round, e.g. 0.534 vs 0.5338)
  const n = NEOS_AMT[sym] || {};
  const rows = (DIVS.funds[sym]?.rows || []).filter(x => x[0] <= today && x[1] > 0).map(x => (n[x[0]] ? [x[0], n[x[0]], ...x.slice(2)] : x));
  for (const [ex, v] of Object.entries(n)) if (ex <= today && !rows.some(r => r[0] === ex)) rows.push([ex, v]);
  return rows.sort((a, b) => (a[0] < b[0] ? 1 : -1));
};
const declared = (sym, ex) => (NEOS_AMT[sym] || {})[ex];

function setTag(html, re, value) { return re.test(html) ? html.replace(re, (m, a, b) => a + value + b) : html; }
function common(html, sym, title, desc) {
  html = setTag(html, /(<title>)[^<]*(<\/title>)/, title.replace(/&/g, '&amp;'));
  html = setTag(html, /(<meta name="description" content=")[^"]*(")/, escAttr(desc));
  html = setTag(html, /(<meta property="og:title" content=")[^"]*(")/, escAttr(title));
  html = setTag(html, /(<meta property="og:description" content=")[^"]*(")/, escAttr(desc));
  html = setTag(html, /(<meta name="twitter:title" content=")[^"]*(")/, escAttr(title));
  html = setTag(html, /(<meta name="twitter:description" content=")[^"]*(")/, escAttr(desc));
  return html;
}

function updateSPYI(file) {
  const p = path.join(ROOT, file); if (!fs.existsSync(p)) return;
  let h = fs.readFileSync(p, 'utf8'); const before = h;
  const last = paid('SPYI')[0];
  const [dc, ex, pay] = next;
  const decl = declared('SPYI', ex);
  const title = decl ? `SPYI Dividend Dates 2026: ${mon(ex)} Dividend ${amt(decl)}, Ex-Date ${md(ex)}` : last ? `SPYI Dividend Dates 2026: ${mon(last[0])} Dividend ${amt(last[1])}, Next Ex-Date ${md(ex)}` : `SPYI Dividend Dates 2026: Next Ex-Date ${md(ex)}, Pays ${md(pay)}`;
  const desc = decl
    ? `NEOS declared a ${amt(decl)} SPYI dividend: ex-date ${long(ex)}, paying ${long(pay)}.${last ? ` Previous dividend: ${amt(last[1])} per share.` : ''} Every 2026 SPYI ex-dividend, record and pay date in one schedule.`
    : `${last ? `SPYI's ${mon(last[0])} ${last[0].slice(0, 4)} dividend was ${amt(last[1])} per share (ex-date ${mdLong(last[0])}). ` : ''}Next ex-dividend date: ${long(ex)}, paying ${long(pay)}, confirmed by NEOS. Every 2026 SPYI ex-dividend, record and pay date in one schedule.`;
  h = common(h, 'SPYI', title, desc);
  h = h.replace(/SPYI's next ex-dividend date is [A-Z][a-z]+ \d+, \d{4}<\/strong>, declared [A-Z][a-z]+ \d+ and paying <strong>[A-Z][a-z]+ \d+, \d{4}<\/strong>/,
    `SPYI's next ex-dividend date is ${long(ex)}</strong>, declared ${mdLong(dc)} and paying <strong>${long(pay)}</strong>`);
  h = h.replace(/(<dt>Next Ex-Date<\/dt><dd>)[^<]*/, '$1' + short(ex)).replace(/(<dt>Next Pay Date<\/dt><dd>)[^<]*/, '$1' + short(pay));
  h = h.replace(/<strong>[^<]*<\/strong>Next Ex-Date<\/div>/, `<strong>${md(ex)}</strong>Next Ex-Date</div>`).replace(/<strong>[^<]*<\/strong>Next Pay Date<\/div>/, `<strong>${md(pay)}</strong>Next Pay Date</div>`);
  h = h.replace(/SPYI's next ex-dividend date is <strong>[^<]*<\/strong>, with a declaration date of [A-Z][a-z]+ \d+ and payment on <strong>[^<]*<\/strong>\. You must own shares before [A-Z][a-z]+ \d+ to receive that distribution\./,
    `SPYI's next ex-dividend date is <strong>${long(ex)}</strong>, with a declaration date of ${mdLong(dc)} and payment on <strong>${long(pay)}</strong>. You must own shares before ${mdLong(ex)} to receive that distribution.`);
  h = h.replace(/SPYI's next ex-dividend date is [A-Z][a-z]+ \d+, \d{4}, with a declaration date of [A-Z][a-z]+ \d+ and payment on [A-Z][a-z]+ \d+, \d{4}\. You must own shares before [A-Z][a-z]+ \d+ to receive that distribution\./,
    `SPYI's next ex-dividend date is ${long(ex)}, with a declaration date of ${mdLong(dc)} and payment on ${long(pay)}. You must own shares before ${mdLong(ex)} to receive that distribution.`);
  h = h.replace(/(%24SPYI%20next%20ex-dividend%20date%20is%20)[^&"]*?(\.%20NEOS)/, (m, a, b) => a + encodeURIComponent(`${md(ex)}, 2026, paying ${md(pay)}`) + b);
  // schedule table: mark paid / next / upcoming rows by date
  h = h.replace(/<tr( class="[^"]*")?>([\s\S]*?)<\/tr>/g, (m, cls, inner) => {
    const ds = [...inner.matchAll(/<td class="dt">([A-Z][a-z]{2} \d+, \d{4})<\/td>/g)].map(x => fromShort(x[1]));
    if (ds.length !== 2 || !/<span class="st /.test(inner)) return m;
    const [rx, rp] = ds, isNext = rx === ex;
    inner = inner.replace(/ <span class="nf">NEXT<\/span>/, '').replace(/(<td class="mo">[A-Za-z]+)/, isNext ? '$1 <span class="nf">NEXT</span>' : '$1');
    inner = inner.replace(/<span class="st [a-z0-9]+">[A-Za-z]+<\/span>/, rp < today ? '<span class="st paid">Paid</span>' : isNext ? '<span class="st decl">Next</span>' : '<span class="st up2">Scheduled</span>');
    return `<tr${isNext ? ' class="next-row"' : rp < today ? '' : ' class="proj"'}>${inner}</tr>`;
  });
  h = h.replace(/(Last updated: <strong><time datetime=")[^"]*(">)[^<]*(<\/time>)/, `$1${today}$2${long(today)}$3`);
  if (h !== before) { fs.writeFileSync(p, h); console.log('Updated ' + file); }
}

function updateQQQI(file) {
  const p = path.join(ROOT, file); if (!fs.existsSync(p)) return;
  let h = fs.readFileSync(p, 'utf8'); const before = h;
  const rows = paid('QQQI'), last = rows[0];
  const [dc, ex, pay] = next;
  const decl = declared('QQQI', ex);
  const title = decl ? `QQQI Dividend Dates 2026: ${mon(ex)} Dividend ${amt(decl)}, Ex-Date ${md(ex)}` : last ? `QQQI Dividend Dates 2026: ${mon(last[0])} Dividend ${amt(last[1])}, Next Ex-Date ${md(ex)}` : `QQQI Dividend Dates 2026: Next Ex-Date ${md(ex)}`;
  const desc = decl
    ? `NEOS declared a ${amt(decl)} QQQI dividend: ex-date ${long(ex)}, paying ${long(pay)}.${last ? ` Its previous dividend was ${amt(last[1])} per share (ex-date ${mdLong(last[0])}).` : ''} All 12 QQQI 2026 ex-dividend and pay dates, plus amounts paid so far.`
    : `${last ? `QQQI's ${mon(last[0])} ${last[0].slice(0, 4)} dividend was ${amt(last[1])} per share (ex-date ${mdLong(last[0])}). ` : ''}Next ex-dividend date: ${long(ex)}, paying ${long(pay)}, confirmed by NEOS. All 12 QQQI 2026 ex-dividend and pay dates, plus amounts paid so far.`;
  h = common(h, 'QQQI', title, desc);
  const box = `<!-- AUTO-NEXT:START --><div style="margin:14px auto 4px;max-width:640px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.3);border-radius:12px;padding:12px 16px;font-size:1rem;line-height:1.5"><strong>Next QQQI ex-dividend date: ${long(ex)}</strong> · pays ${long(pay)} (NEOS-confirmed)${decl ? `<br>Declared amount: <strong>${amt(decl)}</strong> per share` : ''}${last ? `<br>Last dividend: <strong>${amt(last[1])}</strong> per share, ex-date ${long(last[0])}` : ''}</div><!-- AUTO-NEXT:END -->`;
  if (/<!-- AUTO-NEXT:START -->[\s\S]*?<!-- AUTO-NEXT:END -->/.test(h)) h = h.replace(/<!-- AUTO-NEXT:START -->[\s\S]*?<!-- AUTO-NEXT:END -->/, box);
  else h = h.replace(/(<h1>QQQI ETF Dividend Dates 2026<\/h1>\s*<p>[\s\S]*?<\/p>)/, `$1\n    ${box}`);
  h = h.replace(/<p>The next confirmed ex-dividend date for QQQI is <strong>[\s\S]*?<\/p>/,
    `<p>The next confirmed ex-dividend date for QQQI is <strong>${long(ex)}</strong>, with a declaration date of ${mdLong(dc)} and a payment date of <strong>${long(pay)}</strong>. NEOS has confirmed every 2026 date: ${NEOS_2026.map(r => mdLong(r[1])).join(', ')}. Dollar amounts are announced on each declaration date. Always verify the latest amounts at <a href="https://neosfunds.com/qqqi" target="_blank" rel="noopener">neosfunds.com</a>.</p>`);
  h = h.replace(/(QQQI pays monthly dividends\. In 2026 confirmed ex-dividend dates )(?:include: )?[^.]*\./, `$1are ${NEOS_2026.map(r => md(r[1])).join(', ')}.`);
  // schedule table: fill paid amounts and statuses
  h = h.replace(/<tr>(\s*<td><strong>[A-Z][a-z]+ 2026<\/strong><\/td>\s*<td>[^<]*<\/td>\s*<td>([^<]*)<\/td>\s*<td>[^<]*<\/td>\s*<td>([^<]*)<\/td>\s*)<td class="(?:amount|projected)">[^<]*<\/td>(\s*)<td><span class="badge-[a-z]+">[^<]*<\/span><\/td>/g, (m, mid, exS, payS, sp) => {
    const rx = fromShort(exS.trim()), rp = fromShort(payS.trim()); if (!rx) return m;
    const c = (DIVS.funds.QQQI?.rows || []).find(x => x[0] === rx);
    const hit = declared('QQQI', rx) || (c ? c[1] : undefined);
    const amountCell = hit ? `<td class="amount">${amt(hit)}</td>` : `<td class="projected">TBA</td>`;
    const status = rp && rp < today && hit ? '<span class="badge-confirmed">Paid</span>' : rx === ex ? `<span class="badge-projected">${hit ? 'Declared' : 'Next'}</span>` : '<span class="badge-confirmed">Dates Confirmed</span>';
    return `<tr>${mid}${amountCell}${sp}<td>${status}</td>`;
  });
  if (h !== before) { fs.writeFileSync(p, h); console.log('Updated ' + file); }
}

updateSPYI('spyi-etf-dividend-dates-2026.html');
updateQQQI('qqqi-etf-dividend-dates-2026.html');
