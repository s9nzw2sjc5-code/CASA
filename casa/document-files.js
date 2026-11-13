/* PDF y fotos privados: partes inmutables fuera de hogar/estado, con verificación SHA-256. */
(function(root){
 'use strict';
 const MAX_BYTES=5*1024*1024,PART_BYTES=192*1024,PREFIX='hogar/estado/documentos/';
 const validId=id=>/^[a-f0-9]{64}$/.test(id||'');
 const path=id=>{if(!validId(id))throw Error('Referencia de archivo no válida.');return PREFIX+id};
 const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
 function base64(bytes){let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text)}
 function decode(text){const raw=atob(text),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes}
 function pdf(bytes){return bytes.length>=12&&/^%PDF-[12]\.[0-9]/.test(String.fromCharCode(...bytes.subarray(0,8)))&&String.fromCharCode(...bytes.subarray(Math.max(0,bytes.length-2048))).includes('%%EOF')}
 const jpeg=bytes=>bytes.length>=12&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217;
 const supported=mime=>['application/pdf','image/jpeg'].includes(mime);
 const validContent=(bytes,mime)=>mime==='application/pdf'?pdf(bytes):mime==='image/jpeg'&&jpeg(bytes);
 async function prepare(file){
  if(!file||!(file.size>0)||file.size>MAX_BYTES)throw Error('Elige un PDF o una foto de hasta 5 MB.');
  const mime=/\.pdf$/i.test(file.name||'')?'application/pdf':/\.jpe?g$/i.test(file.name||'')?'image/jpeg':'';
  if(!supported(mime)||file.type&&!['application/octet-stream',mime].includes(file.type))throw Error('Elige un PDF o una foto en JPG.');
  const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.length!==file.size||!validContent(bytes,mime))throw Error(mime==='application/pdf'?'El archivo no contiene un PDF válido.':'El archivo no contiene una foto válida.');
  const hash=await digest(bytes),count=Math.ceil(bytes.length/PART_BYTES),manifest={version:1,hash,size:bytes.length,count,partBytes:PART_BYTES,mime};
  const entries=[{path:path(hash),data:manifest}];for(let i=0;i<count;i++)entries.push({path:path(hash)+'/partes/'+i,data:{version:1,index:i,content:base64(bytes.subarray(i*PART_BYTES,(i+1)*PART_BYTES))}});
  return {hash,size:bytes.length,count,mime,entries};
 }
 function sameRecord(a,b){return !!a&&!!b&&Object.keys(a).length===Object.keys(b).length&&Object.keys(b).every(k=>a[k]===b[k])}
 function validate(entries){
  if(!Array.isArray(entries)||entries.length<2||entries.length>29)throw Error('El archivo no tiene una estructura válida.');
  const m=entries[0].data;if(!m||Object.keys(m).sort().join(',')!=='count,hash,mime,partBytes,size,version'||!validId(m.hash)||m.version!==1||!supported(m.mime)||!Number.isInteger(m.size)||m.size<5||m.size>MAX_BYTES||m.partBytes!==PART_BYTES||m.count!==Math.ceil(m.size/PART_BYTES)||entries.length!==m.count+1||entries[0].path!==path(m.hash))throw Error('El archivo no tiene una estructura válida.');
  for(let i=0;i<m.count;i++){const e=entries[i+1],data=e.data,length=Math.min(PART_BYTES,m.size-i*PART_BYTES);if(e.path!==path(m.hash)+'/partes/'+i||!data||Object.keys(data).sort().join(',')!=='content,index,version'||data.version!==1||data.index!==i||typeof data.content!=='string'||data.content.length!==4*Math.ceil(length/3)||!/^[A-Za-z0-9+/]*={0,2}$/.test(data.content))throw Error('Una parte del archivo no es válida.')}
  return m;
 }
 // Reads precede every write, including retries. Existing records are immutable.
 async function commit(db,entries){
  const manifest=validate(entries);await assemble(manifest,entries.slice(1).map(e=>e.data));return db.runTransaction(async transaction=>{
   const refs=entries.map(e=>db.doc(e.path)),snapshots=await Promise.all(refs.map(ref=>transaction.get(ref)));
   snapshots.forEach((snap,i)=>{if(snap.exists&&!sameRecord(snap.data(),entries[i].data))throw Error('Ya existe un archivo distinto con esa referencia. No se ha sobrescrito.');});
   snapshots.forEach((snap,i)=>{if(!snap.exists)transaction.set(refs[i],entries[i].data)});
   return {created:snapshots.filter(s=>!s.exists).length,hash:entries[0].data.hash};
  });
 }
 async function assemble(manifest,parts){
  if(!manifest||!validId(manifest.hash)||manifest.version!==1||!supported(manifest.mime)||manifest.partBytes!==PART_BYTES||!Number.isInteger(manifest.size)||manifest.size<5||manifest.size>MAX_BYTES||manifest.count!==Math.ceil(manifest.size/PART_BYTES)||parts.length!==manifest.count)throw Error('El archivo está incompleto. Vuelve a intentarlo con conexión.');
  const bytes=new Uint8Array(manifest.size);for(let i=0;i<parts.length;i++){const part=parts[i];if(!part||part.version!==1||part.index!==i||typeof part.content!=='string')throw Error('Falta una parte del archivo.');const chunk=decode(part.content),expected=Math.min(PART_BYTES,manifest.size-i*PART_BYTES);if(chunk.length!==expected)throw Error('El archivo está incompleto.');bytes.set(chunk,i*PART_BYTES)}
  if(!validContent(bytes,manifest.mime)||await digest(bytes)!==manifest.hash)throw Error('No se ha podido verificar el contenido del archivo.');return new Blob([bytes],{type:manifest.mime});
 }
 async function read(db,id){
  const location=path(id),snap=await db.doc(location).getServer();if(!snap.exists)throw Error('No se encuentra este archivo en la casa.');
  const manifest=snap.data();if(!manifest||manifest.hash!==id||!Number.isInteger(manifest.count)||manifest.count<1||manifest.count>28)throw Error('La referencia del archivo no es válida.');
  const chunks=await Promise.all(Array.from({length:manifest.count},(_,i)=>db.doc(location+'/partes/'+i).getServer()));return assemble(manifest,chunks.map(s=>s.exists?s.data():null));
 }
 const api={MAX_BYTES,PART_BYTES,digest,path,prepare,validate,sameRecord,commit,assemble,read};root.CasaDocumentFiles=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
