(function(){
  'use strict';
  const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
  const api=()=>window.ATDataAPI||null;
  const online=()=>!!api()?.isOnline?.();
  const today=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),m=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${m.year}-${m.month}-${m.day}`;};
  const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const handlerName=p=>[p?.handler_first_name||p?.handler||'',p?.handler_last_name||''].filter(Boolean).join(' ').trim();
  window.ATStore={
    VERSION:'BETA_1_8_5_ONLINE_PUBLIC_BUNDLE',
    public(){if(online())return clone(api().publicData());return clone(window.AQUATRAIL_DATA||{});},
    workspace(){if(online())return clone(api().workspaceConfig());const m=window.AQUATRAIL_DATA?.meta||{};return {mode:String(m.active_workspace||'DEMO').toUpperCase(),epoch:Number(m.workspace_epoch||1)};},
    session(){return null;},can(){return false;},canAccessEvent(){return false;},
    today,norm,handlerName,
    isPastEvent(eventOrId){const p=this.public(),e=typeof eventOrId==='string'?(p.events||[]).find(x=>String(x.id)===String(eventOrId)):eventOrId;if(!e)return false;const d=e.end_date||e.start_date;if(!d)return false;return String(d)<today();},
    qs(name){return new URLSearchParams(location.search).get(name);},
    fmtDate(d){if(!d)return '—';return new Date(String(d)+'T12:00:00').toLocaleDateString('it-IT');},
    fmtMoney(n){return `€ ${Number(n||0).toFixed(2)}`;}
  };
})();
