#!/usr/bin/env node
/**
 * snapshot-top-voted.js  (v2 - diagnostic build)
 *
 * Bakes the current Top 10 voted ETFs into top-voted-etfs.html so the page
 * paints instantly instead of waiting on the Apps Script vote endpoint.
 *
 * v2 changes:
 *   - Sends a normal browser User-Agent. Google frequently serves an
 *     interstitial or 403 to unrecognised agents, which is the most likely
 *     cause of the v1 failure.
 *   - Fetches the vote API as TEXT and parses it itself, so a non-JSON reply
 *     produces a readable error instead of "Unexpected token <".
 *   - Accepts several vote payload shapes, not just a flat map.
 *   - Prints status, content-type, size and a body preview for every request,
 *     so a failing run tells you exactly what came back.
 *
 * Writes between these markers, so it is safe to re-run forever:
 *   <!-- SNAPSHOT:START --> ... <!-- SNAPSHOT:END -->
 *   <!-- AZ:START --> ... <!-- AZ:END -->
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

// Google serves interstitials / 403s to unfamiliar agents. Look like a browser.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const preview = t => String(t).replace(/\s+/g, ' ').trim().slice(0, 300);

async function getText(url, label) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': UA,
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      clearTimeout(timer);
      const body = await res.text();

      console.log(`  [${label}] HTTP ${res.status}`);
      console.log(`  [${label}] content-type: ${res.headers.get('content-type') || '(none)'}`);
      console.log(`  [${label}] bytes: ${body.length}`);
      console.log(`  [${label}] preview: ${preview(body)}`);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!body.trim()) throw new Error('empty body');
      return body;
    } catch (err) {
      lastErr = err;
      console.log(`  [${label}] attempt ${attempt} failed: ${err.message}`);
      if (attempt < 4) await new Promise(r => setTimeout(r, attempt * 4000));
    }
  }
  throw new Error(`${label}: ${lastErr.message}`);
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

// The vote endpoint has returned a flat {SYMBOL: n} map historically, but
// accept the other shapes an Apps Script might emit rather than hard-failing.
function normaliseVotes(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error('vote endpoint did not return JSON. First 300 chars: ' + preview(raw));
  }

  if (Array.isArray(data)) {
    const out = {};
    data.forEach(item => {
      if (!item) return;
      const k = item.symbol || item.Symbol || item.ticker || item.Ticker;
      const v = item.votes != null ? item.votes
              : item.Votes != null ? item.Votes
              : item.count != null ? item.count : item.Count;
      if (k != null) out[String(k).trim().toUpperCase()] = parseInt(v, 10) || 0;
    });
    console.log(`  [votes] shape: array of ${data.length} objects`);
    return out;
  }

  if (data && typeof data === 'object') {
    // Unwrap a single container key like {data:{...}} or {votes:{...}}
    for (const key of ['data', 'votes', 'result', 'results', 'counts']) {
      if (data[key] && typeof data[key] === 'object') {
        console.log(`  [votes] shape: wrapped under "${key}"`);
        return normaliseVotes(JSON.stringify(data[key]));
      }
    }
    const out = {};
    Object.keys(data).forEach(k => {
      const n = parseInt(data[k], 10);
      out[String(k).trim().toUpperCase()] = isNaN(n) ? 0 : n;
    });
    console.log(`  [votes] shape: flat map, ${Object.keys(out).length} keys`);
    return out;
  }

  throw new Error('vote endpoint returned an unusable payload type: ' + typeof data);
}

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function replaceBetween(html, startTag, endTag, payload, label) {
  const a = html.indexOf(startTag);
  const b = html.indexOf(endTag);
  if (a === -1 || b === -1 || b < a) {
    throw new Error(
      `markers missing or out of order for ${label}. ` +
      `Expected ${startTag} then ${endTag} in ${PAGE}. ` +
      `Make sure you uploaded the updated top-voted-etfs.html.`
    );
  }
  return html.slice(0, a + startTag.length) + payload + html.slice(b);
}

// ---------- main ----------
(async () => {
  const pagePath = path.resolve(PAGE);
  if (!fs.existsSync(pagePath)) {
    throw new Error(`${PAGE} not found at ${pagePath}. Check PAGE_PATH or the file location.`);
  }
  console.log(`Page: ${pagePath}`);
  console.log(`Node: ${process.version}\n`);

  console.log('Fetching ETF sheet...');
  const csvText = await getText(CSV_URL, 'csv');

  console.log('\nFetching vote totals...');
  const voteRaw = await getText(VOTE_API + '?action=getAll&t=' + Date.now(), 'votes');
  const votes = normaliseVotes(voteRaw);

  const rows = parseCSV(csvText);
  console.log(`\n  [csv] header: ${JSON.stringify(rows[0])}`);
  console.log(`  [csv] raw rows: ${rows.length}`);

  const etfs = [];
  let skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const c = rows[i];
    if (!c || c.length < 6) { skipped++; continue; }
    const symbol = (c[0] || '').trim();
    const name   = (c[1] || '').trim();
    // Summary rows like "Total" pass a bare ticker regex, so require a name too.
    if (!symbol || !name || !TICKER_RE.test(symbol.toUpperCase())) { skipped++; continue; }
    etfs.push({
      symbol, upper: symbol.toUpperCase(), name,
      yield: (c[2] || '').trim(), aum: (c[3] || '').trim(),
      decay: (c[4] || '').trim(), grade: (c[5] || '').trim(), votes: 0
    });
  }
  console.log(`  [csv] usable ETF rows: ${etfs.length} (skipped ${skipped})`);
  if (!etfs.length) {
    throw new Error('no ETF rows parsed from the sheet, refusing to write an empty page');
  }

  const voteKeys = Object.keys(votes);
  console.log(`  [votes] keys: ${voteKeys.length}, sample: ${voteKeys.slice(0, 8).join(', ')}`);

  etfs.forEach(e => { e.votes = votes[e.upper] || 0; });

  const matched = etfs.filter(e => e.votes > 0);
  const overlap = voteKeys.filter(k => etfs.some(e => e.upper === k));
  console.log(`  [join] vote keys matching a sheet ticker: ${overlap.length}/${voteKeys.length}`);
  console.log(`  [join] ETFs with at least one vote: ${matched.length}`);

  if (!matched.length) {
    throw new Error(
      'no vote totals matched any sheet ticker, refusing to overwrite a good snapshot. ' +
      `Sheet sample: ${etfs.slice(0,5).map(e=>e.upper).join(', ')} | ` +
      `Vote key sample: ${voteKeys.slice(0,5).join(', ')}`
    );
  }

  const top = etfs.slice().sort((a, b) =>
    b.votes !== a.votes ? b.votes - a.votes : a.upper.localeCompare(b.upper)
  ).slice(0, TOP_N);

  console.log(`\nTop ${top.length}:`);
  top.forEach((e, i) => console.log(`  ${String(i+1).padStart(2)}. ${e.symbol.padEnd(6)} ${String(e.votes).padStart(6)} votes`));

  const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const sig = top.map(e => e.upper + ':' + e.votes).join('|');

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

  const allSyms = [...new Set(etfs.map(e => e.upper))].sort();
  const azHtml = '\n' + allSyms.map(sy =>
    `            <a href="etf.html?symbol=${encodeURIComponent(sy)}">${esc(sy)}</a>`
  ).join('\n') + '\n        ';

  let html = fs.readFileSync(pagePath, 'utf8');
  const before = html;

  html = replaceBetween(html, '<!-- SNAPSHOT:START -->', '<!-- SNAPSHOT:END -->', rowsHtml, 'top 10');
  html = replaceBetween(html, '<!-- AZ:START -->', '<!-- AZ:END -->', azHtml, 'ticker index');

  const stampedAt = new Date().toISOString();
  html = html.replace(/(<span id="liveStamp" data-snapshot-at=")[^"]*(")/, `$1${stampedAt}$2`);
  html = html.replace(/<tbody id="votedBody"(?: data-sig="[^"]*")?>/, `<tbody id="votedBody" data-sig="${esc(sig)}">`);

  if (html === before) {
    console.log('\nPage already current, nothing written.');
  } else {
    fs.writeFileSync(pagePath, html, 'utf8');
    console.log(`\nWrote ${PAGE} (top ${top.length}, ${allSyms.length} tickers indexed).`);
  }

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
  console.error('\n=========================================');
  console.error('SNAPSHOT FAILED: ' + err.message);
  console.error('Existing page left untouched.');
  console.error('=========================================');
  process.exit(1);
});
