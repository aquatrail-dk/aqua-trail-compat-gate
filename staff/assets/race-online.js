(function(){
  'use strict';
  const api=()=>window.ATDataAPI;
  const data=()=>({public:api().publicData(),admin:api().adminData(),session:api().sessionData()});
  const rows=(v)=>Array.isArray(v)?v:[];
  const json=(v,fallback)=>{if(v&&typeof v==='object')return v;try{return JSON.parse(v)}catch(_){return fallback}};
  const same=(row,s)=>String(row.event_id)===s.event_id&&String(row.competition_id)===s.competition_id&&String(row.day_id)===s.day_id&&String(row.stage)===s.stage;
  let pending=false;
  async function runId(s){
    const input=new TextEncoder().encode(JSON.stringify([s.event_id,s.competition_id,s.day_id,s.stage,s.pair_id]));
    const digest=await crypto.subtle.digest('SHA-256',input);
    return 'AT-RC-RUN-'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('').slice(0,40);
  }
  function scope(event_id,day_id,stage,pair_id){
    const publicData=api().publicData(),day=rows(publicData.event_days).find(d=>String(d.id)===String(day_id));
    if(!day||String(day.event_id)!==String(event_id)||!rows(json(day.stages_json,day.stages||[])).includes(stage))throw new Error('Giornata o prova non presente nel bundle server.');
    return {event_id:String(event_id),competition_id:String(day.competition_id||ATRace.competitionId(publicData,event_id,day_id)),day_id:String(day_id),stage:String(stage),pair_id:String(pair_id)};
  }
  function assignment(s){return rows(data().admin.race_operator_assignments).find(row=>same(row,s))||null}
  function assertWriter(s){
    const {session}=data(),owner=assignment(s);
    if(!owner||!session||String(owner.operator_user_id)!==String(session.user_id))throw new Error('SOLA LETTURA: questa prova è assegnata a un altro operatore ufficiale.');
    if(api().workspaceConfig().mode!=='DEMO')throw new Error('Gara di staging disponibile solo nel workspace DEMO.');
    return owner;
  }
  function existingRun(s){return rows(data().admin.race_runs).find(row=>same(row,s)&&String(row.pair_id)===s.pair_id&&row.status!=='OPERATOR_ASSIGNMENT')||null}
  function order(s){return rows(data().admin.start_orders).find(row=>same(row,s))||null}
  function orderedPairs(s){return rows(json(order(s)?.current_order_json,json(order(s)?.current_order,[]))).map(String)}
  function stageConfig(s){const matches=rows(data().public.stage_config).filter(row=>String(row.event_id)===s.event_id&&String(row.stage)===s.stage);return matches.find(row=>String(row.day_id||'')===s.day_id)||matches.find(row=>String(row.competition_id||'')===s.competition_id)||matches.find(row=>!row.day_id&&!row.competition_id)||null}
  function thresholds(s){const cfg=stageConfig(s),times=json(cfg?.times_cs_json,cfg?.times_cs||{}),a=[1,2,3].map(n=>Number(times[String(n)]||0));return a[0]>0&&a[0]<a[1]&&a[1]<a[2]?a:null}
  async function refresh(s){await api().staffBootstrap({event_id:s?.event_id||'',day_id:s?.day_id||''});return data()}
  async function preparedRun(s){
    let run=existingRun(s);if(run)return run;
    const id=await runId(s),source=order(s);
    if(!source||!orderedPairs(s).includes(s.pair_id))throw new Error('Ordine di partenza server non pronto per questo binomio.');
    await api().command('race_control',{operation:'prepare_run',...s,run_id:id,source_order_id:source.id||''},{request_id:'AT-PREP-'+api().workspaceConfig().epoch+'-'+id});
    await refresh(s);run=existingRun(s);
    if(!run||String(run.id)!==id)throw new Error('Preparazione run non confermata dalla rilettura server.');
    return run;
  }
  async function execute(s,operation,fields={}){
    if(pending)throw new Error('Comando gara già in corso. Attendi la conferma server.');
    pending=true;
    try{
      await refresh(s);assertWriter(s);
      const run=await preparedRun(s),key='at-race-pending:'+JSON.stringify([api().workspaceConfig().epoch,run.id,operation]);
      const saved=sessionStorage.getItem(key),payload=JSON.stringify(fields);
      let claim=saved?json(saved,null):null;
      if(saved&&(!claim||claim.payload!==payload))throw new Error('Una richiesta precedente per questa operazione è ancora da verificare. Riprova con gli stessi dati o controlla il registro server.');
      if(!claim){claim={request_id:'AT-RC-'+crypto.randomUUID(),payload};sessionStorage.setItem(key,JSON.stringify(claim))}
      const request_id=claim.request_id;
      const seen=()=>rows(data().admin.race_events).some(row=>String(row.run_id)===String(run.id)&&json(row.details_json,{}).request_id===request_id);
      if(seen()){sessionStorage.removeItem(key);return {ok:true,replayed:true,run_id:run.id}}
      let result;
      try{result=await api().command('race_control',{operation,event_id:s.event_id,run_id:run.id,...fields},{request_id})}
      catch(e){if(!['AT_API_NETWORK','AT_API_HTTP','AT_API_BAD_JSON','COMMAND_IN_PROGRESS'].includes(e.code))sessionStorage.removeItem(key);throw e}
      await refresh(s);
      if(!seen())throw new Error('Comando accettato ma risultato non verificabile nel bundle server. Ricarica prima di riprovare.');
      sessionStorage.removeItem(key);
      return result;
    }finally{pending=false}
  }
  async function publish(s,tps){
    if(pending)throw new Error('Comando gara già in corso.');pending=true;
    try{
      await refresh(s);assertWriter(s);
      const key='at-race-publish:'+JSON.stringify([api().workspaceConfig().epoch,s.event_id,s.day_id,s.stage,tps]);
      let request_id=sessionStorage.getItem(key);
      if(!request_id){request_id='AT-RC-PUB-'+crypto.randomUUID();sessionStorage.setItem(key,request_id)}
      let result;
      try{result=await api().command('race_control',{operation:'publish_results',event_id:s.event_id,day_id:s.day_id,stage:s.stage,tps},{request_id})}
      catch(e){if(!['AT_API_NETWORK','AT_API_HTTP','AT_API_BAD_JSON','COMMAND_IN_PROGRESS'].includes(e.code))sessionStorage.removeItem(key);throw e}
      await refresh(s);
      if(!rows(data().admin.publication_history).some(row=>String(row.id)===String(result.publication_id)))throw new Error('Pubblicazione non confermata dal bundle server. Ricarica e verifica prima di riprovare.');
      sessionStorage.removeItem(key);return result;
    }finally{pending=false}
  }
  window.ATRaceOnline={scope,assignment,assertWriter,existingRun,order,orderedPairs,stageConfig,thresholds,refresh,execute,publish,data,json,pending:()=>pending};
})();
