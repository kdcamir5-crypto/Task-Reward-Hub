'use strict';
const BOT_IDS=new Set(['pulse','quantum','neural','cyber','apex']);
function entry(uid,profile){
 const collectorId=profile.collectorId||profile.collector_id;
 if(typeof collectorId!=='string'||!/^\d{8}$/.test(collectorId))return null;
 const bots=profile.unlockedBots??[],referrals=profile.referralBotsCount??0;
 if(!Array.isArray(bots)||bots.some(id=>!BOT_IDS.has(id))||new Set(bots).size!==bots.length||!Number.isSafeInteger(referrals)||referrals<0||!Number.isSafeInteger(bots.length+referrals))return null;
 const name=[profile.name,profile.fullName,profile.username].find(v=>typeof v==='string'&&v.trim());
 return {uid,displayName:name?name.trim().slice(0,80):'Member',collectorId,botCount:bots.length+referrals};
}
async function syncMember(db,F,uid){
 const userRef=db.collection('users').doc(uid),rankRef=db.collection('publicLeaderboard').doc(uid);
 return db.runTransaction(async tx=>{
  // Read again inside the transaction so a concurrent bot purchase cannot be overwritten by a stale scan.
  const [user,rank]=await Promise.all([tx.get(userRef),tx.get(rankRef)]);
  if(!user.exists)return 'missing';
  const next=entry(uid,user.data());if(!next)return 'invalid';
  if(rank.exists&&Object.keys(next).every(key=>rank.data()[key]===next[key]))return 'unchanged';
  tx.set(rankRef,{...next,updatedAt:F.FieldValue.serverTimestamp()},{merge:true});
  return 'updated';
 });
}
async function syncLeaderboard(db,F){
 const users=await db.collection('users').select().get();
 const summary={scanned:users.size,updated:0,unchanged:0,invalid:0,missing:0,failed:0};
 for(const user of users.docs){try{summary[await syncMember(db,F,user.id)]++;}catch(_){summary.failed++;}}
 return summary;
}
async function main(){
 if(!process.env.FIREBASE_SERVICE_ACCOUNT)throw Error('SERVICE_ACCOUNT_MISSING');
 let credential;try{credential=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);}catch(_){throw Error('SERVICE_ACCOUNT_INVALID_JSON');}
 if(credential.project_id!=='reward-hub-bd')throw Error('SERVICE_ACCOUNT_WRONG_PROJECT');
 const admin=require('firebase-admin');admin.initializeApp({credential:admin.credential.cert(credential)});
 const summary=await syncLeaderboard(admin.firestore(),admin.firestore);
 console.log('LEADERBOARD_SYNC_SUMMARY '+JSON.stringify(summary));
 if(summary.failed)process.exitCode=1;
}
if(require.main===module)main().catch(error=>{const safe=['SERVICE_ACCOUNT_MISSING','SERVICE_ACCOUNT_INVALID_JSON','SERVICE_ACCOUNT_WRONG_PROJECT'];console.error(safe.includes(error.message)?error.message:'Leaderboard sync failed. Existing account data is preserved; check project access and retry.');process.exitCode=1;});
module.exports={entry,syncMember,syncLeaderboard};
