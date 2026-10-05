/* TopDividendETFs.com sticky sponsor bar (OVL / Overlay Shares)
   Slides up from the bottom after the reader scrolls, closable with the X.
   Once closed it stays hidden for the rest of the visit (sessionStorage). */
(function () {
  if (window.__tdeSticky) return; window.__tdeSticky = true;
  var KEY = 'tdeStickyClosed';
  try { if (sessionStorage.getItem(KEY)) return; } catch (e) {}

  var IMG = 'https://raw.githubusercontent.com/benjiesiegel1414/topdividendetfs-site/main/OVL%20new%20display%20ad%202.png';
  var URL = 'https://lsfunds.com/etfs/ovl';
  var PROSPECTUS = 'https://lsfunds.com/hubfs/Regulatory/Prospectus.pdf?hsLang=en';
  var SHOW_AFTER = 350; // px scrolled before the bar slides up

  var css =
    '#tdeSticky{position:fixed;left:0;right:0;bottom:0;z-index:2147482000;font-family:Lato,Arial,sans-serif;' +
    'background:rgba(255,255,255,.97);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);' +
    'border-top:3px solid #1A3C34;box-shadow:0 -6px 20px rgba(26,60,52,.16);' +
    'padding:7px 0;padding-bottom:calc(7px + env(safe-area-inset-bottom,0px));' +
    'transform:translateY(115%);transition:transform .38s cubic-bezier(.2,.7,.3,1)}' +
    '#tdeSticky.on{transform:translateY(0)}' +
    '#tdeSticky .in{position:relative;max-width:1100px;margin:0 auto;padding:0 46px;display:flex;align-items:center;justify-content:center;gap:12px}' +
    '#tdeSticky .lbl{flex:none;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6b7a75;writing-mode:vertical-rl;transform:rotate(180deg);line-height:1}' +
    '#tdeSticky .ad{display:flex;flex-direction:column;align-items:center;min-width:0;max-width:100%}' +
    '#tdeSticky a.img{display:block;line-height:0;border-radius:6px;overflow:hidden;transition:transform .2s ease,box-shadow .2s ease}' +
    '#tdeSticky a.img:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.15)}' +
    '#tdeSticky .disc{display:block;margin-top:3px;font-size:10.5px;line-height:1.3;color:#555;text-align:center;overflow-wrap:anywhere}' +
    '#tdeSticky .disc a{color:#555;text-decoration:underline}' +
    '#tdeSticky img{display:block;height:62px;width:auto;max-width:100%}' +
    '#tdeSticky .x{position:absolute;right:10px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;' +
    'border:1px solid #cfd8d4;background:#fff;color:#1A3C34;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}' +
    '#tdeSticky .x:hover{background:#1A3C34;color:#fff;border-color:#1A3C34}' +
    '@media(max-width:700px){#tdeSticky{padding:5px 0;padding-bottom:calc(5px + env(safe-area-inset-bottom,0px))}' +
    '#tdeSticky .in{padding:0 40px 0 8px;gap:6px}#tdeSticky .lbl{display:none}#tdeSticky img{height:auto;width:100%;max-height:52px;object-fit:contain}' +
    '#tdeSticky .ad{flex:1}#tdeSticky a.img{width:100%}#tdeSticky .disc{font-size:9.5px;margin-top:2px}#tdeSticky .x{right:8px;width:26px;height:26px;font-size:16px}}' +
    '@media(prefers-reduced-motion:reduce){#tdeSticky{transition:none}}' +
    '@media print{#tdeSticky{display:none!important}}';

  function init() {
    var st = document.createElement('style'); st.id = 'tdeSticky-css'; st.textContent = css; document.head.appendChild(st);
    var bar = document.createElement('div');
    bar.id = 'tdeSticky';
    bar.setAttribute('role', 'complementary');
    bar.setAttribute('aria-label', 'Sponsor');
    bar.innerHTML = '<div class="in"><span class="lbl">Sponsored</span>' +
      '<div class="ad"><a class="img" href="' + URL + '" target="_blank" rel="noopener noreferrer sponsored"><img src="' + IMG + '" alt="OVL - Overlay Shares Large Cap Equity ETF" width="3034" height="375"></a>' +
      '<small class="disc">Read carefully before investing. Prospectus: <a href="' + PROSPECTUS + '" target="_blank" rel="noopener noreferrer">' + PROSPECTUS + '</a></small></div>' +
      '<button class="x" type="button" aria-label="Close sponsor bar">&times;</button></div>';
    document.body.appendChild(bar);

    var spacer = document.createElement('div'); spacer.style.height = '0px'; document.body.appendChild(spacer);
    function pad() { spacer.style.height = bar.classList.contains('on') ? bar.offsetHeight + 'px' : '0px'; }

    var shown = false;
    function check() {
      if (!shown && (window.scrollY || document.documentElement.scrollTop) > SHOW_AFTER) {
        shown = true; bar.classList.add('on'); pad();
        try { if (typeof gtag === 'function') gtag('event', 'sticky_ad_view', { sponsor: 'OVL', page_path: location.pathname }); } catch (e) {}
      }
    }
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', pad);
    check();

    bar.querySelector('a.img').addEventListener('click', function () {
      try { if (typeof gtag === 'function') gtag('event', 'sticky_ad_click', { sponsor: 'OVL', page_path: location.pathname }); } catch (e) {}
    });
    bar.querySelector('.x').addEventListener('click', function () {
      bar.classList.remove('on'); pad();
      window.removeEventListener('scroll', check);
      try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
      try { if (typeof gtag === 'function') gtag('event', 'sticky_ad_close', { sponsor: 'OVL', page_path: location.pathname }); } catch (e) {}
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
