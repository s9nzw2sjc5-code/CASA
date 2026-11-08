const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('casa/cocina.js','utf8'),catalog=JSON.parse(fs.readFileSync('casa/mercadona.json','utf8'));
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
test('pasta de dientes encuentra dentífricos del catálogo de higiene',()=>{
 const c={MC:{...catalog,w:catalog.p.map(p=>norm(p[1]).split(/\s+/))},norm,qWords:q=>q.split(/\s+/),ck:()=>({}),favKeys:()=>[],cartList:()=> 'super',wordHit:(q,w)=>q===w?4:0,prod:p=>({name:p[1],cat:catalog.cats[p[8]]})};vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function searchProducts('),source.indexOf('// «¿Querías decir')),c);
 for(const q of ['pasta de dientes','pasta dental','dentífrico']){const result=c.searchProducts(q,5);assert.ok(result.length>0);assert.ok(result.every(p=>/Dentífrico/.test(p.name)&&/Cuidado/.test(p.cat)))}
});
