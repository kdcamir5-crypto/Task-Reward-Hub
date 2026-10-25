'use strict';
const CHANNEL='@freelancing_incom';
const PACKAGES={pulse:{price:50,target:80,name:'AI Pulse Bot v2'},quantum:{price:100,target:160,name:'Quantum Core Pro'},neural:{price:200,target:320,name:'Neural Matrix Bot'},cyber:{price:300,target:480,name:'Cyber Forge Titan'},apex:{price:500,target:800,name:'Apex Sentinel AI'}};
function botForOrdinal(n){if(!Number.isSafeInteger(n)||n<1)throw Error('INVALID_ORDINAL');return Object.keys(PACKAGES)[Math.floor(((n-1)%100)/20)];}
function isMember(member){return !!member&&(['creator','administrator','member'].includes(member.status)||(member.status==='restricted'&&member.is_member===true));}
function validPurchase(d,uid){return d&&d.uid===uid&&d.status==='approved'&&['wallet','bKash'].includes(d.paymentMethod)&&PACKAGES[d.botId]?.price===d.amount;}
async function linkIdentity(db,F,nonce,telegramId,now=Date.now()){
 if(!/^[a-f0-9]{48}$/.test(nonce)||!/^\d{1,20}$/.test(telegramId))return false;
 const requests=await db.collection('telegramLinkRequests').where('token','==',nonce).limit(2).get();if(requests.size!==1)return false;
 const requestRef=requests.docs[0].ref;
 return db.runTransaction(async tx=>{
  const request=await tx.get(requestRef);const d=request.data();if(!d||d.uid!==requestRef.id||d.token!==nonce||d.expiresAtMs<now||d.status==='linked')return false;
  const userRef=db.collection('users').doc(d.uid),identityRef=db.collection('telegramIdentities').doc(telegramId),referralRef=db.collection('referrals').doc(d.uid);
  const [user,identity,referral]=await Promise.all([tx.get(userRef),tx.get(identityRef),tx.get(referralRef)]);
  if(!user.exists||(identity.exists&&identity.data().uid!==d.uid)||(user.data().telegramUserId&&user.data().telegramUserId!==telegramId)){tx.update(requestRef,{status:'rejected',checkedAt:F.FieldValue.serverTimestamp()});return false;}
  tx.set(identityRef,{uid:d.uid,telegramUserId:telegramId,linkedAt:F.FieldValue.serverTimestamp()});
  tx.update(userRef,{telegramUserId:telegramId,telegramLinkedAt:F.FieldValue.serverTimestamp()});
  tx.update(requestRef,{status:'linked',checkedAt:F.FieldValue.serverTimestamp()});
  if(referral.exists)tx.update(referralRef,{telegramLinked:true,updatedAt:F.FieldValue.serverTimestamp()});
  return true;
 });
}
async function verifyAndAward(db,F,uid,orderId,membership,now=Date.now()){
 const referralRef=db.collection('referrals').doc(uid),userRef=db.collection('users').doc(uid),awardRef=db.collection('referralAwards').doc(uid);
 return db.runTransaction(async tx=>{
  const [referral,user,award]=await Promise.all([tx.get(referralRef),tx.get(userRef),tx.get(awardRef)]);
  if(!referral.exists||!user.exists)return 'missing';
  const d=referral.data(),u=user.data();if(d.status==='verified'||award.exists)return 'already';
  if(d.inviteeUid!==uid||!d.referrerUid||d.referrerUid===uid||u.referrerUid!==d.referrerUid)return 'invalid';
  const referrerRef=db.collection('users').doc(d.referrerUid),identityRef=u.telegramUserId?db.collection('telegramIdentities').doc(u.telegramUserId):null;
  const orderRef=orderId?db.collection('botPurchaseRequests').doc(orderId):null;
  const [referrer,identity,order]=await Promise.all([tx.get(referrerRef),identityRef?tx.get(identityRef):null,orderRef?tx.get(orderRef):null]);
  const bought=!!order?.exists&&validPurchase(order.data(),uid),linked=!!identity?.exists&&identity.data().uid===uid;
  const flags={purchaseVerified:bought,telegramLinked:linked,channelVerified:linked&&membership===true,updatedAt:F.FieldValue.serverTimestamp()};
  if(!referrer.exists||!bought||!linked||membership!==true){tx.update(referralRef,flags);return 'pending';}
  const previous=referrer.data().verifiedReferralCount??0;if(!Number.isSafeInteger(previous)||previous<0)return 'invalid';
  const ordinal=previous+1,botId=botForOrdinal(ordinal),pkg=PACKAGES[botId],instanceId='referral_'+uid;
  const mineRef=referrerRef.collection('botMining').doc(instanceId),existingMine=await tx.get(mineRef);
  if(existingMine.exists)return 'invalid';
  tx.create(awardRef,{inviteeUid:uid,recipientUid:d.referrerUid,ordinal,botId,instanceId,createdAt:F.FieldValue.serverTimestamp()});
  tx.create(mineRef,{botId,botName:pkg.name,durationDays:30,targetReward:pkg.target,earnedReward:0,status:'running',startedAt:F.Timestamp.fromMillis(now),source:'referral',awardId:uid,referralOrdinal:ordinal,createdAt:F.FieldValue.serverTimestamp()});
  tx.update(referrerRef,{verifiedReferralCount:ordinal,referralBotsCount:F.FieldValue.increment(1),referrals:F.FieldValue.increment(1),updatedAt:F.FieldValue.serverTimestamp()});
  tx.update(referralRef,{...flags,status:'verified',ordinal,rewardBotId:botId,verifiedAt:F.FieldValue.serverTimestamp()});
  tx.update(userRef,{referralStatus:'verified'});
  return 'awarded';
 });
}
function telegramApi(token){return async(method,body={})=>{
 let response;try{response=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});}catch(_){throw Error('TELEGRAM_CONNECTION_FAILED');}
 let data;try{data=await response.json();}catch(_){throw Error('TELEGRAM_RESPONSE_INVALID');}
 if(!response.ok||!data.ok)throw Error('TELEGRAM_API_'+String(data.error_code||response.status));return data.result;
};}
async function run(db,F,api,{now=Date.now()}={}){
 const me=await api('getMe'),hook=await api('getWebhookInfo');if(hook.url)throw Error('TELEGRAM_WEBHOOK_PRESENT_USE_DEDICATED_VERIFICATION_BOT');
 const self=await api('getChatMember',{chat_id:CHANNEL,user_id:me.id});if(!['administrator','creator'].includes(self.status))throw Error('VERIFICATION_BOT_MUST_BE_CHANNEL_ADMIN');
 await db.collection('appSettings').doc('referralSettings').set({channel:CHANNEL,botUsername:me.username,active:true,updatedAt:F.FieldValue.serverTimestamp()});
 const stateRef=db.collection('systemState').doc('telegramReferralPolling'),state=await stateRef.get();let offset=state.exists?state.data().offset||0:0;
 const summary={linked:0,pending:0,awarded:0,already:0,invalid:0};
 for(let page=0;page<10;page++){
  const updates=await api('getUpdates',{offset,limit:100,timeout:0,allowed_updates:['message']});
  for(const update of updates){
   const m=update.message,match=m?.chat?.type==='private'&&!m.from?.is_bot&&m.text?.match(/^\/start(?:@\w+)?\s+verify_([a-f0-9]{48})$/);
   if(match&&Number.isSafeInteger(m.from.id)&&m.from.id>0&&await linkIdentity(db,F,match[1],String(m.from.id),now))summary.linked++;
   offset=Math.max(offset,update.update_id+1);
  }
  await stateRef.set({offset,updatedAt:F.FieldValue.serverTimestamp()});if(updates.length<100)break;
 }
 const referrals=await db.collection('referrals').where('status','==','pending').get();
 for(const referral of referrals.docs){
  const uid=referral.id,user=await db.collection('users').doc(uid).get();if(!user.exists){summary.invalid++;continue;}
  const orders=await db.collection('botPurchaseRequests').where('uid','==',uid).get();
  const order=orders.docs.find(doc=>validPurchase(doc.data(),uid));let member=false;
  if(user.data().telegramUserId){try{member=isMember(await api('getChatMember',{chat_id:CHANNEL,user_id:user.data().telegramUserId}));}catch(_){member=false;}}
  const result=await verifyAndAward(db,F,uid,order?.id||'',member,now);summary[result==='missing'?'invalid':result]++;
 }
 return summary;
}
async function main(){
 const admin=require('firebase-admin');if(!process.env.FIREBASE_SERVICE_ACCOUNT)throw Error('FIREBASE_SERVICE_ACCOUNT_MISSING');
 let credential;try{credential=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);}catch(_){throw Error('FIREBASE_SERVICE_ACCOUNT_INVALID');}
 if(credential.project_id!=='reward-hub-bd')throw Error('FIREBASE_PROJECT_MISMATCH');admin.initializeApp({credential:admin.credential.cert(credential)});
 if(!process.env.TELEGRAM_VERIFICATION_BOT_TOKEN){console.log('SETUP_REQUIRED: add TELEGRAM_VERIFICATION_BOT_TOKEN and make that bot admin of '+CHANNEL+'. No referral was verified or awarded.');return;}
 const summary=await run(admin.firestore(),admin.firestore,telegramApi(process.env.TELEGRAM_VERIFICATION_BOT_TOKEN));console.log('REFERRAL_SUMMARY '+JSON.stringify(summary));
}
if(require.main===module)main().catch(error=>{const allowed=/^(TELEGRAM_[A-Z_0-9]+|VERIFICATION_BOT_MUST_BE_CHANNEL_ADMIN|FIREBASE_[A-Z_]+)$/;console.error(allowed.test(error.message)?error.message:'Referral verification failed; no unchecked membership is accepted.');process.exitCode=1;});
module.exports={CHANNEL,PACKAGES,botForOrdinal,isMember,validPurchase,linkIdentity,verifyAndAward,run};
