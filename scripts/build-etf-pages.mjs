// Builds a static page for every ETF on TopDividendETFs.com, plus hub pages.
// Usage: node scripts/build-etf-pages.mjs [csvFileOrUrl] [--only=SCHD,MSTY]
// Output: etfs/<sym>.html, etfs/index.html, etfs/issuer/*.html, etfs/grade/*.html,
//         etfs/category/*.html, etfs/highest-yield.html, etfs/largest.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRYVQtSlWkwIDCeeB-YaQEpelovyW9ofaItXrzXZ_ntodK4QasRTKhP-swVWISmXIDZTIvQlbvNZm_o/pub?output=csv';
const VOTE_API = 'https://script.google.com/macros/s/AKfycbwiuyy8aUNB3tNKouJ18zxE8r8nuiCTk3lG9PCYeqEQndImu_8915rNHudiayXtFNbi/exec';
const SITE = 'https://topdividendetfs.com';
const OUT = path.join(ROOT, 'etfs');
const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{overflow-x:hidden!important;width:100%;position:relative}
:root{--green-dark:#1A3C34;--green-mid:#2E5D54;--bg:#f4f4f4;--white:#fff;--text:#333;--text-mid:#444;--text-light:#666;--border:#c8e6d8;--shadow:0 4px 15px rgba(0,0,0,.12);--red:#e74c3c;--mint:#7dffb0;--gold:#d4a017}
body{font-family:'Lato',Arial,sans-serif;background:var(--bg);color:var(--text);display:flex;flex-direction:column;align-items:center;min-height:100vh}
header{background:var(--green-dark);padding:15px 20px;color:#fff;text-align:center;width:100%;box-shadow:0 2px 5px rgba(0,0,0,.2);background-image:url('https://www.transparenttextures.com/patterns/noise.png');background-blend-mode:overlay;cursor:pointer}
.logo{font-size:clamp(22px,6vw,36px);font-weight:900;color:#fff}
.content{width:94%;max-width:960px;display:flex;flex-direction:column}
.breadcrumb{font-size:.82rem;color:var(--text-light);padding:12px 0 4px}
.breadcrumb a{color:var(--green-mid);text-decoration:none;font-weight:700}
.breadcrumb a:hover{text-decoration:underline}.breadcrumb span{margin:0 5px;color:#aaa}
.updated-line{display:flex;align-items:center;gap:7px;font-size:.8rem;color:var(--text-light);margin:4px 0 0;flex-wrap:wrap}
.updated-dot{width:8px;height:8px;border-radius:50%;background:#27ae60;flex-shrink:0;box-shadow:0 0 0 3px rgba(39,174,96,.18);animation:pulse 2.2s infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 3px rgba(39,174,96,.18)}50%{box-shadow:0 0 0 6px rgba(39,174,96,.06)}}
.updated-line strong{color:var(--green-dark);font-weight:700}
.answer-box{background:var(--white);border:3px solid var(--green-mid);border-radius:10px;padding:22px 26px;margin:14px 0 6px;box-shadow:var(--shadow)}
.ab-label{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--green-mid);font-weight:900;margin-bottom:9px}
.answer-box p{color:var(--text-mid);font-size:1.02rem;line-height:1.65}
.answer-box p strong{color:var(--green-dark);font-weight:900}
.hero-block{background:linear-gradient(var(--green-dark),#255046);border-radius:10px;padding:44px 32px 38px;text-align:center;margin:14px 0 22px;box-shadow:var(--shadow);position:relative;overflow:hidden}
.hero-block::before{content:'';position:absolute;inset:0;background-image:url('https://www.transparenttextures.com/patterns/noise.png');opacity:.35;pointer-events:none}
.hero-eyebrow{display:inline-block;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.28);color:#aff5c8;font-size:.74rem;letter-spacing:.12em;text-transform:uppercase;padding:5px 15px;border-radius:4px;margin-bottom:14px;font-weight:700;position:relative;z-index:1}
.hero-block h1{font-size:clamp(1.7rem,4.5vw,2.8rem);font-weight:900;color:#fff;line-height:1.2;margin-bottom:10px;position:relative;z-index:1}
.hero-block h1 em{font-style:normal;color:var(--mint)}
.hero-sub{color:rgba(255,255,255,.8);font-size:1rem;max-width:600px;margin:0 auto 26px;position:relative;z-index:1}
.quick-stats{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;position:relative;z-index:1}
.stat-pill{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);border-radius:6px;padding:10px 16px;color:#fff;font-size:.83rem;min-width:95px}
.stat-pill strong{display:block;font-size:1.2rem;font-weight:900;color:var(--mint);line-height:1.1;margin-bottom:2px}
h2.section-title{color:var(--green-dark);font-size:1.4rem;font-weight:900;margin:38px 0 6px;padding-bottom:8px;border-bottom:3px solid var(--green-mid)}
.section-lead{color:var(--text-light);font-size:.88rem;margin-bottom:16px}
.faq-list{list-style:none;margin:0}
.faq-item{background:var(--white);border:2px solid var(--border);border-radius:8px;margin-bottom:9px;overflow:hidden}
.faq-q{padding:16px 20px;font-weight:900;font-size:.97rem;color:var(--green-dark);cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:12px;user-select:none}
.faq-q:hover{background:#f0fbf5}
.faq-icon{width:25px;height:25px;border-radius:50%;background:#dff5eb;border:2px solid var(--green-mid);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.05rem;color:var(--green-mid);font-weight:900;transition:transform .25s}
.faq-item.open .faq-icon{transform:rotate(45deg)}
.faq-a{padding:0 20px;max-height:0;overflow:hidden;transition:max-height .35s ease,padding .25s;color:var(--text-mid);font-size:.95rem;line-height:1.65}
.faq-item.open .faq-a{max-height:460px;padding:13px 20px 18px;border-top:1px solid var(--border)}
.disclaimer-box{border-left:4px solid #ccc;background:var(--white);padding:16px 20px;margin:24px 0 12px;border-radius:0 6px 6px 0;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.disclaimer-box h3{color:#999;font-size:.9rem;margin-bottom:5px}
.disclaimer-box p{color:var(--text-light);font-size:.83rem;line-height:1.6}
.share-buttons{margin:18px auto 8px;display:flex;gap:12px;justify-content:center}
.share-btn{display:flex;align-items:center;gap:6px;padding:7px 13px;border-radius:6px;font-weight:700;font-size:.82em;color:#fff;text-decoration:none;box-shadow:0 3px 8px rgba(0,0,0,.2);transition:all .2s}
.share-btn:hover{transform:translateY(-2px)}.fb{background:#1877F2}.xbtn{background:#000}
.share-btn svg{width:15px;height:15px;fill:currentColor}
.back-to-top{display:block;margin:10px auto 0;padding:7px 16px;background:var(--green-mid);color:#fff;font-weight:700;font-size:.85rem;border:none;border-radius:6px;cursor:pointer;box-shadow:0 3px 8px rgba(0,0,0,.2)}
.footer{font-size:.9em;color:#666;margin:20px auto 10px;padding-top:10px;border-top:1px solid #ddd;max-width:960px;width:94%;text-align:center}
.footer a{color:var(--green-dark);text-decoration:none}.footer a:hover{text-decoration:underline}
.banner{width:100%;max-width:1000px;margin:15px auto;padding:0;background:none;display:flex;flex-direction:column;align-items:center;gap:6px}
.banner img{display:block;width:auto;height:auto;max-width:100%;object-fit:contain;transition:transform .3s ease}
.banner:hover img{transform:scale(1.02)}
.rel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:12px 0 6px}
.rel-card{background:#fff;border:2px solid var(--border);border-radius:8px;padding:14px 16px;text-decoration:none;color:var(--text);box-shadow:var(--shadow);display:block}
.rel-card:hover{border-color:var(--green-mid)}
.rel-tag{font-size:.72rem;font-weight:900;color:var(--green-mid);text-transform:uppercase;letter-spacing:.04em}
.rel-card h4{color:var(--green-dark);font-size:1rem;margin:4px 0}
.rel-card p{font-size:.86rem;color:var(--text-light)}
.pro-box{background:linear-gradient(135deg,#1A3C34,#2E5D54);color:#fff;border-radius:10px;padding:24px 26px;margin:18px 0;box-shadow:var(--shadow);text-align:center}
.pro-box h3{color:#FFD700;font-size:1.2rem;font-weight:900;margin-bottom:6px}
.pro-box p{color:rgba(255,255,255,.85);font-size:.95rem;max-width:600px;margin:0 auto 14px}
.pro-box a{display:inline-block;background:#FFD700;color:#1A3C34;font-weight:900;padding:11px 24px;border-radius:8px;text-decoration:none}
@media(max-width:640px){.answer-box{padding:20px 18px}.hero-block{padding:30px 18px 28px}}
`;

const args = process.argv.slice(2);
const src = args.find(a => !a.startsWith('--')) || CSV_URL;
const only = (args.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean).map(s => s.toUpperCase());

// ---------- data ----------
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
  return rows.filter(r => r.some(x => x.trim()));
}

const GRADES = ['A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F'];
const GRADE_RANK = Object.fromEntries(GRADES.map((g, i) => [g, i]));
const gradeSlug = g => g.toLowerCase().replace('+', '-plus').replace('-', g.endsWith('-') ? '-minus' : '-').replace(/-$/, '');
function gradeSlugFix(g) { return g.endsWith('+') ? g[0].toLowerCase() + '-plus' : g.endsWith('-') ? g[0].toLowerCase() + '-minus' : g.toLowerCase(); }
function gradeColor(g) { const r = GRADE_RANK[g]; if (r === undefined) return '#1A3C34'; if (r <= 2) return '#2ecc71'; if (r <= 5) return '#7ed957'; if (r <= 8) return '#f5a623'; return '#e74c3c'; }

const ISSUERS = [
  ['Goldman Sachs'], ['Global X'], ['State Street'], ['SPDR', 'State Street'], ['First Trust'], ['FT Vest', 'First Trust'],
  ['Overlay Shares'], ['Infrastructure Capital'], ['Tuttle Capital'], ['Worth Charting'], ['Definance', 'Defiance'],
  ['YieldMax'], ['GraniteShares'], ['NEOS'], ['Defiance'], ['Amplify'], ['Roundhill'], ['VistaShares'], ['iShares'],
  ['Vanguard'], ['Schwab'], ['WisdomTree'], ['Invesco'], ['Fidelity'], ['JPMorgan'], ['ProShares'], ['Simplify'],
  ['Nicholas'], ['Kurv'], ['REX'], ['TappAlpha'], ['IncomeSTKd'], ['VegaShares'], ['NestYield'], ['VictoryShares'],
  ['Pacer'], ['Kensington'], ['Shelton'], ['XFUNDS'], ['STF'], ['Main']
];
const ISSUER_BY_SYMBOL = { MLPI: 'NEOS', AMDW: 'Roundhill', TYLG: 'Global X', ODTE: 'VegaShares' };
function issuerOf(sym, name) {
  if (ISSUER_BY_SYMBOL[sym]) return ISSUER_BY_SYMBOL[sym];
  for (const [p, n] of ISSUERS) if (name.startsWith(p + ' ') || name.startsWith(p + '®')) return n || p;
  return name.split(/\s+/)[0];
}
const SINGLE = /\b(AMD|COIN|HOOD|NVDA|SMCI|TSLA|MSTR|PLTR|SNOW|PYPL|AMZN|GOOGL|BABA|META|WMT|NVDA)\b/;
function categoryOf(name) {
  if (SINGLE.test(name) && !/Portfolio|Universe|TopYielders|Top Weekly|Fund of/i.test(name)) return 'Single-Stock Income';
  if (/bitcoin|ether|crypto|blockchain/i.test(name)) return 'Crypto Income';
  if (/option|covered call|premium|buywrite|0DTE|weeklypay|autocallable|target|distribution|blast|yieldboost|lift|high income|hedged|enhanced|growth & (daily )?income|income etf/i.test(name)) return 'Option Income';
  if (/dividend|aristocrat|cash flow/i.test(name)) return 'Dividend Equity';
  return 'Core & Other';
}
const CAT_INFO = {
  'Dividend Equity': 'Traditional dividend stock ETFs built on companies that pay and grow dividends.',
  'Option Income': 'ETFs that sell options on indexes or baskets to turn volatility into monthly or weekly income.',
  'Single-Stock Income': 'ETFs that sell options on one company to generate very high income from that single stock.',
  'Crypto Income': 'ETFs that generate income from Bitcoin, Ether and crypto-related holdings.',
  'Core & Other': 'Core index funds, bond and inflation funds, and other strategies on our list.'
};
const slug = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cleanName = n => n.replace(/\s+/g, ' ').trim();
function parseAum(s) { const m = String(s).trim().match(/^([\d.]+)\s*([MB])?/i); if (!m) return 0; const v = parseFloat(m[1]); return (m[2] || 'M').toUpperCase() === 'B' ? v * 1000 : v; }
function fmtAum(m) { if (!m) return 'n/a'; if (m >= 1000000) return '$' + (m / 1000000).toFixed(2) + 'T'; if (m >= 1000) return '$' + (m / 1000).toFixed(1) + 'B'; return '$' + (m >= 10 ? Math.round(m) : m.toFixed(1)) + 'M'; }
function fmtYield(y) { return (Math.round(y * 10) / 10).toString().replace(/\.0$/, '') + '%'; }
const money = n => '$' + Math.round(n).toLocaleString('en-US');
const ord = n => n + (['th','st','nd','rd'][(n % 100 - 20) % 10] || ['th','st','nd','rd'][n % 100] || 'th');

// ---------- related blog posts (scanned from repo root, so new posts are picked up automatically) ----------
function relatedPosts(sym) {
  const s = sym.toLowerCase();
  const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && (f.startsWith(s + '-') || f === s + '.html'));
  return files.map(f => {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (/<meta[^>]+noindex/i.test(html)) return null;
    const t = (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || f;
    return { href: '/' + f.replace(/\.html$/, ''), title: t.replace(/&amp;/g,'&').replace(/&#x27;|&#39;/g,"'").split('|')[0].replace(/\s*[—–]\s*/g, ': ').trim() };
  }).filter(Boolean).slice(0, 6);
}

// ---------- load ----------
let csvText;
if (/^https?:/.test(src)) { const r = await fetch(src + '&t=' + Date.now()); if (!r.ok) throw new Error('CSV ' + r.status); csvText = await r.text(); }
else csvText = fs.readFileSync(src, 'utf8');
const rows = parseCSV(csvText);
const head = rows.shift().map(h => h.trim().toLowerCase());
const col = k => head.findIndex(h => h.startsWith(k));
const iS = col('symbol'), iN = col('name'), iY = col('dividend'), iA = col('aum'), iD = col('price'), iR = col('rating');
const seen = new Set();
const ETFS = rows.map(r => {
  const sym = (r[iS] || '').trim().toUpperCase();
  const name = cleanName(r[iN] || '');
  const grade = (r[iR] || '').trim().toUpperCase();
  return { sym, name, yield: parseFloat(r[iY]) || 0, aum: parseAum(r[iA]), decay: /yes/i.test(r[iD] || ''), grade: GRADE_RANK[grade] !== undefined ? grade : 'B' };
}).filter(e => /^[A-Z0-9.]{1,6}$/.test(e.sym) && !seen.has(e.sym) && seen.add(e.sym));
for (const e of ETFS) { e.issuer = issuerOf(e.sym, e.name); e.cat = categoryOf(e.name); e.url = '/etfs/' + e.sym.toLowerCase(); }

const N = ETFS.length;
const byYield = [...ETFS].sort((a, b) => b.yield - a.yield || a.sym.localeCompare(b.sym));
const byAum = [...ETFS].sort((a, b) => b.aum - a.aum);
const byGrade = [...ETFS].sort((a, b) => GRADE_RANK[a.grade] - GRADE_RANK[b.grade] || b.aum - a.aum);
const az = [...ETFS].sort((a, b) => a.sym.localeCompare(b.sym));
byYield.forEach((e, i) => e.yRank = i + 1);
byAum.forEach((e, i) => e.aRank = i + 1);
byGrade.forEach((e, i) => e.gRank = i + 1);
const avgYield = ETFS.reduce((s, e) => s + e.yield, 0) / N;
const medYield = byYield[Math.floor(N / 2)].yield;
const issuers = {}; for (const e of ETFS) (issuers[e.issuer] ||= []).push(e);
const cats = {}; for (const e of ETFS) (cats[e.cat] ||= []).push(e);
const grades = {}; for (const e of ETFS) (grades[e.grade] ||= []).push(e);
const today = new Date();
const isoDate = today.toISOString().slice(0, 10);
const niceDate = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });

// compact data for client-side search, random, recently viewed
const MINI = JSON.stringify(az.map(e => [e.sym, e.name, e.yield, e.grade]));

// ---------- shared chrome ----------
const BANNER = `<div class="banner">
    <a href="https://lsfunds.com/etfs/ovl" target="_blank" rel="noopener noreferrer">
        <img src="https://raw.githubusercontent.com/benjiesiegel1414/topdividendetfs-site/main/Revised Top Dividend Tools OVL ad.png" alt="Sponsored: OVL ETF" loading="lazy">
    </a>
    <small style="color:#666; font-size:0.78em; font-weight:600;">Sponsored By</small>
    <small style="color:#666; font-size:0.78em; font-weight:400; text-align:center; max-width:100%; overflow-wrap:anywhere;">Read carefully before investing. Prospectus: <a href="https://lsfunds.com/hubfs/Regulatory/Prospectus.pdf?hsLang=en" target="_blank" rel="noopener noreferrer" style="color:#666 !important; font-family:inherit !important; font-size:inherit !important; font-weight:400 !important; text-shadow:none !important; background:none !important; letter-spacing:normal; text-decoration:underline !important;">https://lsfunds.com/hubfs/Regulatory/Prospectus.pdf?hsLang=en</a></small>
</div>`;

const SIGNUP = `<!-- EMAIL SIGNUP -->
    <div class="etf-signup" data-variant="featured" data-color="#1A3C34" data-accent="#2E5D54" data-source="topdividendetfs"></div>
    <script src="/email-signup.js" defer></script>`;

const PRO_BOX = (txt) => `<div class="pro-box">
      <h3>🚨 For Serious Dividend Investors: TopDividendETFsPRO</h3>
      <p>${txt}</p>
      <a href="https://topdividendetfspro.com/" target="_blank" rel="noopener">Go PRO →</a>
    </div>`;

const FOOTER = `<footer class="footer">
      <p style="margin-bottom:10px;"><a href="/" style="font-weight:900;font-size:1.05em;color:var(--green-dark);">← Back to TopDividendETFs.com Home</a></p>
      <p><a href="/etfs/">All ETFs A to Z</a> | <a href="/etfs/highest-yield">Highest Yield</a> | <a href="/etfs/largest">Largest ETFs</a> | <a href="/etfs/grade/a-plus">A+ Rated</a> | <a href="/top-voted-etfs">Top Voted</a> | <a href="/blog">Blog</a> | <a href="/FAQ.html">FAQ</a> | <a href="/terms-of-use.html">Terms</a> | <a href="/privacy-policy.html">Privacy</a></p>
      <p style="margin-top:8px;">Contact: <a href="mailto:Business@TopDividendETFs.com">Business@TopDividendETFs.com</a></p>
      <p style="margin-top:12px;"><strong>Our network:</strong> <a href="https://topdividendetfspro.com/" target="_blank">TopDividendETFsPRO</a> · <a href="https://weeklyetfs.com/" target="_blank">WeeklyETFs</a> · <a href="https://monthlyetfs.com/" target="_blank">MonthlyETFs</a> · <a href="https://growthetfs.com/" target="_blank">GrowthETFs</a> · <a href="https://etftotalreturns.com/" target="_blank">ETFTotalReturns</a> · <a href="https://topetfs.com/" target="_blank">TopETFs</a> · <a href="https://dividendprojection.com/" target="_blank">DividendProjection</a></p>
    </footer>`;

const EXTRA_CSS = `
    .content{padding-bottom:70px}
    .hero-block .grade-badge{display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:14px;font-size:1.9rem;font-weight:900;color:#fff;margin-bottom:10px;position:relative;z-index:1;box-shadow:0 4px 14px rgba(0,0,0,.25)}
    .hero-block .tk{font-size:clamp(2.4rem,7vw,3.6rem);font-weight:900;color:#fff;letter-spacing:.02em;line-height:1;position:relative;z-index:1}
    .hero-block h1{font-size:clamp(1.05rem,2.6vw,1.35rem);color:rgba(255,255,255,.88);font-weight:700;margin:8px 0 16px}
    .chips{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:20px;position:relative;z-index:1}
    .chip{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.3);color:#d8ffe8;border-radius:20px;padding:5px 13px;font-size:.8rem;font-weight:700;text-decoration:none}
    .chip:hover{background:rgba(255,255,255,.2)}
    .stat-pill a{color:inherit;text-decoration:none}
    .navbar{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:stretch;margin:4px 0 6px}
    .nav-btn{background:#fff;border:2px solid var(--border);border-radius:8px;padding:10px 14px;text-decoration:none;color:var(--green-dark);font-weight:900;box-shadow:0 2px 8px rgba(0,0,0,.06);display:flex;flex-direction:column;justify-content:center}
    .nav-btn small{font-weight:700;color:var(--text-light);font-size:.72rem;letter-spacing:.06em;text-transform:uppercase}
    .nav-btn.next{text-align:right}.nav-btn:hover{border-color:var(--green-mid)}
    .nav-btn.rand{background:var(--green-dark);color:#fff;border-color:var(--green-dark);align-items:center;cursor:pointer;font-family:inherit;font-size:.95rem}
    .search-wrap{position:relative;margin:14px 0 4px}
    .search-wrap input{width:100%;padding:13px 16px 13px 42px;border:2px solid var(--green-mid);border-radius:10px;font-size:1rem;font-family:inherit;outline:none;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%232E5D54' stroke-width='2.5'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E") no-repeat 14px center}
    .search-results{position:absolute;left:0;right:0;top:100%;background:#fff;border:2px solid var(--green-mid);border-top:none;border-radius:0 0 10px 10px;z-index:20;max-height:320px;overflow:auto;display:none;box-shadow:var(--shadow)}
    .search-results a{display:flex;justify-content:space-between;gap:10px;padding:10px 16px;text-decoration:none;color:var(--text);border-top:1px solid #eef5f1;font-size:.92rem}
    .search-results a:hover,.search-results a.on{background:#f0fbf5}
    .search-results b{color:var(--green-dark);min-width:56px;display:inline-block}
    .rank-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:12px 0}
    .rank-card{background:#fff;border:2px solid var(--border);border-radius:10px;padding:16px;text-decoration:none;color:var(--text);box-shadow:var(--shadow);transition:transform .15s,border-color .15s}
    .rank-card:hover{transform:translateY(-3px);border-color:var(--green-mid)}
    .rank-card .rk{font-size:1.9rem;font-weight:900;color:var(--green-dark);line-height:1}
    .rank-card .rk small{font-size:.85rem;color:var(--text-light);font-weight:700}
    .rank-card .lb{font-size:.72rem;letter-spacing:.09em;text-transform:uppercase;color:var(--text-light);font-weight:900;margin-bottom:6px}
    .rank-card .go{font-size:.8rem;color:var(--green-mid);font-weight:900;margin-top:8px}
    .card{background:#fff;border:2px solid var(--border);border-radius:10px;padding:20px 22px;box-shadow:var(--shadow);margin:12px 0}
    .calc-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
    .calc-row input{flex:1 1 160px;padding:11px 14px;font-size:1.1rem;font-weight:900;border:2px solid var(--green-mid);border-radius:8px;font-family:inherit;color:var(--green-dark)}
    .amt{background:#f2fbf5;border:1px solid var(--border);border-radius:6px;padding:9px 12px;font-weight:900;color:var(--green-dark);cursor:pointer;font-family:inherit;font-size:.9rem}
    .amt.on{background:var(--green-dark);color:#fff}
    .calc-out{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    .calc-out div{background:#f2fbf5;border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center}
    .calc-out dt{font-size:.7rem;letter-spacing:.09em;text-transform:uppercase;color:var(--text-light);font-weight:900}
    .calc-out dd{font-size:1.35rem;font-weight:900;color:var(--green-dark);margin-top:3px}
    .calc-vs{margin-top:16px;font-size:.92rem;color:var(--text-mid)}
    .calc-vs a{display:flex;justify-content:space-between;padding:9px 12px;border:1px solid var(--border);border-radius:6px;margin-top:6px;text-decoration:none;color:var(--text)}
    .calc-vs a:hover{border-color:var(--green-mid);background:#f7fdf9}.calc-vs a b{color:var(--green-dark)}
    .spectrum{display:grid;grid-template-columns:repeat(13,1fr);gap:3px;margin:12px 0 6px}
    .spectrum a{text-align:center;padding:9px 0;border-radius:5px;font-weight:900;font-size:.8rem;color:#fff;text-decoration:none;opacity:.35;transition:opacity .15s}
    .spectrum a:hover{opacity:.8}.spectrum a.cur{opacity:1;transform:scale(1.15);box-shadow:0 3px 10px rgba(0,0,0,.25)}
    .ybar{position:relative;height:14px;background:#e6efe9;border-radius:7px;margin:40px 0 8px}
    .ybar .mk{position:absolute;top:-24px;transform:translateX(-50%);font-size:.75rem;font-weight:900;white-space:nowrap}
    .ybar .dot{position:absolute;top:-3px;width:20px;height:20px;border-radius:50%;transform:translateX(-50%);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)}
    .two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .vote-box{text-align:center}
    .vote-count{font-size:2rem;font-weight:900;color:var(--green-dark)}
    .vote-btn{background:#FFD700;color:#1A3C34;border:none;font-weight:900;font-size:1rem;padding:12px 28px;border-radius:8px;cursor:pointer;margin-top:10px;font-family:inherit;box-shadow:0 3px 10px rgba(0,0,0,.15)}
    .vote-btn:disabled{background:#cfe9da;cursor:default}
    .mini-list{list-style:none}.mini-list li{border-top:1px solid #eef5f1}
    .mini-list a{display:flex;justify-content:space-between;padding:9px 4px;text-decoration:none;color:var(--text);font-size:.92rem}
    .mini-list a:hover{background:#f7fdf9}.mini-list b{color:var(--green-dark)}
    .etf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin:12px 0 6px}
    .etf-card{background:#fff;border:2px solid var(--border);border-radius:10px;padding:14px 16px;text-decoration:none;color:var(--text);box-shadow:0 2px 10px rgba(0,0,0,.06);display:flex;flex-direction:column;gap:6px;transition:transform .15s,border-color .15s}
    .etf-card:hover{transform:translateY(-3px);border-color:var(--green-mid)}
    .etf-card .top{display:flex;justify-content:space-between;align-items:center}
    .etf-card .s{font-size:1.25rem;font-weight:900;color:var(--green-dark)}
    .etf-card .g{font-size:.8rem;font-weight:900;color:#fff;border-radius:5px;padding:3px 8px}
    .etf-card .n{font-size:.8rem;color:var(--text-light);line-height:1.35;min-height:2.1em}
    .etf-card .m{display:flex;justify-content:space-between;font-size:.82rem;color:var(--text-mid)}
    .etf-card .m b{color:var(--green-dark)}
    .see-all{display:inline-block;margin:6px 0 4px;font-weight:900;color:var(--green-mid);text-decoration:none}
    .see-all:hover{text-decoration:underline}
    table.cmp{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:var(--shadow);font-size:.92rem}
    table.cmp th{background:var(--green-dark);color:#fff;padding:11px 12px;text-align:left;font-size:.78rem;letter-spacing:.06em;text-transform:uppercase}
    table.cmp td{padding:11px 12px;border-top:1px solid #eef5f1}
    table.cmp tr.me td{background:#f2fbf5;font-weight:900}
    table.cmp a{color:var(--green-dark);font-weight:900}
    .tk-strip{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}
    .tk-strip a{background:#fff;border:1px solid var(--border);border-radius:5px;padding:5px 9px;font-size:.8rem;font-weight:900;color:var(--green-dark);text-decoration:none}
    .tk-strip a:hover{background:var(--green-dark);color:#fff}
    .tk-strip a.cur{background:var(--green-dark);color:#fff}
    .sticky-nav{position:fixed;left:0;right:0;bottom:0;z-index:50;background:rgba(26,60,52,.97);display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 14px;box-shadow:0 -3px 12px rgba(0,0,0,.2);transform:translateY(110%);transition:transform .25s}
    .sticky-nav.show{transform:none}
    .sticky-nav a,.sticky-nav button{color:#fff;text-decoration:none;font-weight:900;font-size:.9rem;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);border-radius:6px;padding:8px 12px;font-family:inherit;cursor:pointer;white-space:nowrap}
    .sticky-nav .mid{background:#FFD700;color:#1A3C34;border-color:#FFD700}
    .hub-table{width:100%;border-collapse:collapse;background:#fff;box-shadow:var(--shadow);border-radius:10px;overflow:hidden;font-size:.92rem}
    .hub-table th{background:var(--green-dark);color:#fff;padding:11px 12px;text-align:left;font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;user-select:none}
    .hub-table td{padding:10px 12px;border-top:1px solid #eef5f1}
    .hub-table tr:hover td{background:#f7fdf9}
    .hub-table a{color:var(--green-dark);font-weight:900;text-decoration:none}
    .hub-table .nm{color:var(--text-light);font-size:.84rem}
    .gpill{display:inline-block;color:#fff;font-weight:900;border-radius:5px;padding:2px 8px;font-size:.8rem}
    .hub-links{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
    .hub-links a{background:#fff;border:2px solid var(--border);border-radius:20px;padding:6px 14px;font-weight:900;color:var(--green-dark);text-decoration:none;font-size:.86rem}
    .hub-links a:hover,.hub-links a.cur{border-color:var(--green-dark);background:var(--green-dark);color:#fff}
    @media(max-width:760px){.etf-grid{grid-template-columns:1fr 1fr;gap:8px}.etf-card{padding:11px 12px}.etf-card .s{font-size:1.05rem}.etf-card .m{flex-direction:column;gap:2px}.rank-grid{grid-template-columns:1fr 1fr}.two{grid-template-columns:1fr}.calc-out dd{font-size:1.1rem}.spectrum a{font-size:.66rem;padding:7px 0}.hub-table .hide-m{display:none}table.cmp .hide-m{display:none}}
    @media(max-width:420px){.nav-btn{padding:8px 10px;font-size:.9rem}.calc-out{grid-template-columns:1fr}}
`;

function shell({ title, desc, canonical, body, schema = [], ogTitle, ogImage }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(ogTitle || title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="TopDividendETFs.com">
${ogImage ? `  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(ogTitle || title)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${ogImage}">` : `  <meta name="twitter:card" content="summary">`}
  <meta name="twitter:site" content="@TopDividendETFs">
${schema.map(s => `  <script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n')}
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-B8TGV115DP"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-B8TGV115DP');</script>
  <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
${BASE_CSS}
${EXTRA_CSS}
  </style>
</head>
<body>
  <header onclick="location.href='/'"><div class="logo">TopDividendETFs.com</div></header>
  <div class="content">
${body}
  </div>
</body>
</html>
`;
}

function etfCard(e, extra = '') {
  return `<a class="etf-card" href="${e.url}"><div class="top"><span class="s">${e.sym}</span><span class="g" style="background:${gradeColor(e.grade)}">${e.grade}</span></div><div class="n">${esc(e.name)}</div><div class="m"><span>Yield <b>${fmtYield(e.yield)}</b></span><span>AUM <b>${fmtAum(e.aum)}</b></span></div>${extra}</a>`;
}

const SEARCH = `<div class="search-wrap"><input id="q" type="search" placeholder="Search any ETF, ticker or issuer (e.g. JEPQ, YieldMax, Bitcoin)" autocomplete="off" aria-label="Search ETFs"><div class="search-results" id="qr"></div></div>`;

const CLIENT_JS = (sym) => `<script>
var ETFS=${MINI};
var CUR=${JSON.stringify(sym || '')};
function gc(g){var r=['A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','F'].indexOf(g);return r<0?'#1A3C34':r<=2?'#2ecc71':r<=5?'#7ed957':r<=8?'#f5a623':'#e74c3c';}
function go(s){location.href='/etfs/'+s.toLowerCase();}
function randomEtf(){var p;do{p=ETFS[Math.floor(Math.random()*ETFS.length)][0];}while(p===CUR&&ETFS.length>1);try{gtag('event','random_etf',{from:CUR||'hub',to:p});}catch(e){}go(p);}
(function(){var q=document.getElementById('q'),r=document.getElementById('qr');if(!q)return;var sel=-1;
function draw(){var v=q.value.trim().toLowerCase();if(!v){r.style.display='none';return;}
var m=ETFS.filter(function(e){return e[0].toLowerCase().indexOf(v)===0;}).concat(ETFS.filter(function(e){return e[0].toLowerCase().indexOf(v)!==0&&e[1].toLowerCase().indexOf(v)>=0;})).slice(0,10);
sel=m.length?0:-1;r.innerHTML=m.length?m.map(function(e,i){return '<a href="/etfs/'+e[0].toLowerCase()+'"'+(i===0?' class="on"':'')+'><span><b>'+e[0]+'</b> '+e[1].replace(/</g,'')+'</span><span>'+e[2]+'%</span></a>';}).join(''):'<a href="/etfs/"><span>No match. Browse all ETFs A to Z</span></a>';r.style.display='block';}
q.addEventListener('input',draw);q.addEventListener('focus',draw);
q.addEventListener('keydown',function(ev){var a=r.querySelectorAll('a');if(ev.key==='ArrowDown'||ev.key==='ArrowUp'){ev.preventDefault();if(!a.length)return;sel=(sel+(ev.key==='ArrowDown'?1:-1)+a.length)%a.length;a.forEach(function(x,i){x.classList.toggle('on',i===sel);});}else if(ev.key==='Enter'&&a[sel]){location.href=a[sel].getAttribute('href');}});
document.addEventListener('click',function(ev){if(!ev.target.closest('.search-wrap'))r.style.display='none';});})();
(function(){var box=document.getElementById('recent');if(!box)return;var list=[];try{list=JSON.parse(localStorage.getItem('tde_recent')||'[]');}catch(e){}
var shown=list.filter(function(s){return s!==CUR;}).map(function(s){return ETFS.find(function(e){return e[0]===s;});}).filter(Boolean).slice(0,6);
if(shown.length){box.innerHTML='<h2 class="section-title">Recently Viewed</h2><div class="tk-strip">'+shown.map(function(e){return '<a href="/etfs/'+e[0].toLowerCase()+'">'+e[0]+' · '+e[2]+'%</a>';}).join('')+'</div>';}
if(CUR){list=[CUR].concat(list.filter(function(s){return s!==CUR;})).slice(0,12);try{localStorage.setItem('tde_recent',JSON.stringify(list));}catch(e){}}})();
(function(){var sn=document.getElementById('stickyNav');if(!sn)return;window.addEventListener('scroll',function(){sn.classList.toggle('show',window.scrollY>500);},{passive:true});})();
function toggleFaq(el){var i=el.closest('.faq-item'),o=i.classList.contains('open');document.querySelectorAll('.faq-item.open').forEach(function(x){x.classList.remove('open');});if(!o)i.classList.add('open');}
</script>`;

// ---------- ETF page ----------
function etfPage(e) {
  const yi = byYield.indexOf(e);
  const prev = byYield[(yi - 1 + N) % N], next = byYield[(yi + 1) % N];
  const $ = '$' + e.sym;
  const similar = [...cats[e.cat]].filter(x => x !== e).sort((a, b) => Math.abs(a.yield - e.yield) - Math.abs(b.yield - e.yield) || b.aum - a.aum).slice(0, 6);
  const sameIssuer = issuers[e.issuer].filter(x => x !== e).sort((a, b) => b.aum - a.aum);
  const sameGrade = grades[e.grade].filter(x => x !== e).sort((a, b) => b.aum - a.aum).slice(0, 6);
  const higherYield = byYield.filter(x => x.yield > e.yield && GRADE_RANK[x.grade] <= GRADE_RANK[e.grade]).slice(-6).reverse();
  const posts = relatedPosts(e.sym);
  const pctBelow = Math.round(100 * ETFS.filter(x => x.yield < e.yield).length / N);
  const gradeSlugE = gradeSlugFix(e.grade);
  const catSlug = slug(e.cat), issSlug = slug(e.issuer);
  const vsAvg = e.yield - avgYield;
  const maxY = Math.max(...ETFS.map(x => x.yield));
  const scale = y => Math.min(100, Math.sqrt(y / maxY) * 100);
  const cmp = [e, ...similar];
  const monthly10k = 10000 * e.yield / 100 / 12;
  const gradeWord = GRADE_RANK[e.grade] <= 2 ? 'one of the highest grades' : GRADE_RANK[e.grade] <= 5 ? 'a solid grade' : GRADE_RANK[e.grade] <= 8 ? 'a middle-of-the-pack grade' : 'one of the lower grades';
  const decayTxt = e.decay
    ? `${$} is flagged for price decay, meaning its share price has trended down over time as it pays out high income. Total return matters more than yield alone for funds like this.`
    : `${$} is not flagged for price decay on our list, meaning its share price has generally held up while it pays income.`;

  const faqs = [
    [`What is ${e.sym}'s dividend yield?`, `${$} (${e.name}) currently shows a dividend yield of about ${fmtYield(e.yield)} on TopDividendETFs.com. That ranks ${ord(e.yRank)} highest out of the ${N} dividend ETFs we track and is higher than ${pctBelow}% of them. Yields change with the share price and each distribution.`],
    [`How much would $10,000 in ${e.sym} pay?`, `At a ${fmtYield(e.yield)} yield, $10,000 invested in ${$} would pay roughly ${money(10000 * e.yield / 100)} per year, or about ${money(monthly10k)} per month on average. Actual payouts vary, so treat this as an estimate based on the current yield.`],
    [`What grade does ${e.sym} get?`, `${$} earns a ${e.grade} on the TopDividendETFs.com scorecard, ${gradeWord} on our list. It ranks ${ord(e.gRank)} of ${N} when every ETF is sorted by grade. The grade is our own rating and is not a recommendation to buy or sell.`],
    [`Does ${e.sym} have price decay?`, decayTxt],
    [`How big is ${e.sym}?`, `${$} has about ${fmtAum(e.aum)} in assets under management, making it the ${ord(e.aRank)} largest of the ${N} ETFs we track.`],
    [`Who manages ${e.sym}?`, `${$} is part of the ${e.issuer} lineup. We track ${issuers[e.issuer].length} ${e.issuer} ETF${issuers[e.issuer].length === 1 ? '' : 's'} on TopDividendETFs.com.`],
    [`What ETFs are similar to ${e.sym}?`, similar.length ? `ETFs in the same ${e.cat.toLowerCase()} group with a similar yield include ${similar.slice(0, 4).map(x => '$' + x.sym + ' (' + fmtYield(x.yield) + ')').join(', ')}.` : `${$} is the only ${e.cat.toLowerCase()} ETF on our list right now.`]
  ];

  const schema = [
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'All ETFs', item: SITE + '/etfs/' },
      { '@type': 'ListItem', position: 3, name: e.issuer + ' ETFs', item: SITE + '/etfs/issuer/' + issSlug },
      { '@type': 'ListItem', position: 4, name: e.sym, item: SITE + e.url }] }
  ];

  const body = `
${BANNER}
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/etfs/">All ETFs</a><span>›</span><a href="/etfs/issuer/${issSlug}">${esc(e.issuer)}</a><span>›</span>${e.sym}</nav>

    <div class="hero-block">
      <div class="grade-badge" style="background:${gradeColor(e.grade)}" title="TopDividendETFs grade">${e.grade}</div>
      <div class="tk">${e.sym}</div>
      <h1>${esc(e.name)} (${e.sym}): Yield, Grade &amp; Income</h1>
      <div class="chips">
        <a class="chip" href="/etfs/issuer/${issSlug}">${esc(e.issuer)} · ${issuers[e.issuer].length} ETFs</a>
        <a class="chip" href="/etfs/category/${catSlug}">${e.cat}</a>
        <a class="chip" href="/etfs/grade/${gradeSlugE}">${e.grade} rated</a>
        <a class="chip" href="${e.decay ? '/etfs/highest-yield' : '/10-highest-yield-etfs'}">${e.decay ? 'Price decay: Yes' : 'No price decay'}</a>
      </div>
      <div class="quick-stats">
        <div class="stat-pill"><a href="/etfs/highest-yield#${e.sym}"><strong>${fmtYield(e.yield)}</strong>Dividend Yield</a></div>
        <div class="stat-pill"><a href="/etfs/largest#${e.sym}"><strong>${fmtAum(e.aum)}</strong>Assets (AUM)</a></div>
        <div class="stat-pill"><a href="/etfs/grade/${gradeSlugE}"><strong>${e.grade}</strong>Our Grade</a></div>
        <div class="stat-pill"><strong id="heroVotes">…</strong>Votes This Week</div>
      </div>
    </div>

    ${SIGNUP}

    <div class="navbar">
      <a class="nav-btn prev" href="${prev.url}"><small>◀ Higher yield</small>${prev.sym} · ${fmtYield(prev.yield)}</a>
      <button class="nav-btn rand" onclick="randomEtf()">🎲 Random</button>
      <a class="nav-btn next" href="${next.url}"><small>Lower yield ▶</small>${next.sym} · ${fmtYield(next.yield)}</a>
    </div>
    ${SEARCH}
    <div class="updated-line"><span class="updated-dot" aria-hidden="true"></span>Data updated: <strong><time datetime="${isoDate}">${niceDate}</time></strong> · Refreshed daily from the TopDividendETFs.com list</div>

    <div class="answer-box">
      <div class="ab-label">${e.sym} at a glance</div>
      <p><strong>${$}</strong> (${esc(e.name)}) yields about <strong>${fmtYield(e.yield)}</strong>, ${vsAvg >= 0 ? `<strong>${fmtYield(vsAvg)} above</strong>` : `<strong>${fmtYield(-vsAvg)} below</strong>`} the ${fmtYield(avgYield)} average of the ${N} dividend ETFs we track. It holds about <strong>${fmtAum(e.aum)}</strong> in assets, earns a <strong>${e.grade}</strong> on our scorecard and is ${e.decay ? '<strong>flagged for price decay</strong>' : '<strong>not flagged for price decay</strong>'}.</p>
    </div>

    <h2 class="section-title">Where ${e.sym} Ranks</h2>
    <p class="section-lead">How ${e.sym} stacks up against all ${N} dividend ETFs on TopDividendETFs.com. Tap any card to see the full ranking.</p>
    <div class="rank-grid">
      <a class="rank-card" href="/etfs/highest-yield#${e.sym}"><div class="lb">Yield Rank</div><div class="rk">#${e.yRank} <small>of ${N}</small></div><div class="go">See highest yield →</div></a>
      <a class="rank-card" href="/etfs/largest#${e.sym}"><div class="lb">Size Rank</div><div class="rk">#${e.aRank} <small>of ${N}</small></div><div class="go">See largest ETFs →</div></a>
      <a class="rank-card" href="/etfs/grade/${gradeSlugE}"><div class="lb">Grade Rank</div><div class="rk">#${e.gRank} <small>of ${N}</small></div><div class="go">See ${e.grade} ETFs →</div></a>
      <a class="rank-card" href="/top-voted-etfs"><div class="lb">Vote Rank</div><div class="rk" id="voteRankBig">…</div><div class="go">See top voted →</div></a>
    </div>

    <h2 class="section-title">${e.sym} Dividend Income Calculator</h2>
    <p class="section-lead">Estimate what ${e.sym} could pay at its current ${fmtYield(e.yield)} yield, then see the same amount in similar ETFs.</p>
    <div class="card">
      <div class="calc-row">
        <input id="amt" type="text" inputmode="numeric" value="10,000" aria-label="Investment amount">
        <button class="amt" data-v="1000">$1K</button><button class="amt on" data-v="10000">$10K</button><button class="amt" data-v="50000">$50K</button><button class="amt" data-v="100000">$100K</button>
      </div>
      <dl class="calc-out"><div><dt>Per Year</dt><dd id="cY"></dd></div><div><dt>Per Month</dt><dd id="cM"></dd></div><div><dt>Per Week</dt><dd id="cW"></dd></div></dl>
      <div class="calc-vs"><strong>Same amount in similar ETFs:</strong>${similar.slice(0, 3).map(x => `<a href="${x.url}" data-y="${x.yield}"><span><b>${x.sym}</b> · ${fmtYield(x.yield)} yield</span><span class="vs-out"></span></a>`).join('')}</div>
      <p style="font-size:.78rem;color:var(--text-light);margin-top:10px">Estimate only. Uses the current yield and assumes it stays the same, which it will not. Want exact projections? Try <a href="https://dividendprojection.com/" target="_blank" rel="noopener" style="color:var(--green-mid);font-weight:700">DividendProjection.com</a>.</p>
    </div>

    <div class="two">
      <div class="card">
        <h3 style="color:var(--green-dark);font-weight:900;margin-bottom:4px">Grade Spectrum</h3>
        <p class="section-lead" style="margin-bottom:0">${e.sym} earns a <strong>${e.grade}</strong>. Tap any grade to browse those ETFs.</p>
        <div class="spectrum">${GRADES.map(g => `<a href="/etfs/grade/${gradeSlugFix(g)}" class="${g === e.grade ? 'cur' : ''}" style="background:${gradeColor(g)}" title="${grades[g] ? grades[g].length : 0} ETFs">${g}</a>`).join('')}</div>
      </div>
      <div class="card">
        <h3 style="color:var(--green-dark);font-weight:900;margin-bottom:4px">Yield vs. the Field</h3>
        <p class="section-lead" style="margin-bottom:0">Higher than <strong>${pctBelow}%</strong> of the ETFs we track.</p>
        <div class="ybar">
          <span class="dot" style="left:${scale(medYield)}%;background:#9bb5aa"></span><span class="mk" style="left:${scale(medYield)}%;color:#7a948a">Median ${fmtYield(medYield)}</span>
          <span class="dot" style="left:${scale(e.yield)}%;background:${gradeColor(e.grade)};width:24px;height:24px;top:-5px"></span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--text-light)"><span>0%</span><span><b style="color:var(--green-dark)">${e.sym} ${fmtYield(e.yield)}</b></span><span>${fmtYield(maxY)}</span></div>
      </div>
    </div>

    <div class="two">
      <div class="card vote-box">
        <h3 style="color:var(--green-dark);font-weight:900">Do You Like ${e.sym}?</h3>
        <p class="section-lead" style="margin:4px 0 6px">Cast your vote. Votes reset every Friday at 4 PM ET.</p>
        <div class="vote-count" id="voteCount">…</div>
        <div id="voteRank" style="font-size:.85rem;color:var(--text-light)"></div>
        <button class="vote-btn" id="voteBtn">👍 Vote for ${e.sym}</button>
        <div id="voteMsg" style="font-size:.82rem;color:var(--text-light);margin-top:8px"></div>
      </div>
      <div class="card">
        <h3 style="color:var(--green-dark);font-weight:900">🔥 Most Voted This Week</h3>
        <ul class="mini-list" id="topVoted"><li style="padding:10px 4px;color:var(--text-light)">Loading…</li></ul>
        <a class="see-all" href="/top-voted-etfs">Full leaderboard →</a>
      </div>
    </div>

    <h2 class="section-title">${e.sym} vs. Similar ETFs</h2>
    <p class="section-lead">${e.cat} ETFs with the closest yield to ${e.sym}. Tap a ticker to see its full page.</p>
    <table class="cmp"><thead><tr><th>ETF</th><th>Yield</th><th>AUM</th><th>Grade</th><th class="hide-m">Price Decay</th></tr></thead><tbody>
      ${cmp.map(x => `<tr class="${x === e ? 'me' : ''}"><td>${x === e ? x.sym : `<a href="${x.url}">${x.sym}</a>`}</td><td>${fmtYield(x.yield)}</td><td>${fmtAum(x.aum)}</td><td><span class="gpill" style="background:${gradeColor(x.grade)}">${x.grade}</span></td><td class="hide-m">${x.decay ? 'Yes' : 'No'}</td></tr>`).join('\n      ')}
    </tbody></table>
    <a class="see-all" href="/etfs/category/${catSlug}">See all ${cats[e.cat].length} ${e.cat} ETFs →</a>

    ${higherYield.length ? `<h2 class="section-title">Higher Yield, Same Grade or Better</h2>
    <p class="section-lead">Want more income than ${e.sym} without giving up grade? These ETFs yield more and score ${e.grade} or better.</p>
    <div class="etf-grid">${higherYield.map(x => etfCard(x)).join('')}</div>` : ''}

    ${sameIssuer.length ? `<h2 class="section-title">More ${esc(e.issuer)} ETFs</h2>
    <p class="section-lead">${sameIssuer.length} other ${esc(e.issuer)} fund${sameIssuer.length === 1 ? '' : 's'} on our list, largest first.</p>
    <div class="etf-grid">${sameIssuer.slice(0, 8).map(x => etfCard(x)).join('')}</div>
    ${sameIssuer.length > 8 ? `<a class="see-all" href="/etfs/issuer/${issSlug}">See all ${issuers[e.issuer].length} ${esc(e.issuer)} ETFs →</a>` : ''}` : ''}

    ${PRO_BOX(`Go deeper on ${$} and 150+ other income ETFs: grades, tax treatment, payout schedules, yield and total return trends, and advanced filters, all in one terminal.`)}

    <h2 class="section-title">Other ${e.grade} Rated ETFs</h2>
    <p class="section-lead">The largest ETFs that share ${e.sym}'s ${e.grade} grade.</p>
    <div class="etf-grid">${sameGrade.map(x => etfCard(x)).join('')}</div>
    <a class="see-all" href="/etfs/grade/${gradeSlugE}">See all ${grades[e.grade].length} ${e.grade} ETFs →</a>

    ${posts.length ? `<h2 class="section-title">${e.sym} Articles &amp; Tools</h2>
    <div class="rel-grid">${posts.map(p => `<a class="rel-card" href="${p.href}"><div class="rel-tag">${e.sym} Deep Dive</div><h4>${esc(p.title)}</h4></a>`).join('')}</div>` : ''}

    <h2 class="section-title">${e.sym} FAQ</h2>
    <ul class="faq-list">
${faqs.map(([q, a]) => `      <li class="faq-item"><div class="faq-q" onclick="toggleFaq(this)">${esc(q)}<span class="faq-icon">+</span></div><div class="faq-a">${esc(a)}</div></li>`).join('\n')}
    </ul>

    <div id="recent"></div>

    <h2 class="section-title">Browse Every Dividend ETF</h2>
    <p class="section-lead">All ${N} ETFs on TopDividendETFs.com. Jump to any one.</p>
    <div class="tk-strip">${az.map(x => `<a href="${x.url}"${x === e ? ' class="cur"' : ''}>${x.sym}</a>`).join('')}</div>
    <div class="hub-links"><a href="/etfs/">A to Z table</a><a href="/etfs/highest-yield">Highest yield</a><a href="/etfs/largest">Largest</a>${Object.keys(CAT_INFO).filter(c => cats[c]).map(c => `<a href="/etfs/category/${slug(c)}">${c}</a>`).join('')}</div>

    <div class="disclaimer-box">
      <h3>Important Disclaimer</h3>
      <p>TopDividendETFs.com is published by Dividend Empire LLC for educational and informational purposes only. Yield, AUM, price decay and grade figures come from the TopDividendETFs.com list and are updated regularly, but may lag the market. Yields change with share prices and distributions, and past distributions do not guarantee future payments. Grades are our own opinion and are not a recommendation. Nothing on this page is financial advice. Always read the fund's prospectus and verify data with the issuer before investing.</p>
    </div>

${BANNER}

    <div class="share-buttons">
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE + e.url)}" target="_blank" class="share-btn fb" onclick="window.open(this.href,'','width=570,height=350');return false;"><svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>Share</a>
      <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(SITE + e.url)}&text=${encodeURIComponent('$' + e.sym + ' yields ' + fmtYield(e.yield) + ' and ranks #' + e.yRank + ' of ' + N + ' dividend ETFs @TopDividendETFs')}" target="_blank" class="share-btn xbtn" onclick="window.open(this.href,'','width=570,height=350');return false;"><svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>Post</a>
    </div>
    <button class="back-to-top" onclick="window.scrollTo({top:0,behavior:'smooth'})">↑ Back to Top</button>
    ${FOOTER}

    <nav class="sticky-nav" id="stickyNav" aria-label="ETF navigation">
      <a href="${prev.url}">◀ ${prev.sym}</a>
      <button class="mid" onclick="randomEtf()">🎲 Random ETF</button>
      <a href="${next.url}">${next.sym} ▶</a>
    </nav>
${CLIENT_JS(e.sym)}
<script>
(function(){var Y=${e.yield},el=document.getElementById('amt');
function fmt(n){return '$'+Math.round(n).toLocaleString('en-US');}
function run(){var v=parseFloat(el.value.replace(/[^0-9.]/g,''))||0;var y=v*Y/100;document.getElementById('cY').textContent=fmt(y);document.getElementById('cM').textContent=fmt(y/12);document.getElementById('cW').textContent=fmt(y/52);
document.querySelectorAll('.calc-vs a').forEach(function(a){a.querySelector('.vs-out').textContent=fmt(v*parseFloat(a.dataset.y)/100/12)+'/mo';});}
el.addEventListener('input',function(){document.querySelectorAll('.amt').forEach(function(b){b.classList.remove('on');});run();});
el.addEventListener('blur',function(){var v=parseFloat(el.value.replace(/[^0-9.]/g,''))||0;el.value=v.toLocaleString('en-US');});
document.querySelectorAll('.amt').forEach(function(b){b.onclick=function(){document.querySelectorAll('.amt').forEach(function(x){x.classList.remove('on');});b.classList.add('on');el.value=(+b.dataset.v).toLocaleString('en-US');run();try{gtag('event','calc_amount',{etf:CUR,amount:+b.dataset.v});}catch(e){}};});
run();})();
(function(){var API=${JSON.stringify(VOTE_API)},S=CUR;
function hk(){var d=new Date();d.setMinutes(0,0,0);return 'votes_'+d.getTime();}
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}}
var vc=document.getElementById('voteCount'),vr=document.getElementById('voteRank'),vb=document.getElementById('voteBtn'),vm=document.getElementById('voteMsg');
fetch(API+'?action=getAll&t='+Date.now()).then(function(r){return r.ok?r.json():{};}).then(function(d){
var n=d[S]||0;vc.textContent=n.toLocaleString()+(n===1?' vote':' votes');document.getElementById('heroVotes').textContent=n.toLocaleString();
var ent=Object.entries(d).sort(function(a,b){return b[1]-a[1];});var i=ent.findIndex(function(x){return x[0]===S;});
vr.textContent=i>=0&&n>0?'#'+(i+1)+' most voted this week':'No votes yet this week. Be the first!';
document.getElementById('voteRankBig').innerHTML=i>=0&&n>0?'#'+(i+1)+' <small>this week</small>':'<small>No votes yet</small>';
var top=ent.filter(function(x){return x[1]>0;}).slice(0,6);
document.getElementById('topVoted').innerHTML=top.length?top.map(function(x,k){var m=ETFS.find(function(e){return e[0]===x[0];});return '<li><a href="/etfs/'+x[0].toLowerCase()+'"><span>'+(k+1)+'. <b>'+x[0]+'</b>'+(m?' · '+m[2]+'%':'')+'</span><span>'+x[1]+' votes</span></a></li>';}).join(''):'<li style="padding:10px 4px;color:var(--text-light)">No votes yet this week.</li>';
}).catch(function(){vc.textContent='0 votes';document.getElementById('heroVotes').textContent='0';document.getElementById('voteRankBig').innerHTML='<small>n/a</small>';document.getElementById('topVoted').innerHTML='<li><a href="/top-voted-etfs"><span>See the leaderboard</span></a></li>';});
if(ls('voted_'+S)==='1'){vb.disabled=true;vb.textContent='✓ Voted';vm.textContent="You've already voted for this ETF.";}
vb.onclick=function(){if(ls('voted_'+S)==='1')return;var used=parseInt(ls(hk())||'0');if(used>=10){vm.textContent='You have used all 10 votes for this hour. Try again next hour.';return;}
vb.disabled=true;vb.textContent='✓ Voted';var c=(parseInt(vc.textContent.replace(/,/g,''))||0)+1;vc.textContent=c.toLocaleString()+(c===1?' vote':' votes');document.getElementById('heroVotes').textContent=c.toLocaleString();
ls(hk(),String(used+1));ls('voted_'+S,'1');vm.innerHTML='Thanks for voting! Now <a href="#" onclick="randomEtf();return false" style="color:var(--green-mid);font-weight:900">rate another random ETF →</a>';
try{gtag('event','etf_vote',{etf:S});}catch(e){}
fetch(API,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'vote',symbol:S})});};})();
</script>`;

  return shell({
    title: `${e.sym} ETF: ${fmtYield(e.yield)} Yield, ${e.grade} Grade, Dividend Income | TopDividendETFs`,
    ogTitle: `${e.sym}: ${e.name}`,
    desc: `${e.name} (${e.sym}) yields about ${fmtYield(e.yield)} with ${fmtAum(e.aum)} in assets and a ${e.grade} grade. See its rankings, an income calculator, similar ETFs and community votes.`,
    canonical: SITE + e.url,
    ogImage: fs.existsSync(path.join(ROOT, 'etf-images', e.sym.toLowerCase() + '-etf-wide.png')) ? `${SITE}/etf-images/${e.sym.toLowerCase()}-etf-wide.png` : null,
    schema, body
  });
}

// ---------- hub pages ----------
function hubPage({ urlPath, title, h1, eyebrow, lead, list, desc, sort = 'yield', crumbs = [], links = '' }) {
  const rows = list.map((x, i) => `<tr id="${x.sym}"><td>${i + 1}</td><td><a href="${x.url}">${x.sym}</a><div class="nm">${esc(x.name)}</div></td><td data-v="${x.yield}">${fmtYield(x.yield)}</td><td data-v="${x.aum}" class="hide-m">${fmtAum(x.aum)}</td><td data-v="${GRADE_RANK[x.grade]}"><span class="gpill" style="background:${gradeColor(x.grade)}">${x.grade}</span></td><td class="hide-m">${x.decay ? 'Yes' : 'No'}</td></tr>`).join('\n');
  const body = `
${BANNER}
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/etfs/">All ETFs</a>${crumbs.map(c => `<span>›</span>${c}`).join('')}</nav>
    <div class="hero-block">
      <div class="hero-eyebrow">${eyebrow}</div>
      <h1 style="color:#fff;font-size:clamp(1.6rem,4.5vw,2.5rem)">${h1}</h1>
      <p class="hero-sub">${lead}</p>
      <div class="quick-stats">
        <div class="stat-pill"><strong>${list.length}</strong>ETFs</div>
        <div class="stat-pill"><strong>${fmtYield(list.reduce((s, x) => s + x.yield, 0) / list.length)}</strong>Avg Yield</div>
        <div class="stat-pill"><strong>${fmtAum(list.reduce((s, x) => s + x.aum, 0))}</strong>Total AUM</div>
      </div>
    </div>
    ${SIGNUP}
    <div class="navbar" style="grid-template-columns:1fr"><button class="nav-btn rand" onclick="randomEtf()">🎲 Show me a random ETF</button></div>
    ${SEARCH}
    <div class="updated-line"><span class="updated-dot" aria-hidden="true"></span>Data updated: <strong><time datetime="${isoDate}">${niceDate}</time></strong></div>
    ${links}
    <div style="overflow-x:auto;margin-top:14px">
    <table class="hub-table" id="ht"><thead><tr><th>#</th><th>ETF</th><th data-k="2">Yield ⇅</th><th data-k="3" class="hide-m">AUM ⇅</th><th data-k="4">Grade ⇅</th><th class="hide-m">Decay</th></tr></thead><tbody>
${rows}
    </tbody></table></div>
    ${PRO_BOX('Screen 160+ income ETFs with grades, tax treatment, payout schedules, yield and total return trends, and advanced filters, all in one terminal.')}
    <div id="recent"></div>
    <h2 class="section-title">Browse More</h2>
    <div class="hub-links"><a href="/etfs/">All ETFs A to Z</a><a href="/etfs/highest-yield">Highest yield</a><a href="/etfs/largest">Largest</a>${Object.keys(CAT_INFO).filter(c => cats[c]).map(c => `<a href="/etfs/category/${slug(c)}">${c}</a>`).join('')}</div>
    <h3 style="color:var(--green-dark);margin:14px 0 4px">By grade</h3>
    <div class="hub-links">${GRADES.filter(g => grades[g]).map(g => `<a href="/etfs/grade/${gradeSlugFix(g)}">${g} (${grades[g].length})</a>`).join('')}</div>
    <h3 style="color:var(--green-dark);margin:14px 0 4px">By issuer</h3>
    <div class="hub-links">${Object.keys(issuers).sort().map(i => `<a href="/etfs/issuer/${slug(i)}">${esc(i)} (${issuers[i].length})</a>`).join('')}</div>
    <div class="disclaimer-box"><h3>Important Disclaimer</h3><p>TopDividendETFs.com is published by Dividend Empire LLC for educational and informational purposes only. Figures come from the TopDividendETFs.com list and may lag the market. Grades are our own opinion and are not a recommendation. Nothing on this page is financial advice. Always read the prospectus before investing.</p></div>
${BANNER}
    ${FOOTER}
${CLIENT_JS('')}
<script>
(function(){var t=document.getElementById('ht');t.querySelectorAll('th[data-k]').forEach(function(th){var asc=false;th.onclick=function(){var k=+th.dataset.k;asc=!asc;var rs=[].slice.call(t.tBodies[0].rows);rs.sort(function(a,b){var x=+a.cells[k].dataset.v,y=+b.cells[k].dataset.v;return asc?x-y:y-x;});if(k===4)rs.reverse();rs.forEach(function(r,i){r.cells[0].textContent=i+1;t.tBodies[0].appendChild(r);});};});
if(location.hash){var r=document.getElementById(location.hash.slice(1));if(r){r.style.outline='3px solid #FFD700';}}})();
</script>`;
  return shell({ title, desc, canonical: SITE + urlPath, body, schema: [{ '@context': 'https://schema.org', '@type': 'ItemList', name: h1, numberOfItems: list.length, itemListElement: list.slice(0, 50).map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + x.url, name: x.sym + ' ' + x.name })) }] });
}

// ---------- write ----------
function write(rel, html) { const p = path.join(OUT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, html); }
const targets = only.length ? ETFS.filter(e => only.includes(e.sym)) : ETFS;
for (const e of targets) write(e.sym.toLowerCase() + '.html', etfPage(e));

write('index.html', hubPage({ urlPath: '/etfs/', title: `All ${N} Dividend ETFs A to Z: Yield, AUM & Grades | TopDividendETFs`, h1: `All ${N} Dividend ETFs A to Z`, eyebrow: 'ETF Directory', lead: 'Every dividend and income ETF on TopDividendETFs.com with its yield, size and grade. Tap any ticker for its full page.', desc: `Directory of all ${N} dividend ETFs tracked by TopDividendETFs.com with yields, AUM, grades and price decay.`, list: az }));
write('highest-yield.html', hubPage({ urlPath: '/etfs/highest-yield', title: `Highest Yield Dividend ETFs Ranked (${N} ETFs) | TopDividendETFs`, h1: 'Dividend ETFs Ranked by Yield', eyebrow: 'Yield Rankings', lead: `All ${N} ETFs on our list from highest to lowest yield. Check the price decay column before chasing the biggest numbers.`, desc: `All ${N} dividend ETFs ranked by yield, with AUM, grades and price decay.`, list: byYield, crumbs: ['Highest Yield'] }));
write('largest.html', hubPage({ urlPath: '/etfs/largest', title: `Largest Dividend ETFs by Assets (AUM) | TopDividendETFs`, h1: 'Largest Dividend ETFs by Assets', eyebrow: 'Size Rankings', lead: `All ${N} ETFs on our list ranked by assets under management.`, desc: `Dividend ETFs ranked by assets under management with yields and grades.`, list: byAum, crumbs: ['Largest'] }));
for (const g of GRADES) if (grades[g]) {
  const l = grades[g].slice().sort((a, b) => b.yield - a.yield);
  write('grade/' + gradeSlugFix(g) + '.html', hubPage({ urlPath: '/etfs/grade/' + gradeSlugFix(g), title: `${g} Rated Dividend ETFs (${l.length}) | TopDividendETFs`, h1: `${g} Rated Dividend ETFs`, eyebrow: 'By Grade', lead: `Every ETF that earns a ${g} on the TopDividendETFs.com scorecard, sorted by yield.`, desc: `${l.length} dividend ETFs with a ${g} grade on TopDividendETFs.com, with yields and AUM.`, list: l, crumbs: [`${g} Rated`], links: `<div class="hub-links">${GRADES.filter(x => grades[x]).map(x => `<a href="/etfs/grade/${gradeSlugFix(x)}"${x === g ? ' class="cur"' : ''}>${x}</a>`).join('')}</div>` }));
}
for (const [iss, l0] of Object.entries(issuers)) {
  const l = l0.slice().sort((a, b) => b.aum - a.aum);
  write('issuer/' + slug(iss) + '.html', hubPage({ urlPath: '/etfs/issuer/' + slug(iss), title: `${iss} Dividend ETFs (${l.length}): Yields & Grades | TopDividendETFs`, h1: `${esc(iss)} Dividend ETFs`, eyebrow: 'By Issuer', lead: `Every ${esc(iss)} ETF on TopDividendETFs.com, largest first.`, desc: `${l.length} ${iss} dividend and income ETFs with yields, AUM and grades.`, list: l, crumbs: [esc(iss)] }));
}
for (const [c, l0] of Object.entries(cats)) {
  const l = l0.slice().sort((a, b) => b.yield - a.yield);
  write('category/' + slug(c) + '.html', hubPage({ urlPath: '/etfs/category/' + slug(c), title: `${c} ETFs (${l.length}): Yields & Grades | TopDividendETFs`, h1: `${c} ETFs`, eyebrow: 'By Strategy', lead: CAT_INFO[c], desc: `${l.length} ${c.toLowerCase()} ETFs ranked by yield with AUM and grades.`, list: l, crumbs: [c], links: `<div class="hub-links">${Object.keys(CAT_INFO).filter(x => cats[x]).map(x => `<a href="/etfs/category/${slug(x)}"${x === c ? ' class="cur"' : ''}>${x}</a>`).join('')}</div>` }));
}
console.log(`Built ${targets.length} ETF pages + hubs for ${N} ETFs (${Object.keys(issuers).length} issuers, ${Object.keys(cats).length} categories).`);
