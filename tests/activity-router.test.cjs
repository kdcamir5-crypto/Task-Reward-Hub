const {test}=require('node:test'),assert=require('node:assert/strict'),R=require('../js/activity-router.js');
const flush=()=>new Promise(setImmediate);
function setup(flag,fail=false){
 const calls=[],states=[],make=name=>({create(db,uid,cb){calls.push(name);return {updateProfile:v=>calls.push(['profile',v]),updateMining:v=>calls.push(['mining',v]),reportError:v=>calls.push(['error',v]),stop:()=>calls.push('stop'),loadMore:async()=>calls.push('more')};}});
 let resolve;
 const db={collection(name){
  assert.equal(name,'appSettings');
  return {doc(id){
   assert.equal(id,'activityHistory');
   return {get(options){
    assert.equal(options.source,'server');
    return new Promise(r=>resolve=r).then(()=>{if(fail)throw Error('offline');return {exists:!!flag,data:()=>flag};});
   }};
  }};
 }};
 const c=R.create(db,'owner',s=>states.push(s),make('legacy'),make('paged'));
 return {c,calls,states,resolve:()=>resolve()};
}
test('ready server flag selects bounded queries and preserves queued profile/mining updates',async()=>{const s=setup({pagingReady:true,version:1});s.c.updateProfile({balance:10});s.c.updateMining([{id:'bot'}]);assert.deepEqual(s.calls,[]);s.resolve();await flush();assert.equal(s.calls[0],'paged');assert.deepEqual(s.calls[1],['profile',{balance:10}]);assert.deepEqual(s.calls[2],['mining',[{id:'bot'}]]);await s.c.loadMore();assert.equal(s.calls.at(-1),'more');});
test('missing, unsupported or failed flag preserves existing realtime implementation',async()=>{for(const [flag,fail] of [[null,false],[{pagingReady:true,version:9},false],[null,true]]){const s=setup(flag,fail);s.resolve();await flush();assert.equal(s.calls[0],'legacy');}});
test('sign-out during flag lookup starts no private source listeners',async()=>{const s=setup({pagingReady:true,version:1});s.c.stop();s.resolve();await flush();assert.deepEqual(s.calls,[]);});
