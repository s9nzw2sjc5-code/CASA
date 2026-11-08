const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),R=require('../casa/receipts.js');
const source=fs.readFileSync('casa/cocina.js','utf8');
const row=(id,name,price,pack='250 g',ref=price*4,refFmt='kg')=>[id,name,pack,price,0,0,ref,refFmt,0,id+'.jpg'];
function setup(rows=[row('coffee','Café molido natural Hacendado',2),row('wrong','Limpiador de limón',2),row('decaf','Café molido descafeinado',2)],buys=[]){
 const prod=p=>p&&({id:p[0],name:p[1],pack:p[2],price:p[3],ref:p[6],refFmt:p[7],img:p[9]}),c={S:{buys,cook:{},items:[]},MC:{byId:new Map(rows.map(p=>[p[0],p]))},CasaReceipts:R,norm:R.norm,same:(a,b)=>a===b||a+'s'===b||b+'s'===a||a+'es'===b||b+'es'===a,prod,prodSize:p=>p.pack,qWords:s=>R.norm(s).split(' '),searchProducts:()=>rows.map(prod)};
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('function purchaseNameScore('),source.indexOf('const CK_SRC=')),c);return c;
}
const buy=(line,extra={})=>({date:'2026-11-01',store:'Mercadona',items:[line],...extra}),coffee={id:'stock',name:'Café molido natural'};
test('uses the price per package, rather than the total of multiple packages; same price alone is insufficient',()=>{
 const c=setup(undefined,[buy({name:coffee.name,units:2,price:4,unitPrice:2})]),before=JSON.stringify(c.S),result=c.pantryProductMatches(coffee);
 assert.deepEqual(Array.from(result.matches,m=>m.product.id),['coffee']);assert.equal(result.history[0].price,2);assert(result.matches[0].equal);assert.equal(JSON.stringify(c.S),before);
});
test('weight purchases compare price per kg, including an older explicit kg quantity',()=>{
 for(const weighted of [{kg:.5},{qty:'0,5 kg'}]){const c=setup([row('courgette','Calabacín',1,'granel',2),row('other','Calabacín extra',1,'granel',3)],[buy({name:'Calabacín',units:1,price:1,unitPrice:2,...weighted})]),r=c.pantryProductMatches({name:'Calabacín'});assert.equal(r.history[0].basis,'kg');assert.equal(r.history[0].price,2);assert.deepEqual(Array.from(r.matches,m=>m.product.id),['courgette'])}
});
test('missing quantity, inconsistent prices, adjustments, unrecorded cart estimates and voided receipts cannot supply a match',()=>{
 const lines=[{name:coffee.name,price:4},{name:coffee.name,units:2,price:4,unitPrice:3},{name:coffee.name,units:1,price:-2},{name:coffee.name,kg:0,price:2},{name:coffee.name,units:0,price:2}];
 const c=setup(undefined,lines.map(l=>buy(l)));c.S.items=[{name:coffee.name,price:2,units:1}];c.S.buys.push(buy({name:coffee.name,units:1,price:2},{voided:true}));assert.equal(c.pantryProductMatches(coffee).history.length,0);
});
test('another retailer or an invalid date cannot identify a Mercadona reference',()=>{
 const line={name:coffee.name,units:1,price:2},c=setup(undefined,[buy(line,{store:'Lidl'}),buy(line,{store:''}),buy(line,{date:'2026-99-99'})]);assert.equal(c.pantryProductMatches(coffee).matches.length,0);
});
test('a previously identified reference still appears when the price changes, with the difference preserved',()=>{
 const c=setup([row('coffee','Café molido natural Hacendado',2.25)],[buy({name:'CAF MOL NAT',mid:'coffee',units:1,price:2})]),r=c.pantryProductMatches({...coffee,mid:'coffee'});assert.equal(r.matches[0].product.id,'coffee');assert(r.matches[0].identified);assert(!r.matches[0].equal);assert.equal(r.matches[0].history.price,2);assert.equal(r.matches[0].current,2.25);
});
test('milk variants, negations, package sizes and numeric varieties cannot be replaced by a similar price',()=>{
 const c=setup();for(const [a,b] of [['Leche semidesnatada','Leche desnatada'],['Leche sin lactosa','Leche entera'],['Leche con lactosa','Leche sin lactosa'],['Café molido natural','Café molido descafeinado'],['Café molido 500g','Café molido 1 kg'],['Queso 4 quesos','Queso 3 quesos']])assert.equal(c.purchaseNameScore(a,b),0,a+' / '+b);
 assert(c.purchaseNameScore('Café molido 500g','Café molido 0,5 kg')>.9);
});
test('equally plausible products remain multiple suggestions for the user to choose',()=>{
 const c=setup([row('a','Arroz redondo Hacendado',1.15,'1 kg'),row('b','Arroz redondo',1.15,'500 g')],[buy({name:'Arroz redondo',units:1,price:1.15})]);assert.equal(c.pantryProductMatches({name:'Arroz redondo'}).matches.length,2);
});
test('confirmed aliases and an explicit inventory link preserve earlier identification without changing the recorded name',()=>{
 const c=setup(undefined,[buy({name:'CAF MOL NAT',mid:'coffee',inventoryId:'stock',units:1,price:2})]);assert.equal(c.pantryProductMatches({id:'stock',name:'Mi café'}).matches[0].product.id,'coffee');c.S.cook.receiptAliases={'mercadona|caf mol nat':{name:coffee.name}};assert(c.pantryPriceHistory(coffee).length);assert.equal(c.S.buys[0].items[0].name,'CAF MOL NAT');
});
test('ordinary receipt abbreviations keep their variety rather than matching any product with the same price',()=>{
 const c=setup(undefined,[buy({name:'CAF MOL NAT',units:1,price:2})]);assert.deepEqual(Array.from(c.pantryProductMatches({name:'CAF MOL NAT'}).matches,m=>m.product.id),['coffee']);assert(c.purchaseNameScore('LECHE SEMI','Leche semidesnatada Hacendado')>.65);assert.equal(c.purchaseNameScore('LECHE SEMI','Leche desnatada Hacendado'),0);assert(c.purchaseNameScore('Cola sin azúcares','Cola sin azúcar')>.65);
});
