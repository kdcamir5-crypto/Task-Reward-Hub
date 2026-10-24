'use strict';
const DAY_MS=86400000;
const PACKAGES=Object.freeze({
 pulse:{name:'AI Pulse Bot v2',target:80},quantum:{name:'Quantum Core Pro',target:160},
 neural:{name:'Neural Matrix Bot',target:320},cyber:{name:'Cyber Forge Titan',target:480},apex:{name:'Apex Sentinel AI',target:800}
});
const RUNNING=new Set(['running','active','mining','started']);
function unlockedIds(value){
 if(value==null)return [];
 if(!Array.isArray(value))return null;
 return [...new Set(value.filter(id=>typeof id==='string'&&Object.hasOwn(PACKAGES,id)))];
}
function timestampMs(value){
 if(value&&typeof value.toMillis==='function')return value.toMillis();
 if(value instanceof Date)return value.getTime();
 if(typeof value==='string'&&value.trim())return Date.parse(value);
 if(typeof value==='number')return value;
 return NaN;
}
function moneyMinor(value){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0)return null;
 const minor=Math.round(value*100);
 return Number.isSafeInteger(minor)&&Math.abs(value*100-minor)<0.000001?minor:null;
}
function calculateReward(record,pkg,now){
 const start=timestampMs(record.startedAt);
 if(!Number.isFinite(start)||start<=0)return {kind:'invalidStart'};
 if(start>now)return {kind:'futureStart'};
 const earnedMinor=moneyMinor(record.earnedReward),targetMinor=pkg.target*100;
 if(record.durationDays!==30||record.targetReward!==pkg.target||earnedMinor===null||earnedMinor>targetMinor)return {kind:'invalidRecord'};
 const elapsed=Math.min(30*DAY_MS,Math.max(0,now-start));
 const accruedMinor=Math.min(targetMinor,Math.round(targetMinor*elapsed/(30*DAY_MS)));
 // Progress never goes backwards, even after clock corrections or a worker retry.
 const nextMinor=Math.max(earnedMinor,accruedMinor);
 return {kind:'valid',deltaMinor:nextMinor-earnedMinor,nextMinor,complete:elapsed>=30*DAY_MS||nextMinor===targetMinor};
}
async function processBot(db,F,uid,id,now=Date.now(),recordId=id){
 const pkg=PACKAGES[id];if(!pkg)return {kind:'unsupported'};
 const userRef=db.collection('users').doc(uid),recordRef=userRef.collection('botMining').doc(recordId);
 return db.runTransaction(async tx=>{
  const [userSnap,recordSnap]=await Promise.all([tx.get(userRef),tx.get(recordRef)]);
  if(!userSnap.exists)return {kind:'notEligible'};
  const profile=userSnap.data(),ids=unlockedIds(profile.unlockedBots);
  if(ids===null)return {kind:'invalidProfile'};
  if(!ids.includes(id))return {kind:'notEligible'};
  if(!recordSnap.exists){
   tx.create(recordRef,{botId:id,botName:pkg.name,durationDays:30,targetReward:pkg.target,earnedReward:0,status:'running',startedAt:F.Timestamp.fromMillis(now),createdAt:F.FieldValue.serverTimestamp(),updatedAt:F.FieldValue.serverTimestamp()});
   return {kind:'created'};
  }
  const record=recordSnap.data();
  if(!RUNNING.has(String(record.status||'').toLowerCase()))return {kind:'stopped'};
  if(record.botId!==id)return {kind:'invalidRecord'};
  const calculation=calculateReward(record,pkg,now);
  if(calculation.kind==='invalidStart'){
   tx.update(recordRef,{status:'error',errorCode:'INVALID_START_TIME',updatedAt:F.FieldValue.serverTimestamp()});
   return calculation;
  }
  if(calculation.kind!=='valid')return calculation;
  if(moneyMinor(profile.balance)===null)return {kind:'invalidBalance'};
  if(calculation.deltaMinor===0&&!calculation.complete)return {kind:'unchanged'};
  const patch={earnedReward:calculation.nextMinor/100,updatedAt:F.FieldValue.serverTimestamp(),lastProcessedAt:F.FieldValue.serverTimestamp()};
  if(calculation.complete){patch.status='completed';patch.completedAt=F.FieldValue.serverTimestamp();}
  if(calculation.deltaMinor>0)tx.update(userRef,{balance:F.FieldValue.increment(calculation.deltaMinor/100),updatedAt:F.FieldValue.serverTimestamp()});
  tx.update(recordRef,patch);
  return {kind:'processed',deltaMinor:calculation.deltaMinor,completed:calculation.complete};
 });
}
async function runMining(db,F,{now=Date.now()}={}){
 const users=await db.collection('users').select('unlockedBots').get();
 const summary={profilesScanned:users.size,eligibleBots:0,recordsCreated:0,recordsCredited:0,creditedPaisa:0,recordsCompleted:0,unchanged:0,stopped:0,futureStarts:0,invalidStartTimes:0,invalidRecords:0,failed:0};
 for(const user of users.docs){
  const ids=unlockedIds(user.data().unlockedBots);
  if(ids===null){summary.invalidRecords++;continue;}
  if(!ids.length)continue;
  // Keep legacy record IDs and their paid progress; do not create a second copy.
  let existing;
  try{existing=await user.ref.collection('botMining').get();}catch(_){summary.failed++;continue;}
  for(const id of ids){
   summary.eligibleBots++;
   const matching=existing.docs.filter(doc=>doc.id===id||doc.data().botId===id);
   if(matching.length>1){summary.invalidRecords++;continue;}
   try{
    const result=await processBot(db,F,user.id,id,now,matching.length?matching[0].id:id);
    if(result.kind==='created')summary.recordsCreated++;
    else if(result.kind==='processed'){if(result.deltaMinor>0)summary.recordsCredited++;summary.creditedPaisa+=result.deltaMinor;if(result.completed)summary.recordsCompleted++;}
    else if(result.kind==='unchanged'||result.kind==='notEligible')summary.unchanged++;
    else if(result.kind==='stopped')summary.stopped++;
    else if(result.kind==='futureStart')summary.futureStarts++;
    else if(result.kind==='invalidStart')summary.invalidStartTimes++;
    else summary.invalidRecords++;
   }catch(_){summary.failed++;}
  }
 }
 return summary;
}
async function main(){
 if(!process.env.FIREBASE_SERVICE_ACCOUNT)throw new Error('SERVICE_ACCOUNT_MISSING');
 const admin=require('firebase-admin');let credential;
 try{credential=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);}catch(_){throw new Error('SERVICE_ACCOUNT_INVALID_JSON');}
 if(credential.project_id!=='reward-hub-bd')throw new Error('SERVICE_ACCOUNT_WRONG_PROJECT');
 admin.initializeApp({credential:admin.credential.cert(credential)});
 const summary=await runMining(admin.firestore(),admin.firestore);
 console.log('MINING_SUMMARY '+JSON.stringify(summary));
 if(summary.failed>0)process.exitCode=1;
}
if(require.main===module)main().catch(error=>{
 const safe=new Set(['SERVICE_ACCOUNT_MISSING','SERVICE_ACCOUNT_INVALID_JSON','SERVICE_ACCOUNT_WRONG_PROJECT']);
 console.error(safe.has(error.message)?error.message:'Mining worker failed. Check Firebase project access and retry; existing progress is preserved.');
 process.exitCode=1;
});
module.exports={PACKAGES,DAY_MS,unlockedIds,timestampMs,moneyMinor,calculateReward,processBot,runMining};
