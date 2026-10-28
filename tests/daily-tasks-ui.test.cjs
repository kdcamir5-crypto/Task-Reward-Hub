const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../js/daily-tasks-core.js');
function setup(){
 const nodes=new Map(),handlers={},watches=[],timers=new Map();let next=0;
 function node(id){if(!nodes.has(id))nodes.set(id,{id,hidden:false,innerHTML:'',textContent:'',addEventListener(type,fn){handlers[id+':'+type]=fn;},querySelectorAll:()=>[]});return nodes.get(id);}
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
