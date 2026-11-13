const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../casa/receipts.js');
const receipt=()=>({date:'2026-10-31',store:'Tienda de prueba',total:5,lines:[{name:'Arroz',units:2,unit:2,price:4,plan:{inventory:'new',amount:2000,unit:'g',mid:'rice',packSize:1000,loc:'Despensa'}},{name:'Bolsa plastico',units:1,unit:1,price:1,plan:{inventory:'',unit:'ud',amount:1}}]});
const state=()=>({rev:1,buys:[],pantry:[{id:'pantry',mid:'rice',name:'Arroz',n:500,u:'g',min:100,custom:'keep'}],items:[{id:'shopping',mid:'rice',name:'Arroz'},{id:'other',name:'Jabón'}],prices:{},staples:[],cook:{stores:['Tienda de prueba'],budgetM:100},tasks:[{id:'task',title:'Keep'}],unknown:{keep:true}});

test('validates cents, quantities, dates and missing data without inventing totals',()=>{
 assert(R.validate(receipt()).ok);
 const t=receipt();t.total=5.01;assert(!R.validate(t).ok);
 t.total=5;t.lines[0].units=3;assert(!R.validate(t).ok);
 for(const date of ['','2026-13-01','2026-02-30'])assert(!R.validate({...receipt(),date}).ok);
 assert(!R.validate({...receipt(),store:''}).ok);
 assert(R.validate({store:'Test',date:'2026-01-01',total:.3,lines:[{name:'A',units:1,unit:.1,price:.1},{name:'B',units:1,unit:.2,price:.2}]}).ok);
});
test('fingerprint is stable across image changes, case and line order',async()=>{
 const a=receipt(),b=receipt();b.imageHash='different-photo';b.store='TIENDA DE PRUEBA';b.lines.reverse();b.lines[0].name='BOLSA PLÁSTICO';
 assert.equal((await R.identify(a)).id,(await R.identify(b)).id);
});
test('patch only touches receipt fields, appends spend and stock once, preserves unrelated state',async()=>{
 const s=state(),before=structuredClone(s),t=receipt(),id=await R.identify(t),op=R.patch(s,t,id);
 assert.deepEqual(s,before);assert(!('tasks' in op.patch));assert(!('unknown' in op.patch));
 const updated={...s,...op.patch};assert.equal(updated.pantry.length,1);assert.equal(updated.pantry[0].n,2500);assert.equal(updated.pantry[0].custom,'keep');assert.equal(updated.buys.length,1);assert.equal(updated.buys[0].total,5);assert.equal(updated.items.length,1);assert.equal(updated.items[0].id,'other');assert.equal(updated.cook.budgetM,100);
 assert.deepEqual(R.patch(updated,t,id).patch,{});
});
test('two clients importing the same ticket do not add stock or spend twice',async()=>{
 let server=state(),writes=0,queue=Promise.resolve();const t=receipt(),id=await R.identify(t);
 const transact=()=>{const result=queue.then(()=>{const op=R.patch(server,t,id);if(Object.keys(op.patch).length){server={...server,...op.patch};writes++}return op.result});queue=result;return result};
 const results=await Promise.all([transact(),transact()]);assert.equal(writes,1);assert.equal(results.filter(r=>r.duplicate).length,1);assert.equal(server.buys.length,1);assert.equal(server.pantry[0].n,2500);
});
test('retry after a committed transaction with a lost response is a no-op',async()=>{
 const t={...receipt(),imageHash:'bytes-sha256'},id=await R.identify(t);let server={...state(),...R.patch(state(),t,id).patch};
 const altered={...t,lines:[...t.lines].reverse()};assert.deepEqual(R.patch(server,altered,await R.identify(altered)).patch,{});
});
test('a legacy receipt is recognized by its date, store, total and actual lines',async()=>{
 const s=state(),t=receipt();s.buys=[{id:'legacy',date:t.date,store:t.store,total:t.total,ticket:true,items:t.lines.map(({plan,...l})=>l)}];
 const op=R.patch(s,t,await R.identify(t));assert.equal(op.result.id,'legacy');assert(op.result.duplicate);assert.deepEqual(op.patch,{});
});
test('a previous expense requires review and can be enriched without recounting stock or spend',async()=>{
 const s=state(),t=receipt(),id=await R.identify(t);s.buys=[{id:'manual',date:t.date,store:t.store,total:5,manual:true,note:'Keep note'}];
 assert.throws(()=>R.patch(s,t,id),e=>e.code==='receipt_review');
 const op=R.patch(s,t,id,{matchId:'manual'}),updated={...s,...op.patch};
 assert.equal(updated.buys.length,1);assert.equal(updated.buys[0].id,'manual');assert.equal(updated.buys[0].note,'Keep note');assert.equal(updated.buys[0].total,5);assert.equal(updated.pantry[0].n,500);assert.equal(updated.items.length,2);
 assert.deepEqual(R.patch(updated,t,id).patch,{});
});
test('different purchases with same date and total require confirmation rather than silent merging',async()=>{
 const s=state(),a=receipt(),id=await R.identify(a);Object.assign(s,R.patch(s,a,id).patch);
 const b=receipt();b.lines[0].name='Pasta';b.lines[0].plan.mid='pasta';const idb=await R.identify(b);
 assert.throws(()=>R.patch(s,b,idb),e=>e.code==='receipt_review');
 assert.equal(R.patch(s,b,idb,{confirmNew:true}).patch.buys.length,2);
});
test('bad totals or a deleted inventory target fail without mutating state',async()=>{
 const s=state(),t=receipt(),before=structuredClone(s);t.total=6;assert.throws(()=>R.patch(s,t,{}));assert.deepEqual(s,before);
 t.total=5;t.lines[0].plan.inventory='deleted';assert.throws(()=>R.patch(s,t,{}));assert.deepEqual(s,before);
});
test('discounts contribute to total, not inventory, and all lines survive',async()=>{
 const t=receipt();t.lines.push({name:'Descuento',units:1,unit:-1,price:-1,plan:{inventory:'',amount:1,unit:'ud'}});t.total=4;
 assert(R.validate(t).ok);const op=R.patch(state(),t,await R.identify(t));assert.equal(op.patch.buys[0].items.length,3);assert.equal(op.patch.buys[0].total,4);assert.equal(op.patch.pantry[0].n,2500);
});
test('old inventory dimensions are validated and missing conversions never corrupt stock',async()=>{
 const s=state(),t=receipt();s.pantry[0].u='ud';t.lines[0].plan.inventory='pantry';t.lines[0].plan.weight=500;
 const op=R.patch(s,t,await R.identify(t));assert.equal(op.patch.pantry[0].n,504);
});
test('an unexpected remote schema is rejected without creating fields',async()=>{
 const remote={unrelated:'keep'},before=structuredClone(remote),t=receipt();
 assert.throws(()=>R.patch(remote,t,{}));assert.deepEqual(remote,before);
});
test('a new purchase from review has a numeric timestamp, not String.prototype.at',async()=>{
 const t=receipt(),id=await R.identify(t);
 for(const confirmNew of [false,true]){
  const op=R.patch(state(),t,id,{matchId:'',confirmNew,at:123456});
  assert.equal(op.patch.buys[0].at,123456);
  assert.equal(typeof op.patch.buys[0].at,'number');
  assert.doesNotThrow(()=>structuredClone(op.patch));
 }
});
test('price history is stored as maps rather than Firestore-incompatible nested arrays',async()=>{
 const s=state(),t=receipt();s.prices.arroz={hist:[['2026-10-01','Old store',1,1000,'m']],custom:'keep'};
 const op=R.patch(s,t,await R.identify(t));
 assert.deepEqual(op.patch.prices.arroz.hist[0],{date:'2026-10-01',store:'Old store',price:1,n:1000,d:'m'});
 assert.equal(op.patch.prices.arroz.hist[1].price,2);
 assert.equal(op.patch.prices.arroz.custom,'keep');assert.doesNotThrow(()=>R.assertData(op.patch));
});
test('write boundary rejects functions and nested arrays with a field path',()=>{
 assert.throws(()=>R.assertData({buys:[{at:()=>0}]}),/buys\[0\]\.at/);
 assert.throws(()=>R.assertData({prices:{item:{hist:[['date',2]]}}}),/prices\.item\.hist/);
 assert.doesNotThrow(()=>R.assertData({prices:{item:{hist:[{date:'2026-01-01',price:2}]}}}));
});
test('legacy local price history is normalized without losing previous entries',()=>{
 const s=state();s.prices.arroz={hist:[['2026-10-01','Store',2,1000,'m'],{date:'2026-10-02',price:3}],n:1000};
 R.normalizeHistory(s);assert.equal(s.prices.arroz.hist.length,2);assert.equal(s.prices.arroz.hist[0].store,'Store');assert.equal(s.prices.arroz.hist[1].price,3);assert.equal(s.prices.arroz.n,1000);
});
test('confirmed shopping match removes the chosen item and preserves unrelated products',async()=>{
 const s=state(),t=receipt();s.items=[{id:'generic',name:'Arroz'},{id:'keep',name:'Arroz integral'}];
 t.lines[0].plan.shoppingIds=['generic'];t.lines[0].plan.shoppingNames={generic:'Arroz'};
 const op=R.patch(s,t,await R.identify(t));assert.equal(op.result.removed,1);assert.equal(op.patch.items[0].id,'keep');assert.equal(op.patch.pantry[0].n,2500);
 s.items[0].name='Otro producto';assert.throws(()=>R.patch(s,t,{},{}),/cambió/);
});
test('choosing no shopping match leaves the shopping list untouched',async()=>{
 const s=state(),t=receipt();t.lines[0].plan.shoppingIds=[];t.lines[1].plan.shoppingIds=[];
 const op=R.patch(s,t,await R.identify(t));assert.equal(op.result.removed,0);assert(!('items' in op.patch));
});
test('a similar photo can be linked to an existing ticket instead of importing twice',async()=>{
 const t=receipt(),s=state();s.buys=[{id:'existing-receipt',ticket:true,date:t.date,store:t.store,total:t.total,items:[{name:'Different OCR wording',units:1,price:5}]}];
 const op=R.patch(s,t,await R.identify(t),{matchId:'existing-receipt'});assert(op.result.duplicate);assert.deepEqual(op.patch,{});
});
test('unread image quantities require confirmation even when the total matches',()=>{
 const t=receipt();t.ocrEngine='rapidocr-ppocrv4-web';t.lines[0].quantityObserved=false;
 const check=R.validate(t);assert(!check.ok);assert(check.reasons.some(r=>r.includes('cantidades')));
});
test('partial purchase retains the remaining units and recalculates estimated price',async()=>{
 const s=state(),t=receipt();s.items[0].units=3;s.items[0].price=6;s.items[0].qty='3 paquetes';t.lines[0].plan.shoppingIds=['shopping'];t.lines[0].plan.shoppingAmount=1;
 const op=R.patch(s,t,await R.identify(t));assert.equal(op.patch.items[0].units,2);assert.equal(op.patch.items[0].price,4);assert(op.patch.items.some(x=>x.id==='other'));
});
test('repeated lines for the same shopping item are counted together',async()=>{
 const s=state(),t=receipt();s.items[0].units=5;t.lines[0].units=1;t.lines[0].unit=4;t.lines[0].plan.shoppingIds=['shopping'];const second=structuredClone(t.lines[0]);t.lines.push(second);t.total=9;
 const op=R.patch(s,t,await R.identify(t));assert.equal(op.patch.items[0].units,3);
});
test('undo restores touched state, removes spend, preserves unrelated changes and is idempotent',async()=>{
 const s=state(),t=receipt();t.lines[0].originalName='ARROZ ABREV';const op=R.patch(s,t,await R.identify(t)),current={...s,...op.patch};current.tasks.push({id:'new',title:'Keep too'});
 const undone=R.undo(current,op.result.id),after={...current,...undone.patch};assert(after.buys[0].voided);assert.equal(after.buys[0].total,0);assert.deepEqual(after.pantry,s.pantry);assert.deepEqual(after.items,s.items);assert.deepEqual(after.prices,s.prices);assert.equal(after.tasks.length,2);assert.deepEqual(R.undo(after,op.result.id).patch,{});
 const reimport=R.patch(after,t,await R.identify(t));assert.equal(reimport.patch.buys.length,1);assert(!reimport.result.duplicate);
});
test('undo refuses subsequent edits atomically and refuses legacy tickets without a journal',async()=>{
 const s=state(),t=receipt(),op=R.patch(s,t,await R.identify(t)),current={...s,...op.patch};current.pantry[0].n--;const before=structuredClone(current);assert.throws(()=>R.undo(current,op.result.id),/cambiado/);assert.deepEqual(current,before);
 s.buys=[{id:'old',ticket:true}];assert.throws(()=>R.undo(s,'old'),/antiguo/);
});
test('confirmed corrections are learned by store and undo restores the previous aliases',async()=>{
 const s=state(),t=receipt();t.lines[0].originalName='ABREV';const op=R.patch(s,t,await R.identify(t));assert.equal(op.patch.cook.receiptAliases['tienda de prueba|abrev'].name,'Arroz');
 const undone=R.undo({...s,...op.patch},op.result.id);assert.deepEqual(undone.patch.cook,s.cook);
});
test('pending receipt replaces provisional spending and adds only additional stock',async()=>{
 const s=state(),t=receipt();s.pantry[0].n=2500;s.buys=[{id:'pending',store:t.store,date:t.date,total:3,receiptPending:true,items:[{name:'Arroz',mid:'rice',units:2}],pendingInventory:[{id:'credit',name:'Arroz',mid:'rice',pantryId:'pantry',amount:2000,unit:'g'}]}];t.pendingBuyId='pending';t.lines[0].plan.inventory='pantry';t.lines[0].plan.creditedId='credit';t.lines.push({name:'Producto extra',units:1,unit:2,price:2,plan:{inventory:'new',amount:1,unit:'ud'}});t.total=7;
 const op=R.patch(s,t,await R.identify(t));assert.equal(op.patch.buys.length,1);assert.equal(op.patch.buys[0].id,'pending');assert.equal(op.patch.buys[0].total,7);assert.equal(op.patch.buys[0].receiptPending,false);assert.equal(op.patch.pantry.find(p=>p.id==='pantry').n,2500);assert(op.patch.pantry.some(p=>p.name==='Producto extra'));assert(R.patch({...s,...op.patch},t,await R.identify(t)).result.duplicate);
 const undo=R.undo({...s,...op.patch},'pending');assert(undo.patch.buys[0].receiptPending);assert.equal(undo.patch.buys[0].total,3);
});
test('pending receipt started before stock entry adds all stock on confirmation',async()=>{
 const s=state(),t=receipt();s.buys=[{id:'pending',date:t.date,store:t.store,total:0,receiptPending:true,pendingInventory:[],items:[]}];t.pendingBuyId='pending';const op=R.patch(s,t,await R.identify(t));assert.equal(op.patch.pantry[0].n,2500);assert.equal(op.patch.buys.length,1);
});
test('pending receipt adjusts an overstated cart quantity without negative stock',async()=>{
 const s=state(),t=receipt();s.pantry[0].n=2500;s.buys=[{id:'pending',receiptPending:true,pendingInventory:[{id:'credit',pantryId:'pantry',amount:3000,unit:'g'}]}];t.pendingBuyId='pending';t.lines[0].plan.creditedId='credit';t.lines[0].plan.inventory='pantry';const op=R.patch(s,t,await R.identify(t));assert.equal(op.patch.pantry[0].n,1500);
 s.pantry[0].n=100;assert.throws(()=>R.patch(s,t,{}),/consumidas/);
});
test('a missing quantity identifies its line without omitting its already-read price',()=>{
 const t={store:'Prueba',date:'2026-11-06',total:78.17,lines:[{name:'Producto completo',units:1,unit:74.62,price:74.62},{name:'Cantidad pendiente',units:NaN,unit:NaN,price:3.55}]};
 const check=R.validate(t);assert.equal(check.sumCents,7817);assert(!check.ok);assert(!check.reasons.some(r=>r.includes('suma')));assert(check.issues.some(i=>i.index===1&&i.field==='units'));assert(!check.issues.some(i=>i.index===0));
 t.lines[1].units=1;assert(R.validate(t).ok);
});
test('field diagnostics distinguish missing prices, names and quantities',()=>{
 const t={store:'Prueba',date:'2026-11-06',total:5,lines:[{name:'Sin precio',units:1,price:NaN},{name:'',units:1,unit:5,price:5}]};
 const check=R.validate(t);assert(check.issues.some(i=>i.index===0&&i.field==='price'));assert(check.issues.some(i=>i.index===1&&i.field==='name'));assert.equal(check.sumCents,500);
});
test('balanced totals alone do not bypass confirmation of a doubtful article',async()=>{
 const s=state(),t=receipt();t.lines[0].reviewRequired=true;
 assert(!R.validate(t).ok);assert(R.validate(t).issues.some(i=>i.index===0&&i.field==='confirmation'));
 assert.throws(()=>R.patch(s,t,{}),/confirmar/);t.lines[0].lineValidated=true;assert(R.validate(t).ok);
 const op=R.patch(s,t,await R.identify(t));assert.equal(op.patch.buys[0].items[0].validated,true);
});

test('new confirmed product formats and categories are saved as data without changing the ticket fingerprint or its total',async()=>{
 const t=receipt(),original=await R.identify(t);Object.assign(t.lines[0].plan,{packUnit:'g',packLabel:'1 kg',category:'Arroz, legumbres y pasta'});const id=await R.identify(t);assert.equal(id.id,original.id);const operation=R.patch(state(),t,id),record=operation.patch.buys[0];assert.equal(record.total,5);assert.equal(record.items[0].packSize,1000);assert.equal(record.items[0].packUnit,'g');assert.equal(record.items[0].category,'Arroz, legumbres y pasta');assert.equal(record.items[0].packLabel,'1 kg');R.assertData(operation.patch);
});
