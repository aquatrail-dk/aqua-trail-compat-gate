(function(){
 const DB='AquaTrailGalleryV868Complete', STORE='photos', VER=1;
 const LEGACY_DBS=['AquaTrailGalleryV82'];
 const TOMBSTONE_PREFIX='AQUA_GALLERY_V869_TOMBSTONE_';
 const tombstoned=id=>{try{return localStorage.getItem(TOMBSTONE_PREFIX+id)==='1'}catch(_){return false}};
 let migrationPromise=null,migrationReport={database:DB,recovered:0,sources:[],errors:[]};
 function openNamed(name,createCurrent){return new Promise((res,rej)=>{let created=false;const q=indexedDB.open(name,VER);q.onupgradeneeded=e=>{created=true;const db=e.target.result;if(createCurrent&&!db.objectStoreNames.contains(STORE)){const s=db.createObjectStore(STORE,{keyPath:'id'});s.createIndex('event_id','event_id',{unique:false});}else if(!createCurrent){try{q.transaction.abort()}catch(_){}}};q.onsuccess=()=>res({db:q.result,created});q.onerror=()=>{if(!createCurrent&&created)return res({db:null,created:true});rej(q.error)};q.onblocked=()=>rej(new Error('IndexedDB bloccato'));});}
 async function openRaw(){const x=await openNamed(DB,true);return x.db;}
 async function readLegacy(name){
   try{
     if(indexedDB.databases){const dbs=await indexedDB.databases();if(!dbs.some(x=>x.name===name))return []}
     const x=await openNamed(name,false);if(!x.db||!x.db.objectStoreNames.contains(STORE)){try{x.db?.close()}catch(_){ }return []}
     const db=x.db;const rows=await new Promise((res,rej)=>{const t=db.transaction(STORE,'readonly'),s=t.objectStore(STORE),q=s.getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error)});db.close();return rows;
   }catch(e){migrationReport.errors.push(`${name}: ${e?.message||e}`);return []}
 }
 async function ensureMigration(){
   if(migrationPromise)return migrationPromise;
   migrationPromise=(async()=>{
     try{
       const db=await openRaw();
       const existing=await new Promise((res,rej)=>{const t=db.transaction(STORE,'readonly'),s=t.objectStore(STORE),q=s.getAllKeys();q.onsuccess=()=>res(new Set((q.result||[]).map(String)));q.onerror=()=>rej(q.error)});
       for(const name of LEGACY_DBS){const rows=await readLegacy(name);let added=0;if(rows.length){await new Promise((res,rej)=>{const t=db.transaction(STORE,'readwrite'),s=t.objectStore(STORE);rows.forEach(r=>{if(r?.id&&!existing.has(String(r.id))&&!tombstoned(String(r.id))){s.put(r);existing.add(String(r.id));added++}});t.oncomplete=res;t.onerror=()=>rej(t.error)});}migrationReport.sources.push({database:name,found:rows.length,recovered:added});migrationReport.recovered+=added}
       db.close();
     }catch(e){migrationReport.errors.push(String(e?.message||e))}
     return migrationReport;
   })();
   return migrationPromise;
 }
 async function open(){await ensureMigration();return openRaw();}
 async function tx(mode,fn){const db=await open();return new Promise((res,rej)=>{const t=db.transaction(STORE,mode),s=t.objectStore(STORE);const r=fn(s);t.oncomplete=()=>{db.close();res(r)};t.onerror=()=>{db.close();rej(t.error)}});}
 window.ATGalleryDB={
   async all(eventId){const db=await open();return new Promise((res,rej)=>{const t=db.transaction(STORE,'readonly'),s=t.objectStore(STORE);const q=eventId?s.index('event_id').getAll(eventId):s.getAll();q.onsuccess=()=>{db.close();res(q.result||[])};q.onerror=()=>{db.close();rej(q.error)}});},
   async put(x){try{localStorage.removeItem(TOMBSTONE_PREFIX+String(x?.id||''))}catch(_){ }await tx('readwrite',s=>s.put(x));return x;},
   async remove(id){try{localStorage.setItem(TOMBSTONE_PREFIX+String(id),'1')}catch(_){ }await tx('readwrite',s=>s.delete(id));},
   async clear(){await tx('readwrite',s=>s.clear());},
   async ensureMigration(){return ensureMigration();},
   migrationReport(){return JSON.parse(JSON.stringify(migrationReport));},
   DB_NAME:DB,LEGACY_DBS:[...LEGACY_DBS]
 };
})();
