/* Reconstruye filas conservando geometría, texto y confianza de cada lectura. */
(function(root){
  'use strict';
  const median=values=>{const a=values.slice().sort((a,b)=>a-b);return a.length?a[Math.floor(a.length/2)]:0};
  function compose(words){
    const boxes=words.filter(w=>w.text.trim()).map(w=>({...w,x:Math.min(...w.box.map(p=>p[0])),y:w.box.reduce((n,p)=>n+p[1],0)/4,h:Math.max(...w.box.map(p=>p[1]))-Math.min(...w.box.map(p=>p[1]))})),rows=[];
    for(const word of boxes.sort((a,b)=>a.y-b.y)){
      let row=rows.find(r=>Math.abs(r.y-word.y)<Math.min(r.h,word.h)*.5);
      if(!row){row={y:word.y,h:word.h,words:[]};rows.push(row)}row.words.push(word);
    }
    rows.sort((a,b)=>a.y-b.y);rows.forEach(r=>r.words.sort((a,b)=>a.x-b.x));
    // Solo se separa una cantidad pegada si hay evidencia de su columna.
    // Un nombre como 7UP en la columna de descripción se conserva íntegro.
    const anchors=rows.filter(r=>/^\d{1,2}(?:$|\s+[A-Za-zÁÉÍÓÚÑáéíóúñ])/.test(r.words[0].text)&&r.words.some(w=>/[A-Za-z]/.test(w.text))&&/\d[.,]\d{2}/.test(r.words.at(-1).text)).map(r=>r.words[0]);
    const mx=anchors.reduce((n,w)=>n+w.x,0)/Math.max(anchors.length,1),my=anchors.reduce((n,w)=>n+w.y,0)/Math.max(anchors.length,1);
    const variance=anchors.reduce((n,w)=>n+(w.y-my)**2,0),slope=variance>1e-5?Math.max(-.3,Math.min(.3,anchors.reduce((n,w)=>n+(w.x-mx)*(w.y-my),0)/variance)):0;
    const column=y=>mx+slope*(y-my),tolerance=median(boxes.map(w=>w.h))*.65;
    const lines=rows.map(row=>{
      const rawText=row.words.map(w=>w.text).join(' '),first=row.words[0];let text=rawText;
      const tokens=first.tokens||[],gaps=tokens.slice(2).map((t,i)=>t.step-tokens[i+1].step),gap=tokens.length>1?tokens[1].step-tokens[0].step:0;
      const spaced=!tokens.length||gap>=median(gaps)*1.4;
      if(anchors.length>=2&&Math.abs(first.x-column(first.y))<tolerance&&spaced&&/^\d{1,2}[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(first.text))text=text.replace(/^(\d{1,2})(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])/,'$1 ');
      return {text,rawText,confidence:Math.min(...row.words.map(w=>w.confidence)),box:[Math.min(...row.words.map(w=>w.x)),Math.min(...row.words.flatMap(w=>w.box.map(p=>p[1]))),Math.max(...row.words.flatMap(w=>w.box.map(p=>p[0]))),Math.max(...row.words.flatMap(w=>w.box.map(p=>p[1])))],words:row.words};
    });
    const confidence=words.length?100*words.reduce((n,w)=>n+w.confidence,0)/words.length:0;
    return {text:lines.map(l=>l.text).join('\n'),confidence,lines};
  }
  const api={compose};root.CasaReceiptLayout=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
