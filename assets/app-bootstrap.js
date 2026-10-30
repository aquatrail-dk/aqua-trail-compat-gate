(function(){
  'use strict';
  const domReady=new Promise(resolve=>{if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',resolve,{once:true});else resolve();});
  const page=()=>((location.pathname||'').split('/').pop()||'index.html').toLowerCase();
  const cfg=()=>window.AQUATRAIL_RUNTIME||{};
  const audience=()=>String(cfg().audience||((String(cfg().mode||'').toUpperCase().includes('PUBLIC'))?'PUBLIC':'STAFF')).toUpperCase();
  let blockerShown=false;
  function showPublicLoading(){if(audience()!=='PUBLIC'||!document.body)return()=>{};const d=document.createElement('div');d.className='public-bootstrap-loading';d.setAttribute('role','status');d.setAttribute('aria-live','polite');d.setAttribute('aria-atomic','true');d.innerHTML='<span class="public-bootstrap-spinner" aria-hidden="true"></span><span>Caricamento dati pubblici…</span><span class="public-bootstrap-track" aria-hidden="true"><i></i></span>';document.body.prepend(d);return()=>d.remove();}
  function showBlocker(e){if(blockerShown)return;blockerShown=true;const draw=()=>{const d=document.createElement('div');d.className='notice warn';d.style.cssText='position:sticky;top:0;z-index:99999;margin:0;border-radius:0;text-align:center';const pub=audience()==='PUBLIC';const title=pub?'AQUA TRAIL ONLINE TEMPORANEAMENTE NON DISPONIBILE':'AREA STAFF ONLINE BLOCCATA';const detail=pub?'I dati non sono disponibili al momento.':String(e?.message||'Backend Apps Script non disponibile.');const retry=pub?'Riprova tra poco.':'Nessuna operazione locale viene eseguita come fallback.';d.innerHTML=`<strong>${title}</strong><br>${detail.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}<br><small>${retry}</small>`;document.body.prepend(d)};document.body?draw():document.addEventListener('DOMContentLoaded',draw,{once:true});}
  const ready=domReady.then(async()=>{
    if(!window.ATDataAPI?.isOnline?.())return {mode:'OFFLINE'};
    if(audience()==='STAFF'&&page()==='login-admin.html')return {mode:'ONLINE_LOGIN'};
    if(audience()==='PUBLIC'){
      // The guide is static: keep it usable while the workspace loads in the background.
      const hideLoading=page()==='regolamento.html'?()=>{}:showPublicLoading();
      try{await ATDataAPI.publicBootstrap({page:page()});return {mode:'ONLINE_PUBLIC',workspace:ATDataAPI.workspaceConfig()}}
      catch(e){showBlocker(e);throw e}
      finally{hideLoading()}
    }
    try{await ATDataAPI.staffBootstrap({page:page()});return {mode:'ONLINE_STAFF',session:ATDataAPI.sessionData(),workspace:ATDataAPI.workspaceConfig()}}
    catch(e){showBlocker(e);throw e}
  });
  function onReady(fn){return ready.then(()=>fn()).catch(e=>{console.error('[AquaTrail bootstrap]',e);return undefined})}
  window.addEventListener?.('aquatrail:public-refresh-required',()=>{if(audience()==='PUBLIC')location.reload()});
  window.ATApp={VERSION:'ATAppBootstrap_V1_8_5',ready,onReady,showBlocker,page,audience};
})();

