ATApp.onReady(()=>{
  const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let P=ATStore.public(),A=ATStore.admin(),current=null;
  const accessFor=id=>(A.offline_accounts||[]).find(a=>a.role==='GIUDICE'&&a.judge_id===id)||null;
  const assignedEvents=id=>(P.events||[]).filter(e=>String(e.judge_id||'')===String(id||''));
  const photoUrl=j=>ATMedia?.url?ATMedia.url(j?.photo,'assets/logo-aquatrail.jpg'):(j?.photo||'assets/logo-aquatrail.jpg');
  function render(){
    A=ATStore.admin();P=ATStore.public();
    const list=A.judges_admin||[];
    $('#judgeList').innerHTML=list.map(j=>{
      const acc=accessFor(j.id),n=assignedEvents(j.id).length,access=acc?(acc.enabled===false?'ACCESSO DISATTIVATO':'ACCESSO ATTIVO'):'NESSUN ACCESSO';
      return `<div class="judge-row judge-row-photo"><img class="judge-list-photo" src="${esc(photoUrl(j))}" alt="Foto ${esc(j.display_name||j.name||'giudice')}"><div><strong>${esc(j.display_name||`${j.name||''} ${j.surname||''}`.trim()||j.id)}</strong><small>${esc(j.qualification||'Qualifica non indicata')} · ${esc(j.eps||'EPS non indicato')} · ${esc(j.status||'—')} · ${access} · ${n} event${n===1?'o':'i'}</small></div><button class="btn btn-light small" data-id="${esc(j.id)}">APRI SCHEDA</button></div>`
    }).join('')||'<div class="notice info">Nessun giudice registrato.</div>';
    $('#judgeList').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>openEditor(b.dataset.id));
  }
  function accessStatus(id,acc){
    const ev=assignedEvents(id),names=ev.map(e=>e.name).filter(Boolean);
    if(!acc)return 'Nessun account collegato. Puoi crearne uno personale e riutilizzabile per gli eventi assegnati a questo giudice.';
    return `Account ${acc.enabled===false?'DISATTIVATO':'ATTIVO'}: ${acc.username} · Eventi assegnati: ${ev.length}${names.length?' · '+names.join(' / '):''}`;
  }
  function renderEventHistory(id){
    const box=$('#jEventHistory'); if(!box)return;
    if(!id){box.innerHTML='<div class="tiny-muted">Salva prima il nuovo giudice per visualizzare le assegnazioni.</div>';return;}
    const today=new Date().toISOString().slice(0,10), events=assignedEvents(id).slice().sort((a,b)=>String(a.start_date||'').localeCompare(String(b.start_date||'')));
    const past=events.filter(e=>String(e.end_date||e.start_date||'')<today), future=events.filter(e=>String(e.end_date||e.start_date||'')>=today);
    const section=(title,rows)=>`<div class="judge-event-group"><h4>${title}</h4>${rows.length?rows.map(e=>`<a class="judge-event-link" href="evento-admin.html?event=${encodeURIComponent(e.id)}"><span><b>${esc(e.name||e.id)}</b><small>${esc(ATStore.fmtDate(e.start_date))}${e.location?' · '+esc(e.location):''}</small></span><span class="badge ${e.published?'ok':'warn'}">${esc(e.status|| (e.published?'PUBBLICATO':'BOZZA'))}</span></a>`).join(''):'<div class="tiny-muted">Nessun evento.</div>'}</div>`;
    box.innerHTML=section('Eventi passati',past)+section('Eventi futuri / in programma',future);
  }
  function openEditor(id=null){
    A=ATStore.admin();P=ATStore.public();current=id?(A.judges_admin||[]).find(j=>j.id===id):null;
    const j=current||{},acc=current?accessFor(current.id):null;
    $('#judgeEditor').classList.remove('hidden');$('#judgeEditorTitle').textContent=current?'Modifica giudice':'Nuovo giudice';
    $('#jName').value=j.name||'';$('#jSurname').value=j.surname||'';$('#jPhone').value=j.phone||'';$('#jEmail').value=j.email||'';$('#jEps').value=j.eps||'';$('#jRegistry').value=j.registry_number||'';$('#jQualification').value=j.qualification||'';$('#jStatus').value=j.status||'ATTIVO';$('#jFrom').value=j.valid_from||'';$('#jTo').value=j.valid_to||'';$('#jNotes').value=j.notes||'';
    $('#jPhotoPreview').src=photoUrl(j);$('#jPhoto').value='';
    $('#jCreateAccess').checked=!!acc;$('#jCreateAccess').disabled=!!acc;$('#jUsername').value=acc?.username||'';$('#jPassword').value=acc?.password||'';$('#jAccessEnabled').checked=acc?acc.enabled!==false:true;$('#jAccessEnabled').disabled=!acc&&!$('#jCreateAccess').checked;$('#jResetPassword').disabled=!acc&&!$('#jCreateAccess').checked;$('#jAccessStatus').textContent=accessStatus(j.id||'',acc);
    renderDocs(j.documents||[]);renderEventHistory(j.id||'');
  }
  function renderDocs(docs){$('#docList').innerHTML=docs.map(d=>`<div class="doc-item"><span>${esc(d.name)}</span><small>${Math.round((d.size||0)/1024)} KB</small></div>`).join('')||'<span class="tiny-muted">Nessun documento caricato.</span>'}
  function slug(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,'')}
  function suggestedUsername(){const n=slug($('#jName').value),c=slug($('#jSurname').value);return [n,c].filter(Boolean).join('.')||'giudice.demo'}
  function suggestedPassword(){const c=slug($('#jSurname').value)||slug($('#jName').value)||'giudice';return `${c.replace(/\./g,'')}123`}
  async function imageData(file){
    if(!file)return null;if(file.size>5_000_000)throw new Error('La foto supera 5 MB.');
    const bmp=await createImageBitmap(file),size=500,scale=Math.max(size/bmp.width,size/bmp.height),w=bmp.width*scale,h=bmp.height*scale,c=document.createElement('canvas');c.width=size;c.height=size;const ctx=c.getContext('2d');ctx.drawImage(bmp,(size-w)/2,(size-h)/2,w,h);return c.toDataURL('image/webp',.86);
  }
  $('#newJudge').onclick=()=>openEditor();$('#closeJudge').onclick=()=>$('#judgeEditor').classList.add('hidden');
  $('#jPhoto').onchange=async()=>{const f=$('#jPhoto').files?.[0];if(!f)return;try{$('#jPhotoPreview').src=await imageData(f)}catch(e){alert(e.message||e)}};
  $('#jCreateAccess').onchange=()=>{const on=$('#jCreateAccess').checked;$('#jAccessEnabled').disabled=!on;$('#jResetPassword').disabled=!on;if(on&&!$('#jUsername').value)$('#jUsername').value=suggestedUsername();if(on&&!$('#jPassword').value)$('#jPassword').value=suggestedPassword();};
  $('#jResetPassword').onclick=()=>{const next=prompt('Nuova password DEMO per questo giudice:',suggestedPassword());if(next==null)return;const v=next.trim();if(v.length<4){alert('Usa almeno 4 caratteri anche nella fase DEMO.');return}$('#jCreateAccess').checked=true;$('#jPassword').value=v;$('#jAccessEnabled').disabled=false;$('#jResetPassword').disabled=false;$('#jAccessStatus').textContent='Nuova password impostata nel modulo. Premi SALVA GIUDICE per confermare.';};
  $('#saveJudge').onclick=async()=>{
    A=ATStore.admin();P=ATStore.public();const existing=current?(A.judges_admin||[]).find(j=>j.id===current.id):null,id=existing?.id||ATStore.id('J',A.judges_admin||[]),docs=existing?.documents?.slice()||[];
    for(const f of $('#jDocs').files){if(f.size>2_500_000){alert(`${f.name}: per la beta offline limita ogni allegato a circa 2,5 MB.`);continue}const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});docs.push({name:f.name,type:f.type,size:f.size,data})}
    let photo=existing?.photo||'';const pf=$('#jPhoto').files?.[0];if(pf){try{photo=await imageData(pf)}catch(e){alert(e.message||e);return}}
    const rec={id,name:$('#jName').value.trim(),surname:$('#jSurname').value.trim(),display_name:`${$('#jName').value.trim()} ${$('#jSurname').value.trim()}`.trim()||id,phone:$('#jPhone').value.trim(),email:$('#jEmail').value.trim(),eps:$('#jEps').value.trim(),registry_number:$('#jRegistry').value.trim(),qualification:$('#jQualification').value.trim(),status:$('#jStatus').value,valid_from:$('#jFrom').value,valid_to:$('#jTo').value,notes:$('#jNotes').value.trim(),photo,documents:docs};
    A.judges_admin=A.judges_admin||[];const before=existing?JSON.stringify(existing):'';if(existing)Object.assign(existing,rec);else A.judges_admin.push(rec);
    let pub=(P.judges||[]).find(j=>j.id===id);if(!pub){pub={id,name:rec.display_name,photo};P.judges=P.judges||[];P.judges.push(pub)}else{pub.name=rec.display_name;pub.photo=photo}
    const existingAcc=accessFor(id),wantAccess=!!existingAcc||$('#jCreateAccess').checked;
    if(wantAccess){A.offline_accounts=A.offline_accounts||[];let acc=existingAcc,username=$('#jUsername').value.trim()||suggestedUsername(),password=$('#jPassword').value.trim()||suggestedPassword(),enabled=$('#jAccessEnabled').checked;if(password.length<4){alert('Password DEMO troppo corta: usa almeno 4 caratteri.');return}const conflict=A.offline_accounts.find(x=>String(x.username||'').toLowerCase()===username.toLowerCase()&&x.judge_id!==id);if(conflict){alert('Username già usato da un altro account. Scegline uno diverso.');return}if(!acc){acc={username,password,role:'GIUDICE',correction_pin:'1357',judge_id:id,demo:true,enabled};A.offline_accounts.push(acc)}else{acc.username=username;acc.password=password;acc.judge_id=id;acc.role='GIUDICE';acc.enabled=enabled;acc.demo=true;delete acc.event_id}$('#jAccessStatus').textContent=accessStatus(id,acc)}
    ATStore.saveAdmin(A);ATStore.savePublic(P);ATStore.audit(existing?'MODIFICA GIUDICE':'NUOVO GIUDICE',id,before,JSON.stringify({...rec,photo:photo?'PRESENTE':'',documents:docs.map(d=>d.name)}),'Anagrafica giudici + foto + accesso personale GIUDICE');current=rec;render();openEditor(id);
  };
  render();
});
