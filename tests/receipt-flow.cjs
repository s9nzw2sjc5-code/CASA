// Browser integration with the real CASA Firebase bridge and a simulated transport.
// No live Firebase account is used. Run: node tests/receipt-flow.cjs
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://test').pathname),file=path.resolve(root,'.'+(name.endsWith('/')?name+'index.html':name));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return}res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data)});
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const p=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{
   window.testWrites=0;window.testSets=0;window.testServerReads=0;window.testQueue=Promise.resolve();
   const snapshot=p=>({exists:p==='hogar/estado',metadata:{hasPendingWrites:false},data:()=>structuredClone(window.testState)});
   const ref=p=>({get:async options=>{if(options?.source==='server')testServerReads++;if(!window.testState)window.testState=structuredClone(fresh());return snapshot(p)},onSnapshot:()=>()=>{},set:async()=>{testSets++;throw Error('Full document set is not allowed in this receipt test')}});
   const fs={settings(){},doc:ref,collection:p=>({doc:id=>ref(p+'/'+id)}),runTransaction:async fn=>{
    const work=testQueue.then(async()=>{let pending=null;const result=await fn({get:async r=>{if(window.testOffline)throw Error('offline');return snapshot('hogar/estado')},update:(r,patch)=>{pending=patch},set:()=>{testSets++;throw Error('No full document replacement')}});if(pending){testState={...testState,...structuredClone(pending)};testWrites++}return result});testQueue=work.catch(()=>{});return work;
   }};
   window.firebase={initializeApp(){},firestore:()=>fs,auth:()=>({onAuthStateChanged:fn=>{setTimeout(()=>fn({uid:'test-only',email:'test@example.invalid'}),0)}})};
  });
  await p.route('https://**/*',r=>r.request().url().startsWith('https://www.gstatic.com/firebasejs/')?r.fulfill({contentType:'application/javascript',body:''}):r.abort());
  await p.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.CASA_FIREBASE={apiKey:"test-only",projectId:"test-only"}'}));
  await p.goto(`http://127.0.0.1:${server.address().port}/casa/`,{waitUntil:'domcontentloaded'});
  await p.waitForFunction(()=>dbRef&&base&&syncState==='ok');
  await p.evaluate(()=>{ui.view='compras';ui.ckTab='lista';ui.me='yo';render()});await p.waitForFunction(()=>MC);
  const text=await p.evaluate(()=>{
   const product=MC.p.map(prod).find(p=>p.price>0&&ticketLinePlan({name:p.name,units:1,unit:p.price,price:p.price},'Mercadona').confident);
   if(!product)throw Error('No suitable catalog fixture');
   const amount=product.price.toFixed(2).replace('.',','),d=today().split('-').reverse().join('/');
   window.testText='MERCADONA\n'+d+'\n1 '+product.name+' '+amount+'\nTOTAL '+amount;
   window.testFile=new File(['synthetic image bytes'],'receipt.jpg',{type:'image/jpeg'});
   pickFile=async()=>testFile;ocrText=async()=>({text:testText,confidence:99});return testText;
  });
  await p.evaluate(()=>ticketFlow());
  assert.equal(await p.evaluate(()=>testWrites),1);assert.equal(await p.evaluate(()=>testSets),0);assert.equal(await p.evaluate(()=>testState.buys.length),1);assert(await p.evaluate(()=>testServerReads>=3));
  const state=await p.evaluate(()=>JSON.stringify(testState));await p.evaluate(()=>ticketFlow());assert.equal(await p.evaluate(()=>JSON.stringify(testState)),state);assert.equal(await p.evaluate(()=>testWrites),1);
  await p.evaluate(()=>{testFile=new File(['other image'],'receipt.jpg',{type:'image/jpeg'});ocrText=async()=>({text:testText,confidence:40})});await p.evaluate(()=>ticketFlow());assert.equal(await p.evaluate(()=>testWrites),1);
  await p.evaluate(()=>{testFile=new File(['incomplete image'],'receipt.jpg',{type:'image/jpeg'});ocrText=async()=>({text:'1 UNKNOWN PRODUCT 1,00\nTOTAL 1,00',confidence:40})});await p.evaluate(()=>ticketFlow());
  assert(await p.getByRole('heading',{name:'Revisar tique',exact:true}).isVisible());await p.getByRole('button',{name:'Guardar y verificar',exact:true}).click();assert((await p.locator('#tkStatus').innerText()).includes('Falta'));assert.equal(await p.evaluate(()=>testWrites),1);await p.getByRole('button',{name:'+ Añadir artículo que falta',exact:true}).click();assert.equal(await p.locator('[data-on]').count(),2);await p.locator('[data-s=cancel]').click();
  await p.evaluate(()=>{testFile=new File([testText],'receipt.txt',{type:'text/plain'});ocrText=async()=>{throw Error('Text import must not invoke OCR')}});await p.evaluate(()=>ticketFlow());assert.equal(await p.evaluate(()=>testWrites),1);
  // Cancel while OCR is running must not save afterwards.
  await p.evaluate(()=>{testFile=new File(['cancel image'],'receipt.jpg',{type:'image/jpeg'});ocrText=()=>new Promise(r=>window.finishOCR=r);window.flowPromise=ticketFlow()});await p.waitForFunction(()=>!!window.finishOCR);await p.locator('[data-s=cancel]').click();await p.evaluate(()=>finishOCR({text:testText,confidence:99}));await p.evaluate(()=>flowPromise);assert.equal(await p.evaluate(()=>testWrites),1);
  // Regression: a genuinely new reviewed purchase previously sent a function as `at`.
  await p.evaluate(()=>{const t=parseTicket(testText);t.total*=2;t.lines[0].units*=2;t.lines[0].price*=2;ticketReview(prepareTicket(t),testText,{reasons:['Test review']})});
  await p.locator('#f_as').selectOption('__new');await p.getByRole('button',{name:'Guardar y verificar',exact:true}).click();await p.locator('.overlay').waitFor({state:'detached'});assert.equal(await p.evaluate(()=>testWrites),2);assert.equal(await p.evaluate(()=>typeof testState.buys.at(-1).at),'number');
  // Crop UI works locally and cancellation leaves the receipt unchanged.
  await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=800;c.height=1000;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,800,1000);ctx.fillStyle='#000';ctx.font='28px sans-serif';ctx.fillText('1 ARROZ 2,00',100,100);window.testImage=await new Promise(r=>c.toBlob(r));window.cropPromise=cropTicketImage(testImage)});
  await p.locator('.ticket-crop').waitFor();await p.getByText('Ajustar con controles',{exact:true}).click();await p.locator('#crop-left').fill('20');await p.locator('#crop-right').fill('80');await p.locator('#crop-top').fill('10');await p.locator('#crop-bottom').fill('90');await p.getByRole('button',{name:'Volver a leer',exact:true}).click();
  const dimensions=await p.evaluate(async()=>{const blob=await cropPromise,image=await createImageBitmap(blob);return [image.width,image.height]});assert.deepEqual(dimensions,[480,800]);
  await p.evaluate(()=>{window.cropPromise=cropTicketImage(testImage)});await p.locator('.ticket-crop').waitFor();await p.locator('[data-s=cancel]').click();assert.equal(await p.evaluate(()=>cropPromise),null);assert.equal(await p.evaluate(()=>testWrites),2);
  assert.deepEqual(errors,[]);console.log('PASS browser: real sync adapter uses update, not set; high-confidence auto-save; server reread; duplicate retry; review of incomplete data; add missing lines; cancel prevents saving. Firebase transport simulated.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exit(1)});
