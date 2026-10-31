// Validación con el SDK oficial, sin commit ni acceso a una base de datos.
const assert=require('node:assert/strict');
const R=require('../casa/receipts.js');
const load=name=>process.env.CASA_FIREBASE_TEST_SDK?require(process.env.CASA_FIREBASE_TEST_SDK+'/'+name):require('firebase/'+name);
const {initializeApp,deleteApp}=load('app');
const {getFirestore,doc,writeBatch,terminate}=load('firestore');
(async()=>{
 const app=initializeApp({projectId:'local-validation-only'}),db=getFirestore(app),ref=doc(db,'hogar/estado');
 try{
  const t={store:'Tienda de prueba',date:'2026-10-31',total:5,lines:[{name:'Producto de prueba',units:2,unit:2.5,price:5,plan:{inventory:'new',amount:2,unit:'ud'}}]},state={rev:0,buys:[],pantry:[],items:[],prices:{},staples:[],cook:{}};
  for(const options of [{matchId:'',confirmNew:true},{matchId:'',confirmNew:false},{}]){
   const patch=R.patch(state,t,await R.identify(t),options).patch;
   assert.doesNotThrow(()=>writeBatch(db).update(ref,patch));
   const oldFunction=structuredClone(patch);oldFunction.buys[0].at=String.prototype.at;
   assert.throws(()=>writeBatch(db).update(ref,oldFunction),/Unsupported field value: a function/);
   const oldArrays=structuredClone(patch);oldArrays.prices['producto de prueba'].hist=[['2026-10-31','Tienda de prueba',2.5,1,'ud']];
   assert.throws(()=>writeBatch(db).update(ref,oldArrays),/Nested arrays/);
  }
  console.log('PASS: SDK oficial acepta los tiques corregidos y reproduce ambos errores anteriores. No se ha llamado a commit ni contactado con Firestore.');
 }finally{await terminate(db);await deleteApp(app)}
})().catch(e=>{console.error(e);process.exit(1)});
