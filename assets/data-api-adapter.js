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
  async function command(name,payload={},options={}){state.pending++;try{const data=await request('command',{name,payload,expected_revision:options.expected_revision??null,workspace_epoch:state.workspace?.epoch??null},{request_id:options.request_id});absorb(data);return data}finally{state.pending--}}
  async function commitState(target,next,options={}){if(!['public','admin'].includes(target))throw err('AT_API_TARGET','Target dati non valido.');const prev=requireCache(target),patch=diff(prev,next,'');if(!patch.length)return clone(next);const expected=options.expected_revision!=null?Number(options.expected_revision):Number(state.revisions[target]||0),request_id=options.request_id||`AT-PATCH-${target}-${expected}-${hash(stable(patch))}`;state.pending++;state[target]=clone(next);window.dispatchEvent?.(new CustomEvent('aquatrail:write-pending',{detail:{target,request_id}}));try{const data=await request('commit_patch',{target,expected_revision:expected,patch,workspace_epoch:state.workspace?.epoch??null},{request_id});if(data?.[target+'_data']!==undefined)state[target]=clone(data[target+'_data']);if(data?.revisions)absorb(data);else state.revisions[target]=expected+1;window.dispatchEvent?.(new CustomEvent('aquatrail:write-committed',{detail:{target,request_id,revision:state.revisions[target]}}));return clone(state[target])}catch(e){state[target]=prev;state.last_error=e;window.dispatchEvent?.(new CustomEvent('aquatrail:write-error',{detail:{target,request_id,error:e}}));throw e}finally{state.pending--}}
  async function verifySecret(kind,event_id,value){return request('verify_secret',{kind,event_id,value:String(value||'')})}
  window.ATDataAPI={VERSION:'ATDataAPI_V1_8_5',TOKEN_KEY,isOnline,configured:validEndpoint,endpoint,request,health,login,logout,bootstrap,staffBootstrap,publicBootstrap,command,commitState,verifySecret,publicData:()=>requireCache('public'),adminData:()=>requireCache('admin'),sessionData:()=>clone(state.session),workspaceConfig:()=>clone(state.workspace),revision:k=>Number(state.revisions[k]||0),pending:()=>state.pending,ready:()=>state.ready,lastError:()=>state.last_error,sessionTokenPresent:()=>!!getToken(),clearSession,_diff:diff,_absorb:absorb,_state:state};
})();
