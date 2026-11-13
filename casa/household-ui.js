/* Buscar, consultar precios y entender el gasto usando el estado existente. */
function houseLookup(id){return id&&MC?.byId.has(String(id))?prod(MC.byId.get(String(id))):null}
function housePriceHTML(product){
  const current=houseLookup(product.mid),data=CasaInsights.priceHistory(S,product,{today:today(),current});
  if(!data.rows.length)return '<p class="hint">Todavía no hay precios pagados con cantidades comprobables.</p>';
  const change=data.delta===null?'':`<p class="house-price-change">${data.delta>0?'Ha subido':data.delta<0?'Ha bajado':'Mismo precio'}${data.delta?' '+eur(Math.abs(data.delta)):''} por ${data.basis} · antes ${eur(data.previous.value)}, ahora ${eur(data.current)}.<small>Misma referencia y formato · ${esc(data.previous.date.split('-').reverse().join('/'))}</small></p>`;
  const row=p=>`<div><span>${esc(p.date.split('-').reverse().join('/'))} · ${esc(p.store||'Compra')}<small>${p.basis==='kg'?'Por kg':p.packLabel?esc(p.packLabel):'Por envase · formato sin registrar'}</small></span><b>${eur(p.value)}</b></div>`;
  return `<section class="house-price-history"><h4>Precios pagados</h4>${change}<div class="house-price-rows">${data.rows.slice(0,2).map(row).join('')}</div>${data.rows.length>2?`<details class="house-price-more"><summary>Ver ${data.rows.length-2} precios anteriores</summary><div class="house-price-rows">${data.rows.slice(2).map(row).join('')}</div></details>`:''}${!data.previous&&current?'<p class="hint">El formato anterior no está confirmado; compruébalo antes de comparar con el precio actual.</p>':''}</section>`;
}
function houseInList(product,lid){return S.items.some(i=>i.listId===lid&&((product.mid&&String(i.mid||'')===String(product.mid))||(!i.mid&&CasaInsights.norm(i.name)===CasaInsights.norm(product.name))))}
function houseAdd(product,lid){
  if(!S.lists.some(l=>l.id===lid)){toast('Elige una lista que exista.');return false}
  if(houseInList(product,lid)){toast('Ya está en esa lista o en el carro.');return false}
  const current=houseLookup(product.mid);return addToList(current?{mid:current.id,name:current.name,units:1}:{name:product.name,mid:product.mid||'',units:1},lid);
}
function houseProductSheet(product,onChange=()=>{}){
  let lid=ui.view==='compras'?curList().id:cartList();const current=houseLookup(product.mid),inventory=(S.pantry||[]).filter(p=>(product.mid&&String(p.mid)===String(product.mid))||(!p.mid&&CasaInsights.norm(p.name)===CasaInsights.norm(product.name))),last=product.purchases?.[0];
  const ov=sheet(product.name,`${productSheetPhoto(current?.img||product.img||(product.mid?shoppingSuggestionInfo(product).img:''),product.name)}<p class="hint">${inventory.length?inventory.some(p=>p.n>0)?'Figura en casa':'Marcado como agotado':'Sin registrar en casa'}${last?' · última compra '+esc(last.date.split('-').reverse().join('/')):''}</p>${current?`<p><b>${eur(current.price)}</b> hoy · ${esc(prodSize(current))}</p>`:''}<label for="houseTargetList">Añadir a</label><select class="field" id="houseTargetList">${opt(S.lists.map(l=>[l.id,l.name]),lid)}</select><div class="ck-actions"><button type="button" class="btn" data-house-add>🛒 Añadir</button><button type="button" class="btn sec" data-house-fav>☆ Habitual</button></div><button type="button" class="house-inline" data-house-rule>Reposición del producto</button>${inventory.length?'<button type="button" class="house-inline" data-house-inventory>Ver ficha de En casa</button>':''}${housePriceHTML(product)}<p class="hint" data-house-status role="status"></p>`,{autoFocus:false});shoppingCoachLayout(ov);
  const update=()=>{lid=val(ov,'houseTargetList');const add=ov.querySelector('[data-house-add]'),fav=ov.querySelector('[data-house-fav]');add.disabled=houseInList(product,lid);add.textContent=add.disabled?'✓ Ya está apuntado':'🛒 Añadir';fav.textContent=isFav(product.mid||'n:'+product.name,lid)?'★ Habitual':'☆ Habitual'};
  ov.querySelector('#houseTargetList').onchange=update;
  ov.querySelector('[data-house-add]').onclick=()=>{if(houseAdd(product,lid)){toast('Añadido a '+(S.lists.find(l=>l.id===lid)?.name||'la lista'));ov.querySelector('[data-house-status]').textContent='Producto añadido.'}update();onChange()};
  ov.querySelector('[data-house-fav]').onclick=()=>{toggleFav(product.mid||'n:'+product.name,lid);update();onChange()};
  ov.querySelector('[data-house-rule]').onclick=()=>replenishmentSheet({name:product.name,mid:product.mid||'',listId:lid},onChange);
  ov.querySelector('[data-house-inventory]')?.addEventListener('click',()=>{const p=S.pantry.find(p=>p.id===inventory[0].id);if(p)panSheet(p)});
  update();return ov;
}
function houseSearch(){
  const ov=sheet('Buscar en Casa',`<label for="houseSearchInput">Producto</label><input class="field" id="houseSearchInput" type="search" placeholder="Ej.: detergente" autocomplete="off" enterkeyhint="search"><p class="hint">Consulta lo que hay en casa, las listas y las compras anteriores.</p><div id="houseSearchResults" aria-live="polite"></div>`,{autoFocus:true});shoppingCoachLayout(ov);ov.querySelector('[data-s=cancel]').textContent='Cerrar';let results=[],timer;
  function draw(){if(!ov.isConnected)return;const query=val(ov,'houseSearchInput'),box=ov.querySelector('#houseSearchResults');if(query.length<2){box.innerHTML='<p class="hint">Escribe al menos dos letras.</p>';return}
    results=CasaInsights.search(S,query,{today:today(),lookup:houseLookup,products:MC?searchProducts(query,12):[],listId:cartList()});
    box.innerHTML=results.map((x,i)=>{const listNames=[...new Set(x.items.map(p=>(S.lists.find(l=>l.id===p.listId)?.name||'Lista')+(p.done?' · en el carro':'')))];const home=x.pantry.length?x.pantry.some(p=>p.n>0)?'En casa':'Agotado':'',last=x.purchases[0],labels=[home,...listNames,x.favorites.length?'★ Habitual':'',last?'Última compra '+last.date.split('-').reverse().join('/'):''].filter(Boolean);return `<button type="button" class="house-result" data-house-result="${i}">${shoppingSuggestionPhoto(x.mid?shoppingSuggestionInfo(x):x)}<span><strong>${esc(x.name)}</strong><small>${esc(labels.join(' · ')||'Catálogo de Mercadona')}</small></span><b aria-hidden="true">›</b></button>`}).join('')||'<p class="hint">No hay coincidencias. Prueba con otro nombre.</p>';
  }
  ov.querySelector('#houseSearchInput').oninput=()=>{clearTimeout(timer);timer=setTimeout(draw,120)};
  ov.querySelector('#houseSearchResults').onclick=e=>{const button=e.target.closest('[data-house-result]');if(button&&results[Number(button.dataset.houseResult)])houseProductSheet(results[Number(button.dataset.houseResult)],draw)};
  draw();if(!MC)Promise.resolve(loadMC()).then(draw);return ov;
}
function houseSpendingHTML(month){
  const data=CasaInsights.spending(S,month,{today:today(),lookup:houseLookup});return `<section class="house-spending"><h4>En qué se ha gastado · ${esc(monthName(month))}</h4><div class="house-spending-total">Total registrado <b>${eur(data.totalCents/100)}</b></div>${data.groups.filter(g=>g.cents||['Alimentación','Limpieza','Higiene'].includes(g.name)).map(g=>`<div class="house-spending-row"><span>${esc(g.name)}</span><b>${eur(g.cents/100)}</b></div>`).join('')}<p class="hint">Las líneas sin categoría y los ajustes se muestran aparte. Las compras pendientes de ticket conservan el importe registrado. El desglose siempre suma el total.</p></section>`;
}
function replenishmentSheet(product,onChange=()=>{}){
  const lid=product.listId||cartList(),key=CasaShoppingRecommendations.productKey(product),profile=lid===cartList()?shoppingModel().profiles.find(p=>p.key===key):null;
  product={...product,...(profile||{}),listId:lid};const current=houseLookup(product.mid),rule=CasaShoppingRecommendations.rule(S,product,{listId:lid,superId:cartList()}),initial=rule.mode,automatic=profile?.automaticInterval||0;
  const ov=sheet('Reposición del producto',`${current?productSheetPhoto(current.img,product.name):''}${product.name?`<p><b>${esc(product.name)}</b></p>`:'<label for="ruleProductName">Producto</label><input class="field" id="ruleProductName" placeholder="Ej.: Café">'}<p class="hint">Una sola regla para Habituales y las recomendaciones de «${esc(S.lists.find(l=>l.id===lid)?.name||'Súper')}».</p><fieldset class="house-rule-options"><legend>Cómo quieres reponerlo</legend>${[['auto','Aprender de mis compras',automatic?'Frecuencia observada: unos '+automatic+' días.':'Se aprenderá con los tickets guardados.'],['manual','Cada ciertos días','Tú eliges el plazo.'],['off','No recomendar','Sin sugerencias ni reposición automática.']].map(([mode,label,detail])=>`<label><input type="radio" name="replenishmentMode" value="${mode}" ${initial===mode?'checked':''}><span><b>${label}</b><small>${detail}</small></span></label>`).join('')}</fieldset><div data-rule-manual ${initial==='manual'?'':'hidden'}><label for="suggestionDays">Volver a comprar cada (días)</label><input class="field" type="number" inputmode="numeric" min="1" max="365" step="1" id="suggestionDays" value="${rule.days||automatic||7}"><label for="ruleLastPurchase">Última compra o fecha de referencia</label><input class="field" type="date" id="ruleLastPurchase" max="${today()}" value="${rule.last||today()}"><label class="toggle-line"><input type="checkbox" id="ruleAutoAdd" ${(initial==='manual'?rule.autoAdd:initial==='off'?rule.preference.autoAdd!==false:true)?'checked':''}> Añadir a la lista al cumplirse el plazo, al abrir CASA</label></div><p class="hint" id="suggestionPreferenceStatus" role="status"></p><button type="button" class="shopping-learning-link" data-suggestion-mute>${initial==='off'?'Volver a recomendar este producto':'No recomendar este producto'}</button>`,{autoFocus:false,saveLabel:'Guardar preferencia',onSave:()=>commit(ov.querySelector('[name=replenishmentMode]:checked').value)});shoppingCoachLayout(ov);
  function commit(mode){
    const name=product.name||val(ov,'ruleProductName'),days=Number(val(ov,'suggestionDays')),last=val(ov,'ruleLastPurchase'),status=ov.querySelector('#suggestionPreferenceStatus');
    if(!name){status.textContent='Escribe el nombre del producto.';return false}
    if(mode==='manual'&&(!Number.isInteger(days)||days<1||days>365||!CasaReceipts.validDate(last)||last>today())){status.textContent='Indica entre 1 y 365 días y una fecha de referencia válida, hasta hoy.';return false}
    const target={...product,name},latest=CasaShoppingRecommendations.rule(S,target,{listId:lid,superId:cartList()}),autoAdd=mode==='manual'&&ov.querySelector('#ruleAutoAdd').checked;
    S.staples=S.staples||[];for(const staple of latest.staples){staple.auto=false;staple.ruleMode=mode}
    if(mode==='manual'){
      const data={name,mid:String(product.mid||''),listId:lid,days,last,auto:autoAdd,exactDue:true,ruleMode:'manual',section:current?ckSection(current,name):latest.staple?.section||'Despensa',basePrice:current?.price||latest.staple?.basePrice||0,packQty:current?prodSize(current):latest.staple?.packQty||''};
      if(latest.staple)Object.assign(latest.staple,data);else S.staples.push({id:uid(),...data});
    }
    ckSet(latest.key,{...latest.preference,mode,days:mode==='manual'?days:mode==='off'?latest.days||latest.preference.days||null:null,autoAdd:mode==='off'?latest.autoAdd:autoAdd,muted:mode==='off',last:mode==='manual'?last:latest.last,until:'',answer:'configure',resumeMode:mode==='off'?(initial==='off'?latest.preference.resumeMode||'auto':initial):mode,updatedAt:Date.now()});
    autoStaples();onChange();toast(mode==='manual'?'Reposición: cada '+days+' días.':mode==='off'?'No se recomendará ni se añadirá automáticamente.':'Aprenderá de las compras guardadas.');return true;
  }
  ov.querySelectorAll('[name=replenishmentMode]').forEach(input=>input.onchange=()=>{ov.querySelector('[data-rule-manual]').hidden=input.value!=='manual';ov.querySelector('#suggestionPreferenceStatus').textContent=''});
  ov.querySelector('[data-suggestion-mute]').onclick=()=>{if(commit(initial==='off'?rule.preference.resumeMode||'auto':'off'))ov.remove()};
  return ov;
}
