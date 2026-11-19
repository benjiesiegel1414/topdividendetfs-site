// Publishes the staged Simply Wall St Black Friday post (run by .github/workflows/publish-sws-black-friday.yml).
// Moves the post to the site root and adds it to blog.html. Exits early if already published.
const fs = require('fs');
const STAGED = '.github/scheduled/simply-wall-st-black-friday-deal.html';
const LIVE = 'simply-wall-st-black-friday-deal.html';
const URL = 'https://topdividendetfs.com/simply-wall-st-black-friday-deal';
const TITLE = 'Simply Wall St Black Friday 2026: 50% Off Annual Plans (Nov 23 to Dec 4)';
const DESC = 'Simply Wall St is 50% off annual plans through December 4. What it does for dividend investors, who it\'s for, and how to claim the deal (no code needed).';
const DATE_TXT = 'Nov 23, 2026';

if (!fs.existsSync(STAGED)) { console.log('Nothing staged, already published.'); process.exit(0); }
fs.writeFileSync(LIVE, fs.readFileSync(STAGED));
fs.unlinkSync(STAGED);
console.log('Post moved to', LIVE);

let b = fs.readFileSync('blog.html', 'utf8');
if (b.includes(URL)) { fs.writeFileSync('blog.html', b); console.log('blog.html already lists it'); process.exit(0); }
const done = [];
const rep = (name, re, fn) => { const before = b; b = b.replace(re, fn); if (b !== before) done.push(name); else console.log('WARN: could not patch', name); };

// 1. New card at the top of the article grid
const card = `<div class="blog-grid" id="blogGrid">
            <div class="blog-card" data-cat="tools" data-date="2026-11-23" data-tickers="">
                <div class="blog-card-top">
                    <span class="card-icon">&#127991;&#65039;</span>
                    <div class="card-date">${DATE_TXT} &bull; Investing Tools &amp; Reviews</div>
                </div>
                <div class="blog-card-body">
                    <h3>${TITLE}</h3>
                    <p>${DESC}</p>
                    <div class="tk-row"></div>
                    <a href="${URL}" class="read-more">Read Article &#8594;</a>
                </div>
            </div>`;
rep('grid card', '<div class="blog-grid" id="blogGrid">', () => card);

// 2. Latest section: new lead card, old lead moves to the top of the side list (keep 3 side cards)
const leadRe = /<a class="lead-card" href="([^"]+)">[\s\S]*?<span class="lead-meta">([^<]*)<\/span>\s*<h2>([\s\S]*?)<\/h2>[\s\S]*?<\/a>/;
const m = b.match(leadRe);
if (m) {
  const newLead = `<a class="lead-card" href="${URL}">
                <span class="lead-badge">&#10024; Newest Article</span>
                <span class="lead-meta">${DATE_TXT} &bull; Investing Tools &amp; Reviews</span>
                <h2>${TITLE}</h2>
                <p>${DESC}</p>
                <span class="lead-btn">Read the article &#8594;</span>
            </a>`;
  b = b.replace(leadRe, () => newLead);
  const side = `<a class="side-card" href="${m[1]}"><span class="side-icon">&#10024;</span><span><em>${m[2].trim()}</em><strong>${m[3].trim()}</strong></span></a>`;
  const sl = b.match(/<div class="side-list">([\s\S]*?)<\/div>/);
  if (sl) {
    const cards = sl[1].match(/<a class="side-card"[\s\S]*?<\/a>/g) || [];
    const keep = [side, ...cards].slice(0, 3).join('');
    b = b.replace(sl[0], () => `<div class="side-list">${keep}</div>`);
  }
  done.push('latest');
} else console.log('WARN: lead card not found');

// 3. Investing Tools & Reviews topic list
rep('topic list', /(<details class="dir-block" id="topic-tools">[\s\S]*?<span class="cnt">)(\d+)( articles<\/span><\/summary>\s*<ul>)/, (_, a, n, c) =>
  `${a}${+n + 1}${c}\n                    <li><a href="${URL}">${TITLE}</a><span>${DATE_TXT}</span></li>`);

// 4. ItemList JSON-LD: add as position 1 and renumber
const il = b.match(/"numberOfItems":\s*(\d+),\s*"itemListElement":\s*\[/);
if (il) {
  b = b.replace(il[0], () => `"numberOfItems": ${+il[1] + 1},\n  "itemListElement": [\n   {\n    "@type": "ListItem",\n    "position": 0,\n    "url": "${URL}",\n    "name": "${TITLE}"\n   },`);
  let i = 0;
  const start = b.indexOf('"itemListElement"');
  const end = b.indexOf(']', b.lastIndexOf('"@type": "ListItem"'));
  b = b.slice(0, start) + b.slice(start, end).replace(/"position":\s*\d+/g, () => `"position": ${++i}`) + b.slice(end);
  done.push('itemlist');
}

// 5. Counts and "Updated" date
rep('hero count', /(&#10022; )(\d+)( Articles &bull; Updated )[A-Z][a-z]{2} \d{1,2}, \d{4}/, (_, a, n, c) => `${a}${+n + 1}${c}${DATE_TXT}`);
rep('title count', /(Browse all )(\d+)( TopDividendETFs\.com articles)/, (_, a, n, c) => `${a}${+n + 1}${c}`);
rep('og count', /(in one place: )(\d+)( guides)/, (_, a, n, c) => `${a}${+n + 1}${c}`);
rep('result count', /(<span id="resultCount">)(\d+)( articles<\/span>)/, (_, a, n, c) => `${a}${+n + 1}${c}`);

fs.writeFileSync('blog.html', b);
console.log('blog.html patched:', done.join(', '));
