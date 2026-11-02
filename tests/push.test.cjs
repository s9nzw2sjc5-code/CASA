const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('una notificación no puede abrir una dirección externa ni ejecutar respuestas',async()=>{
 const handlers={},shown=[],opened=[];
 const ctx={URL,self:{location:{href:'https://example.com/CASA/casa/sw.js'},addEventListener:(k,f)=>handlers[k]=f,registration:{showNotification:async(...args)=>shown.push(args)}},clients:{openWindow:async u=>opened.push(u)}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('casa/sw.js','utf8'),ctx);
 let pending;handlers.push({data:{json:()=>({kind:'task',id:'a&action=done',url:'https://evil.test',body:'Privado'})},waitUntil:p=>pending=p});await pending;
 assert.equal(shown[0][1].body.includes('Privado'),false);
 const url=new URL(shown[0][1].data.url);assert.equal(url.searchParams.get('noticeId'),'a&action=done');assert.equal(url.searchParams.has('action'),false);
 handlers.notificationclick({notification:{close(){},data:{url:'https://evil.test'}},waitUntil:p=>pending=p});assert.equal(opened.length,0);
 handlers.notificationclick({notification:{close(){},data:shown[0][1].data},waitUntil:p=>pending=p});await pending;assert.equal(opened.length,1);
});
