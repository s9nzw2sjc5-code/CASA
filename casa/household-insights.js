/* Consultas del hogar: solo lectura; precios y gastos siempre proceden de compras. */
(function(root){
 'use strict';
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
 const cents=n=>n!==null&&n!==''&&Number.isFinite(Number(n))?Math.round(Number(n)*100):null;
 const lines=b=>(b.items||[]).map(l=>typeof l==='string'?{name:l}:l).filter(l=>l&&typeof l.name==='string');
 function purchases(state,today){
  const seen=new Set();return (state.buys||[]).filter(b=>b&&!b.voided&&date(b.date)&&(!today||b.date<=today)).slice().sort((a,b)=>b.date.localeCompare(a.date)||(Number(b.receiptCheckedAt||b.at)||0)-(Number(a.receiptCheckedAt||a.at)||0)).filter(b=>{const keys=[b.id&&'id:'+b.id,b.imageHash&&'image:'+b.imageHash,b.receiptKey&&b.lineFingerprint&&'receipt:'+b.receiptKey+'|'+b.lineFingerprint].filter(Boolean);if(keys.some(k=>seen.has(k)))return false;keys.forEach(k=>seen.add(k));return true});
 }
 function unitPrice(line){
  const total=cents(line.price),weighted=Object.hasOwn(line,'kg')||/^\s*\d+(?:[.,]\d+)?\s*kg\s*$/.test(line.qty||''),amount=Number(weighted?(line.kg??String(line.qty).replace(',','.').replace(/\s*kg\s*$/,'')):line.units);
  if(!(total>0)||!Number.isFinite(amount)||amount<=0)return null;
  const unit=Number(line.unitPrice);if(line.unitPrice!==undefined&&(!Number.isFinite(unit)||unit<=0||Math.abs(cents(unit*amount)-total)>1))return null;
  return {value:Math.round(total/amount)/100,basis:weighted?'kg':'envase',pack:!weighted&&line.packSize>0&&['g','ml','ud'].includes(line.packUnit)?line.packUnit+':'+Number(line.packSize):'',packLabel:line.packLabel||''};
 }
 function linked(state,line,buy){
  const pantry=(state.pantry||[]).find(p=>p.id===line.inventoryId),mid=String(line.mid||pantry?.mid||''),alias=state.cook?.receiptAliases?.[norm(buy?.store)+'|'+norm(line.name)];
  return {mid,name:alias?.name||line.name};
 }
 function matches(state,line,product,buy){
  const actual=linked(state,line,buy);if(product.mid&&actual.mid)return String(product.mid)===actual.mid;
  return !product.mid&&!actual.mid&&norm(product.name)===norm(actual.name);
 }
 function priceHistory(state,product,options={}){
  const rows=[];for(const b of purchases(state,options.today)){if(b.receiptPending)continue;for(const l of lines(b)){if(!matches(state,l,product,b))continue;const price=unitPrice(l);if(price)rows.push({...price,date:b.date,store:b.store||'',buyId:b.id||'',name:l.name})}}
  const current=options.current&&String(options.current.id)===String(product.mid)?options.current:null,pack=current?current.d==='ud'?'ud:'+current.size:(current.fmt==='l'?'ml:':'g:')+current.size:'',basis=current?.refFmt==='kg'&&rows[0]?.basis==='kg'?'kg':'envase';
  const previous=rows.find(r=>current&&norm(r.store)==='mercadona'&&r.basis===basis&&(r.basis==='kg'||!!r.pack&&r.pack===pack));
  const value=previous?(basis==='kg'?current.ref:current.price):0,delta=previous&&value>0?Math.round((value-previous.value)*100)/100:null;
  return {rows:rows.slice(0,16),previous:previous||null,current:value||0,delta,basis};
 }
 function category(line,product){
  const cat=norm(line.category||product?.cat||line.section),name=norm(line.name);
  if(/limpieza|hogar/.test(cat))return 'Limpieza';
  if(/cuidado|higiene|maquillaje|parafarmacia/.test(cat))return 'Higiene';
  if(/aceite|especias|salsas|agua|refrescos|aperitivos|arroz|legumbres|pasta|azucar|caramelos|chocolate|bodega|cacao|cafe|infusiones|carne|cereales|galletas|charcuteria|quesos|congelados|conservas|caldos|cremas|fruta|verdura|huevos|leche|mantequilla|marisco|pescado|panaderia|pasteleria|pizzas|platos preparados|postres|yogures|zumos|despensa|frescos/.test(cat))return 'Alimentación';
  if(/\b(detergente|suavizante|lejia|limpiador|lavavajillas|estropajo|fregasuelos|bolsas? basura)\b/.test(name))return 'Limpieza';
  if(/\b(champu|gel de ducha|dentifrico|dental|desodorante|desmaq|crema corporal|papel higienico|compresas|tampones)\b/.test(name))return 'Higiene';
  if(/\b(arroz|leche|cafe|pan|pollo|queso|tomate|pasta|huevos|agua|fruta|aceite|yogur|atun|pescado|verdura|patata|cerdo|ternera|pizza|jamon|zumo|galletas)\b/.test(name))return 'Alimentación';
  return 'Sin clasificar y ajustes';
 }
 function spending(state,month,options={}){
  const totals={'Alimentación':0,'Limpieza':0,'Higiene':0,'Sin clasificar y ajustes':0,'Pendiente de ticket':0};let total=0,count=0;
  for(const b of purchases(state,options.today).filter(b=>b.date.slice(0,7)===month)){
   const amount=cents(b.total);if(amount===null||amount<0)continue;total+=amount;count++;
   if(b.receiptPending){totals['Pendiente de ticket']+=amount;continue}
   let classified=0;for(const l of lines(b)){const price=cents(l.price);if(price===null)continue;const info=linked(state,l,b),product=options.lookup?.(info.mid);const group=price<0?'Sin clasificar y ajustes':category(l,product);totals[group]+=price;classified+=price}
   totals['Sin clasificar y ajustes']+=amount-classified;
  }
  return {month,totalCents:total,count,groups:Object.entries(totals).map(([name,cents])=>({name,cents}))};
 }
 function search(state,query,options={}){
  const tokens=norm(query).split(' ').filter(Boolean);if(!tokens.length)return [];
  const groups=new Map(),known=new Map(),addKnown=(name,mid)=>{if(!mid||!norm(name))return;const k=norm(name);if(!known.has(k))known.set(k,new Set());known.get(k).add(String(mid))};
  for(const p of [...(state.pantry||[]),...(state.items||[])])addKnown(p.name,p.mid);
  for(const p of options.products||[])addKnown(p.name,p.id);
  const buys=purchases(state,options.today).filter(b=>!b.receiptPending);for(const b of buys)for(const l of lines(b)){const x=linked(state,l,b);addKnown(x.name,x.mid);addKnown(l.name,x.mid)}
  function get(line,buy){const x=linked(state,line,buy),refs=known.get(norm(x.name)),mid=x.mid||(refs?.size===1?[...refs][0]:''),key=mid?'mid:'+mid:'name:'+norm(x.name);if(!norm(x.name)||/^\d+$/.test(norm(x.name)))return null;if(!groups.has(key)){const product=mid&&options.lookup?.(mid);groups.set(key,{key,mid,name:product?.name||x.name,img:product?.img||'',product:product||null,names:new Set(),pantry:[],items:[],purchases:[],favorites:[]})}const g=groups.get(key);g.names.add(x.name);g.names.add(line.name);return g}
  for(const p of state.pantry||[])get(p)?.pantry.push(p);
  for(const i of state.items||[])get(i)?.items.push(i);
  for(const b of buys)for(const l of lines(b)){if(cents(l.price)!==null&&cents(l.price)<=0)continue;const g=get(l,b);if(g&&!g.purchases.some(x=>x.id===b.id&&x.date===b.date))g.purchases.push({id:b.id,date:b.date,store:b.store})}
  for(const p of options.products||[])get({name:p.name,mid:p.id});
  const superId=options.listId||'super';for(const list of state.lists||[]){const keys=state.cook?.[list.id===superId?'fav':'favList:'+list.id]||[];for(const key of keys){const p=String(key).startsWith('n:')?{name:String(key).slice(2)}:{mid:String(key),name:options.lookup?.(String(key))?.name||state.cook?.['favInfo:'+key]?.name||''};const g=get(p);if(g)g.favorites.push(list.id)}}
  return [...groups.values()].filter(g=>tokens.every(t=>norm([g.name,...g.names].join(' ')).includes(t))).map(g=>({...g,names:[...g.names],score:(norm(g.name)===norm(query)?100:0)+(g.pantry.length?12:0)+(g.items.length?10:0)+(g.purchases.length?5:0)})).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'es')).slice(0,30);
 }
 const api={norm,purchases,unitPrice,priceHistory,spending,search};root.CasaInsights=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
