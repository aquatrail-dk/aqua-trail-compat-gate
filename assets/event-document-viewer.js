ATApp.onReady(async()=>{
  const $=s=>document.querySelector(s),P=ATStore.public();
  const eventId=ATStore.qs('event')||'',rawType=(ATStore.qs('type')||'program').toLowerCase(),dayId=ATStore.qs('day')||'';
  const e=(P.events||[]).find(x=>x.id===eventId),day=(P.event_days||[]).find(x=>x.event_id===eventId&&x.id===dayId);
  const isDay=rawType==='dayprogram',type=isDay?`DAY_PROGRAM_${String(dayId).replace(/[^A-Za-z0-9_-]/g,'_')}`:(rawType==='menu'?'MENU':'PROGRAM');
  const meta=isDay?day?.program_pdf:e?.[type==='PROGRAM'?'program_pdf':'menu_pdf'];
  const title=isDay?`Programma · ${day?.label||'Giornata'}`:(type==='PROGRAM'?'Programma completo':'Menu / Cosa ordinare');
  document.title=`${title} · ${e?.name||'Aqua Trail'}`;
  $('#docTitle').textContent=title;
  $('#docEventName').textContent=e?`${e.name} · ${isDay&&day?.date?ATStore.fmtDate(day.date):ATStore.fmtDate(e.start_date)}`:'Evento non disponibile';
  const back=()=>{if(history.length>1)history.back();else location.href=`evento.html?event=${encodeURIComponent(eventId)}`};
  $('#docBackTop').onclick=back;$('#docBackBottom').onclick=back;
  if(!e||!meta){$('#docLoading').classList.add('hidden');$('#docError').textContent='Questo documento non è disponibile per l’evento selezionato.';$('#docError').classList.remove('hidden');return}
  try{
    if(meta.storage==='PRIVATE_DRIVE'){const localUrl=await ATMedia.loadPrivateMedia(meta);const frame=$('#pdfFrame'),dl=$('#docDownload');frame.src=localUrl;frame.classList.remove('hidden');$('#docLoading').classList.add('hidden');dl.disabled=false;dl.onclick=()=>{const a=document.createElement('a');a.href=localUrl;a.download=meta.name||'programma.pdf';document.body.append(a);a.click();a.remove()};return;}
    const remoteUrl=ATMedia.url(meta,'');
    const frame=$('#pdfFrame'),dl=$('#docDownload');
    if(remoteUrl&&!ATMedia.isInline(meta)&&!['INDEXEDDB','LOCALSTORAGE'].includes(ATMedia.normalize(meta)?.storage||'')){
      frame.src=remoteUrl;frame.classList.remove('hidden');$('#docLoading').classList.add('hidden');dl.disabled=false;
      dl.onclick=()=>{const a=document.createElement('a');a.href=remoteUrl;a.target='_blank';a.rel='noopener';a.download=meta.name||`${String(type).toLowerCase()}.pdf`;document.body.append(a);a.click();a.remove()};
      return;
    }
    const rec=await ATEventDocs.load(eventId,type);
    if(!rec?.blob)throw new Error('Il PDF risulta associato all’evento ma non è disponibile in questo browser. Nella versione cloud verrà recuperato da Google Drive.');
    const localUrl=URL.createObjectURL(rec.blob);
    frame.src=localUrl;frame.classList.remove('hidden');$('#docLoading').classList.add('hidden');dl.disabled=false;
    dl.onclick=()=>{const a=document.createElement('a');a.href=localUrl;a.download=meta.name||rec.name||`${String(type).toLowerCase()}.pdf`;document.body.append(a);a.click();a.remove()};
    window.addEventListener('beforeunload',()=>URL.revokeObjectURL(localUrl),{once:true});
  }catch(err){$('#docLoading').classList.add('hidden');$('#docError').textContent=err?.message||'Impossibile aprire il PDF.';$('#docError').classList.remove('hidden')}
});
