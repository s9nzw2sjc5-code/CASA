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
test('retains an article with an unread price instead of silently losing it from the receipt',()=>{
 const t=parser().parseTicket('MERCADONA\nA-12345678\nPZ CABECERA PRUEBA\n09/11/2026\nDescripción P.Unit Importe\n1 ARROZ 2,00\n1 PRODUCTO PENDIENTE\n1 LECHE 1,00\nTOTAL 5,20\nBASE IMPONIBLE\nTOTAL 4,73 0,47');
 assert.equal(t.lines.length,3);assert.equal(t.lines[1].name,'PRODUCTO PENDIENTE');assert(Number.isNaN(t.lines[1].price));assert.equal(t.lines[1].units,1);assert.equal(t.total,5.2);assert(R.validate(t).issues.some(i=>i.index===1&&i.field==='price'));
});
test('reads a wrapped name and weighted first article without treating headers as purchases',()=>{
 const c=parser(),weighted=c.parseTicket('MERCADONA\nCALLE PRUEBA\n09/11/2026\nPLATANOS\n0,500 kg 2,00 1,00\nTOTAL 1,00');
 assert.equal(weighted.lines.length,1);assert.equal(weighted.lines[0].kg,.5);assert.equal(weighted.lines[0].unitObserved,true);
 const wrapped=c.parseTicket('MERCADONA\n09/11/2026\nDescripción\n2 PASTA FRESCA\nRELLENA 4,00\nTOTAL 4,00');assert.equal(wrapped.lines.length,1);assert.equal(wrapped.lines[0].name,'PASTA FRESCA RELLENA');assert.equal(wrapped.lines[0].units,2);
});
test('normalizes spaced decimal separators and distinguishes observed from derived unit prices',()=>{
 const t=parser().parseTicket('MERCADONA\n09/11/2026\n2 LECHE 0 , 95 1, 90\n1 ARROZ 2,00\nTOTAL 3,90');assert(R.validate(t).ok);assert.equal(t.lines[0].unitObserved,true);assert.equal(t.lines[0].unit,.95);assert.equal(t.lines[1].unitObserved,false);
});
test('geometry retains a lone unit-column price as a unit price, never as a made-up line total',()=>{
 const c=parser();c.prepareTicket=t=>t;vm.runInContext(source.slice(source.indexOf('function receiptFromText('),source.indexOf('function receiptReadOptions(')),c);
 const word=(text,x)=>({text,box:[[x,.1],[x+.05,.1],[x+.05,.12],[x,.12]]}),row=(text,prices)=>({text,confidence:.96,box:[.1,.1,.9,.12],words:prices.map(([text,x])=>word(text,x))}),lines=[row('2 ARROZ 1,00 2,00',[['1,00',.55],['2,00',.8]]),row('2 LECHE 1,50 3,00',[['1,50',.55],['3,00',.8]]),row('2 YOGUR 2,20',[['2,20',.55]])];
 const t=c.receiptFromText('MERCADONA\n09/11/2026\n'+lines.map(l=>l.text).join('\n')+'\nTOTAL 9,40',{lines,confidence:96});assert.equal(t.lines[2].unit,2.2);assert.equal(t.lines[2].unitObserved,true);assert(Number.isNaN(t.lines[2].price));assert(R.validate(t).issues.some(i=>i.index===2&&i.field==='price'));
 const safe=c.receiptFromText('MERCADONA\n09/11/2026\n2 YOGUR 2,20\nTOTAL 2,20',{lines:[lines[2]]});assert.equal(safe.lines[0].price,2.2);
});
test('normalizing decimal spaces keeps the original confidence and source-image coordinates',()=>{
 const c=parser();c.prepareTicket=t=>t;vm.runInContext(source.slice(source.indexOf('function receiptFromText('),source.indexOf('function receiptReadOptions(')),c);const text='2 LECHE 0 , 95 1, 90',t=c.receiptFromText('MERCADONA\n09/11/2026\n'+text+'\nTOTAL 1,90',{lines:[{text,confidence:.6,box:[.1,.2,.8,.3]}]});assert.equal(t.lines[0].readConfidence,.6);assert.equal(JSON.stringify(t.lines[0].readBox),'[0.1,0.2,0.8,0.3]');
});
test('a pizza base is an article, while a VAT base is metadata',()=>{
 const t=parser().parseTicket('MERCADONA\n09/11/2026\nDescripción\nBASE PIZZA 2,20\nBASE IMPONIBLE 2,00\nTOTAL 2,20');assert.equal(t.lines.length,1);assert.equal(t.lines[0].name,'BASE PIZZA');assert.equal(t.lines[0].price,2.2);
});
