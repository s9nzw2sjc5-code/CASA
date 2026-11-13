/* Reposición orientativa a partir del historial guardado. No modifica la casa. */
(function(root){
  'use strict';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const nameKey=s=>norm(String(s||'').replace(/(\d)([a-záéíóúñ])/gi,'$1 $2').replace(/([a-záéíóúñ])(\d)/gi,'$1 $2'));
  const prefix='shoppingSuggestion:';
  const prefKey=key=>prefix+key;
  const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
  const days=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
  const median=a=>{const s=a.slice().sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length?s.length%2?s[m]:(s[m-1]+s[m])/2:0};
  const ref=i=>typeof i?.mid==='string'||typeof i?.mid==='number'?String(i.mid):'';
  const ignored=name=>/^(?:bolsas?(?: de)? (?:plastico|papel|compra)|descuento|cupon|dto|ajuste|devolucion|total|subtotal)(?:\b|$)/.test(norm(name));
  const productKey=p=>ref(p)?'mid:'+ref(p):'name:'+nameKey(p.name);
  const ruleStorageKey=(p,listId='super',superId='super')=>prefKey((listId===superId?'':listId+'|')+productKey(p));
  function rule(state,product,options={}){
    const listId=options.listId||'super',superId=options.superId||'super',key=ruleStorageKey(product,listId,superId),cook=state.cook||{};
    const preference=options.preference||cook[key]||cook[prefKey((listId===superId?'':listId+'|')+'name:'+nameKey(product.name))]||{};
    const staples=(state.staples||[]).filter(s=>(s.listId||superId)===listId&&(ref(s)&&ref(product)?ref(s)===ref(product):nameKey(s.name)===nameKey(product.name))),staple=staples[0];
    const mode=['auto','manual','off'].includes(preference.mode)?preference.mode:preference.muted?'off':staple&&staple.ruleMode!=='auto'&&staple.ruleMode!=='off'&&Number(staple.days)>0?'manual':Number(preference.days)>0?'manual':'auto';
    const interval=mode==='manual'||mode==='off'?Number(preference.mode?preference.days:staple?.days||preference.days)||0:0;
    const last=mode==='auto'&&validDate(product.last)?product.last:[product.last,staple?.last,preference.last].filter(validDate).sort().at(-1)||'';
    const paused=validDate(options.today)&&validDate(preference.until)&&preference.until>=options.today&&(!preference.basedOn||preference.basedOn>=last);
    return {key,mode,paused,days:interval,autoAdd:mode==='manual'&&(preference.autoAdd!==undefined?!!preference.autoAdd:!!staple?.auto),last,staple,staples,preference};
  }
  function build(state,options={}){
    const now=options.today,superId=options.listId||'super',cook=state.cook||{},aliases=cook.receiptAliases||{},pantry=state.pantry||[],byInventory=new Map(pantry.map(p=>[p.id,p])),knownNames=new Map();
    if(!validDate(now))return {profiles:[],suggestions:[],upcoming:[],stats:{purchases:0,tickets:0,products:0}};
    const legacyFeedback=new Map(Object.entries(cook.shoppingFeedback||{}).map(([key,value])=>[nameKey(key),value]));
    const canonical=(line,store)=>aliases[norm(store)+'|'+norm(line.name)]?.name||line.name;
    const register=(name,id)=>{if(!nameKey(name)||!id)return;const key=nameKey(name);if(!knownNames.has(key))knownNames.set(key,new Set());knownNames.get(key).add(id)};
    for(const p of [...pantry,...(state.items||[]),...(state.staples||[])])register(p.name,ref(p));
    const seen=new Set(),buys=[];
    const ordered=(state.buys||[]).filter(b=>!b.voided&&!b.receiptPending&&validDate(b.date)&&b.date<=now&&days(b.date,now)<=365&&(!b.listId||b.listId===superId)).slice().sort((a,b)=>(Number(b.receiptCheckedAt||b.at)||0)-(Number(a.receiptCheckedAt||a.at)||0));
    for(const b of ordered){
      const items=(b.items||[]).map(i=>typeof i==='string'?{name:i}:i).filter(i=>i&&typeof i.name==='string'&&norm(i.name)&&(/[a-z]/.test(norm(canonical(i,b.store)))||ref(i)||ref(byInventory.get(i.inventoryId)))&&!ignored(i.name)&&(!i.listId||i.listId===superId)&&!(i.price!==undefined&&(!Number.isFinite(Number(i.price))||Number(i.price)<=0))&&!(i.units!==undefined&&(!Number.isFinite(Number(i.units))||Number(i.units)<=0)));
      if(!items.length)continue;
      const content=JSON.stringify([b.date,norm(b.store),Number(b.total)||0,items.map(i=>[nameKey(canonical(i,b.store)),ref(i),Number(i.units)||1,Number(i.kg)||0,Number(i.price)||0]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
      const keys=[b.id?'id:'+b.id:'',b.imageHash?'image:'+b.imageHash:'',b.receiptKey&&b.lineFingerprint?'receipt:'+b.receiptKey+'|'+b.lineFingerprint:'','content:'+content].filter(Boolean);
      if(keys.some(key=>seen.has(key)))continue;keys.forEach(key=>seen.add(key));buys.push({...b,items});
      for(const i of items){const id=ref(i)||ref(byInventory.get(i.inventoryId));register(i.name,id);register(canonical(i,b.store),id)}
    }
    function identity(line,store=''){
      const name=canonical(line,store),id=ref(line)||ref(byInventory.get(line.inventoryId)),known=knownNames.get(nameKey(name));
      return {key:id?'mid:'+id:known?.size===1?'mid:'+[...known][0]:'name:'+nameKey(name),mid:id||(known?.size===1?[...known][0]:''),name};
    }
    const groups=new Map();
    for(const b of buys)for(const i of b.items){
      const item=identity(i,b.store);if(!item.name)continue;
      if(!groups.has(item.key))groups.set(item.key,{...item,names:new Set(),dates:new Map(),last:'',lastUnitPrice:0,store:b.store||''});
      const g=groups.get(item.key);g.names.add(i.name);g.names.add(item.name);
      const units=Number(i.units),weighted=Number(i.kg)>0||/\bkg\b/i.test(i.qty||''),consistent=i.unitPrice===undefined||Math.abs(Number(i.unitPrice)*units-Number(i.price))<=.011;
      const quantity=!weighted&&Number.isInteger(units)&&units>0&&units<=12&&consistent?units:null;
      const date=g.dates.get(b.date)||{units:0,known:true};date.known=date.known&&quantity!==null;date.units+=quantity||0;g.dates.set(b.date,date);
      if(b.date>g.last||(b.date===g.last&&(Number(b.receiptCheckedAt||b.at)||0)>(g.lastStamp||0))){g.last=b.date;g.lastStamp=Number(b.receiptCheckedAt||b.at)||0;g.name=item.name;g.store=b.store||'';const amount=Number(i.price);g.lastUnitPrice=!weighted&&quantity&&amount>0?Math.round(amount/quantity*100)/100:0;g.weighted=weighted}
    }
    for(const staple of state.staples||[]){if((staple.listId||superId)!==superId)continue;const x=identity(staple);if(!groups.has(x.key))groups.set(x.key,{...x,names:new Set([staple.name]),dates:new Map(),last:'',lastUnitPrice:0,store:''})}
    const listed=new Set((state.items||[]).filter(i=>(i.listId||superId)===superId).map(i=>identity(i,i.store).key));
    const unresolvedListed=new Set((state.items||[]).filter(i=>(i.listId||superId)===superId&&!ref(i)&&!identity(i,i.store).mid).map(i=>nameKey(i.name)));
    const available=new Set(pantry.filter(p=>Number(p.n)>0).map(p=>identity(p).key));
    const profiles=[];
    for(const g of groups.values()){
      const dates=[...g.dates.keys()].sort(),gaps=dates.slice(1).map((d,i)=>days(dates[i],d)).filter(n=>n>0).slice(-5),count=dates.length,automatic=gaps.length?Math.max(count===2?7:1,Math.round(median(gaps))):0;
      const preferenceKeys=[prefKey(g.key),...[...g.names].filter(name=>{const known=knownNames.get(nameKey(name));return !g.mid||!known||known.size===1}).map(name=>prefKey('name:'+nameKey(name)))];
      const prefs=[...new Set(preferenceKeys)].map(key=>cook[key]).filter(p=>p&&typeof p==='object').sort((a,b)=>(Number(b.updatedAt)||0)-(Number(a.updatedAt)||0));
      const legacy=[...g.names].map(n=>legacyFeedback.get(nameKey(n))).find(Boolean),saved=prefs[0]||legacy||{},policy=rule(state,g,{listId:superId,superId,preference:saved}),preference={...saved,muted:policy.mode==='off'};
      const last=policy.last||g.last,elapsed=validDate(last)?days(last,now):0;
      const custom=(policy.mode==='manual'||policy.mode==='off')&&Number.isInteger(policy.days)&&policy.days>0&&policy.days<=365?policy.days:0,interval=custom||automatic;
      const snoozed=validDate(preference.until)&&preference.until>=now&&(!preference.basedOn||preference.basedOn>=last);
      const stale=!custom&&elapsed>Math.max(90,interval*4);
      let status=preference.muted?'muted':(listed.has(g.key)||[...g.names].some(n=>unresolvedListed.has(nameKey(n))))?'listed':snoozed?'snoozed':!interval?'learning':stale?'dormant':elapsed>=Math.max(1,interval-Math.min(2,Math.floor(interval*.15)))?'due':'upcoming';
      const recent=dates.slice(-5).map(d=>g.dates.get(d)).filter(d=>d.known&&d.units>0&&d.units<=12).map(d=>d.units),mode=recent.length>=3?recent.slice().sort((a,b)=>recent.filter(v=>v===b).length-recent.filter(v=>v===a).length||a-b)[0]:1;
      const suggestedUnits=recent.length>=3&&recent.filter(n=>n===mode).length/recent.length>=.75?mode:1;
      profiles.push({key:g.key,mid:g.mid,name:g.name,names:[...g.names],last,referenceOnly:last!==g.last,elapsed,interval,rule:policy,automaticInterval:automatic,custom:!!custom,count,preference,status,inInventory:available.has(g.key),suggestedUnits,lastUnitPrice:g.lastUnitPrice,store:g.store,weighted:g.weighted,daysUntil:Math.max(0,interval-elapsed),confidence:custom?'custom':count>=3&&median(gaps.map(n=>Math.abs(n-median(gaps))))<=Math.max(2,automatic*.5)?'pattern':'initial',score:interval?elapsed/interval:0});
    }
    profiles.sort((a,b)=>b.score-a.score||b.last.localeCompare(a.last)||a.key.localeCompare(b.key));
    return {profiles,suggestions:profiles.filter(p=>p.status==='due').slice(0,4),upcoming:profiles.filter(p=>p.status==='upcoming').sort((a,b)=>a.daysUntil-b.daysUntil),stats:{purchases:buys.length,tickets:buys.filter(b=>b.ticket).length,products:profiles.length}};
  }
  const api={build,norm,nameKey,prefKey,productKey,ruleStorageKey,rule};root.CasaShoppingRecommendations=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
