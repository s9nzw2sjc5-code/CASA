// Photo-to-shopping integration with the real local OCR and a simulated label.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://test').pathname,file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(error,data)=>{if(error)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.wasm':'application/wasm','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(data)});
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const p=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('https://**/*',r=>r.abort());await p.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.claude={use:async()=>null}'}));
  await p.goto(`http://127.0.0.1:${server.address().port}/casa/`,{waitUntil:'domcontentloaded'});

  await p.evaluate(async()=>{await loadMC();ui.view='compras';ui.ckTab='lista';ui.me='yo';ui.list='farmacia';S.items=[];render()});
  const photo=await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=1000;c.height=900;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#003b17';x.font='bold 75px Arial';x.fillText('HACENDADO',90,180);x.fillText('ARROZ',90,350);x.fillText('REDONDO',90,490);x.fillText('1 kg',90,680);return c.toDataURL('image/png').split(',')[1]});
  await p.locator('[data-act="shopPhoto"]').click();assert.equal(await p.locator('#productCamera').getAttribute('capture'),'environment');assert(await p.locator('.overlay').textContent().then(s=>s.includes('Farmacia')));assert(await p.locator('.overlay [data-s=ok]').isDisabled());
  await p.locator('#productLibrary').setInputFiles({name:'etiqueta-simulada.png',mimeType:'image/png',buffer:Buffer.from(photo,'base64')});
  await p.waitForFunction(()=>document.querySelector('#productPhotoResults [name=photoProduct]'),{},{timeout:180000});
  assert.equal(await p.evaluate(()=>S.items.length),0);assert(await p.locator('.overlay [data-s=ok]').isDisabled());assert((await p.locator('#productPhotoText').textContent()).includes('REDONDO'));
  assert.equal(await p.locator('.product-photo-option').first().evaluate(e=>getComputedStyle(e).display),'flex');
  const footer=await p.locator('.overlay [data-s=ok]').boundingBox();assert(footer.y+footer.height<=844,'Confirm button must remain visible');
  await p.screenshot({path:'/tmp/casa-product-photo-review.png'});
  await p.locator('[name=photoProduct][value="5044"]').check();await p.locator('#productPhotoUnits').fill('2');await p.locator('.overlay [data-s=ok]').click();assert.equal(await p.locator('.overlay').count(),0);assert.deepEqual(await p.evaluate(()=>S.items.map(i=>({mid:i.mid,units:i.units,list:i.listId}))),[{mid:'5044',units:2,list:'farmacia'}]);assert.equal(await p.evaluate(()=>S.pantry.length+S.buys.length),0);
  await p.locator('[data-act="shopPhoto"]').click();await p.locator('#productPhotoSearch').fill('arroz redondo');await p.locator('[name=photoProduct][value="5044"]').waitFor();await p.locator('[name=photoProduct][value="5044"]').check();await p.locator('.overlay [data-s=ok]').click();assert.equal(await p.evaluate(()=>S.items.find(i=>i.mid==='5044').units),3);assert.equal(await p.evaluate(()=>S.items.length),1);
  await p.locator('[data-act="shopPhoto"]').click();await p.locator('#productPhotoSearch').fill('arroz redondo');await p.locator('[name=photoProduct][value="5044"]').waitFor();await p.locator('[name=photoProduct][value="5044"]').check();await p.locator('#productPhotoSearch').fill('leche');assert(await p.locator('.overlay [data-s=ok]').isDisabled());await p.locator('.overlay [data-s=cancel]').click();assert.equal(await p.evaluate(()=>S.items[0].units),3);
  await p.locator('[data-act="shopPhoto"]').click();await p.locator('#productLibrary').setInputFiles({name:'rota.jpg',mimeType:'image/jpeg',buffer:Buffer.from('invalid')});await p.waitForFunction(()=>document.querySelector('#productPhotoStatus')?.textContent.includes('No se puede abrir'));assert(await p.locator('.overlay [data-s=ok]').isDisabled());await p.locator('.overlay [data-s=cancel]').click();
  // Closing during a real OCR must stop the worker and never alter the list.
  await p.locator('[data-act="shopPhoto"]').click();await p.locator('#productLibrary').setInputFiles({name:'otra.png',mimeType:'image/png',buffer:Buffer.from(photo,'base64')});await p.locator('.overlay [data-s=cancel]').click();await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>S.items[0].units),3);
  await p.screenshot({path:'/tmp/casa-product-photo-flow.png'});
  assert.deepEqual(errors,[]);console.log('PASS: real local OCR from simulated label; no addition before confirmation; selected list/quantity, merge, invalidation on search, unreadable file and cancellation. No Firebase.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
