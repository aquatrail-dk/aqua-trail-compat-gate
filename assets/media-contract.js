(function(root){
  const DATA_RE=/^data:/i,HTTP_RE=/^https?:\/\//i;
  function clean(v){return String(v??'').trim()}
  function clone(v){return v&&typeof v==='object'?{...v}:v}
  function normalize(ref){
    if(!ref)return null;
    if(typeof ref==='string'){
      const u=clean(ref);if(!u)return null;
      return {storage:DATA_RE.test(u)?'OFFLINE_DATA_URL':(HTTP_RE.test(u)?'REMOTE_URL':'STATIC_ASSET'),url:u,public_url:u,drive_file_id:null,name:'',mime:'',size:null};
    }
    if(typeof ref!=='object')return null;
    const url=clean(ref.url||ref.public_url||ref.src||'');
    const drive=clean(ref.drive_file_id||ref.file_id||'');
    let storage=clean(ref.storage||'').toUpperCase();
    if(!storage)storage=drive?'GOOGLE_DRIVE':(DATA_RE.test(url)?'OFFLINE_DATA_URL':(HTTP_RE.test(url)?'REMOTE_URL':(url?'STATIC_ASSET':'METADATA_ONLY')));
    return {storage,url,public_url:clean(ref.public_url||url),drive_file_id:drive||null,name:clean(ref.name),mime:clean(ref.mime),size:Number.isFinite(Number(ref.size))?Number(ref.size):null,updated_at:clean(ref.updated_at)||null,key:clean(ref.key)||null};
  }
  function url(ref,fallback=''){
    const raw=typeof ref==='string'?ref:'';
    if(raw.startsWith('ATMEDIA:')){const parts=raw.slice(8).split('|');if(parts.length>=2){queueMediaScan();return (fallback||'assets/logo-aquatrail.jpg')+'#atmedia='+encodeURIComponent(parts[0]+'|'+parts[1]);}}
    const r=normalize(ref);return clean(r?.public_url||r?.url||fallback);
  }
  const mediaCache=new Map();let scanQueued=false;
  async function loadPrivateMedia(ref){
    const key=[ref.event_id,ref.type,ref.day_id||''].join('|');if(!mediaCache.has(key))mediaCache.set(key,(async()=>{
      if(!window.ATDataAPI?.request)throw Error('Servizio allegati non disponibile.');
      const data=await window.ATDataAPI.request('event_media_read',{event_id:ref.event_id,type:ref.type,day_id:ref.day_id||''});
      const binary=atob(data.base64),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes],{type:data.mime||'application/octet-stream'}));
    })().catch(e=>{mediaCache.delete(key);throw e}));return mediaCache.get(key);
  }
  function queueMediaScan(){if(scanQueued)return;scanQueued=true;setTimeout(()=>{scanQueued=false;document.querySelectorAll('img[src*="#atmedia="],a[href*="#atmedia="]').forEach(img=>{
    const attr=img.tagName==='A'?'href':'src',mark=(img.getAttribute(attr)||'').split('#atmedia=')[1];if(!mark||img.dataset.mediaLoading===mark)return;img.dataset.mediaLoading=mark;
    try{const [encodedEvent,type]=decodeURIComponent(mark).split('|');loadPrivateMedia({event_id:decodeURIComponent(encodedEvent),type}).then(src=>{if(img.isConnected)img.setAttribute(attr,src)}).catch(()=>{img.removeAttribute('data-media-loading')});}catch(_){img.removeAttribute('data-media-loading')}
  })},0)}

  function isInline(ref){const r=normalize(ref);return !!r&&(r.storage==='OFFLINE_DATA_URL'||DATA_RE.test(r.url||''))}
  function isOnlineSafe(ref){const r=normalize(ref);if(!r)return true;if(isInline(r))return false;if(['INDEXEDDB','LOCALSTORAGE'].includes(r.storage))return false;return !!(r.url||r.drive_file_id)}
  function offlineImage(dataUrl,name='immagine.webp',mime='image/webp',size=null){
    const u=clean(dataUrl);if(!DATA_RE.test(u))throw new Error('offlineImage richiede un data URL locale.');
    return {storage:'OFFLINE_DATA_URL',url:u,public_url:u,drive_file_id:null,name:clean(name)||'immagine.webp',mime:clean(mime)||'image/webp',size:Number.isFinite(Number(size))?Number(size):null,updated_at:new Date().toISOString()};
  }
  function driveRef(input={}){
    const id=clean(input.drive_file_id||input.file_id),u=clean(input.public_url||input.url);
    if(!id&&!u)throw new Error('Riferimento Drive privo di file_id/url.');
    if(DATA_RE.test(u))throw new Error('Un riferimento cloud non può contenere Base64/data URL.');
    return {storage:'GOOGLE_DRIVE',url:u,public_url:u,drive_file_id:id||null,name:clean(input.name),mime:clean(input.mime),size:Number.isFinite(Number(input.size))?Number(input.size):null,updated_at:clean(input.updated_at)||new Date().toISOString()};
  }
  function remoteRef(input={}){
    const u=clean(input.public_url||input.url);if(!u||DATA_RE.test(u))throw new Error('URL remoto non valido.');
    return {storage:HTTP_RE.test(u)?'REMOTE_URL':'STATIC_ASSET',url:u,public_url:u,drive_file_id:clean(input.drive_file_id)||null,name:clean(input.name),mime:clean(input.mime),size:Number.isFinite(Number(input.size))?Number(input.size):null,updated_at:clean(input.updated_at)||null};
  }
  function forApi(ref){
    const r=normalize(ref);if(!r)return null;
    if(!isOnlineSafe(r))throw new Error(`Media ${r.name||r.key||'locale'} non pronta per il cloud (${r.storage}). Caricala prima su Google Drive.`);
    return {storage:r.storage,drive_file_id:r.drive_file_id||null,url:r.public_url||r.url||'',name:r.name||'',mime:r.mime||'',size:r.size,updated_at:r.updated_at||null};
  }
  function describe(ref){const r=normalize(ref);if(!r)return 'Nessun file';return `${r.name||'Media'} · ${r.storage}${r.drive_file_id?' · Drive '+r.drive_file_id:''}`}
  function eventOnlineIssues(event,days=[]){
    const issues=[];if(event?.poster&&!isOnlineSafe(event.poster))issues.push('locandina locale');if(event?.program_image&&!isOnlineSafe(event.program_image))issues.push('immagine programma locale');
    for(const [label,meta] of [['programma PDF',event?.program_pdf],['menu PDF',event?.menu_pdf]])if(meta&&!isOnlineSafe(meta))issues.push(label+' locale');
    for(const d of days||[])if(d?.program_pdf&&!isOnlineSafe(d.program_pdf))issues.push(`${d.label||d.id}: PDF locale`);
    return issues;
  }
  root.ATMedia={normalize,url,loadPrivateMedia,isInline,isOnlineSafe,offlineImage,driveRef,remoteRef,forApi,describe,eventOnlineIssues,clone};
})(typeof window!=='undefined'?window:globalThis);
