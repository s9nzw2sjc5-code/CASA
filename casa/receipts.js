/* Validación e idempotencia de tiques. No contiene credenciales ni datos de compras. */
(function(root){
  'use strict';
  const copy=x=>JSON.parse(JSON.stringify(x));
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const cents=n=>Number.isFinite(Number(n))?Math.round(Number(n)*100):NaN;
  const validDate=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))return false;const time=new Date(d+'T12:00:00Z');return !Number.isNaN(time.getTime())&&time.toISOString().slice(0,10)===d};
  const signature=lines=>JSON.stringify(lines.map(l=>[norm(l.name),Number(l.units)||1,cents(l.price),Number(l.kg)||0]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
  function validate(t){
    const reasons=[],issues=[];let sum=0;
    const issue=(field,message,index)=>issues.push({field,message,...(index===undefined?{}:{index})});
    if(!t.store||!norm(t.store)){reasons.push('Falta el comercio');issue('store','Selecciona el comercio')}
    if(!validDate(t.date)){reasons.push('Falta una fecha válida');issue('date','Confirma la fecha de compra')}
    if(!(cents(t.total)>0)){reasons.push('Falta el total pagado');issue('total','Introduce el total del ticket')}
    if(!Array.isArray(t.lines)||!t.lines.length)reasons.push('No se han leído artículos');
    (t.lines||[]).forEach((l,index)=>{
      if(t.ocrEngine&&l.quantityObserved===false){reasons.push('Confirma las cantidades que no se han podido leer');issue('units','Cantidad sin leer: confirma cuánto compraste',index)}
      if(Number.isFinite(cents(l.price)))sum+=cents(l.price);
      if(!norm(l.name)){reasons.push('Hay una línea incompleta');issue('name','Nombre sin leer: escribe el producto',index)}
      if(!Number.isFinite(cents(l.price))){reasons.push('Hay una línea incompleta');issue('price','Importe sin leer: introduce el precio de esta línea',index)}
      if(!Number.isFinite(Number(l.units))||l.units<=0||(l.kg!==undefined&&(!Number.isFinite(l.kg)||l.kg<=0))){reasons.push('Hay una línea incompleta');issue('units','Cantidad sin leer: confirma cuánto compraste',index)}
      if(Number.isFinite(l.unit)&&Math.abs(cents(l.unit*(l.kg||l.units))-cents(l.price))>1){reasons.push('Hay una cantidad o precio unitario que no cuadra');issue('units','La cantidad y el precio unitario no coinciden con el importe',index)}
      if(l.plan?.inventory&&(!(Number(l.plan.amount)>0)||!Number.isFinite(Number(l.plan.amount)))){reasons.push('Falta confirmar cuánto añadir a casa');issue('stock','Confirma la cantidad que se añadirá a casa',index)}
    });
    if(sum!==cents(t.total))reasons.push('La suma de artículos no coincide con el total');
    return {ok:!reasons.length,reasons:[...new Set(reasons)],issues:issues.filter((x,i,a)=>a.findIndex(y=>y.field===x.field&&y.index===x.index)===i),sumCents:sum,totalCents:cents(t.total)};
  }
  async function hash(text){
    const bytes=new TextEncoder().encode(text);return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  async function identify(t){
    const key=await hash([t.date,cents(t.total),norm(t.store)].join('|'));
    const lines=await hash(signature(t.lines));return {key,lines,id:'receipt-'+key.slice(0,24)+'-'+lines.slice(0,16),imageHash:t.imageHash||''};
  }
  function duplicates(state,t,id){
    const buys=(state.buys||[]).filter(b=>!b.voided);
    const exact=buys.find(b=>(id.imageHash&&b.imageHash===id.imageHash)||(id.key&&id.lines&&b.receiptKey===id.key&&b.lineFingerprint===id.lines)||(b.id===id.id)||(b.ticket&&b.date===t.date&&cents(b.total)===cents(t.total)&&norm(b.store)===norm(t.store)&&Array.isArray(b.items)&&signature(b.items)===signature(t.lines)));
    const candidates=buys.filter(b=>b.date===t.date&&cents(b.total)===cents(t.total)&&(!b.store||norm(b.store)===norm(t.store)));
    return {exact,candidates};
  }
  function patch(state,t,id,options={}){
    if(!state||!['buys','pantry','items'].every(k=>Array.isArray(state[k]))||!Number.isInteger(state.rev||0))throw new Error('El documento no tiene la estructura esperada de CASA. No se ha modificado.');
    state=normalizeHistory(copy(state));
    const v=validate(t);if(!v.ok)throw new Error(v.reasons.join('. '));
    const match=duplicates(state,t,id);
    if(match.exact)return {patch:{},result:{id:match.exact.id,duplicate:true}};
    if(match.candidates.length&&!t.pendingBuyId&&!options.matchId&&!options.confirmNew){const e=new Error('Hay una compra del mismo día e importe. Revisa si es el mismo gasto.');e.code='receipt_review';throw e}
    const matchId=t.pendingBuyId||options.matchId;
    const old=matchId?(state.buys||[]).find(b=>b.id===matchId):null;
    if(matchId&&!old)throw new Error('La compra seleccionada ya no existe. Vuelve a revisar el tique.');
    if(old&&!old.receiptPending&&(old.date!==t.date||cents(old.total)!==cents(t.total)||(old.store&&norm(old.store)!==norm(t.store))))throw new Error('El gasto seleccionado no coincide en fecha, comercio e importe.');
    if(old?.ticket)return {patch:{},result:{id:old.id,duplicate:true}};
    // Al completar un gasto previo, no volvemos a incrementar existencias.
    const inventory=!old||!!old.receiptPending;
    const credited=new Map((old?.pendingInventory||[]).map(x=>[x.id,{...x}]));
    const next=copy(state),changes=new Set(['buys']);
    const items=[],effects=[];let added=0,removed=0;const consumed=new Set(),totals={};
    for(const l of t.lines)for(const key of l.plan?.shoppingIds||[])totals[key]=(totals[key]||0)+Number(l.plan.shoppingAmount??(l.kg?0:l.units));
    for(let index=0;index<t.lines.length;index++){
      const l=t.lines[index],plan=l.plan||{},price=cents(l.price)/100;
      const line={name:l.name,units:l.units,unitPrice:l.unit,price,qty:l.kg?l.kg+' kg':'',...(l.kg?{kg:l.kg}:{}),...(plan.mid?{mid:plan.mid}:{})};
      items.push(line);
      if(!inventory||price<=0)continue;
      let x;
      if(plan.inventory){
        next.pantry=next.pantry||[];
        if(plan.inventory!=='new'){x=next.pantry.find(p=>p.id===plan.inventory);if(!x)throw new Error('Un producto de la despensa cambió. Revisa el tique otra vez.')}
        else x=next.pantry.find(p=>(plan.mid&&p.mid===plan.mid)||norm(p.name)===norm(l.name));
        if(!x){x={id:'pantry-'+id.id+'-'+index,name:l.name,n:0,u:plan.unit||'ud',min:0,loc:plan.loc||'Despensa',auto:false,mid:plan.mid||'',at:t.date};next.pantry.push(x)}
        let amount=Number(plan.amount);
        const dimension=x.u==='ud'?'ud':'m',from=plan.unit==='ud'?'ud':'m';
        if(dimension!==from){amount=plan.weight?(from==='ud'?amount*plan.weight:amount/plan.weight):dimension==='ud'?l.units:NaN}
        if(!Number.isFinite(amount)||amount<=0)throw new Error('No se puede determinar cuánto añadir a la despensa. Revisa cantidades y unidades.');
        if(old?.receiptPending){
          const prior=Object.hasOwn(plan,'creditedId')?credited.get(plan.creditedId):[...credited.values()].find(p=>p.pantryId===x.id);
          if(prior){prior.used=true;if(prior.pantryId!==x.id||prior.unit!==x.u)throw Error('El producto ya registrado y su destino en casa no coinciden. Revisa la compra.');const deduct=Math.min(amount,prior.amount);amount-=deduct;prior.amount-=deduct}
        }
        if(amount>0){x.n=Math.round((Number(x.n||0)+amount)*10)/10;x.at=t.date;changes.add('pantry');added++;
        effects.push({pantryId:x.id,amount,unit:x.u});line.inventoryId=x.id;}
      }
      next.prices=next.prices||{};
      // Misma estructura de precios que usa la app; conserva el resto de campos.
      const priceKey=String(l.name).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      const previous=next.prices[priceKey]||{},per=price/(l.kg||l.units),perPrice=Math.round(per*100)/100;
      next.prices[priceKey]={...previous,name:l.name,store:t.store,price:perPrice,n:l.kg?1000:plan.packSize||1,d:l.kg?'m':plan.unit==='ud'?'ud':'m',label:l.name,qtxt:l.kg?'1 kg':plan.packLabel||'1 ud',at:t.date,use:t.store!=='Mercadona',hist:[...(previous.hist||[]).map(historyEntry),{date:t.date,store:t.store,price:perPrice,n:l.kg?1000:plan.packSize||1,d:l.kg?'m':plan.unit==='ud'?'ud':'m'}].slice(-12)};changes.add('prices');
      for(const s of next.staples||[]){if((plan.mid&&s.mid===plan.mid)||norm(s.name)===norm(l.name)){if(!s.last||s.last<t.date)s.last=t.date;delete s.snooze;changes.add('staples')}}
      if(options.removePurchased!==false){
        const before=(next.items||[]).length;
        next.items=(next.items||[]).flatMap(i=>{
          const selected=Array.isArray(plan.shoppingIds)?plan.shoppingIds.includes(i.id):((plan.mid&&i.mid===plan.mid)||norm(i.name)===norm(l.name));
          if(!selected||consumed.has(i.id))return [i];
          if(plan.shoppingNames?.[i.id]&&norm(plan.shoppingNames[i.id])!==norm(i.name))throw new Error('Un producto de Compras cambió. Revisa cuál has comprado antes de quitarlo.');
          consumed.add(i.id);
          const count=Number(i.units),purchased=Number(totals[i.id]??plan.shoppingAmount??(l.kg?0:l.units));
          if(Number.isFinite(count)&&count>0&&purchased>0&&purchased<count){
            const remain=Math.round((count-purchased)*1000)/1000,ratio=remain/count;
            return [{...i,units:remain,qty:i.qty?remain+' × pendiente':'',...(Number.isFinite(i.price)?{price:Math.round(i.price*ratio*100)/100,uprice:Number.isFinite(i.uprice)?i.uprice:Math.round(i.price/count*100)/100}:{}),...(i.pq?{pq:{...i.pq,n:i.pq.n*ratio}}:{})}];
          }
          if(!Number.isFinite(purchased)||purchased<0)throw Error('Confirma cuánto descontar de Compras.');
          if(purchased===0)return [i];
          return [];
        });removed+=before-next.items.length;if(JSON.stringify(state.items)!==JSON.stringify(next.items))changes.add('items');
      }
    }
    for(const prior of credited.values())if(prior.used&&prior.amount>0){
      const x=next.pantry.find(x=>x.id===prior.pantryId);if(!x||x.n<prior.amount)throw Error('No se pueden corregir las existencias ya consumidas. Revisa la cantidad comprada.');
      x.n=Math.round((x.n-prior.amount)*10)/10;changes.add('pantry');effects.push({pantryId:x.id,amount:-prior.amount,unit:x.u});
    }
    const savedAt=old&&typeof old.at==='number'&&Number.isFinite(old.at)?old.at:typeof options.at==='number'&&Number.isFinite(options.at)?options.at:Date.now();
    const record={...(old||{}),id:old?old.id:id.id,date:t.date,store:t.store,total:cents(t.total)/100,n:items.length,items,ticket:true,manual:false,receiptPending:false,receiptCheckedAt:Date.now(),at:savedAt,by:old?.by||options.by||'',receiptVersion:2,receiptKey:id.key,lineFingerprint:id.lines,imageHash:id.imageHash,inventoryApplied:inventory,inventoryEffects:effects};
    for(const l of t.lines){
      if(l.originalName&&norm(l.originalName)!==norm(l.name)){
        next.cook=next.cook||{};next.cook.receiptAliases={...(next.cook.receiptAliases||{}),[norm(t.store)+'|'+norm(l.originalName)]:{name:l.name,store:t.store}};changes.add('cook');
      }
    }
    record.undoPrevious=old?copy(old):null;
    next.buys=old?next.buys.map(b=>b.id===old.id?record:b):[...(next.buys||[]).filter(b=>b.id!==record.id),record];
    const stores=next.cook?.stores||options.defaultStores||[];if(!stores.includes(t.store)){next.cook={...(next.cook||{}),stores:[...new Set([...stores,t.store])]};changes.add('cook')}
    record.undoJournal=[];
    for(const field of changes){
      if(field==='buys')continue;
      const array=Array.isArray(next[field]),before=state[field]|| (array?[]:{}),after=next[field];
      const a=array?Object.fromEntries(before.map(x=>[x.id,x])):before,b=array?Object.fromEntries(after.map(x=>[x.id,x])):after;
      for(const key of new Set([...Object.keys(a),...Object.keys(b)]))if(JSON.stringify(a[key])!==JSON.stringify(b[key]))record.undoJournal.push({field,key,array,beforeIndex:array?before.findIndex(x=>x.id===key):0,before:a[key]==null?null:copy(a[key]),after:b[key]==null?null:copy(b[key])});
    }
    const out={};for(const k of changes)out[k]=next[k];out.rev=(state.rev||0)+1;out.updated=typeof options.at==='number'&&Number.isFinite(options.at)?options.at:Date.now();
    assertData(out);
    return {patch:out,result:{id:record.id,duplicate:false,enriched:!!old,added,removed}};
  }
  function undo(state,id){
    const buy=(state.buys||[]).find(b=>b.id===id);
    if(!buy)throw Error('La compra ya no existe.');
    if(!buy.ticket&&buy.receiptUndoId===id)return {patch:{},result:{id,duplicate:true,restored:true}};
    if(buy.voided)return {patch:{},result:{id,duplicate:true}};
    if(!Array.isArray(buy.undoJournal))throw Error('Este ticket antiguo no tiene un registro seguro para deshacerlo.');
    const patch={},next=copy(state);
    for(const effect of buy.undoJournal){
      const current=effect.array?(next[effect.field]||[]).find(x=>x.id===effect.key):next[effect.field]?.[effect.key];
      if(JSON.stringify(current??null)!==JSON.stringify(effect.after))throw Error('Han cambiado productos o datos de esta compra. No se ha deshecho nada para proteger los cambios posteriores.');
      if(effect.array){next[effect.field]=(next[effect.field]||[]).filter(x=>x.id!==effect.key);if(effect.before!==null)next[effect.field].splice(Math.min(effect.beforeIndex??next[effect.field].length,next[effect.field].length),0,copy(effect.before))}
      else{next[effect.field]={...(next[effect.field]||{})};if(effect.before===null)delete next[effect.field][effect.key];else next[effect.field][effect.key]=copy(effect.before)}
      patch[effect.field]=next[effect.field];
    }
    const reverted=buy.undoPrevious?{...copy(buy.undoPrevious),receiptUndoId:id}:{...buy,voided:true,originalTotal:buy.total,total:0,voidedAt:Date.now()};
    patch.buys=next.buys.map(b=>b.id===id?reverted:b);patch.rev=(state.rev||0)+1;patch.updated=Date.now();assertData(patch);
    return {patch,result:{id,duplicate:false,restored:!!buy.undoPrevious}};
  }
  function historyEntry(value){
    if(!Array.isArray(value))return value;
    return {date:value[0],store:value[1],price:value[2],n:value[3]||0,d:value[4]||'m'};
  }
  function normalizeHistory(state){
    for(const price of Object.values(state?.prices||{}))if(Array.isArray(price.hist))price.hist=price.hist.map(historyEntry);
    return state;
  }
  function assertData(value,path='tique',insideArray=false){
    if(value===null||typeof value==='string'||typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value)))return;
    if(Array.isArray(value)){if(insideArray)throw new Error('Lista anidada no válida en '+path+'. No se ha enviado el tique.');value.forEach((item,i)=>assertData(item,path+'['+i+']',true));return}
    if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype){for(const [key,item] of Object.entries(value))assertData(item,path+'.'+key);return}
    throw new Error('Dato no válido en '+path+'. No se ha enviado el tique.');
  }
  const api={version:51,assertData,historyEntry,normalizeHistory,norm,cents,validDate,signature,validate,hash,identify,duplicates,patch,undo};
  root.CasaReceipts=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:window);
