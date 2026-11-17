// Builds stocks/stocks.json for topdividendetfs.com/stocks (Top Dividend Stocks screener).
// Stock list: stocks/universe.csv (Symbol, Name, Sector, Tags, Years). Edit that file to add or remove stocks.
// "Years" = published years of consecutive dividend increases through BASE_YEAR (filled for Dividend Kings).
// Each later year the count goes up by 1 automatically if the company raised its dividend that year.
// When blank, it is estimated from the dividend history (and never shown below 25 for a Dividend Aristocrat).
// Tags: King, Aristocrat, REIT, BDC, MLP, Monthly, Foreign (pays in another currency, so FX moves are not read as cuts).
// Self-checks on every run:
//  - a dividend cut (or a full year with no raise) resets the streak and removes the King / Aristocrat badge
//  - a stock with no fresh price for 7+ days (delisted or merged) is dropped from the page
//  - if most stocks fail to load (data source outage), the run fails and the page keeps yesterday's data
// Market data: Yahoo Finance daily history with dividend events (back to 1962).
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UNIVERSE = path.join(ROOT, "stocks", "universe.csv");
const OUT = path.join(ROOT, "stocks", "stocks.json");
const DAY = 864e5, YEAR = 365.25 * DAY;
const BASE_YEAR = 2025;          // the published "Years" counts cover dividend raises through this calendar year
const STALE_DAYS = 7;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function parseCSV(t) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f.trim()); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(f.trim()); if (row.some(Boolean)) rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f || row.length) { row.push(f.trim()); if (row.some(Boolean)) rows.push(row); }
  return rows;
}

