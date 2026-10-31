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
   window.testProduct=product;testState.pantry=[{id:'existing-stock',mid:product.id,name:product.name,n:10,u:product.d==='ud'?'ud':product.fmt==='l'?'ml':'g',min:0,loc:'Despensa'}];testState.items=[{id:'bought',name:product.name,mid:product.id,listId:curList().id,done:false},{id:'other',name:'Unrelated item',listId:curList().id,done:false}];S=clone(testState);base=clone(testState);lastSaved=clone(S);
   window.testFile=new File(['synthetic image bytes'],'receipt.jpg',{type:'image/jpeg'});
   pickFile=async()=>testFile;ocrText=async()=>({text:testText,confidence:99});return testText;
  });
  async function confirmTranscription(){await p.getByRole('button',{name:'Preparar compra',exact:true}).click();await p.getByRole('button',{name:'Guardar y verificar',exact:true}).click();await p.locator('.overlay').waitFor({state:'detached'})}
  await p.evaluate(()=>ticketFlow());
  assert.equal(await p.evaluate(()=>testWrites),0);assert(await p.locator('#tkTranscript').isVisible());assert.equal(await p.locator('#tkTranscript').inputValue(),text);
  await confirmTranscription();
  assert.equal(await p.evaluate(()=>testWrites),1);assert.equal(await p.evaluate(()=>testSets),0);assert.equal(await p.evaluate(()=>testState.buys.length),1);assert(await p.evaluate(()=>testServerReads>=2));assert.equal(await p.evaluate(()=>testState.pantry.length),1);assert(await p.evaluate(()=>testState.pantry[0].n>10));assert.equal(await p.evaluate(()=>testState.items.length),1);assert.equal(await p.evaluate(()=>testState.items[0].id),'other');
  const state=await p.evaluate(()=>JSON.stringify(testState));await p.evaluate(()=>ticketFlow());await confirmTranscription();assert.equal(await p.evaluate(()=>JSON.stringify(testState)),state);assert.equal(await p.evaluate(()=>testWrites),1);
  await p.evaluate(()=>{testFile=new File(['other image'],'receipt.jpg',{type:'image/jpeg'});ocrText=async()=>({text:testText,confidence:40})});await p.evaluate(()=>ticketFlow());assert.equal(await p.evaluate(()=>testWrites),1);await p.locator('[data-s=cancel]').click();
  await p.evaluate(()=>{testFile=new File(['incomplete image'],'receipt.jpg',{type:'image/jpeg'});ocrText=async()=>({text:'1 UNKNOWN PRODUCT 1,00\nTOTAL 1,00',confidence:40})});await p.evaluate(()=>ticketFlow());
  assert(await p.locator('#tkTranscript').isVisible());await p.getByRole('button',{name:'Preparar compra',exact:true}).click();await p.getByRole('button',{name:'Guardar y verificar',exact:true}).click();assert((await p.locator('#tkStatus').innerText()).includes('Falta'));assert.equal(await p.evaluate(()=>testWrites),1);await p.getByRole('button',{name:'+ Añadir artículo que falta',exact:true}).click();assert.equal(await p.locator('[data-on]').count(),2);await p.getByRole('button',{name:'Corregir transcripción',exact:true}).click();await p.locator('#tkTranscript').fill(text);await confirmTranscription();assert.equal(await p.evaluate(()=>testWrites),1);
  await p.evaluate(()=>{testFile=new File([testText],'receipt.txt',{type:'text/plain'});ocrText=async()=>{throw Error('Text import must not invoke OCR')}});await p.evaluate(()=>ticketFlow());assert.equal(await p.evaluate(()=>testWrites),1);await p.locator('[data-s=cancel]').click();
  // Image OCR may read a price without its quantity: require an explicit value.
  await p.evaluate(()=>{testFile=new File(['quantity image'],'receipt.jpg',{type:'image/jpeg'});ocrText=async()=>({text:testText.replace(/\n1 /,'\n'),confidence:99,engine:'rapidocr-ppocrv4-web',lines:[]})});
  await p.evaluate(()=>ticketFlow());await p.getByRole('button',{name:'Preparar compra',exact:true}).click();assert.equal(await p.locator('[data-units="0"]').inputValue(),'');await p.getByRole('button',{name:'Guardar y verificar',exact:true}).click();assert((await p.locator('#tkStatus').innerText()).includes('incompleta'));assert.equal(await p.evaluate(()=>testWrites),1);await p.locator('[data-units="0"]').fill('1');await p.locator('[data-s=cancel]').click();
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
  const preparedImage=await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=800;c.height=1000;const ctx=c.getContext('2d');ctx.fillStyle='rgb(150,110,70)';ctx.fillRect(0,0,800,1000);ctx.fillStyle='#eee';ctx.fillRect(180,0,440,1000);ctx.fillStyle='#111';ctx.font='28px sans-serif';ctx.fillText('TEST RECEIPT',220,100);const b=await new Promise(r=>c.toBlob(r)),result=await CasaReceiptImage.prepare(b);return {bounds:result.bounds,width:result.width,height:result.height,hasNormalized:result.normalized.size>0}});assert(preparedImage.bounds.left>0);assert(preparedImage.bounds.right<1);assert(preparedImage.hasNormalized);assert.equal(preparedImage.height,1000);
  // History photo survives a fresh IndexedDB connection; undo uses the real transaction adapter.
  const archived=await p.evaluate(async()=>{const b=testState.buys[0],file=await ReceiptArchive.get(b.imageHash);return {exists:!!file,bytes:file?await file.text():''}});assert(archived.exists);assert.equal(archived.bytes,'synthetic image bytes');
  await p.evaluate(()=>buyDetail(testState.buys.at(-1)));await p.getByRole('button',{name:'Deshacer importación',exact:true}).click();await p.getByRole('button',{name:'Deshacer compra',exact:true}).click();await p.waitForFunction(()=>testState.buys.at(-1).voided===true);assert.equal(await p.evaluate(()=>testWrites),3);assert.equal(await p.evaluate(()=>testState.buys.at(-1).total),0);
  const learned=await p.evaluate(()=>{const old=S.cook;S.cook={...old,receiptAliases:{'mercadona|abreviatura':{name:'Producto corregido'}}};const t={store:'Mercadona',lines:[{name:'ABREVIATURA',units:1,unit:1,price:1}]};const corrected=prepareTicket(t).lines[0];S.cook=old;return corrected.name});assert.equal(learned,'Producto corregido');
  await p.evaluate(()=>{const t=prepareTicket(parseTicket(testText));t.lines[0].readConfidence=.6;t.lines[0].readBox=[.1,.05,.8,.2];t.ocrLines=[{text:'test'}];ticketReview(t,testText,{file:testImage})});await p.waitForFunction(()=>document.querySelector('[data-doubt-preview]')?.width===800);assert(await p.locator('[data-receipt-row]').evaluate(el=>el.open));await p.locator('[data-s=cancel]').last().click();
  assert.deepEqual(errors,[]);console.log('PASS browser: real sync adapter uses update, not set; editable transcription before all writes; inventory/list update; server reread; duplicate retry; review of incomplete data; add missing lines; cancel prevents saving. Firebase transport simulated.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exit(1)});
