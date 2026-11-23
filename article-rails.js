/* TopDividendETFs article side rails: outline, ETFs mentioned, related reading, tools.
   Loaded on every page by site-search.js; only activates on blog articles. */
(function(){
  if(window.__tdeRails)return; window.__tdeRails=1;
  var path=location.pathname.replace(/\/$/,'').replace(/\.html$/,''),slug=path.split('/').pop();
  if(!slug||path.split('/').length>2||/^(index|blog|advertise|match|big-movers|new-etfs|top-voted-etfs)$/.test(slug))return;
  var hsAll=[].slice.call(document.querySelectorAll('h2')).filter(function(h){return !h.closest('header,footer,nav,.tde-head,#tdeSticky')&&h.offsetParent;});
  if(hsAll.length<3)return;
  /* the article column = lowest ancestor that holds most of the h2s */
  var col=hsAll[0].parentNode;
  while(col&&col!==document.body){var n=hsAll.filter(function(h){return col.contains(h);}).length;if(n>=hsAll.length*0.7)break;col=col.parentNode;}
  if(!col||col===document.body)return;
  var hs=hsAll.filter(function(h){return col.contains(h)&&!/related|sources|disclaimer|more from/i.test(h.textContent);});
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  var CSS='.tdr{position:fixed;top:78px;width:210px;overflow:hidden;z-index:50;font-family:Lato,-apple-system,"Segoe UI",sans-serif;opacity:0;pointer-events:none;transform:translateY(8px);transition:opacity .25s,transform .25s}.tdr::-webkit-scrollbar{display:none}.tdr.show{opacity:1;pointer-events:auto;transform:none}.tdr *,.tdin *{box-sizing:border-box}.tdb{background:#fff;border:1px solid #e1e9e5;border-radius:14px;margin-bottom:14px;overflow:hidden;box-shadow:0 6px 22px rgba(26,60,52,.07)}.tdb h5{margin:0;padding:11px 14px;font-size:10.5px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;color:#1A3C34;border-bottom:1px solid #e1e9e5;background:#f6faf8;display:flex;justify-content:space-between;align-items:center}.tdb h5 a{font-size:11px;letter-spacing:0;text-transform:none;color:#2E5D54;text-decoration:none;font-weight:700}.tdp{height:3px;background:#e1e9e5}.tdp i{display:block;height:100%;width:0;background:linear-gradient(90deg,#1A3C34,#f5a623)}.tdt{padding:6px 0}.tdt a{display:block;padding:6px 14px 6px 12px;border-left:2px solid transparent;color:#5b6b66;font-size:12.5px;line-height:1.4;text-decoration:none}.tdt a:hover{color:#1A3C34}.tdt a.on{color:#1A3C34;font-weight:700;border-left-color:#f5a623;background:#fef8ea}.tdb a.row{display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid #eef3f0;text-decoration:none;color:#222;font-size:12.5px}.tdb a.row:last-child{border-bottom:0}.tdb a.row:hover{background:#f6faf8}.tdb a.row b{font-weight:900;color:#1A3C34;min-width:46px}.tdb a.row span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#6b7a75;font-size:11.5px}.tdb a.row em{font-style:normal;font-weight:800;color:#1A3C34;font-size:12px;white-space:nowrap}.tdb a.row i{font-style:normal;font-weight:900;font-size:10.5px;color:#1A3C34;background:#e6f4ee;border-radius:5px;padding:2px 6px}.tdb a.art{display:block;padding:10px 14px;border-bottom:1px solid #eef3f0;text-decoration:none;color:#1A3C34;font-size:13px;font-weight:700;line-height:1.38}.tdb a.art:last-child{border-bottom:0}.tdb a.art:hover{background:#f6faf8;color:#2E5D54}.tdb a.art small{display:block;font-size:10.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:#b8860b;margin-bottom:3px}.tdb a.lnk{display:flex;justify-content:space-between;gap:8px;padding:9px 14px;border-bottom:1px solid #eef3f0;text-decoration:none;color:#222;font-size:12.5px;font-weight:600}.tdb a.lnk:last-child{border-bottom:0}.tdb a.lnk:hover{background:#f6faf8}.tdb a.lnk::after{content:"\\2192";color:#2E5D54}.tdpro{background:linear-gradient(140deg,#1A3C34,#2E5D54);border-radius:14px;padding:16px 14px;color:#fff;margin-bottom:14px}.tdpro b{display:block;font-size:14px;line-height:1.3;margin-bottom:6px}.tdpro span{display:block;font-size:12px;line-height:1.45;color:rgba(255,255,255,.8);margin-bottom:12px}.tdpro a{display:block;text-align:center;background:#f5a623;color:#1a1200;font-weight:900;font-size:12.5px;border-radius:8px;padding:9px;text-decoration:none}.tdin{margin:34px 0;font-family:Lato,-apple-system,"Segoe UI",sans-serif}.tdin .g{display:grid;grid-template-columns:1fr 1fr;gap:16px}.tdin .tdb{margin:0}@media(max-width:640px){.tdin .g{grid-template-columns:1fr}}@media(min-width:1420px){.tdin{display:none}}@media(max-width:1419px){.tdr{display:none}}';
  var st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
  hs.forEach(function(h,i){if(!h.id)h.id='section-'+(i+1);});
  var TOOLS=[['Big movers today','/big-movers'],['New dividend ETFs','/new-etfs'],['Top voted ETFs','/top-voted-etfs'],['All ETFs by yield','/etfs/'],['SCHD dividend calculator','/schd-dividend-calculator'],['All articles','/blog']];
  var L=document.createElement('aside');L.className='tdr';L.setAttribute('aria-label','Article outline');
  L.innerHTML='<div class="tdb"><h5>On this page</h5><div class="tdp"><i></i></div><div class="tdt">'+hs.slice(0,12).map(function(h){return '<a href="#'+h.id+'">'+esc(h.textContent.trim().replace(/\s+/g,' '))+'</a>';}).join('')+'</div></div><div class="tdb" id="tdEtf" hidden><h5>ETFs in this article</h5><div></div></div>';
  var R=document.createElement('aside');R.className='tdr';R.setAttribute('aria-label','Related reading');
  R.innerHTML='<div class="tdb" id="tdRel" hidden><h5>Keep reading <a href="/blog">All</a></h5><div></div></div><div class="tdb"><h5>Live data and tools</h5>'+TOOLS.map(function(t){return '<a class="lnk" href="'+t[1]+'">'+t[0]+'</a>';}).join('')+'</div><div class="tdpro"><b>Want the live numbers behind this article?</b><span>Screen 190+ income ETFs by yield, total return, price decay and rating.</span><a href="https://topdividendetfspro.com/?utm_source=topdividendetfs&utm_medium=article-rail" target="_blank" rel="noopener">Try PRO</a></div>';
  document.body.appendChild(L);document.body.appendChild(R);
  var inl=document.createElement('div');inl.className='tdin';inl.innerHTML='<div class="g"><div class="tdb" id="tdRel2" hidden><h5>Keep reading <a href="/blog">All</a></h5><div></div></div><div class="tdb" id="tdEtf2" hidden><h5>ETFs in this article</h5><div></div></div></div>';
  var anchor=hs[Math.min(3,hs.length-1)];if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(inl,anchor);
  var links=[].slice.call(L.querySelectorAll('.tdt a')),prog=L.querySelector('.tdp i');
  function fitRail(rail,boxSel,rowSel,gap){
    var top=parseFloat(getComputedStyle(rail).top)||74,avail=window.innerHeight-top-gap,boxes=[].slice.call(rail.querySelectorAll(boxSel));
    boxes.forEach(function(b){b.style.display='';[].slice.call(b.querySelectorAll(rowSel)).forEach(function(a){a.style.display='';});});
    var guard=0;
    while(rail.scrollHeight>avail&&guard++<90){
      var vis=boxes.filter(function(b){return !b.hidden&&b.style.display!=='none';});if(!vis.length)break;
      var last=vis[vis.length-1],rows=[].slice.call(last.querySelectorAll(rowSel)).filter(function(a){return a.style.display!=='none';});
      if(rows.length>3)rows[rows.length-1].style.display='none';else if(vis.length>1)last.style.display='none';else if(rows.length>1)rows[rows.length-1].style.display='none';else break;
    }
    rail.style.maxHeight=avail+'px';
  }
  function place(){var rc=col.getBoundingClientRect();var room=rc.left;var ok=room>=234&&window.innerWidth>=1420;L.style.display=R.style.display=ok?'':'none';L.style.left=Math.max(12,rc.left-210-24)+'px';R.style.left=(rc.right+24)+'px';if(ok){fitRail(L,'.tdb,.tdpro','a.row,a.art,a.lnk,.tdt a',118);fitRail(R,'.tdb,.tdpro','a.row,a.art,a.lnk,.tdt a',118);}return ok;}
  function onScroll(){
    var a=hs[0].getBoundingClientRect().top,last=col.getBoundingClientRect().bottom,vh=window.innerHeight,show=a<vh*0.5&&last>vh*0.75;
    L.classList.toggle('show',show);R.classList.toggle('show',show);
    var rc=col.getBoundingClientRect();prog.style.width=(Math.max(0,Math.min(1,(-rc.top+vh*0.3)/Math.max(1,rc.height)))*100).toFixed(1)+'%';
    var cur=0;hs.forEach(function(h,i){if(h.getBoundingClientRect().top<150)cur=i;});
    links.forEach(function(x,i){x.classList.toggle('on',i===cur);});
  }
  place();onScroll();window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('resize',function(){place();onScroll();});
  /* tickers mentioned in the article, most mentioned first */
  var txt=col.textContent||'',cnt={},m,re=/\$([A-Z]{2,5})\b/g;while((m=re.exec(txt)))cnt[m[1]]=(cnt[m[1]]||0)+1;
  var h1=(document.querySelector('h1')||{}).textContent||'';(h1.match(/\b[A-Z]{3,5}\b/g)||[]).forEach(function(t){cnt[t]=(cnt[t]||0)+5;});
  var mine=Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a];});
  function fill(id,html){var b=document.getElementById(id);if(b&&html){b.lastElementChild.innerHTML=html;b.hidden=false;place();}}
  fetch('/data/search-index.json').then(function(r){return r.json();}).then(function(idx){
    var E={};idx.forEach(function(x){if(x.t==='e')E[x.s]=x;});
    var rows=mine.filter(function(t){return E[t];}).slice(0,7).map(function(t){var e=E[t];return '<a class="row" href="'+e.u+'" title="'+esc(e.n)+'"><b>$'+t+'</b><span>'+esc(e.is||e.n)+'</span>'+(e.y?'<em>'+esc(e.y)+'</em>':'')+(e.g?'<i>'+esc(e.g)+'</i>':'')+'</a>';}).join('');
    fill('tdEtf',rows);fill('tdEtf2',rows);
  }).catch(function(){});
  fetch('/blog').then(function(r){return r.text();}).then(function(h){
    var doc=new DOMParser().parseFromString(h,'text/html'),cards=[].slice.call(doc.querySelectorAll('.blog-card')),me=null,list=[];
    cards.forEach(function(c){var a=c.querySelector('a.read-more')||c.querySelector('a');if(!a)return;var u=new URL(a.getAttribute('href'),location.origin).pathname.replace(/\.html$/,'');var t=(c.querySelector('h3')||{}).textContent||'';
      var o={u:u,t:t.trim(),tk:(c.dataset.tickers||'').split(/\s+/).filter(Boolean),cat:c.dataset.cat||'',d:c.dataset.date||'',lab:((c.querySelector('.card-date')||{}).textContent||'').split('•').pop().trim()};
      if(u.replace(/\/$/,'').split('/').pop()===slug)me=o;else list.push(o);});
    var myT=me&&me.tk.length?me.tk:mine.slice(0,3),myC=me?me.cat:'';
    list.forEach(function(o){o.s=o.tk.filter(function(t){return myT.indexOf(t)>-1;}).length*10+(myC&&o.cat===myC?3:0)+(o.d>'2026-10'?1:0);});
    list.sort(function(a,b){return b.s-a.s||(a.d<b.d?1:-1);});
    var html=list.slice(0,5).map(function(o){return '<a class="art" href="'+o.u+'">'+(o.lab?'<small>'+esc(o.lab)+'</small>':'')+esc(o.t)+'</a>';}).join('');
    fill('tdRel',html);fill('tdRel2',html);
  }).catch(function(){});
})();
