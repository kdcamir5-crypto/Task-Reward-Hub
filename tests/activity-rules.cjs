const assert=require('node:assert/strict'),fs=require('node:fs');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing'),S=require('firebase/firestore'),A=require('../js/activity-paged-core.js');
function wrap(db){
 function ref(path){return {collection:n=>col(path+'/'+n)};}
 function col(path,filters=[]){
  function docs(s){return {docs:s.docs.map(d=>({id:d.id,data:()=>d.data(),raw:d})),metadata:s.metadata};}
  return {doc:id=>ref(path+'/'+id),where:(...args)=>col(path,[...filters,S.where(...args)]),orderBy:(field,direction)=>col(path,[...filters,S.orderBy(field==='__name__'?S.documentId():field,direction)]),limit:n=>col(path,[...filters,S.limit(n)]),startAfter:d=>col(path,[...filters,S.startAfter(d.raw)]),get:async()=>docs(await S.getDocsFromServer(S.query(S.collection(db,path),...filters))),onSnapshot:(options,next,error)=>S.onSnapshot(S.query(S.collection(db,path),...filters),options,s=>next(docs(s)),error)};
 }
 return {collection:col};
}
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-trh-activity',firestore:{host:'127.0.0.1',port:8088,rules:fs.readFileSync(__dirname+'/../firebase.rules','utf8')}});
 let controller;
 try{
  await env.withSecurityRulesDisabled(async context=>{const db=context.firestore(),batch=S.writeBatch(db);batch.set(S.doc(db,'users/owner'),{role:'user',balance:20});for(let i=0;i<32;i++)batch.set(S.doc(db,'withdrawals/'+String(i).padStart(3,'0')),{uid:'owner',amount:100,status:'pending',reservationVersion:2,...(i?{createdAt:S.Timestamp.fromMillis(i*1000)}:{})});batch.set(S.doc(db,'withdrawals/foreign'),{uid:'other',amount:100,status:'pending',createdAt:S.Timestamp.now()});await batch.commit();});
  let state;const waiters=[];controller=A.create(wrap(env.authenticatedContext('owner').firestore()),'owner',value=>{state=value;for(const fn of waiters)fn();});
  async function until(predicate){if(predicate())return;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Activity snapshot timeout')),10000);waiters.push(()=>{if(predicate()){clearTimeout(timer);resolve();}});});}
  await until(()=>state&&!state.loading);assert.deepEqual(state.errors,[]);assert.equal(state.rows.filter(r=>r.source==='withdrawal').length,10);assert(!state.rows.some(r=>r.id==='foreign'));
  await controller.loadMore();assert(state.rows.some(r=>r.id==='000'));await controller.loadMore();assert.equal(state.rows.filter(r=>r.source==='withdrawal').length,32);assert.equal(state.hasMore,false);
  await env.withSecurityRulesDisabled(c=>S.updateDoc(S.doc(c.firestore(),'withdrawals/001'),{status:'paid',reviewedAt:S.Timestamp.now()}));await until(()=>state.rows.some(r=>r.id==='001'&&r.status==='paid'));assert.equal(state.rows.filter(r=>r.id==='001').length,1);
  const profile=await S.getDoc(S.doc(env.authenticatedContext('owner').firestore(),'users/owner'));assert.equal(profile.data().balance,20);
  console.log('PASS bounded activity queries respect owner rules, retain legacy rows, stream old approvals and never change balances');
 }finally{controller?.stop();await env.cleanup();}
})().catch(error=>{console.error(error);process.exitCode=1;});
