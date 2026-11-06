/* Archivo privado de fotos en este dispositivo, separado de Firestore. */
const ReceiptArchive={
  async db(){return new Promise((resolve,reject)=>{const request=indexedDB.open('casa-receipt-photos',1);request.onupgradeneeded=()=>request.result.createObjectStore('photos');let failed=false;request.onblocked=()=>{failed=true;reject(Error('El archivo de fotos está ocupado en otra ventana.'))};request.onerror=()=>{failed=true;reject(Error('No se puede abrir el archivo de fotos de este dispositivo.'))};request.onsuccess=()=>{if(failed)request.result.close();else resolve(request.result)}})},
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

function receiptDeadline(promise,ms,message){
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(message)),ms);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)})});
}
function receiptSaveStatus(ov,message,error=false){
  let status=ov.querySelector('[data-receipt-save-status]');
  if(!status){status=document.createElement('p');status.dataset.receiptSaveStatus='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.style='flex-basis:100%;margin:0;font-weight:600';const actions=ov.querySelector('.actions');actions.style.flexWrap='wrap';actions.prepend(status)}
  status.style.color=error?'var(--danger)':'var(--ink)';status.textContent=message;
  const existing=ov.querySelector('#tkStatus');if(existing)existing.textContent=message;
  status.scrollIntoView({block:'nearest'});
}
async function saveReceiptPurchase(ticket,file,options={}){
  const result=await receiptDeadline(commitTicket(ticket,options),45000,'No se ha podido confirmar el guardado a tiempo. Reintenta este mismo ticket; se comprobará si ya se guardó para evitar duplicados.');
  if(file&&ticket.imageHash){
    try{await receiptDeadline(ReceiptArchive.put(ticket.imageHash,file),2500,'El archivo de la foto no responde.')}catch(e){result.photoWarning='Compra guardada; no se ha podido conservar la foto en este dispositivo.'}
  }
  return result;
}
function receiptQuickPlan(t){
  const pending=(S.buys||[]).find(b=>b.id===t.pendingBuyId&&b.receiptPending),reasons=[...CasaReceipts.validate(t).reasons];
  if(t.ocrConfidence<85)reasons.push('La lectura necesita confirmación');
  const ticket={...t,lines:t.lines.map(a=>{
    const defaults=receiptLineDefaults(a,t,pending),{plan,matches,credits,prior}=defaults;
    if(a.quantityObserved===false)reasons.push('Confirma las cantidades sin leer');
    if(a.readConfidence<.9)reasons.push('Confirma los productos con lectura dudosa');
    if(plan.ambiguous||matches.length>1)reasons.push('Hay coincidencias que necesitan confirmación');
    if(pending&&!prior&&credits.some(p=>(plan.mid&&p.mid===plan.mid)||receiptNameMatches(p.name,a.name)))reasons.push('Confirma lo ya registrado en casa');
    const existing=(S.pantry||[]).find(p=>p.id===plan.inventory);
    if(existing&&existing.u!==plan.unit)reasons.push('Confirma la cantidad y unidad que añadir a casa');
    if(a.kg&&matches.length)reasons.push('Confirma las unidades de Compras del producto por peso');
    return {...a,plan};
  })};
  if(pending&&(pending.items||[]).some(i=>!ticket.lines.some(l=>(i.mid&&l.plan.mid===i.mid)||receiptNameMatches(i.name,l.name))))reasons.push('Hay productos del carro que no se han detectado');
  return {ok:reasons.length===0,reasons:[...new Set(reasons)],ticket};
}
function receiptSaving(ov,saving){
  ov.dataset.receiptSaving=String(saving);const cancel=ov.querySelector('[data-s="cancel"]');if(cancel)cancel.disabled=saving;
  if(!ov.receiptBusyGuard){ov.receiptBusyGuard=true;ov.addEventListener('click',e=>{if(ov.dataset.receiptSaving==='true'&&(e.target===ov||e.target.closest('[data-s="cancel"]'))){e.preventDefault();e.stopImmediatePropagation()}},true)}
}

const receiptFieldNumber=field=>{let value=field?.value.trim();if(!value)return NaN;if(value.includes(','))value=value.replace(/\./g,'').replace(',','.');return Number(value)};
function receiptIssueField(ov,issue){
  if(issue?.row!==undefined){if(issue.field==='confirmation')return ov.querySelector(`[data-validate-line="${issue.row}"]`);const attribute={name:'nm',price:'pr',units:'units',stock:'stockqty',inventory:'pn',shopping:'shopping'}[issue.field];return attribute?ov.querySelector(`[data-${attribute}="${issue.row}"]`):null}
  return ov.querySelector(({store:'#f_sto',date:'#f_dt',total:'#f_tot'})[issue?.field]||'#f_tot');
}
function receiptFocusIssue(ov,issue){
  const field=receiptIssueField(ov,issue);if(!field)return;
  for(let parent=field.parentElement;parent&&parent!==ov;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
  field.focus({preventScroll:true});field.scrollIntoView({block:'center'});
}
function receiptReviewIssues(ov,t,source){
  const check=CasaReceipts.validate(t),active=[...ov.querySelectorAll('[data-on]')].filter(el=>el.checked).map(el=>Number(el.dataset.on));
  check.issues=check.issues.map(issue=>({...issue,...(issue.index===undefined?{}:{row:active[issue.index]})}));
  const issues=check.issues.slice();
  for(const row of active){const original=source.lines[row],element=ov.querySelector(`[data-receipt-row="${row}"]`);if(original?.readConfidence<.9&&element.dataset.readConfirmed!=='true')issues.push({row,field:'name',warning:true,message:'Lectura dudosa: comprueba el nombre y el importe con la foto'})}
  const pending=(S.buys||[]).find(b=>b.id===source.pendingBuyId&&b.receiptPending);
  for(const row of active){
    const defaults=receiptLineDefaults(source.lines[row],source,pending);
    if(defaults.plan.ambiguous&&!ov.querySelector(`[data-pn="${row}"]`).value)issues.push({row,field:'inventory',warning:true,message:'Hay varios productos en casa: elige a cuál corresponde'});
    if(defaults.matches.length>1&&!ov.querySelector(`[data-shopping="${row}"]`).value)issues.push({row,field:'shopping',warning:true,message:'Hay varias coincidencias en Compras: elige cuál has comprado'});
  }
  for(const row of active){
    const element=ov.querySelector(`[data-receipt-row="${row}"]`),price=receiptFieldNumber(ov.querySelector(`[data-pr="${row}"]`));
    if(Number.isFinite(price)&&Math.abs(price*100-Math.round(price*100))>1e-6){const issue={row,index:active.indexOf(row),field:'price',message:'Escribe el precio con un máximo de dos decimales'};check.issues.push(issue);issues.push(issue);check.ok=false}
    if(issues.some(x=>x.row===row&&x.field!=='confirmation'))element.dataset.validationRequired='true';
    if(element.dataset.validationRequired==='true'&&element.dataset.lineValidated!=='true'&&!issues.some(x=>x.row===row&&x.field==='confirmation')){
      const issue={row,index:active.indexOf(row),field:'confirmation',message:'Pulsa Validar artículo para confirmar esta línea'};check.issues.push(issue);issues.push(issue);check.ok=false;
    }
  }
  check.issues.sort((a,b)=>(a.field==='confirmation')-(b.field==='confirmation'));
  issues.sort((a,b)=>(a.field==='confirmation')-(b.field==='confirmation'));
  ov.querySelectorAll('[aria-invalid="true"]').forEach(el=>{el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby')});
  for(const row of ov.querySelectorAll('[data-receipt-row]')){
    const index=Number(row.dataset.receiptRow),problems=issues.filter(x=>x.row===index),note=ov.querySelector(`[data-line-issue="${index}"]`),label=ov.querySelector(`[data-review-label="${index}"]`),messages=[...new Set(problems.map(x=>x.message))];
    const signature=messages.join(' · ');row.classList.toggle('receipt-row-error',problems.length>0);
    if(problems.length&&signature!==row.dataset.issueSignature)row.open=true;
    row.dataset.issueSignature=signature;note.textContent=signature;note.hidden=!problems.length;
    const labels={confirmation:'Pendiente de validar',units:'Falta confirmar cantidad',price:'Revisar importe',stock:'Revisar cantidad en casa',inventory:'Elegir producto en casa',shopping:'Elegir producto de Compras',name:problems[0]?.warning?'Lectura dudosa':'Revisar nombre'};
    label.textContent=problems.length?' · '+labels[problems[0].field]:row.dataset.lineValidated==='true'?' · ✓ Validado':'';
    const validated=row.dataset.lineValidated==='true',button=ov.querySelector(`[data-validate-line="${index}"]`),status=ov.querySelector(`[data-line-validation="${index}"]`);
    button.disabled=validated||!active.includes(index);button.setAttribute('aria-label',(validated?'Artículo validado: ':'Validar artículo '+(index+1)+': ')+ov.querySelector(`[data-nm="${index}"]`).value);button.textContent=validated?'✓ Artículo validado':'Validar artículo';status.textContent=validated?(problems.length?'Precio confirmado; revisa los otros datos señalados.':'✓ Artículo validado'):row.dataset.validationRequired==='true'?'Escribe el precio de la línea y pulsa Validar artículo.':'';status.style.color=validated?'var(--accent)':'var(--muted)';
    ov.querySelector(`[data-row-price="${index}"]`).textContent=Number.isFinite(receiptFieldNumber(ov.querySelector(`[data-pr="${index}"]`)))?eur(receiptFieldNumber(ov.querySelector(`[data-pr="${index}"]`))):'Sin leer';
    ov.querySelector(`[data-row-name="${index}"]`).textContent=ov.querySelector(`[data-nm="${index}"]`).value||'Artículo '+(index+1);
  }
  const panel=ov.querySelector('#tkIssues');panel.replaceChildren();
  if(issues.length){const title=document.createElement('strong');title.textContent='Revisa estos datos:';panel.append(title)}
  const groups=[];
  for(const issue of issues){const key=issue.row===undefined?issue.field:'row'+issue.row;let group=groups.find(x=>x.key===key);if(!group){group={key,issue,messages:[]};groups.push(group)}group.messages.push(issue.message);
    const field=receiptIssueField(ov,issue);if(field&&!issue.warning){field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby',issue.row===undefined?'tkIssues':'tkLineIssue'+issue.row)}
  }
  for(const group of groups){
    const {issue}=group,button=document.createElement('button');button.type='button';button.className='link';button.dataset.receiptIssue=issue.row===undefined?issue.field:String(issue.row);
    const name=issue.row===undefined?'':ov.querySelector(`[data-nm="${issue.row}"]`).value.trim()||'Artículo '+(issue.row+1);
    button.textContent=(name?name+' — ':'')+[...new Set(group.messages)].join('. ');button.onclick=()=>receiptFocusIssue(ov,issue);panel.append(button);
  }
  const sum=ov.querySelector('#f_sum');sum.textContent='Suma de importes leídos: '+eur(check.sumCents/100)+(check.sumCents===check.totalCents?' · Coincide con el total.':'');
  const delta=check.totalCents-check.sumCents;
  if(Number.isFinite(delta)&&check.totalCents>0&&delta!==0){
    const note=document.createElement('p');note.textContent=(delta>0?'Faltan ':'Sobran ')+eur(Math.abs(delta)/100)+' para cuadrar con el total. El descuadre no permite identificar por sí solo qué producto falta o tiene un precio incorrecto. Compara el ticket y añade el artículo si falta.';panel.append(note);
    const button=document.createElement('button');button.type='button';button.className='link';button.textContent='Comprobar total del ticket';button.onclick=()=>receiptFocusIssue(ov,{field:'total'});panel.append(button);
  }
  return check;
}
