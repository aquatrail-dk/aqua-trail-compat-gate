ATApp.onReady(()=>{
  const P=ATStore.public(),requestedId=ATStore.qs('event'),id=requestedId||P.events?.[0]?.id,e=requestedId?(P.events||[]).find(x=>x.id===requestedId):P.events?.[0];
  if(!e)return;
  const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const eventState=String(e.status||(e.published?'PUBBLICATO':'BOZZA')).toUpperCase(),stateBlocksTimer=['SOSPESO','RIMANDATO'].includes(eventState);
  const startAt=()=>e.start_date?new Date(e.start_date+'T'+(e.start_time||'00:00')+':00'):null;
  const endAt=()=>{const d=e.end_date||e.start_date;return d?new Date(d+'T23:59:59'):null};
  let timer=null;
  function finishCountdown(box){box.classList.add('finished');box.classList.remove('running');$('#countdownState').textContent='EVENTO CONCLUSO';['#cdDays','#cdHours','#cdMinutes','#cdSeconds'].forEach(x=>$(x).textContent='00');if(timer){clearInterval(timer);timer=null}}
  function tick(){
    const start=startAt(),end=endAt(),now=new Date(),box=$('#eventCountdown');
    if(!box||!start||Number.isNaN(+start))return;
    if(eventState==='CONCLUSO'||(end&&!Number.isNaN(+end)&&now>end)){finishCountdown(box);return}
    const diff=start-now;
    if(diff>0){const s=Math.floor(diff/1000),days=Math.floor(s/86400),hours=Math.floor((s%86400)/3600),mins=Math.floor((s%3600)/60),secs=s%60;$('#cdDays').textContent=String(days).padStart(2,'0');$('#cdHours').textContent=String(hours).padStart(2,'0');$('#cdMinutes').textContent=String(mins).padStart(2,'0');$('#cdSeconds').textContent=String(secs).padStart(2,'0');$('#countdownState').textContent='Preparati: il conto alla rovescia è iniziato.';box.classList.remove('running','finished');}
    else if(end&&now<=end){box.classList.add('running');box.classList.remove('finished');$('#countdownState').textContent='● EVENTO IN CORSO';['#cdDays','#cdHours','#cdMinutes','#cdSeconds'].forEach(x=>$(x).textContent='00');}
    else finishCountdown(box);
  }
  if(stateBlocksTimer){const box=$('#eventCountdown');if(box)box.style.display='none'}else if(startAt()){timer=setInterval(tick,1000);tick()}else{const box=$('#eventCountdown');if(box)box.style.display='none'}
  const cta=$('#registrationCta');
  if(cta){
    const runtime=window.AQUATRAIL_RUNTIME||{},onlinePrereg=runtime.preregistration_enabled!==false,today=ATStore.today(),open=!e.prereg_open_date||today>=e.prereg_open_date,notClosed=!e.prereg_close_date||today<=e.prereg_close_date,past=ATStore.isPastEvent(e);
    if(eventState==='SOSPESO')cta.innerHTML='<div class="notice warn"><strong>MOMENTANEAMENTE SOSPESO</strong><br>Nuove preregistrazioni temporaneamente disabilitate.</div>';
    else if(eventState==='RIMANDATO')cta.innerHTML='<div class="notice warn"><strong>EVENTO RIMANDATO</strong><br>Nuove preregistrazioni sospese fino alla conferma della nuova data.</div>';
    else if(eventState==='CONCLUSO'||past)cta.innerHTML='<div class="notice info"><strong>EVENTO CONCLUSO</strong><br>Le preregistrazioni non sono più disponibili.</div>';
    else if(e.prereg_enabled&&!onlinePrereg)cta.innerHTML='<div class="notice info"><strong>Preregistrazioni online in fase di attivazione</strong><br>La scheda evento è consultabile; il modulo online verrà abilitato quando il servizio server sarà collegato.</div>';
    else if(e.prereg_enabled&&open&&notClosed)cta.innerHTML=`<a class="btn btn-primary prereg-main-btn" href="preregistrazione.html?event=${encodeURIComponent(e.id)}">🐾 ISCRIVITI</a><p>${esc(e.prereg_note||'Compila la preregistrazione per velocizzare il check-in. La partecipazione sarà confermata solo dopo i controlli dello staff.')}</p>`;
    else if(e.prereg_enabled){const state=open?'chiuse':'non ancora aperte';cta.innerHTML=`<div class="notice info"><strong>Preregistrazioni non disponibili · ${state}</strong><br>${e.prereg_open_date?`Apertura: ${ATStore.fmtDate(e.prereg_open_date)}. `:''}${e.prereg_close_date?`Chiusura: ${ATStore.fmtDate(e.prereg_close_date)}.`:''}</div>`}
    else cta.innerHTML='';
  }
  const host=$('#eventLiveNews'),badge=$('#newsLiveBadge');
  if(host){
    const nowNews=Date.now(),all=(P.event_news||[]).filter(n=>n.event_id===e.id&&n.active!==false&&(!n.published_at||+new Date(n.published_at)<=nowNews)).sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||String(b.published_at).localeCompare(String(a.published_at)));
    if(!all.length){host.innerHTML='<div class="notice info">Nessun aggiornamento pubblicato per questo evento.</div>';if(badge)badge.style.display='none';return}
    const cls=c=>({'AVVISO IMPORTANTE':'critical','ORGANIZZAZIONE':'organization','ORDINE DI PARTENZA':'order','HAPPY-TIME':'happy','REGOLAMENTO':'rules','INFO UTILI':'info','POST EVENTO':'post'}[c]||'info');
    host.innerHTML=all.map(n=>`<article class="live-news-item ${cls(n.category)} ${n.pinned?'pinned':''}"><div class="live-news-meta"><span>${n.published_at?new Date(n.published_at).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'}):'—'}</span><span class="news-category">${esc(n.category||'INFO')}</span></div><h4>${esc(n.title)}</h4><p>${esc(n.body)}</p><small>${esc(n.author_label||n.author_role||'Staff')}${n.updated_at&&n.updated_at!==n.published_at?' · aggiornato '+new Date(n.updated_at).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'}):''}</small></article>`).join('');
  }
});