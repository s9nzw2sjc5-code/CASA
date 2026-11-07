/* Foto → etiqueta → elección → lista. Sin API ni subida de imágenes. */
async function shoppingProductPhoto(){
  const list=curList();let selected='',busy=false,added=false,url='',controller=null,sequence=0;
  const ov=sheet('Añadir producto con foto',`<p class="hint">Fotografía un solo producto, con el nombre y la variedad de frente y sin reflejos. Confirma el producto antes de añadirlo a <b>${esc(list.name)}</b>.</p><div class="ck-actions"><label class="btn" for="productCamera">📷 Hacer foto</label><label class="btn sec" for="productLibrary">Elegir foto</label></div><input id="productCamera" type="file" accept="image/*" capture="environment" hidden><input id="productLibrary" type="file" accept="image/*" hidden><img id="productPhotoPreview" class="product-photo-preview" alt="Foto del producto" hidden><p id="productPhotoStatus" role="status" aria-live="polite">La foto se lee en este dispositivo. La primera vez se descargará el lector.</p><div id="productPhotoResults"></div><details><summary>Ver texto leído</summary><pre id="productPhotoText" class="ck-pre"></pre></details><label for="productPhotoSearch">Buscar o corregir el nombre</label><input id="productPhotoSearch" class="field" type="search" autocomplete="off" placeholder="Ej.: leche semidesnatada"><label for="productPhotoUnits">Envases que necesitas</label><input id="productPhotoUnits" class="field" type="number" inputmode="numeric" min="1" max="99" step="1" value="1">`,{autoFocus:false,saveLabel:'Añadir a la lista',onSave:()=>{
    if(busy||added)return false;
    const raw=MC?.byId.get(selected),quantity=Number(ov.querySelector('#productPhotoUnits').value);
    if(!raw){status.textContent='Selecciona el producto que quieres añadir.';return false}
    if(!Number.isInteger(quantity)||quantity<1||quantity>99){status.textContent='Indica de 1 a 99 envases.';return false}
    if(!S.lists.some(l=>l.id===list.id)){status.textContent='Esta lista ya no existe. Cierra y elige otra lista.';return false}
    added=true;const existing=S.items.find(i=>i.listId===list.id&&!i.done&&i.mid===selected);
    cartSet(prod(raw),(existing?(existing.units||1):0)+quantity,list.id);save();toastUndo('Producto añadido a '+list.name);
  }});
  const status=ov.querySelector('#productPhotoStatus'),results=ov.querySelector('#productPhotoResults'),saveButton=ov.querySelector('[data-s="ok"]'),preview=ov.querySelector('#productPhotoPreview');
  ov.querySelector('.sheet').classList.add('product-photo-sheet');
  saveButton.disabled=true;
  const observer=new MutationObserver(()=>{if(!ov.isConnected){controller?.abort();if(url)URL.revokeObjectURL(url);observer.disconnect()}});observer.observe(document.body,{childList:true,subtree:true});
  function show(candidates,message){
    selected='';saveButton.disabled=true;status.textContent=message;
    results.innerHTML=candidates.map(({id})=>{const row=MC.byId.get(id),p=prod(row);return `<label class="product-photo-option"><input type="radio" name="photoProduct" value="${esc(id)}">${p.img?`<img src="${imgUrl(p.img,192)}" alt="" loading="lazy">`:''}<span><b>${esc(p.name)}</b><small>${esc(p.pack)} · ${esc(prodSize(p))} · ${eur(p.price)}</small></span></label>`}).join('');
  }
  results.addEventListener('error',e=>{if(e.target.tagName==='IMG')e.target.hidden=true},true);
  results.addEventListener('change',e=>{if(!e.target.matches('[name="photoProduct"]'))return;selected=e.target.value;saveButton.disabled=busy||!selected;status.textContent='Seleccionado: '+prod(MC.byId.get(selected)).name+'. Comprueba la variedad y el tamaño.'});
  async function read(file){
    const run=++sequence;controller?.abort();controller=new AbortController();const signal=controller.signal;
    selected='';busy=true;saveButton.disabled=true;results.replaceChildren();ov.querySelector('#productPhotoText').textContent='';ov.querySelector('#productPhotoSearch').value='';ov.querySelector('#productPhotoSearch').disabled=true;
    if(url)URL.revokeObjectURL(url);url='';preview.hidden=true;
    try{
      if(!file||!file.size||file.size>25000000)throw Error('Elige una foto de hasta 25 MB.');
      url=URL.createObjectURL(file);preview.src=url;preview.hidden=false;
      status.textContent='Leyendo la etiqueta…';
      if(!MC)await loadMC();if(signal.aborted||!ov.isConnected)return;
      if(!MC)throw Error('No se pudo cargar el catálogo. Revisa la conexión y vuelve a intentarlo.');
      const reading=await CasaReceiptOCR.read(file,(n,stage)=>{if(run===sequence&&ov.isConnected)status.textContent=(stage||'Leyendo la etiqueta').replace(/tickets?/gi,'etiquetas')+' · '+n+' %'},{signal,kind:'product'});
      if(signal.aborted||!ov.isConnected)return;
      const match=CasaProductPhoto.rank(reading,MC.p);ov.querySelector('#productPhotoText').textContent=reading.text||'No se ha podido leer texto.';
      show(match.candidates,match.candidates.length?'Estas son posibles coincidencias. Elige la que corresponda a tu envase.':'No puedo identificar el producto con esta foto. Prueba de frente y con más luz, o busca su nombre.');
    }catch(e){if(signal.aborted||!ov.isConnected)return;show([],e.message||'No se ha podido leer la foto. Prueba otra imagen o busca el nombre.')}
    finally{if(run===sequence&&ov.isConnected){busy=false;saveButton.disabled=!selected;ov.querySelector('#productPhotoSearch').disabled=false}}
  }
  for(const id of ['productCamera','productLibrary'])ov.querySelector('#'+id).addEventListener('change',e=>{const file=e.target.files[0];e.target.value='';if(file)read(file)});
  let timer;
  ov.querySelector('#productPhotoSearch').addEventListener('input',e=>{
    clearTimeout(timer);const query=e.target.value;
    // Invalidar al escribir: no se puede añadir una selección anterior oculta.
    selected='';saveButton.disabled=true;
    timer=setTimeout(async()=>{if(!ov.isConnected||busy)return;if(!MC)await loadMC();if(!ov.isConnected||busy||e.target.value!==query)return;if(!MC){show([],'No se pudo cargar el catálogo. Revisa la conexión.');return}const candidates=query.trim()?searchProducts(query,8):[];show(candidates,candidates.length?'Selecciona el producto y comprueba el tamaño.':'Escribe el nombre completo o prueba otra foto.')},250);
  });
}
