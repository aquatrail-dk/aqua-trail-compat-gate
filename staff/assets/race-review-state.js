(function(){
  function get(P,rows,spec){
    const list=Array.isArray(rows)?rows:[];
    const complete=list.length>0&&list.every(x=>x&&x.completed===true);
    if(!complete)return {visible:false,code:'INCOMPLETE',label:'RISULTATI NON COMPLETI',message:'Completa tutti i partecipanti prima della revisione.'};
    const snap=window.ATPublication?.latestRaceSnapshot?.(P||{},spec||{})||null;
    if(!snap)return {visible:true,code:'READY_TO_PUBLISH',label:'REVISIONA / PUBBLICA RISULTATI',message:'Prova completata · classifica non ancora pubblicata.',snapshot:null};
    if(snap.publication_stale||snap.needs_republish)return {visible:true,code:'READY_TO_REPUBLISH',label:'REVISIONA / RIPUBBLICA RISULTATI',message:`Risultati modificati dopo la pubblicazione v${snap.publication_version||1} · DA RIPUBBLICARE.`,snapshot:snap};
    return {visible:true,code:'PUBLISHED_REVIEWABLE',label:'RIVEDI RISULTATI PUBBLICATI',message:`Versione pubblicata ${snap.publication_version||1} · revisione sempre disponibile.`,snapshot:snap};
  }
  window.ATRaceReviewState={get};
})();
