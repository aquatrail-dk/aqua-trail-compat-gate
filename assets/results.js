ATApp.onReady(()=>{
 const DATA=ATStore.public(),$=s=>document.querySelector(s),fmt=(cs,sec)=>ATTime.formatAny(cs,sec),esc=ATContent.escape,safeHref=v=>{const raw=String(v||'').trim();if(!raw)return '#';try{const u=new URL(raw,location.href);return ['https:','http:'].includes(u.protocol)?u.href:'#'}catch{return '#'}},isPublicEntry=x=>{const reg=String(x?.registration_status||'').toUpperCase(),legacy=String(x?.state||'').toUpperCase();if(reg)return reg==='CONFERMATO';return ['IN GARA','SUPERATO','ELIMINATO','ELIMINATO DEFINITIVO','SQUALIFICATO'].includes(legacy)},tpsLabel=v=>Number(v)?`TPS${Number(v)}`:'TPS DA ASSEGNARE',stages=['OPEN','ADVANCE','MASTER','SPEED'];
 const published=(DATA.events||[]).filter(e=>e.published!==false);
 const today=new Date(); today.setHours(0,0,0,0);
 const evDate=e=>new Date((e.start_date||'')+'T12:00:00');
 const upcoming=published.filter(e=>!Number.isNaN(+evDate(e))&&evDate(e)>=today).sort((a,b)=>String(a.start_date).localeCompare(String(b.start_date)));
 const past=published.filter(e=>!Number.isNaN(+evDate(e))&&evDate(e)<today).sort((a,b)=>String(b.start_date).localeCompare(String(a.start_date)));
 const defaultEvent=(upcoming[0]||past[0]||published[0]||{}).id||'';
 let state={event:defaultEvent,day:'',tps:0,search:'',stage:'OPEN',selected:null};
 const pair=id=>(DATA.pairs||[]).find(p=>p.id===id)||{id,dog:id,handler_first_name:'',handler_last_name:'',current_tps:0,tps_status:'PROVVISORIO'};
 const entry=(eventId,pairId)=>(DATA.entries||[]).find(e=>e.event_id===eventId&&e.pair_id===pairId)||null;
 const pairText=p=>ATStore.norm([p.id,p.team_name,ATStore.handlerName(p),p.handler_first_name,p.handler_last_name,p.dog].join(' '));
 const eventDays=eventId=>(DATA.event_days||[]).filter(d=>d.event_id===eventId).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.id).localeCompare(String(b.id)));
 const dayFor=(eventId,dayId)=>eventDays(eventId).find(d=>String(d.id)===String(dayId))||null;
 function raceLabel(eventId,dayId){const ev=published.find(x=>x.id===eventId)||{},d=dayFor(eventId,dayId);if(!d)return 'Evento';const comp=ev.competition_mode==='INDEPENDENT_DAYS'?(d.competition_id||`COMP-${d.id}`):'GARA UNICA';return `${esc(d.label||d.id)} · ${esc(comp)}`}
 function publishedRows(eventId,stage=''){return window.ATPublication?window.ATPublication.publishedRaceRows(DATA,eventId,stage,state.day):[]}
 function rows(){return publishedRows(state.event,state.stage).map(r=>({r,p:pair(r.pair_id),e:entry(state.event,r.pair_id)})).filter(x=>(!state.tps||Number(x.r.tps||x.e?.tps||x.p.current_tps)===state.tps)&&(!state.search||pairText(x.p).includes(state.search)))}
 const badge=s=>{const v=String(s||'—'),klass=['ELIMINATO','ELIMINATO DEFINITIVO','SQUALIFICATO','NON AMMESSO'].includes(v)?'no':v==='SUPERATO'?'ok':'warn';return `<span class="badge ${klass}">${esc(v)}</span>`};
 function eventCard(e,label=''){return `<a class="event-archive-card" href="evento.html?event=${encodeURIComponent(e.id)}"><img src="${esc(ATMedia.url(e.poster,'assets/logo-aquatrail.jpg'))}" alt="Locandina ${esc(e.name)}"><div>${label?`<span class="badge ok">${esc(label)}</span>`:''}<strong>${esc(e.name)}</strong><small>${esc(ATStore.fmtDate(e.start_date))} · ${esc(e.location||'')}</small><span>Apri scheda evento →</span></div></a>`}
 function renderArchives(){
   const hero=$('#nextEventHero'),up=$('#upcomingEvents'),pa=$('#pastEvents');
   if(hero){hero.innerHTML=upcoming[0]?`<article class="next-event-card compact"><a class="next-event-poster" href="evento.html?event=${encodeURIComponent(upcoming[0].id)}"><img src="${esc(safeHref(ATMedia.url(upcoming[0].poster,'assets/logo-aquatrail.jpg')))}" alt=""></a><div><span class="badge ok">PROSSIMO EVENTO</span><h2>${esc(upcoming[0].name)}</h2><p class="next-event-date">${esc(ATStore.fmtDate(upcoming[0].start_date))}</p><p>${esc(upcoming[0].location||'')}</p><p>${esc(ATContent.eventPlain(upcoming[0]))}</p><a class="btn btn-primary" href="evento.html?event=${encodeURIComponent(upcoming[0].id)}">Scopri l’evento</a></div></article>`:'<div class="next-event-empty"><strong>Nessun prossimo evento pubblicato al momento.</strong><p>Gli appuntamenti futuri compariranno qui appena pubblicati dallo staff.</p></div>'}
   if(up)up.innerHTML=upcoming.length?upcoming.map((e,i)=>eventCard(e,i===0?'PROSSIMO':'IN PROGRAMMA')).join(''):'<div class="notice info">Nessun evento futuro pubblicato.</div>';
   if(pa)pa.innerHTML=past.length?past.map(e=>eventCard(e,'EVENTO PASSATO')).join(''):'<div class="notice info">Nessun evento passato disponibile.</div>';
 }
 function renderGlobalMatches(){
   const host=$('#globalPairMatches'); if(!host)return;
   if(!state.search){host.innerHTML='';return}
   const matches=(DATA.pairs||[]).filter(p=>pairText(p).includes(state.search)).slice(0,12);
   host.innerHTML=matches.length?`<div class="global-pair-title">Binomi trovati nell’anagrafica completa</div><div class="global-pair-list">${matches.map(p=>`<a href="binomio.html?id=${encodeURIComponent(p.id)}"><strong>${esc(ATStore.handlerName(p))} + ${esc(p.dog)}</strong><span>${esc(p.team_name||'')} · ${esc(p.id)} · ${p.current_tps?'TPS'+esc(p.current_tps):'TPS DA ASSEGNARE'} ${esc(p.tps_status||'')}</span></a>`).join('')}</div>`:'<div class="notice info">Nessun binomio registrato corrisponde alla ricerca.</div>';
 }
 function configureDayFilter(){const sel=$('#daySelect');if(!sel)return;const ev=published.find(e=>e.id===state.event)||{},days=eventDays(state.event),old=state.day;sel.innerHTML=`<option value="">${ev.competition_mode==='INDEPENDENT_DAYS'?'Tutte le gare/giornate':'Tutte le giornate'}</option>`+days.map(d=>`<option value="${ATContent.escape(d.id)}">${ATContent.escape(raceLabel(state.event,d.id))}</option>`).join('');state.day=days.some(d=>String(d.id)===String(old))?old:'';sel.value=state.day}
 function render(){
   const ev=published.find(e=>e.id===state.event)||published[0]||{},date=a=>a?new Date(a+'T12:00').toLocaleDateString('it-IT'):'—';
   $('#eventDate').textContent=ev.start_date===ev.end_date?date(ev.start_date):`${date(ev.start_date)} → ${date(ev.end_date)}`;
   $('#eventPlace').textContent=ev.location||'—';
   $('#eventStatus').textContent=ev.status||'—';
   $('#participants').textContent=new Set((DATA.entries||[]).filter(e=>e.event_id===state.event&&isPublicEntry(e)&&(DATA.pairs||[]).some(p=>String(p.id)===String(e.pair_id))).map(e=>e.pair_id)).size;
   $('#eventPoster').src=ATMedia.url(ev.poster,'assets/logo-aquatrail.jpg');
   $('#eventPosterTitle').textContent=ev.name||'';
   $('#eventPosterText').textContent=`${date(ev.start_date)} · ${ev.location||''}`;
   const href=`evento.html?event=${encodeURIComponent(ev.id||state.event)}`; const pl=$('#eventPosterLink'),db=$('#eventDetailBtn'); if(pl)pl.href=href;if(db)db.href=href;
   const promo=$('#eventPromo'); if(promo) promo.innerHTML=`<div>${ATContent.eventHtml(ev)}</div><p><strong>Come raggiungerci:</strong> ${ATContent.escape(ev.address||'')}</p><div class="actions"><a class="btn btn-light small" href="${esc(safeHref(ev.maps_url))}" target="_blank" rel="noopener">Google Maps</a></div>`;
   renderGlobalMatches();
   const body=$('#tbody');body.innerHTML='';const list=rows();
   list.forEach(({r,p,e})=>{const tr=document.createElement('tr'),pos=r.ranking_validation==='VALIDATED'&&r.position?String(r.position):'—';if(state.selected===`${p.id}|${r.day_id}`)tr.classList.add('selected');tr.innerHTML=`<td>${esc(pos)}</td><td><strong>${raceLabel(state.event,r.day_id)}</strong></td><td><strong>${esc(ATStore.handlerName(p))} + ${esc(p.dog)}</strong><br><small>${esc(p.team_name||'')}</small></td><td>${esc(tpsLabel(r.tps||e?.tps||p.current_tps))} · ${esc(e?.tps_status||p.tps_status||'')}</td><td>${fmt(r.time_cs,r.time_s)}</td><td>${Number(r.stage_penalties??0)}</td><td>${Number(r.event_penalties??r.series_penalties??0)}</td><td>${fmt(r.bonus_cs,r.bonus_s)}</td><td>${r.recall_used?'SI':'NO'}</td><td>${badge(r.state)}${r.out_of_podium_tps?'<br><small>FUORI PODIO TPS</small>':''}</td><td>${r.ranking_validation==='VALIDATED'?'<span class="badge ok">VALIDATA</span>':'<span class="badge warn">IN ATTESA</span>'}</td>`;tr.onclick=()=>{state.selected=`${p.id}|${r.day_id}`;renderDetail(p,r.day_id);document.querySelectorAll('#tbody tr').forEach(x=>x.classList.remove('selected'));tr.classList.add('selected')};body.appendChild(tr)});
   if(!list.length)body.innerHTML='<tr><td colspan="11">Nessun risultato con questi filtri. La ricerca binomio sopra continua comunque a cercare nell’intera anagrafica.</td></tr>';
   const selectedKey=String(state.selected||''),selectedPid=selectedKey.split('|')[0],selectedDay=selectedKey.split('|')[1]||'',selected=list.find(x=>x.p.id===selectedPid&&String(x.r.day_id||'')===selectedDay)||list[0]||null;if(selected){state.selected=`${selected.p.id}|${selected.r.day_id||''}`;renderDetail(selected.p,selected.r.day_id||'')}else renderDetail(null,'');renderPodiums()
 }
 function renderDetail(p,dayId=''){const box=$('#detail');if(!p){box.innerHTML='<p>Nessun binomio selezionato nei risultati di questa prova.</p>';return}const e=entry(state.event,p.id),res=publishedRows(state.event).filter(r=>r.pair_id===p.id&&(!dayId||String(r.day_id||'')===String(dayId))).sort((a,b)=>String(a.day_id||'').localeCompare(String(b.day_id||''))||stages.indexOf(a.stage)-stages.indexOf(b.stage));box.innerHTML=`<h3>${esc(ATStore.handlerName(p))} + ${esc(p.dog)}</h3><p>${esc(p.team_name||'')}</p><div class="detail-row"><dt>TPS evento</dt><dd>${tpsLabel(e?.tps||p.current_tps)} · ${e?.tps_status||p.tps_status}</dd></div><div class="detail-row"><dt>Partenza</dt><dd>${e?.start_stage||'—'}</dd></div>${res.map(r=>`<div class="detail-row"><dt>${raceLabel(state.event,r.day_id)} · ${esc(r.stage)}</dt><dd>${fmt(r.time_cs,r.time_s)} · ${esc(r.state)} · pen. prova ${r.stage_penalties??0} / gara ${r.event_penalties??r.series_penalties??0}${r.stage==='SPEED'&&r.tps_limit_cs?' · limite '+fmt(r.tps_limit_cs,r.tps_limit_s):''}</dd></div>`).join('')||'<p class="tiny-muted">Nessun risultato pubblicato.</p>'}`}
 function renderPodiums(){
   const box=$('#podiums');box.innerHTML='';const all=rows(),days=[...new Set(all.map(x=>String(x.r.day_id||'')))];
   (days.length?days:['']).forEach(did=>[1,2,3].forEach(tps=>{
     const list=all.filter(x=>String(x.r.day_id||'')===did&&Number(x.r.tps||x.e?.tps||x.p.current_tps)===tps&&x.r.ranking_validation==='VALIDATED'&&x.r.position).sort((a,b)=>a.r.position-b.r.position||String(a.p.id).localeCompare(String(b.p.id))).filter(x=>Number(x.r.position)<=3);
     if(!list.length)return;const label=did?`${raceLabel(state.event,did)} · `:'';box.insertAdjacentHTML('beforeend',`<div class="podium"><h3>${label}TPS${tps}</h3><ol>${list.map(x=>`<li><strong>${esc(ATStore.handlerName(x.p))} + ${esc(x.p.dog)}</strong> · ${fmt(x.r.time_cs,x.r.time_s)} · pen. gara ${x.r.event_penalties??x.r.series_penalties??0}</li>`).join('')}</ol></div>`)
   }));
   if(state.stage==='SPEED'){
     const winners=(window.ATPublication?window.ATPublication.publishedEventWinners(DATA,state.event,state.day):[]).filter(w=>w.pair_id&&(!state.tps||Number(w.tps)===state.tps)).sort((a,b)=>String(a.day_id||'').localeCompare(String(b.day_id||''))||Number(a.tps)-Number(b.tps));
     if(winners.length){const items=winners.map(w=>{const p=pair(w.pair_id);return `<li><strong>${raceLabel(state.event,w.day_id)} · TPS${esc(w.tps)}: ${esc(ATStore.handlerName(p))} + ${esc(p.dog)}</strong> · ${fmt(w.time_cs,w.time_s)} · 12 punti se evento ufficiale</li>`}).join('');box.insertAdjacentHTML('beforeend',`<div class="podium"><h3>Vincitori Aqua Trail</h3><ol>${items}</ol></div>`)}
   }
 }
 renderArchives();
 const sel=$('#eventSelect');published.forEach(e=>sel.add(new Option(e.name,e.id)));sel.value=state.event;configureDayFilter();sel.onchange=()=>{state.event=sel.value;state.day='';state.selected=null;configureDayFilter();render()};
 const daySel=$('#daySelect');if(daySel)daySel.onchange=()=>{state.day=daySel.value;state.selected=null;render()};
 $('#search').oninput=e=>{state.search=ATStore.norm(e.target.value);render()};
 document.querySelectorAll('[data-tps]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tps]').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.tps=Number(b.dataset.tps);render()});
 document.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-stage]').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.stage=b.dataset.stage;state.selected=null;render()});
 render();
});
