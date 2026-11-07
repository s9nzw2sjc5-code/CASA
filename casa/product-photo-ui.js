/* Foto → etiqueta → elección → lista. Sin API ni subida de imágenes. */
async function shoppingProductPhoto(){
  const list=curList();let selected='',busy=false,added=false,url='',controller=null,sequence=0,photoKeys=[],currentFile=null;
  const ov=sheet('Añadir producto con foto',`<p class="hint">Fotografía un solo producto, con el nombre y la variedad de frente y sin reflejos. Confirma el producto antes de añadirlo a <b>${esc(list.name)}</b>.</p><div class="ck-actions"><label class="btn" for="productCamera">📷 Hacer foto</label><label class="btn sec" for="productLibrary">Elegir foto</label></div><input id="productCamera" type="file" accept="image/*" capture="environment" hidden><input id="productLibrary" type="file" accept="image/*" hidden><img id="productPhotoPreview" class="product-photo-preview" alt="Foto del producto" hidden><button type="button" class="btn sec" id="productPhotoCrop" hidden>✂️ Acercar etiqueta y volver a leer</button><p id="productPhotoStatus" role="status" aria-live="polite">La foto se lee en este dispositivo. La primera vez se descargará el lector.</p><label for="productPhotoSearch">Buscar producto para asociarlo a la foto</label><input id="productPhotoSearch" class="field" type="search" autocomplete="off" placeholder="Ej.: leche semidesnatada"><p class="hint">Al confirmar, recordaremos la asociación para próximas lecturas. Puedes cambiarla eligiendo otro producto.</p><div id="productPhotoResults"></div><details><summary>Ver texto leído</summary><pre id="productPhotoText" class="ck-pre"></pre></details><label for="productPhotoUnits">Envases que necesitas</label><input id="productPhotoUnits" class="field" type="number" inputmode="numeric" min="1" max="99" step="1" value="1">`,{autoFocus:false,saveLabel:'Confirmar y añadir',onSave:()=>{
    if(busy||added)return false;
    const raw=MC?.byId.get(selected),quantity=Number(ov.querySelector('#productPhotoUnits').value);
    if(!raw){status.textContent='Selecciona el producto que quieres añadir.';return false}
    if(!Number.isInteger(quantity)||quantity<1||quantity>99){status.textContent='Indica de 1 a 99 envases.';return false}
    if(!S.lists.some(l=>l.id===list.id)){status.textContent='Esta lista ya no existe. Cierra y elige otra lista.';return false}
    added=true;const existing=S.items.find(i=>i.listId===list.id&&!i.done&&i.mid===selected);
    cartSet(prod(raw),(existing?(existing.units||1):0)+quantity,list.id);
    if(photoKeys.length)S.prodMap=CasaProductPhoto.learn(S.prodMap,photoKeys,selected);
    save();toastUndo('Producto añadido a '+list.name);
  }});
  const status=ov.querySelector('#productPhotoStatus'),results=ov.querySelector('#productPhotoResults'),saveButton=ov.querySelector('[data-s="ok"]'),preview=ov.querySelector('#productPhotoPreview');
  ov.querySelector('.sheet').classList.add('product-photo-sheet');
  saveButton.disabled=true;
  const observer=new MutationObserver(()=>{if(!ov.isConnected){controller?.abort();if(url)URL.revokeObjectURL(url);observer.disconnect()}});observer.observe(document.body,{childList:true,subtree:true});
  function show(candidates,message){
    selected='';saveButton.disabled=true;status.textContent=message;
    results.innerHTML=candidates.map(({id,learned})=>{const row=MC.byId.get(id),p=prod(row);return `<label class="product-photo-option"><input type="radio" name="photoProduct" value="${esc(id)}">${p.img?`<img src="${imgUrl(p.img,192)}" alt="" loading="lazy">`:''}<span><b>${esc(p.name)}</b>${learned?'<small>↪ Asociado anteriormente por vosotros</small>':''}<small>${esc(p.pack)} · ${esc(prodSize(p))} · ${eur(p.price)}</small></span></label>`}).join('');
  }
  results.addEventListener('error',e=>{if(e.target.tagName==='IMG')e.target.hidden=true},true);
  results.addEventListener('change',e=>{if(!e.target.matches('[name="photoProduct"]'))return;selected=e.target.value;saveButton.disabled=busy||!selected;status.textContent='Seleccionado: '+prod(MC.byId.get(selected)).name+'. Comprueba la variedad y el tamaño.'});
  async function read(file,sourceKeys=[]){
    const run=++sequence;currentFile=file;controller?.abort();controller=new AbortController();const signal=controller.signal;
    selected='';photoKeys=[];busy=true;saveButton.disabled=true;results.replaceChildren();ov.querySelector('#productPhotoText').textContent='';ov.querySelector('#productPhotoSearch').value='';
    if(url)URL.revokeObjectURL(url);url='';preview.hidden=true;ov.querySelector('#productPhotoCrop').hidden=true;
    try{
      if(!file||!file.size||file.size>25000000)throw Error('Elige una foto de hasta 25 MB.');
      url=URL.createObjectURL(file);preview.src=url;preview.hidden=false;
      await preview.decode().catch(()=>{throw Error('No se puede abrir esta foto. Prueba con JPEG o PNG.')});
      const imageKey=await CasaProductPhoto.imageKey(file);
      if(run!==sequence||!ov.isConnected)return;
      photoKeys=[...new Set([...sourceKeys,...(imageKey?[imageKey]:[])])];
      ov.querySelector('#productPhotoCrop').hidden=false;
      if(signal.aborted)return;
      status.textContent='Leyendo la etiqueta…';
      if(!MC)await loadMC();if(signal.aborted||!ov.isConnected)return;
      if(!MC)throw Error('No se pudo cargar el catálogo. Revisa la conexión y vuelve a intentarlo.');
      const reading=await CasaReceiptOCR.read(file,(n,stage)=>{if(run===sequence&&ov.isConnected)status.textContent=(stage||'Leyendo la etiqueta').replace(/tickets?/gi,'etiquetas')+' · '+n+' %'},{signal,kind:'product'});
      if(signal.aborted||!ov.isConnected)return;
      const labelKey=await CasaProductPhoto.labelKey(reading);if(signal.aborted||!ov.isConnected)return;
      if(labelKey)photoKeys.push(labelKey);
      const remembered=CasaProductPhoto.learnedIds(photoKeys,S.prodMap,MC.p);
      const match=CasaProductPhoto.rank(reading,MC.p,8,remembered);ov.querySelector('#productPhotoText').textContent=reading.text||'No se ha podido leer texto.';
      show(match.candidates,remembered.length?'Hemos recordado una asociación anterior. Comprueba que sigue correspondiendo a este envase.':match.candidates.length?'Estas son posibles coincidencias. Elige la que corresponda a tu envase.':reading.text?.trim()?'He leído parte de la etiqueta, pero no encuentro una coincidencia fiable. Acerca la etiqueta o busca el nombre para asociarlo.':'No se distingue texto de la etiqueta. Acerca la etiqueta y vuelve a leerla, o busca el nombre.');
    }catch(e){if(signal.aborted||!ov.isConnected)return;const remembered=MC?CasaProductPhoto.learnedIds(photoKeys,S.prodMap,MC.p):[];show(remembered.map(id=>({id,learned:true})),remembered.length?'Esta foto tiene una asociación anterior. Confirma el producto o busca otro.':e.message||'No se ha podido leer la foto. Prueba otra imagen o busca el nombre.')}
    finally{if(run===sequence&&ov.isConnected){busy=false;saveButton.disabled=!selected;ov.querySelector('#productPhotoSearch').disabled=false}}
  }
  ov.querySelector('#productPhotoCrop').addEventListener('click',async()=>{
    if(!currentFile)return;
    const run=sequence,keys=photoKeys.filter(k=>k.startsWith('photo:v1:image:'));
    controller?.abort();busy=false;
    try{const crop=await cropTicketImage(currentFile,{kind:'product'});if(ov.isConnected&&run===sequence){if(crop)read(crop,keys);else status.textContent='Recorte cancelado. Puedes buscar el producto o volver a acercar la etiqueta.'}}
    catch(e){if(ov.isConnected)status.textContent=e.message||'No se pudo recortar la foto.'}
  });
  for(const id of ['productCamera','productLibrary'])ov.querySelector('#'+id).addEventListener('change',e=>{const file=e.target.files[0];e.target.value='';if(file)read(file)});
  let timer;
  ov.querySelector('#productPhotoSearch').addEventListener('input',e=>{
    clearTimeout(timer);const query=e.target.value;controller?.abort();busy=false;
    // Invalidar al escribir: no se puede añadir una selección anterior oculta.
    selected='';saveButton.disabled=true;
    timer=setTimeout(async()=>{if(!ov.isConnected||busy)return;if(!MC)await loadMC();if(!ov.isConnected||busy||e.target.value!==query)return;if(!MC){show([],'No se pudo cargar el catálogo. Revisa la conexión.');return}const candidates=query.trim()?searchProducts(query,8):[];show(candidates,candidates.length?'Selecciona el producto y comprueba el tamaño.':'Escribe el nombre completo o prueba otra foto.')},250);
  });
}