async function chart(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=-315619200&period2=9999999999&interval=1d&events=div,split`;
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
      if (r.ok) return (await r.json()).chart?.result?.[0] || null;
      if (r.status === 404) return null;
    } catch {}
    await sleep(2000);
  }
  return null;
}

const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const r1 = v => v == null || !isFinite(v) ? null : Math.round(v * 10) / 10;
const r2 = v => v == null || !isFinite(v) ? null : Math.round(v * 100) / 100;

// mark special (one-off) payouts so they don't distort growth or the yield
function tagSpecials(divs) {
  const a = divs.map(d => d[1]);
  const out = divs.map((d, i) => {
    const nb = a.slice(Math.max(0, i - 4), i).concat(a.slice(i + 1, i + 5));
    return [d[0], d[1], nb.length >= 3 && d[1] > 1.6 * median(nb)];
  });
  // extra payouts squeezed between regular ones (supplementals) are specials too
  const gaps = []; for (let i = 1; i < divs.length; i++) gaps.push(divs[i][0] - divs[i - 1][0]);
  const typ = median(gaps.slice(-24));
  if (typ >= 25 * DAY) {
    for (let i = 1; i < out.length; i++) {
      if (out[i][0] - out[i - 1][0] < typ * 0.6) {
        const nb = a.slice(Math.max(0, i - 6), i + 6), m = median(nb);
        const j = Math.abs(out[i][1] - m) >= Math.abs(out[i - 1][1] - m) ? i : i - 1;
        out[j][2] = true;
      }
    }
  }
  return out;
}

// regular payouts grouped by calendar year
function byYearOf(divs) {
  const m = new Map();
  for (const [t, v, sp] of divs) { if (sp) continue; const y = new Date(t).getUTCFullYear(); if (!m.has(y)) m.set(y, []); m.get(y).push(v); }
  return m;
}
// did the dividend go up in year y versus y-1?  "up" | "flat" | "cut" | "none"
function yearChange(byYear, y) {
  const cy = byYear.get(y), py = byYear.get(y - 1);
  if (!cy || !py) return "none";
  if (median(cy) < median(py) * 0.97) return "cut";
  const rateUp = median(cy) > median(py) * 1.001 || cy[cy.length - 1] > py[py.length - 1] * 1.001;
  const sumUp = cy.length === py.length && cy.reduce((s, v) => s + v, 0) > py.reduce((s, v) => s + v, 0) * 1.001;
  return rateUp || sumUp ? "up" : "flat";
}
// years of consecutive increases, from complete calendar years
function estimateStreak(divs) {
  const byYear = byYearOf(divs); if (byYear.size < 2) return 0;
  const thisYear = new Date().getUTCFullYear();
  let streak = 0;
  for (let y = thisYear - 1; byYear.has(y - 1); y--) { if (yearChange(byYear, y) === "up") streak++; else break; }
  return streak;
}
// a cut in the last ~13 months: a regular payout at least 3% below the one before it, on the normal schedule
// (a change in payout schedule, e.g. quarterly to monthly, is not treated as a cut)
function recentCut(divs, now) {
  const reg = divs.filter(d => !d[2]);
  const gaps = []; for (let i = 1; i < reg.length; i++) gaps.push(reg[i][0] - reg[i - 1][0]);
  const typ = median(gaps.slice(-12)); if (!typ) return false;
  for (let i = 1; i < reg.length; i++) {
    if (reg[i][0] < now - 400 * DAY) continue;
    const gap = reg[i][0] - reg[i - 1][0];
    if (gap > typ * 0.6 && gap < typ * 1.6 && reg[i][1] < reg[i - 1][1] * 0.97) return new Date(reg[i][0]).toISOString().slice(0, 10);
  }
  return false;
}

function build(row, res) {
  const [sym, name, sector, tagsRaw, yearsRaw] = row;
  let tags = (tagsRaw || "").split(/\s+/).filter(Boolean);
  const foreign = tags.includes("Foreign"); tags = tags.filter(t => t !== "Foreign");
  const ts = res.timestamp || [], q = res.indicators?.quote?.[0] || {}, adj = res.indicators?.adjclose?.[0]?.adjclose || [];
  const px = [], ad = [];
  ts.forEach((t, i) => { if (q.close?.[i] > 0) px.push([t * 1000, q.close[i]]); if (adj[i] > 0) ad.push([t * 1000, adj[i]]); });
  if (px.length < 30) return null;
  if (Date.now() - px[px.length - 1][0] > STALE_DAYS * DAY) { console.log("stale (no recent prices), dropped:", sym); return "stale"; }
  const now = px[px.length - 1][0], price = res.meta?.regularMarketPrice || px[px.length - 1][1];
  const prev = px.length > 1 ? px[px.length - 2][1] : null, last = px[px.length - 1][1];
  const at = (arr, t) => { let v = null; for (const p of arr) { if (p[0] <= t) v = p[1]; else break; } return v; };
  const divs = tagSpecials(Object.values(res.events?.dividends || {}).map(d => [d.date * 1000, d.amount]).sort((a, b) => a[0] - b[0]));
  const reg = divs.filter(d => !d[2]);
  const inWin = (a, b) => reg.filter(d => d[0] > a && d[0] <= b);
  const ttm = inWin(now - YEAR, now), ttmSum = ttm.reduce((s, d) => s + d[1], 0);
  const n = ttm.length;
  const freq = n >= 10 ? 12 : n >= 3 ? 4 : n === 2 ? 2 : n === 1 ? 1 : 0;
  const freqName = { 12: "Monthly", 4: "Quarterly", 2: "Semi-Annual", 1: "Annual" }[freq] || "None";
  const lastDiv = reg.length ? reg[reg.length - 1] : null;
  const fwd = lastDiv && freq && (now - lastDiv[0]) < 1.5 * YEAR / freq ? lastDiv[1] * freq : ttmSum;
  const g = yrs => { const old = inWin(now - (yrs + 1) * YEAR, now - yrs * YEAR).reduce((s, d) => s + d[1], 0); return old > 0 && ttmSum > 0 ? (Math.pow(ttmSum / old, 1 / yrs) - 1) * 100 : null; };
  const tr = yrs => { const a = at(ad, now - yrs * YEAR); const b = ad[ad.length - 1][1]; if (!a || ad[0][0] > now - yrs * YEAR + 10 * DAY) return null; return (Math.pow(b / a, 1 / yrs) - 1) * 100; };
  const p5 = px[0][0] <= now - 5 * YEAR + 10 * DAY ? at(px, now - 5 * YEAR) : null;
  let peak = 0, mdd = 0; for (const [t, v] of ad) { if (t < now - 5 * YEAR) continue; peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); }
  const yr = px.filter(p => p[0] > now - YEAR).map(p => p[1]);
  const hi52 = Math.max(...yr), lo52 = Math.min(...yr);
  let years = parseInt(yearsRaw, 10);
  let yearsEst = false, cutDate = null;
  const thisYear = new Date().getUTCFullYear(), byYear = byYearOf(divs);
  if (yearsRaw === "-") years = null;
  else if (!years && years !== 0) { years = estimateStreak(divs); yearsEst = true; if (tags.includes("Aristocrat") && years < 25) years = 25; }
  if (yearsEst && tags.includes("Aristocrat")) yearsEst = "25+";
  // Kings and Aristocrats must keep raising every year after BASE_YEAR: +1 per year with a raise (FX-paid stocks are trusted)
  if (years != null && (!yearsEst || yearsEst === "25+")) {
    for (let y = BASE_YEAR + 1; y < thisYear; y++) {
      const ch = foreign ? "up" : yearChange(byYear, y);
      if (ch === "up") { if (!yearsEst) years++; }
      else if (ch === "flat" || ch === "cut") { years = estimateStreak(divs); yearsEst = true; cutDate = String(y); break; }
    }
  }
  // a cut in the last year resets the streak right away
  const rc = foreign ? false : recentCut(divs, now);
  if (rc) { years = 0; yearsEst = false; cutDate = rc; }
  if (cutDate) {
    tags = tags.filter(t => t !== "King" && t !== "Aristocrat");
    if (rc) tags.push("Dividend Cut");
    console.log(sym, rc ? "dividend cut on " + rc : "no raise in " + cutDate, "- streak reset, badges removed");
  }
  const first = res.meta?.firstTradeDate ? new Date(res.meta.firstTradeDate * 1000).getUTCFullYear() : new Date(px[0][0]).getUTCFullYear();
  const yieldPct = price ? fwd / price * 100 : null;
  const t = [...tags];
  if (yieldPct >= 4 && !t.includes("High Yield")) t.push("High Yield");
  if (freq === 12 && !t.includes("Monthly")) t.push("Monthly");
  return {
    s: sym, n: name, sec: sector, tags: t,
    px: r2(price), chg: prev ? r2((last / prev - 1) * 100) : null,
    y: r2(yieldPct), ttmY: r2(price ? ttmSum / price * 100 : null), div: r2(fwd), freq: freqName,
    g1: r1(g(1)), g5: r1(g(5)), g10: r1(g(10)),
    yrs: years, yrsEst: yearsEst, cut: cutDate,
    pxDate: new Date(now).toISOString().slice(0, 10),
    tr1: r1(tr(1)), tr5: r1(tr(5)), tr10: r1(tr(10)),
    decay: p5 == null ? null : (price < p5 ? "YES" : "NO"), p5: r2(p5),
    mdd: r1(mdd * 100), offHi: r1((price / hi52 - 1) * 100), hi52: r2(hi52), lo52: r2(lo52),
    since: first, exDate: lastDiv ? new Date(lastDiv[0]).toISOString().slice(0, 10) : null, lastDiv: lastDiv ? lastDiv[1] : null,
    // last 10 years of regular payouts for the per-stock view
    hist: reg.filter(d => d[0] > now - 10 * YEAR).map(d => [new Date(d[0]).toISOString().slice(0, 10), Math.round(d[1] * 10000) / 10000])
  };
}

const rows = parseCSV(fs.readFileSync(UNIVERSE, "utf8")).slice(1).filter(r => r[0]);
let old = {}; try { for (const s of JSON.parse(fs.readFileSync(OUT, "utf8")).stocks) old[s.s] = s; } catch {}
const out = [];
for (const row of rows) {
  const sym = row[0].toUpperCase();
  let rec = null;
  let stale = false;
  try { const res = await chart(sym); if (res) rec = build([sym, ...row.slice(1)], res); } catch (e) { console.log(sym, e.message); }
  if (rec === "stale") { rec = null; stale = true; }
  // a one-day hiccup keeps yesterday's numbers, but never data older than STALE_DAYS
  if (!rec && !stale && old[sym] && old[sym].pxDate && Date.now() - Date.parse(old[sym].pxDate) <= STALE_DAYS * DAY) { rec = old[sym]; console.log("kept old data for", sym); }
  if (rec) out.push(rec); else if (!stale) console.log("no data for", sym, "- dropped");
  await sleep(300);
}
if (out.length < rows.length * 0.7) { console.error(`Only ${out.length} of ${rows.length} stocks loaded. Not saving, so the page keeps the last good data.`); process.exit(1); }
fs.writeFileSync(OUT, JSON.stringify({ asOf: new Date().toISOString(), count: out.length, stocks: out }));
console.log(`stocks: ${out.length} of ${rows.length}`);
