// Actual OCR benchmark, no mocked recognition. Images and reports stay outside Git.
// node tests/product-photo-quality.cjs /tmp/manifest.json /tmp/report.json
// manifest: {photos:[{file:'/tmp/photo.jpg',expectedIds:['5044'],source:'https://...'}]}
// Exit 2 = any positive example missing its expected product in the suggestions.
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const [manifest,report]=process.argv.slice(2),root=path.resolve(__dirname,'..');
if(!manifest||!report)throw Error('Indica manifest e informe fuera del repositorio.');
const fixtures=JSON.parse(fs.readFileSync(manifest,'utf8')).photos;
for(const file of [manifest,report,...fixtures.map(f=>f.file)]){const rel=path.relative(root,path.resolve(file));if(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel))throw Error('Fotos e informes fuera del repositorio público.');}
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://test').pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.wasm':'application/wasm'})[path.extname(file)]||'application/octet-stream');res.end(data)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const p=await browser.newPage({serviceWorkers:'block'});await p.route('https://**/*',r=>r.abort());await p.route('**/config.js*',r=>r.fulfill({contentType:'application/javascript',body:'window.claude={use:async()=>null}'}));await p.goto(`http://127.0.0.1:${server.address().port}/casa/index.html`,{waitUntil:'domcontentloaded'});await p.evaluate(()=>{const i=document.createElement('input');i.id='benchmark';i.type='file';document.body.appendChild(i)});await p.evaluate(()=>loadMC());
  const results=[];
  for(const photo of fixtures){
   await p.locator('#benchmark').setInputFiles(photo.file);
   for(const condition of photo.conditions||['original','mas-luz','menos-luz','giro-25','giro-menos-25','giro-90','perspectiva','reflejo','desenfoque']){
    const result=await p.evaluate(async condition=>{
     const file=document.querySelector('#benchmark').files[0],image=await createImageBitmap(file),c=document.createElement('canvas'),angle=condition==='giro-25'?25:condition==='giro-menos-25'?-25:condition==='giro-90'?90:0;
     const max=Math.max(image.width,image.height),pad=angle?Math.round(max*.5):0;c.width=image.width+pad;c.height=image.height+pad;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
     x.save();x.translate(c.width/2,c.height/2);x.rotate(angle*Math.PI/180);x.filter=condition==='mas-luz'?'brightness(1.4)':condition==='menos-luz'?'brightness(.4)':condition==='desenfoque'?'blur(2px)':'none';
     if(condition==='perspectiva'){for(let y=0;y<image.height;y++){const w=image.width*(.65+.35*y/image.height);x.drawImage(image,0,y,image.width,1,-w/2,y-image.height/2,w,1)}}else x.drawImage(image,-image.width/2,-image.height/2);x.restore();image.close();
     if(condition==='reflejo'){const g=x.createLinearGradient(0,0,c.width,0);g.addColorStop(0,'#fff0');g.addColorStop(.5,'#fffb');g.addColorStop(1,'#fff0');x.fillStyle=g;x.fillRect(0,0,c.width,c.height)}
     const blob=await new Promise(r=>c.toBlob(r,'image/png')),start=performance.now();
     try{const ocr=await CasaReceiptOCR.read(blob,()=>{},{kind:'product'}),match=CasaProductPhoto.rank(ocr,MC.p);return {condition,elapsedMs:Math.round(performance.now()-start),text:ocr.text,lines:ocr.lines,candidates:match.candidates.map(a=>({id:a.id,name:MC.byId.get(a.id)[1],score:a.score})),requiresConfirmation:match.needsConfirmation}}
     catch(e){return {condition,error:e.message,candidates:[]}}
    },condition);
    result.source=photo.source;result.file=photo.file;result.expectedIds=photo.expectedIds;result.expectNoCandidates=!!photo.expectNoCandidates;result.expectedRank=photo.expectNoCandidates?null:result.candidates.findIndex(c=>photo.expectedIds.includes(c.id))+1||null;result.firstChoiceCorrect=result.expectedRank===1;result.foundExpected=photo.expectNoCandidates?!result.error&&result.candidates.length===0:result.expectedRank!==null;results.push(result);
    fs.writeFileSync(report,JSON.stringify({syntheticConditions:true,autoAdds:false,photos:fixtures.length,results},null,2));console.log(path.basename(photo.file),condition,result.foundExpected?(photo.expectNoCandidates?'REJECTED AS EXPECTED':'EXPECTED SUGGESTION FOUND'):'MISS',result.candidates.slice(0,3).map(c=>c.name).join(' | '));
   }
  }
  if(results.some(r=>!r.foundExpected))process.exitCode=2;
 }finally{await browser?.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
