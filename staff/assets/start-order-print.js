ATApp.onReady(()=>{
  const $=s=>document.querySelector(s),P=ATStore.public(),A=ATStore.admin();
  const q=new URLSearchParams(location.search),eventId=q.get('event')||'',dayId=q.get('day')||'',stage=q.get('stage')||'OPEN';
  if(!eventId||!ATStore.canAccessEvent(eventId,P)){document.body.innerHTML='<div class="notice no" style="max-width:760px;margin:40px auto">ACCESSO NEGATO: evento non disponibile per questa sessione.</div>';return;}
  ATStore.assertEventAccess(eventId,P);
  const ev=(P.events||[]).find(e=>e.id===eventId),day=(P.event_days||[]).find(d=>d.id===dayId&&d.event_id===eventId),o=(A.start_orders||[]).find(x=>x.event_id===eventId&&x.day_id===dayId&&x.stage===stage);
  if(!ev||!day||!o?.generated_at){document.body.innerHTML='<div class="notice info" style="max-width:760px;margin:40px auto">Bisogna prima creare l’ordine di partenza.</div>';return;}
  const judge=(P.judges||[]).find(j=>j.id===ev.judge_id),reg=id=>(A.registrations||[]).find(r=>r.event_id===eventId&&r.pair_id===id),pair=id=>(P.pairs||[]).find(p=>p.id===id)||{id,dog:id};
  const generated=new Date(o.generated_at).toLocaleString('it-IT');
  $('#printMeta').innerHTML=[['Evento',ev.name||eventId],['Data / giornata',`${ATStore.fmtDate(day.date)} · ${day.label||''}`],['Luogo',ev.location||ev.address||'—'],['Prova',stage],['Giudice',judge?.name||'—'],['Versione ordine',String(o.version||1)],['Generato',generated],['N. binomi',String((o.current_order||[]).length)]].map(([k,v])=>`<div><b>${k}</b><span>${v}</span></div>`).join('');
  $('#printRows').innerHTML=(o.current_order||[]).map((id,i)=>{const p=pair(id),r=reg(id),prov=ATStore.pairProvenance(id,eventId,P,A);return `<tr><td>${i+1}</td><td><strong>${p.team_name||p.id||id}</strong></td><td>${ATStore.handlerName(p)||'—'} + ${p.dog||'—'}</td><td>${prov.center_name}</td><td>${Number(r?.tps||p.current_tps||0)?'TPS'+Number(r?.tps||p.current_tps):'DA ASSEGNARE'}</td></tr>`}).join('');
  $('#printFooterVersion').textContent=`${window.AQUATRAIL_BUILD?.label||'Aqua Trail'} · ordine ${o.version||1} · ${generated}`;
});
