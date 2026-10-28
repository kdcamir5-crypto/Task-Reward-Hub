const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../js/daily-tasks-core.js');
function setup(){
 const nodes=new Map(),handlers={},watches=[],timers=new Map();let next=0;
 function node(id){if(!nodes.has(id))nodes.set(id,{id,hidden:false,innerHTML:'',textContent:'',attributes:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(type,fn){handlers[id+':'+type]=fn;},querySelectorAll:()=>[]});return nodes.get(id);}
 const doc={activeElement:null,hidden:false,getElementById:node,addEventListener:(n,f)=>handlers['document:'+n]=f};
 let calls=0;const context={document:doc,window:{HubDailyTaskCore:{...C,submit:async()=>{calls++;}},firebase:{firestore:{FieldValue:{}}}},Date,URL,Set,Map,console,setTimeout:(f,ms)=>{timers.set(++next,{f,ms});return next;},clearTimeout:id=>timers.delete(id)};
 const db={collection:name=>{const query={where:()=>query,onSnapshot(options,ok,fail){const watcher={name,ok,fail,stopped:false};watches.push(watcher);return ()=>watcher.stopped=true;}};return query;}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../js/daily-tasks.js','utf8'),context);
 const emit=(name,data,cached=false)=>{const w=watches.filter(x=>x.name===name).at(-1);w.ok({docs:data.map(d=>({id:d.id,data:()=>d,metadata:{hasPendingWrites:false}})),metadata:{fromCache:cached}});};
 return {context,nodes,node,handlers,watches,timers,emit,calls:()=>calls,start(uid='buyer'){context.window.HubDailyTasks.init(db,{uid});context.window.HubDailyTasks.show(true);}};
}
const tasks=[{id:'a',schemaVersion:2,title:'<img src=x onerror=alert(1)>',description:'Work here',url:'https://example.com',rewardMinor:250,expiresAtMs:Date.now()+60000},{id:'b',schemaVersion:2,title:'Other task',description:'Proof please',url:'https://t.me/example',rewardMinor:100,expiresAtMs:Date.now()+60000}];
test('UI waits for both server sources, escapes task text, and hides only submitted tasks',()=>{
 const s=setup();s.start();s.emit('tasks',tasks);assert(!s.node('daily-task-list').innerHTML.includes('data-daily-submit'));
 s.emit('submissions',[{id:'buyer_a',taskId:'a',status:'pending'}]);let html=s.node('daily-task-list').innerHTML;assert(!html.includes('data-daily-submit="a"'));assert(html.includes('data-daily-submit="b"'));
 s.emit('submissions',[]);html=s.node('daily-task-list').innerHTML;assert(html.includes('&lt;img'));assert(!html.includes('<img'));assert(html.includes('rel="noopener noreferrer"'));
});
test('offline sources and failed subscriptions cannot submit proof',async()=>{
 const s=setup();s.start();s.emit('tasks',tasks,true);s.emit('submissions',[]);assert(s.node('daily-task-list').innerHTML.includes('disabled'));
 await s.handlers['daily-task-list:submit']({target:{closest:()=>({dataset:{dailySubmit:'a'}})},preventDefault(){}});assert.equal(s.calls(),0);
 s.watches.at(-1).fail();assert(s.node('daily-task-list').innerHTML.includes('লোড হয়নি'));
});
test('session switches ignore old account callbacks and expiry is scheduled at midnight',()=>{
 const s=setup();s.start();const old=s.watches[0];s.start('other');old.ok({docs:tasks.map(d=>({id:d.id,data:()=>d})),metadata:{fromCache:false}});
 assert(!s.node('daily-task-list').innerHTML.includes('data-daily-submit'));
 s.emit('tasks',tasks);s.emit('submissions',[]);assert([...s.timers.values()].some(t=>t.ms>0&&t.ms<=86400100));
 s.context.window.HubDailyTasks.stop();assert.equal(s.timers.size,0);assert(s.watches.every(w=>w.stopped));
});
test('task History shows saved decisions and only confirmed approved rewards as paid',()=>{
 const s=setup();s.start();s.emit('tasks',[]);
 s.emit('submissions',[
  {id:'a',uid:'buyer',schemaVersion:2,taskTitle:'Approved work',reward:2.5,rewardMinor:250,status:'approved',rewardCredited:true,createdAt:{seconds:100},reviewedAt:{seconds:110},proof:'<img src=x onerror=alert(1)>'},
  {id:'b',uid:'buyer',schemaVersion:2,taskTitle:'Pending work',reward:1,rewardMinor:100,status:'pending',createdAt:{seconds:120}},
  {id:'c',uid:'buyer',schemaVersion:2,taskTitle:'Rejected work',reward:1,rewardMinor:100,status:'rejected',rejectionReason:'Wrong username',createdAt:{seconds:90},reviewedAt:{seconds:130}},
  {id:'d',uid:'buyer',schemaVersion:2,taskTitle:'Unconfirmed credit',reward:1,rewardMinor:100,status:'approved',rewardCredited:false,createdAt:{seconds:80}}
 ]);
 s.handlers['daily-tasks-history:click']();const html=s.node('daily-task-history').innerHTML;
 assert.equal(s.node('daily-task-list').hidden,true);assert.equal(s.node('daily-task-history').hidden,false);
 assert(html.includes('৳2.50 আপনার Main Balance-এ যোগ হয়েছে'));assert.equal((html.match(/আপনার Main Balance-এ যোগ হয়েছে/g)||[]).length,1);
 assert(html.includes('এখনো টাকা যোগ হয়নি'));assert(html.includes('কোনো টাকা যোগ হয়নি'));assert(html.includes('Wrong username'));
 assert(html.includes('Reward credit নিশ্চিত করা যায়নি'));assert(html.includes('&lt;img'));assert(!html.includes('<img'));
 assert(html.indexOf('Rejected work')<html.indexOf('Pending work'));
 s.handlers['daily-tasks-available:click']();assert.equal(s.node('daily-task-list').hidden,false);assert.equal(s.node('daily-task-history').hidden,true);
});
test('History survives task expiry or deletion, paginates, and never shows another account',()=>{
 const s=setup();s.start();s.emit('tasks',[]);
 const rows=Array.from({length:51},(_,i)=>({id:'r'+i,uid:'buyer',schemaVersion:2,taskId:'removed'+i,taskTitle:'Archived task '+i,status:'pending',reward:1,rewardMinor:100,createdAt:{seconds:100+i}}));
 s.emit('submissions',[...rows,{id:'foreign',uid:'other',schemaVersion:2,taskTitle:'Private foreign task',status:'pending'}]);
 s.handlers['daily-tasks-history:click']();assert.equal((s.node('daily-task-history').innerHTML.match(/dt-history-card/g)||[]).length,50);assert.equal(s.node('daily-task-history-more').hidden,false);assert(!s.node('daily-task-history').innerHTML.includes('Private foreign task'));
 s.handlers['daily-task-history-more:click']();assert.equal((s.node('daily-task-history').innerHTML.match(/dt-history-card/g)||[]).length,51);assert.equal(s.node('daily-task-history-more').hidden,true);
 s.start('other');s.handlers['daily-tasks-history:click']();assert(!s.node('daily-task-history').innerHTML.includes('Archived task'));s.emit('tasks',[]);s.emit('submissions',[]);assert(s.node('daily-task-history').innerHTML.includes('এখনো কোনো task জমা দেননি'));
});
