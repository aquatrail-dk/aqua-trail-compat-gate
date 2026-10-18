
ATApp.onReady(async()=>{
 const P=ATStore.public(), sel=document.querySelector('#galleryEvent'), host=document.querySelector('#gallerySections');
 const visibleEvents=(P.events||[]).filter(e=>e.published!==false);
 visibleEvents.forEach(e=>sel.add(new Option(`${e.name} · ${e.start_date?new Date(e.start_date+'T12:00').toLocaleDateString('it-IT'):''}`,e.id)));
 const requested=ATStore.qs('event'),hasRequested=requested&&[...sel.options].some(o=>o.value===requested);
 if(hasRequested)sel.value=requested;
 else{const populated=visibleEvents.find(e=>(P.gallery||[]).some(x=>String(x.event_id)===String(e.id)&&x.published!==false));if(populated)sel.value=populated.id}
 let current=sel.value||(visibleEvents[0]?.id||'');
 const labels={generale:'GENERALE EVENTO',gara:'GARA',podio:'PODIO E PREMIAZIONI'};
 function syncContext(){const e=(P.events||[]).find(x=>String(x.id)===String(current))||null;if(!e)return;const d=e.start_date?new Date(e.start_date+'T12:00:00').toLocaleDateString('it-IT'):'';document.title=`Gallery ${e.name||''} · Aqua Trail®`;document.querySelector('#galleryTitle').textContent=`Gallery ${e.name||'evento'}`;document.querySelector('#galleryKicker').textContent=[e.subtitle||'Evento Aqua Trail',d].filter(Boolean).join(' · ');const u=new URL(location.href);u.searchParams.set('event',e.id);history.replaceState({},'',u.pathname+u.search)}
 let items=[],idx=0,startX=0,lastFocused=null;
 async function load(){
   syncContext();
   if(!current){host.innerHTML='<div class="notice info">Nessun evento pubblico disponibile.</div>';return}
   const base=(P.gallery||[]).filter(x=>x.event_id===current&&x.published!==false);
   let uploads=[]; try{uploads=await ATGalleryDB.all(current)}catch(e){}
   const uploadItems=uploads.filter(x=>x.published!==false).map(x=>({...x,src:null,blob:x.blob}));
   items=[...base,...uploadItems].sort((a,b)=>(a.category||'').localeCompare(b.category||'')+(a.order||0)-(b.order||0));
   host.innerHTML='';
   if(!items.length){host.innerHTML='<div class="notice info">Nessuna fotografia pubblicata per questo evento.</div>';return}
   ['generale','gara','podio'].forEach(cat=>{
      const list=items.filter(x=>x.category===cat);
      const s=document.createElement('section'); s.className='gallery-section';
      s.innerHTML=`<div class="gallery-section-head"><div><div class="kicker">${labels[cat]}</div><h2>${list.length} fotografie</h2></div></div><div class="photo-grid"></div>`;
      const grid=s.querySelector('.photo-grid');
      list.forEach(item=>{
        const globalIndex=items.indexOf(item), card=document.createElement('button');card.className='photo-card';card.type='button';
        const img=document.createElement('img'); img.loading='lazy'; img.alt=item.caption||labels[cat];
        if(item.blob) img.src=URL.createObjectURL(item.blob); else img.src=item.src;
        const cap=document.createElement('span');cap.textContent=item.caption||'Foto evento';
        card.append(img,cap);card.onclick=()=>open(globalIndex);grid.append(card);
      });
      host.append(s);
   });
 }
 function source(item){return item.blob?URL.createObjectURL(item.blob):item.src}
 function open(i){idx=i;const it=items[idx];if(!it)return;const lb=document.querySelector('#lightbox'),wasOpen=lb.classList.contains('open'),img=document.querySelector('#lightboxImg');if(!wasOpen)lastFocused=document.activeElement;img.src=source(it);img.alt=it.caption||`Foto ${document.querySelector('#galleryTitle').textContent}`;document.querySelector('#lightboxCaption').textContent=it.caption||'';lb.classList.add('open');lb.setAttribute('aria-hidden','false');document.body.classList.add('no-scroll');if(!wasOpen)document.querySelector('.lightbox-close').focus()}
 function close(){const lb=document.querySelector('#lightbox');lb.classList.remove('open');lb.setAttribute('aria-hidden','true');document.body.classList.remove('no-scroll');if(lastFocused?.isConnected)lastFocused.focus();lastFocused=null}
 function move(d){if(!items.length)return;idx=(idx+d+items.length)%items.length;open(idx)}
 document.querySelector('.lightbox-close').onclick=close;document.querySelector('.lightbox-prev').onclick=()=>move(-1);document.querySelector('.lightbox-next').onclick=()=>move(1);
 document.querySelector('#lightbox').addEventListener('click',e=>{if(e.target.id==='lightbox')close()});
 document.addEventListener('keydown',e=>{const lb=document.querySelector('#lightbox');if(!lb.classList.contains('open'))return;if(e.key==='Escape'){e.preventDefault();close();return}if(e.key==='ArrowLeft'){e.preventDefault();move(-1);return}if(e.key==='ArrowRight'){e.preventDefault();move(1);return}if(e.key==='Tab'){const controls=[...lb.querySelectorAll('button:not([disabled])')],first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
 document.querySelector('#lightbox').addEventListener('touchstart',e=>startX=e.touches[0].clientX,{passive:true});document.querySelector('#lightbox').addEventListener('touchend',e=>{const d=e.changedTouches[0].clientX-startX;if(Math.abs(d)>50)move(d>0?-1:1)},{passive:true});
 sel.onchange=()=>{current=sel.value;load()};await load();
});