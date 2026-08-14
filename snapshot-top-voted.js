#!/usr/bin/env node
/**
 * snapshot-top-voted.js
 *
 * Bakes the current Top 10 voted ETFs directly into top-voted-etfs.html so the
 * page paints instantly instead of waiting on the Apps Script vote endpoint.
 * Also bakes the full ticker list into the A-Z index, which makes every
 * scorecard link crawlable by Googlebot for the first time.
 *
 * Writes between these markers, so it is safe to re-run forever:
 *   <!-- SNAPSHOT:START --> ... <!-- SNAPSHOT:END -->
 *   <!-- AZ:START --> ... <!-- AZ:END -->
 *
 * Also emits data/top-voted.json as a vote-history record you can chart later.
 *
 * Requires Node 18+ (global fetch). No dependencies.
 */

const fs = require('fs');
const path = require('path');

const CSV_URL  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRYVQtSlWkwIDCeeB-YaQEpelovyW9ofaItXrzXZ_ntodK4QasRTKhP-swVWISmXIDZTIvQlbvNZm_o/pub?output=csv';
const VOTE_API = 'https://script.google.com/macros/s/AKfycbwiuyy8aUNB3tNKouJ18zxE8r8nuiCTk3lG9PCYeqEQndImu_8915rNHudiayXtFNbi/exec';
const PAGE     = process.env.PAGE_PATH || 'top-voted-etfs.html';
const DATA_DIR = 'data';
const TOP_N    = 10;
const TICKER_RE = /^[A-Z][A-Z.\-]{0,5}$/;

// ---------- helpers ----------
async function get(url, asJson) {
  // Apps Script can be slow to wake, so retry rather than shipping a blank page.
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'topdividendetfs-snapshot' }
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return asJson ? await res.json() : await res.text();
    } catch (err) {
      console.log(`  attempt ${attempt} failed: ${err.message}`);
      if (attempt === 4) throw err;
      await new Promise(r => setTimeout(r, attempt * 3000));
    }
  }
}

