const {test}=require('node:test');
const assert=require('node:assert/strict');
const {compose}=require('../casa/receipt-layout.js');
const box=(text,x,y,w=.3,h=.02,confidence=.98,tokens)=>({text,confidence,tokens,box:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]});
const price=y=>box('1,50',.8,y,.1);
test('groups descriptions and prices by geometry, preserving repeated purchases',()=>{
 const result=compose([price(.1),box('1 ARROZ',.1,.1),box('1 ARROZ',.1,.15),price(.15)]);
 assert.equal(result.text,'1 ARROZ 1,50\n1 ARROZ 1,50');assert.equal(result.lines.length,2);
});
test('separates a joined quantity only with evidence of a quantity column',()=>{
 const words=[box('1 ARROZ',.1,.1),price(.1),box('2 LECHE',.1,.15),price(.15),box('1QUESO',.1,.2),price(.2),box('7UP',.14,.25),price(.25)];
 const result=compose(words);assert(result.text.includes('1 QUESO 1,50'));assert(result.text.includes('7UP 1,50'));assert(!result.text.includes('7 UP'));
 assert.equal(result.lines[2].rawText,'1QUESO 1,50');assert.equal(result.lines[2].words[0].text,'1QUESO');
});
test('a joined prefix without column evidence is not guessed',()=>{
 assert.equal(compose([box('7UP',.1,.1),price(.1)]).text,'7UP 1,50');
});
test('character spacing prevents splitting a product number in the quantity column',()=>{
 const tokens=[{char:'7',step:1},{char:'U',step:3},{char:'P',step:5}];
 const result=compose([box('1 ARROZ',.1,.1),price(.1),box('1 LECHE',.1,.15),price(.15),box('7UP',.1,.2,.3,.02,.98,tokens)]);
 assert(result.text.endsWith('7UP'));assert(!result.text.includes('7 UP'));
});
test('follows a slanted quantity column and retains per-line confidence',()=>{
 const result=compose([box('1 ARROZ',.1,.1),price(.1),box('1 LECHE',.11,.2),price(.2),box('2QUESOS',.13,.4,.3,.02,.65),price(.4)]);
 assert(result.text.includes('2 QUESOS'));assert.equal(result.lines[2].confidence,.65);assert(result.lines[2].box.length===4);
});
test('an empty recognition returns zero confidence and no fabricated text',()=>{
 assert.deepEqual(compose([]),{text:'',confidence:0,lines:[]});
});
test('separates quantity from a numeric product name only when character spacing supports it',()=>{
 const anchors=[box('1 ARROZ',.1,.1),price(.1),box('2 LECHE',.1,.15),price(.15)];
 const tokens=gap=>[{char:'1',step:1},{char:'6',step:1+gap},{char:' ',step:4+gap},{char:'H',step:7+gap},{char:'U',step:10+gap}];
 assert(compose([...anchors,box('16 HUEVOS',.1,.2,.3,.02,.98,tokens(5)),price(.2)]).text.includes('1 6 HUEVOS'));
 assert(compose([...anchors,box('16 HUEVOS',.1,.2,.3,.02,.98,tokens(3)),price(.2)]).text.includes('16 HUEVOS'));
 assert.equal(compose([box('16 HUEVOS',.1,.2,.3,.02,.98,tokens(5)),price(.2)]).text,'16 HUEVOS 1,50');
});
