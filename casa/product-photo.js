/* Etiquetas de productos: propuestas locales, nunca una identificación automática. */
(function(root){
  'use strict';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const stop=new Set('de del la el los las con sin en al y o para un una por hacendado deliplus mercadona ingredientes informacion nutricional valores valor energetico energia grasas grasa saturadas hidratos carbono azucares proteinas sal fibra porcion conservar consumo preferente origen elaborado distribuye www neto peso contenido envase paquete botella pack brik ud unidades g kg ml l litro litros'.split(' '));
  const tokens=s=>[...new Set((norm(s).replace(/\bbosque\s+verde\b/g,' ').match(/[a-z0-9]{2,}/g)||[]).filter(w=>/[a-z]/.test(w)&&!stop.has(w)).map(w=>w.length>4&&w.endsWith('s')?w.slice(0,-1):w))];
  // Una sola errata en palabras largas. No completar términos cortos o ambiguos.
  function oneEdit(a,b){
    if(a.length<5||b.length<5||Math.abs(a.length-b.length)>1)return false;
    let i=0,j=0,edits=0;
    while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue}if(++edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++}
    return edits+(a.length-i)+(b.length-j)<=1;
  }
  function evidence(ocr){
    const lines=ocr.lines?.length?ocr.lines:String(ocr.text||'').split('\n').map(text=>({text,confidence:1}));
    return lines.filter(l=>(l.confidence??1)>=.65&&!/ingrediente|nutricion|valor(?:es)? energetico|conservar|distribuid|fabricad|consumir|consumo preferente|\bkj\b|\bkcal\b/.test(norm(l.text))).map(l=>l.text).join('\n');
  }
  async function fingerprint(kind,bytes){
    if(!root.crypto?.subtle)return '';
    const hash=await root.crypto.subtle.digest('SHA-256',bytes);
    return 'photo:v1:'+kind+':'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
  }
  const imageKey=file=>file.arrayBuffer().then(bytes=>fingerprint('image',bytes));
  function labelKey(ocr){
    const text=evidence(ocr);
    if(tokens(text).length<2)return Promise.resolve('');
    // Conservar variedad, negaciones y tamaño; tolerar cambios de orden y puntuación.
    const label=[...new Set(norm(text).match(/[a-z0-9]+/g)||[])].sort().join(' ');
    return fingerprint('label',new TextEncoder().encode(label));
  }
  const validKey=key=>/^photo:v1:(image|label):[a-f0-9]{64}$/.test(key);
  function learnedIds(keys,map,catalogue){
    const ids=new Set(catalogue.map(p=>p[0]));
    return [...new Set(keys.filter(validKey).map(k=>map?.[k]).filter(id=>typeof id==='string'&&ids.has(id)))];
  }
  function learn(map,keys,id){
    const next={...map};
    if(typeof id==='string'&&id)for(const key of keys.filter(validKey))next[key]=id;
    return next;
  }
  function rank(ocr,catalogue,limit=8,remembered=[]){
    const text=evidence(ocr),seen=tokens(text),rows=catalogue.map(p=>({p,words:tokens(p[1])})),freq=new Map();
    rows.forEach(r=>r.words.forEach(w=>freq.set(w,(freq.get(w)||0)+1)));
    // Separar palabras pegadas por el OCR solo si ambas existen en el catálogo.
    for(const word of seen.slice()){if(freq.has(word))continue;for(let i=4;i<=word.length-4;i++){const a=word.slice(0,i),b=word.slice(i);if(freq.has(a)&&freq.has(b)){seen.push(a,b);break}}}
    for(const word of seen.slice()){
      if(freq.has(word)||word.length<5)continue;
      const alternatives=[...freq.keys()].filter(w=>oneEdit(word,w));
      if(alternatives.length===1)seen.push(alternatives[0]);
    }
    const weight=w=>Math.max(1.5,Math.log(1+rows.length/(freq.get(w)||1)));
    // Variantes que no se deben intercambiar si la etiqueta las distingue.
    const variants=[['entera','semidesnatada','desnatada'],['natural','descafeinado'],['integral','blanco'],['normal','light']];
    const label=norm(text),attributes=['lactosa','gluten','azucar(?:es)?','sal','alcohol','cafeina'];
    const states=attributes.map(attribute=>({negative:new RegExp('\\bsin\\s+'+attribute+'\\b'),positive:new RegExp('\\bcon\\s+'+attribute+'\\b')}));
    const out=[];
    for(const {p,words}of rows){
      const name=norm(p[1]);
      if(states.some(({negative,positive})=>(negative.test(label)&&positive.test(name))||(positive.test(label)&&negative.test(name))))continue;
      if(/\bsin\s+lactosa\b/.test(label)&&/\bleche\b/.test(name)&&!/\bsin\s+lactosa\b/.test(name))continue;
      const hits=words.filter(w=>seen.includes(w));if(!hits.length)continue;
      const found=hits.reduce((s,w)=>s+weight(w),0),total=words.reduce((s,w)=>s+weight(w),0),coverage=found/Math.max(total,1);
      if(found<3||coverage<.3||(hits.length<2&&coverage<.7))continue;
      // El nombre del catálogo no siempre está impreso: «elimina olores» también
      // puede proponer «Limpiahogar elimina olores…», sin aceptar una pista aislada.
      if(!seen.includes(words[0])&&(hits.length<2||coverage<.4))continue;
      const conflict=variants.some(group=>group.some(w=>seen.includes(w))&&group.some(w=>words.includes(w)&&!seen.includes(w)));
      if(conflict)continue;
      let score=found*(.5+coverage);
      const sizes=[...norm(text).matchAll(/\b(\d+(?:[.,]\d+)?)\s*(kg|ml|g|l)\b/g)].filter(m=>Number(m[1].replace(',','.'))!==100).map(m=>Number(m[1].replace(',','.'))*(m[2]==='kg'||m[2]==='l'?1000:1));
      const size=Number(p[4])*(p[5]==='kg'||p[5]==='l'?1000:1);
      if(sizes.length&&size>0)score+=sizes.some(s=>Math.abs(s-size)<.5)?3:-1;
      out.push({id:p[0],score,coverage,matched:hits});
    }
    out.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
    const known=[...new Set(remembered)].filter(id=>catalogue.some(p=>p[0]===id));
    const candidates=[...known.map(id=>({...out.find(p=>p.id===id),id,learned:true})),...out.filter(p=>!known.includes(p.id))];
    return {text,candidates:candidates.slice(0,limit),needsConfirmation:true};
  }
  const api={rank,evidence,imageKey,labelKey,learnedIds,learn};root.CasaProductPhoto=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
