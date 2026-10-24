/* Purchase amounts are fixed here and independently enforced by firebase.rules. */
(function(root){
'use strict';
const packages=Object.freeze({
 pulse:{id:'pulse',name:'AI Pulse Bot v2',price:50,target:80,bonus:0.10,rate:'14.8 MH/s'},
 quantum:{id:'quantum',name:'Quantum Core Pro',price:100,target:160,bonus:0.20},
 neural:{id:'neural',name:'Neural Matrix Bot',price:200,target:320,bonus:0.40},
 cyber:{id:'cyber',name:'Cyber Forge Titan',price:300,target:480,bonus:0.60},
 apex:{id:'apex',name:'Apex Sentinel AI',price:500,target:800,bonus:1.00}
});
function fail(message){throw new Error(message);}
function owned(profile,id){const bots=profile.unlockedBots;if(bots==null)return false;if(!Array.isArray(bots))fail('আপনার পুরোনো bot data যাচাই করতে support-এ যোগাযোগ করুন।');return bots.includes(id);}
function amount(profile){if(typeof profile.balance!=='number'||!Number.isFinite(profile.balance)||profile.balance<0)fail('Wallet balance যাচাই করা যায়নি।');return profile.balance;}
function boundReferrer(profile){return profile.purchaseReferrerUid||profile.referredByUid||profile.referrerUid||'';}
function referral(profile,chosen,uid){
 const bound=boundReferrer(profile);
 if(bound&&(!chosen||chosen.uid!==bound))fail('আপনার সংরক্ষিত রেফারারের তথ্য যাচাই করুন।');
 if(!chosen)return {referrerUid:'',referrerCode:'',referrerName:''};
 if(chosen.uid===uid||!/^\d{8}$/.test(chosen.collectorId))fail('সঠিক রেফারার ID দিন। নিজের ID ব্যবহার করা যাবে না।');
 return {referrerUid:chosen.uid,referrerCode:chosen.collectorId,referrerName:chosen.displayName};
}
function miningData(pkg,orderId,F){return {botId:pkg.id,botName:pkg.name,durationDays:30,targetReward:pkg.target,earnedReward:0,status:'running',startedAt:F.serverTimestamp(),purchaseId:orderId};}
function creditReferral(tx,db,order,id,F){
 if(!order.referrerUid)return;
 tx.update(db.collection('users').doc(order.referrerUid),{balance:F.increment(order.amount/20),referralEarnings:F.increment(order.amount/20),lastReferralRewardId:id,updatedAt:F.serverTimestamp()});
}
async function purchase(db,F,user,id,method,chosen,payment){
 const pkg=packages[id];if(!pkg||!['wallet','bKash'].includes(method))fail('Invalid package or payment method.');
 const orderId=user.uid+'_'+id,orderRef=db.collection('botPurchaseRequests').doc(orderId),userRef=db.collection('users').doc(user.uid),mineRef=userRef.collection('botMining').doc(id);
 await db.runTransaction(async tx=>{
  const [userSnap,orderSnap,mineSnap]=await Promise.all([tx.get(userRef),tx.get(orderRef),tx.get(mineRef)]);
  if(!userSnap.exists)fail('Account profile পাওয়া যায়নি।');
  const profile=userSnap.data();
  if(owned(profile,id)||mineSnap.exists)fail('এই বট আপনার অ্যাকাউন্টে ইতোমধ্যে আছে।');
  if(orderSnap.exists&&orderSnap.data().status!=='rejected')fail(orderSnap.data().status==='pending'?'এই বটের পেমেন্ট Admin review-তে আছে।':'এই বট ইতোমধ্যে কেনা হয়েছে।');
  const ref=referral(profile,chosen,user.uid);
  if(ref.referrerUid){const publicSnap=await tx.get(db.collection('publicLeaderboard').doc(ref.referrerUid));if(!publicSnap.exists||publicSnap.data().collectorId!==ref.referrerCode)fail('রেফারার ID যাচাই করা যায়নি।');ref.referrerName=publicSnap.data().displayName;}
  const order={uid:user.uid,userName:String(profile.name||user.displayName||user.email||'Member'),email:user.email||'',botId:id,botName:pkg.name,amount:pkg.price,paymentMethod:method,senderNumber:'',trxId:'',receivingNumber:'',status:method==='wallet'?'approved':'pending',createdAt:F.serverTimestamp(),...ref};
  if(method==='wallet'){
   const balance=amount(profile);if(balance<pkg.price)fail('ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই! দয়া করে ওয়ালেট রিচার্জ করুন।');
   order.reviewedBy=user.uid;order.reviewedAt=F.serverTimestamp();
   tx.set(orderRef,order);
   tx.update(userRef,{balance:F.increment(-pkg.price),unlockedBots:[...(profile.unlockedBots||[]),id],lastBotPurchaseId:orderId,purchaseReferrerUid:ref.referrerUid,purchaseReferrerCode:ref.referrerCode,updatedAt:F.serverTimestamp()});
   tx.set(mineRef,miningData(pkg,orderId,F));
   creditReferral(tx,db,order,orderId,F);
  }else{
   const settings=await tx.get(db.collection('appSettings').doc('paymentSettings'));
   if(!settings.exists||settings.data().active!==true||!/^01[3-9][0-9]{8}$/.test(settings.data().bkashNumber||''))fail('Admin bKash payment চালু করেননি।');
   order.receivingNumber=settings.data().bkashNumber;
   order.senderNumber=String(payment.senderNumber||'').trim();order.trxId=String(payment.trxId||'').trim().toUpperCase();
   if(!/^01[3-9][0-9]{8}$/.test(order.senderNumber)||! /^(?:[A-Z0-9]){5,100}$/.test(order.trxId))fail('সঠিক bKash নম্বর ও Transaction ID দিন।');
   // Create-only marker shared with regular deposits: one TRX cannot fund both.
   tx.set(db.collection('usedDepositTransactions').doc(order.trxId),{uid:user.uid,depositId:orderId,trxId:order.trxId,source:'bot',createdAt:F.serverTimestamp()});
   tx.set(orderRef,order);
  }
 });
 return orderId;
}
async function review(db,F,admin,kind,id,approve,reason){
 if(!admin||!['deposits','bots'].includes(kind))fail('Admin sign-in required.');
 if(!approve&&(!reason||reason.trim().length<3||reason.trim().length>300))fail('Reject reason must be 3–300 characters.');
 const recordRef=db.collection(kind==='bots'?'botPurchaseRequests':'walletDeposits').doc(id);
 await db.runTransaction(async tx=>{
  const recordSnap=await tx.get(recordRef);if(!recordSnap.exists)fail('Request no longer exists.');
  const record=recordSnap.data();if(record.status!=='pending')fail('This request has already been reviewed.');
  const reviewData={status:approve?'approved':'rejected',reviewedBy:admin.uid,reviewedAt:F.serverTimestamp(),rejectionReason:approve?'':reason.trim()};
  if(!approve){tx.update(recordRef,reviewData);return;}
  const userRef=db.collection('users').doc(record.uid),userSnap=await tx.get(userRef);if(!userSnap.exists)fail('User profile not found.');
  const profile=userSnap.data();const balance=amount(profile);
  if(kind==='deposits'){
   if(record.type!=='bKash'||!Number.isInteger(record.amount)||record.amount<100||record.amount>50000)fail('Invalid deposit amount or method.');
   tx.update(userRef,{balance:F.increment(record.amount),updatedAt:F.serverTimestamp()});
  }else{
   const pkg=packages[record.botId];if(!pkg||record.amount!==pkg.price||record.paymentMethod!=='bKash')fail('Invalid bot package, price or payment method.');
   const mineRef=userRef.collection('botMining').doc(pkg.id),mine=await tx.get(mineRef);
   if(owned(profile,pkg.id)||mine.exists)fail('This bot is already unlocked. Reject this duplicate payment request and contact the user.');
   const bound=boundReferrer(profile);if(bound&&bound!==record.referrerUid)fail('Referrer differs from the user’s saved referral. Verify before approval.');
   if(record.referrerUid){
    if(record.referrerUid===record.uid)fail('Self-referral is not allowed.');
    const refSnap=await tx.get(db.collection('users').doc(record.referrerUid));
    if(!refSnap.exists||refSnap.data().collectorId!==record.referrerCode)fail('Referrer account or Collector ID could not be verified.');
    amount(refSnap.data());
   }
   // Direct payment unlocks the bot; it does not also credit the buyer wallet.
   tx.update(userRef,{unlockedBots:[...(profile.unlockedBots||[]),pkg.id],lastBotPurchaseId:id,purchaseReferrerUid:record.referrerUid||'',purchaseReferrerCode:record.referrerCode||'',updatedAt:F.serverTimestamp()});
   tx.set(mineRef,miningData(pkg,id,F));creditReferral(tx,db,record,id,F);
  }
  tx.update(recordRef,reviewData);
 });
}
root.HubBotPurchase={packages,owned,boundReferrer,purchase,review};
})(typeof window==='undefined'?globalThis:window);
