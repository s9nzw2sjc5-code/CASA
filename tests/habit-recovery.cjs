// Missing catalogue entries, preserved labels/images and explicit favourite recovery.
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

  const imagePath=JSON.parse(fs.readFileSync(path.join(root,'casa/mercadona.json'))).p.find(p=>p[0]==='40315')[9];
  await p.route('https://prod-mercadona.imgix.net/**',r=>r.request().url().includes(imagePath)?r.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(root,'casa/icons/icon-192.png'))}):r.abort());
  await p.evaluate(async()=>{await loadMC();ui.view='compras';ui.ckTab='lista';ui.list='super';ui.me='yo';S.items=[];S.cook.fav=[];CK_ACT.favToggle({id:'40315'});MC.p=MC.p.filter(p=>p[0]!=='40315');MC.w=MC.p.map(p=>words(p[1]));MC.byId.delete('40315');delete MC.retired['40315'];buildVocab(MC);MC.retired['retired-fixture']={name:'Nombre archivado de prueba',img:MC.byId.get('5044')[9],pack:'Botella'};S.cook.fav=['40315','43315','from-ticket','retired-fixture','99315','n:315','n:Nombre manual'];S.cook['favList:farmacia']=['n:Habitual de farmacia'];S.buys=[{id:'old',date:'2026-11-06',store:'Mercadona',total:2,items:[{mid:'from-ticket',name:'Nombre recuperado del ticket',units:1,price:2}]}];S.staples=[{id:'scheduled',listId:'super',mid:'99315',name:'Nombre antiguo de prueba',days:9,last:today(),auto:false}];render()});
  // A local record may recover the missing ID; remove its name to exercise unknown recovery.
  await p.evaluate(()=>{S.staples[0].name='315';render()});
  const receipts=await p.evaluate(()=>JSON.stringify(S.buys)),other=await p.evaluate(()=>JSON.stringify(favKeys('farmacia')));
  const card=key=>p.locator('.ck-hab').filter({has:p.locator(`[data-act=habAdd][data-v="${key}"]`)});
  assert((await card('40315').textContent()).includes('Activador Blanqueante'));assert((await card('43315').textContent()).includes('Limpiahogar Aloe Vera'));assert((await card('43315').textContent()).includes('Fuera del catálogo actual'));assert((await card('from-ticket').textContent()).includes('Nombre recuperado del ticket'));assert((await card('retired-fixture').textContent()).includes('Nombre archivado de prueba'));assert((await card('n:Nombre manual').textContent()).includes('Nombre manual'));assert((await card('99315').textContent()).includes('Producto por identificar'));assert((await card('n:315').textContent()).includes('Producto por identificar'));
  await p.waitForFunction(()=>document.querySelector('[data-habit-img]')?.naturalWidth>0);assert(await p.locator('[data-habit-img]').first().isVisible());assert.notEqual(await p.locator('[data-habit-img]').first().evaluate(img=>getComputedStyle(img).display),'none');await p.waitForFunction(()=>document.querySelectorAll('[data-habit-img]')[1]?.hidden);assert(await p.locator('[data-habit-img]').nth(1).evaluate(img=>!img.nextElementSibling.hidden));
  await p.locator('[data-act=habAdd][data-v="43315"]').click();assert.equal(await p.evaluate(()=>S.items[0].name),'Limpiahogar Aloe Vera Bosque Verde concentrado');assert.equal(await p.evaluate(()=>S.items[0].mid),'43315');assert.equal(await p.evaluate(()=>S.items[0].price||0),0);
  await p.locator('[data-act=habAdd][data-v="99315"]').click();assert.equal(await p.evaluate(()=>S.items.length),1);await p.locator('[data-repair-search]').click();await p.locator('#f_q').fill('arroz redondo');await p.locator('#ckPP [data-id="5044"]').click();assert(!await p.evaluate(()=>favKeys('super').includes('99315')));assert(await p.evaluate(()=>isFav('5044','super')));assert.deepEqual(await p.evaluate(()=>({mid:S.staples[0].mid,name:S.staples[0].name,days:S.staples[0].days})),{mid:'5044',name:'Arroz redondo Hacendado',days:9});assert.equal(await p.evaluate(()=>JSON.stringify(favKeys('farmacia'))),other);
  await p.locator('[data-act=habAdd][data-v="n:315"]').click();await p.locator('[data-repair-remove]').click();assert(!await p.evaluate(()=>favKeys('super').includes('n:315')));assert.equal(await p.evaluate(()=>JSON.stringify(S.buys)),receipts);assert(!await p.evaluate(()=>S.items.some(i=>/^\d+$/.test(i.name))));
  await p.screenshot({path:'/tmp/casa-recovered-habits.png'});assert.deepEqual(errors,[]);console.log('PASS: missing-product names/photos recovered, broken images have a stable fallback, unknown IDs cannot add numbers, explicit relink preserves schedule and other lists, remove works and receipts remain intact. No Firebase.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
