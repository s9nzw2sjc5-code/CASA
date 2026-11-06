// Real browser regression: adding a habitual must preserve the carousel position.
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
  await p.evaluate(async()=>{await loadMC();ui.view='compras';ui.ckTab='lista';ui.me='yo';S.cook.fav=MC.p.filter(p=>p[3]>0).slice(0,35).map(p=>p[0]);render()});
  await p.locator('.ck-habs').scrollIntoViewIfNeeded();
  const before=await p.evaluate(()=>{const strip=document.querySelector('.ck-habs');strip.scrollLeft=1100;const rect=strip.getBoundingClientRect();const button=[...strip.querySelectorAll('[data-act=habAdd]')].find(b=>{const r=b.getBoundingClientRect();return r.left>=rect.left+4&&r.right<=rect.right-4});if(!button)throw Error('No visible habitual fixture');return {left:strip.scrollLeft,top:document.querySelector('#app').scrollTop,key:button.dataset.v}});
  assert(before.left>500);await p.locator(`[data-act=habAdd][data-v="${before.key}"]`).click();
  const position=()=>p.evaluate(()=>({left:document.querySelector('.ck-habs').scrollLeft,top:document.querySelector('#app').scrollTop}));
  let after=await position();assert(Math.abs(after.left-before.left)<=1,`Habituales saltó de ${before.left} a ${after.left}`);assert(Math.abs(after.top-before.top)<=1);
  const id=await p.evaluate(key=>S.items.find(i=>i.mid===key).id,before.key);await p.locator(`.ck-habs [data-act=itemStep][data-id="${id}"]`).click();assert.equal(await p.evaluate(id=>S.items.find(i=>i.id===id).units,id),2);
  after=await position();assert(Math.abs(after.left-before.left)<=1);await p.evaluate(()=>render());after=await position();assert(Math.abs(after.left-before.left)<=1);
  await p.evaluate(()=>{ui.ckTab='productos';ui.prodCat='hab';render();document.querySelector('#app').scrollTop=1000});const vertical=await p.evaluate(()=>document.querySelector('#app').scrollTop);assert(vertical>500);await p.evaluate(()=>{const app=document.querySelector('#app').getBoundingClientRect(),button=[...document.querySelectorAll('[data-act=cartStep][data-v="1"]')].find(b=>{const r=b.getBoundingClientRect();return r.top>=app.top&&r.bottom<=app.bottom});if(!button)throw Error('No visible product fixture');button.click()});assert(Math.abs(await p.evaluate(()=>document.querySelector('#app').scrollTop)-vertical)<=1);
  await p.locator('#qProd').fill('leche');await p.waitForFunction(()=>document.querySelector('#ckProductResults')?.textContent.includes('resultados'));await p.locator('#qProd').press('Tab');
  const searched=await p.evaluate(()=>{const element=document.querySelector('#app');element.scrollTop=900;const rect=element.getBoundingClientRect(),button=[...document.querySelectorAll('[data-act=cartStep][data-v="1"]')].find(b=>{const r=b.getBoundingClientRect();return r.top>=rect.top&&r.bottom<=rect.bottom});if(!button)throw Error('No visible search result');return {top:element.scrollTop,id:button.dataset.id}});
  await p.locator(`[data-act=cartStep][data-v="1"][data-id="${searched.id}"]`).click();assert.equal(await p.locator('#qProd').inputValue(),'leche');assert(Math.abs(await p.evaluate(()=>document.querySelector('#app').scrollTop)-searched.top)<=1);
  const newestDate=await p.evaluate(()=>{const rows=MC.p.filter(p=>p[13]),date=rows.map(p=>MC.newSince[p[0]]||'').sort().at(-1);ui.novSeen=rows.map(p=>p[0]);ui.novCat=0;CK_ACT.ckTab({v:'novedades'});return date});const newest=await p.locator('.ck-grid .ck-card').first().locator('[data-act="cartStep"]').first().getAttribute('data-id');assert.equal(await p.evaluate(id=>MC.newSince[id],newest),newestDate);await p.evaluate(()=>{CK_ACT.ckTab({v:'lista'});ui.novCat=0;CK_ACT.ckTab({v:'novedades'})});assert.equal(await p.locator('.ck-grid .ck-card').first().locator('[data-act="cartStep"]').first().getAttribute('data-id'),newest);assert.equal(await p.evaluate(()=>ui.novCat),null);
  await p.evaluate(()=>{ui.novCat=0;localStorage.setItem(LS+'-ui',JSON.stringify(ui))});await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!MC);assert.equal(await p.evaluate(()=>ui.novCat),null);assert.equal(await p.locator('.ck-grid .ck-card').first().locator('[data-act="cartStep"]').first().getAttribute('data-id'),newest);
  assert.deepEqual(errors,[]);console.log('PASS: habitual add, quantity increase and background render preserve horizontal/vertical position; habitual product grid keeps vertical position. No Firebase connection.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
