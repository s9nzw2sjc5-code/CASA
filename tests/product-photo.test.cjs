const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../casa/product-photo.js'),catalogue=require('../casa/mercadona.json').p;
test('brand or nutrition alone cannot identify a product',()=>{for(const text of ['', 'HACENDADO', 'MERCADONA\n100 g','Información nutricional\nGrasas saturadas 3 g\nProteínas 4 g'])assert.deepEqual(P.rank({text},catalogue).candidates,[])});
test('low confidence label is rejected',()=>assert.equal(P.rank({lines:[{text:'Arroz redondo',confidence:.4}]},catalogue).candidates.length,0));
test('readable names yield relevant candidates and always require confirmation',()=>{
 for(const [text,id]of [['ARROZ REDONDO\nHACENDADO\n1 kg','5044'],['Café molido natural\nHacendado\n250 g','11172'],['Tomate frito Hacendado\n400 g','17108']]){const r=P.rank({text},catalogue);assert(r.needsConfirmation);assert(r.candidates.some(p=>p.id===id));assert.equal(new Set(r.candidates.map(p=>p.id)).size,r.candidates.length)}
});
test('leche desnatada does not propose entera or semidesnatada',()=>{const r=P.rank({text:'LECHE DESNATADA HACENDADO 1L'},catalogue);assert(r.candidates.length);for(const row of r.candidates){const name=catalogue.find(p=>p[0]===row.id)[1];assert(!/entera|semidesnatada/i.test(name))}});
test('same name in different sizes stays ambiguous; size improves ranking',()=>{const rows=[['large','Café natural Hacendado','Paquete',4,.5,'kg'],['small','Café natural Hacendado','Paquete',2,.25,'kg']];assert.equal(P.rank({text:'Café natural Hacendado 250 g'},rows).candidates[0].id,'small');assert.equal(P.rank({text:'Café natural Hacendado'},rows).candidates.length,2)});

test('joined product name can be split, Portuguese PERU alone cannot suggest coffee',()=>{const r=P.rank({text:'CHORIZOPAVO\nCHOURICO .PERU'},catalogue);assert(r.candidates.some(c=>c.id==='59158'));assert(!r.candidates.some(c=>/cafe/i.test(catalogue.find(p=>p[0]===c.id)[1])));assert.equal(P.rank({text:'CHOURICO .PERU'},catalogue).candidates.length,0)});

test('short and mixed names work and energetic drinks are not nutritional rows',()=>{for(const text of ['Té verde Hacendado','Bebida energética Red Bull'])assert(P.rank({text},catalogue).candidates.length,text)});

test('alphanumeric brand is kept when the catalogue actually contains it',()=>{assert.equal(P.rank({text:'7UP'},[...catalogue,['test7','7UP','Lata',1,.33,'l']]).candidates[0].id,'test7')});

test('the Bosque Verde brand must not remove verde from food names',()=>{const r=P.rank({text:'Té verde Hacendado'},catalogue);assert.equal(catalogue.find(p=>p[0]===r.candidates[0].id)[1],'Té verde Hacendado')});
