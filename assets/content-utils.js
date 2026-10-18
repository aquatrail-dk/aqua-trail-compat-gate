(function(){
  const ALLOWED=new Set(['B','STRONG','I','EM','UL','OL','LI','BR','P','DIV']);
  const DROP=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','INPUT','BUTTON','LINK','META']);
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function sanitizeRichHtml(html){
    const t=document.createElement('template');t.innerHTML=String(html||'');
    const walk=node=>{
      [...node.childNodes].forEach(ch=>{
        if(ch.nodeType===Node.ELEMENT_NODE){
          const tag=ch.tagName;
          if(DROP.has(tag)){ch.remove();return}
          if(!ALLOWED.has(tag)){while(ch.firstChild)node.insertBefore(ch.firstChild,ch);ch.remove();return}
          [...ch.attributes].forEach(a=>ch.removeAttribute(a.name));walk(ch);
        }
      });
    };walk(t.content);return t.innerHTML.trim();
  }
  function plainToHtml(text){const s=String(text||'').replace(/\r/g,'').trim();if(!s)return '';return s.split(/\n{2,}/).map(p=>`<p>${escapeHtml(p).replace(/\n/g,'<br>')}</p>`).join('')}
  function htmlToPlain(html){const t=document.createElement('template');t.innerHTML=sanitizeRichHtml(html);return (t.content.textContent||'').replace(/\s+\n/g,'\n').replace(/\n\s+/g,'\n').replace(/[ \t]+/g,' ').trim()}
  function eventHtml(e){if(e?.description_html)return sanitizeRichHtml(e.description_html);return plainToHtml(e?.description_long||e?.description||'')}
  function eventPlain(e){if(e?.description_html)return htmlToPlain(e.description_html);return String(e?.description_long||e?.description||'').trim()}
  window.ATContent={sanitizeRichHtml,plainToHtml,htmlToPlain,eventHtml,eventPlain,escape:escapeHtml};
})();
