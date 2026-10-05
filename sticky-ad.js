/* TopDividendETFs.com sticky sponsor ad (OVL / Overlay Shares)
   A floating ad that rises from the bottom after the reader scrolls, on a soft
   fade instead of a full-width bar. Closable with the X; stays closed for the
   rest of the visit (sessionStorage). The prospectus line is always shown. */
(function () {
  if (window.__tdeSticky) return; window.__tdeSticky = true;
  var KEY = 'tdeStickyClosed';
  try { if (sessionStorage.getItem(KEY)) return; } catch (e) {}

  var IMG = 'https://raw.githubusercontent.com/benjiesiegel1414/topdividendetfs-site/main/OVL%20new%20display%20ad%202.png';
  var URL = 'https://lsfunds.com/etfs/ovl';
  var PROSPECTUS = 'https://lsfunds.com/hubfs/Regulatory/Prospectus.pdf?hsLang=en';
  var SHOW_AFTER = 350; // px scrolled before the ad rises

  var css =
    '#tdeSticky{position:fixed;left:0;right:0;bottom:0;z-index:2147482000;pointer-events:none;font-family:Lato,Arial,sans-serif;' +
    'display:flex;justify-content:center;padding:34px 12px 10px;padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));' +
    'background:linear-gradient(to top,rgba(255,255,255,.94) 0%,rgba(255,255,255,.82) 45%,rgba(255,255,255,0) 100%);' +
    'opacity:0;transform:translateY(40px);transition:opacity .6s ease,transform .6s cubic-bezier(.2,.7,.3,1);visibility:hidden}' +
    '#tdeSticky.on{opacity:1;transform:translateY(0);visibility:visible}' +
    '#tdeSticky .ad{position:relative;pointer-events:auto;display:flex;flex-direction:column;align-items:center;max-width:100%}' +
    '#tdeSticky a.img{display:block;line-height:0;border-radius:9px;overflow:hidden;box-shadow:0 8px 26px rgba(10,40,60,.28),0 2px 6px rgba(10,40,60,.14);transition:transform .2s ease,box-shadow .2s ease}' +
    '#tdeSticky a.img:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(10,40,60,.34),0 3px 8px rgba(10,40,60,.16)}' +
    '#tdeSticky img{display:block;height:64px;width:auto;max-width:100%}' +
    '#tdeSticky .disc{display:block;margin-top:5px;font-size:10.5px;line-height:1.3;color:#4f5b57;text-align:center;overflow-wrap:anywhere;text-shadow:0 0 6px #fff}' +
    '#tdeSticky .disc a{color:#4f5b57;text-decoration:underline}' +
    '#tdeSticky .x{position:absolute;right:-9px;top:-9px;width:22px;height:22px;border-radius:50%;border:0;' +
    'background:#1A3C34;color:#fff;font-size:15px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;' +
    'box-shadow:0 2px 6px rgba(0,0,0,.25)}' +
    '#tdeSticky .x:hover{background:#2E5D54}' +
    '@media(max-width:700px){#tdeSticky{padding:28px 14px 6px;padding-bottom:calc(6px + env(safe-area-inset-bottom,0px))}' +
    '#tdeSticky .ad{width:100%}#tdeSticky a.img{width:100%;border-radius:7px}#tdeSticky img{height:auto;width:100%}' +
    '#tdeSticky .disc{font-size:9.5px;margin-top:3px}#tdeSticky .x{right:-7px;top:-8px}}' +
    '@media(prefers-reduced-motion:reduce){#tdeSticky{transition:none}}' +
    '@media print{#tdeSticky{display:none!important}}';

  function init() {
    var st = document.createElement('style'); st.id = 'tdeSticky-css'; st.textContent = css; document.head.appendChild(st);
    var bar = document.createElement('div');
    bar.id = 'tdeSticky';
    bar.setAttribute('role', 'complementary');
    bar.setAttribute('aria-label', 'Sponsor');
    bar.innerHTML = '<div class="ad">' +
      '<a class="img" href="' + URL + '" target="_blank" rel="noopener noreferrer sponsored"><img src="' + IMG + '" alt="Sponsored: OVL - Overlay Shares Large Cap Equity ETF" width="3034" height="375"></a>' +
      '<small class="disc">Read carefully before investing. Prospectus: <a href="' + PROSPECTUS + '" target="_blank" rel="noopener noreferrer">' + PROSPECTUS + '</a></small>' +
      '<button class="x" type="button" aria-label="Close sponsor ad">&times;</button></div>';
    document.body.appendChild(bar);

    var spacer = document.createElement('div'); spacer.style.height = '0px'; document.body.appendChild(spacer);
    function pad() { spacer.style.height = bar.classList.contains('on') ? (bar.querySelector('.ad').offsetHeight + 24) + 'px' : '0px'; }

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
