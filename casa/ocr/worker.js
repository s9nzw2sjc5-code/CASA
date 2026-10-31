/* OCR local para CASA. Pipeline adaptado de RapidOCR 1.4.4/PaddleOCR.
 * Copyright PaddlePaddle Authors and RapidAI contributors, Apache-2.0.
 * Consulte THIRD_PARTY.md. Las imágenes nunca salen de este worker. */
'use strict';
importScripts('vendor/ort.wasm.min.js','vendor/opencv.js','vendor/clipper.js');

const send=(percent,stage)=>postMessage({type:'progress',percent,stage});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const order=points=>{
  const p=points.slice().sort((a,b)=>a.x-b.x),left=p.slice(0,2).sort((a,b)=>a.y-b.y),right=p.slice(2).sort((a,b)=>a.y-b.y);
  return [left[0],right[0],right[1],left[1]];
};
function rectPoints(rect){
  const angle=rect.angle*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),w=rect.size.width/2,h=rect.size.height/2;
  return order([[-w,-h],[w,-h],[w,h],[-w,h]].map(([x,y])=>({x:rect.center.x+x*c-y*s,y:rect.center.y+x*s+y*c})));
}
function mini(points){
  const mat=cv.matFromArray(points.length,1,cv.CV_32FC2,points.flatMap(p=>[p.x,p.y]));
  try{const r=cv.minAreaRect(mat);return {points:rectPoints(r),side:Math.min(r.size.width,r.size.height)}}finally{mat.delete()}
}
function expand(points){
  const path=points.map(p=>({X:Math.trunc(p.x),Y:Math.trunc(p.y)})),area=Math.abs(ClipperLib.Clipper.Area(path));
  const perimeter=points.reduce((sum,p,i)=>sum+distance(p,points[(i+1)%4]),0);
  const offset=new ClipperLib.ClipperOffset(),solution=new ClipperLib.Paths();
  offset.AddPath(path,ClipperLib.JoinType.jtRound,ClipperLib.EndType.etClosedPolygon);
  offset.Execute(solution,area*1.6/Math.max(perimeter,1));
  if(solution.length!==1)return null;
  return mini(solution[0].map(p=>({x:p.X,y:p.Y})));
}
function boxScore(map,width,height,points){
  const x0=clamp(Math.floor(Math.min(...points.map(p=>p.x))),0,width-1),x1=clamp(Math.ceil(Math.max(...points.map(p=>p.x))),0,width-1);
  const y0=clamp(Math.floor(Math.min(...points.map(p=>p.y))),0,height-1),y1=clamp(Math.ceil(Math.max(...points.map(p=>p.y))),0,height-1);
  const mask=cv.Mat.zeros(y1-y0+1,x1-x0+1,cv.CV_8UC1),poly=cv.matFromArray(4,1,cv.CV_32SC2,points.flatMap(p=>[Math.trunc(p.x-x0),Math.trunc(p.y-y0)])),polys=new cv.MatVector();
  polys.push_back(poly);
  try{
    cv.fillPoly(mask,polys,new cv.Scalar(1));let score=0,n=0;
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(mask.data[(y-y0)*mask.cols+x-x0]){score+=map[y*width+x];n++}
    return score/Math.max(n,1);
  }finally{polys.delete();poly.delete();mask.delete()}
}
function boxesFromMap(map,width,height,image){
  const mask=new cv.Mat(height,width,cv.CV_8UC1),dilated=new cv.Mat(),kernel=cv.Mat.ones(2,2,cv.CV_8UC1),contours=new cv.MatVector(),hierarchy=new cv.Mat(),boxes=[];
  try{
    for(let i=0;i<map.length;i++)mask.data[i]=map[i]>.3?255:0;
    cv.dilate(mask,dilated,kernel);cv.findContours(dilated,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
    for(let i=0;i<Math.min(contours.size(),1000);i++){
      const contour=contours.get(i);let r;try{const rect=cv.minAreaRect(contour);r={points:rectPoints(rect),side:Math.min(rect.size.width,rect.size.height)}}finally{contour.delete()}
      if(r.side<3||boxScore(map,width,height,r.points)<.5)continue;
      r=expand(r.points);if(!r||r.side<5)continue;
      const points=r.points.map(p=>({x:clamp(Math.round(p.x/width*image.cols),0,image.cols-1),y:clamp(Math.round(p.y/height*image.rows),0,image.rows-1)}));
      if(distance(points[0],points[1])<=3||distance(points[0],points[3])<=3)continue;
      boxes.push(points);
    }
    boxes.sort((a,b)=>a[0].y-b[0].y||a[0].x-b[0].x);
    for(let i=0;i<boxes.length-1;i++)for(let j=i;j>=0;j--){if(Math.abs(boxes[j+1][0].y-boxes[j][0].y)<10&&boxes[j+1][0].x<boxes[j][0].x)[boxes[j],boxes[j+1]]=[boxes[j+1],boxes[j]];else break}
    return boxes;
  }finally{hierarchy.delete();contours.delete();kernel.delete();dilated.delete();mask.delete()}
}
function normalized(image,width,height=48,stretch=false){
  const resized=new cv.Mat(),actual=stretch?width:Math.min(width,Math.ceil(height*image.cols/image.rows)),plane=width*height,result=new Float32Array(3*plane);
  try{
    cv.resize(image,resized,new cv.Size(actual,height),0,0,cv.INTER_LINEAR);
    for(let y=0;y<height;y++)for(let x=0;x<actual;x++)for(let c=0;c<3;c++)result[c*plane+y*width+x]=(resized.data[(y*actual+x)*3+c]/255-.5)/.5;
    return result;
  }finally{resized.delete()}
}
async function run(session,data,dims){
  const tensor=new ort.Tensor('float32',data,dims);
  try{const out=await session.run({[session.inputNames[0]]:tensor});return out[session.outputNames[0]]}finally{tensor.dispose()}
}
async function detect(image,session){
  const ratio=Math.min(image.rows,image.cols)<736?736/Math.min(image.rows,image.cols):1;
  const height=Math.max(32,Math.round(Math.trunc(image.rows*ratio)/32)*32),width=Math.max(32,Math.round(Math.trunc(image.cols*ratio)/32)*32),data=normalized(image,width,height,true);
  const output=await run(session,data,[1,3,height,width]);
  try{return boxesFromMap(output.data,output.dims[3],output.dims[2],image)}finally{output.dispose()}
}
function crop(image,points){
  const width=Math.max(4,Math.trunc(Math.max(distance(points[0],points[1]),distance(points[2],points[3])))),height=Math.max(4,Math.trunc(Math.max(distance(points[0],points[3]),distance(points[1],points[2]))));
  const from=cv.matFromArray(4,1,cv.CV_32FC2,points.flatMap(p=>[p.x,p.y])),to=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,width,0,width,height,0,height]),transform=cv.getPerspectiveTransform(from,to),out=new cv.Mat();
  try{
    cv.warpPerspective(image,out,transform,new cv.Size(width,height),cv.INTER_CUBIC,cv.BORDER_REPLICATE);
    if(height/width>=1.5){const rotated=new cv.Mat();cv.rotate(out,rotated,cv.ROTATE_90_COUNTERCLOCKWISE);out.delete();return rotated}
    return out;
  }catch(e){out.delete();throw e}finally{transform.delete();from.delete();to.delete()}
}
async function classify(images,session){
  for(let start=0;start<images.length;start+=6){
    const group=images.slice(start,start+6),size=3*48*192,data=new Float32Array(group.length*size);
    group.forEach((im,i)=>data.set(normalized(im,192),i*size));
    const output=await run(session,data,[group.length,3,48,192]);
    try{group.forEach((im,i)=>{if(output.data[i*2+1]>.9){const rotated=new cv.Mat();cv.rotate(im,rotated,cv.ROTATE_180);im.delete();images[start+i]=rotated}})}finally{output.dispose()}
  }
}
function decode(data,steps,classes,offset,characters){
  let previous=-1,text='',confidence=0,count=0;const tokens=[];
  for(let step=0;step<steps;step++){
    const base=offset+step*classes;let best=0,score=data[base];
    for(let c=1;c<classes;c++)if(data[base+c]>score){score=data[base+c];best=c}
    if(best&&best!==previous){const char=characters[best]||'';text+=char;confidence+=score;count++;tokens.push({char,step,confidence:score})}previous=best;
  }
  return {text,confidence:confidence/Math.max(count,1),tokens};
}
async function recognize(images,session,characters){
  const indices=images.map((_,i)=>i).sort((a,b)=>images[a].cols/images[a].rows-images[b].cols/images[b].rows),results=new Array(images.length);
  for(let start=0;start<indices.length;start+=6){
    const group=indices.slice(start,start+6),ratio=Math.max(320/48,...group.map(i=>images[i].cols/images[i].rows)),width=Math.min(2048,Math.trunc(48*ratio)),size=3*48*width,data=new Float32Array(group.length*size);
    group.forEach((index,i)=>data.set(normalized(images[index],width),i*size));
    const output=await run(session,data,[group.length,3,48,width]);
    try{const [batch,steps,classes]=output.dims;for(let i=0;i<batch;i++)results[group[i]]=decode(output.data,steps,classes,i*steps*classes,characters)}finally{output.dispose()}
    send(35+Math.round((start+group.length)/indices.length*60),'Reconociendo productos e importes');
  }
  return results;
}
onmessage=async event=>{
  const sessions=[],crops=[];let image,rgba;
  try{
    send(3,'Preparando lector de tickets');
    await new Promise(resolve=>{if(cv.Mat)resolve();else cv.onRuntimeInitialized=()=>resolve()});
    ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=new URL('vendor/',self.location.href).href;ort.env.logLevel='error';
    for(const name of ['det','cls','rec']){
      sessions.push(await ort.InferenceSession.create(new URL('models/'+name+'.onnx',self.location.href).href,{executionProviders:['wasm'],graphOptimizationLevel:'all'}));
      send(5+sessions.length*5,'Cargando lector de tickets');
    }
    const response=await fetch(new URL('models/characters.json',self.location.href));if(!response.ok)throw Error('No se pudo cargar el vocabulario');
    const characters=['blank',...await response.json(),' '];
    const {width,height,buffer}=event.data;
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>16000000||buffer.byteLength!==width*height*4)throw Error('Imagen demasiado grande o no válida');
    rgba=cv.matFromImageData({width,height,data:new Uint8ClampedArray(buffer)});image=new cv.Mat();cv.cvtColor(rgba,image,cv.COLOR_RGBA2BGR);rgba.delete();rgba=null;
    const scale=Math.min(1,2000/Math.max(width,height));
    if(scale<1){const resized=new cv.Mat();cv.resize(image,resized,new cv.Size(Math.trunc(width*scale),Math.trunc(height*scale)),0,0,cv.INTER_LINEAR);image.delete();image=resized}
    send(23,'Localizando líneas del ticket');const boxes=await detect(image,sessions[0]);
    if(boxes.length>400)throw Error('Hay demasiado texto. Recorta la foto para que solo aparezca el ticket.');
    for(const box of boxes)crops.push(crop(image,box));
    send(30,'Comprobando orientación del texto');await classify(crops,sessions[1]);
    const recognized=await recognize(crops,sessions[2],characters),words=[];
    for(let i=0;i<recognized.length;i++){const r=recognized[i];if(r.confidence>=.5&&r.text.trim())words.push({...r,box:boxes[i].map(p=>[p.x/image.cols,p.y/image.rows])})}
    send(98,'Preparando transcripción');postMessage({type:'result',words,engine:'rapidocr-ppocrv4-web',width:image.cols,height:image.rows});
  }catch(e){postMessage({type:'error',message:e?.message||'No se ha podido reconocer la foto'})}
  finally{for(const im of crops)im.delete();image?.delete();rgba?.delete();for(const session of sessions)await session.release()}
};
