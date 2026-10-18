(function(root){
  function geometry(sw,sh,opts={}){
    sw=Math.max(1,Number(sw)||1);sh=Math.max(1,Number(sh)||1);
    const ratio=Number(opts.ratio)||1;
    const maxWidth=Math.max(1,Number(opts.maxWidth)||900);
    const maxHeight=Math.max(1,Number(opts.maxHeight)||900);
    const noUpscale=opts.noUpscale!==false;
    let scale=Math.min(maxWidth/sw,maxHeight/sh);
    if(noUpscale)scale=Math.min(1,scale);
    const dw=Math.max(1,Math.round(sw*scale)),dh=Math.max(1,Math.round(sh*scale));
    let cw,ch;
    if((dw/dh)>=ratio){cw=dw;ch=Math.max(dh,Math.round(cw/ratio));}
    else{ch=dh;cw=Math.max(dw,Math.round(ch*ratio));}
    // Keep the normalized canvas inside the configured maximum rectangle.
    const fit=Math.min(1,maxWidth/cw,maxHeight/ch);
    if(fit<1){cw=Math.max(1,Math.round(cw*fit));ch=Math.max(1,Math.round(ch*fit));}
    const drawScale=Math.min(cw/sw,ch/sh,noUpscale?1:Infinity);
    const rw=Math.max(1,Math.round(sw*drawScale)),rh=Math.max(1,Math.round(sh*drawScale));
    return {canvasWidth:cw,canvasHeight:ch,drawWidth:rw,drawHeight:rh,x:Math.round((cw-rw)/2),y:Math.round((ch-rh)/2),sourceWidth:sw,sourceHeight:sh,ratio};
  }
  function loadFile(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(new Error('Impossibile leggere la foto.'));r.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('Formato foto non supportato.'));img.onload=()=>resolve(img);img.src=r.result};r.readAsDataURL(file)});}
  async function normalizeCanvas(file,opts={}){
    const img=await loadFile(file),g=geometry(img.naturalWidth||img.width,img.naturalHeight||img.height,opts),c=document.createElement('canvas');
    c.width=g.canvasWidth;c.height=g.canvasHeight;
    const ctx=c.getContext('2d');ctx.fillStyle=opts.background||'#000000';ctx.fillRect(0,0,c.width,c.height);
    ctx.drawImage(img,g.x,g.y,g.drawWidth,g.drawHeight);
    return {canvas:c,geometry:g};
  }
  async function dataUrl(file,opts={}){const x=await normalizeCanvas(file,opts);return {dataUrl:x.canvas.toDataURL(opts.type||'image/jpeg',opts.quality??.82),...x.geometry};}
  async function blob(file,opts={}){const x=await normalizeCanvas(file,opts),type=opts.type||'image/webp',quality=opts.quality??.84;const b=await new Promise(resolve=>x.canvas.toBlob(resolve,type,quality));if(!b)throw new Error('Impossibile ottimizzare la foto.');return {blob:b,...x.geometry};}
  root.ATImage={geometry,normalizeDataUrl:dataUrl,normalizeBlob:blob};
  if(typeof module!=='undefined'&&module.exports)module.exports={geometry};
})(typeof window!=='undefined'?window:globalThis);
