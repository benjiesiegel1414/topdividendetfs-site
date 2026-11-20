/* TopDividendETFs sticky search header, on every page.
   Each page loads it right after its own <header> (scripts/add-search-header.mjs adds the tag),
   and it swaps that header for the logo + search + Go PRO bar.
   Search data: /data/search-index.json (ETFs, issuers, lists, articles; rebuilt by the Build ETF pages workflow). */
(function () {
  var css = `
html,body{overflow-x:clip!important}
header.tde-head{position:sticky;top:0;z-index:1000;padding:0;display:block;cursor:auto;width:100%;margin:0;box-sizing:border-box;background:#1A3C34;box-shadow:0 2px 10px rgba(0,0,0,.18);font-family:inherit}
.tde-head .tde-in{max-width:1240px;margin:0 auto;padding:10px 20px;display:flex;align-items:center;gap:18px}
.tde-head .tde-logo{color:#fff;text-decoration:none;font-weight:900;font-size:23px;letter-spacing:-.3px;white-space:nowrap;display:flex;align-items:center;gap:9px}
.tde-head .tde-logo b{font-weight:900;color:#fff}.tde-logo i{font-style:normal;color:#7FD1B9}
.tde-head .tde-search{position:relative;flex:1;max-width:527px;margin:0 auto}
.tde-head .tde-box{display:flex;align-items:center;gap:10px;background:#fff;border-radius:10px;padding:0 11px;height:39px;border:2px solid transparent;transition:border-color .15s,box-shadow .15s}
.tde-head .tde-box:focus-within{border-color:#FFD700;box-shadow:0 0 0 4px rgba(255,215,0,.25)}
.tde-head .tde-box svg{flex-shrink:0;color:#2E5D54}
.tde-head .tde-box input{flex:1;border:0;outline:0;font:inherit;font-size:14.5px;color:#14231f;background:transparent;min-width:0}
.tde-head .tde-box input::placeholder{color:#7b8a86}
.tde-head .tde-box kbd{font:700 12px/1 inherit;color:#5b6b67;border:1px solid #cfd8d5;border-radius:6px;padding:4px 7px;background:#f4f7f6}
.tde-head .tde-dd{position:absolute;left:0;right:0;top:calc(100% + 8px);background:#fff;border-radius:14px;box-shadow:0 18px 50px rgba(10,40,34,.28);border:1px solid #dfe7e4;overflow:hidden;display:none;max-height:min(70vh,560px);overflow-y:auto;text-align:left}
.tde-head .tde-dd.open{display:block}
.tde-head .tde-g{padding:8px 0 4px;border-top:1px solid #eef2f1}
.tde-head .tde-g:first-child{border-top:0}
.tde-head .tde-gh{font-size:11px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#6b7c78;padding:4px 16px 6px}
.tde-head .tde-r{display:flex;align-items:center;gap:12px;padding:9px 16px;text-decoration:none;color:#14231f;cursor:pointer}
.tde-head .tde-r:hover,.tde-head .tde-r.on{background:#EEF7F4}
.tde-head .tde-ic{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;font-size:16px;flex-shrink:0;background:#E3F1EC}
.tde-head .tde-sym{min-width:56px;font-weight:900;font-size:15px;color:#1A3C34}
.tde-head .tde-nm{flex:1;min-width:0;font-size:14px;color:#3f504c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tde-head .tde-nm b{color:#14231f}
.tde-head .tde-y{font-size:12.5px;font-weight:800;color:#0B7A55;background:#E2F3EA;border-radius:6px;padding:3px 7px;white-space:nowrap}
.tde-head .tde-gr{font-size:12px;font-weight:900;color:#1A3C34;border:1.5px solid #cfe0da;border-radius:6px;padding:2px 6px;min-width:30px;text-align:center}
.tde-head .tde-meta{font-size:12.5px;color:#6b7c78;white-space:nowrap}
.tde-head .tde-empty{padding:18px 16px;color:#6b7c78;font-size:14px}
.tde-head .tde-foot{display:flex;gap:14px;padding:9px 16px;border-top:1px solid #eef2f1;font-size:12px;color:#6b7c78;background:#fafcfb}
.tde-head .tde-foot kbd{border:1px solid #cfd8d5;border-radius:5px;padding:1px 5px;background:#fff;font-size:11px}
.tde-head .tde-pro{padding:9px 16px;background:linear-gradient(135deg,#FFD700,#FFA500);color:#1A3C34;font-weight:900;font-size:14px;border:2px solid #FF8C00;border-radius:10px;text-decoration:none;white-space:nowrap}
@media(max-width:760px){
 .tde-head .tde-in{flex-wrap:wrap;gap:10px;padding:10px 14px}
 .tde-head .tde-logo{font-size:20px;flex:1}
 .tde-head .tde-pro{padding:7px 12px;font-size:12.5px}
 .tde-head .tde-search{order:3;flex-basis:100%;max-width:none}
 .tde-head .tde-box{height:38px}.tde-head .tde-box input{font-size:16px}.tde-box kbd{display:none}
 .tde-head .tde-meta,.tde-head .tde-gr{display:none}
}
.tde-head,.tde-head *{box-sizing:border-box}
header.tde-head{line-height:1.2}
.tde-head a{margin:0;border:0;text-transform:none;letter-spacing:normal;box-shadow:none}
.tde-head .tde-pro{border:2px solid #FF8C00}
.tde-head .tde-logo svg{height:28px;width:auto;flex-shrink:0;display:block}
@media(max-width:760px){.tde-head .tde-logo svg{height:24px}}
@media(min-width:761px){.tde-head .tde-in{padding:9px 20px;gap:17px}.tde-head .tde-logo{font-size:22px}.tde-head .tde-logo svg{height:26.5px}.tde-head .tde-search{max-width:500px}.tde-head .tde-box{height:37px}.tde-head .tde-box input{font-size:14px}.tde-head .tde-pro{padding:8px 15px;font-size:13.3px}}
.tde-head .tde-gh{display:flex;justify-content:space-between;align-items:center}
.tde-head .tde-clr{font:inherit;font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#2E5D54;background:none;border:0;cursor:pointer;padding:0}
.tde-head .tde-clr:hover{text-decoration:underline}`;
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  if (document.getElementById('tdeHeadEl')) return;
  var wrap = document.createElement('div');
  wrap.innerHTML = '<header class="tde-head" id="tdeHeadEl"><div class="tde-in">' +
    '<a class="tde-logo" href="/"><svg viewBox="0 0 32 35" aria-hidden="true"><rect x="3" y="4.8" width="26" height="4.4" rx="2.2" fill="#34C78A"/><rect x="3" y="11.8" width="20" height="4.4" rx="2.2" fill="#6FD8AD"/><rect x="3" y="18.8" width="14" height="4.4" rx="2.2" fill="#B4EBD3"/><rect x="3" y="25.8" width="8" height="4.4" rx="2.2" fill="#FFFFFF"/></svg><span><b>TopDividendETFs</b><i>.com</i></span></a>' +
    '<div class="tde-search" role="search"><label class="tde-box"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
    '<input id="tdeQ" type="search" autocomplete="off" spellcheck="false" placeholder="Search ETFs, issuers or articles. Try SPYI or NEOS" aria-label="Search the site"><kbd>/</kbd></label>' +
    '<div class="tde-dd" id="tdeDD" role="listbox"></div></div>' +
        '<a class="tde-pro" href="https://topdividendetfspro.com/">Go PRO! 🏆</a></div></header>';
  var hd = wrap.firstChild, old = document.querySelector('body header');
  if (old) old.parentNode.removeChild(old);
  document.body.insertBefore(hd, document.body.firstChild);   // full width, above any page wrapper
  // Browser-tab icon (absolute paths so it works on /etfs/ pages too)
  [].forEach.call(document.querySelectorAll('link[rel~="icon"]'), function (l) { l.parentNode.removeChild(l); });
  [['image/svg+xml', '/favicon.svg'], ['image/x-icon', '/favicon.ico']].forEach(function (x) { var l = document.createElement('link'); l.rel = 'icon'; l.type = x[0]; l.href = x[1]; document.head.appendChild(l); });
  // Keep other sticky bars (filters etc.) from hiding under the header
  function offsetSticky() {
    var h = hd.offsetHeight;
    [].forEach.call(document.querySelectorAll('body *'), function (el) {
      if (hd.contains(el)) return;
      var cs = getComputedStyle(el);
      if (cs.position === 'sticky' && (cs.top === '0px' || el.dataset.tdeTop)) { el.dataset.tdeTop = 1; el.style.top = h + 'px'; }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', offsetSticky); else offsetSticky();
  addEventListener('resize', offsetSticky);
  if (matchMedia('(max-width:760px)').matches) document.getElementById('tdeQ').placeholder = 'Search ETFs, issuers or articles';
  var q = document.getElementById('tdeQ'), dd = document.getElementById('tdeDD'), idx = null, sel = 0, rows = [];
  var idxP = null;
  function load() { return idxP || (idxP = fetch('/data/search-index.json').then(function (r) { return r.json(); }).then(function (d) { idx = d; return d; }).catch(function (e) { idxP = null; throw e; })); }
  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function score(it, w) {
    var s = (it.s || '').toLowerCase(), n = (it.n || '').toLowerCase(), is = (it.is || '').toLowerCase();
    if (s && s === w) return 100;
    if (it.t === 'i' && n === w) return 95;
    if (s && s.indexOf(w) === 0) return 80;
    if (it.t === 'i' && n.indexOf(w) === 0) return 75;
    if (is && is.indexOf(w) === 0) return 60;
    if (n.split(/[^a-z0-9&]+/).some(function (x) { return x.indexOf(w) === 0; })) return 40;
    if (n.indexOf(w) > -1) return 20;
    return 0;
  }
  function search(v) {
    var words = v.toLowerCase().replace(/\$/g, '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return null;
    var hits = idx.map(function (it) {
      var tot = 0; for (var i = 0; i < words.length; i++) { var sc = score(it, words[i]); if (!sc) return null; tot += sc; }
      return { it: it, sc: tot };
    }).filter(Boolean).sort(function (a, b) { return b.sc - a.sc || (parseFloat(b.it.y) || 0) - (parseFloat(a.it.y) || 0); });
    var g = { i: [], e: [], l: [], b: [] }, lim = { i: 3, e: 8, l: 3, b: 4 };
    hits.forEach(function (h) { var a = g[h.it.t]; if (a && a.length < lim[h.it.t]) a.push(h.it); });
    return g;
  }
  var shown = [], RKEY = 'tdeRecent';
  function recent() { try { return JSON.parse(localStorage.getItem(RKEY)) || []; } catch (x) { return []; } }
  function remember(it) { try { var r = recent().filter(function (x) { return x.u !== it.u; }); r.unshift(it); localStorage.setItem(RKEY, JSON.stringify(r.slice(0, 6))); } catch (x) {} }
  function row(it) {
    shown.push(it); return row1(it).replace('<a class="tde-r"', '<a class="tde-r" data-k="' + (shown.length - 1) + '"');
  }
  function row1(it) {
    if (it.t === 'e') return '<a class="tde-r" href="' + it.u + '"><span class="tde-sym">$' + esc(it.s) + '</span><span class="tde-nm">' + esc(it.n) + '</span><span class="tde-y">' + esc(it.y) + ' yield</span><span class="tde-gr">' + esc(it.g) + '</span></a>';
    if (it.t === 'i') return '<a class="tde-r" href="' + it.u + '"><span class="tde-ic">🏢</span><span class="tde-nm"><b>' + esc(it.n) + '</b> issuer page</span><span class="tde-meta">' + it.c + ' ETFs</span></a>';
    if (it.t === 'l') return '<a class="tde-r" href="' + it.u + '"><span class="tde-ic">📋</span><span class="tde-nm">' + esc(it.n) + '</span></a>';
    return '<a class="tde-r" href="' + it.u + '"><span class="tde-ic">📰</span><span class="tde-nm">' + esc(it.n) + '</span></a>';
  }
  function foot() { return '<div class="tde-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> to move</span><span><kbd>Enter</kbd> to open</span><span><kbd>Esc</kbd> to close</span></div>'; }
  function showRecent() {
    var r = recent(); shown = [];
    if (!r.length) { dd.classList.remove('open'); rows = []; return; }
    dd.innerHTML = '<div class="tde-g"><div class="tde-gh"><span>Recently viewed</span><button type="button" class="tde-clr">Clear</button></div>' + r.map(row).join('') + '</div>' + foot();
    rows = [].slice.call(dd.querySelectorAll('.tde-r')); sel = 0; mark(); dd.classList.add('open');
  }
  function render() {
    if (!q.value.trim()) { showRecent(); return; }
    load().then(function () {
      var v = q.value; if (!v.trim()) { showRecent(); return; }   // always use what's in the box now
      shown = [];
      var g = search(v), H = { i: 'Issuers', e: 'ETFs', l: 'Lists', b: 'Articles' }, out = '';
      ['i', 'e', 'l', 'b'].forEach(function (k) { if (g[k].length) out += '<div class="tde-g"><div class="tde-gh">' + H[k] + '</div>' + g[k].map(row).join('') + '</div>'; });
      dd.innerHTML = (out || '<div class="tde-empty">No matches for "' + esc(v) + '". Try a ticker like SCHD or an issuer like NEOS.</div>') +
        foot();
      rows = [].slice.call(dd.querySelectorAll('.tde-r')); sel = 0; mark(); dd.classList.add('open');
    });
  }
  function mark() { rows.forEach(function (r, i) { r.classList.toggle('on', i === sel); }); }
  q.addEventListener('input', render);
  q.addEventListener('focus', function () { load(); render(); });
  q.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, rows.length - 1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); mark(); }
    else if (e.key === 'Enter' && rows[sel]) { e.preventDefault(); rows[sel].click(); }
    else if (e.key === 'Escape') { dd.classList.remove('open'); q.blur(); }
  });
  dd.addEventListener('click', function (e) {
    if (e.target.closest('.tde-clr')) { e.preventDefault(); try { localStorage.removeItem(RKEY); } catch (x) {} dd.classList.remove('open'); q.focus(); return; }
    var a = e.target.closest('.tde-r'); if (!a) return;
    if (shown[+a.dataset.k]) remember(shown[+a.dataset.k]);
    try { gtag('event', 'site_search_click', { query: q.value.trim().toLowerCase(), result: a.getAttribute('href') }); } catch (x) {}
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.tde-search')) dd.classList.remove('open'); });
  document.addEventListener('keydown', function (e) { if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); } });
})();
