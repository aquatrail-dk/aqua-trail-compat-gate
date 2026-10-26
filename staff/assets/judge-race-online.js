ATApp.onReady(()=>{
  if(!window.ATDataAPI?.isOnline?.())return;
  const $=id=>document.getElementById(id),bridge=window.ATRaceOnline;
  const controls=['clockStart','clockPause','clockFinish','judgePenalty','judgeRecallFull','judgeRecallTech','judgeApplyStatus'];
  let eventId=ATStore.qs('event')||'',dayId=ATStore.qs('day')||'',stage=ATStore.qs('stage')||'OPEN',pairId='',busy=false;
  const data=()=>bridge.data(),list=v=>Array.isArray(v)?v:[];
  const message=(text,warning=false)=>{const box=$('judgeMsg');box.className='notice '+(warning?'warn':'info');box.textContent=text};
  const fmt=ms=>ATTime.formatCs(Math.round(Math.max(0,ms)/10));
  const context=()=>bridge.scope(eventId,dayId,stage,pairId);
  function selectedRun(s){return bridge.existingRun(s)}
  function timer(s){const id=selectedRun(s)?.id;return id?data().admin.timer_states_server?.[id]||null:null}
  function elapsed(t){return Math.max(0,Number(t?.elapsed_ms||0)+(t?.running&&t.started_at_ms?Date.now()-Number(t.started_at_ms):0))}
  function pairIds(){if(!eventId||!dayId||!stage)return[];return bridge.orderedPairs(bridge.scope(eventId,dayId,stage,''))}
  function render(){
    const ids=pairIds();if(!ids.includes(pairId))pairId=ids[0]||'';
    const s=pairId?context():null,admin=data().admin,pub=data().public,run=s?selectedRun(s):null,owner=s?bridge.assignment(s):null,session=data().session;
    const writable=!!s&&!!owner&&String(owner.operator_user_id)===String(session?.user_id)&&String(owner.time_kind||owner.mode).toUpperCase()==='LIVE'&&!!bridge.thresholds(s);
    const banner=$('judgeOperatorBanner');banner.className='notice '+(writable?'info':'warn');banner.textContent=writable?`OPERATORE UFFICIALE: ${owner.username} · LIVE`:'SOLA LETTURA: assegna un GIUDICE in modalità LIVE, configura i TPS e genera l’ordine di partenza.';
    const pair=list(pub.pairs).find(p=>p.id===pairId)||{};
    $('judgePair').textContent=pairId?`${pair.team_name||'—'} · ${ATStore.handlerName(pair)} + ${pair.dog||''}`:'Nessun binomio nell’ordine di partenza';
    $('judgeMeta').textContent=pairId?`${stage} · ${dayId}`:'Ordine non pronto';
    const events=s?list(admin.race_events).filter(e=>e.event_id===s.event_id&&e.competition_id===s.competition_id&&e.pair_id===s.pair_id):[];
    const penalties=events.filter(e=>e.type==='PENALTY'),stagePens=penalties.filter(e=>e.stage===stage),recall=events.find(e=>['RECALL_FULL','RECALL_TECHNICAL'].includes(e.type));
    $('judgePenalties').textContent=`${penalties.length} / 3 · prova ${stagePens.length}`;
    $('judgeRecall').textContent=recall?`USATO · ${recall.type}`:penalties.length===3?'DISPONIBILE ORA':'Disponibile dopo 3 penalità';
    $('judgePenaltyHistory').textContent=stagePens.map((e,i)=>`${i+1}ª ${e.penalty_cs==null||e.penalty_cs===''?'—':ATTime.formatCs(Number(e.penalty_cs))}`).join(' · ')||'—';
    $('judgeBonus').textContent=ATTime.formatCs(list(pub.results).filter(r=>r.event_id===eventId&&r.competition_id===s?.competition_id&&r.pair_id===pairId&&r.stage!=='SPEED').reduce((n,r)=>n+Number(r.bonus_cs||0),0));
    const reg=list(admin.registrations).find(r=>r.event_id===eventId&&r.pair_id===pairId),tps=Number(reg?.tps||pair.current_tps||0),thresholds=s?bridge.thresholds(s):null;
    $('judgeMax').textContent=thresholds&&tps>0?ATTime.formatCs(thresholds[tps-1]):'—';
    const completed=run?.completed===true||String(run?.completed).toUpperCase()==='TRUE';$('judgeDone').textContent=completed?'✓ GIÀ GAREGGIATO':'DA GAREGGIARE';$('judgeDone').className='badge '+(completed?'ok':'warn');
    const t=s?timer(s):null;$('judgeClock').textContent=fmt(elapsed(t));
    controls.forEach(id=>{$(id).disabled=busy||!writable});
    $('clockStart').disabled=busy||!writable||completed||!!t?.running;
    $('clockPause').disabled=busy||!writable||!t?.running;
    $('clockFinish').disabled=busy||!writable||completed||!t?.running;
    $('judgePenalty').disabled=busy||!writable||['ELIMINATO','ELIMINATO DEFINITIVO','SQUALIFICATO'].includes(run?.status);
    $('judgeApplyStatus').disabled=busy||!writable||completed;
    $('judgeRecallFull').disabled=busy||!writable||penalties.length!==3||!!recall;
    $('judgeRecallTech').disabled=busy||!writable||penalties.length!==3||!!recall;
    $('judgePrev').disabled=busy||ids.indexOf(pairId)<=0;$('judgeNext').disabled=busy||ids.indexOf(pairId)>=ids.length-1;
  }
  async function act(fn){if(busy||!pairId)return;const s=context();busy=true;render();message('Comando in corso: attendo il server…');try{await fn(s);message('Registrato e verificato sul server.')}catch(e){message(e.message||'Operazione non confermata dal server.',true)}finally{busy=false;render()}}
  function reason(label){const value=prompt(label+' · indica la motivazione ufficiale:');return value===null?null:value.trim()}
  $('clockStart').onclick=()=>act(s=>bridge.execute(s,'timer_start'));
  $('clockPause').onclick=()=>act(s=>bridge.execute(s,'timer_pause'));
  $('clockFinish').onclick=()=>act(async s=>{await bridge.execute(s,'timer_pause');const t=timer(s),time_cs=Math.round(Number(t?.elapsed_ms||0)/10);if(time_cs<=0)throw new Error('Tempo server non disponibile: nessun risultato salvato.');await bridge.execute(s,'record_time',{time_cs,status:'SUPERATO',time_kind:'OFFICIAL'})});
  $('judgePenalty').onclick=()=>{const why=reason('Penalità');if(why!==null)act(async s=>{const t=timer(s),at=Math.round(elapsed(t)/10);await bridge.execute(s,'apply_penalty',{reason:why,penalty_at_cs:at});const count=list(data().admin.race_events).filter(e=>e.event_id===s.event_id&&e.competition_id===s.competition_id&&e.pair_id===s.pair_id&&e.type==='PENALTY').length;if(count===3&&timer(s)?.running){try{await bridge.execute(s,'timer_pause')}catch(e){throw new Error('Penalità confermata sul server; pausa timer non confermata: '+e.message)}}})};
  $('judgeRecallFull').onclick=()=>{const why=reason('Recall completo');if(why!==null)act(s=>bridge.execute(s,'recall',{reason:why,recall_type:'FULL'}))};
  $('judgeRecallTech').onclick=()=>{const why=reason('Recall tecnico');if(why!==null)act(async s=>{if(timer(s)?.running)await bridge.execute(s,'timer_pause');await bridge.execute(s,'recall',{reason:why,recall_type:'TECHNICAL'})})};
  $('judgeApplyStatus').onclick=()=>{const status=$('judgeManualStatus').value;if(!confirm(`Confermare lo stato ${status}?`))return;act(s=>bridge.execute(s,'record_time',{status}))};
  for(const id of ['judgeUndoPenalty','judgeUndoRecall','judgeUndoPause','judgeCorrectTime','judgeSavePreflightConfig']){$(id).disabled=true;$(id).title='Correzione/configurazione online non disponibile senza comando server sicuro.'}
  $('judgePreflightConfig').innerHTML='<div class="notice info">Tempi TPS e costi Recall sono configurati nel pannello gara ADMIN prima dell’inizio della prova.</div>';
  function options(select,items,label){select.innerHTML='';items.forEach(item=>select.add(new Option(label(item),item.id)))}
  function loadEvents(){const events=list(data().public.events);options($('judgeEvent'),events,e=>`${e.name} · ${e.start_date||''}`);if(!events.some(e=>e.id===eventId))eventId=events[0]?.id||'';$('judgeEvent').value=eventId;loadDays()}
  function loadDays(){const days=list(data().public.event_days).filter(d=>d.event_id===eventId);options($('judgeDay'),days,d=>`${d.label||d.id} · ${d.date||''}`);if(!days.some(d=>d.id===dayId))dayId=days[0]?.id||'';$('judgeDay').value=dayId;loadStages()}
  function loadStages(){const day=list(data().public.event_days).find(d=>d.id===dayId),stages=list(bridge.json(day?.stages_json,day?.stages||[]));$('judgeStage').innerHTML='';stages.forEach(st=>$('judgeStage').add(new Option(st,st)));if(!stages.includes(stage))stage=stages[0]||'';$('judgeStage').value=stage;pairId='';render()}
  for(const id of controls){delete $(id).dataset.webDeferred;$(id).title='';$(id).disabled=true}
  const notice=$('raceAuthoritativeNotice');if(notice)notice.textContent='Race Control online: comandi ufficiali collegati al server. Le correzioni senza comando sicuro restano bloccate.';
  $('judgeEvent').onchange=()=>{eventId=$('judgeEvent').value;dayId='';loadDays()};$('judgeDay').onchange=()=>{dayId=$('judgeDay').value;loadStages()};$('judgeStage').onchange=()=>{stage=$('judgeStage').value;pairId='';render()};
  $('judgePrev').onclick=()=>{const ids=pairIds();pairId=ids[ids.indexOf(pairId)-1];render()};$('judgeNext').onclick=()=>{const ids=pairIds();pairId=ids[ids.indexOf(pairId)+1];render()};
  setInterval(()=>{if(pairId&&!busy){const t=timer(context());$('judgeClock').textContent=fmt(elapsed(t))}},100);
  loadEvents();
});
