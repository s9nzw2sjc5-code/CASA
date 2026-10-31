/* Modelos locales: descarga desde CASA, sin subir la foto a un servidor. */
(function(root){
  'use strict';
  const workerURL=new URL('ocr/worker.js?v=48',document.currentScript.src);
  async function pixels(file){
    const url=URL.createObjectURL(file),image=new Image();
    try{await new Promise((ok,fail)=>{image.onload=ok;image.onerror=()=>fail(Error('No se puede abrir esta foto. Prueba a compartirla como JPEG o PNG.'));image.src=url});
      const scale=Math.min(1,4000/Math.max(image.naturalWidth,image.naturalHeight),Math.sqrt(12000000/(image.naturalWidth*image.naturalHeight))),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.floor(image.naturalWidth*scale));canvas.height=Math.max(1,Math.floor(image.naturalHeight*scale));
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
      const frame=ctx.getImageData(0,0,canvas.width,canvas.height);canvas.width=canvas.height=1;return frame;
    }finally{URL.revokeObjectURL(url)}
  }
  async function read(file,progress=()=>{},options={}){
    if(options.signal?.aborted)throw new DOMException('Lectura cancelada','AbortError');
    if(!root.Worker||!root.WebAssembly)throw Error('El navegador necesita actualizarse para usar el lector de fotos.');
    progress(0,'Abriendo foto');const frame=await pixels(file);
    if(options.signal?.aborted)throw new DOMException('Lectura cancelada','AbortError');
    return new Promise((resolve,reject)=>{
      const worker=new Worker(workerURL),timer=setTimeout(()=>finish(Error('La lectura ha tardado demasiado. Recorta la foto para que solo aparezca el ticket y reintenta.')),180000);
      const abort=()=>finish(new DOMException('Lectura cancelada','AbortError'));
      let done=false;
      function finish(error,result){if(done)return;done=true;clearTimeout(timer);options.signal?.removeEventListener('abort',abort);worker.terminate();if(error)reject(error);else resolve(result)}
      options.signal?.addEventListener('abort',abort,{once:true});
      worker.onmessage=({data})=>{if(data.type==='progress')progress(data.percent,data.stage);else if(data.type==='error')finish(Error(data.message));else if(data.type==='result')finish(null,{...CasaReceiptLayout.compose(data.words),engine:data.engine})};
      worker.onerror=()=>finish(Error('No se pudo iniciar el lector. Comprueba la conexión y vuelve a intentarlo.'));
      worker.postMessage({width:frame.width,height:frame.height,buffer:frame.data.buffer},[frame.data.buffer]);
    });
  }
  root.CasaReceiptOCR={read};
})(globalThis);
