(function(){
  const DB_NAME='AquaTrailEventDocsV868Complete';
  const DB_VERSION=1;
  const STORE='documents';
  const FALLBACK_PREFIX='AQUA_EVENT_DOC_V868_FALLBACK_';
  const LEGACY_DBS=['AquaTrailEventDocs'];
  const LEGACY_FALLBACK_PREFIXES=['AQUA_EVENT_DOC_FALLBACK_'];
  const TOMBSTONE_PREFIX='AQUA_EVENT_DOC_V869_TOMBSTONE_';
  const MAX_PDF_BYTES=12*1024*1024;
  let migrationPromise=null,migrationReport={database:DB_NAME,recovered:0,fallback_recovered:0,sources:[],errors:[]};
  function openNamed(name,createCurrent){
    return new Promise((resolve,reject)=>{
      let created=false;const req=indexedDB.open(name,DB_VERSION);
      req.onupgradeneeded=()=>{created=true;const db=req.result;if(createCurrent&&!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);else if(!createCurrent){try{req.transaction.abort()}catch(_){}}};
      req.onsuccess=()=>resolve({db:req.result,created});
      req.onerror=()=>{if(!createCurrent&&created)return resolve({db:null,created:true});reject(req.error||new Error('Impossibile aprire archivio documenti'))};
    });
  }
  async function openDbRaw(){if(!('indexedDB' in window))throw new Error('IndexedDB non disponibile');return (await openNamed(DB_NAME,true)).db}
  function key(eventId,type){return `${eventId}::${String(type||'').toUpperCase()}`}
  const tombstoned=k=>{try{return localStorage.getItem(TOMBSTONE_PREFIX+k)==='1'}catch(_){return false}};
  function readAsDataURL(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('Lettura file fallita'));r.readAsDataURL(file)})}
  async function readDbRows(name){
    try{
      if(indexedDB.databases){const dbs=await indexedDB.databases();if(!dbs.some(x=>x.name===name))return []}
      const x=await openNamed(name,false);if(!x.db||!x.db.objectStoreNames.contains(STORE)){try{x.db?.close()}catch(_){ }return []}
      const db=x.db;const rows=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),st=tx.objectStore(STORE),rk=st.getAllKeys(),rv=st.getAll();let keys=null,vals=null;const done=()=>{if(keys&&vals)resolve(keys.map((k,i)=>({key:String(k),record:vals[i]})))};rk.onsuccess=()=>{keys=rk.result||[];done()};rv.onsuccess=()=>{vals=rv.result||[];done()};rk.onerror=()=>reject(rk.error);rv.onerror=()=>reject(rv.error)});db.close();return rows;
    }catch(e){migrationReport.errors.push(`${name}: ${e?.message||e}`);return []}
  }
  async function ensureMigration(){
    if(migrationPromise)return migrationPromise;
    migrationPromise=(async()=>{
      try{
        const db=await openDbRaw();
        const existing=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),q=tx.objectStore(STORE).getAllKeys();q.onsuccess=()=>resolve(new Set((q.result||[]).map(String)));q.onerror=()=>reject(q.error)});
        for(const name of LEGACY_DBS){const rows=await readDbRows(name);let added=0;if(rows.length){await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite'),st=tx.objectStore(STORE);rows.forEach(({key:k,record})=>{if(!existing.has(k)&&!tombstoned(k)){st.put(record,k);existing.add(k);added++}});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});}migrationReport.sources.push({database:name,found:rows.length,recovered:added});migrationReport.recovered+=added}
        db.close();
        try{
          for(const prefix of LEGACY_FALLBACK_PREFIXES){let found=0,added=0;const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(prefix))keys.push(k)}for(const oldKey of keys){found++;const logical=oldKey.slice(prefix.length);if(tombstoned(logical))continue;const newKey=FALLBACK_PREFIX+logical;if(localStorage.getItem(newKey)==null){localStorage.setItem(newKey,localStorage.getItem(oldKey));added++}}migrationReport.sources.push({fallback_prefix:prefix,found,recovered:added});migrationReport.fallback_recovered+=added}
        }catch(e){migrationReport.errors.push('fallback: '+(e?.message||e))}
      }catch(e){migrationReport.errors.push(String(e?.message||e))}
      return migrationReport;
    })();
    return migrationPromise;
  }
  async function openDb(){await ensureMigration();return openDbRaw()}
  async function save(eventId,type,file){
    if(!eventId)throw new Error('Evento non valido');if(!file)throw new Error('Seleziona un PDF');
    const mime=(file.type||'').toLowerCase(),isPdf=mime==='application/pdf'||/\.pdf$/i.test(file.name||'');
    if(!isPdf)throw new Error('È consentito esclusivamente un file PDF.');
    if(file.size>MAX_PDF_BYTES)throw new Error('PDF troppo grande per la preview offline (massimo 12 MB). Nella Phase 2 sarà archiviato su Google Drive.');
    const k=key(eventId,type),record={blob:file,name:file.name||`${type}.pdf`,mime:'application/pdf',size:file.size,updated_at:new Date().toISOString()};
    try{localStorage.removeItem(TOMBSTONE_PREFIX+k)}catch(_){ }
    try{
      const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(record,k);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});db.close();try{localStorage.removeItem(FALLBACK_PREFIX+k)}catch(_){ }
      return {key:k,name:record.name,mime:record.mime,size:record.size,updated_at:record.updated_at,storage:'INDEXEDDB',drive_file_id:null,url:null,public_url:null};
    }catch(err){
      if(file.size>700*1024)throw new Error('Il browser non consente l’archivio locale dei PDF. Apri il sito tramite server locale oppure usa un PDF sotto 700 KB. Dettaglio: '+(err?.message||err));
      const data_url=await readAsDataURL(file);try{localStorage.setItem(FALLBACK_PREFIX+k,JSON.stringify({...record,blob:undefined,data_url}))}catch(e){throw new Error('Spazio locale insufficiente per salvare il PDF.')}
      return {key:k,name:record.name,mime:record.mime,size:record.size,updated_at:record.updated_at,storage:'LOCALSTORAGE',drive_file_id:null,url:null,public_url:null};
    }
  }
  async function load(eventId,type){
    await ensureMigration();const k=key(eventId,type);if(tombstoned(k))return null;
    try{const db=await openDbRaw();const rec=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),rq=tx.objectStore(STORE).get(k);rq.onsuccess=()=>resolve(rq.result||null);rq.onerror=()=>reject(rq.error)});db.close();if(rec?.blob)return rec}catch(_){ }
    const prefixes=[FALLBACK_PREFIX,...LEGACY_FALLBACK_PREFIXES];
    for(const prefix of prefixes){try{const r=localStorage.getItem(prefix+k);if(!r)continue;const rec=JSON.parse(r);if(rec?.data_url){const b=await (await fetch(rec.data_url)).blob();return {...rec,blob:b}}}catch(_){ }}
    return null;
  }
  async function remove(eventId,type){
    await ensureMigration();const k=key(eventId,type);let removed=false;try{localStorage.setItem(TOMBSTONE_PREFIX+k,'1')}catch(_){ }
    try{const db=await openDbRaw();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(k);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();removed=true}catch(_){ }
    for(const prefix of [FALLBACK_PREFIX,...LEGACY_FALLBACK_PREFIXES])try{if(localStorage.getItem(prefix+k)!=null){localStorage.removeItem(prefix+k);removed=true}}catch(_){ }
    return removed;
  }
  async function exists(eventId,type){return !!(await load(eventId,type))}
  async function exportAll(){
    await ensureMigration();const out=[],seen=new Set();
    try{const db=await openDbRaw();const rows=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),st=tx.objectStore(STORE),rk=st.getAllKeys(),rv=st.getAll();let keys=null,vals=null;const done=()=>{if(keys&&vals)resolve(keys.map((k,i)=>({key:String(k),...(vals[i]||{})})))};rk.onsuccess=()=>{keys=rk.result||[];done()};rv.onsuccess=()=>{vals=rv.result||[];done()};rk.onerror=()=>reject(rk.error);rv.onerror=()=>reject(rv.error)});db.close();rows.forEach(x=>{if(!tombstoned(x.key)){out.push(x);seen.add(x.key)}})}catch(_){ }
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k||!k.startsWith(FALLBACK_PREFIX))continue;const logical=k.slice(FALLBACK_PREFIX.length);if(seen.has(logical)||tombstoned(logical))continue;const rec=JSON.parse(localStorage.getItem(k)||'null');if(rec)out.push({key:logical,...rec,storage:'LOCALSTORAGE'})}}catch(_){ }
    return out;
  }
  function prettySize(n){n=Number(n||0);if(!n)return '';if(n<1024)return `${n} B`;if(n<1024*1024)return `${(n/1024).toFixed(0)} KB`;return `${(n/1024/1024).toFixed(1)} MB`}
  window.ATEventDocs={save,load,remove,exists,exportAll,key,prettySize,MAX_PDF_BYTES,ensureMigration,migrationReport:()=>JSON.parse(JSON.stringify(migrationReport)),DB_NAME,LEGACY_DBS:[...LEGACY_DBS]};
})();
