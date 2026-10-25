(function(){
  'use strict';
  const cfg=()=>window.AQUATRAIL_RUNTIME||{};
  const online=()=>String(cfg().mode||'').toUpperCase().startsWith('ONLINE');
  if(!online())return;
  const deferredMsg='Funzione non attiva nella prima versione online. Usa la procedura manuale prevista; integrazione web in preparazione.';
  const raceMsg='I comandi di registrazione gara restano bloccati nello staging finché il binding completo non sarà pubblicato. L’assegnazione dell’operatore ufficiale usa già il comando server-autorevole.';
  const superadminMsg='Questa azione Superadmin è bloccata nello staging online perché non dispone ancora di un comando server-autorevole e auditato. Nessun dato viene salvato localmente.';
  const show=(msg=deferredMsg)=>{let b=document.querySelector('#webConformanceNotice');if(!b){b=document.createElement('div');b.id='webConformanceNotice';b.className='notice info';b.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:100000;max-width:900px;margin:auto;box-shadow:0 8px 30px rgba(0,0,0,.22)';document.body.appendChild(b)}b.innerHTML=`<strong>WEB CONFORMANCE 1.8.5</strong><br>${msg}`;clearTimeout(show.t);show.t=setTimeout(()=>b.remove(),6500)};
  const deferredInputs=['#posterFile','#programPdfFile','#menuPdfFile','#menuImageFile','#wPoster','#wProgramImage','#wMenuImage','.wDayProgramPdf','#pairPhotoFile','#jPhoto','#jDocs','#cPhoto','#cContract','#gFiles'];
  const raceSelectors=['#saveData','#addPenalty','#recallBtn','#technicalRecallBtn','#correctTime','#undoPenalty','#undoRecall','#clockStart','#clockPause','#clockFinish','#judgePenalty','#judgeRecallFull','#judgeRecallTech','#judgeApplyStatus','#judgeUndoPenalty','#judgeUndoRecall','#judgeCorrectTime'];
  const superadminSelectors=['#saSaveRecoveryEmail','#saFieldApply','#saExportPublic','#saExportAdmin','#saExportFull','#changeEventState','#deleteEvent','#savePin'];
  const defer=(el,kind,msg)=>{if(!el)return;el.disabled=true;el.dataset.webDeferred=kind;el.title=msg;};
  function warnRace(){if(document.querySelector('#raceAuthoritativeNotice'))return;const host=document.querySelector('main');if(!host)return;const n=document.createElement('div');n.id='raceAuthoritativeNotice';n.className='notice warn';n.style.cssText='margin:12px auto;max-width:1120px';n.innerHTML='<strong>RACE CONTROL ONLINE BLOCCATO IN SICUREZZA.</strong> L’assegnazione dell’operatore ufficiale è già server-autorevole; tempi, penalità e Recall saranno riattivati solo dopo il binding completo e i test multi-dispositivo.';host.prepend(n);}
  function apply(){
    document.querySelectorAll('a[href="importa-dati.html"]').forEach(a=>{a.href='#';a.dataset.webDeferred='import';a.title='Import/Backup non disponibile nella prima online';});
    for(const sel of deferredInputs)document.querySelectorAll(sel).forEach(el=>{el.disabled=true;el.title='Upload browser disabilitato nella prima online';});
    const force=document.querySelector('#saForceApply');if(force){const panel=force.closest('.panel');if(panel)panel.style.display='none';}
    const gallery=document.querySelector('#uploadGallery');if(gallery){gallery.disabled=false;gallery.dataset.webDeferred='gallery-upload';gallery.textContent='UPLOAD — WORKING IN PROGRESS';}
    ['savePoster','pairPhotoChoose'].forEach(id=>{const b=document.getElementById(id);if(b)b.dataset.webDeferred='upload';});
    raceSelectors.forEach(sel=>document.querySelectorAll(sel).forEach(el=>defer(el,'race-control',raceMsg)));
    if(raceSelectors.some(sel=>document.querySelector(sel)))warnRace();
    superadminSelectors.forEach(sel=>document.querySelectorAll(sel).forEach(el=>defer(el,'superadmin-server-required',superadminMsg)));
  }
  document.addEventListener('click',e=>{
    const deferred=e.target.closest?.('[data-web-deferred]');
    const sensitive=e.target.closest?.('[data-act="pin"],[data-act="puk"],[data-event-act="pin"],[data-event-act="puk"],[data-restore]');
    if(sensitive){e.preventDefault();e.stopImmediatePropagation();show(superadminMsg);return;}
    if(!deferred)return;
    e.preventDefault();e.stopImmediatePropagation();
    show(deferred.dataset.webDeferred==='race-control'?raceMsg:deferred.dataset.webDeferred==='superadmin-server-required'?superadminMsg:deferredMsg);
  },true);
  const writeBar=()=>{let b=document.querySelector('#webWriteState');if(!b){b=document.createElement('div');b.id='webWriteState';b.className='notice info hidden';b.style.cssText='position:fixed;right:12px;bottom:12px;z-index:99999;min-width:220px';document.body.appendChild(b)}return b};
  window.addEventListener('aquatrail:write-pending',()=>{const b=writeBar();b.className='notice info';b.textContent='Salvataggio online…';});
  window.addEventListener('aquatrail:write-committed',()=>{const b=writeBar();b.className='notice ok';b.textContent='Salvato online';setTimeout(()=>b.classList.add('hidden'),1800);});
  window.addEventListener('aquatrail:write-error',e=>{const b=writeBar();b.className='notice warn';b.textContent='ERRORE SALVATAGGIO: '+String(e.detail?.error?.message||'operazione non confermata dal server');});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  window.ATWebConformance={VERSION:'1.8.5',showDeferred:show,apply};
})();
