const {test}=require('node:test'),assert=require('node:assert/strict'),R=require('../casa/shopping-recommendations.js');
const now='2026-11-12',line=(over={})=>({name:'Café',units:1,price:2,unitPrice:2,...over}),buy=(date,items=[line()],over={})=>({date,store:'Tienda',ticket:true,total:items.reduce((n,l)=>n+(l.price||0),0),items,...over});
const history=(dates=['2026-10-01','2026-10-11','2026-10-21'])=>dates.map(d=>buy(d));
function model(overrides={},today=now){const state={buys:history(),items:[],pantry:[],cook:{},...overrides},before=JSON.stringify(state),result=R.build(state,{today,listId:'super'});assert.equal(JSON.stringify(state),before);return result}
test('learns recent frequency from purchase dates and explains its evidence',()=>{const [p]=model().suggestions;assert.equal(p.interval,10);assert.equal(p.elapsed,22);assert.equal(p.count,3);assert.equal(p.confidence,'pattern');assert.equal(p.key,'name:cafe')});
test('two dates create a cautious initial pattern; one date needs an explicit interval',()=>{
 let m=model({buys:history(['2026-10-20','2026-10-23'])});assert.equal(m.suggestions[0].interval,7);assert.equal(m.suggestions[0].confidence,'initial');m=model({buys:history(['2026-10-20'])});assert.equal(m.suggestions.length,0);assert.equal(m.profiles[0].status,'learning');m=model({buys:history(['2026-10-20']),cook:{[R.prefKey('name:cafe')]:{days:14}}});assert.equal(m.suggestions[0].interval,14);assert(m.suggestions[0].custom);
});
test('filters exact and legacy duplicate tickets, invalid dates, voids, pending receipts, refunds and carry bags',()=>{
 const a=buy('2026-10-01',[line()],{id:'one',imageHash:'image-one'}),data=[a,{...a,id:'copy'},buy('2026-10-11'),buy('2026-10-21'),buy('2026-10-21'),buy('2026-11-10',[line()],{receiptPending:true}),buy('2026-11-11',[line()],{voided:true}),buy('2026-11-13'),buy('2026-02-30'),buy('2026-10-10',[line({name:'Bolsa plástico',price:.15}),line({name:'Descuento',price:-1}),line({name:'315'})])];const m=model({buys:data});assert.equal(m.stats.purchases,3);assert.equal(m.stats.products,1);assert.equal(m.profiles[0].count,3);
});
test('matches catalogue IDs, inventory links and confirmed receipt aliases without guessing variants',()=>{
 const buys=[buy('2026-10-01',[line({name:'CAFE CORT.',mid:'coffee'})]),buy('2026-10-11',[line({name:'Café molido',inventoryId:'jar'})]),buy('2026-10-21',[line({name:'CAF M.'})])],cook={receiptAliases:{'tienda|caf m':{name:'Café molido'}}},m=model({buys,cook,pantry:[{id:'jar',mid:'coffee',name:'Café molido',n:0}]});assert.equal(m.stats.products,1);assert.equal(m.profiles[0].key,'mid:coffee');assert.equal(m.profiles[0].count,3);
 const variants=model({buys:['2026-10-01','2026-10-11','2026-10-21'].flatMap(date=>[buy(date,[line({name:'Leche sin lactosa',mid:'without'})]),buy(date,[line({name:'Leche con lactosa',mid:'with'})])])});assert.equal(variants.stats.products,2);
});
test('same generic name with two known references remains ambiguous and is never folded into a variant',()=>{
 const buys=[buy('2026-10-01',[line({name:'Leche',mid:'whole'})]),buy('2026-10-11',[line({name:'Leche',mid:'semi'})]),buy('2026-10-21',[line({name:'Leche'})])],m=model({buys});assert.equal(m.stats.products,3);assert.deepEqual(m.profiles.map(p=>p.count),[1,1,1]);
});
test('availability is a prompt to check, not a measured stock forecast; list and cart suppress duplicates',()=>{
 const p=model({pantry:[{name:'Café',n:1}]}).suggestions[0];assert(p.inInventory);for(const done of [true,false])assert.equal(model({items:[{name:'Café',listId:'super',done}]}).suggestions.length,0);assert.equal(model({items:[{name:'Café',listId:'farmacia'}]}).suggestions.length,1);
});
test('keeps legacy feedback and new shared preferences; new purchases reset only a previous-cycle snooze',()=>{
 assert.equal(model({cook:{shoppingFeedback:{'café':{until:now}}}}).suggestions.length,0);assert.equal(model({cook:{shoppingFeedback:{cafe:{until:'2026-11-11'}}}}).suggestions.length,1);
 const key=R.prefKey('name:cafe'),cook={[key]:{answer:'have',until:'2026-11-30',basedOn:'2026-10-21'}};assert.equal(model({cook}).suggestions.length,0);const m=model({cook,buys:history().concat(buy('2026-11-01'))});assert.equal(m.profiles[0].status,'due');
});
test('never recommend persists through a new ticket and can be reversed without rewriting purchases',()=>{
 const key=R.prefKey('name:cafe');assert.equal(model({cook:{[key]:{muted:true}},buys:history().concat(buy('2026-11-01'))}).profiles[0].status,'muted');assert.equal(model({cook:{[key]:{muted:false}}}).suggestions.length,1);
});
test('preference for a named product survives a later unambiguous catalogue association',()=>{
 const key=R.prefKey('name:cafe'),m=model({cook:{[key]:{days:20,muted:true,updatedAt:1}},pantry:[{id:'c',mid:'coffee',name:'Café',n:1}]});assert.equal(m.profiles[0].key,'mid:coffee');assert.equal(m.profiles[0].interval,20);assert.equal(m.profiles[0].status,'muted');
});
test('uses repeated package quantities conservatively and never interprets kg as packages',()=>{
 const dates=['2026-10-01','2026-10-11','2026-10-21'],make=extra=>model({buys:dates.map(d=>buy(d,[line(extra)]))}).profiles[0];assert.equal(make({units:2,price:4,unitPrice:2}).suggestedUnits,2);assert.equal(make({units:16,price:2,unitPrice:.125}).suggestedUnits,1);assert.equal(make({units:1,kg:.5,price:2,unitPrice:4}).suggestedUnits,1);assert.equal(make({units:2,price:4,unitPrice:9}).suggestedUnits,1);
});
test('single-day repeated lines cannot teach a recurrence or inflate the purchase count',()=>{
 const m=model({buys:[buy('2026-10-01',[line(),line()]),buy('2026-10-01',[line({units:2,price:4})])]});assert.equal(m.profiles[0].count,1);assert.equal(m.suggestions.length,0);
});
test('old abandoned products stop nagging and histories from other lists do not leak into Super',()=>{
 const m=model({},'2027-02-12');assert.equal(m.suggestions.length,0);assert(m.profiles.every(p=>p.status==='dormant'));assert.equal(model({buys:history().map(b=>({...b,listId:'farmacia'}))}).stats.products,0);
});
test('a recently purchased product waits until its next window, even if a previous suggestion was due',()=>{
 const m=model({buys:history().concat(buy(now))});assert.equal(m.suggestions.length,0);assert.equal(m.profiles[0].elapsed,0);assert.equal(m.profiles[0].status,'upcoming');
});
