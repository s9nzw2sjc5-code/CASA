// Real OCR benchmark. Private photos and results stay outside the repository.
// node tests/receipt-ocr-quality.cjs photo.jpg reference.json /tmp/result.json
// reference: {store,date,total,lines:[{name,units,price,kg?}]}
// Exit 2 means at least one simulated condition missed the exact quality gate.
const {chromium,request}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const R=require('../casa/receipts.js');
const [photo,reference,report]=process.argv.slice(2);
if(!photo||!reference||!report)throw Error('Indica foto, referencia JSON y ruta del informe.');
const expected=JSON.parse(fs.readFileSync(reference,'utf8'));
if(!R.validate(expected).ok)throw Error('La referencia debe contener fecha, comercio y artículos que sumen el total.');
const root=path.resolve(__dirname,'..');
const insideRepo=file=>{const relative=path.relative(root,path.resolve(file));return !relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)};
if([photo,reference,report].some(insideRepo))throw Error('Guarda fotos, referencias e informes privados fuera del repositorio público.');
(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://test').pathname),file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return}res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.wasm':'application/wasm','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(data)});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser,api;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  api=await request.newContext(process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY}}:{});
  const page=await browser.newPage({serviceWorkers:'block'});
  await page.route('https://**/*',async route=>{
   if(new URL(route.request().url()).hostname!=='cdn.jsdelivr.net'){await route.abort();return}
   const response=await api.get(route.request().url());await route.fulfill({response});
  });
  await page.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.claude={use:async()=>null}'}));
  await page.goto(`http://127.0.0.1:${server.address().port}/casa/`,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{const input=document.createElement('input');input.type='file';input.id='benchmark-photo';document.body.appendChild(input)});
  await page.locator('#benchmark-photo').setInputFiles(photo);
  const results=[];
  for(const condition of ['original','mas-luz','menos-luz','arrugas-simuladas']){
   const result=await page.evaluate(async condition=>{
    let photo=document.querySelector('#benchmark-photo').files[0];
    if(condition!=='original'){
     const image=await createImageBitmap(photo),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
     const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
     if(condition==='arrugas-simuladas'){
      // Mild displacement and crease shadows; no replacement text or numbers.
      for(let y=0;y<canvas.height;y+=2){const shift=Math.sin(y/170)*canvas.width*.003;ctx.drawImage(image,0,y,canvas.width,Math.min(2,canvas.height-y),shift,y,canvas.width,Math.min(2,canvas.height-y))}
      const crease=ctx.createLinearGradient(canvas.width*.45,0,canvas.width*.55,0);crease.addColorStop(0,'#0000');crease.addColorStop(.45,'#0003');crease.addColorStop(.55,'#fff2');crease.addColorStop(1,'#0000');ctx.fillStyle=crease;ctx.fillRect(0,0,canvas.width,canvas.height);
     }else{ctx.filter=`brightness(${condition==='mas-luz'?1.2:.55})`;ctx.drawImage(image,0,0)}
     image.close();photo=await new Promise(r=>canvas.toBlob(r,'image/png'));
    }
    const start=performance.now(),ocr=await ocrText(photo,()=>{}),parsed=receiptFromText(ocr.text,ocr);
    return {condition,elapsedMs:Math.round(performance.now()-start),ocr,parsed,validation:CasaReceipts.validate(parsed)};
   },condition);
   const actual=result.parsed;
   const sameLine=(a,b)=>!!a&&R.norm(a.name)===R.norm(b.name)&&R.cents(a.price)===R.cents(b.price)&&Number(a.units)===Number(b.units)&&Number(a.kg||0)===Number(b.kg||0);
   result.exactLinesAtPosition=expected.lines.filter((line,i)=>sameLine(actual.lines[i],line)).length;
   const dp=Array.from({length:expected.lines.length+1},()=>new Uint16Array(actual.lines.length+1));
   for(let i=1;i<=expected.lines.length;i++)for(let j=1;j<=actual.lines.length;j++)dp[i][j]=sameLine(actual.lines[j-1],expected.lines[i-1])?dp[i-1][j-1]+1:Math.max(dp[i-1][j],dp[i][j-1]);
   result.exactLinesInOrder=dp[expected.lines.length][actual.lines.length];
   result.exact=actual.lines.length===expected.lines.length&&result.exactLinesAtPosition===expected.lines.length&&R.norm(actual.store)===R.norm(expected.store)&&actual.date===expected.date&&R.cents(actual.total)===R.cents(expected.total)&&result.validation.ok;
   results.push(result);
   fs.writeFileSync(report,JSON.stringify({appVersion:R.version,syntheticConditions:true,reference:expected,results},null,2));
   console.log(`${condition}: ${result.exactLinesInOrder}/${expected.lines.length} líneas exactas en orden; total ${actual.total}; ${result.exact?'PASS':'FAIL'}`);
  }
  if(results.some(r=>!r.exact))process.exitCode=2;
 }finally{if(api)await api.dispose();if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
