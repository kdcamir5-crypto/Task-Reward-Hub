const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const source=fs.readFileSync(__dirname+'/../js/dashboard.js','utf8'),handlers={},global={},doc={};let count=0;
 const button={disabled:false,addEventListener:(name,fn)=>handlers[name]=fn};
 const context={document:{hidden:false,getElementById:()=>button,addEventListener:(name,fn)=>doc[name]=fn},window:{addEventListener:(name,fn)=>global[name]=fn},tapPointerIds:new Set(),showTapFeedback(){},queueTapCoin(){count++;}};
 const start=source.indexOf('  const tapMainButton ='),end=source.indexOf('  document.getElementById("tap-sponsored-card")',start);assert(start>=0&&end>start);vm.runInNewContext(source.slice(start,end),context);
 const pointer=(id=1,type='mouse',button=0)=>({pointerId:id,pointerType:type,button,preventDefault(){}});
 return {button,handlers,global,doc,context,pointer,get count(){return count;}};
}
test('outside mouse release allows next tap; following click never double counts',()=>{const s=setup(),e=s.pointer();s.handlers.pointerdown(e);s.global.pointerup(e);s.handlers.pointerdown(e);s.handlers.click({detail:1,preventDefault(){}});assert.equal(s.count,2);});
test('multiple fingers count individually and duplicate downs do not count',()=>{const s=setup();for(const id of [1,2,1,3])s.handlers.pointerdown(s.pointer(id,'touch'));assert.equal(s.count,3);s.global.pointerup(s.pointer(1,'touch'));s.handlers.pointerdown(s.pointer(1,'touch'));assert.equal(s.count,4);});
test('cancel, lost capture, blur and hidden document clear stale pointers',()=>{for(const release of ['cancel','lost','blur','hidden']){const s=setup(),e=s.pointer();s.handlers.pointerdown(e);if(release==='cancel')s.global.pointercancel(e);if(release==='lost')s.handlers.lostpointercapture(e);if(release==='blur')s.global.blur();if(release==='hidden'){s.context.document.hidden=true;s.doc.visibilitychange();}s.handlers.pointerdown(e);assert.equal(s.count,2,release);}});
test('native keyboard/assistive click counts once and disabled goal cannot count',()=>{const s=setup(),click={detail:0,preventDefault(){}};s.handlers.click(click);assert.equal(s.count,1);s.button.disabled=true;s.handlers.click(click);s.handlers.pointerdown(s.pointer());assert.equal(s.count,1);});
test('right and middle mouse buttons do not earn',()=>{const s=setup();s.handlers.pointerdown(s.pointer(1,'mouse',1));s.handlers.pointerdown(s.pointer(1,'mouse',2));assert.equal(s.count,0);});
