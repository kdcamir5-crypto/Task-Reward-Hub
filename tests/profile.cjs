const assert=require('node:assert/strict'),fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const S=require('firebase/firestore');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-trh-profile',firestore:{host:'127.0.0.1',port:8088,rules:fs.readFileSync(__dirname+'/../firebase.rules','utf8')}});
 let passed=0;
 const ref=uid=>S.doc(env.authenticatedContext(uid).firestore(),'users/one');
 const test=async(name,fn)=>{await env.clearFirestore();await env.withSecurityRulesDisabled(c=>S.setDoc(S.doc(c.firestore(),'users/one'),{name:'Old',role:'user',balance:100,usdBalance:2,telegramUserId:'12345',profileAvatar:'👨🏻‍💻'}));await fn();console.log('PASS '+name);passed++;};
 const payload=()=>({name:'New Name',fullName:'New Name',phoneNumber:'01712345678',telegramUsername:'https://t.me/example_user',profileUpdatedAt:S.serverTimestamp()});
 try{
 await test('actual profile form payload saves without changing finance or identity',async()=>{await assertSucceeds(S.updateDoc(ref('one'),payload()));const p=(await S.getDoc(ref('one'))).data();assert.equal(p.balance,100);assert.equal(p.usdBalance,2);assert.equal(p.role,'user');assert.equal(p.telegramUserId,'12345');assert.equal(p.name,'New Name');assert(p.profileUpdatedAt);});
 await test('photo replaces selected avatar and survives read',async()=>{await assertSucceeds(S.updateDoc(ref('one'),{...payload(),profileAvatar:'',profilePhotoData:'data:image/jpeg;base64,/9j/2Q=='}));assert.equal((await S.getDoc(ref('one'))).data().profileAvatar,'');});
 await test('avatar replaces saved photo',async()=>{await assertSucceeds(S.updateDoc(ref('one'),{profileAvatar:'👩🏻‍💻',profilePhotoData:''}));});
 await test('legacy name phone telegram edits remain supported',async()=>{await assertSucceeds(S.updateDoc(ref('one'),{name:'Legacy',phone:'01712345678',telegram:'@example_user'}));});
 await test('other users and anonymous callers cannot edit profile',async()=>{await assertFails(S.updateDoc(ref('two'),payload()));await assertFails(S.updateDoc(S.doc(env.unauthenticatedContext().firestore(),'users/one'),payload()));});
 await test('profile cannot mutate any protected field',async()=>{for(const patch of [{balance:10000},{usdBalance:100},{role:'admin'},{telegramUserId:'999'},{referralStatus:'verified'},{referralBotsCount:20},{unlockedBots:['apex']},{collectorId:'87654321'}])await assertFails(S.updateDoc(ref('one'),{...payload(),...patch}));});
 await test('lengths types fake timestamp avatar and non-image data rejected',async()=>{for(const patch of [{name:''},{name:'x'.repeat(81)},{fullName:3},{phoneNumber:'x'.repeat(25)},{telegramUsername:'x'.repeat(121)},{profileUpdatedAt:new Date(1)},{profileAvatar:'admin'},{profilePhotoData:'https://evil.invalid/a'},{profilePhotoData:'data:image/svg+xml;base64,PHN2Zz4='},{profilePhotoData:'data:image/jpeg;base64,'+'A'.repeat(450001)}])await assertFails(S.updateDoc(ref('one'),patch));});
 console.log(passed+' profile rules tests passed');
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
