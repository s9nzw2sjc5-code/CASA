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
