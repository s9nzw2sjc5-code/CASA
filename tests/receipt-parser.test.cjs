const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),R=require('../casa/receipts.js');
const source=fs.readFileSync('casa/cocina.js','utf8');
function parser(){const c={norm:s=>String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''),ck:()=>({stores:['Mercadona','Lidl']}),today:()=> '2026-11-09'};vm.createContext(c);vm.runInContext(source.slice(source.indexOf('const tNum='),source.indexOf('// Producto de Mercadona de una línea')),c);return c}
test('number-heading filter does not discard products beginning with NO or ÑO',()=>{
 const c=parser(),t=c.parseTicket('MERCADONA\n09/11/2026\nNOQUIS VERDURA 2,00\nNORI 1,00\nNOODLES 1,50\nTOTAL 4,50');
 assert.equal(t.lines.length,3);assert.equal(R.validate(t).sumCents,450);assert.equal(t.lines[0].name,'NOQUIS VERDURA');assert.equal(t.lines[0].quantityObserved,false);
 for(const header of ['No: 1234','Nº 1234','N°1234'])assert.equal(c.parseTicket(header+'\n1 ARROZ 2,00\nTOTAL 2,00').lines.length,1);
});
test('a numeric product name remains part of the name after a separate purchase quantity',()=>{
 const t=parser().parseTicket('MERCADONA\n09/11/2026\n1 6 HUEVOS COCIDOS 2,00\n2 BOLSAS 0,10 0,20\nTOTAL 2,20');
 assert(R.validate(t).ok);assert.equal(t.lines[0].units,1);assert.equal(t.lines[0].name,'6 HUEVOS COCIDOS');assert.equal(t.lines[1].units,2);assert.equal(t.lines[1].price,.2);
});
test('inventory quantities keep liquid units and do not interpret a fractional abbreviation as litres',()=>{
 const c=parser();c.MC=null;c.S={pantry:[]};c.receiptNameMatches=()=>false;
 vm.runInContext(source.slice(source.indexOf('const CK_UNITS='),source.indexOf('const unitW=')),c);
 vm.runInContext(source.slice(source.indexOf('function ticketLinePlan('),source.indexOf('function prepareTicket(')),c);
 const line=name=>({name,units:2,unit:1,price:2});
 const water=c.ticketLinePlan(line('AGUA 8L'),'Prueba');assert.equal(water.amount,16000);assert.equal(water.unit,'ml');
 const weight=c.ticketLinePlan(line('ARROZ 500 g'),'Prueba');assert.equal(weight.amount,1000);assert.equal(weight.unit,'g');
 const abbreviation=c.ticketLinePlan(line('FIAMBRE 1/2 L.'),'Prueba');assert.equal(abbreviation.amount,2);assert.equal(abbreviation.unit,'ud');
});
