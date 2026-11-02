const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('casa/cocina.js','utf8');
function run(overrides={}){
 const S={buys:['2026-10-01','2026-10-11','2026-10-21'].map(date=>({date,items:[{name:'Café'}]})),items:[],pantry:[],cook:{},...overrides};
 const ctx={S,today:()=> '2026-11-02',norm:s=>s.toLowerCase(),diff:(a,b)=>Math.round((new Date(b)-new Date(a))/86400000),ck:()=>S.cook,buyItems:b=>b.items,pantryLow:i=>i.n<=0};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function shoppingSuggestions(){'),source.indexOf('function shoppingReminderCard(){')),ctx);
 return ctx.shoppingSuggestions();
}
test('aprende frecuencia y explica el tiempo transcurrido',()=>{const [s]=run();assert.equal(s.interval,10);assert.equal(s.elapsed,12)});
test('excluye lista, carro y existencias',()=>{for(const done of [true,false])assert.equal(run({items:[{name:'Café',done}]}).length,0);assert.equal(run({pantry:[{name:'Café',n:1}]}).length,0)});
test('respeta respuestas y vuelve a sugerir tras vencer',()=>{assert.equal(run({cook:{shoppingFeedback:{'café':{until:'2026-11-02'}}}}).length,0);assert.equal(run({cook:{shoppingFeedback:{'café':{until:'2026-11-01'}}}}).length,1)});
test('ignora compras anuladas y exige tres fechas',()=>{assert.equal(run({buys:[{date:'2026-10-01',items:[{name:'Café'}]},{date:'2026-10-11',items:[{name:'Café'}]},{date:'2026-10-21',voided:true,items:[{name:'Café'}]}]}).length,0)});
