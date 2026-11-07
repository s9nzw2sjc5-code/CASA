// Regression for an external/private photo: node tests/product-photo-case.cjs /tmp/photo.jpg expected-product-id
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


  const photo=process.argv[2],expected=process.argv[3];if(!photo||!expected)throw Error('Indica foto fuera del repositorio y producto esperado');const rel=path.relative(root,path.resolve(photo));if(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel))throw Error('La foto privada debe estar fuera del repositorio');
  await p.evaluate(async()=>{await loadMC();ui.view='compras';ui.ckTab='lista';ui.me='yo';ui.list='super';render()});
  await p.locator('[data-act="shopPhoto"]').click();await p.locator('#productLibrary').setInputFiles(photo);await p.waitForFunction(id=>document.querySelector(`#productPhotoResults [value="${id}"]`),expected,{timeout:180000});
  assert.equal(await p.evaluate(()=>S.items.length),0);assert.equal(await p.locator('[name=photoProduct]:checked').count(),0);assert(await p.locator('#productPhotoCrop').isVisible());assert(await p.locator('.overlay [data-s=ok]').isDisabled());
  await p.screenshot({path:'/tmp/casa-photo-case-review.png'});await p.locator(`[name=photoProduct][value="${expected}"]`).check();await p.locator('.overlay [data-s=ok]').click();assert.equal(await p.evaluate(()=>S.items[0].mid),expected);assert.equal(await p.evaluate(()=>S.items[0].units),1);
  assert.deepEqual(errors,[]);console.log('PASS: real local OCR from the supplied photo proposes the expected product, waits for confirmation and adds one requested unit. No Firebase.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
