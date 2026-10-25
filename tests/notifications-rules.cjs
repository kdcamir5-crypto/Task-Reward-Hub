const fs=require('node:fs'),assert=require('node:assert/strict');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing'),S=require('firebase/firestore');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-trh-notifications',firestore:{host:'127.0.0.1',port:8088,rules:fs.readFileSync(__dirname+'/../firebase.rules','utf8')}});
 const owner=env.authenticatedContext('owner').firestore(),other=env.authenticatedContext('other').firestore(),guest=env.unauthenticatedContext().firestore();
 const path='users/owner/notificationReads/receipt',payload=()=>({eventId:'receipt',read:true,readAt:S.serverTimestamp()});let passed=0;
 const test=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
 try{
 await env.withSecurityRulesDisabled(async c=>{await S.setDoc(S.doc(c.firestore(),'users/owner'),{role:'user',balance:100});});
 await test('owner creates and lists private read state',async()=>{await assertSucceeds(S.setDoc(S.doc(owner,path),payload()));const snap=await S.getDocs(S.collection(owner,'users/owner/notificationReads'));assert.equal(snap.size,1);});
 await test('other account cannot read, list or write read state',async()=>{await assertFails(S.getDoc(S.doc(other,path)));await assertFails(S.getDocs(S.collection(other,'users/owner/notificationReads')));await assertFails(S.setDoc(S.doc(other,path),payload()));});
 await test('logged-out access is denied',async()=>{await assertFails(S.getDoc(S.doc(guest,path)));await assertFails(S.setDoc(S.doc(guest,path),payload()));});
 await test('cannot smuggle notification content or money fields',async()=>{await assertFails(S.setDoc(S.doc(owner,path),{...payload(),balance:9999}));await assertFails(S.setDoc(S.doc(owner,path),{...payload(),title:'Fake deposit approved'}));});
 await test('cannot forge false read flag, another id or stale timestamp',async()=>{await assertFails(S.setDoc(S.doc(owner,path),{...payload(),read:false}));await assertFails(S.setDoc(S.doc(owner,path),{...payload(),eventId:'other'}));await assertFails(S.setDoc(S.doc(owner,path),{...payload(),readAt:new Date(0)}));});
 await test('read acknowledgement updates are idempotent and cannot be deleted',async()=>{await assertSucceeds(S.setDoc(S.doc(owner,path),payload()));await assertFails(S.deleteDoc(S.doc(owner,path)));});
 await test('read state cannot create notifications or grant money',async()=>{await assertFails(S.setDoc(S.doc(owner,'users/owner/notifications/fake'),{title:'Fake',amount:100}));const b=S.writeBatch(owner);b.set(S.doc(owner,path),payload());b.update(S.doc(owner,'users/owner'),{balance:9999});await assertFails(b.commit());assert.equal((await S.getDoc(S.doc(owner,'users/owner'))).data().balance,100);});
 console.log('All '+passed+' notification security tests passed.');
 }finally{await env.cleanup();}
})().catch(error=>{console.error(error);process.exitCode=1;});
