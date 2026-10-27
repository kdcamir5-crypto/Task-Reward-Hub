const assert=require('node:assert/strict'),fs=require('node:fs');
const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing');
const S=require('firebase/firestore'),Core=require('../js/withdrawal-core.js');
const F={serverTimestamp:S.serverTimestamp};
function wrap(db){
 function ref(path){const raw=S.doc(db,path);return {raw,id:raw.id,collection:n=>col(path+'/'+n)};}
 function col(path){return {doc:id=>ref(path+'/'+(id||S.doc(S.collection(db,path)).id))};}
 return {collection:col,runTransaction:cb=>S.runTransaction(db,tx=>cb({get:async r=>{const s=await tx.get(r.raw);return {exists:s.exists(),data:()=>s.data()};},set:(r,d)=>tx.set(r.raw,d),update:(r,d)=>tx.update(r.raw,d)}))};
}
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-trh-withdrawals',firestore:{host:'127.0.0.1',port:8088,rules:fs.readFileSync(__dirname+'/maintenance-candidate.rules','utf8')}});
 const user={uid:'buyer'},admin={uid:'admin'},ctx=uid=>env.authenticatedContext(uid).firestore();let passed=0;
 const seed=(path,data)=>env.withSecurityRulesDisabled(c=>S.setDoc(S.doc(c.firestore(),path),data));
 const read=async path=>{let value;await env.withSecurityRulesDisabled(async c=>{value=(await S.getDoc(S.doc(c.firestore(),path))).data();});return value;};
 async function reset(balance=300){await env.clearFirestore();await seed('users/buyer',{role:'user',balance});await seed('users/admin',{role:'admin',balance:0});await seed('users/other',{role:'user',balance:300});await seed('wallets/w1',{uid:'buyer',type:'bKash',number:'01712345678'});}
 const request=(id='r1',amount=100)=>Core.request(wrap(ctx('buyer')),F,user,amount,'w1',id);
 const settle=(paid,id='r1')=>Core.settle(wrap(ctx('admin')),F,admin,id,paid,paid?'PAYMENT123':'Invalid details');
 const test=async(name,fn)=>{await reset();await fn();console.log('PASS '+name);passed++;};
 try{
 await test('request atomically reserves funds',async()=>{await request();const p=await read('users/buyer');assert.equal(p.balance,200);assert.equal(p.withdrawReserved,100);assert.equal(p.activeWithdrawalId,'r1');assert.equal((await read('withdrawals/r1')).reservedAmount,100);});
 await test('paid releases hold without second debit',async()=>{await request();await settle(true);const p=await read('users/buyer');assert.equal(p.balance,200);assert.equal(p.withdrawReserved,0);assert.equal(p.activeWithdrawalId,'');assert.equal((await read('withdrawals/r1')).status,'paid');await assert.rejects(settle(true));assert.equal((await read('users/buyer')).balance,200);});
 await test('reject refunds exactly once',async()=>{await request();await settle(false);assert.equal((await read('users/buyer')).balance,300);await assert.rejects(settle(false));assert.equal((await read('users/buyer')).balance,300);});
 await test('concurrent requests reserve only once',async()=>{const results=await Promise.allSettled([request('r1'),request('r2')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await read('users/buyer')).balance,200);});
 await test('same request retry is idempotent',async()=>{await request();await request();assert.equal((await read('users/buyer')).balance,200);});
 await test('new request works after rejection',async()=>{await request();await settle(false);await request('r2',200);assert.equal((await read('users/buyer')).balance,100);assert.equal((await read('users/buyer')).withdrawReserved,200);});
 await test('insufficient and invalid amounts fail with no debit',async()=>{await assert.rejects(request('r1',400));await assert.rejects(request('r1',100.5));assert.equal((await read('users/buyer')).balance,300);});
 await test('another user cannot use saved wallet',async()=>{await assert.rejects(Core.request(wrap(ctx('other')),F,{uid:'other'},100,'w1','r1'));assert.equal((await read('users/other')).balance,300);});
 await test('request without reserve is rejected by rules',async()=>{await assertFails(S.setDoc(S.doc(ctx('buyer'),'withdrawals/r1'),{uid:'buyer',amount:100,type:'bKash',number:'01712345678',walletId:'w1',status:'pending',reservationVersion:2,reservedAmount:100,createdAt:S.serverTimestamp()}));});
 await test('user cannot fake settlement or refund',async()=>{await request();await assertFails(S.updateDoc(S.doc(ctx('buyer'),'withdrawals/r1'),{status:'rejected'}));await assertFails(S.updateDoc(S.doc(ctx('buyer'),'users/buyer'),{balance:300,withdrawReserved:0,activeWithdrawalId:''}));});
 await test('admin cannot mark paid without releasing reserve',async()=>{await request();await assertFails(S.updateDoc(S.doc(ctx('admin'),'withdrawals/r1'),{status:'paid',reviewedBy:'admin',reviewedAt:S.serverTimestamp(),payoutReference:'PAY123',rejectionReason:'',settlementVersion:2}));});
 await test('concurrent paid and reject settle once',async()=>{await request();const results=await Promise.allSettled([settle(true),settle(false)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const d=await read('withdrawals/r1'),p=await read('users/buyer');assert.equal(p.balance,d.status==='paid'?200:300);assert.equal(p.withdrawReserved,0);});
 await test('legacy rejected request never adds funds',async()=>{await seed('withdrawals/r1',{uid:'buyer',amount:100,type:'bKash',number:'01712345678',status:'pending'});await settle(false);assert.equal((await read('users/buyer')).balance,300);});
 await test('legacy paid debits once',async()=>{await seed('withdrawals/r1',{uid:'buyer',amount:100,type:'bKash',number:'01712345678',status:'pending'});await settle(true);assert.equal((await read('users/buyer')).balance,200);await assert.rejects(settle(true));});
 await test('legacy paid fails if available funds spent',async()=>{await seed('users/buyer',{role:'user',balance:50});await seed('withdrawals/r1',{uid:'buyer',amount:100,type:'bKash',number:'01712345678',status:'pending'});await assert.rejects(settle(true));assert.equal((await read('withdrawals/r1')).status,'pending');});
 await test('other users cannot read request',async()=>{await request();await assertFails(S.getDoc(S.doc(ctx('other'),'withdrawals/r1')));});
 await test('maintenance blocks new withdrawal without reserving funds',async()=>{await seed('appSettings/transactionControls',{maintenance:true});await assert.rejects(request());assert.equal((await read('users/buyer')).balance,300);assert.equal(await read('withdrawals/r1'),undefined);});
 await test('maintenance still allows existing withdrawal settlement',async()=>{await request();await seed('appSettings/transactionControls',{maintenance:true});await settle(false);assert.equal((await read('users/buyer')).balance,300);});
 console.log('All '+passed+' withdrawal integration tests passed.');
 }finally{await env.cleanup();}
})().catch(error=>{console.error(error);process.exitCode=1;});
