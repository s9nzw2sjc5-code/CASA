const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),R=require('../casa/receipts.js');
const source=fs.readFileSync('casa/cocina.js','utf8');
function context(buys){const c={S:{buys},CasaReceipts:R,norm:R.norm};vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function pantryLastPurchase('),source.indexOf('const CK_SRC=')),c);return c}
test('last purchase uses the newest actual matching purchase, never a stock edit or voided receipt',()=>{
 const buys=[{id:'older',date:'2026-10-01',items:[{mid:'rice',name:'Old label'}]},{id:'latest',date:'2026-11-01',items:[{mid:'rice',name:'Another label'}]},{id:'bad-date',date:'2026-99-99',items:[{mid:'rice'}]},{id:'void',date:'2026-11-02',voided:true,items:[{mid:'rice'}]}],before=JSON.stringify(buys),c=context(buys);
 assert.equal(c.pantryLastPurchase({id:'stock',mid:'rice',name:'Arroz',at:'2026-11-08'}).id,'latest');assert.equal(JSON.stringify(buys),before);
});
test('identity and confirmed inventory links preserve variants and renamed products',()=>{
 const c=context([{id:'same-name',date:'2026-11-01',items:[{mid:'whole',name:'Leche'}]},{id:'stock-link',date:'2026-10-01',items:[{inventoryId:'stock',name:'Abbreviation'}]},{id:'credit',date:'2026-10-02',items:[],pendingInventory:[{pantryId:'stock'}]}]);
 assert.equal(c.pantryLastPurchase({id:'stock',mid:'semi',name:'Leche'}).id,'credit');assert.equal(c.pantryLastPurchase({id:'other',mid:'semi',name:'Leche'}),null);assert.equal(c.pantryLastPurchase({id:'stock',name:'A new name'}).id,'credit');
});
test('legacy names match accents and case; a missing purchase stays unknown',()=>{
 const c=context([{id:'legacy',date:'2026-10-10',items:[{name:'CAFE'}]}]);assert.equal(c.pantryLastPurchase({id:'coffee',name:'Café'}).id,'legacy');assert.equal(c.pantryLastPurchase({id:'rice',name:'Arroz',at:'2026-11-08'}),null);
});
