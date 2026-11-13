const {test}=require('node:test'),assert=require('node:assert/strict'),I=require('../casa/household-insights.js'),R=require('../casa/shopping-recommendations.js');
const now='2026-11-13',current={id:'coffee',name:'Café molido',cat:'Cacao, café e infusiones',price:2.85,size:250,fmt:'g',d:'m',img:'coffee.jpg'},lookup=id=>id==='coffee'?current:null;
const line=(extra={})=>({name:'Café molido',mid:'coffee',units:2,unitPrice:2.5,price:5,packSize:250,packUnit:'g',packLabel:'250 g',...extra});
const buy=(items=[line()],extra={})=>({id:'ticket',date:'2026-11-01',store:'Mercadona',total:items.reduce((n,l)=>n+l.price,0),items,...extra});
const state=extra=>({buys:[buy()],items:[],pantry:[],lists:[{id:'super'},{id:'farmacia'}],staples:[],cook:{},...extra});
test('only compares recorded unit prices from the same reference, format, basis and store',()=>{
 const s=state({buys:[buy([line({packSize:500,price:4,unitPrice:2})],{id:'other-format',date:'2026-11-12'}),buy()]});const h=I.priceHistory(s,{mid:'coffee'},{today:now,current});assert.equal(h.previous.value,2.5);assert.equal(h.delta,.35);assert.equal(h.rows.length,2);
 for(const change of [{mid:'different'},{packSize:500},{packUnit:'ml'},{packSize:undefined},{kg:.5,units:1,unitPrice:10}]){const result=I.priceHistory(state({buys:[buy([line(change)])]}),{mid:'coffee'},{today:now,current});assert.equal(result.delta,null)}
 assert.equal(I.priceHistory(state({buys:[buy(undefined,{store:'Otra tienda'})]}),{mid:'coffee'},{today:now,current}).delta,null);
});
test('weighted products compare by kg and invalid quantity math never supplies a price',()=>{
 const p={...current,fmt:'kg',refFmt:'kg',ref:5},l=line({kg:.5,units:1,price:2,unitPrice:4});assert.equal(I.priceHistory(state({buys:[buy([l])]}),{mid:'coffee'},{today:now,current:p}).delta,1);for(const change of [{units:0},{unitPrice:8},{price:undefined},{kg:0}])assert.equal(I.unitPrice(line(change)),null);
});
test('unknown old package formats remain visible without inventing a price-change claim',()=>{
 const h=I.priceHistory(state({buys:[buy([line({packSize:undefined,packUnit:undefined,packLabel:undefined})])]}),{mid:'coffee'},{today:now,current});assert.equal(h.rows[0].value,2.5);assert.equal(h.delta,null);
});
test('expense categories, discounts, missing lines and pending totals reconcile exactly in cents',()=>{
 const items=[line(),line({name:'Lejía',mid:'',price:2,unitPrice:1,category:'Limpieza y hogar'}),line({name:'Champú',mid:'',price:3,unitPrice:1.5,category:'Cuidado del cabello'}),line({name:'Descuento',mid:'',price:-1})];const s=state({buys:[buy(items,{total:11}),buy([],{id:'manual',total:4}),buy([],{id:'pending',receiptPending:true,total:8}),buy(undefined,{id:'void',voided:true}),buy(undefined,{id:'future',date:'2026-12-01'}),buy(undefined,{id:'invalid',date:'2026-02-30'})]});const report=I.spending(s,'2026-11',{today:now,lookup});assert.equal(report.totalCents,2300);assert.deepEqual(Object.fromEntries(report.groups.map(g=>[g.name,g.cents])),{'Alimentación':500,'Limpieza':200,'Higiene':300,'Sin clasificar y ajustes':500,'Pendiente de ticket':800});assert.equal(report.groups.reduce((n,g)=>n+g.cents,0),report.totalCents);assert.equal(report.count,3);
});
test('retries identified by receipt hash/identity cannot double the spend or the history',()=>{const b=buy(undefined,{imageHash:'same'}),s=state({buys:[b,{...b,id:'retry'}]});assert.equal(I.spending(s,'2026-11',{today:now,lookup}).totalCents,500);assert.equal(I.priceHistory(s,{mid:'coffee'},{today:now,current}).rows.length,1)});
test('unknown categories stay unclassified and never default to food',()=>{const s=state({buys:[buy([line({name:'Artículo de farmacia',mid:'',category:'Farmacia'})])]});assert.equal(I.spending(s,'2026-11',{today:now}).groups.find(g=>g.name==='Alimentación').cents,0)});
test('search joins explicit references across home, both lists and history without changing data',()=>{
 const s=state({pantry:[{id:'jar',mid:'coffee',name:'Mi café',n:1}],items:[{id:'a',mid:'coffee',name:'Café molido',listId:'super',done:true},{id:'b',mid:'coffee',name:'Café molido',listId:'farmacia'}],cook:{fav:['coffee']}}),before=JSON.stringify(s),rows=I.search(s,'cafe',{today:now,lookup,products:[current]});assert.equal(rows.length,1);assert.equal(rows[0].pantry.length,1);assert.equal(rows[0].items.length,2);assert.equal(rows[0].purchases.length,1);assert.deepEqual(rows[0].favorites,['super']);assert.equal(JSON.stringify(s),before);
});
test('ambiguous names and milk variants remain separate; unverified/voided purchases do not teach search',()=>{
 const s=state({buys:[buy([line({name:'Leche',mid:'whole'})],{id:'a'}),buy([line({name:'Leche',mid:'semi'})],{id:'b'}),buy([line({name:'Leche',mid:''})],{id:'c'}),buy([line({name:'Leche sin lactosa',mid:'without'})],{id:'d'}),buy([line()],{id:'void',voided:true}),buy([line()],{id:'pending',receiptPending:true})]});const rows=I.search(s,'leche',{today:now});assert.equal(rows.length,4);assert.equal(I.search(s,'cafe',{today:now}).length,0);
});
test('legacy automatic schedules take precedence over a conflicting old recommendation interval',()=>{
 const s=state({staples:[{id:'usual',mid:'coffee',name:'Café molido',listId:'super',days:14,last:'2026-11-01',auto:true}],cook:{[R.prefKey('mid:coffee')]:{days:3}}});const policy=R.rule(s,{mid:'coffee',name:'Café molido'},{listId:'super'});assert.equal(policy.days,14);assert(policy.autoAdd);const m=R.build(s,{today:now});assert.equal(m.profiles[0].interval,14);
});
test('an explicit shared mode disables the old schedule and keeps other lists independent',()=>{
 const s=state({staples:[{id:'usual',mid:'coffee',name:'Café molido',listId:'super',days:14,last:'2026-11-01',auto:true}],cook:{[R.prefKey('mid:coffee')]:{mode:'off',days:14,autoAdd:true}}});assert.equal(R.rule(s,{mid:'coffee'},{listId:'super'}).mode,'off');assert.equal(R.build(s,{today:now}).suggestions.length,0);assert.equal(R.rule(s,{mid:'coffee'},{listId:'farmacia'}).mode,'auto');s.cook[R.prefKey('mid:coffee')].mode='auto';assert.equal(R.rule(s,{mid:'coffee'},{listId:'super'}).autoAdd,false);
});
test('manual schedules without tickets still appear with zero fabricated purchases and latest real date wins',()=>{
 const s=state({buys:[],staples:[{id:'usual',mid:'coffee',name:'Café molido',listId:'super',days:7,last:'2026-11-01',auto:false}]});const m=R.build(s,{today:now});assert.equal(m.profiles[0].count,0);assert.equal(m.profiles[0].referenceOnly,true);assert.equal(m.suggestions[0].interval,7);s.buys=[buy(undefined,{date:now})];assert.equal(R.build(s,{today:now}).suggestions.length,0);
});

