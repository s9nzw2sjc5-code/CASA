/* Etiquetas de productos: propuestas locales, nunca una identificación automática. */
(function(root){
  'use strict';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const stop=new Set('de del la el los las con sin en al y o para un una por hacendado deliplus mercadona ingredientes informacion nutricional valores valor energetico energia grasas grasa saturadas hidratos carbono azucares proteinas sal fibra porcion conservar consumo preferente origen elaborado distribuye www neto peso contenido envase paquete botella pack brik ud unidades g kg ml l litro litros'.split(' '));
  const tokens=s=>[...new Set((norm(s).replace(/\bbosque\s+verde\b/g,' ').match(/[a-z0-9]{2,}/g)||[]).filter(w=>/[a-z]/.test(w)&&!stop.has(w)).map(w=>w.length>4&&w.endsWith('s')?w.slice(0,-1):w))];
  function evidence(ocr){
    const lines=ocr.lines?.length?ocr.lines:String(ocr.text||'').split('\n').map(text=>({text,confidence:1}));
    return lines.filter(l=>(l.confidence??1)>=.65&&!/ingrediente|nutricion|valor(?:es)? energetico|conservar|distribuid|fabricad|consumir|consumo preferente|\bkj\b|\bkcal\b/.test(norm(l.text))).map(l=>l.text).join('\n');
  }
  function rank(ocr,catalogue,limit=8){
    const text=evidence(ocr),seen=tokens(text),rows=catalogue.map(p=>({p,words:tokens(p[1])})),freq=new Map();
    rows.forEach(r=>r.words.forEach(w=>freq.set(w,(freq.get(w)||0)+1)));
    // Separar palabras pegadas por el OCR solo si ambas existen en el catálogo.
    for(const word of seen.slice()){if(freq.has(word))continue;for(let i=4;i<=word.length-4;i++){const a=word.slice(0,i),b=word.slice(i);if(freq.has(a)&&freq.has(b)){seen.push(a,b);break}}}
    const weight=w=>Math.max(1.5,Math.log(1+rows.length/(freq.get(w)||1)));
    // Variantes que no se deben intercambiar si la etiqueta las distingue.
    const variants=[['entera','semidesnatada','desnatada'],['natural','descafeinado'],['integral','blanco'],['normal','light']];
    const out=[];
    for(const {p,words}of rows){
      if(!seen.includes(words[0]))continue;
      const hits=words.filter(w=>seen.includes(w));if(!hits.length)continue;
      const found=hits.reduce((s,w)=>s+weight(w),0),total=words.reduce((s,w)=>s+weight(w),0),coverage=found/Math.max(total,1);
      if(found<3||coverage<.3||(hits.length<2&&coverage<.7))continue;
      const conflict=variants.some(group=>group.some(w=>seen.includes(w))&&group.some(w=>words.includes(w)&&!seen.includes(w)));
      if(conflict)continue;
      let score=found*(.5+coverage);
      const sizes=[...norm(text).matchAll(/\b(\d+(?:[.,]\d+)?)\s*(kg|ml|g|l)\b/g)].filter(m=>Number(m[1].replace(',','.'))!==100).map(m=>Number(m[1].replace(',','.'))*(m[2]==='kg'||m[2]==='l'?1000:1));
      const size=Number(p[4])*(p[5]==='kg'||p[5]==='l'?1000:1);
      if(sizes.length&&size>0)score+=sizes.some(s=>Math.abs(s-size)<.5)?3:-1;
      out.push({id:p[0],score,coverage,matched:hits});
    }
    out.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
    return {text,candidates:out.slice(0,limit),needsConfirmation:true};
  }
  const api={rank,evidence};root.CasaProductPhoto=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
