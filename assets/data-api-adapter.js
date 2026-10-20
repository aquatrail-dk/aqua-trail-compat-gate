(function(){
  'use strict';
  const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
  const cfg=()=>window.AQUATRAIL_RUNTIME||{};
  const isOnline=()=>String(cfg().mode||'').toUpperCase().startsWith('ONLINE');
  const TOKEN_KEY='aquatrail_api_session_token_v185';
  const state={public:null,admin:null,session:null,workspace:{mode:'DEMO',epoch:1},revisions:{public:0,admin:0},ready:false,pending:0,last_error:null};
  const err=(code,msg,detail)=>{const e=new Error(msg);e.code=code;if(detail!==undefined)e.detail=detail;return e};
  const endpoint=()=>String(cfg().api_base_url||'').trim();
  const validEndpoint=()=>{const u=endpoint();return !!u&&!/__SET_|REQUIRED|PLACEHOLDER/i.test(u)};
  const stable=o=>{if(o===null||typeof o!=='object')return JSON.stringify(o);if(Array.isArray(o))return '['+o.map(stable).join(',')+']';return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+stable(o[k])).join(',')+'}'};
  function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}
  function getToken(){try{return sessionStorage.getItem(TOKEN_KEY)||''}catch(_){return ''}}
  function setToken(v){try{v?sessionStorage.setItem(TOKEN_KEY,String(v)):sessionStorage.removeItem(TOKEN_KEY)}catch(_){}}
  function clearSession(reason){setToken('');state.session=null;state.admin=null;state.ready=false;state.last_error=reason||null;try{window.dispatchEvent(new CustomEvent('aquatrail:session-invalid',{detail:{reason:reason?.code||reason||'SESSION_INVALID'}}))}catch(_){}}
  function redirectToLogin(){if(typeof location==='undefined')return;const p=(location.pathname||'').split('/').pop()||'';if(p==='login-admin.html')return;const base=String(cfg().staff_login_url||'login-admin.html');location.replace(base)}
  function handleSessionFailure(e){const code=String(e?.code||'').toUpperCase();if(!['SESSION_EXPIRED','SESSION_REVOKED','WORKSPACE_CHANGED','SESSION_INVALID'].includes(code))return false;clearSession(e);if(String(cfg().audience||'STAFF').toUpperCase()==='STAFF')redirectToLogin();else try{window.dispatchEvent(new CustomEvent('aquatrail:public-refresh-required',{detail:{reason:code}}))}catch(_){};return true}
  const rowKey=r=>{if(!r||typeof r!=='object'||Array.isArray(r))return null;for(const k of ['id','membership_id','username'])if(r[k]!=null&&String(r[k])!=='')return `${k}:${r[k]}`;if(r.event_id&&r.pair_id&&r.stage)return `eps:${r.event_id}|${r.competition_id||''}|${r.pair_id}|${r.stage}|${r.day_id||r.event_day_id||''}`;if(r.event_id&&r.pair_id)return `ep:${r.event_id}|${r.competition_id||''}|${r.pair_id}|${r.day_id||r.event_day_id||''}`;if(r.event_id&&r.stage)return `es:${r.event_id}|${r.competition_id||''}|${r.stage}|${r.day_id||r.event_day_id||''}`;if(r.pair_id)return `p:${r.pair_id}`;return null};
  function diff(a,b,path=''){
    if(stable(a)===stable(b))return [];
    if(Array.isArray(a)&&Array.isArray(b)){
      const ak=a.map(rowKey),bk=b.map(rowKey),keyable=ak.every(Boolean)&&bk.every(Boolean)&&new Set(ak).size===ak.length&&new Set(bk).size===bk.length;
      if(keyable){const A=new Map(a.map(x=>[rowKey(x),x])),B=new Map(b.map(x=>[rowKey(x),x])),ops=[];for(const [k,v] of B){if(!A.has(k)||stable(A.get(k))!==stable(v))ops.push({op:'upsert',path,key:k,value:clone(v)})}for(const k of A.keys())if(!B.has(k))ops.push({op:'remove_row',path,key:k});return ops}
      return [{op:'replace',path,value:clone(b)}];
    }
    if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){
      const ops=[];for(const k of new Set([...Object.keys(a),...Object.keys(b)])){const p=path+'/'+String(k).replace(/~/g,'~0').replace(/\//g,'~1');if(!(k in b))ops.push({op:'remove',path:p});else if(!(k in a))ops.push({op:'add',path:p,value:clone(b[k])});else ops.push(...diff(a[k],b[k],p))}return ops
    }
    return [{op:'replace',path,value:clone(b)}];
  }
  async function request(action,payload={},options={}){
    if(!isOnline())throw err('AT_API_OFFLINE_MODE','API remota non usata in modalità offline.');
    if(!validEndpoint())throw err('AT_API_NOT_CONFIGURED','Endpoint Google Apps Script non configurato.');
    const request_id=options.request_id||`AT-${action}-${Date.now()}-${hash(stable(payload)).slice(0,6)}`;
    const token=getToken();
    const body={action,payload,request_id,session_token:token||undefined,client:{app:'AQUA_TRAIL',contract:cfg().online_contract||'',adapter:'ATDataAPI_V1_8_5',build_marker:window.AQUATRAIL_BUILD?.marker||null,build_release:window.AQUATRAIL_BUILD?.release||null}};
    let res;try{res=await fetch(endpoint(),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),redirect:'follow',cache:'no-store'})}catch(e){throw err('AT_API_NETWORK','Backend Apps Script non raggiungibile.',String(e?.message||e))}
    if(!res.ok)throw err('AT_API_HTTP',`Backend HTTP ${res.status}.`);
    let out;try{out=await res.json()}catch(_){throw err('AT_API_BAD_JSON','Risposta backend non valida.');}
    if(out?.ok===false){const e=err(out.error?.code||'AT_API_REJECTED',out.error?.message||'Operazione rifiutata dal backend.',out.error);handleSessionFailure(e);throw e}
    return out?.data!==undefined?out.data:out;
  }
  function absorb(data){
    if(!data||typeof data!=='object')return data;
    if(data.public_data!==undefined)state.public=clone(data.public_data);
    if(data.admin_data!==undefined)state.admin=clone(data.admin_data);
    if(data.session!==undefined)state.session=clone(data.session);
    if(data.workspace_config!==undefined)state.workspace=clone(data.workspace_config);else if(data.workspace!==undefined&&typeof data.workspace==='object')state.workspace=clone(data.workspace);
    if(data.revisions){if(data.revisions.public!=null)state.revisions.public=Number(data.revisions.public)||0;if(data.revisions.admin!=null)state.revisions.admin=Number(data.revisions.admin)||0}
    state.ready=true;return data;
  }
  async function health(){return request('health',{})}
  async function login(username,password){
    const data=await request('login',{username:String(username||''),password:String(password||'')});
    if(!data?.session_token)throw err('AT_API_LOGIN_PROTOCOL','Il backend non ha restituito un session token.');
    setToken(data.session_token);absorb(data);if(!state.session&&data?.user)state.session=clone(data.user);return clone(state.session);
  }
  async function logout(){try{if(getToken())await request('logout',{})}finally{clearSession('LOGOUT')}}
  async function staffBootstrap(context={}){const q=typeof location!=='undefined'?new URLSearchParams(location.search||''):null;const payload={page:context.page||((location?.pathname||'').split('/').pop()||'index.html'),event_id:context.event_id||(q?.get('event')||''),day_id:context.day_id||(q?.get('day')||''),view:context.view||'staff'};return absorb(await request('staff_bundle',payload))}
  async function publicBootstrap(context={}){const q=typeof location!=='undefined'?new URLSearchParams(location.search||''):null;const payload={page:context.page||((location?.pathname||'').split('/').pop()||'index.html'),event_id:context.event_id||(q?.get('event')||''),day_id:context.day_id||(q?.get('day')||''),view:'public'};return absorb(await request('public_bundle',payload))}
  const bootstrap=staffBootstrap;
  function requireCache(kind){const v=state[kind];if(v==null)throw err('AT_API_BOOTSTRAP_REQUIRED',`Cache ${kind} non inizializzata: attendere il bundle server.`);return clone(v)}
  function setCache(kind,value){state[kind]=clone(value);state.ready=true}
  const COMMAND_COLLECTIONS=Object.freeze({
    public:Object.freeze({
      events:{name:'event_mutation',table:'EVENTI',key:'ID'},
      event_days:{name:'event_mutation',table:'GIORNATE',key:'ID'},
      judges:{name:'event_mutation',table:'GIUDICI',key:'ID'},
      organizers:{name:'event_mutation',table:'CENTRI',key:'ID'},
      pairs:{name:'registration_mutation',table:'BINOMI',key:'ID'},
      entries:{name:'registration_mutation',table:'ISCRIZIONI',key:'ID'},
      stage_config:{name:'start_order_mutation',table:'CONFIG_PROVE',key:'ID'},
      results:{name:'race_mutation',table:'RISULTATI',key:'ID'},
      gallery:{name:'publication_mutation',table:'GALLERY',key:'ID'},
      event_news:{name:'publication_mutation',table:'EVENT_NEWS',key:'ID'}
    }),
    admin:Object.freeze({
      pair_private:{name:'registration_mutation',table:'BINOMI',key:'ID'},
      registrations:{name:'registration_mutation',table:'ISCRIZIONI',key:'ID'},
      memberships:{name:'registration_mutation',table:'TESSERAMENTI',key:'MEMBERSHIP_ID'},
      start_orders:{name:'start_order_mutation',table:'ORDINI_GARA',key:'ID'},
      race_runs:{name:'race_mutation',table:'RACE_RUNS',key:'ID'},
      race_events:{name:'race_mutation',table:'RACE_EVENTS',key:'ID'},
      charges:{name:'finance_mutation',table:'ADDEBITI',key:'ID'},
      payments:{name:'finance_mutation',table:'PAGAMENTI',key:'ID'},
      payment_allocations:{name:'finance_mutation',table:'ALLOC_PAGAMENTI',key:'ID'},
      accounting_reversals:{name:'finance_mutation',table:'STORNI',key:'ID'},
      accounting_credits:{name:'finance_mutation',table:'CREDITI',key:'ID'},
      preregistrations:{name:'registration_mutation',table:'PREREGISTRATIONS',key:'ID'},
      prereg_verifications:{name:'registration_mutation',table:'PREREG_VERIFICATIONS',key:'VERIFICATION_ID'},
      preflight_checks:{name:'start_order_mutation',table:'CHECK_PRE_GARA',key:'ID'},
      publication_history:{name:'publication_mutation',table:'PUBBLICAZIONI',key:'ID'},
      judges_admin:{name:'event_mutation',table:'GIUDICI',key:'ID'},
      organizers_admin:{name:'event_mutation',table:'CENTRI',key:'ID'}
    })
  });
  const COMMAND_BATCH_MAX_OPERATIONS=50,COMMAND_BATCH_MAX_CHARS=100000;
  const COMMAND_SERVER_FIELDS=new Set(['workspace','created_at','created_by','updated_at','updated_by','deleted_by','arrived_by','requirements_checked_by','admitted_by','checkin_reset_by','confirmed_by','generated_by','published_by','operator_user_id','source_key','safety_pin_salt','safety_pin_hash','puk_salt','puk_hash','password_salt','password_hash','token_hash','email_key']);
  function commandRecordId(row,mapping){const k=String(mapping.key||'ID').toLowerCase(),v=row&&row[k];return v==null||String(v)===''?null:String(v)}
  function commandIndex(rows,mapping,collection){
    const out=new Map();
    (Array.isArray(rows)?rows:[]).forEach(row=>{
      if(!row||typeof row!=='object'||Array.isArray(row))throw err('AT_API_RECORD_INVALID','Record non valido in '+collection+'.');
      const id=commandRecordId(row,mapping);
      if(!id)throw err('AT_API_RECORD_ID_REQUIRED','ID mancante in '+collection+'; nessuna modifica inviata.');
      if(out.has(id))throw err('AT_API_DUPLICATE_RECORD_ID','ID duplicato in '+collection+'; nessuna modifica inviata.');
      out.set(id,row);
    });
    return out;
  }
  function commandFields(row,previous,mapping,create){
    const out={};
    Object.keys(row||{}).forEach(k=>{
      const lower=String(k).toLowerCase(),upper=String(k).toUpperCase();
      if(COMMAND_SERVER_FIELDS.has(lower))return;
      if(!create&&lower===String(mapping.key||'ID').toLowerCase())return;
      if(!create&&previous&&stable(previous[k])===stable(row[k]))return;
      out[upper]=clone(row[k]);
    });
    if(create&&out[mapping.key]===undefined)out[mapping.key]=commandRecordId(row,mapping);
    return out;
  }
  function buildCommandPlan(target,previous,next){
    if(!Object.prototype.hasOwnProperty.call(COMMAND_COLLECTIONS,target))throw err('AT_API_TARGET','Target dati non valido.');
    const mappings=COMMAND_COLLECTIONS[target],before=previous||{},after=next||{},mutations=[],mutationKeys=new Set();
    const collections=new Set([...Object.keys(before),...Object.keys(after)]);
    collections.forEach(collection=>{
      if(stable(before[collection])===stable(after[collection])||collection==='audit'||collection==='meta')return;
      const mapping=mappings[collection];
      if(!mapping)throw err('AT_API_COLLECTION_UNSUPPORTED','Salvataggio online non supportato per "'+collection+'".');
      const oldRows=Array.isArray(before[collection])?before[collection]:[],newRows=Array.isArray(after[collection])?after[collection]:[];
      const oldById=commandIndex(oldRows,mapping,collection),newById=commandIndex(newRows,mapping,collection);
      for(const id of oldById.keys())if(!newById.has(id))throw err('AT_API_DELETE_DISABLED','La cancellazione di record ('+collection+') è disabilitata online.');
      newById.forEach((row,id)=>{
        const old=oldById.get(id);
        if(old&&stable(old)===stable(row))return;
        const operation=old&&String(old.updated_at||'')?'update':'create';
        const fields=commandFields(row,old,mapping,operation==='create');
        if(!Object.keys(fields).length)return;
        const payload={table:mapping.table,operation,id};
        const eventId=String(row.event_id||old&&old.event_id||(mapping.table==='EVENTI'?id:''));
        if(eventId)payload.event_id=eventId;
        if(operation==='create')payload.record=fields;
        else{
          if(!old.updated_at)throw err('AT_API_VERSION_REQUIRED','Versione record mancante in '+collection+'; ricarica i dati.');
          payload.expected_updated_at=String(old.updated_at);
          payload.changes=fields;
        }
        const mutationKey=mapping.table+':'+id;
        if(mutationKeys.has(mutationKey))throw err('AT_API_DUPLICATE_RECORD_ID','Lo stesso record compare in più raccolte; nessuna modifica inviata.');
        mutationKeys.add(mutationKey);
        mutations.push({name:mapping.name,payload,collection,id,operation,key:mapping.key});
      });
    });
    if(mutations.length>COMMAND_BATCH_MAX_OPERATIONS)throw err('AT_API_BATCH_SIZE_INVALID','La richiesta supera il limite di '+COMMAND_BATCH_MAX_OPERATIONS+' modifiche; nessuna modifica inviata.');
    if(mutations.length>1&&stable(mutations.map(m=>({name:m.name,payload:m.payload}))).length>COMMAND_BATCH_MAX_CHARS)throw err('AT_API_BATCH_TOO_LARGE','La richiesta supera il limite di dimensione; nessuna modifica inviata.');
    return mutations;
  }
  async function command(name,payload={},options={}){
    const body=Object.assign({},payload,{name:String(name||''),expected_revision:options.expected_revision??payload.expected_revision??null,workspace_epoch:state.workspace?.epoch??null});
    state.pending++;try{const data=await request('command',body,{request_id:options.request_id});absorb(data);return data}finally{state.pending--}
  }
  async function commitState(target,next,options={}){
    if(!['public','admin'].includes(target))throw err('AT_API_TARGET','Target dati non valido.');
    const prev=requireCache(target),patch=diff(prev,next,''),plan=buildCommandPlan(target,prev,next);
    if(!patch.length)return clone(prev);
    if(!plan.length){
      const meaningful=patch.some(x=>{const p=String(x.path||'');return p!=='/audit'&&p.indexOf('/audit/')!==0&&p!=='/meta'&&p.indexOf('/meta/')!==0});
      if(meaningful)throw err('AT_API_NO_DOMAIN_MUTATION','Nessuna modifica operativa supportata dal backend; dati non inviati.');
      return clone(prev);
    }
    const expected=options.expected_revision!=null?Number(options.expected_revision):Number(state.revisions[target]||0);
    const request_id=options.request_id||('AT-CMD-'+target+'-'+expected+'-'+hash(stable(plan)));
    const optimistic=clone(next);
    const mutation=plan.length>1
      ?{name:'atomic_batch',payload:{operations:plan.map(m=>({name:m.name,payload:m.payload}))}}
      :plan[0];
    state.pending++;state[target]=clone(optimistic);
    window.dispatchEvent?.(new CustomEvent('aquatrail:write-pending',{detail:{target,request_id}}));
    try{
      const result=await command(mutation.name,mutation.payload,{expected_revision:expected,request_id});
      plan.forEach(m=>{
        const row=(state[target]?.[m.collection]||[]).find(x=>commandRecordId(x,{key:m.key})===m.id);
        const written=mutation.name==='atomic_batch'?(result?.results||[]).find(x=>x.table===m.payload.table&&String(x.id)===String(m.id)):result;
        if(row&&written){if(written.updated_at)row.updated_at=written.updated_at;if(written.workspace)row.workspace=written.workspace}
      });
      let refreshError=null;
      try{if(getToken())await staffBootstrap();else await publicBootstrap()}
      catch(e){refreshError=e;state[target]=clone(optimistic);state.last_error=e}
      window.dispatchEvent?.(new CustomEvent('aquatrail:write-committed',{detail:{target,request_id,revision:state.revisions[target],refresh_error:refreshError?.code||null}}));
      return clone(state[target]);
    }catch(e){
      state[target]=prev;state.last_error=e;
      window.dispatchEvent?.(new CustomEvent('aquatrail:write-error',{detail:{target,request_id,error:e}}));
      throw e
    }finally{state.pending--}
  }
  async function verifySecret(kind,event_id,value){return request('verify_secret',{kind,event_id,secret:String(value||'')})}
  async function changePassword(current_password,new_password,new_password_confirm){const data=await request('change_password',{current_password:String(current_password||''),new_password:String(new_password||''),new_password_confirm:String(new_password_confirm||'')});if(data&&data.relogin_required)clearSession('PASSWORD_CHANGED');return data}
  window.ATDataAPI={VERSION:'ATDataAPI_V1_8_5',TOKEN_KEY,isOnline,configured:validEndpoint,endpoint,request,health,login,logout,bootstrap,staffBootstrap,publicBootstrap,command,commitState,verifySecret,changePassword,_buildCommandPlan:buildCommandPlan,publicData:()=>requireCache('public'),adminData:()=>requireCache('admin'),sessionData:()=>clone(state.session),workspaceConfig:()=>clone(state.workspace),revision:k=>Number(state.revisions[k]||0),pending:()=>state.pending,ready:()=>state.ready,lastError:()=>state.last_error,sessionTokenPresent:()=>!!getToken(),clearSession,_diff:diff,_absorb:absorb,_state:state};
})();