test('snoozing a manual rule pauses both suggestions and automatic additions for that purchase cycle',()=>{const key=R.prefKey('mid:coffee'),s=state({staples:[{id:'usual',mid:'coffee',name:'Café molido',listId:'super',days:2,last:'2026-11-01',auto:true}],cook:{[key]:{mode:'manual',days:2,autoAdd:true,until:'2026-11-20',basedOn:'2026-11-01'}}});assert(R.rule(s,{mid:'coffee'},{listId:'super',today:now}).paused);assert.equal(R.build(s,{today:now}).suggestions.length,0);assert.equal(R.rule(s,{mid:'coffee',last:'2026-11-12'},{listId:'super',today:now}).paused,false)});
test('a confirmed schedule reference joins earlier exact names without inventing extra purchases',()=>{const s=state({buys:[buy([line({mid:''})])],staples:[{id:'usual',mid:'coffee',name:'Café molido',listId:'super',days:14,last:'2026-11-01',auto:true}]});const m=R.build(s,{today:now});assert.equal(m.profiles.length,1);assert.equal(m.profiles[0].mid,'coffee');assert.equal(m.profiles[0].count,1)});

test('automatic learning uses actual purchase dates after a manual reference was configured',()=>{const s=state({buys:[buy(undefined,{date:'2026-11-01'})],staples:[{id:'usual',mid:'coffee',name:'Café molido',listId:'super',days:14,last:'2026-11-12',auto:false}],cook:{[R.prefKey('mid:coffee')]:{mode:'auto',last:'2026-11-12'}}});const p=R.build(s,{today:now}).profiles[0];assert.equal(p.last,'2026-11-01');assert.equal(p.referenceOnly,false)});
