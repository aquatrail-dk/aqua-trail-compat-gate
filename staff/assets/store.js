(function(){
  // V8.6.9: questi namespace sono CONGELATI. Non cambiarli nelle release successive:
  // ogni upgrade deve migrare/mergiare i dati, mai nasconderli dietro una nuova chiave.
  const PUBKEY='aquatrail_public_v868_complete';
  const ADMKEY='aquatrail_admin_v868_complete';
  const SESSION='aquatrail_session_v868_complete';
  const DEMO_GATE='aquatrail_demo_aaron_gate';
  const WORKSPACE_KEY='aquatrail_workspace_global_v1';
  const WORKSPACE_DEFAULT={mode:'DEMO',epoch:1,updated_at:null,updated_by:'SYSTEM',reason:'Baseline 1.8.4: dataset operativo iniziale DEMO'};
  const PUBLIC_WORKSPACE_ARRAYS=['events','event_days','judges','pairs','entries','stage_config','results','validated_event_winners','season_standings','gallery','public_start_orders','published_race_snapshots','public_event_updates','organizers','event_news','season_history','season_point_awards'];
  const ADMIN_WORKSPACE_ARRAYS=['pair_private','registrations','accounting','exceptions','start_orders','race_runs','race_events','judges_admin','published_snapshots','publication_history','pin_events','organizers_admin','preregistrations','prereg_verifications','prereg_rate_limits','email_outbox','email_log','center_event_accounts','soft_deleted_events','memberships','charges','payments','payment_allocations','accounting_reversals','accounting_credits'];
  const ADMIN_WORKSPACE_MAPS=['race_pair_states','timer_states','preflight_checks','event_drafts','event_prereg_settings','event_security'];
  const LEGACY_AUTH_SESSION_KEYS=['aquatrail_session','aquatrail_session_v868_complete'];
  const REPORTKEY='aquatrail_migration_report_v869';
  const DATA_SCHEMA_VERSION='BETA_1.1_CP3';
  const BUILD_RELEASE=window.AQUATRAIL_BUILD?.release||window.AQUATRAIL_BUILD?.label||DATA_SCHEMA_VERSION;
  const MIGRATION_ID='V869_NO_ROLLOVER_20260915';
  const KNOWN_PUBLIC_LEGACY=['aquatrail_public_v867p2','aquatrail_public_v84'];
  const KNOWN_ADMIN_LEGACY=['aquatrail_admin_v867p2','aquatrail_admin_v84'];
  const clone=o=>o===undefined?undefined:JSON.parse(JSON.stringify(o));
  const isObj=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
  const safeJson=s=>{try{return JSON.parse(s||'null')}catch(_){return null}};
  const raw=(key)=>{try{return localStorage.getItem(key)}catch(_){return null}};
  const load=(key,base)=>{const x=safeJson(raw(key));return x||clone(base||{});};
  const save=(key,obj)=>localStorage.setItem(key,JSON.stringify(obj));
  const now=()=>new Date().toLocaleString('it-IT',{hour12:false});
  const nowIso=()=>new Date().toISOString();
  const today=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),m=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${m.year}-${m.month}-${m.day}`;};
  const maxId=(prefix,list)=>{let max=0;(list||[]).forEach(x=>{const m=String(x.id||'').match(new RegExp('^'+prefix+'(\\d+)$'));if(m)max=Math.max(max,Number(m[1]));});return prefix+String(max+1).padStart(3,'0');};
  const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const randomDigits=n=>{try{if(window.crypto&&window.crypto.getRandomValues){const a=new Uint32Array(n);window.crypto.getRandomValues(a);return Array.from(a,x=>String(x%10)).join('')}}catch(e){}let out='';for(let i=0;i<n;i++)out+=Math.floor(Math.random()*10);return out};
  const same=(a,b)=>{try{return JSON.stringify(a)===JSON.stringify(b)}catch(_){return a===b}};
  const missing=v=>v===undefined||v===null||v===''||(Array.isArray(v)&&v.length===0);
  const stableStringify=o=>{try{if(!isObj(o))return JSON.stringify(o);return JSON.stringify(Object.keys(o).sort().reduce((a,k)=>(a[k]=o[k],a),{}))}catch(_){return String(o)}};
  const ADMIN_CONFLICT_CODE='AT_ADMIN_CONFLICT';
  const ONLINE_AUTHORITY_CODE='AT_ONLINE_BACKEND_REQUIRED';
  const ONLINE_COMMAND_CODE='AT_ONLINE_COMMAND_REQUIRED';
  const dataApi=()=>window.ATDataAPI||null;
  const onlineApiActive=()=>!localAuthorityAllowed()&&!!dataApi()?.isOnline?.();
  function onlineCommandError(operation='OPERAZIONE'){const e=new Error(`${operation}: in modalità online questa azione deve essere autorizzata dal backend Apps Script.`);e.code=ONLINE_COMMAND_CODE;return e;}


  const normalizeWorkspace=v=>String(v||'DEMO').toUpperCase()==='REAL'?'REAL':'DEMO';
  const recordWorkspace=v=>['DEMO','REAL'].includes(String(v||'').toUpperCase())?String(v).toUpperCase():null;
  function workspaceConfig(){
    if(onlineApiActive()&&typeof dataApi()?.workspaceConfig==='function')return dataApi().workspaceConfig();
    const stored=safeJson(raw(WORKSPACE_KEY));
    const c=isObj(stored)?stored:clone(WORKSPACE_DEFAULT);
    c.mode=normalizeWorkspace(c.mode);c.epoch=Math.max(1,Number(c.epoch||1)||1);
    if(!stored&&localAuthorityAllowed()){try{save(WORKSPACE_KEY,c)}catch(_){}}
    return clone(c);
  }
  function activeWorkspace(){return normalizeWorkspace(workspaceConfig().mode)}
  function stampWorkspaceRows(data,arrays,maps,mode){
    const ws=normalizeWorkspace(mode);
    for(const k of arrays){if(!Array.isArray(data?.[k]))continue;for(const row of data[k])if(isObj(row)&&!row.workspace)row.workspace=ws;}
    for(const k of (maps||[])){if(!isObj(data?.[k]))continue;for(const row of Object.values(data[k]))if(isObj(row)&&!row.workspace)row.workspace=ws;}
    return data;
  }
  function filterWorkspaceDataset(kind,data,mode){
    const ws=normalizeWorkspace(mode),out=clone(data||{}),arrays=kind==='PUBLIC'?PUBLIC_WORKSPACE_ARRAYS:ADMIN_WORKSPACE_ARRAYS,maps=kind==='ADMIN'?ADMIN_WORKSPACE_MAPS:[];
    for(const k of arrays)if(Array.isArray(out[k]))out[k]=out[k].filter(r=>isObj(r)&&recordWorkspace(r.workspace)===ws);
    for(const k of maps)if(isObj(out[k]))out[k]=Object.fromEntries(Object.entries(out[k]).filter(([,r])=>isObj(r)&&recordWorkspace(r.workspace)===ws));
    out.meta=out.meta||{};out.meta.active_workspace=ws;out.meta.workspace_epoch=workspaceConfig().epoch;return out;
  }
  function mergeWorkspaceDataset(kind,incoming,full,mode){
    const ws=normalizeWorkspace(mode),out=clone(full||{}),src=clone(incoming||{}),arrays=kind==='PUBLIC'?PUBLIC_WORKSPACE_ARRAYS:ADMIN_WORKSPACE_ARRAYS,maps=kind==='ADMIN'?ADMIN_WORKSPACE_MAPS:[];
    for(const [k,v] of Object.entries(src))if(!arrays.includes(k)&&!maps.includes(k))out[k]=clone(v);
    for(const k of arrays){
      const hidden=(Array.isArray(full?.[k])?full[k]:[]).filter(r=>!isObj(r)||recordWorkspace(r.workspace)!==ws).map(clone);
      const visible=(Array.isArray(src?.[k])?src[k]:[]).map(r=>{const x=clone(r);if(isObj(x))x.workspace=ws;return x});
      out[k]=hidden.concat(visible);
    }
    for(const k of maps){
      const merged={};for(const [id,r] of Object.entries(isObj(full?.[k])?full[k]:{}))if(!isObj(r)||recordWorkspace(r.workspace)!==ws)merged[id]=clone(r);
      for(const [id,r] of Object.entries(isObj(src?.[k])?src[k]:{})){const x=clone(r);if(isObj(x))x.workspace=ws;merged[id]=x}out[k]=merged;
    }
    out.meta=out.meta||{};delete out.meta.active_workspace;delete out.meta.workspace_epoch;return out;
  }
  function workspaceStatsFrom(fullPub,fullAdm){
    const count=(obj,arrays,ws)=>arrays.reduce((n,k)=>n+(Array.isArray(obj?.[k])?obj[k].filter(r=>isObj(r)&&recordWorkspace(r.workspace)===ws).length:0),0);
    return {DEMO:{public_records:count(fullPub,PUBLIC_WORKSPACE_ARRAYS,'DEMO'),admin_records:count(fullAdm,ADMIN_WORKSPACE_ARRAYS,'DEMO')},REAL:{public_records:count(fullPub,PUBLIC_WORKSPACE_ARRAYS,'REAL'),admin_records:count(fullAdm,ADMIN_WORKSPACE_ARRAYS,'REAL')}};
  }
  function hasRunningRace(adminData){
    const A=adminData||{};
    if(Object.values(A.timer_states||{}).some(t=>t&&t.running===true))return true;
    if((A.race_runs||[]).some(r=>r&&r.completed!==true&&['RUNNING','IN_CORSO','IN CORSO'].includes(String(r.status||'').toUpperCase())))return true;
    if((A.race_events||[]).some(r=>r&&['RUNNING','IN_CORSO','IN CORSO'].includes(String(r.status||r.state||'').toUpperCase())))return true;
    return false;
  }
  function clearBrowserAuth(){
    try{for(const k of new Set([SESSION,DEMO_GATE,...LEGACY_AUTH_SESSION_KEYS]))sessionStorage.removeItem(k)}catch(_){}
  }
  const runtimeConfig=()=>window.AQUATRAIL_RUNTIME||{};
  const currentLocation=()=>typeof location==='undefined'?null:location;
  const loopbackHost=()=>{const l=currentLocation();if(!l)return true;if(l.protocol==='file:')return true;const h=String(l.hostname||'').toLowerCase();return h===''||h==='localhost'||h==='127.0.0.1'||h==='::1'||h==='[::1]';};
  function localAuthorityAllowed(){const rt=runtimeConfig(),mode=String(rt.mode||'OFFLINE_LOCAL').toUpperCase();if(mode.startsWith('ONLINE'))return false;if(rt.backend_authoritative===true)return false;if(rt.allow_client_authority===false)return false;return loopbackHost();}
  function onlineAuthorityError(operation='OPERAZIONE'){const e=new Error(`${operation}: autorità client locale disabilitata. È richiesto il backend Apps Script server-authoritative.`);e.code=ONLINE_AUTHORITY_CODE;return e;}
  function assertLocalAuthority(operation){if(!localAuthorityAllowed())throw onlineAuthorityError(operation);return true;}
  const LOCK_PREFIX='aquatrail_lock_v1:';
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const adminRevisionOf=x=>Math.max(0,Number(x?.meta?.store_revision||0)||0);
  function adminConflict(message='Dati modificati in un’altra scheda o sessione. Ricarica i dati e riprova.'){const e=new Error(message);e.code=ADMIN_CONFLICT_CODE;return e;}
  function refreshAdminCacheFromStorage(){if(!migrationCache)return null;const stored=safeJson(raw(ADMKEY));if(stored&&isObj(stored)){const sr=adminRevisionOf(stored),cr=adminRevisionOf(migrationCache.adminData);if(sr!==cr)migrationCache.adminData=normalizeAdmin(stored)}return migrationCache.adminData;}
  function persistAdmin(x,expectedRevision){assertLocalAuthority('SALVATAGGIO ADMIN');normalizeAdmin(x);const stored=safeJson(raw(ADMKEY)),current=stored&&isObj(stored)?normalizeAdmin(stored):(migrationCache?.adminData?normalizeAdmin(clone(migrationCache.adminData)):normalizeAdmin(clone(window.AQUATRAIL_ADMIN_DATA||{}))),currentRevision=adminRevisionOf(current);if(expectedRevision!=null&&currentRevision!==Number(expectedRevision))throw adminConflict(`CONFLITTO DATI: revisione attesa ${expectedRevision}, revisione corrente ${currentRevision}. Nessuna modifica salvata.`);x.meta=x.meta||{};x.meta.store_revision=currentRevision+1;x.meta.store_updated_at=nowIso();x.meta.store_updated_by='OFFLINE_CLIENT';save(ADMKEY,x);if(migrationCache)migrationCache.adminData=clone(x);return x;}
  async function withAdminLock(name,fn,options){const lockName=`aquatrail:${String(name||'admin')}`,opts=options||{};if(typeof navigator!=='undefined'&&navigator?.locks?.request)return navigator.locks.request(lockName,{mode:'exclusive'},fn);const key=LOCK_PREFIX+lockName,token=`${nowIso()}-${randomDigits(12)}`,timeout=Math.max(250,Number(opts.timeout_ms||2200)),lease=Math.max(1000,Number(opts.lease_ms||5000)),deadline=Date.now()+timeout;while(Date.now()<deadline){const cur=safeJson(raw(key)),t=Date.now();if(!cur||Number(cur.expires_at||0)<=t){try{localStorage.setItem(key,JSON.stringify({token,expires_at:t+lease}))}catch(_){return fn()}await sleep(0);const verify=safeJson(raw(key));if(verify?.token===token){try{return await fn()}finally{try{const last=safeJson(raw(key));if(last?.token===token)localStorage.removeItem(key)}catch(_){}}}}await sleep(15)}throw adminConflict('Operazione già in corso in un’altra scheda. Nessuna modifica salvata.');}

  function identity(item,field,index){
    if(!isObj(item))return `${field}:value:${stableStringify(item)}`;
    if(item.id!=null&&String(item.id)!=='')return `${field}:id:${item.id}`;
    if(item.membership_id!=null&&String(item.membership_id)!=='')return `${field}:membership:${item.membership_id}`;
    if(item.username)return `${field}:username:${String(item.username).toLowerCase()}`;
    if(item.event_id&&item.pair_id&&item.stage)return `${field}:event-pair-stage:${item.event_id}|${item.pair_id}|${item.stage}|${item.tps??''}|${item.day_id??item.event_day_id??''}`;
    if(item.event_id&&item.pair_id)return `${field}:event-pair:${item.event_id}|${item.pair_id}`;
    if(item.event_id&&item.stage)return `${field}:event-stage:${item.event_id}|${item.stage}|${item.tps??''}|${item.day_id??item.event_day_id??''}`;
    if(item.event_id&&item.tps)return `${field}:event-tps:${item.event_id}|${item.tps}`;
    if(item.season_id&&item.pair_id)return `${field}:season-pair:${item.season_id}|${item.tps??''}|${item.pair_id}`;
    if(item.pair_id)return `${field}:pair:${item.pair_id}`;
    if(item.judge_id)return `${field}:judge:${item.judge_id}`;
    if(item.organizer_id)return `${field}:organizer:${item.organizer_id}`;
    if(item.timestamp&&item.action)return `${field}:audit:${item.timestamp}|${item.action}|${item.object??''}`;
    if(item.created_at&&item.email)return `${field}:created-email:${item.created_at}|${item.email}|${item.event_id??''}|${item.type??''}`;
    return `${field}:json:${stableStringify(item)}:${index??0}`;
  }

  function overlay(base,over){
    if(Array.isArray(over))return clone(over);
    if(!isObj(over))return over===undefined?clone(base):clone(over);
    const out=isObj(base)?clone(base):{};
    Object.keys(over).forEach(k=>{
      const ov=over[k],bv=out[k];
      out[k]=(isObj(ov)&&isObj(bv))?overlay(bv,ov):clone(ov);
    });
    return out;
  }

  function mergePrimaryArray(seedArr,primaryArr,field){
    const out=(seedArr||[]).map(clone),map=new Map(out.map((x,i)=>[identity(x,field,i),i]));
    (primaryArr||[]).forEach((x,i)=>{
      const k=identity(x,field,i);
      if(map.has(k)){const p=map.get(k);out[p]=overlay(out[p],x)}
      else{map.set(k,out.length);out.push(clone(x))}
    });
    return out;
  }

  function fillLegacy(target,legacy,ctx,path){
    if(!isObj(legacy))return target;
    Object.keys(legacy).forEach(k=>{
      const lp=path?`${path}.${k}`:k,lv=legacy[k],tv=target[k];
      if(missing(tv)&&!missing(lv)){target[k]=clone(lv);ctx.filled++;return}
      if(isObj(tv)&&isObj(lv)){fillLegacy(tv,lv,ctx,lp);return}
      if(!same(tv,lv)&&!missing(lv)){
        ctx.conflicts++;
        if(ctx.conflict_samples.length<80)ctx.conflict_samples.push({source:ctx.source,path:lp,current:tv,legacy:lv});
      }
    });
    return target;
  }

  function mergeLegacyArray(targetArr,legacyArr,field,ctx){
    const out=targetArr||[],map=new Map(out.map((x,i)=>[identity(x,field,i),i]));
    (legacyArr||[]).forEach((x,i)=>{
      const k=identity(x,field,i);
      if(!map.has(k)){map.set(k,out.length);out.push(clone(x));ctx.recovered++;ctx.recovered_by_field[field]=(ctx.recovered_by_field[field]||0)+1;return}
      const pos=map.get(k),before=clone(out[pos]);
      if(isObj(out[pos])&&isObj(x))fillLegacy(out[pos],x,ctx,`${field}[${k}]`);
      if(!same(before,out[pos]))ctx.filled_records++;
    });
    return out;
  }

  function listStorageKeys(prefix,currentKey,known){
    const seen=new Set(),out=[];
    const add=k=>{if(k&&k!==currentKey&&!seen.has(k)){seen.add(k);const d=safeJson(raw(k));if(d&&isObj(d))out.push({key:k,data:d})}};
    (known||[]).forEach(add);
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(prefix))add(k)}}catch(_){ }
    return out;
  }

  function mergeDataset(kind,seed,current,sources,hasCurrent,report){
    let result=clone(seed||{});
    const arrays=new Set([...Object.keys(seed||{}),...Object.keys(current||{})].filter(k=>Array.isArray(seed?.[k])||Array.isArray(current?.[k])));
    // Il datastore corrente, se esiste, ha sempre precedenza. Se non esiste,
    // la sorgente legacy più recente diventa primaria per non perdere modifiche dell'utente.
    if(hasCurrent){
      Object.keys(current||{}).forEach(k=>{
        if(arrays.has(k))result[k]=mergePrimaryArray(seed?.[k]||[],current[k]||[],k);
        else result[k]=isObj(seed?.[k])&&isObj(current[k])?overlay(seed[k],current[k]):clone(current[k]);
      });
    }else if(sources.length){
      const first=sources[0].data||{};
      Object.keys(first).forEach(k=>{
        if(Array.isArray(first[k])||Array.isArray(seed?.[k]))result[k]=mergePrimaryArray(seed?.[k]||[],first[k]||[],k);
        else result[k]=isObj(seed?.[k])&&isObj(first[k])?overlay(seed[k],first[k]):clone(first[k]);
      });
      report.primary_legacy_source=sources[0].key;
      sources=sources.slice(1);
    }
    sources.forEach(src=>{
      const ctx={source:src.key,recovered:0,filled:0,filled_records:0,conflicts:0,recovered_by_field:{},conflict_samples:report.conflict_samples};
      Object.keys(src.data||{}).forEach(k=>{
        const lv=src.data[k];
        if(Array.isArray(lv))result[k]=mergeLegacyArray(Array.isArray(result[k])?result[k]:[],lv,k,ctx);
        else if(isObj(lv)){
          if(!isObj(result[k])){result[k]=clone(lv);ctx.filled++}
          else fillLegacy(result[k],lv,ctx,k);
        }else if(missing(result[k])&&!missing(lv)){result[k]=lv;ctx.filled++}
        else if(!same(result[k],lv)&&!missing(lv)){ctx.conflicts++}
      });
      report.sources.push({kind,key:src.key,meta_version:src.data?.meta?.version||'',recovered_records:ctx.recovered,filled_values:ctx.filled,conflicts_kept_current:ctx.conflicts,recovered_by_field:ctx.recovered_by_field});
      report.recovered_records+=ctx.recovered;report.filled_values+=ctx.filled;report.conflicts_kept_current+=ctx.conflicts;
    });
    return result;
  }

  function migrateEventSecrets(pub,adm){
    pub=pub||{};adm=adm||{};adm.event_security=adm.event_security||{};
    for(const e of (pub.events||[])){
      const pin=String(e?.security_pin||'').trim();
      if(pin){const id=String(e.id||'');if(id){const rec=adm.event_security[id]||(adm.event_security[id]={event_id:id});if(!rec.pin)rec.pin=pin;if(!rec.pin_migrated_at)rec.pin_migrated_at=nowIso();if(!rec.pin_migrated_from)rec.pin_migrated_from='PUBLIC_EVENT_SECURITY_PIN';}delete e.security_pin;}
    }
    return {pub,adm};
  }
  let migrationCache=null;
  function ensureMigration(force){
    if(migrationCache&&!force)return migrationCache;
    const seedPub=clone(window.AQUATRAIL_DATA||{}),seedAdm=clone(window.AQUATRAIL_ADMIN_DATA||{});
    const currentPub=safeJson(raw(PUBKEY)),currentAdm=safeJson(raw(ADMKEY));
    const pubSources=listStorageKeys('aquatrail_public_',PUBKEY,KNOWN_PUBLIC_LEGACY);
    const admSources=listStorageKeys('aquatrail_admin_',ADMKEY,KNOWN_ADMIN_LEGACY);
    const report={migration_id:MIGRATION_ID,site_version:BUILD_RELEASE,ran_at:nowIso(),stable_public_key:PUBKEY,stable_admin_key:ADMKEY,current_public_found:!!currentPub,current_admin_found:!!currentAdm,sources:[],recovered_records:0,filled_values:0,conflicts_kept_current:0,conflict_samples:[],events_seen:[],warnings:[],persisted:false};
    let pub=mergeDataset('PUBLIC',seedPub,currentPub||{},pubSources,!!currentPub,report);
    let adm=mergeDataset('ADMIN',seedAdm,currentAdm||{},admSources,!!currentAdm,report);
    pub.meta=overlay(pub.meta||{}, {version:BUILD_RELEASE,schema_version:DATA_SCHEMA_VERSION,generated_at:'2026-09-15',demo:true,build_snapshot:BUILD_RELEASE,snapshot_date:'2026-09-19'});
    adm.meta=overlay(adm.meta||{}, {version:BUILD_RELEASE,schema_version:DATA_SCHEMA_VERSION});
    ({pub,adm}=migrateEventSecrets(pub,adm));
    pub=normalizePublic(pub);adm=normalizeAdmin(adm);
    // 1.8.4: tutto il patrimonio operativo precedente è baseline DEMO. I nuovi record ereditano poi il workspace globale.
    stampWorkspaceRows(pub,PUBLIC_WORKSPACE_ARRAYS,[],'DEMO');stampWorkspaceRows(adm,ADMIN_WORKSPACE_ARRAYS,ADMIN_WORKSPACE_MAPS,'DEMO');
    report.events_seen=(pub.events||[]).map(e=>({id:e.id||'',name:e.name||'',start_date:e.start_date||''}));
    report.custom_events_from_legacy=[];
    const seedIds=new Set((seedPub.events||[]).map(e=>e.id));
    report.events_seen.filter(e=>!seedIds.has(e.id)).forEach(e=>report.custom_events_from_legacy.push(e));
    // Audit una sola volta per datastore: non chiama ATStore.audit per evitare ricorsione.
    adm.audit=adm.audit||[];
    if(!adm.audit.some(x=>x&&x.migration_id===MIGRATION_ID)){
      adm.audit.unshift({timestamp:now(),user:'SYSTEM',action:'MIGRAZIONE STORAGE NO-ROLLOVER',object:'DATABASE OFFLINE',before:'Namespace precedenti preservati',after:`${report.recovered_records} record recuperati automaticamente`,reason:'V8.6.9: recupero cumulativo senza cancellare le chiavi legacy',migration_id:MIGRATION_ID});
    }
    try{save(PUBKEY,pub);save(ADMKEY,adm);report.persisted=true}catch(e){report.warnings.push('Impossibile persistere completamente la migrazione nel LocalStorage: '+(e?.message||e));}
    try{localStorage.setItem(REPORTKEY,JSON.stringify({...report,conflict_samples:report.conflict_samples.slice(0,30)}))}catch(_){ }
    migrationCache={publicData:pub,adminData:adm,report};
    return migrationCache;
  }

  const secToCs=v=>{const n=Number(v);return Number.isFinite(n)?Math.round(n*100):null};
  const csToSec=v=>{const n=Number(v);return Number.isFinite(n)?n/100:null};
  function normalizeTimeRecord(o,timeField='time_s',csField='time_cs'){if(!o||typeof o!=='object')return;const cs=o[csField]!=null?Number(o[csField]):secToCs(o[timeField]);if(cs!=null&&Number.isFinite(cs)){o[csField]=Math.round(cs);o[timeField]=csToSec(o[csField])}}
  function normalizePublic(x){
    x=x||{};
    const basePairs=new Map(((window.AQUATRAIL_DATA||{}).pairs||[]).map(p=>[p.id,p]));
    (x.pairs||[]).forEach(p=>{
      const b=basePairs.get(p.id)||{};
      p.handler_first_name=String(p.handler_first_name||p.handler||b.handler_first_name||b.handler||'').trim();
      p.handler_last_name=String(p.handler_last_name||b.handler_last_name||'').trim();
      p.handler=p.handler_first_name;
    });
    (x.stage_config||[]).forEach(c=>{c.times=c.times||{};c.times_cs=c.times_cs||{};[1,2,3].forEach(t=>{const raw=c.times_cs[t]??c.times_cs[String(t)],legacy=c.times[t]??c.times[String(t)],cs=raw!=null?Number(raw):secToCs(legacy);if(cs!=null&&Number.isFinite(cs)){c.times_cs[String(t)]=Math.round(cs);c.times[String(t)]=csToSec(c.times_cs[String(t)])}})});
    (x.results||[]).forEach(r=>{normalizeTimeRecord(r);const bcs=r.bonus_cs!=null?Number(r.bonus_cs):secToCs(r.bonus_s);if(bcs!=null&&Number.isFinite(bcs)){r.bonus_cs=Math.round(bcs);r.bonus_s=csToSec(r.bonus_cs)}});
    x.publication_sources=x.publication_sources||[];x.published_race_snapshots=x.published_race_snapshots||[];(x.published_race_snapshots||[]).forEach(s=>(s.rows||[]).forEach(r=>normalizeTimeRecord(r)));
    (x.events||[]).forEach(e=>{delete e.security_pin;if(!e.competition_mode)e.competition_mode='SINGLE_SERIES';if(!e.pricing_model)e.pricing_model='LEGACY_ENTRY_FEE';if(e.unlimited_pairs!==true&&e.max_pairs==null&&e.prereg_max==null)e.unlimited_pairs=false;if(!e.ranking_mode){const demoText=[e.name,e.subtitle,e.description_html,e.description,e.publication_note].filter(Boolean).join(' ');if(e.demo===true||/\bdemo\b|simulazione/i.test(demoText))e.ranking_mode='DEMO';else if(e.official_ranking===true)e.ranking_mode='OFFICIAL';else if(e.official_ranking===false)e.ranking_mode='AMATEUR'}if(e.ranking_mode)e.official_ranking=e.ranking_mode==='OFFICIAL';e.participation_rules=e.participation_rules||{};if(!e.participation_rules.mode)e.participation_rules.mode='OPEN_TO_ALL';if(!Array.isArray(e.participation_rules.allowed_center_ids))e.participation_rules.allowed_center_ids=[];if(!e.participation_rules.membership_season_id)e.participation_rules.membership_season_id=x.season?.id||'';});
    const eventMap=new Map((x.events||[]).map(e=>[String(e.id),e]));
    const dayGroups=new Map();(x.event_days||[]).forEach(d=>{const k=String(d.event_id||'');if(!dayGroups.has(k))dayGroups.set(k,[]);dayGroups.get(k).push(d)});
    for(const [eid,rows] of dayGroups){rows.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.id||'').localeCompare(String(b.id||'')));const mode=eventMap.get(eid)?.competition_mode||'SINGLE_SERIES';rows.forEach((d,i)=>{if(!d.competition_id)d.competition_id=mode==='INDEPENDENT_DAYS'?`COMP-${String(d.id||i+1)}`:'COMP-A'})}
    (x.stage_config||[]).forEach(c=>{if(c.day_id&&!c.competition_id){const d=(x.event_days||[]).find(v=>String(v.event_id)===String(c.event_id)&&String(v.id)===String(c.day_id));if(d)c.competition_id=d.competition_id||'COMP-A'}});
    (x.organizers||[]).forEach(c=>{if(!c.center_id)c.center_id=c.id;if(!c.entity_kind)c.entity_kind='CENTER_ASSOCIATED';});
    x.center_model=x.center_model||{version:1,canonical_collection:'organizers',stable_id_field:'id',center_id_alias:'center_id',pair_link_via:'memberships',organizer_and_membership_center_are_distinct_concepts:true};
    x.event_participation_model=x.event_participation_model||{version:1,default_mode:'OPEN_TO_ALL',modes:['OPEN_TO_ALL','AQUATRAIL_MEMBERS_ONLY','SELECTED_CENTERS'],allowed_center_ids_field:'allowed_center_ids',membership_season_field:'membership_season_id'};
    return x;
  }
  const handlerName=p=>[p?.handler_first_name||p?.handler||'',p?.handler_last_name||''].filter(Boolean).join(' ').trim();
  function normalizeAdmin(x){
    x=x||{};x.meta=x.meta||{};if(!Number.isFinite(Number(x.meta.store_revision)))x.meta.store_revision=0;x.offline_accounts=x.offline_accounts||[];x.event_security=x.event_security||{};
    x.memberships=x.memberships||[];x.membership_fee_catalog=x.membership_fee_catalog||[];x.charges=x.charges||[];x.payments=x.payments||[];x.payment_allocations=x.payment_allocations||[];x.accounting_reversals=x.accounting_reversals||[];x.accounting_credits=x.accounting_credits||[];
    // Migrazione NON distruttiva dei movimenti legacy: il vecchio ledger resta intatto e viene specchiato nel modello strutturato.
    (x.accounting||[]).forEach(m=>{const legacy=String(m.id||'');if(!legacy||m.finance_mirrored===true)return;const pair_id=String(m.pair_id||''),event_id=String(m.event_id||''),date=m.date||today(),debit=Math.max(0,Number(m.debit||0)),payment=Math.max(0,Number(m.payment||0));let charge=null,pay=null;if(debit>0){const source_key='LEGACY:'+legacy+':DEBIT';charge=x.charges.find(c=>c.source_key===source_key);if(!charge){charge={id:'CHG-L-'+legacy,source_key,pair_id,domain:'EVENT',reference_id:event_id,event_id,description:m.description||m.type||'Addebito evento',amount:Math.round(debit*100)/100,date,legacy_accounting_id:legacy,created_at:m.created_at||date};x.charges.push(charge)}}if(payment>0){const source_key='LEGACY:'+legacy+':PAYMENT';pay=x.payments.find(q=>q.source_key===source_key);if(!pay){pay={id:'PAY-L-'+legacy,source_key,pair_id,amount:Math.round(payment*100)/100,date,description:'Pagamento legacy · '+(m.description||m.type||''),legacy_accounting_id:legacy,created_at:m.created_at||date};x.payments.push(pay)}}if(charge&&pay){const source_key='LEGACY:'+legacy+':ALLOCATION';if(!x.payment_allocations.some(a=>a.source_key===source_key))x.payment_allocations.push({id:'ALL-L-'+legacy,source_key,payment_id:pay.id,charge_id:charge.id,pair_id,amount:Math.round(Math.min(debit,payment)*100)/100,created_at:m.created_at||date,legacy_accounting_id:legacy})}});
    x.membership_model=x.membership_model||{version:1,historical:true,statuses:['DA ATTIVARE','ATTIVO','SCADUTO','SOSPESO'],required_fields:['membership_id','pair_id','center_id','membership_number','season_id','status','valid_from','valid_to','fee_due','fee_paid','residual','credit','notes']};
    x.economic_model=x.economic_model||{version:1,separate_membership_and_event_fees:true,movement_types:['CHARGE','PAYMENT','ALLOCATION','REVERSAL','CREDIT'],causal_domains:['MEMBERSHIP','EVENT'],destructive_delete_forbidden:true};
    if(localAuthorityAllowed()){
      let sa=x.offline_accounts.find(a=>String(a.role||'').toUpperCase()==='SUPERADMIN'||String(a.username||'').toUpperCase()==='SUPERADMIN');
      if(!sa){sa={};x.offline_accounts.unshift(sa)}
      Object.assign(sa,{username:'SUPERADMIN',password:'',role:'SUPERADMIN',correction_pin:'',owner:'Bruno',demo:true,enabled:sa.enabled!==false});
      x.offline_accounts.forEach(a=>{if(a.enabled==null)a.enabled=true;});
    }else{
      // Online: account e segreti restano esclusivamente lato backend.
      x.offline_accounts=[];x.event_security={};
    }
    (x.registrations||[]).forEach(r=>{const legacy=String(r.state||'').toUpperCase(),due=Number(r.due||0),paid=Number(r.paid||0);if(!r.registration_status)r.registration_status=legacy==='PRE-ISCRITTO'?'PREISCRITTO':legacy==='RITIRATO'?'RITIRATO':'CONFERMATO';if(!r.attendance_status)r.attendance_status=['IN GARA','SUPERATO','RITIRATO','ELIMINATO','ELIMINATO DEFINITIVO','SQUALIFICATO','NON AMMESSO'].includes(legacy)?'PRESENTE':'ATTESO';if(!r.admission_status)r.admission_status=legacy==='NON AMMESSO'?'NON_AMMESSO':legacy==='PRE-ISCRITTO'?'DA_VERIFICARE':'AMMESSO';if(!r.payment_status)r.payment_status=paid+1e-9>=due?'OK':'DA_COMPLETARE';if(r.requirements_checked==null)r.requirements_checked=r.admission_status==='AMMESSO';r.day_status=r.day_status||{};const ds=[...(r.days||[])];for(const did of ds){if(r.day_status[did])continue;const single=ds.length===1;r.day_status[did]={attendance_status:single?(r.attendance_status||'ATTESO'):'ATTESO',admission_status:single?(r.admission_status||'DA_VERIFICARE'):'DA_VERIFICARE',requirements_checked:single?!!r.requirements_checked:false,migrated_from_legacy:single};}});
    (x.race_runs||[]).forEach(r=>normalizeTimeRecord(r));
    Object.values(x.race_pair_states||{}).forEach(st=>{st.bonuses=st.bonuses||{};st.bonuses_cs=st.bonuses_cs||{};st.stages=st.stages||{};Object.keys(st.bonuses).forEach(k=>{const cs=st.bonuses_cs[k]!=null?Number(st.bonuses_cs[k]):secToCs(st.bonuses[k]);if(cs!=null&&Number.isFinite(cs)){st.bonuses_cs[k]=Math.round(cs);st.bonuses[k]=csToSec(st.bonuses_cs[k])}});(st.penalty_history||[]).forEach(h=>normalizeTimeRecord(h));Object.values(st.stages).forEach(ss=>(ss.penalty_history||[]).forEach(h=>normalizeTimeRecord(h)));if(st.recall_snapshot?.run)normalizeTimeRecord(st.recall_snapshot.run);if(st.recall_snapshot?.stage_state)(st.recall_snapshot.stage_state.penalty_history||[]).forEach(h=>normalizeTimeRecord(h))});
    (x.historical_corrections||[]).forEach(c=>{['before','after'].forEach(side=>{const z=c?.[side];if(z?.result)normalizeTimeRecord(z.result);if(z?.run)normalizeTimeRecord(z.run)})});
    return x;
  }

  const ELIGIBILITY_CODES={
    ELIGIBLE:'ELIGIBLE',
    PAIR_NOT_FOUND:'PAIR_NOT_FOUND',
    EVENT_NOT_FOUND:'EVENT_NOT_FOUND',
    MEMBERSHIP_REQUIRED:'MEMBERSHIP_REQUIRED',
    MEMBERSHIP_EXPIRED:'MEMBERSHIP_EXPIRED',
    MEMBERSHIP_SUSPENDED:'MEMBERSHIP_SUSPENDED',
    MEMBERSHIP_INACTIVE:'MEMBERSHIP_INACTIVE',
    NOT_ELIGIBLE_CENTER:'NOT_ELIGIBLE_CENTER'
  };
  const activeDateForEvent=e=>String(e?.start_date||today());
  function membershipsForPair(pairId,adminData){return (adminData?.memberships||[]).filter(m=>String(m.pair_id)===String(pairId));}
  function membershipStateForEvent(pairId,event,adminData){
    const all=membershipsForPair(pairId,adminData);
    const season=String(event?.participation_rules?.membership_season_id||'');
    const scoped=season?all.filter(m=>String(m.season_id||'')===season):all.slice();
    const date=activeDateForEvent(event);
    const validDate=m=>(!m.valid_from||String(m.valid_from)<=date)&&(!m.valid_to||String(m.valid_to)>=date);
    const active=scoped.find(m=>String(m.status||'').toUpperCase()==='ATTIVO'&&validDate(m));
    if(active)return {ok:true,membership:active,code:ELIGIBILITY_CODES.ELIGIBLE};
    const suspended=scoped.find(m=>String(m.status||'').toUpperCase()==='SOSPESO');
    if(suspended)return {ok:false,membership:suspended,code:ELIGIBILITY_CODES.MEMBERSHIP_SUSPENDED};
    const expired=scoped.find(m=>String(m.status||'').toUpperCase()==='SCADUTO'||!validDate(m));
    if(expired)return {ok:false,membership:expired,code:ELIGIBILITY_CODES.MEMBERSHIP_EXPIRED};
    const inactive=scoped.find(m=>String(m.status||'').toUpperCase()==='DA ATTIVARE');
    if(inactive)return {ok:false,membership:inactive,code:ELIGIBILITY_CODES.MEMBERSHIP_INACTIVE};
    return {ok:false,membership:null,code:ELIGIBILITY_CODES.MEMBERSHIP_REQUIRED};
  }
  const ELIGIBILITY_MESSAGES={
    ELIGIBLE:'Binomio ammesso dalla regola di partecipazione dell’evento.',
    PAIR_NOT_FOUND:'Binomio non trovato.',
    EVENT_NOT_FOUND:'Evento non trovato.',
    MEMBERSHIP_REQUIRED:'Per questo evento è richiesto un tesseramento Aqua Trail valido.',
    MEMBERSHIP_EXPIRED:'Il tesseramento risulta scaduto per la data dell’evento.',
    MEMBERSHIP_SUSPENDED:'Il tesseramento risulta sospeso.',
    MEMBERSHIP_INACTIVE:'Il tesseramento non è ancora attivo.',
    NOT_ELIGIBLE_CENTER:'Il Centro Associato del binomio non rientra tra i Centri ammessi a questo evento.'
  };
  const eligibilityMessage=code=>ELIGIBILITY_MESSAGES[code]||'Il binomio non risulta ammesso dalla regola di partecipazione dell’evento.';
  function membershipCardToken(membership){
    const m=typeof membership==='string'?{membership_id:membership}:membership||{},raw=`${m.membership_id||''}|${m.pair_id||''}|${m.center_id||''}|AQUA_TRAIL`;
    let h=2166136261;for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}
    return `AT-MEM-${h.toString(16).toUpperCase().padStart(8,'0')}`;
  }
  function membershipByToken(token,adminData){const a=adminData||ensureMigration().adminData,t=String(token||'').toUpperCase();return (a.memberships||[]).find(m=>membershipCardToken(m)===t)||null;}
  function pairProvenance(pairId,eventId,publicData,adminData){
    const p=publicData||ensureMigration().publicData,a=adminData||ensureMigration().adminData,pid=String(pairId||''),eid=String(eventId||'');
    const e=(p.events||[]).find(x=>String(x.id)===eid)||null,r=(a.registrations||[]).find(x=>String(x.event_id)===eid&&String(x.pair_id)===pid)||null;
    let membership=null;
    if(r?.membership_id)membership=(a.memberships||[]).find(m=>String(m.membership_id)===String(r.membership_id))||null;
    if(!membership){
      const season=String(e?.participation_rules?.membership_season_id||p.season?.id||''),eventDate=String(e?.start_date||today());
      const rows=(a.memberships||[]).filter(m=>String(m.pair_id)===pid&&(!season||String(m.season_id||'')===season));
      membership=rows.find(m=>(!m.valid_from||String(m.valid_from)<=eventDate)&&(!m.valid_to||String(m.valid_to)>=eventDate))||rows.find(m=>String(m.status||'').toUpperCase()==='ATTIVO')||rows.slice().sort((x,y)=>String(y.valid_from||'').localeCompare(String(x.valid_from||'')))[0]||null;
    }
    const centerId=String(r?.center_id||membership?.center_id||''),center=(p.organizers||[]).find(c=>String(c.id)===centerId)||null;
    return {pair_id:pid,event_id:eid,center_id:centerId,center_name:center?.name||centerId||'NON TESSERATO',membership_id:String(r?.membership_id||membership?.membership_id||''),membership_number:String(membership?.membership_number||'')};
  }
  function checkEventEligibility(pairId,eventId,publicData,adminData){
    const p=normalizePublic(clone(publicData||{})),a=normalizeAdmin(clone(adminData||{}));
    const pair=(p.pairs||[]).find(x=>String(x.id||x.pair_id)===String(pairId));
    if(!pair)return {eligible:false,code:ELIGIBILITY_CODES.PAIR_NOT_FOUND,pair_id:pairId,event_id:eventId};
    const event=(p.events||[]).find(x=>String(x.id)===String(eventId));
    if(!event)return {eligible:false,code:ELIGIBILITY_CODES.EVENT_NOT_FOUND,pair_id:pairId,event_id:eventId};
    const rules=event.participation_rules||{mode:'OPEN_TO_ALL',allowed_center_ids:[],membership_season_id:p.season?.id||''};
    const mode=String(rules.mode||'OPEN_TO_ALL').toUpperCase();
    const membership=membershipStateForEvent(pairId,event,a);
    if(mode==='OPEN_TO_ALL')return {eligible:true,code:ELIGIBILITY_CODES.ELIGIBLE,pair_id:pairId,event_id:eventId,mode,membership:membership.membership||null};
    if(!membership.ok)return {eligible:false,code:membership.code,pair_id:pairId,event_id:eventId,mode,membership:membership.membership||null};
    if(mode==='AQUATRAIL_MEMBERS_ONLY')return {eligible:true,code:ELIGIBILITY_CODES.ELIGIBLE,pair_id:pairId,event_id:eventId,mode,membership:membership.membership};
    if(mode==='SELECTED_CENTERS'){
      const allowed=(rules.allowed_center_ids||[]).map(String);
      if(!allowed.includes(String(membership.membership.center_id||'')))return {eligible:false,code:ELIGIBILITY_CODES.NOT_ELIGIBLE_CENTER,pair_id:pairId,event_id:eventId,mode,membership:membership.membership,allowed_center_ids:allowed};
      return {eligible:true,code:ELIGIBILITY_CODES.ELIGIBLE,pair_id:pairId,event_id:eventId,mode,membership:membership.membership,allowed_center_ids:allowed};
    }
    return {eligible:false,code:ELIGIBILITY_CODES.MEMBERSHIP_REQUIRED,pair_id:pairId,event_id:eventId,mode,membership:membership.membership||null};
  }
  function checkPreregEligibility(pairId,eventId,publicData,adminData){
    const p=normalizePublic(clone(publicData||{})),a=normalizeAdmin(clone(adminData||{}));
    const event=(p.events||[]).find(x=>String(x.id)===String(eventId));
    if(!event)return {eligible:false,code:ELIGIBILITY_CODES.EVENT_NOT_FOUND,event_id:eventId,message:eligibilityMessage(ELIGIBILITY_CODES.EVENT_NOT_FOUND)};
    if(pairId){const r=checkEventEligibility(pairId,eventId,p,a);return {...r,message:eligibilityMessage(r.code)};}
    const mode=String(event.participation_rules?.mode||'OPEN_TO_ALL').toUpperCase();
    if(mode==='OPEN_TO_ALL')return {eligible:true,code:ELIGIBILITY_CODES.ELIGIBLE,event_id:eventId,mode,candidate:'NEW_UNREGISTERED',message:'Evento aperto a tutti: è consentita la preregistrazione di un nuovo binomio senza tesseramento automatico.'};
    return {eligible:false,code:ELIGIBILITY_CODES.MEMBERSHIP_REQUIRED,event_id:eventId,mode,candidate:'NEW_UNREGISTERED',requires_existing_pair:true,message:'Questo evento è riservato: per verificare Centro e tesseramento devi usare un binomio già registrato oppure farlo creare/tesserare dallo staff o dal Centro Associato.'};
  }

  const moneyRound=v=>Math.round((Number(v)||0)*100)/100;
  function financeReversed(a,targetType,targetId){return moneyRound((a.accounting_reversals||[]).filter(r=>String(r.target_type||'').toUpperCase()===String(targetType).toUpperCase()&&String(r.target_id)===String(targetId)).reduce((n,r)=>n+Math.max(0,Number(r.amount||0)),0));}
  function financeEffective(a,type,row){return Math.max(0,moneyRound(Number(row?.amount||0)-financeReversed(a,type,row?.id)));}
  function financeAllocationEffective(a,row){return financeEffective(a,'ALLOCATION',row);}
  function financeChargeOutstanding(a,charge){const eff=financeEffective(a,'CHARGE',charge),allocated=(a.payment_allocations||[]).filter(x=>String(x.charge_id)===String(charge.id)).reduce((n,x)=>n+financeAllocationEffective(a,x),0);return Math.max(0,moneyRound(eff-allocated));}
  function financePaymentAvailable(a,payment){const eff=financeEffective(a,'PAYMENT',payment),allocated=(a.payment_allocations||[]).filter(x=>String(x.payment_id)===String(payment.id)).reduce((n,x)=>n+financeAllocationEffective(a,x),0);return Math.max(0,moneyRound(eff-allocated));}
  function financePosition(pairId,filters,adminData){
    const a=normalizeAdmin(clone(adminData||{})),f=filters||{};
    const match=c=>String(c.pair_id)===String(pairId)&&(!f.domain||String(c.domain)===String(f.domain))&&(!f.reference_id||String(c.reference_id)===String(f.reference_id));
    const charges=(a.charges||[]).filter(match),chargeIds=new Set(charges.map(c=>String(c.id)));
    const due=moneyRound(charges.reduce((n,c)=>n+financeEffective(a,'CHARGE',c),0));
    const allocations=(a.payment_allocations||[]).filter(x=>chargeIds.has(String(x.charge_id)));
    const allocated=moneyRound(allocations.reduce((n,x)=>n+financeAllocationEffective(a,x),0));
    const scopedPaymentIds=new Set(allocations.map(x=>String(x.payment_id)));
    const payments=(a.payments||[]).filter(p=>{
      if(String(p.pair_id)!==String(pairId))return false;
      if(!f.domain&&!f.reference_id)return true;
      const hasIntent=!!String(p.intended_domain||p.intended_reference_id||'');
      const intentDomainOK=!f.domain||String(p.intended_domain||'')===String(f.domain);
      const intentRefOK=!f.reference_id||String(p.intended_reference_id||'')===String(f.reference_id);
      return (hasIntent&&intentDomainOK&&intentRefOK)||scopedPaymentIds.has(String(p.id));
    });
    const creditPayments=payments.filter(p=>{
      if(!f.domain&&!f.reference_id)return true;
      const hasIntent=!!String(p.intended_domain||p.intended_reference_id||'');
      return hasIntent&&(!f.domain||String(p.intended_domain||'')===String(f.domain))&&(!f.reference_id||String(p.intended_reference_id||'')===String(f.reference_id));
    });
    const unallocatedCredit=moneyRound(creditPayments.reduce((n,p)=>n+financePaymentAvailable(a,p),0));
    const explicitCredit=moneyRound((a.accounting_credits||[]).filter(c=>String(c.pair_id)===String(pairId)&&(!f.domain||!c.domain||String(c.domain)===String(f.domain))&&(!f.reference_id||!c.reference_id||String(c.reference_id)===String(f.reference_id))).reduce((n,c)=>n+financeEffective(a,'CREDIT',c),0));
    return {due,allocated,residual:Math.max(0,moneyRound(due-allocated)),unallocated_credit:unallocatedCredit,explicit_credit:explicitCredit,total_credit:moneyRound(unallocatedCredit+explicitCredit),charges,payments};
  }
  function sameFinanceIntent(existing,spec,kind){const amount=moneyRound(Math.max(0,Number(spec.amount||0))),pair=String(spec.pair_id||''),domain=String(spec.domain||spec.intended_domain||'').toUpperCase(),ref=String(spec.reference_id||spec.intended_reference_id||'');if(kind==='CHARGE')return String(existing.pair_id||'')===pair&&String(existing.domain||'').toUpperCase()===domain&&String(existing.reference_id||'')===ref&&moneyRound(existing.amount)===amount;return String(existing.pair_id||'')===pair&&String(existing.intended_domain||'').toUpperCase()===domain&&String(existing.intended_reference_id||'')===ref&&moneyRound(existing.amount)===amount;}
  function financeEnsureChargeIn(a,spec){a.charges=a.charges||[];const source=String(spec.source_key||''),existing=source?a.charges.find(c=>c.source_key===source):null;if(existing){if(!sameFinanceIntent(existing,spec,'CHARGE'))throw new Error(`IDEMPOTENCY_CONFLICT: source_key ${source} già usata per un addebito diverso.`);return existing}const row={id:maxId('CHG',a.charges),source_key:source||undefined,pair_id:String(spec.pair_id||''),domain:String(spec.domain||'EVENT').toUpperCase(),reference_id:String(spec.reference_id||''),event_id:spec.event_id||'',membership_id:spec.membership_id||'',description:spec.description||'Addebito',amount:moneyRound(Math.max(0,Number(spec.amount||0))),date:spec.date||today(),created_at:spec.created_at||nowIso(),created_by:spec.created_by||'OFFLINE'};a.charges.push(row);return row;}
  function financePaymentIn(a,spec){a.payments=a.payments||[];const source=String(spec.source_key||''),existing=source?a.payments.find(p=>p.source_key===source):null;if(existing){if(!sameFinanceIntent(existing,spec,'PAYMENT'))throw new Error(`IDEMPOTENCY_CONFLICT: source_key ${source} già usata per un pagamento diverso.`);return existing}const row={id:maxId('PAY',a.payments),source_key:source||undefined,pair_id:String(spec.pair_id||''),intended_domain:String(spec.domain||spec.intended_domain||'').toUpperCase(),intended_reference_id:String(spec.reference_id||spec.intended_reference_id||''),amount:moneyRound(Math.max(0,Number(spec.amount||0))),date:spec.date||today(),method:spec.method||'NON_SPECIFICATO',description:spec.description||'Pagamento',created_at:spec.created_at||nowIso(),created_by:spec.created_by||'OFFLINE'};a.payments.push(row);return row;}
  function financeAllocateIn(a,paymentId,chargeId,amount){a.payment_allocations=a.payment_allocations||[];const pay=(a.payments||[]).find(x=>String(x.id)===String(paymentId)),charge=(a.charges||[]).find(x=>String(x.id)===String(chargeId));if(!pay||!charge)throw new Error('Pagamento o addebito non trovato.');if(String(pay.pair_id)!==String(charge.pair_id))throw new Error('Allocazione tra binomi diversi non consentita.');const available=financePaymentAvailable(a,pay),outstanding=financeChargeOutstanding(a,charge),wanted=amount==null?Math.min(available,outstanding):Math.max(0,Number(amount));const value=moneyRound(Math.min(wanted,available,outstanding));if(value<=0)return null;const row={id:maxId('ALL',a.payment_allocations),payment_id:pay.id,charge_id:charge.id,pair_id:pay.pair_id,amount:value,created_at:nowIso(),created_by:'OFFLINE'};a.payment_allocations.push(row);return row;}
  function financeAutoAllocateIn(a,paymentId,filter){const pay=(a.payments||[]).find(x=>String(x.id)===String(paymentId));if(!pay)return[];const f=filter||{},charges=(a.charges||[]).filter(c=>String(c.pair_id)===String(pay.pair_id)&&(!f.domain||String(c.domain)===String(f.domain))&&(!f.reference_id||String(c.reference_id)===String(f.reference_id))).sort((x,y)=>String(x.date||x.created_at||'').localeCompare(String(y.date||y.created_at||''))),rows=[];for(const c of charges){if(financePaymentAvailable(a,pay)<=0)break;const row=financeAllocateIn(a,pay.id,c.id);if(row)rows.push(row)}return rows;}
  function financeReverseIn(a,spec){a.accounting_reversals=a.accounting_reversals||[];const source=String(spec.source_key||''),existing=source?a.accounting_reversals.find(r=>String(r.source_key||'')===source):null;if(existing)return existing;const type=String(spec.target_type||'').toUpperCase(),id=String(spec.target_id||''),reason=String(spec.reason||'').trim(),collections={CHARGE:a.charges||[],PAYMENT:a.payments||[],ALLOCATION:a.payment_allocations||[],CREDIT:a.accounting_credits||[]},target=(collections[type]||[]).find(x=>String(x.id)===id);if(!target)throw new Error('Movimento da stornare non trovato.');if(!reason)throw new Error('Motivazione storno obbligatoria.');const remaining=Math.max(0,moneyRound(Number(target.amount||0)-financeReversed(a,type,id))),amount=moneyRound(spec.amount==null?remaining:Math.min(remaining,Math.max(0,Number(spec.amount||0))));if(amount<=0)throw new Error('Importo storno non valido o già completamente stornato.');const cascade=[];if(type==='PAYMENT'||type==='CHARGE'){let need=amount;const allocs=(a.payment_allocations||[]).filter(x=>(type==='PAYMENT'?String(x.payment_id)===id:String(x.charge_id)===id)&&financeAllocationEffective(a,x)>0).sort((x,y)=>String(y.created_at||'').localeCompare(String(x.created_at||'')));for(const al of allocs){if(need<=0)break;const v=Math.min(need,financeAllocationEffective(a,al));const rr=financeReverseIn(a,{target_type:'ALLOCATION',target_id:al.id,amount:v,reason:'Disallocazione collegata · '+reason,created_by:spec.created_by});cascade.push(rr);need=moneyRound(need-v)}}const row={id:maxId('REV',a.accounting_reversals),source_key:source||undefined,target_type:type,target_id:id,pair_id:target.pair_id||'',amount,reason,created_at:nowIso(),created_by:spec.created_by||'OFFLINE'};a.accounting_reversals.push(row);row.cascade_reversal_ids=cascade.map(x=>x.id);return row;}

  function checkinResetIn(a,p,spec){
    ({pub:p,adm:a}=migrateEventSecrets(p||{},a||{}));a=normalizeAdmin(a);p=normalizePublic(p);spec=spec||{};
    const eventId=String(spec.event_id||''),registrationId=String(spec.registration_id||''),pairId=String(spec.pair_id||''),dayId=String(spec.day_id||''),reason=String(spec.reason||'').trim(),actor=String(spec.actor||'OFFLINE');
    const event=(p.events||[]).find(e=>String(e.id)===eventId);if(!event)throw new Error('Evento non trovato.');
    const expected=String(a.event_security?.[eventId]?.pin||'');if(!/^\d{4}$/.test(expected)||String(spec.pin||'')!==expected)throw new Error('PIN evento errato. Nessuna modifica eseguita.');
    if(!reason)throw new Error('Motivazione reset obbligatoria.');
    const r=(a.registrations||[]).find(x=>(registrationId&&String(x.id)===registrationId)||(!registrationId&&String(x.event_id)===eventId&&String(x.pair_id)===pairId));if(!r||String(r.event_id)!==eventId)throw new Error('Iscrizione non trovata per questo evento.');
    const pid=String(r.pair_id),sameScope=x=>String(x.event_id)===eventId&&String(x.pair_id)===pid&&(!dayId||String(x.day_id||'')===dayId),meaningfulRun=(a.race_runs||[]).some(x=>sameScope(x)&&(x.completed===true||x.updated_at||x.time_cs!=null||x.time_s!=null||!['','IN GARA'].includes(String(x.status||'')))),raceEvent=(a.race_events||[]).some(sameScope),result=(p.results||[]).some(sameScope);
    if(meaningfulRun||raceEvent||result)throw new Error('RESET CHECK-IN BLOCCATO: esistono già dati sportivi della gara per questo binomio. Serve una correzione sportiva/SUPERADMIN, non un reset amministrativo.');
    const before=clone(r),paymentIds=new Set(dayId?[]:(r.checkin_payment_ids||[]).map(String));
    if(!dayId)(a.accounting||[]).filter(m=>String(m.event_id)===eventId&&String(m.pair_id)===pid&&Number(m.payment||0)>0&&/check-?in/i.test(String(m.description||''))).forEach(m=>paymentIds.add('PAY-L-'+String(m.id||'')));
    const reversedPayments=[];
    paymentIds.forEach(id=>{const pay=(a.payments||[]).find(x=>String(x.id)===id);if(!pay)return;const remaining=financeEffective(a,'PAYMENT',pay);if(remaining<=0)return;const rr=financeReverseIn(a,{target_type:'PAYMENT',target_id:pay.id,amount:remaining,reason:'RESET CHECK-IN · '+reason,created_by:actor});reversedPayments.push({payment_id:pay.id,reversal_id:rr.id,amount:remaining});a.accounting=a.accounting||[];a.accounting.push({id:maxId('M',a.accounting),event_id:eventId,pair_id:pid,date:today(),type:'STORNO PAGAMENTO CHECK-IN',description:'Storno tracciabile da RESET CHECK-IN',debit:0,payment:-remaining,created_at:nowIso(),created_by:actor,finance_mirrored:true,linked_payment_id:pay.id,linked_reversal_id:rr.id})});
    if(a.race_pair_states&&a.race_pair_states[eventId+'|'+pid])delete a.race_pair_states[eventId+'|'+pid];
    const baseline=r.checkin_baseline||{},baseReg=baseline.registration_status||((r.registration_status==='RITIRATO')?'CONFERMATO':(r.registration_status||'CONFERMATO')),baseState=baseline.state||(['RITIRATO','NON AMMESSO'].includes(String(r.state||''))?'IN GARA':(r.state||'IN GARA'));
    if(dayId){const d=registrationDayState(r,dayId,true);Object.assign(d,{attendance_status:'ATTESO',admission_status:'DA_VERIFICARE',requirements_checked:false,checkin_reset_at:nowIso(),checkin_reset_by:actor,checkin_reset_reason:reason});['arrived_at','arrived_by','requirements_checked_at','requirements_checked_by','admitted_at','admitted_by','no_show_at','admission_override','admission_override_reason'].forEach(k=>delete d[k]);if((r.days||[]).length===1){r.attendance_status='ATTESO';r.admission_status='DA_VERIFICARE';r.requirements_checked=false;['arrived_at','arrived_by','requirements_checked_at','requirements_checked_by','admitted_at','admitted_by','no_show_at','admission_override','admission_override_reason'].forEach(k=>delete r[k])}}
    else{r.registration_status=baseReg;r.state=baseState;r.attendance_status=baseline.attendance_status||'ATTESO';r.admission_status=baseline.admission_status||'DA_VERIFICARE';r.requirements_checked=baseline.requirements_checked===true;['arrived_at','arrived_by','requirements_checked_at','requirements_checked_by','admitted_at','admitted_by','no_show_at','withdrawn_at','admission_override','admission_override_reason','last_payment_amount','last_payment_at','last_payment_by'].forEach(k=>delete r[k]);r.checkin_payment_ids=[];r.checkin_payment_reversal_ids=reversedPayments.map(x=>x.reversal_id)}
    const orderChanges=[];(a.start_orders||[]).filter(o=>String(o.event_id)===eventId&&o.generated_at&&(!dayId||String(o.day_id||'')===dayId)).forEach(o=>{const eligibleNow=(a.registrations||[]).filter(x=>String(x.event_id)===eventId&&(x.days||[]).includes(o.day_id)&&String(x.start_stage||'OPEN')===String(o.stage)&&registrationAdmission(x,o.day_id)==='AMMESSO'&&!['RITIRATO'].includes(String(x.registration_status||''))&&registrationAttendance(x,o.day_id)!=='NO_SHOW').map(x=>String(x.pair_id)),current=(o.current_order||[]).map(String),mismatch=eligibleNow.length!==current.length||eligibleNow.some(id=>!current.includes(id))||current.some(id=>!eligibleNow.includes(id));if(!mismatch)return;o.roster_review_required=true;o.roster_review_reason='RESET CHECK-IN · '+reason;o.roster_review_at=nowIso();o.publication_stale=true;o.version=Number(o.version||0)+1;o.changes=o.changes||[];o.changes.push({timestamp:nowIso(),pair_id:pid,type:'CHECKIN_RESET_ROSTER_CHANGE',user:actor,reason:'Ordine congelato: revisione manuale necessaria dopo reset check-in'});orderChanges.push(o.id||`${o.day_id}|${o.stage}`);const k=`${eventId}|${o.day_id}`,c=a.preflight_checks?.[k];if(c?.ready&&c.stage===o.stage){c.ready=false;c.invalidated_at=nowIso();c.invalidated_reason='Roster ammessi cambiato dopo il sorteggio: correggere con MODIFICA ORDINE e riconfermare il pre-gara.'}});
    r.checkin_reset_at=nowIso();r.checkin_reset_by=actor;r.checkin_reset_reason=reason;r.checkin_reset_day_id=dayId||'';
    const pos=financePosition(pid,{domain:'EVENT',reference_id:eventId},a);r.due=pos.due;r.paid=moneyRound(Number(pos.allocated||0)+Number(pos.total_credit||0));r.payment_status=pos.residual<=1e-9?'OK':'DA_COMPLETARE';
    const el=checkEventEligibility(pid,eventId,p,a);r.eligibility_code=el.code;r.eligibility_checked_at=nowIso();r.membership_id=el.membership?.membership_id||'';r.center_id=el.membership?.center_id||'';
    let pe=(p.entries||[]).find(x=>String(x.event_id)===eventId&&String(x.pair_id)===pid);if(pe){const statusFor=did=>r.registration_status==='RITIRATO'||r.state==='RITIRATO'?'RITIRATO':registrationAttendance(r,did)==='NO_SHOW'?'NON_PRESENTATO':registrationAdmission(r,did)==='AMMESSO'?'AMMESSO':registrationAttendance(r,did)==='PRESENTE'?'PRESENTE':r.registration_status==='CONFERMATO'?'ISCRITTO':'PREISCRITTO',publicCheckin=dayId?statusFor(dayId):(r.registration_status==='CONFERMATO'?'ISCRITTO':'PREISCRITTO');Object.assign(pe,{state:r.state,start_stage:r.start_stage,tps:r.tps,tps_status:r.tps_status,days:[...(r.days||[])],registration_status:r.registration_status||'',public_checkin_status:publicCheckin,public_checkin_by_day:Object.fromEntries((r.days||[]).map(did=>[did,statusFor(did)]))})}
    a.audit=a.audit||[];a.audit.unshift({timestamp:now(),user:actor,action:'RESET CHECK-IN',object:`${eventId} · ${pid}`,before:JSON.stringify(before),after:JSON.stringify(r),reason:`${reason}${reversedPayments.length?` · storni pagamenti: ${reversedPayments.map(x=>x.reversal_id).join(', ')}`:''}${orderChanges.length?` · ordini aggiornati: ${orderChanges.join(', ')}`:''}`});
    return {registration:r,reversed_payments:reversedPayments,updated_start_orders:orderChanges,eligibility:el};
  }


  function registrationDayState(r,dayId,create=true){
    if(!r||!dayId)return null;r.day_status=r.day_status||{};let d=r.day_status[dayId];
    if(!d&&create){d={attendance_status:'ATTESO',admission_status:'DA_VERIFICARE',requirements_checked:false};r.day_status[dayId]=d}
    if(d){if(!d.attendance_status)d.attendance_status='ATTESO';if(!d.admission_status)d.admission_status='DA_VERIFICARE';if(d.requirements_checked==null)d.requirements_checked=false}
    return d||null;
  }
  function registrationAttendance(r,dayId){const d=registrationDayState(r,dayId,false);if(d?.attendance_status)return d.attendance_status;return (r?.days||[]).length===1?(r?.attendance_status||'ATTESO'):'ATTESO'}
  function registrationAdmission(r,dayId){const d=registrationDayState(r,dayId,false);if(d?.admission_status)return d.admission_status;return (r?.days||[]).length===1?(r?.admission_status||'DA_VERIFICARE'):'DA_VERIFICARE'}
  function registrationRequirementsChecked(r,dayId){const d=registrationDayState(r,dayId,false);return d?d.requirements_checked===true:((r?.days||[]).length===1&&r?.requirements_checked===true)}
  function eventRegistrationDue(event,days){const n=[...new Set((days||[]).filter(Boolean))].length;if(!event||n===0)return 0;const one=Number(event?.pricing?.one_day??event?.entry_fee??0),multiRaw=event?.pricing?.two_day??event?.pricing?.multi_day??event?.two_day_fee??event?.multi_day_fee, multi=multiRaw==null||multiRaw===''?one*n:Number(multiRaw);if(n<=1)return Number.isFinite(one)?one:0;return Number.isFinite(multi)?multi:(Number.isFinite(one)?one*n:0)}
  function isUnlimitedEvent(event){return event?.unlimited_pairs===true||Number(event?.max_pairs)===0}

  const ROLE_PERMISSIONS={
    SUPERADMIN:['*'],
    ADMIN1:['EVENTI','BINOMI','ISCRIZIONI','PREREGISTRAZIONI','NEWS','ORDINE_GARA','GARA','GALLERY','CONTABILITA','GIUDICI','AUDIT','IMPOSTAZIONI','IMPORT_BACKUP'],
    ADMIN2:['EVENTI','BINOMI','ISCRIZIONI','PREREGISTRAZIONI','NEWS','ORDINE_GARA','GARA','GALLERY','CONTABILITA','GIUDICI','AUDIT','IMPOSTAZIONI','IMPORT_BACKUP'],
    GIUDICE:['GARA_GIUDICE','ORDINE_GARA','NEWS'],
    CENTRO_ASSOCIATO:['CENTRO_EVENTO'],
    FRONT_OFFICE:['FRONT_OFFICE','CHECKIN','BINOMI','ISCRIZIONI','PREREGISTRAZIONI','CONTABILITA','TESSERAMENTI','TESSERINI','STORICO_READ','RACE_CONTROL','ORDINE_GARA','GARA_DELEGATA','RISULTATI_PRINT']
  };

  function storageSnapshot(){
    const storage={};
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k)continue;if(/^aquatrail_(public|admin)_/i.test(k)||/^AQUA_EVENT_DOC_/i.test(k)||k===REPORTKEY||k===WORKSPACE_KEY)storage[k]=localStorage.getItem(k)}}catch(_){ }
    return {format:'AQUATRAIL_STORAGE_RECOVERY',format_version:2,created_at:nowIso(),site_version:BUILD_RELEASE,storage,merged_public:clone(ensureMigration().publicData),merged_admin:clone(ensureMigration().adminData)};
  }

  function importRecoveryBundle(bundle){
    assertLocalAuthority('IMPORT RECOVERY');
    if(!bundle||typeof bundle!=='object')throw new Error('Pacchetto recupero non valido.');
    const before=ensureMigration(true),sourcesPub=[],sourcesAdm=[];
    const add=(kind,key,data)=>{if(!data||!isObj(data))return;(kind==='PUBLIC'?sourcesPub:sourcesAdm).push({key,data})};
    if(bundle.storage&&isObj(bundle.storage))Object.entries(bundle.storage).forEach(([k,v])=>{
      const d=typeof v==='string'?safeJson(v):v;
      if(k.startsWith('aquatrail_public_'))add('PUBLIC','IMPORT:'+k,d);
      if(k.startsWith('aquatrail_admin_'))add('ADMIN','IMPORT:'+k,d);
    });
    if(bundle.storage_recovery?.storage&&isObj(bundle.storage_recovery.storage))Object.entries(bundle.storage_recovery.storage).forEach(([k,v])=>{
      const d=typeof v==='string'?safeJson(v):v;
      if(k.startsWith('aquatrail_public_'))add('PUBLIC','IMPORT:BACKUP:'+k,d);
      if(k.startsWith('aquatrail_admin_'))add('ADMIN','IMPORT:BACKUP:'+k,d);
    });
    if(bundle.public_data)add('PUBLIC','IMPORT:FULL_BACKUP_PUBLIC',bundle.public_data);
    if(bundle.admin_data)add('ADMIN','IMPORT:FULL_BACKUP_ADMIN',bundle.admin_data);
    if(bundle.merged_public)add('PUBLIC','IMPORT:RECOVERY_MERGED_PUBLIC',bundle.merged_public);
    if(bundle.merged_admin)add('ADMIN','IMPORT:RECOVERY_MERGED_ADMIN',bundle.merged_admin);
    if(!sourcesPub.length&&!sourcesAdm.length)throw new Error('Il file non contiene dati Aqua Trail riconoscibili.');
    const report={migration_id:MIGRATION_ID+'_IMPORT_'+Date.now(),site_version:BUILD_RELEASE,ran_at:nowIso(),sources:[],recovered_records:0,filled_values:0,conflicts_kept_current:0,conflict_samples:[],events_seen:[],warnings:[],persisted:false};
    const pub=mergeDataset('PUBLIC',window.AQUATRAIL_DATA||{},before.publicData,sourcesPub,true,report);
    const adm=mergeDataset('ADMIN',window.AQUATRAIL_ADMIN_DATA||{},before.adminData,sourcesAdm,true,report);
    normalizePublic(pub);normalizeAdmin(adm);stampWorkspaceRows(pub,PUBLIC_WORKSPACE_ARRAYS,[],'DEMO');stampWorkspaceRows(adm,ADMIN_WORKSPACE_ARRAYS,ADMIN_WORKSPACE_MAPS,'DEMO');pub.meta=overlay(pub.meta||{},{version:BUILD_RELEASE,schema_version:DATA_SCHEMA_VERSION});adm.meta=overlay(adm.meta||{},{version:BUILD_RELEASE,schema_version:DATA_SCHEMA_VERSION});
    adm.audit=adm.audit||[];adm.audit.unshift({timestamp:now(),user:(safeJson(sessionStorage.getItem(SESSION))||{}).username||'SUPERADMIN',action:'RECUPERO DATI VERSIONE PRECEDENTE',object:'DATABASE OFFLINE',before:'Dati correnti preservati',after:`${report.recovered_records} record aggiunti`,reason:'Import recupero non distruttivo',migration_id:report.migration_id});
    save(PUBKEY,pub);save(ADMKEY,adm);report.persisted=true;report.events_seen=(pub.events||[]).map(e=>({id:e.id,name:e.name,start_date:e.start_date||''}));
    migrationCache={publicData:pub,adminData:adm,report};
    try{localStorage.setItem(REPORTKEY,JSON.stringify({...report,conflict_samples:report.conflict_samples.slice(0,30)}))}catch(_){ }
    return report;
  }

  function requireSuperAdminScope(){const s=safeJson(sessionStorage.getItem(SESSION));if(!s||s.role!=='SUPERADMIN')throw new Error('OPERAZIONE RISERVATA AL SUPERADMIN.');return s;}
  function recordIdentityMatch(row,id){id=String(id||'');return ['id','membership_id','username','pair_id','judge_id','organizer_id'].some(k=>row&&row[k]!=null&&String(row[k])===id);}
  function setPathValue(obj,path,value){const parts=String(path||'').split('.').filter(Boolean);if(!parts.length)throw new Error('Campo/percorso obbligatorio.');let cur=obj;for(let i=0;i<parts.length-1;i++){const k=parts[i];if(!isObj(cur[k]))cur[k]={};cur=cur[k]}cur[parts[parts.length-1]]=value;}
  function superAdminForcePatchIn(spec){const actor=requireSuperAdminScope(),db=String(spec.database||'').toUpperCase(),collection=String(spec.collection||''),rid=String(spec.record_id||''),field=String(spec.field||''),reason=String(spec.reason||'').trim();if(reason.length<8)throw new Error('Motivazione obbligatoria di almeno 8 caratteri.');if(!['PUBLIC','ADMIN'].includes(db))throw new Error('Database non valido.');const data=db==='PUBLIC'?normalizePublic(clone(ensureMigration().publicData)):normalizeAdmin(clone(ensureMigration().adminData)),list=data[collection];if(!Array.isArray(list))throw new Error('Collezione non trovata o non modificabile come lista.');const matches=list.filter(x=>recordIdentityMatch(x,rid));if(!matches.length)throw new Error('Record non trovato con questo ID.');if(matches.length>1)throw new Error('ID ambiguo: più record corrispondono. Usa l’ID univoco del record.');const row=matches[0],before=clone(row);setPathValue(row,field,spec.value);if(db==='PUBLIC'){normalizePublic(data);save(PUBKEY,data);if(migrationCache)migrationCache.publicData=clone(data)}else{normalizeAdmin(data);save(ADMKEY,data);if(migrationCache)migrationCache.adminData=clone(data)}const a=normalizeAdmin(clone(ensureMigration().adminData));a.audit=a.audit||[];a.audit.unshift({timestamp:now(),user:actor.username||'SUPERADMIN',action:'SUPERADMIN FORZA MODIFICA / SBLOCCA',object:`${db}.${collection} · ${rid} · ${field}`,before:JSON.stringify(before),after:JSON.stringify(row),reason});save(ADMKEY,a);if(migrationCache)migrationCache.adminData=clone(a);return clone(row);}
  function setFieldVisibilityIn(spec){const actor=requireSuperAdminScope(),page=String(spec.page||'*').trim()||'*',selector=String(spec.selector||'').trim(),hidden=!!spec.hidden,reason=String(spec.reason||'').trim();if(!selector)throw new Error('Selettore campo obbligatorio.');if(reason.length<8)throw new Error('Motivazione obbligatoria di almeno 8 caratteri.');const a=normalizeAdmin(clone(ensureMigration().adminData));a.ui_field_visibility=a.ui_field_visibility||[];let r=a.ui_field_visibility.find(x=>x.page===page&&x.selector===selector),before=r?clone(r):null;if(!r){r={id:maxId('FV',a.ui_field_visibility),page,selector};a.ui_field_visibility.push(r)}Object.assign(r,{hidden,updated_at:nowIso(),updated_by:actor.username||'SUPERADMIN',reason});a.audit=a.audit||[];a.audit.unshift({timestamp:now(),user:actor.username||'SUPERADMIN',action:hidden?'SUPERADMIN NASCONDI CAMPO':'SUPERADMIN MOSTRA CAMPO',object:`${page} · ${selector}`,before:before?JSON.stringify(before):'',after:JSON.stringify(r),reason});save(ADMKEY,a);if(migrationCache)migrationCache.adminData=clone(a);return clone(r);}
  window.ATStore={
    VERSION:BUILD_RELEASE,SCHEMA_VERSION:DATA_SCHEMA_VERSION,PUBKEY,ADMKEY,SESSION,DEMO_GATE,WORKSPACE_KEY,
    authorityMode(){return localAuthorityAllowed()?'OFFLINE_LOCAL_AUTHORITY':(dataApi()?.isOnline?.()?'ONLINE_API_ADAPTER':'ONLINE_SERVER_REQUIRED');},
    localAuthorityAllowed,
    assertLocalAuthority,
    public(){const ws=activeWorkspace();if(onlineApiActive())return filterWorkspaceDataset('PUBLIC',normalizePublic(clone(dataApi().publicData())),ws);if(!localAuthorityAllowed())return filterWorkspaceDataset('PUBLIC',normalizePublic(clone(window.AQUATRAIL_DATA||{})),ws);return filterWorkspaceDataset('PUBLIC',normalizePublic(clone(ensureMigration().publicData)),ws);},
    admin(){const ws=activeWorkspace();if(onlineApiActive())return filterWorkspaceDataset('ADMIN',normalizeAdmin(clone(dataApi().adminData())),ws);assertLocalAuthority('LETTURA ADMIN');const m=ensureMigration();refreshAdminCacheFromStorage();return filterWorkspaceDataset('ADMIN',normalizeAdmin(clone(m.adminData)),ws);},
    adminRevision(x){if(onlineApiActive()&&!x)return dataApi().revision('admin');return adminRevisionOf(x||this.admin());},
    savePublic(x){const ws=activeWorkspace();normalizePublic(x);stampWorkspaceRows(x,PUBLIC_WORKSPACE_ARRAYS,[],ws);if(onlineApiActive())return dataApi().commitState('public',clone(x),{workspace:ws});assertLocalAuthority('SALVATAGGIO PUBLIC');const full=normalizePublic(clone(ensureMigration().publicData)),merged=mergeWorkspaceDataset('PUBLIC',x,full,ws);normalizePublic(merged);save(PUBKEY,merged);if(migrationCache)migrationCache.publicData=clone(merged);return x;},
    saveAdmin(x){const ws=activeWorkspace();normalizeAdmin(x);stampWorkspaceRows(x,ADMIN_WORKSPACE_ARRAYS,ADMIN_WORKSPACE_MAPS,ws);if(onlineApiActive())return dataApi().commitState('admin',clone(x),{workspace:ws});const full=normalizeAdmin(clone(ensureMigration().adminData)),merged=mergeWorkspaceDataset('ADMIN',x,full,ws);return persistAdmin(merged,null),x;},
    saveAdminChecked(x,expectedRevision){const ws=activeWorkspace();normalizeAdmin(x);stampWorkspaceRows(x,ADMIN_WORKSPACE_ARRAYS,ADMIN_WORKSPACE_MAPS,ws);if(onlineApiActive())return dataApi().commitState('admin',clone(x),{expected_revision:expectedRevision,workspace:ws});const full=normalizeAdmin(clone(ensureMigration().adminData)),merged=mergeWorkspaceDataset('ADMIN',x,full,ws);persistAdmin(merged,expectedRevision);return x;},
    isConflictError(err){return err?.code===ADMIN_CONFLICT_CODE||String(err?.message||'').includes('CONFLITTO DATI');},
    withAdminLock(name,fn,options){return withAdminLock(name,fn,options);},
    appendAudit(adminData,action,object,before,after,reason){const a=adminData||this.admin(),s=this.session();a.audit=a.audit||[];a.audit.unshift({timestamp:now(),user:s?.username||'OFFLINE',action,object,before:before??'',after:after??'',reason:reason||''});return a.audit[0];},
    // Il reset non cancella MAI i namespace legacy: restano una rete di recupero.
    reset(){assertLocalAuthority('RESET STORAGE');localStorage.removeItem(PUBKEY);localStorage.removeItem(ADMKEY);localStorage.removeItem(WORKSPACE_KEY);clearBrowserAuth();migrationCache=null;},
    rerunMigration(){migrationCache=null;return ensureMigration(true).report;},
    migrationReport(){return clone(ensureMigration().report);},
    exportStorageSnapshot:storageSnapshot,
    importRecoveryBundle,
    session(){if(onlineApiActive())return clone(dataApi().sessionData());if(!localAuthorityAllowed())return null;try{const s=JSON.parse(sessionStorage.getItem(SESSION)||'null');if(!s)return null;const c=workspaceConfig();if(Number(s.workspace_epoch||0)!==Number(c.epoch)||normalizeWorkspace(s.workspace)!==normalizeWorkspace(c.mode)){clearBrowserAuth();return null}return s}catch(e){return null}},
    login(username,password){if(onlineApiActive())throw onlineCommandError('LOGIN');assertLocalAuthority('LOGIN LOCALE');const a=this.admin(),u=String(username||'').trim().toLowerCase();const acc=(a.offline_accounts||[]).find(x=>String(x.username||'').toLowerCase()===u&&String(x.password??'')===String(password??''));if(!acc||acc.enabled===false)return null;this.saveAdmin(a);const c=workspaceConfig(),s={username:acc.username,role:acc.role,judge_id:acc.judge_id||null,center_id:acc.center_id||null,event_id:acc.event_id||null,owner:acc.owner||null,capabilities:clone(acc.capabilities||{}),force_password_change:!!acc.force_password_change,login_at:now(),authority:'OFFLINE_LOCAL',workspace:c.mode,workspace_epoch:c.epoch};sessionStorage.setItem(SESSION,JSON.stringify(s));return s;},
    logout(){clearBrowserAuth();if(onlineApiActive()){const p=dataApi().logout();Promise.resolve(p).finally(()=>{clearBrowserAuth();location.replace('login-admin.html?logout=1')});return p}location.replace('accesso-riservato.html?logout=1');},
    requireSession(){const s=this.session();if(!s)location.href='accesso-riservato.html';return s;},
    requireAdmin(){const s=this.requireSession();if(!s)return null;if(s.role==='GIUDICE'){location.href='gara-giudice.html';return null;}if(s.role==='CENTRO_ASSOCIATO'){location.href='centro-evento.html';return null;}if(s.role==='FRONT_OFFICE'){location.href='frontoffice.html';return null;}return s;},
    isSuperAdmin(){return this.session()?.role==='SUPERADMIN';},
    isFrontOffice(){return this.session()?.role==='FRONT_OFFICE';},
    can(permission){const s=this.session();if(!s)return false;const list=ROLE_PERMISSIONS[s.role]||[];return list.includes('*')||list.includes(permission);},
    assignedEvents(publicData){const s=this.session(),p=publicData||this.public();if(!s)return[];if(s.role==='GIUDICE'){const judgeId=String(s.judge_id||'');return judgeId?(p.events||[]).filter(e=>String(e.judge_id||'')===judgeId):[];}if(s.role==='CENTRO_ASSOCIATO'){const eid=String(s.event_id||''),cid=String(s.center_id||'');return (p.events||[]).filter(e=>(!eid||String(e.id)===eid)&&(!cid||String(e.organizer_id||'')===cid));}if(s.role==='FRONT_OFFICE'){const eid=String(s.event_id||'');return eid?(p.events||[]).filter(e=>String(e.id)===eid):[];}return (p.events||[]).slice();},
    allowedEventIds(publicData){return this.assignedEvents(publicData).map(e=>e.id);},
    centers(publicData){const p=publicData||this.public();return (p.organizers||[]).map(c=>({...c,center_id:c.center_id||c.id}));},
    memberships(adminData){const a=adminData||this.admin();return (a.memberships||[]).slice();},
    currentMembership(pairId,adminData,seasonId){const a=adminData||this.admin(),season=seasonId||this.public().season?.id||'',rows=(a.memberships||[]).filter(m=>String(m.pair_id)===String(pairId)&&(!season||String(m.season_id||'')===String(season)));return rows.find(m=>String(m.status||'').toUpperCase()==='ATTIVO')||rows.slice().sort((x,y)=>String(y.valid_to||'').localeCompare(String(x.valid_to||'')))[0]||null;},
    centerById(centerId,publicData){const p=publicData||this.public();return (p.organizers||[]).find(c=>String(c.id)===String(centerId))||null;},
    membershipStateForEvent(pairId,eventId,publicData,adminData){const p=publicData||this.public(),a=adminData||this.admin(),e=(p.events||[]).find(x=>String(x.id)===String(eventId));return e?membershipStateForEvent(pairId,e,a):{ok:false,membership:null,code:ELIGIBILITY_CODES.EVENT_NOT_FOUND};},
    membershipCardToken,
    membershipByToken(token,adminData){return membershipByToken(token,adminData||this.admin());},
    pairProvenance(pairId,eventId,publicData,adminData){return pairProvenance(pairId,eventId,publicData||this.public(),adminData||this.admin());},
    checkEventEligibility(pairId,eventId,publicData,adminData){return checkEventEligibility(pairId,eventId,publicData||this.public(),adminData||this.admin());},
    checkPreregEligibility(pairId,eventId,publicData,adminData){return checkPreregEligibility(pairId,eventId,publicData||this.public(),adminData||this.admin());},
    eligibilityMessage,
    registrationDayState,registrationAttendance,registrationAdmission,registrationRequirementsChecked,eventRegistrationDue,isUnlimitedEvent,
    financePosition(pairId,filters,adminData){return financePosition(pairId,filters||{},adminData||this.admin());},
    financeEnsureCharge(spec,adminData){const a=adminData||this.admin(),row=financeEnsureChargeIn(a,spec);if(!adminData)this.saveAdmin(a);return row;},
    financeRecordPayment(spec,adminData){const a=adminData||this.admin(),row=financePaymentIn(a,spec);if(spec.auto_allocate!==false)financeAutoAllocateIn(a,row.id,spec.allocate_filter||{});if(!adminData)this.saveAdmin(a);return row;},
    financeAllocate(paymentId,chargeId,amount,adminData){const a=adminData||this.admin(),row=financeAllocateIn(a,paymentId,chargeId,amount);if(!adminData)this.saveAdmin(a);return row;},
    financeAutoAllocate(paymentId,filter,adminData){const a=adminData||this.admin(),rows=financeAutoAllocateIn(a,paymentId,filter||{});if(!adminData)this.saveAdmin(a);return rows;},
    financeReverse(spec,adminData){const a=adminData||this.admin(),row=financeReverseIn(a,spec);if(!adminData)this.saveAdmin(a);return row;},
    resetCheckin(spec,adminData,publicData){const a=adminData||this.admin(),p=publicData||this.public(),out=checkinResetIn(a,p,spec);if(!adminData)this.saveAdmin(a);if(!publicData)this.savePublic(p);return out;},
    ELIGIBILITY_CODES,
    canAccessEvent(eventId,publicData){const s=this.session(),p=publicData||this.public();if(!s)return false;if(s.role==='GIUDICE'){const judgeId=String(s.judge_id||'');if(!judgeId||!eventId)return false;const e=(p.events||[]).find(x=>String(x.id)===String(eventId));return !!e&&String(e.judge_id||'')===judgeId;}if(s.role==='CENTRO_ASSOCIATO'){const e=(p.events||[]).find(x=>String(x.id)===String(eventId));return !!e&&String(e.id)===String(s.event_id||'')&&String(e.organizer_id||'')===String(s.center_id||'');}if(s.role==='FRONT_OFFICE'){const e=(p.events||[]).find(x=>String(x.id)===String(eventId));return !!e&&String(e.id)===String(s.event_id||'');}return true;},
    assertEventAccess(eventId,publicData){if(!this.canAccessEvent(eventId,publicData))throw new Error('ACCESSO NEGATO: evento non assegnato a questo account.');return true;},
    requireSuperAdmin(){const s=this.requireAdmin();if(!s)return null;if(s.role!=='SUPERADMIN'){location.href='admin.html';return null;}return s;},
    superAdminForcePatch(spec){if(onlineApiActive())throw onlineCommandError('SUPERADMIN FORCE PATCH');return superAdminForcePatchIn(spec||{});},
    setFieldVisibility(spec){if(onlineApiActive())throw onlineCommandError('MODIFICA VISIBILITÀ CAMPI');return setFieldVisibilityIn(spec||{});},
    fieldVisibilityRules(adminData){return clone((adminData||this.admin()).ui_field_visibility||[]);},
    workspace(){return workspaceConfig();},
    activeWorkspace(){return activeWorkspace();},
    workspaceStats(){const m=ensureMigration();return workspaceStatsFrom(m.publicData,m.adminData);},
    workspaceBadge(item){return item&&recordWorkspace(item.workspace)==='DEMO'?'🧪':'';},
    switchWorkspace(nextMode,puk,reason){
      if(onlineApiActive())throw onlineCommandError('SWITCH WORKSPACE GLOBALE');assertLocalAuthority('SWITCH WORKSPACE');const actor=requireSuperAdminScope(),next=normalizeWorkspace(nextMode),current=workspaceConfig(),why=String(reason||'').trim();if(next===current.mode)return clone(current);if(why.length<5)throw new Error('Inserisci una breve motivazione dello switch.');const full=ensureMigration(),activeAdmin=filterWorkspaceDataset('ADMIN',normalizeAdmin(clone(full.adminData)),current.mode);if(hasRunningRace(activeAdmin))throw new Error('SWITCH BLOCCATO: esiste una gara/prova in corso. Chiudila prima di cambiare workspace.');const sec=full.adminData?.account_security?.[actor.username],expected=String(sec?.puk||'');if(!/^\d{8}$/.test(expected)||String(puk||'')!==expected)throw new Error('PUK SUPERADMIN non valido.');const a=normalizeAdmin(clone(full.adminData));a.audit=a.audit||[];const nextConfig={mode:next,epoch:Number(current.epoch||1)+1,updated_at:nowIso(),updated_by:actor.username||'SUPERADMIN',reason:why};a.audit.unshift({timestamp:now(),user:actor.username||'SUPERADMIN',action:'SWITCH WORKSPACE GLOBALE',object:'AQUA TRAIL',before:current.mode,after:next,reason:why,workspace_epoch:nextConfig.epoch});save(ADMKEY,a);if(migrationCache)migrationCache.adminData=clone(a);save(WORKSPACE_KEY,nextConfig);clearBrowserAuth();return clone(nextConfig);
    },
    eventPin(eventId){if(onlineApiActive())return '';const a=this.admin(),rec=a.event_security?.[eventId];return String(rec?.pin||'');},
    setEventPin(eventId,pin,adminData){assertLocalAuthority('SALVATAGGIO PIN EVENTO');const value=String(pin||'').trim();if(value&&!/^\d{4}$/.test(value))throw new Error('Il PIN evento deve contenere 4 cifre.');const a=adminData||this.admin();a.event_security=a.event_security||{};const rec=a.event_security[eventId]||(a.event_security[eventId]={event_id:eventId});if(value)rec.pin=value;else delete rec.pin;rec.pin_updated_at=nowIso();rec.pin_updated_by=this.session()?.username||'OFFLINE';if(!adminData)this.saveAdmin(a);return value;},
    verifyEventPin(eventId,pin){if(onlineApiActive())throw onlineCommandError('VERIFICA PIN EVENTO');if(!this.canAccessEvent(eventId))return false;const expected=this.eventPin(eventId);return /^\d{4}$/.test(expected)&&String(pin||'')===expected;},
    ensureEventPuk(eventId){if(onlineApiActive())throw onlineCommandError('GESTIONE PUK EVENTO');if(!eventId)return '';const a=this.admin();a.event_security=a.event_security||{};let rec=a.event_security[eventId],changed=false;if(!rec){rec={event_id:eventId,created_at:new Date().toISOString(),created_by:this.session()?.username||'SYSTEM'};a.event_security[eventId]=rec;changed=true}if(!/^\d{8}$/.test(String(rec.puk||''))){let puk=randomDigits(8);if(/^0+$/.test(puk))puk='7'+puk.slice(1);rec.puk=puk;rec.puk_updated_at=new Date().toISOString();rec.puk_updated_by=this.session()?.username||'SYSTEM';changed=true}if(changed)this.saveAdmin(a);return String(rec.puk||'');},
    ensureAllEventPuks(){if(onlineApiActive())throw onlineCommandError('GESTIONE PUK EVENTI');const p=this.public();(p.events||[]).forEach(e=>this.ensureEventPuk(e.id));return true;},
    eventPuk(eventId){if(onlineApiActive())return '';const a=this.admin();return String(a.event_security?.[eventId]?.puk||'');},
    verifyEventPuk(eventId,puk){if(onlineApiActive())throw onlineCommandError('VERIFICA PUK EVENTO');const expected=this.eventPuk(eventId)||this.ensureEventPuk(eventId);return /^\d{8}$/.test(expected)&&String(puk||'')===expected;},
    verifyHistoricalAccess(eventId,pin,puk){return this.verifyEventPin(eventId,pin)&&this.verifyEventPuk(eventId,puk);},
    isPastEvent(eventOrId){const p=this.public(),e=typeof eventOrId==='string'?(p.events||[]).find(x=>x.id===eventOrId):eventOrId;if(!e)return false;const d=e.end_date||e.start_date;if(!d)return false;return d<this.today();},
    verifyPin(pin,eventId){if(onlineApiActive())throw onlineCommandError('VERIFICA PIN');if(eventId&&this.eventPin(eventId))return this.verifyEventPin(eventId,pin);const s=this.session(),a=this.admin();if(!s)return false;const acc=(a.offline_accounts||[]).find(x=>x.username===s.username);return !!acc&&String(acc.correction_pin||'')===String(pin||'');},
    audit(action,object,before,after,reason){const a=this.admin();this.appendAudit(a,action,object,before,after,reason);this.saveAdmin(a);},
    id(prefix,list){return maxId(prefix,list);}, now,today,norm,handlerName,
    qs(name){return new URLSearchParams(location.search).get(name);},
    fmtDate(d){if(!d)return '—';return new Date(d+'T12:00:00').toLocaleDateString('it-IT');},
    fmtMoney(n){return `€ ${Number(n||0).toFixed(2)}`;}
  };
  try{window.addEventListener('storage',ev=>{if(ev.key===WORKSPACE_KEY&&sessionStorage.getItem(SESSION)){clearBrowserAuth();location.replace('accesso-riservato.html?workspace_changed=1')}})}catch(_){}
})();
