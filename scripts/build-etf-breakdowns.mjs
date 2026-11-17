#!/usr/bin/env node
/**
 * TopDividendETFs.com: per-ETF breakdown pages + richer ETF pages
 *
 *   /etfs/<sym>/<metric>   one breakdown (GitHub Pages serves <metric>.html at the clean URL)
 *   /etfs/<sym>            the ETF page built by build-etf-pages.mjs, upgraded here with
 *                          Key Numbers, a payout chart, a dividend calendar, performance charts,
 *                          and every box clicking through to its breakdown
 *
 * Metrics: yield-trend, dividend-history, dividend-calendar, income-calculator,
 * growth-of-10k, total-return-trend, 52-week-range, yield-rank, price-decay
 *
 * Runs in build-etf-pages.yml right after build-etf-pages.mjs (and before the sitemap).
 * The workflow moves last run's etfs/ to .etfs-prev/ first: an ETF whose Yahoo data fails
 * keeps last run's breakdown pages, so no page ever disappears.
 *
 * Env: ONLY=JEPI,SCHD (test a few)   YAHOO_CACHE=dir (reuse downloads while testing)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.TDE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://topdividendetfs.com';
const OUT = path.join(ROOT, 'etfs');
const PREV = path.join(ROOT, '.etfs-prev');
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRYVQtSlWkwIDCeeB-YaQEpelovyW9ofaItXrzXZ_ntodK4QasRTKhP-swVWISmXIDZTIvQlbvNZm_o/pub?output=csv';
const PRO_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTxCiod-Cwry7E6k9Un9dgrM_ANymC36_IO_wLyNj-YDo2KI7mp_1ZzyNBnBGZOxT48QPM8TCwtsmA4/pub?gid=0&single=true&output=csv';
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',').map(s => s.trim().toUpperCase())) : null;
const CACHE = process.env.YAHOO_CACHE || '';
// FULL=0 (the 6-hourly runs during the day): reuse last run's breakdown pages and only refresh the ETF pages.
// The evening run (FULL=1) rewrites every breakdown page with the day's closing prices.
const FULL = process.env.FULL !== '0';
const YEAR = new Date().getUTCFullYear();

const METRICS = [
  ['yield-trend', 'Yield Trend', '&#128200;'],
  ['dividend-history', 'Dividend History', '&#128197;'],
  ['dividend-calendar', 'Dividend Calendar', '&#128198;'],
  ['income-calculator', 'Income Calculator', '&#128176;'],
  ['growth-of-10k', 'Growth of $10,000', '&#127793;'],
  ['total-return-trend', 'Total Return Trend', '&#128202;'],
  ['52-week-range', '52-Week Range', '&#128207;'],
  ['yield-rank', 'Yield Rank', '&#127942;'],
  ['price-decay', 'Price Decay Check', '&#9888;&#65039;'],
];
const LABEL = Object.fromEntries(METRICS.map(([k, t]) => [k, t]));

// ───────────────────────── helpers
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ok = v => v != null && isFinite(v);
const pct = (v, d = 1) => ok(v) ? v.toFixed(d) + '%' : 'n/a';
const spct = (v, d = 1) => ok(v) ? (v >= 0 ? '+' : '') + v.toFixed(d) + '%' : 'n/a';
const money = (v, d = 2) => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const money0 = v => '$' + Math.round(v).toLocaleString('en-US');
const dps = v => '$' + v.toFixed(4).replace(/0{1,2}$/, '');
const dt = iso => new Date(iso + 'T12:00:00Z');
const fd = iso => dt(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const fm = iso => dt(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const fml = iso => dt(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const addDays = (iso, n) => new Date(dt(iso).getTime() + n * 864e5).toISOString().slice(0, 10);
const days = (a, b) => (dt(b) - dt(a)) / 864e5;
const slug = s => s.toLowerCase().replace(/[^a-z0-9.\-]/g, '');
const median = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)] || 'th');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const head = (rows.shift() || []).map(h => h.trim());
  return rows.filter(r => r.some(x => x.trim())).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}
const num = s => { const v = parseFloat(String(s || '').replace(/[^0-9.\-]/g, '')); return isFinite(v) ? v : null; };
function aum(s) { const v = num(s); if (v == null) return null; const u = String(s).toUpperCase(); return u.includes('B') ? v * 1e9 : u.includes('M') ? v * 1e6 : u.includes('K') ? v * 1e3 : v; }

async function getText(url) {
  for (let a = 0; a < 3; a++) {
    try { const r = await fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now()); if (r.ok) return await r.text(); } catch {}
    await sleep(1500 * (a + 1));
  }
  throw new Error('fetch failed: ' + url);
}

async function yahoo(sym) {
  const cf = CACHE && path.join(CACHE, sym + '.json');
  let j = null;
  if (cf && fs.existsSync(cf)) j = JSON.parse(fs.readFileSync(cf, 'utf8'));
  if (!j) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=0&period2=9999999999&interval=1d&events=div`;
    for (let a = 0; a < 3 && !j; a++) {
      try {
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MonthlyETFs/1.0)' } });
        if (r.ok) j = await r.json(); else if (r.status === 404) return null;
      } catch {}
      if (!j) await sleep(2000 * (a + 1));
    }
    if (j && cf) { fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(cf, JSON.stringify(j)); }
  }
  const res = j?.chart?.result?.[0];
  if (!res?.timestamp) return null;
  const off = res.meta?.gmtoffset || 0;
  const day = t => new Date((t + off) * 1000).toISOString().slice(0, 10);
  const cl = res.indicators?.quote?.[0]?.close || [];
  const bars = [];
  res.timestamp.forEach((t, i) => { if (ok(cl[i]) && cl[i] > 0) { const d = day(t); if (bars.length && bars.at(-1).d === d) bars.at(-1).c = cl[i]; else bars.push({ d, c: cl[i] }); } });
  const divs = Object.values(res.events?.dividends || {}).map(x => ({ d: day(x.date), a: x.amount })).filter(x => x.a > 0).sort((a, b) => a.d < b.d ? -1 : 1);
  return { bars, divs };
}

// ───────────────────────── analytics
function analyze(F) {
  const { bars } = F;
  const first = bars[0], last = bars.at(-1);
  const divs = F.divs.filter(x => x.d >= first.d);
  F.divs = divs;
  F.px = last.c; F.pxDate = last.d; F.launch = first;
  F.ageDays = days(first.d, last.d);

  // total return index (dividends reinvested on the ex-date, or the next trading day)
  let k = 0, idx = 1;
  bars[0].tr = 1;
  for (let i = 1; i < bars.length; i++) {
    let dv = 0;
    while (k < divs.length && divs[k].d <= bars[i].d) { if (divs[k].d > bars[i - 1].d) dv += divs[k].a; k++; }
    idx *= (bars[i].c + dv) / bars[i - 1].c;
    bars[i].tr = idx;
  }
  F.trNow = idx;
  const at = iso => { let lo = 0, hi = bars.length - 1; if (iso < bars[0].d) return null; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (bars[m].d <= iso) lo = m; else hi = m - 1; } return bars[lo]; };
  F.at = at;
  const ttmAt = iso => { const from = addDays(iso, -365); return divs.filter(x => x.d > from && x.d <= iso).reduce((s, x) => s + x.a, 0); };
  const lastDivAt = iso => { let r = null; for (const x of divs) { if (x.d <= iso) r = x; else break; } return r; };

  // weekly points (last close of each week)
  const wk = [];
  for (const b of bars) {
    const dow = dt(b.d).getUTCDay();
    const key = addDays(b.d, -((dow + 6) % 7));
    if (wk.length && wk.at(-1).key === key) Object.assign(wk.at(-1), b, { key }); else wk.push({ ...b, key });
  }
  const yearIn = addDays(first.d, 365);
  for (const w of wk) {
    w.ttm = w.d >= yearIn ? ttmAt(w.d) / w.c * 100 : null;
    const ld = lastDivAt(w.d);
    w.rate = ld && days(ld.d, w.d) < 70 ? ld.a * 12 / w.c * 100 : null;
  }
  F.weeks = wk;

  F.ttmDiv = ttmAt(last.d);
  F.ttmYield = last.d >= yearIn ? F.ttmDiv / F.px * 100 : null;
  F.lastDiv = divs.at(-1) || null;
  F.rate = F.lastDiv ? F.lastDiv.a * 12 / F.px * 100 : null;
  F.curYield = F.ttmYield ?? F.rate;

  const ago = at(addDays(last.d, -365));
  F.ago = ago && last.d >= addDays(first.d, 365 + 7) ? ago : null;
  if (F.ago) {
    F.agoTtm = ago.d >= yearIn ? ttmAt(ago.d) / ago.c * 100 : null;
    F.pxChg1 = (F.px / ago.c - 1) * 100;
    F.tr1 = (F.trNow / ago.tr - 1) * 100;
    F.payChg = F.agoTtm ? (F.ttmDiv / ttmAt(ago.d) - 1) * 100 : null;
  }
  const ann = yrs => { const b = at(addDays(last.d, -365 * yrs)); return b && days(first.d, last.d) >= 365 * yrs - 5 ? ((F.trNow / b.tr) ** (1 / yrs) - 1) * 100 : null; };
  F.tr3 = ann(3); F.tr5 = ann(5);
  F.trSince = (F.trNow - 1) * 100;
  F.pxSince = (F.px / first.c - 1) * 100;
  F.yrs = F.ageDays / 365.25;
  F.cagr = F.yrs >= 1 ? (F.trNow ** (1 / F.yrs) - 1) * 100 : null;
  let pk = 0, mdd = 0; for (const b of bars) { pk = Math.max(pk, b.tr); mdd = Math.min(mdd, b.tr / pk - 1); } F.mdd = mdd * 100;

  // 52 weeks
  const y1 = bars.filter(b => b.d > addDays(last.d, -365));
  const hi = y1.reduce((a, b) => b.c > a.c ? b : a), lo = y1.reduce((a, b) => b.c < a.c ? b : a);
  F.hi52 = hi; F.lo52 = lo; F.y1bars = y1;
  F.pos = hi.c > lo.c ? (F.px - lo.c) / (hi.c - lo.c) * 100 : 50;
  F.offHi = (F.px / hi.c - 1) * 100; F.overLo = (F.px / lo.c - 1) * 100;

  // calendar years
  const yrsList = [...new Set(bars.map(b => b.d.slice(0, 4)))];
  F.calYears = yrsList.map(y => {
    const prevEnd = at(`${+y - 1}-12-31`), end = at(`${y}-12-31`);
    const start = prevEnd || bars[0];
    const dvs = divs.filter(x => x.d.startsWith(y));
    return { y, partial: !prevEnd || y === last.d.slice(0, 4), tr: (end.tr / start.tr - 1) * 100, pr: (end.c / start.c - 1) * 100, div: dvs.reduce((s, x) => s + x.a, 0), n: dvs.length, endPx: end.c, endTr: end.tr };
  });

  // dividends
  const l12 = divs.filter(x => x.d > addDays(last.d, -365));
  F.l12 = l12.length ? l12 : divs.slice(-12);
  F.avg12 = F.l12.reduce((s, x) => s + x.a, 0) / (F.l12.length || 1);
  let up = 0, dn = 0;
  const tail = divs.slice(-13);
  for (let i = 1; i < tail.length; i++) { const c = tail[i].a / tail[i - 1].a - 1; if (c > 0.005) up++; else if (c < -0.005) dn++; }
  F.raises = up; F.cuts = dn;
  F.prevDiv = divs.at(-2) || null;
  F.yearAgoDiv = divs.filter(x => x.d <= addDays(F.lastDiv?.d || last.d, -330)).at(-1) || null;
  const exDays = F.l12.map(x => +x.d.slice(8, 10));
  F.exDay = exDays.length ? Math.round(median(exDays)) : null;
  F.perYear = l12.length;
  if (F.lastDiv && F.exDay) {
    const ld = dt(F.lastDiv.d);
    let y = ld.getUTCFullYear(), m = ld.getUTCMonth() + 1;
    let est;
    for (;;) {
      if (m > 11) { m = 0; y++; }
      const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      est = new Date(Date.UTC(y, m, Math.min(F.exDay, dim)));
      const wd = est.getUTCDay(); if (wd === 6) est = new Date(est - 864e5); if (wd === 0) est = new Date(est - 2 * 864e5);
      if (est.toISOString().slice(0, 10) > last.d) break;
      m++;
    }
    F.nextEx = est.toISOString().slice(0, 10);
  }
  return F;
}

// ───────────────────────── charts (server-rendered SVG + hover tips from bd.js)
function nice(mn, mx, count = 5) {
  if (mn === mx) { mn -= 1; mx += 1; }
  const span = mx - mn, raw = span / count, mag = 10 ** Math.floor(Math.log10(raw));
  const st = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= count) || 10 * mag;
  const lo = Math.floor(mn / st) * st, hi = Math.ceil(mx / st) * st, ticks = [];
  for (let v = lo; v <= hi + st / 2; v += st) ticks.push(+v.toFixed(10));
  return { lo, hi, ticks };
}
const tipsAttr = t => ` data-tips="${esc(JSON.stringify(t))}"`;

function lineChart(o) {
  const W = 900, H = o.H || 300, L = o.L || 60, R = 18, T = 22, B = 34;
  const n = o.dates.length;
  const all = [];
  o.series.forEach(s => s.v.forEach(v => ok(v) && all.push(v)));
  (o.refs || []).forEach(r => all.push(r.v));
  let mn = Math.min(...all), mx = Math.max(...all);
  if (o.zero) mn = Math.min(mn, 0);
  const pad = (mx - mn) * 0.06 || Math.abs(mx) * 0.05 || 1;
  const { lo, hi, ticks } = nice(mn >= 0 ? Math.max(0, mn - pad) : mn - pad, mx + pad, 5);
  const X = i => n < 2 ? L : L + i * (W - L - R) / (n - 1);
  const Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  let g = '';
  for (const v of ticks) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="#e7eded"/><text x="${L - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" font-size="12" fill="#888">${o.yFmt(v)}</text>`;
  for (const r of o.refs || []) g += `<line x1="${L}" x2="${W - R}" y1="${Y(r.v).toFixed(1)}" y2="${Y(r.v).toFixed(1)}" stroke="${r.color || '#888'}" stroke-width="1.5" stroke-dasharray="6 5"/><text x="${W - R - 4}" y="${(Y(r.v) - 6).toFixed(1)}" text-anchor="end" font-size="12" font-weight="700" fill="${r.color || '#888'}">${esc(r.label)}</text>`;
  for (const s of o.series) {
    const segs = []; let cur = [];
    s.v.forEach((v, i) => { if (ok(v)) cur.push([X(i), Y(v)]); else if (cur.length) { segs.push(cur); cur = []; } });
    if (cur.length) segs.push(cur);
    for (const sg of segs) {
      const pts = sg.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
      if (s.area) g += `<polygon points="${sg[0][0].toFixed(1)},${H - B} ${pts} ${sg.at(-1)[0].toFixed(1)},${H - B}" fill="${s.color}" opacity=".10"/>`;
      g += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}" stroke-linejoin="round" stroke-linecap="round"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/>`;
    }
  }
  for (const m of o.markers || []) {
    const x = X(m.i), y = Y(m.v);
    const anc = x > W - 130 ? 'end' : x < L + 70 ? 'start' : 'middle';
    g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" fill="${m.color}" stroke="#fff" stroke-width="2"/><text x="${x.toFixed(1)}" y="${(y + (m.dy || -12)).toFixed(1)}" text-anchor="${anc}" font-size="12" font-weight="900" fill="${m.color}">${esc(m.label)}</text>`;
  }
  const xf = o.xFmt || fm;
  const step = Math.max(1, Math.ceil(n / 6));
  for (let k = 0; k < n - 1; k += step) if (n - 1 - k > step * 0.6) g += `<text x="${X(k).toFixed(1)}" y="${H - 10}" text-anchor="${k === 0 ? 'start' : 'middle'}" font-size="12" fill="#888">${xf(o.dates[k])}</text>`;
  g += `<text x="${W - R}" y="${H - 10}" text-anchor="end" font-size="12" fill="#888">${xf(o.dates[n - 1])}</text>`;
  const tips = o.tip ? o.dates.map((d, i) => [+(X(i) / W * 100).toFixed(2), o.tip(i)]) : null;
  return `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="${esc(o.aria)}"${tips ? tipsAttr(tips) : ''}>${g}</svg></div>`;
}

function barChart(o) {
  const W = 900, H = o.H || 280, L = o.L || 60, R = 18, T = 22, B = 34;
  const items = o.items, n = items.length;
  const all = [0]; items.forEach(it => it.vals.forEach(s => all.push(s.v))); (o.refs || []).forEach(r => all.push(r.v));
  const mx = Math.max(...all), mn = Math.min(...all);
  const { lo, hi, ticks } = nice(mn, mx + (mx - mn) * 0.08, 5);
  const Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const band = (W - L - R) / n;
  let g = '';
  for (const v of ticks) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${v === 0 ? '#c9d3d3' : '#e7eded'}"/><text x="${L - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" font-size="12" fill="#888">${o.yFmt(v)}</text>`;
  const tips = [];
  items.forEach((it, i) => {
    const k = it.vals.length, inner = band * (n > 40 ? 0.78 : 0.68), gap = k > 1 ? 3 : 0, bw = (inner - gap * (k - 1)) / k;
    const x0 = L + i * band + (band - inner) / 2;
    it.vals.forEach((s, j) => {
      const y1 = Y(Math.max(s.v, 0)), y2 = Y(Math.min(s.v, 0));
      g += `<rect x="${(x0 + j * (bw + gap)).toFixed(1)}" y="${y1.toFixed(1)}" width="${Math.max(bw, 1).toFixed(1)}" height="${Math.max(y2 - y1, 1).toFixed(1)}" rx="${Math.min(3, bw / 3).toFixed(1)}" fill="${s.color}"/>`;
    });
    tips.push([+((L + (i + 0.5) * band) / W * 100).toFixed(2), it.tip]);
  });
  for (const r of o.refs || []) g += `<line x1="${L}" x2="${W - R}" y1="${Y(r.v).toFixed(1)}" y2="${Y(r.v).toFixed(1)}" stroke="${r.color}" stroke-width="1.5" stroke-dasharray="6 5"/><text x="${W - R - 4}" y="${(Y(r.v) - 6).toFixed(1)}" text-anchor="end" font-size="12" font-weight="700" fill="${r.color}">${esc(r.label)}</text>`;
  const every = Math.max(1, Math.ceil(n / (o.maxLabels || 12)));
  items.forEach((it, i) => { if ((n - 1 - i) % every === 0) g += `<text x="${(L + (i + 0.5) * band).toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="12" fill="#888">${esc(it.label)}</text>`; });
  return `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="${esc(o.aria)}"${tipsAttr(tips)}>${g}</svg></div>`;
}

const thin = (arr, max = 260) => { if (arr.length <= max) return arr; const st = Math.ceil(arr.length / max); const out = arr.filter((_, i) => i % st === 0); if (out.at(-1) !== arr.at(-1)) out.push(arr.at(-1)); return out; };




const GOLD = '#d4a017', TEAL = '#2E5D54', MINT = '#8fc9b0', RED = '#c0392b', GREEN = '#1e9e57', GRAY = '#9aa8a3';
const FREQ = n => n >= 40 ? ['Weekly', 'weekly', 52] : n >= 9 ? ['Monthly', 'monthly', 12] : n >= 3 ? ['Quarterly', 'quarterly', 4] : n >= 2 ? ['Semi-annual', 'twice a year', 2] : ['Annual', 'once a year', 1];

// TopDividendETFs funds pay weekly, monthly, quarterly... so the rate and next ex-date follow each fund's own schedule
function analyzeTDE(F) {
  analyze(F);
  const [Fq, fw, n] = FREQ(F.perYear || F.divs.filter(x => x.d > addDays(F.pxDate, -365)).length);
  Object.assign(F, { freq: Fq, freqWord: fw, n });
  F.rate = F.lastDiv ? F.lastDiv.a * n / F.px * 100 : null;
  F.curYield = F.ttmYield ?? F.rate;
  for (const w of F.weeks) { const ld = F.divs.filter(x => x.d <= w.d).at(-1); w.rate = ld && days(ld.d, w.d) < Math.max(70, 400 / n * 1.6) ? ld.a * n / w.c * 100 : null; }
  // next ex-date: last ex-date plus the usual gap between payouts, moved off weekends
  const gaps = []; for (let i = Math.max(1, F.divs.length - 8); i < F.divs.length; i++) gaps.push(days(F.divs[i - 1].d, F.divs[i].d));
  const gap = gaps.length ? median(gaps) : 365 / n;
  if (F.lastDiv) {
    let d = F.lastDiv.d;
    do { d = n === 12 && F.exDay ? nextMonthly(d, F.exDay) : addDays(d, Math.round(gap)); } while (d <= F.pxDate);
    const wd = dt(d).getUTCDay(); if (wd === 6) d = addDays(d, -1); if (wd === 0) d = addDays(d, -2);
    F.nextEx = d;
  }
  F.monthlyIncomePerShare = F.lastDiv ? F.lastDiv.a * n / 12 : 0;
  F.avgMonthlyPerShare = F.avg12 * n / 12;
  return F;
}
function nextMonthly(d, day) { const t = dt(d); let y = t.getUTCFullYear(), m = t.getUTCMonth() + 1; if (m > 11) { m = 0; y++; } const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return new Date(Date.UTC(y, m, Math.min(day, dim))).toISOString().slice(0, 10); }

const BD_CSS = `
.crumbs{align-self:flex-start;margin:18px 0 10px;font-size:.78em;color:#888}
.crumbs a{color:var(--primary);font-weight:700;text-decoration:none}
.ph{width:100%;background:linear-gradient(155deg,#30776C,#1f5148);color:#fff;border-radius:14px;padding:24px 26px;box-shadow:0 10px 30px rgba(0,0,0,.18);margin-bottom:16px;position:relative;overflow:hidden;box-sizing:border-box}
.ph::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 88% -10%,rgba(255,215,106,.2),transparent 45%);pointer-events:none}
.ph h1{margin:0 0 6px;font-size:1.65em;font-weight:900;line-height:1.2;position:relative;z-index:1}
.ph p{margin:0;color:rgba(255,255,255,.8);font-size:.92em;position:relative;z-index:1}
.ph-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:18px;position:relative;z-index:1}
.ph-stats div{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:11px 12px}
.ph-stats em{display:block;font-style:normal;font-size:.62em;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.65);font-weight:900}
.ph-stats b{font-size:1.35em;color:#ffd76a}
.ph-stats small{display:block;font-size:.66em;color:rgba(255,255,255,.65)}
.bd{width:100%;background:#fff;border-radius:12px;border:1px solid #e2e2e2;padding:22px 24px;margin-bottom:16px;box-shadow:0 3px 12px rgba(0,0,0,.06);box-sizing:border-box}
.bd h2{font-size:1.12em;color:var(--primary);margin:0 0 6px;font-weight:900}
.bd .sub{font-size:.84em;color:#777;margin:0 0 14px;line-height:1.5}
.lg{display:flex;gap:18px;flex-wrap:wrap;font-size:.75em;color:#666;margin-top:8px}
.lg i{display:inline-block;width:18px;height:3px;margin-right:6px;vertical-align:3px}
.lg i.sq{width:11px;height:11px;border-radius:3px;vertical-align:-1px}
.prose{font-size:.95em;line-height:1.7;color:#333}
.prose p{margin:0 0 12px}
.prose b{color:var(--primary)}
.three{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0 4px}
.three div{background:var(--light);border-radius:10px;padding:12px 14px}
.three b{display:block;color:var(--primary);font-size:1.25em}
.three em{font-style:normal;font-weight:900;font-size:.78em;color:#444}
.three small{display:block;font-size:.74em;color:#777;margin-top:4px;line-height:1.45}
.drv{display:grid;grid-template-columns:150px 1fr 70px;align-items:center;gap:12px;margin:10px 0;font-size:.88em}
.drv span{font-weight:700;color:#555}
.drv-t{position:relative;height:16px;background:#f0f3f3;border-radius:8px}
.drv-t i{position:absolute;top:0;bottom:0;border-radius:8px}
.drv-t .z{position:absolute;left:50%;top:-3px;bottom:-3px;width:2px;background:#bbb}
.drv em{font-style:normal;font-weight:900;text-align:right}
.verdict{background:#fff8e1;border:1px solid #f0d090;border-radius:10px;padding:12px 14px;font-size:.88em;color:#5c4400;margin-top:12px;line-height:1.6}
.tw{overflow-x:auto}
.rt{width:100%;border-collapse:collapse;font-size:.88em}
.rt th{text-align:left;font-size:.66em;text-transform:uppercase;letter-spacing:.8px;color:#888;padding:8px;border-bottom:2px solid #eee;white-space:nowrap}
.rt td{padding:9px 8px;border-bottom:1px solid #f0f0f0}
.rt td a{font-weight:900;color:var(--primary);text-decoration:none}
.rt td a:hover{text-decoration:underline}
.rt td.nm{color:#666}.rt td.y{font-weight:900;color:#a77a0a}
.rt td.up{color:#2e8b57;font-weight:700}.rt td.dn{color:#c62828;font-weight:700}
.rt tr.me td{background:#fff8e1}
.rt td.barc{min-width:120px}
.rt .bar{height:8px;border-radius:4px;background:linear-gradient(90deg,#c99a1d,#ffd76a)}
.rt tr.more{display:none}.rt.open tr.more{display:table-row}
.dec{font-size:.68em;font-weight:900;padding:2px 7px;border-radius:4px;text-transform:uppercase;white-space:nowrap}
.dec.no{background:#e3f6ec;color:#2e8b57}.dec.yes{background:#fdecea;color:#c62828}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px;width:100%}
.og{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.oc{display:flex;flex-direction:column;gap:3px;text-decoration:none;border:1px solid #dfe6e6;border-radius:10px;padding:12px;transition:all .15s;background:#fff}
.oc:hover{border-color:var(--primary);transform:translateY(-2px);box-shadow:0 5px 14px rgba(0,0,0,.08)}
.oc span{font-size:1.2em}.oc b{color:var(--primary);font-size:.92em}.oc em{font-style:normal;color:#888;font-size:.74em}
.og.big{grid-template-columns:repeat(3,1fr)}.og.big .oc{padding:16px}.og.big .oc b{font-size:1.02em}.og.big .oc em{font-size:.8em}
.pg{display:flex;flex-wrap:wrap;gap:8px}
.pc{padding:8px 13px;border-radius:999px;border:1.5px solid var(--primary);color:var(--primary);font-weight:900;font-size:.8em;text-decoration:none}
.pc:hover{background:var(--primary);color:#fff}
.faq details{border-bottom:1px solid #eee}
.faq summary{cursor:pointer;font-weight:900;color:var(--primary);padding:11px 0;font-size:.92em}
.faq p{margin:0 0 12px;color:#555;font-size:.88em;line-height:1.6}
.back{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:6px 0 18px}
.back a{padding:11px 22px;border-radius:8px;font-weight:900;font-size:.9em;text-decoration:none}
.back a.p{background:var(--primary);color:#fff}.back a.g{border:1px solid var(--primary);color:var(--primary);background:#fff}
.more-btn{margin-top:12px;background:#fff;border:1px solid var(--primary);color:var(--primary);font-weight:900;border-radius:8px;padding:9px 16px;cursor:pointer;font-family:inherit}
.calg{display:grid;grid-template-columns:70px repeat(12,1fr);gap:4px;font-size:.78em;min-width:640px}
.calg .h{font-weight:900;color:#888;text-align:center;font-size:.85em;text-transform:uppercase}
.calg .yr{font-weight:900;color:var(--primary);display:flex;align-items:center}
.calg .c{background:#f4f7f7;border-radius:7px;padding:7px 2px;text-align:center;min-height:38px;line-height:1.25}
.calg .c b{display:block;color:#1f5148}.calg .c small{color:#888}
.calg .c.paid{background:#e3f6ec}.calg .c.est{background:#fff8e1;border:1px dashed #e0b84a}
.bd-calc{display:grid;grid-template-columns:1.1fr 1fr;gap:22px;align-items:center}
.bd-calc label{font-size:.75em;font-weight:900;text-transform:uppercase;letter-spacing:.8px;color:#888}
.bd-calc .amt{font-size:2em;font-weight:900;color:var(--primary);margin:4px 0 8px}
.bd-calc input[type=range]{width:100%;accent-color:#30776C}
.bd-calc .shares{font-size:.8em;color:#777;margin-top:6px}
.bd-calc .out{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.bd-calc .out div{background:var(--light);border-radius:10px;padding:12px;text-align:center}
.bd-calc .out em{display:block;font-style:normal;font-size:.68em;font-weight:900;text-transform:uppercase;letter-spacing:.8px;color:#888}
.bd-calc .out b{font-size:1.3em;color:#a77a0a}
.chart-box{position:relative}
.chart-box svg{overflow:visible}
@media(max-width:560px){.chart-box svg text{font-size:22px}}
@media(max-width:760px){.ph-stats,.og,.og.big{grid-template-columns:1fr 1fr}.three,.two,.bd-calc{grid-template-columns:1fr}.drv{grid-template-columns:110px 1fr 60px}.rt td.nm,.rt th.nm{display:none}.ph h1{font-size:1.35em}.bd{padding:18px 16px}}
`;
const BD_JS = `(function(){
  document.querySelectorAll('.chart-box svg[data-tips]').forEach(function(svg){
    var tips; try{tips=JSON.parse(svg.getAttribute('data-tips'))}catch(e){return}
    if(!tips||!tips.length)return;
    var box=svg.parentNode, tip=document.createElement('div'); tip.className='chart-tip'; box.appendChild(tip);
    var vb=svg.viewBox.baseVal, NS='http://www.w3.org/2000/svg', ln=document.createElementNS(NS,'line');
    ln.setAttribute('y1',14); ln.setAttribute('y2',vb.height-30); ln.setAttribute('stroke','#1f5148'); ln.setAttribute('stroke-opacity','.3'); ln.setAttribute('stroke-width','1.5'); ln.style.display='none'; svg.appendChild(ln);
    function show(e){
      var r=svg.getBoundingClientRect(), p=e.touches?e.touches[0]:e, f=(p.clientX-r.left)/r.width*100, best=tips[0];
      for(var i=1;i<tips.length;i++) if(Math.abs(tips[i][0]-f)<Math.abs(best[0]-f)) best=tips[i];
      ln.setAttribute('x1',best[0]/100*vb.width); ln.setAttribute('x2',best[0]/100*vb.width); ln.style.display='';
      tip.innerHTML=best[1]; tip.style.display='block';
      var x=best[0]/100*r.width, w=tip.offsetWidth/2; x=Math.max(w+2,Math.min(r.width-w-2,x));
      tip.style.left=x+'px'; tip.style.top=Math.max(34,(p.clientY-r.top))+'px';
    }
    function hide(){tip.style.display='none'; ln.style.display='none'}
    svg.addEventListener('mousemove',show); svg.addEventListener('touchstart',show,{passive:true}); svg.addEventListener('touchmove',show,{passive:true});
    svg.addEventListener('mouseleave',hide); svg.addEventListener('touchend',function(){setTimeout(hide,1500)});
  });
  document.querySelectorAll('.bd-calc').forEach(function(c){
    var px=+c.getAttribute('data-px'), dv=+c.getAttribute('data-div'), r=c.querySelector('input[type=range]');
    var f=function(v,d){return '$'+v.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d})};
    function upd(){var a=+r.value, sh=a/px, m=sh*dv;
      c.querySelector('.amt').textContent=f(a,0); c.querySelector('.shares').textContent='About '+sh.toLocaleString('en-US',{maximumFractionDigits:1})+' shares at '+f(px,2);
      c.querySelector('[data-o=m]').textContent=f(m,2); c.querySelector('[data-o=y]').textContent=f(m*12,0); c.querySelector('[data-o=d]').textContent=f(m*12/365,2);}
    r.addEventListener('input',upd); upd();
  });
  document.querySelectorAll('[data-more]').forEach(function(b){
    var t=document.getElementById(b.getAttribute('data-more')), lab=b.textContent;
    b.addEventListener('click',function(){t.classList.toggle('open'); b.textContent=t.classList.contains('open')?'Show less':lab;});
  });
})();`;


const TDE_CSS = `
:root{--primary:#2E5D54;--light:#f2faf6}
.content .crumbs{align-self:flex-start;margin:14px 0 10px;font-size:.82rem;color:#888}
.content .crumbs a{color:var(--green-mid);font-weight:700;text-decoration:none}
.ph{background:linear-gradient(155deg,#1A3C34,#2E5D54)}
.ph h1{color:#fff}.ph-stats b{color:#7dffb0}
.bd h2{color:var(--green-dark)}
.rt td.y{color:#1A3C34}
.rt .bar{background:linear-gradient(90deg,#2E5D54,#7dd3a8)}
.verdict{background:#f2faf6;border-color:#c8e6d8;color:#1A3C34}
.pc{border-color:var(--green-mid);color:var(--green-dark)}.pc:hover{background:var(--green-dark)}
.oc:hover{border-color:var(--green-mid)}.oc b{color:var(--green-dark)}
.back a.p{background:var(--green-dark)}.back a.g{border-color:var(--green-mid);color:var(--green-dark)}
.calg .c.paid{background:#dff5eb}.calg .yr{color:var(--green-dark)}
.bd-calc .out b{color:var(--green-dark)}.bd-calc .amt{color:var(--green-dark)}
.chart-tip{position:absolute;pointer-events:none;background:#1A3C34;color:#fff;font-size:.72em;font-weight:700;padding:6px 10px;border-radius:6px;white-space:nowrap;transform:translate(-50%,-110%);display:none;z-index:5}
.range{margin-top:4px}.range-track{position:relative;height:10px;border-radius:6px;background:linear-gradient(90deg,#f3b7b1,#f0d090,#a9e3bc)}
.range-dot{position:absolute;top:50%;width:18px;height:18px;border-radius:50%;background:#1A3C34;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);transform:translate(-50%,-50%)}
.range-lab{display:flex;justify-content:space-between;font-size:.8rem;color:#777;margin-top:8px}
.bd p{margin:0 0 10px}.bd .sub{margin:0 0 14px}
.faq summary{list-style:none}.faq summary::-webkit-details-marker{display:none}.faq summary::before{content:"+ ";color:#2E5D54}
`;

// compact top card on every ETF page: badge, ticker and name on the left, stat cards on the right
const HERO_CSS = `<style id="hero-compact">
.hero-block{display:grid!important;grid-template-columns:auto 1fr auto;grid-template-areas:"badge tk stats" "badge h1 stats" "chips chips chips";column-gap:16px;row-gap:2px;align-items:center;text-align:left!important;padding:18px 22px 16px!important;margin:12px 0 16px!important}
.hero-block .grade-badge{grid-area:badge;width:54px!important;height:54px!important;font-size:1.5rem!important;border-radius:12px!important;margin:0!important;align-self:center}
.hero-block .tk{grid-area:tk;font-size:2.1rem!important;align-self:end}
.hero-block h1{grid-area:h1;font-size:.95rem!important;margin:2px 0 0!important;align-self:start;max-width:440px}
.hero-block .chips{grid-area:chips;justify-content:flex-start!important;margin:12px 0 0!important;gap:6px!important}
.hero-block .chip{padding:3px 10px!important;font-size:.74rem!important}
.hero-block .quick-stats{grid-area:stats;justify-content:flex-end!important;gap:6px!important;flex-wrap:nowrap!important}
.hero-block .stat-pill{padding:7px 10px!important;min-width:0!important;font-size:.7rem!important;text-align:center;white-space:nowrap}
.hero-block .stat-pill strong{font-size:1.05rem!important}
@media(max-width:760px){.hero-block{grid-template-columns:auto 1fr;grid-template-areas:"badge tk" "badge h1" "chips chips" "stats stats"}.hero-block .quick-stats{flex-wrap:wrap!important;justify-content:flex-start!important;margin-top:10px}}
</style>`;
function compactHero(file) {
  if (!fs.existsSync(file)) return;
  const h = fs.readFileSync(file, 'utf8');
  if (h.includes('id="hero-compact"') || !h.includes('class="hero-block"')) return;
  fs.writeFileSync(file, h.replace('</head>', () => HERO_CSS + '\n</head>'));
}

// ETF page upgrade (scoped styles, added to every /etfs/<sym> page we have data for)
const PAGE_CSS = `<style id="tde-bd">
.kt-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:4px 0 12px}
.kt{background:#fff;border:2px solid var(--border);border-radius:10px;padding:13px 12px;text-align:center;text-decoration:none;color:var(--text);box-shadow:0 3px 10px rgba(0,0,0,.06);transition:transform .15s,border-color .15s,box-shadow .15s;position:relative}
.kt::after{content:"\\2192";position:absolute;top:6px;right:9px;font-size:.75em;color:#9bc4b2;font-weight:900}
.kt:hover{transform:translateY(-2px);border-color:var(--green-mid);box-shadow:0 8px 20px rgba(0,0,0,.1)}
.kt em{display:block;font-style:normal;font-size:.64rem;text-transform:uppercase;letter-spacing:.08em;color:#777;font-weight:900}
.kt b{display:block;font-size:1.35rem;color:var(--green-dark);font-weight:900;margin:3px 0 1px}
.kt b.pos{color:#1e9e57}.kt b.neg{color:#c0392b}
.kt small{font-size:.72rem;color:#888}
.xp{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:2px 0 6px;font-size:.82rem}
.xp b{color:#555}
.xp a{padding:7px 12px;border-radius:999px;border:2px solid var(--green-mid);color:var(--green-dark);font-weight:900;text-decoration:none;background:#fff}
.xp a:hover{background:var(--green-dark);color:#fff;border-color:var(--green-dark)}
.tp{background:#fff;border:2px solid var(--border);border-radius:10px;padding:18px 20px;box-shadow:var(--shadow);margin:8px 0 14px}
.tp-h{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.tp-h h3{color:var(--green-dark);font-weight:900;font-size:1.05rem}
.tp-sub{font-size:.86rem;color:var(--text-light);margin:0 0 8px}.tp-sub b{color:var(--green-dark)}
.tp-f{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:.85rem;color:var(--text-mid);margin-top:12px}
.go{font-weight:900;color:var(--green-mid);font-size:.85rem;border-bottom:2px solid #ffd76a;white-space:nowrap}
.click{cursor:pointer;transition:transform .15s,box-shadow .15s,border-color .15s}
.click:hover{transform:translateY(-2px);border-color:var(--green-mid)!important;box-shadow:0 10px 24px rgba(0,0,0,.12)}
.click input,.click button{cursor:auto}
.tp .dh{box-shadow:none;margin-top:12px}
.mg{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}
.mg div{background:#f2faf6;border-radius:8px;padding:9px 11px}
.mg em{display:block;font-style:normal;font-size:.62rem;font-weight:900;text-transform:uppercase;letter-spacing:.07em;color:#777}
.mg b{color:var(--green-dark);font-size:1.05rem}.mg small{display:block;font-size:.7rem;color:#888}
.cal12{display:grid;grid-template-columns:repeat(12,1fr);gap:5px}
.cc{border-radius:8px;padding:8px 2px;text-align:center;background:#f2faf6;line-height:1.3}
.cc em{display:block;font-style:normal;font-size:.62rem;font-weight:900;color:#888;text-transform:uppercase}
.cc b{display:block;color:var(--green-dark);font-size:.86rem}.cc small{font-size:.64rem;color:#888}
.cc.est{background:#fff8e1;border:1.5px dashed #e0b84a}
.lg2{display:flex;gap:18px;flex-wrap:wrap;font-size:.8rem;color:#555;margin-top:6px}
.lg2 i{display:inline-block;width:18px;height:3px;margin-right:6px;vertical-align:3px}
.sw{display:inline-block;width:10px;height:10px;border-radius:3px;margin:0 4px 0 8px;vertical-align:-1px}
.rng{margin:4px 0 6px}.rng-t{position:relative;height:9px;border-radius:6px;background:linear-gradient(90deg,#f3b7b1,#f0d090,#a9e3bc)}
.rng-t span{position:absolute;top:50%;width:16px;height:16px;border-radius:50%;background:#1A3C34;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);transform:translate(-50%,-50%)}
.rank-grid.six{grid-template-columns:repeat(3,1fr)!important}
.chart-box{position:relative}.chart-tip{position:absolute;pointer-events:none;background:#1A3C34;color:#fff;font-size:.72rem;font-weight:700;padding:6px 10px;border-radius:6px;white-space:nowrap;transform:translate(-50%,-110%);display:none;z-index:5}
@media(max-width:760px){.kt-grid{grid-template-columns:1fr 1fr}.mg{grid-template-columns:1fr 1fr}.cal12{grid-template-columns:repeat(4,1fr)}.rank-grid.six{grid-template-columns:1fr 1fr!important}.chart-box svg text{font-size:22px}}
</style>`;

const CLICK_JS = `
  document.querySelectorAll('.click[data-href]').forEach(function(el){
    el.addEventListener('click',function(e){
      if(e.target.closest('a,button,input,select,textarea,label,summary'))return;
      if(e.pointerType==='touch'&&e.target.closest('.chart-box'))return;
      if(String(window.getSelection?window.getSelection():'').length)return;
      var u=el.getAttribute('data-href'); if(e.metaKey||e.ctrlKey)window.open(u,'_blank'); else location.href=u;
    });
  });`;

// ───────────────────────── shell (pieces taken from the ETF pages build-etf-pages.mjs just wrote)
let SHELL = null;
function loadShell(sample) {
  const src = fs.readFileSync(sample, 'utf8');
  const i = src.indexOf('<style>'), j = src.indexOf('</style>', i);
  const grab = (startRe, tag) => { const a = src.search(startRe); if (a < 0) return ''; let depth = 0; const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g'); re.lastIndex = a; let m; while ((m = re.exec(src))) { depth += m[0][1] === '/' ? -1 : 1; if (depth === 0) return src.slice(a, re.lastIndex); } return ''; };
  SHELL = {
    css: src.slice(i + 7, j),
    banner: grab(/<div class="banner">/, 'div'),
    footer: (src.match(/<footer class="footer">[\s\S]*?<\/footer>/) || [''])[0],
    signup: '<!-- EMAIL SIGNUP -->\n    <div class="etf-signup" data-variant="featured" data-color="#1A3C34" data-accent="#2E5D54" data-source="topdividendetfs"></div>\n    <script src="/email-signup.js" defer></script>',
    disclaimer: grab(/<div class="disclaimer-box">/, 'div'),
  };
}

function shell({ title, desc, canonical, crumbs, hero, body, ld }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="TopDividendETFs.com">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:site" content="@TopDividendETFs">
${ld.map(x => `  <script type="application/ld+json">${JSON.stringify(x).replace(/</g, '\\u003c')}</script>`).join('\n')}
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-B8TGV115DP"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-B8TGV115DP');</script>
  <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/etfs/bd.css">
</head>
<body>
  <header onclick="location.href='/'"><div class="logo">TopDividendETFs.com</div></header>
  <div class="content">
${SHELL.banner}
${crumbs}
${hero}
    ${SHELL.signup}
${body}
    ${SHELL.disclaimer}
${SHELL.banner}
    ${SHELL.footer}
  </div>
<script src="/etfs/bd.js" defer></script>
<script src="/sticky-ad.js" defer></script>
</body>
</html>
`;
}

const crumbLD = items => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })) });
const faqLD = qa => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qa.map(([q, a]) => ({ '@type': 'Question', name: q.replace(/<[^>]+>/g, ''), acceptedAnswer: { '@type': 'Answer', text: a.replace(/<[^>]+>/g, '') } })) });
const faqHTML = (sym, label, qa) => `<div class="bd faq"><h2>$${sym} ${label} FAQ</h2>${qa.map(([q, a], i) => `<details${i === 0 ? ' open' : ''}><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>`;
const statBox = s => `<div class="ph-stats">${s.map(([e, b, sm]) => `<div><em>${e}</em><b>${b}</b><small>${sm || '&nbsp;'}</small></div>`).join('')}</div>`;
const dec = r => r.decay === 'YES' ? '<span class="dec yes">Price decay</span>' : r.decay === 'NO' ? '<span class="dec no">No decay</span>' : '';
const gradeColor = g => { const r = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'].indexOf(g); return r < 0 ? '#1A3C34' : r <= 2 ? '#2ecc71' : r <= 5 ? '#7ed957' : r <= 8 ? '#f5a623' : '#e74c3c'; };
const gradeTag = g => g ? `<span class="dec" style="background:${gradeColor(g)};color:#fff">${g}</span>` : '';
const yfmt = v => (Math.round(v * 10) / 10).toString().replace(/\.0$/, '') + '%';

// ───────────────────────── build
async function main() {
  // the ETF list exactly as build-etf-pages.mjs built it (symbol, name, yield, grade)
  const sample = fs.readdirSync(OUT).find(f => /^[a-z0-9.]+\.html$/.test(f) && f !== 'index.html');
  if (!sample) throw new Error('no ETF pages in etfs/, run build-etf-pages.mjs first');
  loadShell(path.join(OUT, sample));
  const mini = JSON.parse(fs.readFileSync(path.join(OUT, sample), 'utf8').match(/var ETFS=(\[\[[\s\S]*?\]\]);/)[1]);

  let sheet = [], pro = [];
  try { sheet = parseCSV(await getText(CSV_URL)); } catch { console.log('  main sheet unavailable'); }
  try { pro = parseCSV(await getText(PRO_CSV)); } catch { console.log('  PRO sheet unavailable'); }
  const key = r => (r.Symbol || '').trim().toUpperCase();
  const sh = Object.fromEntries(sheet.map(r => [key(r), r])), pr = Object.fromEntries(pro.map(r => [key(r), r]));
  const funds = mini.map(([sym, name, y, grade]) => {
    const r = sh[sym] || pr[sym] || {}, p = pr[sym] || {};
    const dcy = (r['Price Decay'] || p['Price Decay'] || '').trim().toUpperCase();
    return { sym, s: sym.toLowerCase(), name, listed: +y || 0, grade, decay: dcy.startsWith('Y') ? 'YES' : dcy.startsWith('N') ? 'NO' : '', issuer: p['Fund Provider'] || '', er: p['Expense Ratio'] || '' };
  }).filter(f => fs.existsSync(path.join(OUT, f.s + '.html')));
  funds.sort((a, b) => b.listed - a.listed || a.sym.localeCompare(b.sym));
  funds.forEach((f, i) => f.rank = i + 1);
  const N = funds.length;
  console.log(`→ ${N} ETF pages to upgrade`);

  const todo = funds.filter(f => !ONLY || ONLY.has(f.sym));
  for (const f of todo) {
    let y = null;
    try { y = await yahoo(f.sym); } catch {}
    if (y && y.bars.length >= 20 && y.divs.length >= 1) {
      try { Object.assign(f, y); analyzeTDE(f); f.built = true; } catch (e) { console.log(`  ${f.sym}: ${e.message}`); }
    }
    if (!f.built) console.log(`  no data for ${f.sym}`);
    if (!CACHE) await sleep(200);
  }
  let built = funds.filter(f => f.built);
  if (!ONLY && built.length < N * 0.6) {
    console.log(`::warning::only ${built.length}/${N} ETFs loaded from Yahoo, keeping last run's breakdown pages`);
    built.forEach(f => f.built = false); built = [];
  }
  const link = (f, m) => f.built ? `/etfs/${f.s}/${m}` : `/etfs/${f.s}`;
  const medianYield = median(funds.map(f => f.listed));
  const rankBy = (k) => { const arr = built.filter(f => ok(f[k])).sort((a, b) => b[k] - a[k]); arr.forEach((f, i) => f[k + 'Rank'] = i + 1); return arr; };
  const byTtm = rankBy('ttmYield'), byTr1 = rankBy('tr1'), byPos = rankBy('pos');
  const peers = f => funds.filter(x => x !== f && x.built).sort((a, b) => Math.abs(a.listed - f.listed) - Math.abs(b.listed - f.listed)).slice(0, 6);
  const perMonth = (f, amt) => amt / f.px * f.monthlyIncomePerShare;

  const teaser = (f, m) => ({
    'yield-trend': f.ttmYield != null ? `Trailing 12-month yield: ${pct(f.ttmYield)}` : `Distribution rate: ${pct(f.rate)}`,
    'dividend-history': `${f.divs.length} payouts since ${f.launch.d.slice(0, 4)}`,
    'dividend-calendar': f.nextEx ? `Next ex-date around ${fd(f.nextEx)}` : 'Ex-dates, month by month',
    'income-calculator': `$10K pays about ${money(perMonth(f, 10000))} a month`,
    'growth-of-10k': `$10K at launch is now ${money0(10000 * f.trNow)}`,
    'total-return-trend': f.tr1 != null ? `1-year total return: ${spct(f.tr1)}` : `Since launch: ${spct(f.trSince)}`,
    '52-week-range': `${Math.round(f.pos)}% of the way up its range`,
    'yield-rank': `#${f.rank} of ${N} dividend ETFs`,
    'price-decay': `Price ${spct(f.pxSince)} since launch`,
  })[m];

  const moreCards = (f, cur) => `<div class="bd"><h2>More $${f.sym} Breakdowns</h2><div class="og">${METRICS.filter(([k]) => k !== cur).map(([k, t, e]) => `<a class="oc" href="/etfs/${f.s}/${k}"><span>${e}</span><b>${t}</b><em>${teaser(f, k)}</em></a>`).join('')}</div></div>`;
  const peerPills = (f, m) => `<div class="bd"><h2>${LABEL[m]} for Similar ETFs</h2><p class="sub">Dividend ETFs with a yield close to $${f.sym}'s.</p><div class="pg">${peers(f).map(p => `<a class="pc" href="/etfs/${p.s}/${m}">$${p.sym} ${LABEL[m]} &rarr;</a>`).join('')}</div></div>`;
  const backs = f => `<div class="back"><a class="p" href="/etfs/${f.s}">&larr; Full $${f.sym} Page</a><a class="g" href="/etfs/highest-yield">Highest Yield ETFs</a><a class="g" href="/etfs/">All Dividend ETFs</a></div>`;
  const crumbs = (f, m) => `    <div class="crumbs"><a href="/">Home</a> &rsaquo; <a href="/etfs/">All ETFs</a> &rsaquo; <a href="/etfs/${f.s}">$${f.sym}</a> &rsaquo; ${LABEL[m]}</div>`;
  const hero = (f, h1, stats) => `    <div class="ph"><h1>${h1}</h1><p>${esc(f.name)} &bull; pays ${f.freqWord} &bull; data through ${fd(f.pxDate)}</p>${statBox(stats)}</div>`;
  const rankRows = (list, f, cols) => list.map(r => `<tr${r === f ? ' class="me"' : ''}>${cols.map(c => c(r)).join('')}</tr>`).join('');
  const nearby = (list, f, k = 2) => { const i = list.indexOf(f); return i < 0 ? [] : list.slice(Math.max(0, i - k), i + k + 1); };
  const fundCell = m => r => `<td><a href="${link(r, m)}">$${r.sym}</a></td>`;
  const nameCell = r => `<td class="nm">${esc(r.name.length > 44 ? r.name.slice(0, 42) + '…' : r.name)}</td>`;
  const perLabel = f => f.n === 12 ? 'month' : f.n === 52 ? 'week' : f.n === 4 ? 'quarter' : 'payout';

  const pages = {};

  // 1. yield trend
  pages['yield-trend'] = f => {
    const w = thin(f.weeks);
    const hasT = f.weeks.filter(x => x.ttm != null).length > 2;
    const key = hasT ? 'ttm' : 'rate';
    const ser = f.weeks.filter(x => x[key] != null);
    const hi = ser.length ? ser.reduce((a, b) => b[key] > a[key] ? b : a) : null, lo = ser.length ? ser.reduce((a, b) => b[key] < a[key] ? b : a) : null;
    const iOf = d => w.findIndex(x => x.d >= d);
    const markers = [];
    if (hi && lo) {
      markers.push({ i: iOf(hi.d), v: hi[key], label: `High ${pct(hi[key])}`, color: RED, dy: -12 });
      if (lo.d !== hi.d) markers.push({ i: iOf(lo.d), v: lo[key], label: `Low ${pct(lo[key])}`, color: GREEN, dy: 20 });
      if (w.at(-1)[key] != null && hi.d !== w.at(-1).d && lo.d !== w.at(-1).d) markers.push({ i: w.length - 1, v: w.at(-1)[key], label: `Now ${pct(w.at(-1)[key])}`, color: GOLD, dy: -12 });
    }
    const chart = lineChart({
      dates: w.map(x => x.d), yFmt: v => (+v.toFixed(1)) + '%', aria: `$${f.sym} yield since launch`,
      series: [{ v: w.map(x => x.rate), color: MINT, width: 2, dash: '5 4' }, ...(hasT ? [{ v: w.map(x => x.ttm), color: GOLD, width: 3, area: true }] : [])],
      markers, tip: i => `${fd(w[i].d)}: ${hasT && w[i].ttm != null ? `trailing ${pct(w[i].ttm)} &middot; ` : ''}rate ${pct(w[i].rate)}`,
    });
    const agoT = f.agoTtm;
    let drivers = '';
    if (agoT && f.payChg != null && f.ttmYield != null) {
      const ych = (f.ttmYield / agoT - 1) * 100;
      const bar = (label, v, col) => { const wv = Math.min(Math.abs(v) * 2, 48); return `<div class="drv"><span>${label}</span><div class="drv-t"><i style="${v >= 0 ? 'left' : 'right'}:50%;width:${wv.toFixed(1)}%;background:${col}"></i><b class="z"></b></div><em style="color:${col}">${spct(v)}</em></div>`; };
      const dir = Math.abs(ych) < 3 ? 'held about steady' : ych > 0 ? 'rose' : 'fell';
      const priceLed = Math.abs(f.pxChg1) > Math.abs(f.payChg);
      let why;
      if (dir === 'held about steady') why = `Its payouts per share changed <b>${spct(f.payChg)}</b> and its share price changed <b>${spct(f.pxChg1)}</b>, so the two roughly offset.`;
      else if (ych > 0) why = priceLed ? `mostly because <b>the share price fell ${Math.abs(f.pxChg1).toFixed(1)}%</b> (${money(f.ago.c)} to ${money(f.px)}), while payouts per share changed ${spct(f.payChg)}. A yield that rises because payouts grow is healthier than one that rises only because the price drops.` : `mostly because <b>payouts per share grew ${f.payChg.toFixed(1)}%</b>, while the share price changed ${spct(f.pxChg1)}. Rising payouts are the healthy way for a yield to climb.`;
      else why = priceLed ? `mostly because <b>the share price rose ${f.pxChg1.toFixed(1)}%</b> (${money(f.ago.c)} to ${money(f.px)}), while payouts per share changed ${spct(f.payChg)}. A falling yield from a rising price is usually good news for shareholders.` : `mostly because <b>payouts per share dropped ${Math.abs(f.payChg).toFixed(1)}%</b>, while the share price changed ${spct(f.pxChg1)}. Shrinking payouts are worth watching.`;
      drivers = `<div class="bd"><h2>&#129300; What Is Driving $${f.sym}'s Yield?</h2><p class="sub">Yield goes up when payouts rise or the share price falls. Here is what happened over the last 12 months.</p>
      ${bar('Payouts per share', f.payChg, GREEN)}${bar('Share price', f.pxChg1, f.pxChg1 >= 0 ? GREEN : RED)}${bar('Yield', ych, GOLD)}
      <div class="verdict">&#128161; $${f.sym}'s trailing yield ${dir} from <b>${pct(agoT)}</b> to <b>${pct(f.ttmYield)}</b>${dir === 'held about steady' ? '. ' + why : ' ' + why}</div></div>`;
    }
    const cols = [r => `<td>#${r.rank}</td>`, fundCell('yield-trend'), nameCell, r => `<td class="y">${yfmt(r.listed)}</td>`, r => `<td>${dec(r)}</td>`];
    const th = '<thead><tr><th>Rank</th><th>ETF</th><th class="nm">Name</th><th>Yield</th><th>Decay</th></tr></thead>';
    const qa = [
      [`What is $${f.sym}'s yield right now?`, `$${f.sym}'s ${f.ttmYield != null ? `trailing 12-month yield is ${pct(f.ttmYield)}` : `distribution rate is ${pct(f.rate)}`} at a share price of ${money(f.px)} (${fd(f.pxDate)}). Its listed yield on TopDividendETFs is ${yfmt(f.listed)}.`],
      ...(agoT && f.ttmYield != null ? [[`Is $${f.sym}'s yield going up or down?`, `It was ${pct(agoT)} a year ago and is ${pct(f.ttmYield)} now. Over that year its payouts per share changed ${spct(f.payChg)} and its share price changed ${spct(f.pxChg1)}.`]] : []),
      ...(hi ? [[`What is the highest yield $${f.sym} has had?`, `${pct(hi[key])} on ${fd(hi.d)}, when the share price was ${money(hi.c)}. Its lowest was ${pct(lo[key])} on ${fd(lo.d)}.`]] : []),
      [`Why are there different yield numbers for $${f.sym}?`, `The listed yield is the figure on our main list, the trailing yield uses what it actually paid over 12 months, and the distribution rate uses only the latest payout times ${f.n}. They split apart when payouts or the price move quickly.`],
    ];
    return {
      title: `$${f.sym} Yield Trend: How Its Dividend Yield Has Changed | TopDividendETFs`,
      desc: `$${f.sym} yield trend: ${f.ttmYield != null ? `trailing 12-month yield of ${pct(f.ttmYield)}${agoT ? `, ${f.ttmYield > agoT ? 'up' : 'down'} from ${pct(agoT)} a year ago` : ''}` : `distribution rate of ${pct(f.rate)}`}. See the chart, what is driving it, and how $${f.sym} ranks against ${N} dividend ETFs.`,
      h1: `$${f.sym} Yield Trend: How Its Dividend Yield Has Changed`,
      stats: [
        [f.ttmYield != null ? 'Trailing 12-Mo Yield' : 'Distribution Rate', pct(f.curYield), f.ttmYield != null ? 'last 12 months of payouts &divide; price' : `latest payout &times; ${f.n} &divide; price`],
        agoT ? ['One Year Ago', pct(agoT), fd(f.ago.d)] : ['Listed Yield', yfmt(f.listed), 'TopDividendETFs list'],
        hi ? ['Highest Since Launch', pct(hi[key]), fd(hi.d)] : ['Yield Rank', `#${f.rank}`, `of ${N}`],
        lo ? ['Lowest Since Launch', pct(lo[key]), fd(lo.d)] : ['Price', money(f.px), fd(f.pxDate)],
      ],
      body: `
    <div class="bd"><h2>&#128200; $${f.sym} Yield Since Launch</h2><p class="sub">Weekly, since $${f.sym} started trading in ${fml(f.launch.d)}.${hasT ? ' The gold line starts once the fund had a full year of payouts.' : ' It has not paid for a full year yet, so this shows the distribution rate.'}</p>
    ${chart}
    <div class="lg">${hasT ? `<span><i style="background:${GOLD}"></i>Trailing 12-month yield</span>` : ''}<span><i style="background:repeating-linear-gradient(90deg,${MINT} 0 5px,transparent 5px 9px)"></i>Distribution rate (latest payout &times; ${f.n} &divide; price)</span></div></div>
    ${drivers}
    <div class="bd prose"><h2>&#128218; What Does Yield Trend Mean?</h2>
      <p>A fund's <b>yield</b> is how much it pays you each year as a percent of its share price. The <b>yield trend</b> shows how that percent has moved over time, so you can tell if today's yield is normal for $${f.sym} or unusually high or low.</p>
      <div class="three">
        <div><em>Listed yield</em><b>${yfmt(f.listed)}</b><small>The yield shown on the TopDividendETFs list.</small></div>
        <div><em>Trailing 12-month yield</em><b>${pct(f.ttmYield)}</b><small>What the fund actually paid over the last 12 months, divided by today's price.</small></div>
        <div><em>Distribution rate</em><b>${pct(f.rate)}</b><small>The latest payout times ${f.n}, divided by today's price. Reacts fastest to changes.</small></div>
      </div>
      <p style="margin-top:12px"><b>How to read it:</b> a steady yield trend means the payouts and the price are moving together. A yield that climbs while the price falls can be a warning sign, because the payout may get cut later. A yield that climbs while the price holds up usually means the fund is paying more.</p></div>
    <div class="two">
      <div class="bd"><h2>&#127942; Where $${f.sym} Ranks</h2><p class="sub">$${f.sym} is <b>#${f.rank} of ${N}</b> dividend ETFs by yield.</p><div class="tw"><table class="rt">${th}<tbody>${rankRows(nearby(funds, f), f, cols)}</tbody></table></div></div>
      <div class="bd"><h2>&#128293; Top 10 Highest Yield ETFs</h2><p class="sub">Click any fund to see its yield trend.</p><div class="tw"><table class="rt">${th}<tbody>${rankRows(funds.slice(0, 10), f, cols)}</tbody></table></div></div>
    </div>`, qa,
    };
  };

  // 2. dividend history
  pages['dividend-history'] = f => {
    const shown = f.divs.slice(f.n >= 52 ? -78 : -60);
    const chart = barChart({
      items: shown.map(x => ({ label: f.n >= 52 ? fd(x.d).replace(/, \d{4}$/, '') : fm(x.d).replace(' 20', " '"), vals: [{ v: x.a, color: TEAL }], tip: `${fd(x.d)}: ${dps(x.a)}` })),
      yFmt: v => '$' + (+v.toFixed(3)), aria: `$${f.sym} dividend per share, each payout`, maxLabels: 10,
      refs: [{ v: f.avg12, label: `12-mo avg ${dps(f.avg12)}`, color: GOLD }],
    });
    const yrs = f.calYears.filter(y => y.n).reverse();
    const yrows = yrs.map((y, i) => { const prev = yrs[i + 1]; const ch = prev && !prev.partial && !y.partial ? (y.div / prev.div - 1) * 100 : null; return `<tr><td><b>${y.y}</b>${y.partial ? ' <small style="color:#999">(partial)</small>' : ''}</td><td>${y.n}</td><td class="y">${dps(y.div)}</td><td class="${ch == null ? '' : ch >= 0 ? 'up' : 'dn'}">${ch == null ? '&nbsp;' : spct(ch)}</td></tr>`; }).join('');
    const list = f.divs.slice(-120).reverse();
    const prows = list.map((x, i) => { const prev = list[i + 1]; const ch = prev ? (x.a / prev.a - 1) * 100 : null; const c = f.at(x.d); const r = c ? x.a * f.n / c.c * 100 : null; return `<tr${i >= 12 ? ' class="more"' : ''}><td>${fd(x.d)}</td><td class="y">${dps(x.a)}</td><td>${pct(r)}</td><td class="${ch == null ? '' : ch > 0.05 ? 'up' : ch < -0.05 ? 'dn' : ''}">${ch == null ? '&nbsp;' : spct(ch)}</td></tr>`; }).join('');
    const yoy = f.yearAgoDiv ? (f.lastDiv.a / f.yearAgoDiv.a - 1) * 100 : null;
    const hiD = f.l12.reduce((a, b) => b.a > a.a ? b : a), loD = f.l12.reduce((a, b) => b.a < a.a ? b : a);
    const qa = [
      [`How much does $${f.sym} pay per share?`, `$${f.sym}'s latest dividend was ${dps(f.lastDiv.a)} per share, with an ex-dividend date of ${fd(f.lastDiv.d)}. Over the last 12 months it paid ${dps(f.ttmDiv)} per share in total.`],
      [`How often does $${f.sym} pay dividends?`, `${f.freq}. It made ${f.perYear} payouts in the last 12 months and ${f.divs.length} since it started trading in ${fml(f.launch.d)}.`],
      [`Has $${f.sym} cut its dividend?`, yoy == null ? `$${f.sym} is too new to compare against a year ago. Over its recent payouts it went up ${f.raises} times and down ${f.cuts} times.` : `Its latest payout is ${spct(yoy)} versus about a year earlier. Across its last 12 payouts it went up ${f.raises} times and down ${f.cuts} times.`],
      [`What is $${f.sym}'s average dividend?`, `${dps(f.avg12)} per share per payout over the last 12 months. The highest was ${dps(hiD.a)} (${fd(hiD.d)}) and the lowest was ${dps(loD.a)} (${fd(loD.d)}).`],
    ];
    return {
      title: `$${f.sym} Dividend History: Every Payout Since ${f.launch.d.slice(0, 4)} | TopDividendETFs`,
      desc: `$${f.sym} dividend history: latest payout ${dps(f.lastDiv.a)} per share (${fd(f.lastDiv.d)}), ${dps(f.ttmDiv)} over the last 12 months. Every payout, yearly totals, raises and cuts.`,
      h1: `$${f.sym} Dividend History: Every Payout`,
      stats: [['Latest Payout', dps(f.lastDiv.a), `ex-date ${fd(f.lastDiv.d)}`], ['12-Month Average', dps(f.avg12), 'per payout'], ['Paid Last 12 Months', dps(f.ttmDiv), `${f.perYear} payouts`], ['Payouts On Record', String(f.divs.length), `since ${fm(f.launch.d)}`]],
      body: `
    <div class="bd"><h2>&#128197; $${f.sym} Dividend Per Share${f.divs.length > shown.length ? `: Last ${shown.length} Payouts` : ''}</h2><p class="sub">Each bar is one payout. Hover or tap a bar for the date and amount.</p>${chart}
    <div class="lg"><span><i class="sq" style="background:${TEAL}"></i>Dividend per share</span><span><i style="background:repeating-linear-gradient(90deg,${GOLD} 0 5px,transparent 5px 9px)"></i>12-month average</span></div>
    <div class="verdict">&#128161; ${yoy != null ? `$${f.sym}'s latest payout of <b>${dps(f.lastDiv.a)}</b> is <b>${spct(yoy)}</b> versus about a year earlier (${dps(f.yearAgoDiv.a)} on ${fd(f.yearAgoDiv.d)}). ` : ''}Over its last 12 payouts it went up <b>${f.raises}</b> times and down <b>${f.cuts}</b> times.</div></div>
    <div class="two">
      <div class="bd"><h2>&#128197; Dividends by Year</h2><p class="sub">Total paid per share each calendar year.</p><div class="tw"><table class="rt"><thead><tr><th>Year</th><th>Payouts</th><th>Total</th><th>vs Prior Year</th></tr></thead><tbody>${yrows}</tbody></table></div></div>
      <div class="bd prose"><h2>&#128218; Reading $${f.sym}'s Dividend History</h2>
        <p>The <b>dividend history</b> lists every cash payout $${f.sym} has made per share, by ex-dividend date. You get the payout if you own shares before the ex-date.</p>
        <p>Many income ETFs, especially option income funds, set each payout from what the fund earned, so the amount moves around. Look at the <b>trend</b> more than any single payout: a steady or rising line is a good sign, a line that keeps stepping down usually means less income ahead.</p>
        <p>Want to see it as a percent of the price? See the <a href="/etfs/${f.s}/yield-trend">$${f.sym} yield trend</a>.</p></div>
    </div>
    <div class="bd"><h2>&#129534; Every $${f.sym} Payout</h2><p class="sub">Newest first. "Rate then" is the payout times ${f.n}, divided by the price on that ex-date.</p>
      <div class="tw"><table class="rt" id="ptab"><thead><tr><th>Ex-Date</th><th>Per Share</th><th>Rate Then</th><th>vs Prior</th></tr></thead><tbody>${prows}</tbody></table></div>
      ${list.length > 12 ? `<button class="more-btn" type="button" data-more="ptab">Show all ${list.length} payouts</button>` : ''}</div>`, qa,
    };
  };

  // 3. dividend calendar
  pages['dividend-calendar'] = f => {
    const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const y0 = Math.max(+f.launch.d.slice(0, 4), +f.pxDate.slice(0, 4) - 3);
    const ys = []; for (let y = +f.pxDate.slice(0, 4); y >= y0; y--) ys.push(y);
    if (f.nextEx && +f.nextEx.slice(0, 4) > ys[0]) ys.unshift(+f.nextEx.slice(0, 4));
    let grid = `<div class="h"></div>${M.map(m => `<div class="h">${m}</div>`).join('')}`;
    for (const y of ys) {
      grid += `<div class="yr">${y}</div>`;
      for (let m = 1; m <= 12; m++) {
        const key = `${y}-${String(m).padStart(2, '0')}`;
        const ds = f.divs.filter(x => x.d.startsWith(key));
        if (ds.length > 2) grid += `<div class="c paid"><b>${dps(ds.reduce((s, x) => s + x.a, 0))}</b><small>${ds.length} payouts</small></div>`;
        else if (ds.length) grid += `<div class="c paid">${ds.map(x => `<b>${dps(x.a)}</b><small>${M[m - 1]} ${+x.d.slice(8)}</small>`).join('')}</div>`;
        else if (f.nextEx && f.nextEx.startsWith(key)) grid += `<div class="c est"><b>Next</b><small>~${M[m - 1]} ${+f.nextEx.slice(8)}</small></div>`;
        else grid += `<div class="c"></div>`;
      }
    }
    const same = built.filter(x => x !== f && x.n === f.n && x.nextEx && Math.abs(days(x.nextEx, f.nextEx)) <= 2).sort((a, b) => b.listed - a.listed).slice(0, 10);
    const when = f.n === 12 && f.exDay ? `around the ${ord(f.exDay)} of each month` : f.n === 52 ? `every week (last one ${fd(f.lastDiv.d)})` : `${f.freqWord} (last one ${fd(f.lastDiv.d)})`;
    const qa = [
      [`When is $${f.sym}'s next ex-dividend date?`, f.nextEx ? `Based on its usual schedule, the next ex-dividend date should land around ${fd(f.nextEx)}. This is an estimate: the fund announces the exact date shortly before.` : `Watch the fund's announcements for the next date.`],
      [`How often does $${f.sym} go ex-dividend?`, `$${f.sym} pays ${f.freqWord}. It usually goes ex-dividend ${when}.`],
      [`How many times a year does $${f.sym} pay?`, `It made ${f.perYear} payouts in the last 12 months.`],
      [`What is an ex-dividend date?`, `It is the cutoff for the payout. You need to own shares before the ex-dividend date to get that dividend. The cash usually arrives a few days later, on the pay date.`],
    ];
    return {
      title: `$${f.sym} Dividend Calendar ${YEAR}: Ex-Dividend Dates and Payouts | TopDividendETFs`,
      desc: `$${f.sym} dividend calendar: ex-dividend dates and payouts month by month.${f.nextEx ? ` Next ex-date expected around ${fd(f.nextEx)}.` : ''} $${f.sym} pays ${f.freqWord}.`,
      h1: `$${f.sym} Dividend Calendar: Ex-Dates and Payouts`,
      stats: [['Next Ex-Date (Est.)', f.nextEx ? fd(f.nextEx).replace(/, \d{4}$/, '') : 'n/a', 'based on its usual schedule'], ['Pays', f.freq, f.n === 12 && f.exDay ? `usually ~${ord(f.exDay)} of the month` : `${f.perYear} times in 12 months`], ['Last Ex-Date', fd(f.lastDiv.d).replace(/, \d{4}$/, ''), `${dps(f.lastDiv.a)} per share`], ['Paid Last 12 Months', dps(f.ttmDiv), 'per share']],
      body: `
    <div class="bd"><h2>&#128198; $${f.sym} Ex-Dividend Calendar</h2><p class="sub">Green boxes are paid dividends (amount and ex-date${f.n >= 52 ? ', or the monthly total for weekly payouts' : ''}). The dashed box is the next expected ex-date, estimated from its usual schedule.</p>
      <div class="tw"><div class="calg">${grid}</div></div></div>
    <div class="two">
      <div class="bd prose"><h2>&#128218; How the $${f.sym} Dividend Calendar Works</h2>
        <p><b>Ex-dividend date:</b> the cutoff. Own $${f.sym} before this date to get the payout. Buy on or after it and the payout goes to the seller.</p>
        <p><b>Pay date:</b> when the cash lands in your account, usually a few days after the ex-date.</p>
        <p>$${f.sym} pays <b>${f.freqWord}</b>${f.nextEx ? `, so the next ex-date should land around <b>${fd(f.nextEx)}</b>` : ''}. Funds announce the exact date shortly before, so treat this as a guide.</p></div>
      <div class="bd"><h2>&#128336; Same Ex-Date Window</h2><p class="sub">ETFs on the same schedule expected to go ex-dividend within 2 days of $${f.sym}.</p>
        ${same.length ? `<div class="tw"><table class="rt"><thead><tr><th>ETF</th><th class="nm">Name</th><th>Next Ex (Est.)</th><th>Yield</th></tr></thead><tbody>${same.map(r => `<tr><td><a href="/etfs/${r.s}/dividend-calendar">$${r.sym}</a></td>${nameCell(r)}<td>~${fd(r.nextEx).replace(/, \d{4}$/, '')}</td><td class="y">${yfmt(r.listed)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="sub">No other fund on our list shares this window.</p>'}</div>
    </div>`, qa,
    };
  };

  // 4. income calculator
  pages['income-calculator'] = f => {
    const dv = f.lastDiv.a, pm = a => perMonth(f, a), pmAvg = a => a / f.px * f.avgMonthlyPerShare;
    const amts = [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
    const goals = [100, 500, 1000, 2000, 5000, 10000];
    const top = funds.filter(x => x.built).slice(0, 10);
    const qa = [
      [`How much does $10,000 in $${f.sym} pay per month?`, `About ${money(pm(10000))} a month on average (${money0(pm(10000) * 12)} a year), based on the latest ${f.freqWord} payout of ${dps(dv)} per share and a price of ${money(f.px)}. That is about ${(10000 / f.px).toFixed(1)} shares.`],
      [`How much do I need in $${f.sym} to make $1,000 a month?`, `About ${money0(1000 / f.monthlyIncomePerShare * f.px)} at today's price and latest payout. Using the 12-month average payout (${dps(f.avg12)}) it would be about ${money0(1000 / f.avgMonthlyPerShare * f.px)}.`],
      [`Is $${f.sym}'s income guaranteed?`, `No. $${f.sym} changes its payout over time (it went up ${f.raises} times and down ${f.cuts} times over its last 12 payouts), and the share price moves too. Use these numbers as an estimate.`],
    ];
    return {
      title: `$${f.sym} Dividend Calculator: Income From $${f.sym} | TopDividendETFs`,
      desc: `$${f.sym} dividend income calculator: $10,000 pays about ${money(pm(10000))} a month at the latest payout of ${dps(dv)} per share. See how much you need for $1,000 a month and more.`,
      h1: `$${f.sym} Income Calculator: What Would It Pay You?`,
      stats: [['Latest Payout', dps(dv), `per share, ${fd(f.lastDiv.d)}`], ['Share Price', money(f.px), fd(f.pxDate)], ['$10K Pays', money(pm(10000)), 'per month, on average'], ['For $1,000/Mo', money0(1000 / f.monthlyIncomePerShare * f.px), 'invested']],
      body: `
    <div class="bd"><h2>&#128176; $${f.sym} Income Calculator</h2><p class="sub">Drag the slider. Based on the latest ${f.freqWord} payout (${dps(dv)}) and price (${money(f.px)}), shown as a monthly average. Payouts change over time.</p>
      <div class="bd-calc" data-px="${f.px.toFixed(4)}" data-div="${f.monthlyIncomePerShare.toFixed(6)}">
        <div><label>Amount invested</label><div class="amt">$10,000</div><input type="range" min="1000" max="1000000" step="1000" value="10000" aria-label="Amount invested"><div class="shares"></div></div>
        <div class="out"><div><em>Per month</em><b data-o="m"></b></div><div><em>Per year</em><b data-o="y"></b></div><div><em>Per day</em><b data-o="d"></b></div></div>
      </div></div>
    <div class="two">
      <div class="bd"><h2>&#128181; $${f.sym} Income by Amount</h2><div class="tw"><table class="rt"><thead><tr><th>Invested</th><th>Shares</th><th>Per ${perLabel(f) === 'month' ? 'Month' : 'Payout'}</th><th>Per Year</th></tr></thead><tbody>${amts.map(a => `<tr${a === 10000 ? ' class="me"' : ''}><td><b>${money0(a)}</b></td><td>${(a / f.px).toLocaleString('en-US', { maximumFractionDigits: 1 })}</td><td class="y">${money(a / f.px * dv)}</td><td>${money0(pm(a) * 12)}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="bd"><h2>&#127919; How Much You Need</h2><p class="sub">Amount to invest in $${f.sym} for each monthly income goal.</p><div class="tw"><table class="rt"><thead><tr><th>Monthly Goal</th><th>At Latest Payout</th><th>At 12-Mo Avg</th></tr></thead><tbody>${goals.map(gl => `<tr><td><b>${money0(gl)}/mo</b></td><td class="y">${money0(gl / f.monthlyIncomePerShare * f.px)}</td><td>${money0(gl / f.avgMonthlyPerShare * f.px)}</td></tr>`).join('')}</tbody></table></div></div>
    </div>
    <div class="bd prose"><h2>&#128218; How This Calculator Works</h2>
      <p>We take the amount you invest, divide by $${f.sym}'s latest closing price to get your shares, then multiply by the latest ${f.freqWord} payout of <b>${dps(dv)}</b> per share, ${f.n} times a year, and show it as a monthly average. The 12-month average payout is <b>${dps(f.avg12)}</b>, so the "At 12-Mo Avg" column gives a smoother estimate.</p>
      <p>Keep in mind: payouts change, the share price moves every day, and taxes come out of what you receive in a regular brokerage account. Reinvesting the payouts instead of spending them buys more shares, which grows future income. See what that did over time on the <a href="/etfs/${f.s}/growth-of-10k">$${f.sym} growth of $10,000</a> page.</p></div>
    <div class="bd"><h2>&#128293; $10,000 in the Top 10 Highest Yield ETFs</h2><p class="sub">Estimated monthly income from each fund's listed yield.</p><div class="tw"><table class="rt"><thead><tr><th>ETF</th><th class="nm">Name</th><th>Yield</th><th>$10K Per Month</th><th>Decay</th></tr></thead><tbody>${(top.includes(f) ? top : [...top, f]).map(r => `<tr${r === f ? ' class="me"' : ''}><td><a href="/etfs/${r.s}/income-calculator">$${r.sym}</a></td>${nameCell(r)}<td class="y">${yfmt(r.listed)}</td><td>${money(10000 * r.listed / 100 / 12)}</td><td>${dec(r)}</td></tr>`).join('')}</tbody></table></div></div>`, qa,
    };
  };

  // 5. growth of 10k
  pages['growth-of-10k'] = f => {
    const w = thin(f.weeks);
    const c0 = f.launch.c, tr0 = f.bars[0].tr;
    const val = x => 10000 * x.tr / tr0, pval = x => 10000 * x.c / c0;
    const cash = 10000 / c0 * f.divs.reduce((s, x) => s + x.a, 0);
    const chart = lineChart({
      dates: w.map(x => x.d), yFmt: v => '$' + (v >= 1000 ? (+(v / 1000).toFixed(1)) + 'K' : Math.round(v)), aria: `Growth of $10,000 in $${f.sym} since launch`,
      series: [{ v: w.map(pval), color: TEAL, width: 2, dash: '5 4' }, { v: w.map(val), color: GOLD, width: 3, area: true }],
      refs: [{ v: 10000, label: '$10,000 start', color: GRAY }],
      tip: i => `${fd(w[i].d)}: ${money0(val(w[i]))} reinvested &middot; ${money0(pval(w[i]))} price only`,
    });
    const yrows = f.calYears.map(y => `<tr><td><b>${y.y}</b>${y.partial ? ' <small style="color:#999">(partial)</small>' : ''}</td><td class="y">${money0(10000 * y.endTr / tr0)}</td><td>${money0(10000 * y.endPx / c0)}</td><td class="${y.tr >= 0 ? 'up' : 'dn'}">${spct(y.tr)}</td></tr>`).reverse().join('');
    const list = byTr1;
    const cols = [r => `<td>#${r.tr1Rank}</td>`, fundCell('growth-of-10k'), nameCell, r => `<td class="y">${money0(10000 * (1 + r.tr1 / 100))}</td>`, r => `<td class="${r.tr1 >= 0 ? 'up' : 'dn'}">${spct(r.tr1)}</td>`];
    const th = '<thead><tr><th>Rank</th><th>ETF</th><th class="nm">Name</th><th>$10K a Year Ago</th><th>1-Yr Return</th></tr></thead>';
    const qa = [
      [`How much would $10,000 in $${f.sym} be worth today?`, `$10,000 invested when $${f.sym} started trading (${fd(f.launch.d)}) would be worth about ${money0(10000 * f.trNow)} today with dividends reinvested, or ${money0(10000 * f.px / c0)} on price alone.`],
      [`How much in dividends would $10,000 in $${f.sym} have paid?`, `About ${money0(cash)} in cash payouts since launch, if you held the original ${(10000 / c0).toFixed(1)} shares and did not reinvest.`],
      [`What is $${f.sym}'s annual return?`, f.cagr != null ? `About ${spct(f.cagr)} per year with dividends reinvested since ${fml(f.launch.d)}.` : `$${f.sym} has traded for less than a year. Its total return since launch is ${spct(f.trSince)}.`],
    ];
    return {
      title: `$${f.sym} Growth of $10,000 Since Launch (Dividends Reinvested) | TopDividendETFs`,
      desc: `$10,000 in $${f.sym} at launch would be worth ${money0(10000 * f.trNow)} today with dividends reinvested, versus ${money0(10000 * f.px / c0)} on price alone. Chart, year-by-year values and how it compares.`,
      h1: `$${f.sym} Growth of $10,000: Dividends Reinvested`,
      stats: [['Worth Today', money0(10000 * f.trNow), 'dividends reinvested'], ['Price Only', money0(10000 * f.px / c0), 'without dividends'], ['Cash Dividends', money0(cash), 'if not reinvested'], [f.cagr != null ? 'Per Year' : 'Since Launch', spct(f.cagr ?? f.trSince), f.cagr != null ? 'annualized total return' : 'total return']],
      body: `
    <div class="bd"><h2>&#127793; $10,000 Invested in $${f.sym} at Launch</h2><p class="sub">Starting ${fd(f.launch.d)} at ${money(c0)} per share. Weekly values.</p>${chart}
      <div class="lg"><span><i style="background:${GOLD}"></i>Dividends reinvested (total return)</span><span><i style="background:repeating-linear-gradient(90deg,${TEAL} 0 5px,transparent 5px 9px)"></i>Price only</span></div>
      <div class="verdict">&#128161; The gap between the two lines is what the dividends added. For $${f.sym} that is <b>${money0(10000 * f.trNow - 10000 * f.px / c0)}</b> on a $10,000 start.</div></div>
    <div class="two">
      <div class="bd"><h2>&#128197; Year by Year</h2><p class="sub">Value of the original $10,000 at each year end.</p><div class="tw"><table class="rt"><thead><tr><th>Year</th><th>Reinvested</th><th>Price Only</th><th>Year Return</th></tr></thead><tbody>${yrows}</tbody></table></div></div>
      <div class="bd prose"><h2>&#128218; Why Reinvesting Matters</h2>
        <p>The <b>growth of $10,000</b> shows what one investment turned into. The gold line assumes every payout bought more $${f.sym} shares on the ex-date. The dashed line ignores the payouts and only tracks the share price.</p>
        <p>For high income funds the price line often lags, because a big part of the return is paid out as cash. A fund whose price line keeps sinking can still have a decent gold line, but only if you reinvest. Check the <a href="/etfs/${f.s}/price-decay">$${f.sym} price decay check</a> to see how the share price has held up.</p></div>
    </div>
    <div class="bd"><h2>&#127942; $10,000 One Year Ago: How $${f.sym} Compares</h2><p class="sub">Dividend ETFs ranked by 1-year total return.${f.tr1 != null ? ` $${f.sym} is #${f.tr1Rank} of ${list.length}.` : ''}</p>
      <div class="tw"><table class="rt">${th}<tbody>${rankRows(list.slice(0, 10), f, cols)}${f.tr1Rank > 10 ? rankRows(nearby(list, f, 1), f, cols) : ''}</tbody></table></div></div>`, qa,
    };
  };

  // 6. total return trend
  pages['total-return-trend'] = f => {
    const cy = f.calYears.slice(-10);
    const bars = barChart({
      items: cy.map(y => ({ label: y.y + (y.partial ? '*' : ''), vals: [{ v: y.tr, color: GOLD }, { v: y.pr, color: TEAL }], tip: `${y.y}${y.partial ? ' (partial)' : ''}: total ${spct(y.tr)} &middot; price ${spct(y.pr)}` })),
      yFmt: v => (+v.toFixed(1)) + '%', aria: `$${f.sym} total return and price return by calendar year`,
    });
    const w = thin(f.weeks.filter(x => x.d >= addDays(f.launch.d, 365)));
    let roll = '';
    if (w.length > 8) {
      const r1 = x => { const b = f.at(addDays(x.d, -365)); return (x.tr / b.tr - 1) * 100; };
      roll = `<div class="bd"><h2>&#128200; Rolling 1-Year Total Return</h2><p class="sub">At each point: the total return over the 12 months before it, dividends included.</p>${lineChart({ dates: w.map(x => x.d), yFmt: v => (+v.toFixed(1)) + '%', aria: `$${f.sym} rolling 1-year total return`, series: [{ v: w.map(r1), color: GOLD, width: 3 }], refs: [{ v: 0, label: '0%', color: GRAY }], tip: i => `${fd(w[i].d)}: ${spct(r1(w[i]))} over 1 year` })}</div>`;
    }
    const rows = cy.slice().reverse().map(y => `<tr><td><b>${y.y}</b>${y.partial ? ' <small style="color:#999">(partial)</small>' : ''}</td><td class="${y.tr >= 0 ? 'up' : 'dn'}">${spct(y.tr)}</td><td class="${y.pr >= 0 ? 'up' : 'dn'}">${spct(y.pr)}</td><td>${spct(y.tr - y.pr)}</td></tr>`).join('');
    const list = byTr1;
    const cols = [r => `<td>#${r.tr1Rank}</td>`, fundCell('total-return-trend'), nameCell, r => `<td class="${r.tr1 >= 0 ? 'up' : 'dn'}">${spct(r.tr1)}</td>`, r => `<td>${yfmt(r.listed)}</td>`];
    const th = '<thead><tr><th>Rank</th><th>ETF</th><th class="nm">Name</th><th>1-Yr Total Return</th><th>Yield</th></tr></thead>';
    const qa = [
      [`What is $${f.sym}'s total return?`, `${f.tr1 != null ? `${spct(f.tr1)} over the last year` : `${spct(f.trSince)} since launch`}, counting the share price and reinvested dividends${f.tr3 != null ? `. Over 3 years it averaged ${spct(f.tr3)} per year` : ''}.`],
      [`What is the difference between total return and price return?`, `Price return only counts the share price. Total return also counts the dividends. For $${f.sym}, dividends added about ${spct(f.tr1 != null ? f.tr1 - f.pxChg1 : f.trSince - f.pxSince)} on top of the price move${f.tr1 != null ? ' over the last year' : ''}.`],
      [`What was $${f.sym}'s worst drop?`, `Its biggest drop from a high, dividends included, was ${spct(f.mdd)}.`],
    ];
    return {
      title: `$${f.sym} Total Return: Yearly Returns With Dividends | TopDividendETFs`,
      desc: `$${f.sym} total return ${f.tr1 != null ? `over 1 year: ${spct(f.tr1)}` : `since launch: ${spct(f.trSince)}`}, with dividends reinvested. Calendar-year returns, price vs. total return, rolling returns and how it ranks.`,
      h1: `$${f.sym} Total Return Trend: Price Plus Dividends`,
      stats: [f.tr1 != null ? ['1-Year Total Return', spct(f.tr1), 'dividends reinvested'] : ['Since Launch', spct(f.trSince), 'total return'], f.tr3 != null ? ['3-Year (Per Year)', spct(f.tr3), 'annualized'] : ['Per Year', f.cagr != null ? spct(f.cagr) : 'n/a', 'since launch'], f.pxChg1 != null ? ['1-Year Price Return', spct(f.pxChg1), 'share price only'] : ['Price Since Launch', spct(f.pxSince), 'share price only'], ['Max Drawdown', spct(f.mdd), 'worst drop from a high']],
      body: `
    <div class="bd"><h2>&#128202; $${f.sym} Returns by Calendar Year</h2><p class="sub">Gold is total return (price plus dividends). Green is price only.${cy.some(y => y.partial) ? ' * marks a partial year.' : ''}</p>${bars}
      <div class="lg"><span><i class="sq" style="background:${GOLD}"></i>Total return</span><span><i class="sq" style="background:${TEAL}"></i>Price return</span></div></div>
    ${roll}
    <div class="two">
      <div class="bd"><h2>&#128197; Year-by-Year Returns</h2><div class="tw"><table class="rt"><thead><tr><th>Year</th><th>Total</th><th>Price</th><th>From Dividends</th></tr></thead><tbody>${rows}</tbody></table></div></div>
      <div class="bd prose"><h2>&#128218; What Total Return Tells You</h2>
        <p><b>Total return</b> is the full result of owning $${f.sym}: the change in the share price plus every dividend, reinvested. It is the fairest way to compare an income fund with anything else.</p>
        <p>A high yield with a weak total return means the price is giving back much of what the fund pays out. A total return that keeps up with the yield means the fund is paying you without eating into the price.</p></div>
    </div>
    <div class="bd"><h2>&#127942; 1-Year Total Return Rankings</h2><p class="sub">Dividend ETFs ranked by total return over the last year.${f.tr1 != null ? ` $${f.sym} is #${f.tr1Rank} of ${list.length}.` : ''}</p>
      <div class="tw"><table class="rt">${th}<tbody>${rankRows(list.slice(0, 10), f, cols)}${f.tr1Rank > 10 ? rankRows(nearby(list, f, 1), f, cols) : ''}</tbody></table></div></div>`, qa,
    };
  };

  // 7. 52-week range
  pages['52-week-range'] = f => {
    const b = f.y1bars, short = f.ageDays < 360;
    const hiI = b.indexOf(f.hi52), loI = b.indexOf(f.lo52);
    const chart = lineChart({
      dates: b.map(x => x.d), yFmt: v => '$' + (+v.toFixed(2)), aria: `$${f.sym} share price over the last year`,
      series: [{ v: b.map(x => x.c), color: TEAL, width: 2.5, area: true }],
      markers: [{ i: hiI, v: f.hi52.c, label: `High ${money(f.hi52.c)}`, color: GREEN, dy: -12 }, ...(loI !== hiI ? [{ i: loI, v: f.lo52.c, label: `Low ${money(f.lo52.c)}`, color: RED, dy: 20 }] : [])],
      tip: i => `${fd(b[i].d)}: ${money(b[i].c)}`,
    });
    const where = f.pos >= 80 ? 'near the top of' : f.pos <= 20 ? 'near the bottom of' : f.pos >= 55 ? 'in the upper half of' : f.pos <= 45 ? 'in the lower half of' : 'around the middle of';
    const list = byPos;
    const cols = [fundCell('52-week-range'), nameCell, r => `<td>${money(r.px)}</td>`, r => `<td class="barc"><div class="bar" style="width:${Math.max(3, r.pos).toFixed(0)}%"></div></td>`, r => `<td><b>${Math.round(r.pos)}%</b></td>`];
    const th = '<thead><tr><th>ETF</th><th class="nm">Name</th><th>Price</th><th>Range</th><th>Position</th></tr></thead>';
    const qa = [
      [`What is $${f.sym}'s 52-week high and low?`, `${short ? 'Since it launched' : 'Over the last 52 weeks'}, $${f.sym}'s high close was ${money(f.hi52.c)} (${fd(f.hi52.d)}) and its low close was ${money(f.lo52.c)} (${fd(f.lo52.d)}).`],
      [`Is $${f.sym} near its 52-week high?`, `At ${money(f.px)}, $${f.sym} is ${Math.abs(f.offHi).toFixed(1)}% below its high and ${f.overLo.toFixed(1)}% above its low, about ${Math.round(f.pos)}% of the way up its range.`],
      [`Does the 52-week range include dividends?`, `No. It only tracks the share price. Income ETFs drop by about the payout amount on each ex-date, so high payers often sit lower in their range than their total return suggests.`],
    ];
    return {
      title: `$${f.sym} 52-Week High and Low: Where the Price Sits | TopDividendETFs`,
      desc: `$${f.sym} 52-week range: low ${money(f.lo52.c)}, high ${money(f.hi52.c)}, now ${money(f.px)} (${Math.round(f.pos)}% of the way up). Price chart and every dividend ETF ranked by range position.`,
      h1: `$${f.sym} 52-Week Range: High, Low and Today's Price`,
      stats: [['Price', money(f.px), fd(f.pxDate)], ['52-Week High', money(f.hi52.c), fd(f.hi52.d)], ['52-Week Low', money(f.lo52.c), fd(f.lo52.d)], ['Position', Math.round(f.pos) + '%', 'of the way up the range']],
      body: `
    <div class="bd"><h2>&#128207; Where $${f.sym} Sits in Its Range</h2><p class="sub">${short ? `$${f.sym} launched ${fd(f.launch.d)}, so this is its range since launch.` : 'Daily closing prices over the last 52 weeks.'}</p>
      <div class="range"><div class="range-track"><span class="range-dot" style="left:${Math.min(100, Math.max(0, f.pos)).toFixed(1)}%"></span></div><div class="range-lab"><span>${money(f.lo52.c)}</span><span style="font-weight:900;color:var(--green-dark)">${money(f.px)}</span><span>${money(f.hi52.c)}</span></div></div>
      <div class="verdict">&#128161; $${f.sym} is trading <b>${where}</b> its ${short ? 'since-launch' : '52-week'} range: <b>${Math.abs(f.offHi).toFixed(1)}%</b> below the high and <b>${f.overLo.toFixed(1)}%</b> above the low.</div></div>
    <div class="bd"><h2>&#128200; $${f.sym} Price, ${short ? 'Since Launch' : 'Last 12 Months'}</h2>${chart}</div>
    <div class="bd prose"><h2>&#128218; What the 52-Week Range Means</h2>
      <p>The <b>52-week range</b> is the lowest and highest closing price over the last year. Where today's price falls inside it is a quick read on momentum: near the high means the price has been holding up, near the low means it has been sliding.</p>
      <p>For income ETFs, the price drops by about the payout on every ex-date, so the range alone does not show how you did. Pair it with the <a href="/etfs/${f.s}/total-return-trend">$${f.sym} total return trend</a>.</p></div>
    <div class="two">
      <div class="bd"><h2>&#11014;&#65039; Closest to Their Highs</h2><div class="tw"><table class="rt">${th}<tbody>${rankRows(list.slice(0, 10), f, cols)}</tbody></table></div></div>
      <div class="bd"><h2>&#11015;&#65039; Closest to Their Lows</h2><div class="tw"><table class="rt">${th}<tbody>${rankRows(list.slice(-10).reverse(), f, cols)}</tbody></table></div></div>
    </div>
    ${f.posRank > 10 && f.posRank <= list.length - 10 ? `<div class="bd"><h2>ETFs Near $${f.sym}</h2><div class="tw"><table class="rt">${th}<tbody>${rankRows(nearby(list, f), f, cols)}</tbody></table></div></div>` : ''}`, qa,
    };
  };

  // 8. yield rank
  pages['yield-rank'] = f => {
    const maxY = funds[0].listed || 1;
    const above = funds.filter(x => x.listed < f.listed).length;
    const pctile = Math.round(above / Math.max(1, N - 1) * 100);
    const rows = funds.map(r => `<tr${r === f ? ' class="me"' : Math.abs(r.rank - f.rank) > 5 && r.rank > 15 ? ' class="more"' : ''}><td>#${r.rank}</td><td><a href="${link(r, 'yield-rank')}">$${r.sym}</a></td>${nameCell(r)}<td class="y">${yfmt(r.listed)}</td><td class="barc"><div class="bar" style="width:${(r.listed / maxY * 100).toFixed(1)}%"></div></td><td>${gradeTag(r.grade)}</td><td>${dec(r)}</td></tr>`).join('');
    const noDecay = funds.filter(x => x.decay === 'NO');
    const ndRank = noDecay.indexOf(f) + 1;
    const qa = [
      [`Where does $${f.sym} rank by yield?`, `#${f.rank} of ${N} dividend ETFs on TopDividendETFs, with a listed yield of ${yfmt(f.listed)}. That is higher than ${pctile}% of them.`],
      [`What is the average dividend ETF yield?`, `The median listed yield across the ${N} ETFs on TopDividendETFs is ${yfmt(medianYield)}. $${f.sym} is ${f.listed >= medianYield ? 'above' : 'below'} that.`],
      ...(f.ttmYield != null ? [[`What is $${f.sym}'s rank by trailing 12-month yield?`, `#${f.ttmYieldRank} of ${byTtm.length}, based on what it actually paid over the last 12 months (${pct(f.ttmYield)}).`]] : []),
      [`Is a higher yield always better?`, `No. Very high yields often come with share prices that sink over time. Check the grade, the price decay column and the total return, not just the yield.`],
    ];
    return {
      title: `$${f.sym} Yield Rank: #${f.rank} of ${N} Dividend ETFs | TopDividendETFs`,
      desc: `$${f.sym} ranks #${f.rank} of ${N} dividend ETFs by yield (${yfmt(f.listed)}), higher than ${pctile}% of them. Full ranking of every ETF by yield, with grades and price decay.`,
      h1: `$${f.sym} Yield Rank: #${f.rank} of ${N} Dividend ETFs`,
      stats: [['Yield Rank', `#${f.rank}`, `of ${N} ETFs`], ['Listed Yield', yfmt(f.listed), `median is ${yfmt(medianYield)}`], ['Higher Than', pctile + '%', 'of dividend ETFs'], f.ttmYield != null ? ['Trailing Yield Rank', `#${f.ttmYieldRank}`, `${pct(f.ttmYield)} actually paid`] : ['Distribution Rate', pct(f.rate), `latest payout &times; ${f.n}`]],
      body: `
    <div class="bd"><h2>&#127942; Every Dividend ETF, Ranked by Yield</h2><p class="sub">$${f.sym} is highlighted. Click any fund to see where it ranks.</p>
      <div class="tw"><table class="rt" id="ytab"><thead><tr><th>Rank</th><th>ETF</th><th class="nm">Name</th><th>Yield</th><th>&nbsp;</th><th>Grade</th><th>Decay</th></tr></thead><tbody>${rows}</tbody></table></div>
      <button class="more-btn" type="button" data-more="ytab">Show all ${N} ETFs</button></div>
    <div class="bd prose"><h2>&#128218; What Yield Rank Tells You</h2>
      <p>The <b>yield rank</b> puts $${f.sym} in line with every ETF on TopDividendETFs, from the highest listed yield down. $${f.sym} sits at <b>#${f.rank}</b>, ahead of ${pctile}% of the field.</p>
      <p>${f.decay === 'NO' && ndRank ? `$${f.sym} is also rated <b>no price decay</b>, which ranks it <b>#${ndRank} of ${noDecay.length}</b> among ETFs without price decay. ` : f.decay === 'YES' ? `$${f.sym} is rated <b>price decay</b>, meaning its share price has generally declined since inception. A high yield on a shrinking price can pay you less over time. ` : ''}The top of the list is crowded with option income funds that pay very high yields. Some hold their price; many do not. See the <a href="/etfs/${f.s}/price-decay">$${f.sym} price decay check</a>.</p></div>`, qa,
    };
  };

  // 9. price decay
  pages['price-decay'] = f => {
    const w = thin(f.weeks);
    const c0 = f.launch.c;
    const chart = lineChart({
      dates: w.map(x => x.d), yFmt: v => '$' + (+v.toFixed(2)), aria: `$${f.sym} share price since launch`,
      series: [{ v: w.map(x => x.c), color: TEAL, width: 2.5, area: true }],
      refs: [{ v: c0, label: `Launch price ${money(c0)}`, color: GOLD }],
      tip: i => `${fd(w[i].d)}: ${money(w[i].c)} (${spct((w[i].c / c0 - 1) * 100)} vs launch)`,
    });
    const rating = f.decay === 'YES' ? 'Price decay' : f.decay === 'NO' ? 'No price decay' : 'Not rated';
    const below = f.px < c0;
    const mismatch = (f.decay === 'NO' && below) || (f.decay === 'YES' && !below);
    const top = funds.filter(x => x.decay === 'NO' && x.built).slice(0, 10);
    const nd = funds.filter(x => x.decay === 'NO').length, yd = funds.filter(x => x.decay === 'YES').length;
    const qa = [
      [`Does $${f.sym} have price decay?`, `TopDividendETFs rates $${f.sym} as "${rating}". Its share price is ${spct(f.pxSince)} since it launched at ${money(c0)} on ${fd(f.launch.d)}.`],
      [`Has $${f.sym} made money even with the price change?`, `Counting the dividends, $${f.sym}'s total return since launch is ${spct(f.trSince)}, versus ${spct(f.pxSince)} on price alone.`],
      [`What is price decay (NAV erosion)?`, `Price decay means a fund's share price has generally declined since inception. It usually happens when a fund pays out more than it earns, so part of each payout comes out of the share price. It refers to the price only, not total return.`],
    ];
    return {
      title: `Does $${f.sym} Have Price Decay? Share Price Since Launch | TopDividendETFs`,
      desc: `$${f.sym} price decay check: rated "${rating}". Share price ${spct(f.pxSince)} since launch (${money(c0)} to ${money(f.px)}), total return ${spct(f.trSince)}. Chart and the highest yield ETFs with no price decay.`,
      h1: `$${f.sym} Price Decay Check: Has the Share Price Held Up?`,
      stats: [['Our Rating', rating, 'TopDividendETFs rating'], ['Price vs Launch', spct(f.pxSince), `${money(c0)} to ${money(f.px)}`], ['Total Return', spct(f.trSince), 'since launch, with dividends'], ['Launched', fm(f.launch.d), `${f.yrs.toFixed(1)} years ago`]],
      body: `
    <div class="bd"><h2>&#9888;&#65039; $${f.sym} Share Price Since Launch</h2><p class="sub">Weekly closes. The gold dashed line is the launch price of ${money(c0)}.</p>${chart}
      <div class="lg"><span><i class="sq" style="background:${TEAL}"></i>Share price</span><span><i style="background:repeating-linear-gradient(90deg,${GOLD} 0 5px,transparent 5px 9px)"></i>Launch price</span></div>
      <div class="verdict">&#128161; $${f.sym}'s share price is <b>${spct(f.pxSince)}</b> since launch, while its total return with dividends is <b>${spct(f.trSince)}</b>. ${mismatch ? (below ? 'The price is below where it started right now, but our rating looks at whether the price has generally declined over its life, not one day.' : 'The price is above where it started right now, but our rating looks at whether the price has generally declined over its life, not one day.') : f.decay === 'NO' ? 'The price has held up, so the payouts have not come out of your principal.' : f.decay === 'YES' ? 'The price has slid, so part of what it pays has come out of the share price.' : ''}</div></div>
    <div class="bd prose"><h2>&#128218; What Price Decay Means</h2>
      <p><b>Price decay</b>, also called NAV erosion, means a fund's share price has generally declined since inception. It is common with very high yield funds that pay out more than they earn: each payout shrinks the price a little, and over time the shares are worth less.</p>
      <div class="three">
        <div><em>Launch price</em><b>${money(c0)}</b><small>${fd(f.launch.d)}</small></div>
        <div><em>Price now</em><b>${money(f.px)}</b><small>${fd(f.pxDate)}</small></div>
        <div><em>Dividends paid</em><b>${dps(f.divs.reduce((s, x) => s + x.a, 0))}</b><small>per share since launch</small></div>
      </div>
      <p style="margin-top:12px"><b>Why it matters:</b> a shrinking share price means each future payout is usually smaller in dollars, even if the yield stays the same. Of the ${N} ETFs on TopDividendETFs, <b>${nd}</b> are rated no price decay and <b>${yd}</b> are rated price decay.</p></div>
    <div class="bd"><h2>&#9989; Highest Yield ETFs With No Price Decay</h2><div class="tw"><table class="rt"><thead><tr><th>ETF</th><th class="nm">Name</th><th>Yield</th><th>Price vs Launch</th><th>Grade</th></tr></thead><tbody>${(top.includes(f) ? top : [...top, f]).map(r => `<tr${r === f ? ' class="me"' : ''}><td><a href="/etfs/${r.s}/price-decay">$${r.sym}</a></td>${nameCell(r)}<td class="y">${yfmt(r.listed)}</td><td class="${r.pxSince >= 0 ? 'up' : 'dn'}">${spct(r.pxSince)}</td><td>${gradeTag(r.grade)}</td></tr>`).join('')}</tbody></table></div></div>`, qa,
    };
  };

  // ── write
  fs.writeFileSync(path.join(OUT, 'bd.css'), SHELL.css + '\n/* breakdown pages */\n' + BD_CSS + TDE_CSS);
  fs.writeFileSync(path.join(OUT, 'bd.js'), BD_JS.replace(/\}\)\(\);\s*$/, CLICK_JS + '\n})();'));
  let count = 0, upgraded = 0, kept = 0;
  for (const f of funds) {
    const dir = path.join(OUT, f.s);
    if (!f.built) { // keep last run's breakdown pages for this ETF
      compactHero(path.join(OUT, f.s + '.html'));
      const pd = path.join(PREV, f.s);
      if (fs.existsSync(pd)) { fs.cpSync(pd, dir, { recursive: true }); kept++; }
      continue;
    }
    const pd = path.join(PREV, f.s);
    if (!FULL && fs.existsSync(path.join(pd, 'price-decay.html'))) { fs.cpSync(pd, dir, { recursive: true }); kept++; }
    else {
    fs.mkdirSync(dir, { recursive: true });
    for (const [m, label] of METRICS) {
      let p;
      try { p = pages[m](f); } catch (e) { console.log(`  ${f.sym}/${m} failed: ${e.message}`); continue; }
      const canonical = `${SITE}/etfs/${f.s}/${m}`;
      const body = `${p.body}\n    ${moreCards(f, m)}\n    ${peerPills(f, m)}\n    ${faqHTML(f.sym, label, p.qa)}\n    ${backs(f)}`;
      fs.writeFileSync(path.join(dir, m + '.html'), shell({ title: p.title, desc: p.desc, canonical, crumbs: crumbs(f, m), hero: hero(f, p.h1, p.stats), body, ld: [crumbLD([['Home', SITE + '/'], ['All ETFs', SITE + '/etfs/'], ['$' + f.sym, `${SITE}/etfs/${f.s}`], [label, canonical]]), faqLD(p.qa)] }));
      count++;
    }
    }
    try { upgradePage(f); upgraded++; } catch (e) { console.log(`  ${f.sym} page upgrade failed: ${e.message}`); }
    compactHero(path.join(OUT, f.s + '.html'));
  }
  console.log(`✓ ${count} breakdown pages written, ${upgraded} ETF pages upgraded, ${kept} ETFs reused last run's breakdown pages`);

  // ───────── the ETF page itself: Key Numbers, payout chart, calendar, performance, clickable boxes
  function upgradePage(f) {
    const file = path.join(OUT, f.s + '.html');
    let h = fs.readFileSync(file, 'utf8');
    if (h.includes('id="tde-bd"')) return;
    const S = f.sym, B = m => `/etfs/${f.s}/${m}`;
    const has = a => h.includes(a);
    const rep = (a, b) => { const i = h.indexOf(a); if (i < 0) return false; h = h.slice(0, i) + b + h.slice(i + a.length); return true; };
    const short = d => fd(d).replace(/, \d{4}$/, '');

    // hero: price pill first
    const qs = h.indexOf('<div class="quick-stats">');
    if (qs > -1) { const at = qs + '<div class="quick-stats">'.length; h = h.slice(0, at) + `\n        <div class="stat-pill"><a href="${B('52-week-range')}"><strong>${money(f.px)}</strong>Price ${short(f.pxDate)}</a></div>` + h.slice(at); }

    // Key Numbers + Explore, right after the answer box
    const tiles = [
      f.ttmYield != null ? ['Trailing 12-Mo Yield', pct(f.ttmYield), 'what it actually paid', 'yield-trend'] : ['Distribution Rate', pct(f.rate), `latest payout &times; ${f.n}`, 'yield-trend'],
      ['Last Payout', dps(f.lastDiv.a), 'ex-date ' + short(f.lastDiv.d), 'dividend-history'],
      ['Next Ex-Date', f.nextEx ? '~' + short(f.nextEx) : 'n/a', 'estimated', 'dividend-calendar'],
      ['Pays', f.freq, `${f.perYear} payouts in 12 months`, 'dividend-calendar'],
      f.tr1 != null ? ['1-Year Total Return', spct(f.tr1), 'dividends reinvested', 'total-return-trend', f.tr1 >= 0] : ['Since Launch', spct(f.trSince), 'total return', 'total-return-trend', f.trSince >= 0],
      f.tr3 != null ? ['3-Year Total Return', spct(f.tr3), 'per year', 'total-return-trend', f.tr3 >= 0] : ['1-Year Price Change', f.pxChg1 != null ? spct(f.pxChg1) : spct(f.pxSince), f.pxChg1 != null ? 'share price only' : 'since launch', 'total-return-trend', (f.pxChg1 ?? f.pxSince) >= 0],
      ['$10K Since ' + f.launch.d.slice(0, 4), money0(10000 * f.trNow), 'dividends reinvested', 'growth-of-10k', f.trNow >= 1],
      ['Worst Drop', spct(f.mdd), 'from a high', 'total-return-trend', false],
      ['Price vs Launch', spct(f.pxSince), money(f.launch.c) + ' to ' + money(f.px), 'price-decay', f.pxSince >= 0],
      ['52-Week Position', Math.round(f.pos) + '%', 'of the way up its range', '52-week-range'],
      f.er ? ['Expense Ratio', esc(f.er), 'per year', 'income-calculator'] : ['$10K Pays', money(perMonth(f, 10000)), 'per month', 'income-calculator'],
      ['Yield Rank', '#' + f.rank, 'of ' + N + ' ETFs', 'yield-rank'],
    ];
    const chips = METRICS.map(([m, t, e]) => [m, `${e} ${t.replace('Growth of $10,000', 'Growth of $10K').replace('Total Return Trend', 'Total Return').replace(' Check', '')}`]);
    const keyNums = `
    <h2 class="section-title">${S} Key Numbers</h2>
    <p class="section-lead">The numbers dividend investors check first. Tap any box for the full breakdown.</p>
    <div class="kt-grid">${tiles.map(([e, b, sm, m, pos]) => `<a class="kt" href="${B(m)}"><em>${e}</em><b${pos === true ? ' class="pos"' : pos === false ? ' class="neg"' : ''}>${b}</b><small>${sm}</small></a>`).join('')}</div>
    <div class="xp"><b>Explore $${S}:</b>${chips.map(([m, t]) => `<a href="${B(m)}">${t}</a>`).join('')}</div>
`;
    const ab = h.indexOf('<div class="answer-box">');
    if (ab > -1) { const end = h.indexOf('</div>', h.indexOf('</p>', ab)) + 6; h = h.slice(0, end) + keyNums + h.slice(end); }

    // payout chart box (wraps the existing payout table when there is one)
    const shown = f.divs.slice(-36);
    const hiD = f.l12.reduce((a, b) => b.a > a.a ? b : a), loD = f.l12.reduce((a, b) => b.a < a.a ? b : a);
    const divChart = barChart({ items: shown.map(x => ({ label: f.n === 52 ? short(x.d) : fm(x.d).replace(' 20', " '"), vals: [{ v: x.a, color: TEAL }], tip: `${fd(x.d)}: ${dps(x.a)}` })), yFmt: v => '$' + (+v.toFixed(v < 1 ? 2 : 1)), aria: `${S} dividends`, maxLabels: 9, H: 240, refs: [{ v: f.avg12, label: `12-mo avg ${dps(f.avg12)}`, color: GOLD }] });
    const mini = a => `<div class="mg">${a.map(([e, b, sm]) => `<div><em>${e}</em><b>${b}</b><small>${sm}</small></div>`).join('')}</div>`;
    const span = shown.length < f.divs.length ? `Last ${shown.length} Payouts` : 'Every Payout Since Launch';
    const divBox = `<div class="tp click" data-href="${B('dividend-history')}">
      <div class="tp-h"><h3>&#128197; ${S} Dividends: ${span}</h3><span class="go">Full dividend history &rarr;</span></div>
      ${divChart}
      ${mini([['12-Mo Average', dps(f.avg12), 'per payout'], ['Highest', dps(hiD.a), fd(hiD.d)], ['Lowest', dps(loD.a), fd(loD.d)], ['Raises vs Cuts', `${f.raises} up / ${f.cuts} down`, 'last 12 payouts']])}
    `;
    const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const lab = d => f.n >= 52 ? `${M[+d.slice(5, 7) - 1]} ${+d.slice(8)}` : `${M[+d.slice(5, 7) - 1]} '${d.slice(2, 4)}`;
    const cells = f.divs.slice(-11).map(x => `<div class="cc"><em>${lab(x.d)}</em><b>${dps(x.a)}</b><small>ex ${M[+x.d.slice(5, 7) - 1]} ${+x.d.slice(8)}</small></div>`).join('') + (f.nextEx ? `<div class="cc est"><em>${lab(f.nextEx)}</em><b>Next</b><small>~${M[+f.nextEx.slice(5, 7) - 1]} ${+f.nextEx.slice(8)}</small></div>` : '');
    const calBox = `
    <h2 class="section-title">${S} Dividend Calendar</h2>
    <p class="section-lead">${S} pays ${f.freqWord}.${f.n === 12 && f.exDay ? ` It usually goes ex-dividend around the ${ord(f.exDay)} of the month.` : ''} Own it before the ex-date to get the payout.</p>
    <div class="tp click" data-href="${B('dividend-calendar')}">
      <div class="cal12">${cells}</div>
      <div class="tp-f"><span>${f.nextEx ? `Next ex-date expected around <b>${fd(f.nextEx)}</b> (estimate)` : 'Every past ex-date and payout'}</span><span class="go">Full dividend calendar &rarr;</span></div>
    </div>
`;
    if (has('<div class="dh" id="dh">') && has('<div class="dh-pro">')) {
      rep('<div class="dh" id="dh">', divBox + '<div class="dh" id="dh">');
      rep('<div class="dh-pro">', '</div>\n    <div class="dh-pro">');
    }

    // performance charts
    const w = thin(f.weeks, 200), c0 = f.launch.c, tr0 = f.bars[0].tr;
    const gChart = lineChart({ dates: w.map(x => x.d), H: 260, yFmt: v => '$' + (+(v / 1000).toFixed(1)) + 'K', aria: `Growth of $10,000 in ${S}`, series: [{ v: w.map(x => 10000 * x.c / c0), color: TEAL, width: 2, dash: '5 4' }, { v: w.map(x => 10000 * x.tr / tr0), color: GOLD, width: 3, area: true }], refs: [{ v: 10000, label: '$10,000 start', color: GRAY }], tip: i => `${fd(w[i].d)}: ${money0(10000 * w[i].tr / tr0)} reinvested &middot; ${money0(10000 * w[i].c / c0)} price only` });
    const yt = thin(f.weeks.filter(x => x.d >= addDays(f.pxDate, -365 * 3)), 160);
    const hasT = yt.some(x => x.ttm != null);
    const yChart = lineChart({ dates: yt.map(x => x.d), H: 250, yFmt: v => (+v.toFixed(1)) + '%', aria: `${S} yield trend`, series: [{ v: yt.map(x => x.rate), color: MINT, width: 2, dash: '5 4' }, ...(hasT ? [{ v: yt.map(x => x.ttm), color: GOLD, width: 3 }] : [])], tip: i => `${fd(yt[i].d)}: ${yt[i].ttm != null ? 'trailing ' + pct(yt[i].ttm) : 'rate ' + pct(yt[i].rate)}` });
    const cy = f.calYears.slice(-7);
    const tChart = barChart({ H: 250, items: cy.map(z => ({ label: z.y + (z.partial ? '*' : ''), vals: [{ v: z.tr, color: GOLD }, { v: z.pr, color: TEAL }], tip: `${z.y}: total ${spct(z.tr)} &middot; price ${spct(z.pr)}` })), yFmt: v => (+v.toFixed(0)) + '%', aria: `${S} returns by year` });
    const b1 = f.y1bars;
    const rChart = lineChart({ dates: b1.map(x => x.d), H: 220, yFmt: v => '$' + (+v.toFixed(v < 20 ? 1 : 0)), aria: `${S} price, last year`, series: [{ v: b1.map(x => x.c), color: TEAL, width: 2.5, area: true }], markers: [{ i: b1.indexOf(f.hi52), v: f.hi52.c, label: 'High ' + money(f.hi52.c), color: GREEN, dy: -12 }, ...(f.lo52 !== f.hi52 ? [{ i: b1.indexOf(f.lo52), v: f.lo52.c, label: 'Low ' + money(f.lo52.c), color: RED, dy: 20 }] : [])], tip: i => `${fd(b1[i].d)}: ${money(b1[i].c)}` });
    const pw = thin(f.weeks, 160);
    const pChart = lineChart({ dates: pw.map(x => x.d), H: 220, yFmt: v => '$' + (+v.toFixed(v < 20 ? 1 : 0)), aria: `${S} price since launch`, series: [{ v: pw.map(x => x.c), color: TEAL, width: 2.5, area: true }], refs: [{ v: c0, label: 'Launch ' + money(c0), color: GOLD }], tip: i => `${fd(pw[i].d)}: ${money(pw[i].c)}` });
    const rating = f.decay === 'YES' ? '<b style="color:#c0392b">Price decay</b>' : f.decay === 'NO' ? '<b style="color:#1e9e57">No price decay</b>' : '<b>Not rated</b>';
    const perf = `
    <h2 class="section-title">${S} Performance</h2>
    <p class="section-lead">What ${S} has actually returned, price plus dividends. Tap any chart for the full breakdown.</p>
    <div class="tp click" data-href="${B('growth-of-10k')}">
      <div class="tp-h"><h3>&#127793; $10,000 Invested at Launch (${fml(f.launch.d)})</h3><span class="go">Growth of $10K breakdown &rarr;</span></div>
      ${gChart}
      <div class="lg2"><span><i style="background:${GOLD}"></i>Dividends reinvested: <b>${money0(10000 * f.trNow)}</b></span><span><i style="background:repeating-linear-gradient(90deg,${TEAL} 0 5px,transparent 5px 9px)"></i>Price only: <b>${money0(10000 * f.px / c0)}</b></span></div>
    </div>
    <div class="two">
      <div class="tp click" data-href="${B('yield-trend')}">
        <div class="tp-h"><h3>&#128200; Yield Trend</h3><span class="go">Full yield trend &rarr;</span></div>
        <p class="tp-sub">${f.ttmYield != null ? `Trailing 12-month yield: <b>${pct(f.ttmYield)}</b>${f.agoTtm ? ` now vs <b>${pct(f.agoTtm)}</b> a year ago` : ''}.` : `Distribution rate: <b>${pct(f.rate)}</b> (latest payout &times; ${f.n} &divide; price).`}</p>
        ${yChart}
      </div>
      <div class="tp click" data-href="${B('total-return-trend')}">
        <div class="tp-h"><h3>&#128202; Returns by Year</h3><span class="go">Full total return &rarr;</span></div>
        <p class="tp-sub"><span class="sw" style="background:${GOLD}"></span>Total return <span class="sw" style="background:${TEAL}"></span>Price only${cy.some(z => z.partial) ? '. * partial year' : ''}</p>
        ${tChart}
      </div>
    </div>
    <div class="two">
      <div class="tp click" data-href="${B('52-week-range')}">
        <div class="tp-h"><h3>&#128207; 52-Week Range</h3><span class="go">Full breakdown &rarr;</span></div>
        <p class="tp-sub">${money(f.px)} is <b>${Math.round(f.pos)}%</b> of the way from the low (${money(f.lo52.c)}) to the high (${money(f.hi52.c)}).</p>
        <div class="rng"><div class="rng-t"><span style="left:${Math.min(100, Math.max(0, f.pos)).toFixed(1)}%"></span></div></div>
        ${rChart}
      </div>
      <div class="tp click" data-href="${B('price-decay')}">
        <div class="tp-h"><h3>&#9888;&#65039; Price Decay Check</h3><span class="go">Full breakdown &rarr;</span></div>
        <p class="tp-sub">Rated ${rating}. Price ${spct(f.pxSince)} since launch, total return <b>${spct(f.trSince)}</b> with dividends.</p>
        ${pChart}
      </div>
    </div>
`;
    // reorder: calendar + calculator + performance go before "Where X Ranks"
    const rankStart = h.indexOf(`    <h2 class="section-title">${S} Ranks</h2>`) > -1 ? h.indexOf(`    <h2 class="section-title">${S} Ranks</h2>`) : h.indexOf(`<h2 class="section-title">Where ${S} Ranks</h2>`);
    const calcStart = h.indexOf(`<h2 class="section-title">${S} Dividend Income Calculator</h2>`);
    const afterCalc = calcStart > -1 ? h.indexOf('<div class="two">', calcStart) : -1;
    if (rankStart > -1 && calcStart > rankStart && afterCalc > calcStart) {
      const lineStart = i => h.lastIndexOf('\n', i) + 1;
      const rs = lineStart(rankStart), cs = lineStart(calcStart), ac = lineStart(afterCalc);
      let calc = h.slice(cs, ac);
      calc = calc.replace('<div class="card">', `<div class="card click" data-href="${B('income-calculator')}">`);
      const lastDiv = calc.lastIndexOf('</div>');
      calc = calc.slice(0, lastDiv) + `  <div class="tp-f"><span>Based on the current ${yfmt(f.listed)} yield</span><span class="go">Full income calculator &rarr;</span></div>\n    ` + calc.slice(lastDiv);
      let ranks = h.slice(rs, cs);
      ranks = ranks.replace('<div class="rank-grid">', '<div class="rank-grid six">').replace('<a class="rank-card" href="/top-voted-etfs">',
        `<a class="rank-card" href="${B('total-return-trend')}"><div class="lb">${f.tr1 != null ? '1-Yr Total Return' : 'Since Launch'}</div><div class="rk">${spct(f.tr1 ?? f.trSince)}</div><div class="go">Total return trend →</div></a>
      <a class="rank-card" href="${B('price-decay')}"><div class="lb">Price vs Launch</div><div class="rk">${spct(f.pxSince)}</div><div class="go">Price decay check →</div></a>
      <a class="rank-card" href="/top-voted-etfs">`);
      const divOnly = has('<div class="dh" id="dh">') ? '' : `\n    <h2 class="section-title">${S} Dividend History</h2>\n    ${divBox}</div>\n`;
      h = h.slice(0, rs) + divOnly + calBox + calc + perf + ranks + h.slice(ac);
    }
    // grade + yield-vs-field cards click through too
    h = h.replace(/<div class="card">(\s*<h3[^>]*>Grade Spectrum<\/h3>)/, (m, a) => `<div class="card click" data-href="/etfs/grade/${f.grade.endsWith('+') ? f.grade[0].toLowerCase() + '-plus' : f.grade.endsWith('-') ? f.grade[0].toLowerCase() + '-minus' : f.grade.toLowerCase()}">${a}`);
    h = h.replace(/<div class="card">(\s*<h3[^>]*>Yield vs\. the Field<\/h3>)/, (m, a) => `<div class="card click" data-href="${B('yield-rank')}">${a}`);
    h = h.replace('</head>', () => PAGE_CSS + '\n</head>');
    h = h.replace('</body>', () => '<script src="/etfs/bd.js" defer></script>\n</body>');
    fs.writeFileSync(file, h);
  }
}

main().catch(e => { console.error('BREAKDOWNS FAILED:', e.message); process.exit(1); });
