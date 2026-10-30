window.AQUATRAIL_BUILD=window.AQUATRAIL_BUILD||Object.freeze({product:'AQUA TRAIL',release:'Aqua Trail BETA blocco 1.7',version:'BETA blocco 1.7',phase:'DEBUG BLOCKS',checkpoint:'BLOCCO 1.7',label:'BETA blocco 1.7',marker:'AQUA_TRAIL_BETA_BLOCCO_1_7_RELEASE',full:'AQUA_TRAIL_BETA_BLOCCO_1_7',parent:'Aqua Trail BETA blocco 1.6',date:'2026-09-19'});

function initPublicNavigation(){
  const b=document.querySelector('.menu'),n=document.querySelector('.navlinks');
  if(!b||!n||b.dataset.navInitialized==='1')return;
  const publicNav=document.body?.dataset?.admin!=='1'&&document.body?.dataset?.judge!=='1';
  if(publicNav){if(!n.id)n.id='public-navigation';const isOpen=n.classList.contains('open');b.setAttribute('aria-controls',n.id);b.setAttribute('aria-expanded',String(isOpen));b.setAttribute('aria-label',isOpen?'Chiudi menu':'Apri menu')}
  b.addEventListener('click',()=>{const open=n.classList.toggle('open');if(publicNav){b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-label',open?'Chiudi menu':'Apri menu')}});
  b.dataset.navInitialized='1';
}
if((location.pathname.split('/').pop()||'').toLowerCase()==='regolamento.html'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initPublicNavigation,{once:true});else initPublicNavigation();
}

ATApp.onReady(()=>{
  if(window.ATStore){try{const wc=ATStore.workspace();document.documentElement.dataset.workspace=wc.mode;document.body.dataset.workspace=wc.mode;let bar=document.querySelector('.workspace-global-banner');if(!bar){bar=document.createElement('div');bar.className='workspace-global-banner';document.body.prepend(bar)}bar.classList.toggle('demo',wc.mode==='DEMO');bar.classList.toggle('real',wc.mode==='REAL');bar.innerHTML=wc.mode==='DEMO'?'<strong>🧪 AMBIENTE DEMO</strong><span>Dati di simulazione, formazione e debug. Nessun dato ufficiale REAL è visibile.</span>':'<strong>AMBIENTE REAL</strong><span>Dati ufficiali Aqua Trail. I dati DEMO sono completamente esclusi.</span>';}catch(_){}}
  if(location.protocol==='file:'){const w=document.createElement('div');w.className='file-protocol-warning';w.innerHTML='<b>ATTENZIONE · apertura diretta file://</b> — Chiudi questa pagina e usa <b>AVVIA_WINDOWS.bat</b> oppure <b>AVVIA_MAC.command</b>.';document.body.prepend(w);}
  initPublicNavigation();
  document.querySelectorAll('.admin-header .brand-copy>span:not(.build-badge)').forEach(el=>{el.textContent='Aqua Trail® · '+window.AQUATRAIL_BUILD.label;});
  document.querySelectorAll('.build-kicker').forEach(el=>{el.textContent=window.AQUATRAIL_BUILD.label;});
  document.querySelectorAll('.header .brand-copy').forEach(host=>{if(host.querySelector('.build-badge'))return;const b=document.createElement('span');b.className='build-badge';b.textContent=window.AQUATRAIL_BUILD.label;b.title=`Build: ${window.AQUATRAIL_BUILD.full} · ${window.AQUATRAIL_BUILD.date}`;b.setAttribute('aria-label',`Versione ${window.AQUATRAIL_BUILD.label}`);host.appendChild(b);});
  const adminPage=document.body.dataset.admin==='1',judgePage=document.body.dataset.judge==='1',currentPage=(location.pathname.split('/').pop()||'').toLowerCase();let s=null;
  if((adminPage||judgePage)&&window.ATStore){
    s=ATStore.requireSession();if(!s)return;
    const judgeAllowed=new Set(['gara-giudice.html','ordine-gara-admin.html','news-evento-admin.html','race-control-admin.html']);
    if(s.role==='GIUDICE'&&!judgeAllowed.has(currentPage)){location.href='gara-giudice.html';return;}
    if(s.role==='CENTRO_ASSOCIATO'&&currentPage!=='centro-evento.html'){location.href='centro-evento.html';return;}
    const frontOfficeAllowed=new Set(['frontoffice.html','checkin-admin.html','preregistrazioni-admin.html','iscrizioni-admin.html','binomi-admin.html','binomio-admin.html','contabilita-admin.html','membership-card.html','cambio-password.html']);
    if(s.role==='FRONT_OFFICE'){const caps=s.capabilities||{};if(caps.race_control)frontOfficeAllowed.add('race-control-admin.html');if(caps.start_order)frontOfficeAllowed.add('ordine-gara-admin.html');if(caps.race_data_entry)frontOfficeAllowed.add('gara-admin.html');if(caps.live_news)frontOfficeAllowed.add('news-evento-admin.html');if(caps.results_print)frontOfficeAllowed.add('risultati-gara-pdf.html');}
    if(s.role==='FRONT_OFFICE'&&!frontOfficeAllowed.has(currentPage)){location.href='frontoffice.html';return;}
    if(!['GIUDICE','CENTRO_ASSOCIATO','FRONT_OFFICE','ADMIN1','ADMIN2','SUPERADMIN'].includes(s.role)){location.href='login-admin.html';return;}
    if(s.role==='FRONT_OFFICE'&&s.event_id&&!ATStore.canAccessEvent(s.event_id)){location.href='login-admin.html';return;}
  }
  const nav=document.querySelector('.admin-navlinks');
  if(nav){
    const ensure=(href,label,beforeHref)=>{if(nav.querySelector(`a[href="${href}"]`))return;const a=document.createElement('a');a.href=href;a.textContent=label;const before=beforeHref?nav.querySelector(`a[href="${beforeHref}"]`):null;before?nav.insertBefore(a,before):nav.appendChild(a);};
    if(s?.role==='GIUDICE'){
      ensure('gara-giudice.html','Gara');ensure('race-control-admin.html','Race Control');ensure('ordine-gara-admin.html','Ordine gara');ensure('news-evento-admin.html','News live');
      const judgeEvents=ATStore.assignedEvents();if(judgeEvents.length===1)ensure(`evento.html?event=${encodeURIComponent(judgeEvents[0].id)}`,'Scheda evento');
      nav.querySelectorAll('a').forEach(a=>{const href=a.getAttribute('href')||'',h=href.split('?')[0];a.style.display=['gara-giudice.html','race-control-admin.html','ordine-gara-admin.html','news-evento-admin.html','evento.html'].includes(h)?'':'none';a.classList.toggle('active',h.toLowerCase()===currentPage);});
    }else if(s?.role==='CENTRO_ASSOCIATO'){
      ensure('centro-evento.html','Il mio evento');nav.querySelectorAll('a').forEach(a=>{const h=(a.getAttribute('href')||'').split('?')[0];a.style.display=h==='centro-evento.html'?'':'none';a.classList.toggle('active',h.toLowerCase()===currentPage);});
    }else if(s?.role==='FRONT_OFFICE'){
      const eid=encodeURIComponent(s.event_id||'');
      ensure('frontoffice.html','Front Office');ensure(`checkin-admin.html?event=${eid}`,'Check-in');ensure(`preregistrazioni-admin.html?event=${eid}`,'Pre-reg');ensure(`iscrizioni-admin.html?event=${eid}`,'Iscrizioni');ensure('binomi-admin.html','Binomi');ensure(`contabilita-admin.html?event=${eid}`,'Cassa');
      const caps=s.capabilities||{},allowed=new Set(['frontoffice.html','checkin-admin.html','preregistrazioni-admin.html','iscrizioni-admin.html','binomi-admin.html','binomio-admin.html','contabilita-admin.html','membership-card.html']);
      if(caps.race_control){ensure(`race-control-admin.html?event=${eid}`,'Race Control');allowed.add('race-control-admin.html')}if(caps.start_order){ensure(`ordine-gara-admin.html?event=${eid}`,'Ordine gara');allowed.add('ordine-gara-admin.html')}if(caps.race_data_entry){ensure(`gara-admin.html?event=${eid}`,'Gara delegata');allowed.add('gara-admin.html')}if(caps.live_news){ensure(`news-evento-admin.html?event=${eid}`,'News live');allowed.add('news-evento-admin.html')}
      nav.querySelectorAll('a').forEach(a=>{const h=(a.getAttribute('href')||'').split('?')[0];a.style.display=allowed.has(h)?'':'none';a.classList.toggle('active',h.toLowerCase()===currentPage);});
      document.querySelectorAll('.admin-header .brand[href="admin.html"]').forEach(a=>a.href='frontoffice.html');
    }else{
      ensure('nuovo-evento-admin.html','+ Evento','binomi-admin.html');ensure('race-control-admin.html','Race Control','ordine-gara-admin.html');ensure('ordine-gara-admin.html','Ordine gara','gara-admin.html');ensure('giudici-admin.html','Giudici','gallery-admin.html');ensure('centri-associati-admin.html','Centri associati','giudici-admin.html');ensure('news-evento-admin.html','News live','gallery-admin.html');ensure('preregistrazioni-admin.html','Pre-reg','iscrizioni-admin.html');ensure('checkin-admin.html','Check-in','gara-admin.html');if(s?.role==='SUPERADMIN')ensure('classifica-admin.html','Classifiche','audit-admin.html');nav.querySelectorAll('a').forEach(a=>a.classList.toggle('active',(a.getAttribute('href')||'').split('?')[0].toLowerCase()===currentPage));
    }
  }
  if(adminPage&&s&&!['GIUDICE','CENTRO_ASSOCIATO','FRONT_OFFICE'].includes(s.role)&&window.ATStore)ATStore.ensureAllEventPuks();
  if((adminPage||judgePage)&&s){const host=document.querySelector('.admin-header .container.nav')||document.querySelector('.judge-session-host');if(host&&!host.querySelector('.admin-session')){const box=document.createElement('div');box.className='admin-session';let label=s.role==='SUPERADMIN'?'SUPERADMIN · ACCESSO TOTALE':s.role;if(s.role==='GIUDICE'){const j=(ATStore.public().judges||[]).find(x=>String(x.id)===String(s.judge_id||''));label=`GIUDICE · ${j?.name||s.username}`;}if(s.role==='CENTRO_ASSOCIATO'){const c=(ATStore.public().organizers||[]).find(x=>String(x.id)===String(s.center_id||''));label=`CENTRO ASSOCIATO · ${c?.name||s.username}`;}if(s.role==='FRONT_OFFICE'){const e=(ATStore.public().events||[]).find(x=>String(x.id)===String(s.event_id||''));label=`FRONT OFFICE · ${e?.name||s.event_id||s.username}`;}box.innerHTML=`<span>${label}</span><button type="button" id="logoutBtn">Esci</button>`;host.appendChild(box);box.querySelector('#logoutBtn').onclick=()=>ATStore.logout();}}
});

// BLOCCO 1.7 — revoca sessione anche su pagine ripristinate da back-forward cache.
window.addEventListener('pageshow',()=>{
  if(!window.ATStore)return;
  const protectedPage=document.body?.dataset?.admin==='1'||document.body?.dataset?.judge==='1';
  if(protectedPage&&!ATStore.session())location.replace('accesso-riservato.html?expired=1');
});

// V.0.9_BETA_ONLINE — navigazione tabelle larghe + controlli layout.
ATApp.onReady(()=>{
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const enhanceTable=(wrap)=>{
    if(!wrap||wrap.dataset.layoutNav==='1')return;
    const table=wrap.querySelector('table');
    if(!table)return;
    wrap.dataset.layoutNav='1';
    const bar=document.createElement('div');
    bar.className='table-nav-tools';
    bar.innerHTML='<div class="table-nav-copy"><b>↔ TABELLA SCORREVOLE</b><small>Usa la barra o i pulsanti per vedere tutte le colonne.</small></div><div class="table-nav-actions"><button type="button" data-go="start">← Inizio</button><button type="button" data-go="prev" aria-label="Scorri a sinistra">◀</button><span class="table-nav-percent">0%</span><button type="button" data-go="next" aria-label="Scorri a destra">▶</button><button type="button" data-go="end">Fine →</button></div>';
    wrap.parentNode.insertBefore(bar,wrap);
    const pct=bar.querySelector('.table-nav-percent');
    const update=()=>{
      const max=Math.max(0,wrap.scrollWidth-wrap.clientWidth);
      bar.hidden=max<8;
      pct.textContent=max?`${Math.round(clamp(wrap.scrollLeft/max,0,1)*100)}%`:'0%';
    };
    const step=()=>Math.max(240,Math.floor(wrap.clientWidth*.72));
    bar.addEventListener('click',e=>{
      const b=e.target.closest('button[data-go]');if(!b)return;
      const max=Math.max(0,wrap.scrollWidth-wrap.clientWidth),g=b.dataset.go;
      let left=wrap.scrollLeft;
      if(g==='start')left=0;else if(g==='end')left=max;else if(g==='prev')left-=step();else if(g==='next')left+=step();
      wrap.scrollTo({left:clamp(left,0,max),behavior:'smooth'});
    });
    wrap.addEventListener('scroll',update,{passive:true});
    if(window.ResizeObserver)new ResizeObserver(update).observe(wrap);else window.addEventListener('resize',update);
    requestAnimationFrame(update);
  };
  document.querySelectorAll('.table-wrap,.data-table-wrap').forEach(enhanceTable);
  // Riduci il rischio di menu lasciati aperti dopo un cambio di larghezza.
  window.addEventListener('resize',()=>{if(innerWidth>1050)document.querySelectorAll('.admin-navlinks.open,.navlinks.open').forEach(n=>{n.classList.remove('open');const m=n.parentElement?.querySelector('.menu');if(m&&document.body?.dataset?.admin!=='1'&&document.body?.dataset?.judge!=='1'){m.setAttribute('aria-expanded','false');m.setAttribute('aria-label','Apri menu')}})},{passive:true});
});


// Standard globale tempi MM:SS:CC (minuti:secondi:centesimi)
(function(){
  const pad2=n=>String(Math.trunc(Math.max(0,Number(n)||0))).padStart(2,'0');
  const fromSeconds=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0?Math.round(n*100):null};
  const toSeconds=cs=>{const n=Number(cs);return Number.isFinite(n)?n/100:null};
  const parseStrict=value=>{
    if(value==null)return null;
    if(typeof value==='number')return Number.isFinite(value)&&value>=0?Math.round(value*100):NaN;
    const s=String(value).trim();if(!s)return null;
    const m=s.match(/^(\d{2}):(\d{2}):(\d{2})$/);if(!m)return NaN;
    const min=Number(m[1]),sec=Number(m[2]),cent=Number(m[3]);
    if(sec>59||cent>99)return NaN;
    return ((min*60)+sec)*100+cent;
  };
  const parseLegacy=value=>{
    const strict=parseStrict(value);if(strict!==null&&!Number.isNaN(strict))return strict;
    if(value==null||String(value).trim()==='')return null;
    let s=String(value).trim().replace(',','.');
    if(/^\d+(?:\.\d+)?$/.test(s)){const n=Number(s);return Number.isFinite(n)&&n>=0?Math.round(n*100):NaN}
    let m=s.match(/^(\d{1,3}):(\d{1,2})(?:\.(\d{1,2}))?$/);if(m){const min=Number(m[1]),sec=Number(m[2]),cent=Number(String(m[3]||'0').padEnd(2,'0'));if(sec>59||cent>99)return NaN;return ((min*60)+sec)*100+cent}
    return NaN;
  };
  const formatCs=value=>{if(value==null||value==='')return '—';const n=Number(value);if(!Number.isFinite(n)||n<0)return '—';const cs=Math.round(n),min=Math.floor(cs/6000),sec=Math.floor((cs%6000)/100),cent=cs%100;return `${pad2(min)}:${pad2(sec)}:${pad2(cent)}`};
  const formatAny=(cs,seconds)=>{const n=cs!=null?Number(cs):fromSeconds(seconds);return n==null||!Number.isFinite(n)?'—':formatCs(n)};
  const maskValue=value=>{const d=String(value??'').replace(/\D/g,'').slice(0,6);if(d.length<=2)return d;if(d.length<=4)return d.slice(0,2)+':'+d.slice(2);return d.slice(0,2)+':'+d.slice(2,4)+':'+d.slice(4)};
  // Validazione progressiva MM:SS:CC: il primo digit dei secondi non può superare 5.
  // Questo impedisce già in digitazione/incolla valori semanticamente impossibili come 01:72:87.
  const isPartialTimeValid=value=>{const d=String(value??'').replace(/\D/g,'').slice(0,6);if(d.length>=3&&Number(d[2])>5)return false;return true};
  const isStrictTimeValid=value=>{const cs=parseStrict(value);return cs!==null&&!Number.isNaN(cs)};
  const bindInput=el=>{if(!el||el.dataset.timeMask==='1')return;el.dataset.timeMask='1';el.type='text';el.inputMode='numeric';el.maxLength=8;el.pattern='\\d{2}:\\d{2}:\\d{2}';el.placeholder=el.placeholder||'01:30:00';el.autocomplete='off';let initial=maskValue(el.value);if(!isPartialTimeValid(initial))initial='';el.value=initial;el.dataset.timeLastPartial=initial;const invalidMsg='Usa MM:SS:CC con secondi 00-59 e centesimi 00-99.';el.addEventListener('input',()=>{const before=el.value,masked=maskValue(before);if(!isPartialTimeValid(masked)){el.value=el.dataset.timeLastPartial||'';el.setCustomValidity('I secondi devono essere compresi tra 00 e 59.');el.setAttribute('aria-invalid','true');return}if(before!==masked)el.value=masked;el.dataset.timeLastPartial=masked;const complete=masked.length===8,cs=complete?parseStrict(masked):null,invalid=complete&&Number.isNaN(cs);el.setCustomValidity(invalid?invalidMsg:'');el.setAttribute('aria-invalid',invalid?'true':'false')});el.addEventListener('blur',()=>{if(!el.value){el.setCustomValidity('');el.setAttribute('aria-invalid','false');return}const cs=parseStrict(el.value);if(Number.isNaN(cs)||cs===null){el.setCustomValidity(invalidMsg);el.setAttribute('aria-invalid','true');return}el.value=formatCs(cs);el.dataset.timeLastPartial=el.value;el.setCustomValidity('');el.setAttribute('aria-invalid','false')});};
  const stageTimeCs=(cfg,tps)=>{if(!cfg)return 0;const raw=cfg.times_cs?.[tps]??cfg.times_cs?.[String(tps)];if(raw!=null&&Number.isFinite(Number(raw)))return Math.round(Number(raw));const legacy=cfg.times?.[tps]??cfg.times?.[String(tps)];const cs=fromSeconds(legacy);return cs==null?0:cs};
  const validateTpsThresholds=values=>{const v=(values||[]).map(Number);if(v.length!==3||v.some(x=>!Number.isFinite(x)||x<=0))return {ok:false,reason:'I tre tempi TPS devono essere maggiori di zero.'};if(!(v[0]<v[1]&&v[1]<v[2]))return {ok:false,reason:'Le soglie devono essere crescenti: TPS1 < TPS2 < TPS3.'};return {ok:true,values:v};};
  window.ATTime={parse:parseStrict,parseStrict,parseLegacy,formatCs,formatAny,fromSeconds,toSeconds,maskValue,isPartialTimeValid,isStrictTimeValid,bindInput,stageTimeCs,validateTpsThresholds};
  window.ATSeason={
    infoForDate(P,date){
      const d=String(date||'');if(!d)return {id:'',label:'DA DEFINIRE',inConfiguredSeason:false,inferred:false};
      const all=[];if(P?.season?.start_date)all.push(P.season);for(const h of (P?.season_history||[])){const s=h?.season||h;if(s?.start_date)all.push(s)}
      const exact=all.find(s=>(!s.start_date||d>=s.start_date)&&(!s.end_date||d<=s.end_date));if(exact)return {id:exact.id||exact.name||'',label:String(exact.name||exact.id||'STAGIONE'),inConfiguredSeason:true,inferred:false,start_date:exact.start_date||'',end_date:exact.end_date||''};
      const cur=P?.season||{},m=String(cur.name||cur.id||'').match(/(\d{4})\D+(\d{4})/),sm=String(cur.start_date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(m&&sm){const dt=new Date(d+'T12:00:00'),startMonth=Number(sm[2])-1,startDay=Number(sm[3]),eventYear=dt.getFullYear(),startThis=new Date(eventYear,startMonth,startDay,12),sy=dt<startThis?eventYear-1:eventYear,span=Number(m[2])-Number(m[1])||1;return {id:`${sy}-${sy+span}`,label:`${sy}/${sy+span}`,inConfiguredSeason:false,inferred:true}}
      return {id:'',label:'FUORI STAGIONE CONFIGURATA',inConfiguredSeason:false,inferred:false};
    }
  };
  ATApp.onReady(()=>document.querySelectorAll('[data-time-mmsscc="1"]').forEach(bindInput));
})();

// STEP4 CP09 — shell area riservata centralizzata. Una sola configurazione per ruolo.
ATApp.onReady(()=>{
  const header=document.querySelector('.admin-header');
  if(!header||!window.ATStore)return;
  const s=ATStore.session();
  if(!s)return;
  const host=header.querySelector('.container.nav')||header.querySelector('.container');
  if(!host)return;
  let brand=host.querySelector('.brand');
  let brandMain=host.querySelector('.brand-main');
  if(!brand&&brandMain){
    brand=document.createElement('a');brand.className='brand';brand.href=s.role==='GIUDICE'?'gara-giudice.html':s.role==='CENTRO_ASSOCIATO'?'centro-evento.html':s.role==='SUPERADMIN'?'superadmin.html':'admin.html';
    brandMain.parentNode.insertBefore(brand,brandMain);brand.appendChild(brandMain);
  }
  if(brand){brand.href=s.role==='GIUDICE'?'gara-giudice.html':s.role==='CENTRO_ASSOCIATO'?'centro-evento.html':s.role==='SUPERADMIN'?'superadmin.html':'admin.html';}
  const copy=host.querySelector('.brand-copy');
  if(copy){
    const strong=copy.querySelector('strong');
    const sub=[...copy.children].find(x=>x.tagName==='SPAN'&&!x.classList.contains('build-badge'));
    if(strong)strong.textContent=s.role==='GIUDICE'?'Area GIUDICE DK':s.role==='CENTRO_ASSOCIATO'?'Area CENTRO ASSOCIATO':'Area riservata DK';
    if(sub)sub.textContent=`Aqua Trail® · ${window.AQUATRAIL_BUILD?.label||'BETA'}`;
  }
  let nav=host.querySelector('.admin-navlinks');
  if(!nav){nav=document.createElement('nav');nav.className='navlinks admin-navlinks';const menu=host.querySelector('.menu');menu?host.insertBefore(nav,menu):host.appendChild(nav);}
  let menu=host.querySelector('.menu');
  if(!menu){menu=document.createElement('button');menu.className='menu';menu.type='button';menu.setAttribute('aria-label','Apri menu');menu.textContent='☰';host.appendChild(menu);menu.onclick=()=>nav.classList.toggle('open');}
  const adminMenu=[
    ['admin.html','Dashboard'],['evento-admin.html','Eventi'],['nuovo-evento-admin.html','+ Evento'],['binomi-admin.html','Binomi'],['preregistrazioni-admin.html','Pre-reg'],['iscrizioni-admin.html','Iscrizioni'],['ordine-gara-admin.html','Ordine gara'],['checkin-admin.html','Check-in'],['race-control-admin.html','Race Control'],['gara-admin.html','Gara'],['giudici-admin.html','Giudici'],['centri-associati-admin.html','Centri associati'],['news-evento-admin.html','News live'],['gallery-admin.html','Gallery'],['contabilita-admin.html','Contabilità'],['audit-admin.html','Audit'],['impostazioni-admin.html','Impostazioni'],['importa-dati.html','Import / Backup']
  ];
  const judgeMenu=[['gara-giudice.html','Gara'],['race-control-admin.html','Race Control'],['ordine-gara-admin.html','Ordine gara'],['news-evento-admin.html','News live']];
  const centerMenu=[['centro-evento.html','Il mio evento']];
  let items=s.role==='GIUDICE'?judgeMenu:s.role==='CENTRO_ASSOCIATO'?centerMenu:adminMenu.slice();
  if(s.role==='SUPERADMIN')items.unshift(['superadmin.html','SUPERADMIN']);
  const current=(location.pathname.split('/').pop()||'').toLowerCase();
  nav.innerHTML=items.map(([href,label])=>`<a href="${href}" class="${href.toLowerCase()===current?'active':''}">${label}</a>`).join('');
  if(s.role==='GIUDICE'){
    const evs=ATStore.assignedEvents();if(evs.length===1){const a=document.createElement('a');a.href=`evento.html?event=${encodeURIComponent(evs[0].id)}`;a.textContent='Scheda evento';nav.appendChild(a);}
  }
});

// BETA 1.1 CP2 STEP11 — visibilità campi centralizzata e reversibile.
ATApp.onReady(()=>{
  if(!window.ATStore)return;
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase(),rules=ATStore.fieldVisibilityRules?.()||[];
  for(const r of rules){
    if(String(r.page||'*').toLowerCase()!=='*'&&String(r.page||'').toLowerCase()!==page)continue;
    try{document.querySelectorAll(r.selector).forEach(el=>el.classList.toggle('sa-field-hidden',!!r.hidden));}catch(e){/* selettore non valido: non bloccare la pagina */}
  }
});

