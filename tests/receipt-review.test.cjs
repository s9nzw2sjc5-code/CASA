const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),R=require('../casa/receipts.js');
function helpers(){const source=fs.readFileSync('casa/receipt-extras.js','utf8'),c={CasaReceipts:R};vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function receiptTextForEdit('),source.indexOf('function receiptShowPhoto(')),c);return c}
const ticket=lines=>({store:'Prueba',date:'2026-11-12',total:5,lines});
test('a new OCR pass preserves confirmed names, quantities and prices instead of undoing the review',()=>{
 const c=helpers(),old=ticket([{originalName:'ABREVIATURA',name:'Nombre corregido',units:2,unit:2.5,unitObserved:true,price:5,lineValidated:true,quantityObserved:true,editedFields:['nm','pr','units']}]),fresh=ticket([{name:'ABREVIATURA',units:1,unit:1,price:1,quantityObserved:true}]);
 const before=JSON.stringify(old),result=c.receiptMergeCorrections(old,fresh);assert.equal(result.lines[0].name,'Nombre corregido');assert.equal(result.lines[0].units,2);assert.equal(result.lines[0].price,5);assert.equal(result.lines[0].unit,2.5);assert.equal(result.lines[0].lineValidated,true);assert.equal(JSON.stringify(old),before);
});
test('only deliberately edited fields carry over; untouched OCR fields can improve',()=>{
 const c=helpers(),result=c.receiptMergeCorrections(ticket([{name:'Arroz',units:1,unit:1,price:2.2,quantityObserved:true,editedFields:['pr']}]),ticket([{name:'Arroz',units:2,unit:1.1,price:1,quantityObserved:true}]));assert.equal(result.lines[0].price,2.2);assert.equal(result.lines[0].units,2);assert.equal(result.lines[0].unit,1.1);
});
test('ambiguous or missing corrected rows are retained explicitly and require a decision',()=>{
 const c=helpers(),result=c.receiptMergeCorrections(ticket([{name:'Arroz',units:1,unit:2,price:2,lineValidated:true}]),ticket([{name:'Arroz',units:1,unit:1,price:1},{name:'Arroz',units:1,unit:1,price:1}]));assert.equal(result.lines.length,3);assert.equal(result.lines[2].unmatchedCorrection,true);assert.equal(result.lines[2].price,2);
});
test('header edits and a pending purchase link survive rereading the image',()=>{
 const c=helpers(),old={...ticket([]),date:'2026-11-10',total:82.43,store:'Tienda corregida',editedHeaderFields:['date','total','store'],pendingBuyId:'pending'};const result=c.receiptMergeCorrections(old,ticket([]));assert.equal(result.total,82.43);assert.equal(result.date,'2026-11-10');assert.equal(result.store,'Tienda corregida');assert.equal(result.pendingBuyId,'pending');
});
test('the text editor receives current corrected values and excludes unchecked rows',()=>{
 const text=helpers().receiptTextForEdit({...ticket([{name:'Corregido',units:2,unit:2.5,unitObserved:true,quantityObserved:true,price:5},{name:'Excluido',units:1,price:9,excluded:true}]),total:5});assert(text.includes('2 Corregido 2,50 5,00'));assert(text.includes('TOTAL 5,00'));assert(!text.includes('Excluido'));
});
