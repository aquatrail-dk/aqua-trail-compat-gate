
ATApp.onReady(async()=>{
 const P=ATStore.public(), sel=document.querySelector('#galleryEvent'), host=document.querySelector('#gallerySections');
 (P.events||[]).filter(e=>e.published!==false).forEach(e=>sel.add(new Option(`${e.name} · ${new Date(e.start_date+'T12:00').toLocaleDateString('it-IT')}`,e.id)));
 const requested=ATStore.qs('event');if(requested&&[...sel.options].some(o=>o.value===requested))sel.value=requested;let current=sel.value||(P.events[0]?.id||'');
 const labels={generale:'GENERALE EVENTO',gara:'GARA',podio:'PODIO E PREMIAZIONI'};
 function syncContext(){const e=(P.events||[]).find(x=>String(x.id)===String(current))||null;if(!e)return;const d=e.start_date?new Date(e.start_date+'T12:00:00').toLocaleDateString('it-IT'):'';document.title=`Gallery ${e.name||''} · Aqua Trail®`;document.querySelector('#galleryTitle').textContent=`Gallery ${e.name||'evento'}`;document.querySelector('#galleryKicker').textContent=[e.subtitle||'Evento Aqua Trail',d].filter(Boolean).join(' · ');const u=new URL(location.href);u.searchParams.set('event',e.id);history.replaceState({},'',u.pathname+u.search)}
 let items=[],idx=0,startX=0;
 async function load(){
   syncContext();
   const base=(P.gallery||[]).filter(x=>x.event_id===current&&x.published!==false);
   let uploads=[]; try{uploads=await ATGalleryDB.all(current)}catch(e){}
   const uploadItems=uploads.filter(x=>x.published!==false).map(x=>({...x,src:null,blob:x.blob}));
   items=[...base,...uploadItems].sort((a,b)=>(a.category||'').localeCompare(b.category||'')+(a.order||0)-(b.order||0));
   host.innerHTML='';
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
 function open(i){idx=i;const it=items[idx];if(!it)return;const lb=document.querySelector('#lightbox');document.querySelector('#lightboxImg').src=source(it);document.querySelector('#lightboxCaption').textContent=it.caption||'';lb.classList.add('open');lb.setAttribute('aria-hidden','false');document.body.classList.add('no-scroll')}
 function close(){const lb=document.querySelector('#lightbox');lb.classList.remove('open');lb.setAttribute('aria-hidden','true');document.body.classList.remove('no-scroll')}
 function move(d){if(!items.length)return;idx=(idx+d+items.length)%items.length;open(idx)}
 document.querySelector('.lightbox-close').onclick=close;document.querySelector('.lightbox-prev').onclick=()=>move(-1);document.querySelector('.lightbox-next').onclick=()=>move(1);
 document.querySelector('#lightbox').addEventListener('click',e=>{if(e.target.id==='lightbox')close()});
 document.addEventListener('keydown',e=>{if(!document.querySelector('#lightbox').classList.contains('open'))return;if(e.key==='Escape')close();if(e.key==='ArrowLeft')move(-1);if(e.key==='ArrowRight')move(1)});
 document.querySelector('#lightbox').addEventListener('touchstart',e=>startX=e.touches[0].clientX,{passive:true});document.querySelector('#lightbox').addEventListener('touchend',e=>{const d=e.changedTouches[0].clientX-startX;if(Math.abs(d)>50)move(d>0?-1:1)},{passive:true});
 sel.onchange=()=>{current=sel.value;load()};await load();
});