// Quote-safe CSV parser: fund names containing commas must not shift columns.
function parseCSV(text) {
  const rows = []; let row = [], field = '', inQ = false;
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i+1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function replaceBetween(html, startTag, endTag, payload, label) {
  const a = html.indexOf(startTag);
  const b = html.indexOf(endTag);
  if (a === -1 || b === -1 || b < a) {
    throw new Error(`markers missing or out of order for ${label}: ${startTag} / ${endTag}`);
  }
  return html.slice(0, a + startTag.length) + payload + html.slice(b);
}

// ---------- main ----------
(async () => {
  console.log('Fetching ETF sheet...');
  const csvText = await get(CSV_URL, false);

  console.log('Fetching vote totals...');
  const votes = await get(VOTE_API + '?action=getAll&t=' + Date.now(), true);

  // Parse the sheet
  const rows = parseCSV(csvText);
  const etfs = [];
  for (let i = 1; i < rows.length; i++) {
    const c = rows[i];
    if (!c || c.length < 6) continue;
    const symbol = (c[0] || '').trim();
    const name   = (c[1] || '').trim();
    // Summary rows like "Total" pass a bare ticker regex, so require a name too.
    if (!symbol || !name || !TICKER_RE.test(symbol.toUpperCase())) continue;
    etfs.push({
      symbol, upper: symbol.toUpperCase(), name,
      yield: (c[2] || '').trim(), aum: (c[3] || '').trim(),
      decay: (c[4] || '').trim(), grade: (c[5] || '').trim(), votes: 0
    });
  }
  if (!etfs.length) throw new Error('no ETF rows parsed from sheet, refusing to write an empty page');

  // Join votes (exact symbol first, then uppercase fallback)
  const upperMap = {};
  Object.keys(votes || {}).forEach(k => {
    const n = parseInt(votes[k], 10);
    upperMap[String(k).trim().toUpperCase()] = isNaN(n) ? 0 : n;
  });
  etfs.forEach(e => {
    let v = votes[e.symbol];
    if (v === undefined) v = upperMap[e.upper];
    const n = parseInt(v, 10);
    e.votes = isNaN(n) ? 0 : n;
  });

  if (!etfs.some(e => e.votes > 0)) {
    throw new Error('vote API returned no matching totals, refusing to overwrite a good snapshot');
  }

  // Rank, with a stable alphabetical tie-break
  const top = etfs.slice().sort((a, b) =>
    b.votes !== a.votes ? b.votes - a.votes : a.upper.localeCompare(b.upper)
  ).slice(0, TOP_N);

  console.log(`Parsed ${etfs.length} ETFs. Top ${top.length}:`);
  top.forEach((e, i) => console.log(`  ${String(i+1).padStart(2)}. ${e.symbol.padEnd(6)} ${String(e.votes).padStart(6)} votes`));

  const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const sig = top.map(e => e.upper + ':' + e.votes).join('|');

  // Build static rows that match the client renderer exactly
  const rowsHtml = '\n' + top.map((e, i) => {
    const r = i + 1;
    const rankCell = MEDALS[r] ? `<span class="medal">${MEDALS[r]}</span>` : `#${r}`;
    return `                <tr${r === 1 ? ' class="top1"' : ''} style="cursor:pointer;" title="View the full scorecard for ${esc(e.symbol)}">
                    <td class="rank col-rank" data-label="Rank">${rankCell}</td>
                    <td class="symbol" data-label="Symbol"><a class="sym-link" data-mod="voted_ticker" href="etf.html?symbol=${encodeURIComponent(e.symbol)}">${esc(e.symbol)}</a></td>
                    <td class="col-name" data-label="Name">${esc(e.name)}</td>
                    <td class="col-yield" data-label="Dividend Yield">${esc(e.yield)}</td>
                    <td class="col-aum" data-label="AUM">${esc(e.aum)}</td>
                    <td class="col-decay" data-label="Price Decay">${esc(e.decay)}</td>
                    <td class="grade col-grade" data-label="Grade">${esc(e.grade)}</td>
                    <td class="votes-cell col-votes" data-label="Votes">${e.votes.toLocaleString('en-US')}</td>
                </tr>`;
  }).join('\n') + '\n            ';

  // Full crawlable ticker index
  const allSyms = [...new Set(etfs.map(e => e.upper))].sort();
  const azHtml = '\n' + allSyms.map(sy =>
    `            <a href="etf.html?symbol=${encodeURIComponent(sy)}">${esc(sy)}</a>`
  ).join('\n') + '\n        ';

  // Inject
  const pagePath = path.resolve(PAGE);
  let html = fs.readFileSync(pagePath, 'utf8');
  const before = html;

  html = replaceBetween(html, '<!-- SNAPSHOT:START -->', '<!-- SNAPSHOT:END -->', rowsHtml, 'top 10');
  html = replaceBetween(html, '<!-- AZ:START -->', '<!-- AZ:END -->', azHtml, 'ticker index');

  const stampedAt = new Date().toISOString();
  html = html.replace(
    /(<span id="liveStamp" data-snapshot-at=")[^"]*(")/,
    `$1${stampedAt}$2`
  );
  // Keep the tbody signature in sync so the client skips a pointless repaint
  // when the live data matches what was already baked in.
  html = html.replace(
    /<tbody id="votedBody"(?: data-sig="[^"]*")?>/,
    `<tbody id="votedBody" data-sig="${esc(sig)}">`
  );

  if (html === before) {
    console.log('Page already current, nothing written.');
  } else {
    fs.writeFileSync(pagePath, html, 'utf8');
    console.log(`Wrote ${PAGE} (top ${top.length}, ${allSyms.length} tickers indexed).`);
  }

  // History record for later charting
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DATA_DIR, 'top-voted.json'),
    JSON.stringify({
      updated: stampedAt,
      total_tracked: etfs.length,
      top: top.map(e => ({ symbol: e.symbol, name: e.name, votes: e.votes, yield: e.yield }))
    }, null, 2) + '\n',
    'utf8'
  );
  console.log(`Wrote ${DATA_DIR}/top-voted.json`);
})().catch(err => {
  console.error('SNAPSHOT FAILED:', err.message);
  console.error('Existing page left untouched.');
  process.exit(1);
});
