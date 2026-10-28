(function(root){
  'use strict';
  const eventFields=['name','subtitle','start_date','end_date','location','address','start_time','status','published','description_html','poster','maps_url','organizer_id','judge_id','entry_fee','recall_cost','recall_cost_status','max_pairs','official_ranking','stage_config_confirmed','prereg_enabled','prereg_open_date','prereg_close_date','prereg_max','prereg_note','ranking_mode','break_time','aperitivo_time','hospitality_info','parking_info','accessibility_info','early_discount_amount','early_discount_deadline','prizes','participant_gift','awards_date','awards_time','awards_venue','awards_address','awards_maps_url','awards_link','awards_notes','awards_datetime','review_acknowledged','ranking_season_id','ranking_season_label','competition_mode','pricing_model','unlimited_pairs'];
  function copy(source, fields){const out={};fields.forEach(k=>{if(source[k]!==undefined)out[k.toUpperCase()]=source[k]});return out;}
  function eventRecord(d,id){
    if(!id||!String(d.name||'').trim())throw Error('Il nome dell’evento è obbligatorio.');
    const unsupported=[['phone','telefono'],['email','email'],['whatsapp_url','WhatsApp'],['two_day_fee','quota due giornate'],['security_pin','PIN evento'],['prereg_email','email preregistrazioni']];
    const blocked=unsupported.filter(([key])=>d[key]!==undefined&&d[key]!==null&&String(d[key]).trim()!=='').map(([,label])=>label);
    if(blocked.length)throw Error('Il salvataggio online non supporta ancora: '+blocked.join(', ')+'. Nessun dato è stato inviato.');
    const record=copy(d,eventFields);record.ID=id;
    if(d.stages!==undefined)record.STAGES_JSON=d.stages;
    if(d.stage_config!==undefined)record.STAGE_CONFIG_JSON=d.stage_config;
    if(d.participation_rules!==undefined)record.PARTICIPATION_RULES_JSON=d.participation_rules;
    return record;
  }
  function dayRecord(d,eventId){
    if(!d.id)throw Error('La giornata non ha un identificativo.');
    return Object.assign(copy(d,['id','date','label','competition_id']),{EVENT_ID:eventId,STAGES_JSON:d.stages||[],ACTIVITIES_JSON:d.activities||[]});
  }
  function stageRecord(d,eventId,id){
    if(!id||!d.stage)throw Error('La prova non ha un identificativo.');
    return Object.assign(copy(d,['stage','day_id','competition_id','obstacles','reason','standard_obstacles']),{ID:id,EVENT_ID:eventId,TIMES_JSON:d.times||{},TIMES_CS_JSON:d.times_cs||{},RECALL_COSTS_JSON:d.recall_costs||{}});
  }
  function hydrate(data){
    if(!data||typeof data!=='object')return data;
    (data.events||[]).forEach(e=>{if(Array.isArray(e.stages_json))e.stages=e.stages_json;if(Array.isArray(e.stage_config_json))e.stage_config=e.stage_config_json;if(e.participation_rules_json&&typeof e.participation_rules_json==='object')e.participation_rules=e.participation_rules_json;});
    (data.event_days||[]).forEach(d=>{if(Array.isArray(d.stages_json))d.stages=d.stages_json;if(Array.isArray(d.activities_json))d.activities=d.activities_json;});
    (data.stage_config||[]).forEach(s=>{if(s.times_json&&typeof s.times_json==='object')s.times=s.times_json;if(s.times_cs_json&&typeof s.times_cs_json==='object')s.times_cs=s.times_cs_json;if(s.recall_costs_json&&typeof s.recall_costs_json==='object')s.recall_costs=s.recall_costs_json;});
    return data;
  }
  function operations(d,id,current){
    current=current||{};
    const events=current.events||[],days=current.event_days||[],stages=current.stage_config||[];
    const event=events.find(x=>String(x.id)===String(id));
    const desiredDays=d.event_days||[],desiredStages=d.stage_config||[];
    const oldDays=days.filter(x=>String(x.event_id)===String(id));
    const oldStages=stages.filter(x=>String(x.event_id)===String(id));
    if(oldDays.some(x=>!desiredDays.some(y=>String(y.id)===String(x.id))))throw Error('La rimozione di una giornata non è disponibile online.');
    const stageKey=x=>[String(x.day_id||''),String(x.competition_id||''),String(x.stage||'')].join('|');
    if(oldStages.some(x=>!desiredStages.some(y=>stageKey(y)===stageKey(x))))throw Error('La rimozione di una prova non è disponibile online.');
    const output=[];
    function push(name,table,record,old){
      const payload={table,operation:old?'update':'create',id:record.ID,event_id:id};
      if(old){if(!old.updated_at)throw Error('Versione del dato non disponibile: ricarica la pagina.');payload.expected_updated_at=String(old.updated_at);payload.changes=Object.assign({},record);delete payload.changes.ID;}
      else payload.record=record;
      output.push({name,payload});
    }
    push('event_mutation','EVENTI',eventRecord(d,id),event);
    desiredDays.forEach(day=>push('event_mutation','GIORNATE',dayRecord(day,id),oldDays.find(x=>String(x.id)===String(day.id))));
    desiredStages.forEach(stage=>{const old=oldStages.find(x=>stageKey(x)===stageKey(stage));const stageId=old?String(old.id):[id,stage.day_id||'day',stage.competition_id||'competition',stage.stage].join(':');push('start_order_mutation','CONFIG_PROVE',stageRecord(stage,id,stageId),old);});
    if(output.length>50)throw Error('Troppe modifiche in una sola operazione.');
    return output;
  }
  root.ATEventOnlineMapping={eventRecord,dayRecord,stageRecord,operations,hydrate};
})(typeof window==='undefined'?globalThis:window);

