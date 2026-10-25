(function(root){
'use strict';
const bots={pulse:{name:'AI Pulse Bot v2',target:80},quantum:{name:'Quantum Core Pro',target:160},neural:{name:'Neural Matrix Bot',target:320},cyber:{name:'Cyber Forge Titan',target:480},apex:{name:'Apex Sentinel AI',target:800}};
function fail(s){throw new Error(s);}
function normalize(code){return String(code||'').trim().toUpperCase();}
function randomCode(){const bytes=new Uint8Array(10);root.crypto.getRandomValues(bytes);return 'TRH-'+Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();}
async function generate(db,F,admin,options){
 const type=options.rewardType,bot=type==='bot'?options.botId:'',minor=type==='bot'?0:Math.round(Number(options.amount)*100),minutes=Number(options.minutes),max=Number(options.maxClaims),count=Number(options.count||1);
 if(!admin?.uid||!['bot','BDT','USD'].includes(type)||(type==='bot'?!bots[bot]:!Number.isSafeInteger(minor)||minor<1||minor>100000000||Math.abs(Number(options.amount)*100-minor)>.000001)||!Number.isInteger(minutes)||minutes<1||minutes>30||!Number.isInteger(max)||max<1||max>10000||!Number.isInteger(count)||count<1||count>5)fail('Reward, amount, মেয়াদ (১–৩০ মিনিট), usage limit ও code সংখ্যা (১–৫) যাচাই করুন।');
 const codes=Array.from({length:count},randomCode),expiresAtMs=Date.now()+minutes*60000;
 await db.runTransaction(async tx=>{
  const refs=codes.map(code=>db.collection('rewardCodes').doc(code));const old=await Promise.all(refs.map(r=>tx.get(r)));if(old.some(s=>s.exists))fail('Code collision হয়েছে। Generate আবার চাপুন।');
  refs.forEach((r,i)=>tx.set(r,{code:codes[i],rewardType:type,amountMinor:minor,botId:bot,maxClaims:max,claimedCount:0,active:true,expiresAtMs,createdBy:admin.uid,createdAt:F.serverTimestamp(),lastClaimUid:'',lastClaimAt:null}));
 });return codes;
}
async function claim(db,F,user,input){
 const code=normalize(input);if(!user?.uid||!/^TRH-[A-F0-9]{20}$/.test(code))fail('সঠিক TRH code দিন।');
 const codeRef=db.collection('rewardCodes').doc(code),userRef=db.collection('users').doc(user.uid),claimRef=userRef.collection('codeClaims').doc(code);let result;
 for(let attempt=0;attempt<4;attempt++){
 try{await db.runTransaction(async tx=>{
  const [c,p,r]=await Promise.all([tx.get(codeRef),tx.get(userRef),tx.get(claimRef)]);
  if(r.exists){result={...r.data(),already:true};return;}
  if(!c.exists)fail('Code পাওয়া যায়নি।');if(!p.exists)fail('Account profile পাওয়া যায়নি।');const d=c.data(),profile=p.data();
  if(!d.active)fail('এই code বন্ধ করা হয়েছে।');if(d.expiresAtMs<=Date.now())fail('Code-এর মেয়াদ শেষ হয়েছে।');if(d.claimedCount>=d.maxClaims)fail('এই code-এর ব্যবহারসীমা শেষ হয়েছে।');
  const receipt={code,uid:user.uid,rewardType:d.rewardType,amountMinor:d.amountMinor,botId:d.botId,status:'claimed',createdAt:F.serverTimestamp()};
  const patch={lastRewardCode:code,updatedAt:F.serverTimestamp()};
  if(d.rewardType==='bot'){
   const pkg=bots[d.botId];if(!pkg)fail('Bot package সঠিক নয়।');
   const mineRef=userRef.collection('botMining').doc(d.botId),mine=await tx.get(mineRef);
   if(mine.exists||(profile.unlockedBots||[]).includes(d.botId))fail('এই bot আপনার আগে থেকেই আছে। Code ব্যবহার হয়নি।');
   patch.unlockedBots=[...(profile.unlockedBots||[]),d.botId];
   tx.set(mineRef,{botId:d.botId,botName:pkg.name,durationDays:30,targetReward:pkg.target,earnedReward:0,status:'running',startedAt:F.serverTimestamp(),purchaseId:'code_'+code});
  }else{
   if(!['BDT','USD'].includes(d.rewardType)||!Number.isSafeInteger(d.amountMinor)||d.amountMinor<1)fail('Reward data সঠিক নয়।');
   const field=d.rewardType==='BDT'?'balance':'usdBalance',before=profile[field]??0;
   if(typeof before!=='number'||!Number.isFinite(before)||before<0)fail('Wallet balance যাচাই করা যায়নি।');
   patch[field]=before+d.amountMinor/100;
  }
  tx.set(claimRef,receipt);tx.update(userRef,patch);tx.update(codeRef,{claimedCount:d.claimedCount+1,lastClaimUid:user.uid,lastClaimAt:F.serverTimestamp()});result=receipt;
 });return result;
 }catch(error){
  // A competing claim can advance the server's counter before rules evaluate a
  // stale transaction. Re-read all documents; never replay a standalone credit.
  if(attempt===3||!['permission-denied','aborted','failed-precondition'].includes(error.code))throw error;
 }
 }
}
const api={bots,normalize,generate,claim};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HubRewardCodes=api;
})(typeof window!=='undefined'?window:globalThis);
