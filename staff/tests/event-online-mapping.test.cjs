const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ctx={};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/event-online-mapping.js'),'utf8'),ctx);
const map=ctx.ATEventOnlineMapping;
test('event, day and stage retain the essential fields in server format',()=>{
  const event=map.eventRecord({name:'Evento prova',start_date:'2026-12-01',stages:['OPEN'],participation_rules:{mode:'OPEN_TO_ALL'}},'event-1');
  const day=map.dayRecord({id:'day-1',date:'2026-12-01',stages:['OPEN']},'event-1');
  const stage=map.stageRecord({stage:'OPEN',day_id:'day-1',times_cs:{1:100}},'event-1','stage-1');
  assert.equal(event.NAME,'Evento prova');assert.equal(event.STAGES_JSON[0],'OPEN');assert.equal(event.PARTICIPATION_RULES_JSON.mode,'OPEN_TO_ALL');
  assert.equal(day.EVENT_ID,'event-1');assert.equal(day.STAGES_JSON[0],'OPEN');
  assert.equal(stage.TIMES_CS_JSON[1],100);assert.equal(stage.DAY_ID,'day-1');
});
test('fields without an online mapping fail before sending instead of being lost',()=>{
  assert.throws(()=>map.eventRecord({name:'Evento',phone:'123'},'event-1'),/telefono/);
  assert.equal(map.eventRecord({name:'Evento',security_pin:'1234'},'event-1').SECURITY_PIN,undefined);
});
test('new event, day and stage are prepared together and updates require versions',()=>{
  const draft={name:'Evento',event_days:[{id:'day',date:'2026-12-01',stages:['OPEN']}],stage_config:[{day_id:'day',competition_id:'COMP-A',stage:'OPEN',times_cs:{1:100}}]};
  const ops=map.operations(draft,'event',{});
  assert.equal(ops.length,3);assert.equal(ops[0].payload.record.ID,'event');assert.equal(ops[1].payload.record.EVENT_ID,'event');assert.equal(ops[2].payload.record.TIMES_CS_JSON[1],100);
  assert.throws(()=>map.operations(draft,'event',{events:[{id:'event'}]}),/Versione/);
  assert.throws(()=>map.operations({name:'Evento',event_days:[],stage_config:[]},'event',{event_days:[{id:'day',event_id:'event'}]}),/rimozione/);
});

