/* Reconstruye filas conservando geometría, texto y confianza de cada lectura. */
(function(root){
  'use strict';
  const median=values=>{const a=values.slice().sort((a,b)=>a-b);return a.length?a[Math.floor(a.length/2)]:0};
  function compose(words){
    const boxes=words.filter(w=>w.text.trim()).map(w=>{
      const left=(w.box[0][0]+w.box[3][0])/2,right=(w.box[1][0]+w.box[2][0])/2,top=(w.box[0][1]+w.box[1][1])/2,bottom=(w.box[2][1]+w.box[3][1])/2;
      return {...w,x:Math.min(...w.box.map(p=>p[0])),cx:(left+right)/2,rawY:(top+bottom)/2,h:Math.max(.001,bottom-top),width:right-left,angle:right>left?((w.box[1][1]+w.box[2][1]-w.box[0][1]-w.box[3][1])/2)/(right-left):0};
    }),long=boxes.filter(w=>(w.text.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/g)||[]).length>=3&&w.width>.08&&Math.abs(w.angle)<.25);
    // Comparar centros Y sin compensar la inclinación cruza las columnas:
    // un importe puede acabar junto al nombre de la fila anterior.
    const moneyBoxes=boxes.filter(w=>/^-?\d+[.,]\d{2}$/.test(w.text)),medianAngle=median(long.map(w=>w.angle)),trustAngle=moneyBoxes.length<3||Math.abs(median(moneyBoxes.map(w=>w.angle))-medianAngle)<.02;
    const tilt=long.length>=3&&trustAngle?medianAngle:0,rows=[];
    const description=boxes.find(w=>/^descripci[oó]n\b/i.test(w.text)),heading=description&&boxes.filter(w=>/^imp(?:orte|[.\s(])/i.test(w.text)&&w.cx>description.cx&&Math.abs(w.rawY-description.rawY)<.06).sort((a,b)=>Math.abs(a.rawY-description.rawY)-Math.abs(b.rawY-description.rawY))[0];
    const total=description&&boxes.filter(w=>/^total(?:\s+a\s+pagar)?[\s()€e∈.]*$/i.test(w.text)&&w.rawY>description.rawY+.1).sort((a,b)=>a.rawY-b.rawY)[0],totalPrice=total&&moneyBoxes.filter(w=>w.cx>total.cx+.04&&Math.abs(w.rawY-total.rawY)<Math.max(w.h,total.h)*.75).sort((a,b)=>Math.abs(a.rawY-total.rawY)-Math.abs(b.rawY-total.rawY))[0];
    const headerTilt=heading?(heading.rawY-description.rawY)/(heading.cx-description.cx):NaN,footerTilt=totalPrice?(totalPrice.rawY-total.rawY)/(totalPrice.cx-total.cx):NaN;
    // El papel puede curvarse: las pendientes de los recuadros del texto no
    // siempre coinciden con la línea que une descripción e importe. Las dos
    // cabeceras de la tabla y el total proporcionan referencias de ancho completo.
    const adaptive=heading&&totalPrice&&Math.abs(headerTilt)<.2&&Math.abs(footerTilt)<.2;
    for(const word of boxes){const f=adaptive?Math.max(0,Math.min(1,(word.rawY-description.rawY)/(total.rawY-description.rawY))):0,angle=adaptive?headerTilt+(footerTilt-headerTilt)*f:tilt;word.y=word.rawY-angle*(word.cx-.5)}
    for(const word of boxes.sort((a,b)=>a.y-b.y)){
      const candidates=rows.filter(r=>Math.abs(r.y-word.y)<Math.min(r.h,word.h)*.55).sort((a,b)=>Math.abs(a.y-word.y)-Math.abs(b.y-word.y));
      let row=candidates[0];if(!row){row={y:word.y,h:word.h,words:[]};rows.push(row)}
      row.y=(row.y*row.words.length+word.y)/(row.words.length+1);row.h=Math.min(row.h,word.h);row.words.push(word);
    }
    rows.sort((a,b)=>a.y-b.y);rows.forEach(r=>r.words.sort((a,b)=>a.x-b.x));
    const anchors=rows.filter(r=>/^\d{1,2}(?:$|\s+[A-Za-zÁÉÍÓÚÑáéíóúñ])/.test(r.words[0].text)&&r.words.some(w=>/[A-Za-z]/.test(w.text))&&/\d[.,]\d{2}/.test(r.words.at(-1).text)).map(r=>r.words[0]);
    const mx=anchors.reduce((n,w)=>n+w.x,0)/Math.max(anchors.length,1),my=anchors.reduce((n,w)=>n+w.y,0)/Math.max(anchors.length,1);
    const variance=anchors.reduce((n,w)=>n+(w.y-my)**2,0),slope=variance>1e-5?Math.max(-.3,Math.min(.3,anchors.reduce((n,w)=>n+(w.x-mx)*(w.y-my),0)/variance)):0;
    const column=y=>mx+slope*(y-my),tolerance=median(boxes.map(w=>w.h))*.65;
    const amounts=rows.filter(r=>/\d{1,2}\s*[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(r.words[0].text)&&/^-?\d+[.,]\d{2}$/.test(r.words.at(-1).text)).map(r=>r.words.at(-1));
    const amountX=median(amounts.map(w=>w.cx)),amountTolerance=median(amounts.map(w=>w.width))*.6;
    const lines=rows.map(row=>{
      const rawText=row.words.map(w=>w.text).join(' '),first=row.words[0],last=row.words.at(-1);let text=rawText,moneyNormalized=false;
      const tokens=first.tokens||[],gaps=tokens.slice(2).map((t,i)=>t.step-tokens[i+1].step),gap=tokens.length>1?tokens[1].step-tokens[0].step:0;
      const spaced=!tokens.length||gap>=median(gaps)*1.4,inQuantityColumn=anchors.length>=2&&Math.abs(first.x-column(first.y))<tolerance;
      if(inQuantityColumn&&spaced&&/^\d{1,2}[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(first.text))text=text.replace(/^(\d{1,2})(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])/,'$1 ');
      if(inQuantityColumn&&tokens.length>2&&spaced&&/^\d\d\s*[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(first.text))text=text.replace(/^(\d)(?=\d)/,'$1 ');
      // Un ':' o ';' aislado en la columna de importes de un artículo puede
      // ser una coma. Nunca se modifica una hora en la cabecera.
      if(amounts.length>=3&&/^\d{1,2}\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(text)&&/^\d+[:;]\d{2}$/.test(last.text)&&Math.abs(last.cx-amountX)<amountTolerance){text=text.slice(0,-last.text.length)+last.text.replace(/[:;]/,',');moneyNormalized=true}
      return {text,rawText,...(moneyNormalized?{moneyNormalized:true}:{}),confidence:Math.min(...row.words.map(w=>w.confidence)),box:[Math.min(...row.words.map(w=>w.x)),Math.min(...row.words.flatMap(w=>w.box.map(p=>p[1]))),Math.max(...row.words.flatMap(w=>w.box.map(p=>p[0]))),Math.max(...row.words.flatMap(w=>w.box.map(p=>p[1])))],words:row.words};
    });
    const confidence=words.length?100*words.reduce((n,w)=>n+w.confidence,0)/words.length:0;
    return {text:lines.map(l=>l.text).join('\n'),confidence,lines};
  }
  const api={compose};root.CasaReceiptLayout=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
