// Purchase history product actions: real app UI, fixtures only, Firebase blocked.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://test').pathname,file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(error,data)=>{if(error)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(data)});
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const p=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('https://**/*',r=>r.abort());await p.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.claude={use:async()=>null}'}));
  await p.goto(`http://127.0.0.1:${server.address().port}/casa/`,{waitUntil:'domcontentloaded'});

  await p.evaluate(async()=>{
   await loadMC();ui.view='compras';ui.ckTab='lista';ui.me='yo';ui.list='farmacia';S.items=[];S.cook.fav=[];S.pantry=[{id:'stock',name:'Existencia de prueba',n:5,u:'ud'}];
   S.buys=[{id:'purchase',date:'2026-11-06',store:'Mercadona',total:12.34,ticket:true,items:[{name:'Arroz del ticket',mid:'5044',units:3,price:3.45},{name:'Artículo sin catálogo',units:2,qty:'500 g',price:4},{name:'Producto retirado',mid:'retired-id',units:1,price:2},'Nombre antiguo',{name:'Descuento',units:1,price:-1}]}];render();
  });
  const unchanged=await p.evaluate(()=>JSON.stringify({buys:S.buys,pantry:S.pantry,week:spentWeek()}));
  await p.locator('[data-act=ckBuys]').first().click();await p.locator('[data-b=purchase]').click();assert.equal(await p.locator('[data-history-product]').count(),4);assert.equal(await p.locator('[data-history-product="4"]').count(),0);
  const history=p.locator('.overlay').first();const beforeChecked=await history.locator('[data-r="0"]').isChecked();await p.locator('[data-history-product="0"]').click();assert.equal(await history.locator('[data-r="0"]').isChecked(),beforeChecked);assert.equal(await p.evaluate(()=>S.items.length),0);
  const detail=p.getByRole('dialog',{name:'Producto del ticket'});assert(await detail.textContent().then(s=>s.includes('farmacia')||s.includes('Farmacia')));await detail.locator('[data-history-fav]').click();assert(await p.evaluate(()=>isFav('5044')));await detail.locator('[data-history-fav]').click();assert(!await p.evaluate(()=>isFav('5044')));await detail.locator('[data-history-fav]').click();
  await detail.locator('#historyProductUnits').fill('0');await detail.locator('[data-history-add]').click();assert.equal(await p.evaluate(()=>S.items.length),0);assert((await detail.locator('[data-history-status]').textContent()).includes('1 a 99'));
  await detail.locator('#historyProductUnits').fill('2');await detail.locator('[data-history-add]').click();assert.deepEqual(await p.evaluate(()=>S.items.map(i=>({mid:i.mid,units:i.units,list:i.listId}))),[{mid:'5044',units:2,list:'farmacia'}]);assert(await detail.locator('[data-history-add]').isDisabled());assert(await history.locator('[data-r="0"]').isDisabled());assert((await history.locator('[data-history-meta="0"]').textContent()).includes('Habitual'));
  await p.screenshot({path:'/tmp/casa-history-product-detail.png'});
  await detail.locator('[data-s=cancel]').click();await p.locator('[data-history-product="0"]').click();assert(await p.locator('[data-history-add]').isDisabled());await p.locator('.overlay').last().locator('[data-s=cancel]').click();assert.equal(await p.evaluate(()=>S.items.length),1);
  await p.locator('[data-history-product="1"]').click();await p.locator('[data-history-fav]').click();await p.locator('[data-history-add]').click();assert(await p.evaluate(()=>isFav('n:Artículo sin catálogo')));assert.equal(await p.evaluate(()=>S.items.find(i=>i.name==='Artículo sin catálogo').qty),'500 g');await p.locator('.overlay').last().locator('[data-s=cancel]').click();
  await p.locator('[data-history-product="2"]').click();await p.locator('[data-history-fav]').click();await p.locator('[data-history-add]').click();assert(await p.evaluate(()=>isFav('n:Producto retirado')));assert.equal(await p.evaluate(()=>S.items.find(i=>i.name==='Producto retirado').mid),'');await p.locator('.overlay').last().locator('[data-s=cancel]').click();
  await p.locator('[data-history-product="3"]').click();await p.locator('[data-history-fav]').click();assert(await p.evaluate(()=>isFav('n:Nombre antiguo')));await p.locator('.overlay').last().locator('[data-s=cancel]').click();
  await p.locator('[data-k=again]').click();assert.equal(await p.evaluate(()=>S.items.length),4);assert.equal(await p.evaluate(()=>S.items.filter(i=>i.mid==='5044').length),1);assert.equal(await p.evaluate(()=>S.items.find(i=>i.mid==='5044').units),2);assert(!await p.evaluate(()=>S.items.some(i=>i.name==='Descuento')));
  assert.equal(await p.evaluate(()=>JSON.stringify({buys:S.buys,pantry:S.pantry,week:spentWeek()})),unchanged);
  // Favourites persist, and both catalogue and named habits can be used normally.
  await p.reload({waitUntil:'domcontentloaded'});await p.evaluate(async()=>{await loadMC();ui.view='compras';ui.ckTab='lista';ui.list='super';render()});assert(await p.evaluate(()=>isFav('5044')&&isFav('n:Artículo sin catálogo')));assert((await p.locator('.ck-habs').textContent()).includes('Artículo sin catálogo'));await p.locator('[data-act=habAdd][data-v="5044"]').click();assert.equal(await p.evaluate(()=>S.items.find(i=>i.mid==='5044'&&i.listId==='super').units),1);
  await p.screenshot({path:'/tmp/casa-history-products.png'});assert.deepEqual(errors,[]);console.log('PASS: ticket product actions, quantity validation, known/named/retired/legacy favourites, no duplicate or discount re-add, bulk repeat, persistence, and unchanged receipt/spend/inventory. No Firebase.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
