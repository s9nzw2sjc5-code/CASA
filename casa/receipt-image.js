// Preparación local de la foto: aislar el papel y compensar iluminación desigual.
(function(root){
  const blob=canvas=>new Promise((ok,fail)=>canvas.toBlob(b=>b?ok(b):fail(new Error('No se pudo preparar la foto')),'image/png'));
  async function prepare(file){
    const image=new Image(),url=URL.createObjectURL(file);
    try{await new Promise((ok,fail)=>{image.onload=ok;image.onerror=()=>fail(new Error('No se puede abrir la imagen'));image.src=url})}finally{URL.revokeObjectURL(url)}
    const sample=document.createElement('canvas');sample.width=240;sample.height=Math.max(1,Math.round(image.naturalHeight/image.naturalWidth*240));
    const sc=sample.getContext('2d',{willReadFrequently:true});sc.drawImage(image,0,0,sample.width,sample.height);
    const pixels=sc.getImageData(0,0,sample.width,sample.height).data,profile=[];
    for(let x=0;x<240;x++){let neutral=0,count=0;for(let y=Math.floor(sample.height*.08);y<sample.height*.92;y++){const i=(y*240+x)*4,hi=Math.max(pixels[i],pixels[i+1],pixels[i+2]),lo=Math.min(pixels[i],pixels[i+1],pixels[i+2]);if(hi>40&&(hi-lo)/hi<.19)neutral++;count++}profile[x]=neutral/Math.max(1,count)}
    const smooth=profile.map((_,x)=>{let sum=0,n=0;for(let i=Math.max(0,x-3);i<=Math.min(239,x+3);i++){sum+=profile[i];n++}return sum/n});
    let best=[0,0],start=null;
    for(let x=0;x<=240;x++){if(x<240&&smooth[x]>.8){if(start===null)start=x}else if(start!==null){if(x-start>best[1]-best[0])best=[start,x];start=null}}
    let left=0,right=1;
    if(best[1]-best[0]>240*.35&&best[1]-best[0]<240*.95&&best[0]<144&&best[1]>96){left=Math.max(0,best[0]/240-.025);right=Math.min(1,best[1]/240+.025)}
    const width=(right-left)*image.naturalWidth,height=image.naturalHeight,scale=Math.min(1,1800/width,2600/height),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,left*image.naturalWidth,0,width,height,0,0,canvas.width,canvas.height);
    const cropped=await blob(canvas),frame=ctx.getImageData(0,0,canvas.width,canvas.height),w=canvas.width,h=canvas.height,gray=new Uint8Array(w*h),block=64,gw=Math.ceil(w/block),gh=Math.ceil(h/block),background=new Float32Array(gw*gh);
    for(let i=0;i<gray.length;i++)gray[i]=Math.round(.299*frame.data[i*4]+.587*frame.data[i*4+1]+.114*frame.data[i*4+2]);
    for(let by=0;by<gh;by++)for(let bx=0;bx<gw;bx++){const hist=new Uint32Array(256);let n=0;for(let y=by*block;y<Math.min(h,(by+1)*block);y++)for(let x=bx*block;x<Math.min(w,(bx+1)*block);x++){hist[gray[y*w+x]]++;n++}let total=0,value=255;for(let k=0;k<256;k++){total+=hist[k];if(total>=n*.9){value=k;break}}background[by*gw+bx]=Math.max(40,value)}
    const bg=(x,y)=>background[Math.max(0,Math.min(gh-1,y))*gw+Math.max(0,Math.min(gw-1,x))];
    for(let y=0;y<h;y++){const fy=y/block-.5,iy=Math.floor(fy),ty=fy-iy;for(let x=0;x<w;x++){const fx=x/block-.5,ix=Math.floor(fx),tx=fx-ix,white=(bg(ix,iy)*(1-tx)+bg(ix+1,iy)*tx)*(1-ty)+(bg(ix,iy+1)*(1-tx)+bg(ix+1,iy+1)*tx)*ty,i=y*w+x,value=Math.max(0,Math.min(255,Math.round((gray[i]*245/white-15)*255/240)));frame.data[i*4]=frame.data[i*4+1]=frame.data[i*4+2]=value;frame.data[i*4+3]=255}}
    ctx.putImageData(frame,0,0);
    return {cropped,normalized:await blob(canvas),bounds:{left,right},width:canvas.width,height:canvas.height};
  }
  root.CasaReceiptImage={prepare};
})(globalThis);
