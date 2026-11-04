/* Archivo privado de fotos en este dispositivo, separado de Firestore. */
const ReceiptArchive={
  async db(){return new Promise((resolve,reject)=>{const request=indexedDB.open('casa-receipt-photos',1);request.onupgradeneeded=()=>request.result.createObjectStore('photos');request.onerror=()=>reject(Error('No se puede abrir el archivo de fotos de este dispositivo.'));request.onsuccess=()=>resolve(request.result)})},
  async run(mode,key,value){const db=await this.db();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('photos',mode),store=tx.objectStore('photos'),request=mode==='readwrite'?store.put(value,key):store.get(key);let result;request.onsuccess=()=>result=request.result;tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(Error('No se pudo conservar la foto. Comprueba el espacio libre del dispositivo.'))})}finally{db.close()}},
  key(hash){return (window.CASA_FIREBASE?.projectId||'casa')+':'+hash},
  put(hash,file){return this.run('readwrite',this.key(hash),file)},
  get(hash){return this.run('readonly',this.key(hash))}
};
async function receiptHistoryPhoto(b,ov){
  const target=ov.querySelector('[data-receipt-photo]');if(!target)return;
  try{const file=b.imageHash&&await ReceiptArchive.get(b.imageHash);if(!ov.isConnected)return;
    if(!file){target.textContent='La foto no está guardada en este dispositivo.';return}
    const url=URL.createObjectURL(file),observer=new MutationObserver(()=>{if(!ov.isConnected){URL.revokeObjectURL(url);observer.disconnect()}});observer.observe(document.body,{childList:true,subtree:true});
    if(file.type==='application/pdf'){const link=document.createElement('a');link.href=url;link.target='_blank';link.textContent='Abrir PDF del ticket';target.replaceChildren(link)}else{const img=new Image();img.alt='Foto del ticket guardado';img.style='width:100%;height:auto';img.src=url;target.replaceChildren(img)}
  }catch(e){target.textContent=e.message}
}
async function undoReceipt(b,ov){
  const dialog=sheet('Deshacer importación',`<p>Se retirará el gasto de ${eur(b.total)} y se restaurarán las existencias y la lista de Compras afectadas por este ticket.</p><p class="hint">Si esos datos han cambiado después, se detendrá la operación. La foto seguirá en el historial de este dispositivo.</p><p data-undo-status role="status"></p>`,{saveLabel:'Deshacer compra',onSave:()=>{run();return false}});let busy=false;
  async function run(){if(busy)return;busy=true;const button=dialog.querySelector('[data-s=ok]');button.disabled=true;
    try{await receiptRemoteState();if(pushing||dirty())throw Error('Espera a que termine la sincronización.');clearTimeout(saveTimer);
      const operation=await dbRef.transactPatch('hogar/estado',state=>CasaReceipts.undo(state,b.id));const verified=await docRef.getServer(),current=verified.data().buys.find(x=>x.id===b.id);
      if(!current||(!current.voided&&!operation.result.restored))throw Error('Falta verificar el resultado. Reintenta deshacer este mismo ticket.');
      applyRemote(verified);mcCache.clear();dialog.remove();ov.remove();toast('Compra deshecha y verificada.');buysSheet();
    }catch(e){dialog.querySelector('[data-undo-status]').textContent=e.message}finally{busy=false;button.disabled=false}
  }
}
async function receiptDoubtPreviews(t,file,ov){
  if(!file||!t.ocrLines?.length)return;const url=URL.createObjectURL(file),image=new Image();
  try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url});if(!ov.isConnected)return;
    for(const canvas of ov.querySelectorAll('[data-doubt-preview]')){const line=t.lines[Number(canvas.dataset.doubtPreview)],box=line.readBox;if(!box)continue;const [x,y,r,b]=box,margin=.008,left=Math.max(0,x-margin),top=Math.max(0,y-margin),width=Math.min(1,r+margin)-left,height=Math.min(1,b+margin)-top;canvas.width=800;canvas.height=Math.max(40,Math.round(height*image.naturalHeight/(width*image.naturalWidth)*800));canvas.getContext('2d').drawImage(image,left*image.naturalWidth,top*image.naturalHeight,width*image.naturalWidth,height*image.naturalHeight,0,0,canvas.width,canvas.height)}
  }catch(e){/* La foto completa sigue disponible para revisar. */}finally{URL.revokeObjectURL(url)}
}

function pendingReceiptsHTML(){
  const pending=(S.buys||[]).filter(b=>b.receiptPending&&!b.voided);
  return pending.length?`<section class="ck-box" style="margin-top:12px;padding:14px;border:2px solid var(--accent)"><b>📷 Tickets pendientes de comprobar</b><p class="hint">Comprueba también lo que compraste sin apuntarlo en la lista.</p>${pending.map(b=>`<button class="btn sec" style="width:100%;margin-top:6px" data-act="ckPendingReceipt" data-id="${esc(b.id)}">${esc(b.store)} · ${esc(b.date)} · Añadir ticket</button>`).join('')}</section>`:'';
}
