ATApp.onReady(()=>{
 const D=ATStore.public(),A=ATStore.admin(),unpaid=(A.registrations||[]).filter(x=>Number(x.due)>Number(x.paid)).length,s=ATStore.session();
 document.querySelector('#adminKpis').innerHTML=`<div class="stat"><small>Eventi</small><strong>${(D.events||[]).length}</strong></div><div class="stat"><small>Binomi</small><strong>${(D.pairs||[]).length}</strong></div><div class="stat"><small>Gallery Demo</small><strong>${(D.gallery||[]).length}</strong></div><div class="stat"><small>Iscrizioni con residuo</small><strong>${unpaid}</strong></div><div class="stat"><small>Regole sospese</small><strong>${(A.pending_rules||[]).length}</strong></div>`;
 const isSA=s?.role==='SUPERADMIN';['#superadminSecurityCard','#superadminFullAccessCard','#superadminClassificaCard'].forEach(sel=>{const el=document.querySelector(sel);if(el&&isSA)el.classList.remove('hidden')});
});
