ATApp.onReady(()=>{
  if(!window.ATDataAPI?.isOnline?.())return;
  const $=id=>document.getElementById(id),bridge=window.ATRaceOnline,rows=x=>Array.isArray(x)?x:[],truth=x=>x===true||String(x).toUpperCase()==='TRUE';
  let eventId=ATStore.qs('event')||'',dayId=ATStore.qs('day')||'',stage=ATStore.qs('stage')||'OPEN',pairId='',busy=false;
  const ids=['saveData','addPenalty','recallBtn','technicalRecallBtn','publishResults'];
  const info=(msg,warn=false)=>{const el=$('raceWarning');el.className='notice '+(warn?'warn':'info');el.textContent=msg};
  const pair=()=>rows(bridge.data().public.pairs).find(p=>String(p.id)===pairId)||{};
  const scope=()=>bridge.scope(eventId,dayId,stage,pairId);
  const order=()=>pairId?bridge.orderedPairs(scope()):[];
  const run=()=>pairId?bridge.existingRun(scope()):null;
  const history=()=>pairId?rows(bridge.data().admin.race_events).filter(e=>String(e.event_id)===eventId&&String(e.competition_id)===scope().competition_id&&String(e.pair_id)===pairId):[];
  const reg=()=>rows(bridge.data().admin.registrations).find(r=>String(r.event_id)===eventId&&String(r.pair_id)===pairId)||{};
  const snapshot=()=>rows(bridge.data().public.published_race_snapshots).find(x=>String(x.event_id)===eventId&&String(x.day_id)===dayId&&String(x.stage)===stage&&String(x.tps_label)==='TPS'+$('raceTpsFilter').value);
  function render(){
    const s=pairId?scope():null,assigned=s?bridge.assignment(s):null,session=bridge.data().session,writer=!!assigned&&String(assigned.operator_user_id)===String(session?.user_id)&&String(assigned.mode).toUpperCase()==='MANUAL'&&!!bridge.thresholds(s)&&ATDataAPI.workspaceConfig().mode==='DEMO';
    $('raceOperatorBanner').textContent=writer?`OPERATORE UFFICIALE: ${assigned.username} · DATA ENTRY MANUALE`:'SOLA LETTURA: assegna un operatore MANUAL, configura i TPS e genera l’ordine di partenza.';
    $('raceOperatorBanner').className='notice '+(writer?'info':'warn')+' section-spacer';
    const p=pair(),r=run(),events=history(),penalties=events.filter(e=>e.type==='PENALTY'),stagePens=penalties.filter(e=>e.stage===stage),recall=events.find(e=>e.type==='RECALL_FULL'||e.type==='RECALL_TECHNICAL'),thresholds=s?bridge.thresholds(s):null,tps=Number(reg().tps||p.current_tps||0);
    $('racePair').textContent=pairId?`${p.team_name||'—'} · ${ATStore.handlerName(p)} + ${p.dog||''}`:'Nessun binomio nell’ordine di partenza';
    $('raceStage').textContent=stage;$('raceTps').textContent=tps?'TPS'+tps:'TPS DA ASSEGNARE';
    $('raceMax').textContent=thresholds&&tps?ATTime.formatCs(thresholds[tps-1]):'—';
    $('raceBonus').textContent=ATTime.formatCs(rows(bridge.data().public.results).filter(x=>String(x.event_id)===eventId&&String(x.competition_id)===s?.competition_id&&String(x.pair_id)===pairId&&x.stage!=='SPEED').reduce((n,x)=>n+Number(x.bonus_cs||0),0));
    $('racePenalties').textContent=`${penalties.length} / 3 · prova ${stagePens.length}`;
    $('raceRecall').textContent=recall?'USATO · '+recall.type:penalties.length===3?'DISPONIBILE ORA':'Disponibile dopo 3 penalità';
    $('raceTime').value=r?.time_cs==null||r.time_cs===''?'':ATTime.formatCs(Number(r.time_cs));
    $('raceStatus').value=r?.status&&[...$('raceStatus').options].some(o=>o.value===r.status)?r.status:'IN GARA';
    $('raceDoneBadge').textContent=truth(r?.completed)?'✓ GIÀ GAREGGIATO':'DA GAREGGIARE';
    $('raceDoneBadge').className='badge '+(truth(r?.completed)?'ok':'warn');
    $('raceOrderInfo').textContent=s&&bridge.order(s)?'ORDINE SORTEGGIATO ATTIVO':'ORDINE NON GENERATO';
    ids.forEach(id=>{$(id).disabled=busy||!writer});
    $('saveData').disabled=busy||!writer||truth(r?.completed);
    const currentIds=[...$('racePairSelect').options].map(x=>x.value),runs=rows(bridge.data().admin.race_runs);
    const complete=!!currentIds.length&&currentIds.every(id=>runs.some(x=>String(x.event_id)===eventId&&String(x.day_id)===dayId&&String(x.stage)===stage&&String(x.pair_id)===id&&truth(x.completed)));
    $('publishResults').disabled=busy||!writer||!complete;
    $('addPenalty').disabled=busy||!writer||['ELIMINATO','ELIMINATO DEFINITIVO','SQUALIFICATO'].includes(r?.status);
    $('raceTime').disabled=busy||!writer;$('raceStatus').disabled=busy||!writer;
    const current=[...$('racePairSelect').options].map(x=>x.value),i=current.indexOf(pairId);$('prevPair').disabled=busy||i<=0;$('nextPair').disabled=busy||i<0||i>=current.length-1;
    $('publicationRecoveryPanel').classList.toggle('hidden',!complete&&!snapshot());
    $('publicationRecoveryTitle').textContent=snapshot()?'RISULTATI PUBBLICATI':'RISULTATI COMPLETI';
  }
  function loadPairs(){
    const all=dayId&&stage?bridge.orderedPairs(bridge.scope(eventId,dayId,stage,'')):[],tps=Number($('raceTpsFilter').value),admin=bridge.data().admin;
    const matches=all.filter(id=>{const r=rows(admin.registrations).find(x=>String(x.event_id)===eventId&&String(x.pair_id)===id),p=rows(bridge.data().public.pairs).find(x=>String(x.id)===id);return Number(r?.tps||p?.current_tps||0)===tps});
    if(!matches.length&&all.length){const first=rows(admin.registrations).find(x=>String(x.event_id)===eventId&&String(x.pair_id)===all[0]),firstPair=rows(bridge.data().public.pairs).find(x=>String(x.id)===all[0]);$('raceTpsFilter').value=String(first?.tps||firstPair?.current_tps||0);return loadPairs()}
    $('racePairSelect').replaceChildren(...matches.map(id=>new Option(id,id)));if(!matches.includes(pairId))pairId=matches[0]||'';$('racePairSelect').value=pairId;
    $('raceArea').classList.toggle('hidden',!all.length);render();
  }
  function stages(){const day=rows(bridge.data().public.event_days).find(d=>String(d.id)===dayId),values=rows(bridge.json(day?.stages_json,day?.stages||[]));$('raceStageSelect').replaceChildren(...values.map(x=>new Option(x,x)));if(!values.includes(stage))stage=values[0]||'';$('raceStageSelect').value=stage;$('preflightStage').replaceChildren(...values.map(x=>new Option(x,x)));loadPairs()}
  function days(){const list=rows(bridge.data().public.event_days).filter(x=>String(x.event_id)===eventId);$('raceDay').replaceChildren(...list.map(x=>new Option(x.label||x.id,x.id)));if(!list.some(x=>String(x.id)===dayId))dayId=list[0]?.id||'';$('raceDay').value=dayId;stages()}
  function events(){const list=rows(bridge.data().public.events);$('raceEvent').replaceChildren(...list.map(x=>new Option(x.name,x.id)));if(!list.some(x=>String(x.id)===eventId))eventId=list[0]?.id||'';$('raceEvent').value=eventId;days()}
  async function act(fn){if(busy||!pairId)return;const s=scope();busy=true;render();info('Comando in corso: attendo la conferma del server…');try{await fn(s);info('SALVATO · registrato e verificato sul server.')}catch(e){info(e.message||'Operazione non confermata.',true)}finally{busy=false;loadPairs()}}
  $('saveData').onclick=()=>{let status=$('raceStatus').value,raw=$('raceTime').value.trim(),time_cs;try{if(raw){time_cs=ATTime.parseStrict(raw);if(!Number.isInteger(time_cs)||time_cs<0)throw new Error('Tempo non valido. Usa MM:SS:CC.')}if(status==='IN GARA'&&raw)status='SUPERATO';if(status==='SUPERATO'&&!raw)throw new Error('Il tempo ufficiale è obbligatorio.');act(s=>bridge.execute(s,'record_time',{status,...(status==='SUPERATO'?{time_cs,time_kind:'MANUAL'}:{})}))}catch(e){info(e.message,true)}};
  $('addPenalty').onclick=()=>{const reason=prompt('Motivazione ufficiale della penalità:');if(reason!==null)act(s=>bridge.execute(s,'apply_penalty',{reason:reason.trim()}))};
  for(const [id,type] of [['recallBtn','FULL'],['technicalRecallBtn','TECHNICAL']])$(id).onclick=()=>{const reason=prompt('Motivazione ufficiale del Recall:');if(reason!==null)act(s=>bridge.execute(s,'recall',{reason:reason.trim(),recall_type:type}))};
  $('publishResults').onclick=()=>{if(!confirm('Pubblicare la classifica ufficiale di questo TPS sul sito?'))return;act(s=>bridge.publish(s,Number($('raceTpsFilter').value)))};
  $('openReviewState').onclick=()=>{const body=$('reviewBody');body.replaceChildren();[...$('racePairSelect').options].forEach((opt,i)=>{const p=rows(bridge.data().public.pairs).find(x=>String(x.id)===opt.value)||{},r=rows(bridge.data().admin.race_runs).find(x=>String(x.event_id)===eventId&&String(x.day_id)===dayId&&String(x.stage)===stage&&String(x.pair_id)===opt.value)||{},registration=rows(bridge.data().admin.registrations).find(x=>String(x.event_id)===eventId&&String(x.pair_id)===opt.value)||{},events=rows(bridge.data().admin.race_events).filter(e=>String(e.event_id)===eventId&&String(e.competition_id)===scope().competition_id&&String(e.pair_id)===opt.value),tr=body.insertRow();[i+1,`${ATStore.handlerName(p)} + ${p.dog||''}`,registration.tps||'',r.time_cs==null||r.time_cs===''?'—':ATTime.formatCs(Number(r.time_cs)),events.filter(e=>e.type==='PENALTY'&&e.stage===stage).length,events.filter(e=>e.type==='PENALTY').length,events.some(e=>e.type==='RECALL_FULL'||e.type==='RECALL_TECHNICAL')?'SI':'NO',r.status||'—'].forEach(value=>{tr.insertCell().textContent=String(value)})});$('reviewModal').classList.remove('hidden')};$('closeReview').onclick=()=>{$('reviewModal').classList.add('hidden')};
  $('prevPair').onclick=()=>{const a=[...$('racePairSelect').options].map(x=>x.value);pairId=a[a.indexOf(pairId)-1];loadPairs()};$('nextPair').onclick=()=>{const a=[...$('racePairSelect').options].map(x=>x.value);pairId=a[a.indexOf(pairId)+1];loadPairs()};$('racePairSelect').onchange=()=>{pairId=$('racePairSelect').value;render()};
  $('raceEvent').onchange=()=>{eventId=$('raceEvent').value;dayId='';days()};$('raceDay').onchange=()=>{dayId=$('raceDay').value;stages()};$('raceStageSelect').onchange=()=>{stage=$('raceStageSelect').value;pairId='';loadPairs()};$('raceTpsFilter').onchange=()=>{pairId='';loadPairs()};
  const deferred=['correctTime','undoPenalty','undoRecall','savePreflightConfig','confirmReady','runPreflight','printResults'];
  deferred.forEach(id=>{$(id).disabled=true;$(id).title='Operazione online non disponibile senza un comando server sicuro.'});
  $('preflightConfigEditor').textContent='I parametri TPS e l’ordine di partenza sono letti dal server. Le modifiche non supportate qui restano bloccate.';
  $('preflightStatus').value='DATI GARA SERVER';$('preflightFinal').classList.add('hidden');
  for(const id of ids){delete $(id).dataset.webDeferred;$(id).disabled=true;$(id).title=''}
  const notice=$('raceAuthoritativeNotice');if(notice)notice.textContent='Race Control online: tempo, stato, penalità, Recall e pubblicazione usano comandi ufficiali server. Le correzioni restano bloccate.';
  events();
});
